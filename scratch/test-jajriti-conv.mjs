import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageBreak,
  HeadingLevel,
  PageOrientation,
  Header,
  Footer,
  ShadingType,
  Packer
} from 'docx';

// We can test the current logic from convertPdfToDocx
async function run() {
  const filePath = 'C:/Users/khush/Downloads/JajritiYatra-Content.pdf';
  const arrayBuffer = fs.readFileSync(filePath);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const numPages = pdf.numPages;

  console.log('PDF pages:', numPages);

  // Let's inspect page 1 & 2 current conversion
  // We'll replicate iloveEngine.js lines 360-738
  const docChildren = [];
  let detectedTables = 0;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    if (i > 1) {
      docChildren.push({ type: 'PAGE_BREAK' });
    }

    const allItems = (textContent.items || [])
      .filter((it) => it.str && it.str.trim())
      .map((it) => {
        const a = it.transform?.[0] || 1;
        const b = it.transform?.[1] || 0;
        const rotAngle = Math.round(Math.atan2(b, a) * 180 / Math.PI);
        return {
          str: it.str,
          x: Math.round(it.transform?.[4] || 0),
          y: Math.round(it.transform?.[5] || 0),
          w: Math.round(it.width || (it.str.length * (it.height || 10) * 0.5)),
          h: Math.round(it.height || it.transform?.[0] || 12),
          bold: /bold|black|heavy|semibold/i.test(it.fontName || ''),
          italic: /italic|oblique/i.test(it.fontName || ''),
          rotAngle: Math.abs(rotAngle) === 90 || Math.abs(rotAngle) === 270 ? rotAngle : 0
        };
      });

    const headerThreshold = viewport.height - 45;
    const footerThreshold = 45;
    const bodyItems = allItems.filter(it => it.rotAngle === 0 && it.y < headerThreshold && it.y > footerThreshold);

    // Group items by Y coordinate
    const rowMap = {};
    for (const it of bodyItems) {
      const y = it.y;
      let foundY = Object.keys(rowMap).find((ry) => Math.abs(Number(ry) - y) <= 4);
      if (!foundY) {
        foundY = y;
        rowMap[foundY] = [];
      }
      rowMap[foundY].push(it);
    }

    const sortedY = Object.keys(rowMap).map(Number).sort((a, b) => b - a);
    const rows = sortedY.map((y) => ({
      y,
      items: rowMap[y].sort((a, b) => a.x - b.x)
    }));

    let tableBuffer = [];
    function flush() {
      if (tableBuffer.length === 0) return;
      docChildren.push({
        type: 'TABLE',
        page: i,
        rowCount: tableBuffer.length,
        rows: tableBuffer.map(r => r.items.map(it => it.str).join(' | '))
      });
      tableBuffer = [];
    }

    for (const row of rows) {
      const isTableRow = row.items.length >= 2 && (row.items[row.items.length - 1].x - row.items[0].x > 60);
      if (isTableRow) {
        if (tableBuffer.length > 0) {
          const prevY = tableBuffer[tableBuffer.length - 1].y;
          if (Math.abs(prevY - row.y) > 35) {
            flush();
          }
        }
        tableBuffer.push(row);
      } else {
        flush();
        const text = row.items.map(it => it.str).join(' ').trim();
        if (text) {
          docChildren.push({ type: 'P', page: i, text });
        }
      }
    }
    flush();
  }

  console.log(`\n--- Converted Elements Summary (${docChildren.length} elements) ---`);
  docChildren.forEach((el, idx) => {
    if (el.type === 'PAGE_BREAK') {
      console.log(`[${idx}] === HARD PAGE BREAK ===`);
    } else if (el.type === 'TABLE') {
      console.log(`[${idx}] (Page ${el.page}) TABLE (${el.rowCount} rows):`);
      el.rows.forEach(r => console.log(`      ${r}`));
    } else {
      console.log(`[${idx}] (Page ${el.page}) P: "${el.text}"`);
    }
  });
}

run().catch(console.error);
