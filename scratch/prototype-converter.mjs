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

async function prototypeConvert(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const numPages = pdf.numPages;

  console.log(`Starting conversion of ${numPages} pages...`);

  // Document page properties
  let docWidthDxa = 11906; // A4 default
  let docHeightDxa = 16838;
  let docOrientation = PageOrientation.PORTRAIT;
  let globalHeader = null;
  let globalFooter = null;

  // Extracted elements across all pages
  // Each page will have an array of blocks:
  // - { type: 'heading', level: 1|2|3, text, runs }
  // - { type: 'paragraph', runs, isBullet, bulletPrefix }
  // - { type: 'table', headers, rows, colWidths }
  // - { type: 'pageBreak' }

  const allPageBlocks = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    if (pageNum === 1) {
      const isLandscape = viewport.width > viewport.height;
      docOrientation = isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT;
      docWidthDxa = Math.round(viewport.width * 20);
      docHeightDxa = Math.round(viewport.height * 20);
    }

    // Extract positioned items
    const rawItems = (textContent.items || [])
      .filter((it) => it.str && it.str.trim())
      .map((it) => {
        const a = it.transform?.[0] || 1;
        const b = it.transform?.[1] || 0;
        const rotAngle = Math.round(Math.atan2(b, a) * 180 / Math.PI);
        const hasHindi = /[\u0900-\u097F]/.test(it.str);
        const fontSize = Math.round(it.height || Math.abs(it.transform?.[0]) || 10);

        return {
          str: it.str,
          x: Math.round(it.transform?.[4] || 0),
          y: Math.round(it.transform?.[5] || 0),
          w: Math.round(it.width || (it.str.length * fontSize * 0.5)),
          h: fontSize,
          bold: /bold|black|heavy|semibold/i.test(it.fontName || ''),
          italic: /italic|oblique/i.test(it.fontName || ''),
          fontName: it.fontName || '',
          hasHindi,
          rotAngle: Math.abs(rotAngle) === 90 || Math.abs(rotAngle) === 270 ? rotAngle : 0
        };
      });

    // Separate header/footer
    const headerThreshold = viewport.height - 40;
    const footerThreshold = 40;

    const pageHeaderItems = [];
    const pageFooterItems = [];
    const bodyItems = [];

    for (const it of rawItems) {
      if (it.rotAngle !== 0) continue;
      if (it.y >= headerThreshold) {
        pageHeaderItems.push(it);
      } else if (it.y <= footerThreshold || /page\s*\d+(\s*of\s*\d+)?/i.test(it.str)) {
        pageFooterItems.push(it);
      } else {
        bodyItems.push(it);
      }
    }

    if (pageNum === 1) {
      if (pageHeaderItems.length > 0 && !globalHeader) {
        globalHeader = pageHeaderItems.map(h => h.str).join(' ');
      }
      if (pageFooterItems.length > 0 && !globalFooter) {
        globalFooter = pageFooterItems.map(f => f.str).join(' ');
      }
    }

    // Group items into lines by Y coordinate (within 4pt)
    const lineMap = {};
    for (const it of bodyItems) {
      const y = it.y;
      let foundY = Object.keys(lineMap).find((ly) => Math.abs(Number(ly) - y) <= 4);
      if (!foundY) {
        foundY = y;
        lineMap[foundY] = [];
      }
      lineMap[foundY].push(it);
    }

    const sortedY = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
    const lines = sortedY.map((y) => {
      const items = lineMap[y].sort((a, b) => a.x - b.x);
      return {
        y,
        items,
        startX: items[0].x,
        endX: items[items.length - 1].x + items[items.length - 1].w,
        fullText: items.map(it => it.str).join(' ').trim()
      };
    }).filter(l => l.fullText.length > 0);

    // Identify Table candidates vs Text lines
    // A true table row has multiple distinct column cells separated by substantial horizontal gaps (> 25pt)
    // AND the column positions must be consistent across multiple rows!
    const pageBlocks = [];
    let i = 0;

    while (i < lines.length) {
      const currentLine = lines[i];

      // Check if currentLine and subsequent lines could be a table
      // Look ahead to see if 2 or more consecutive lines have multi-column alignment
      let tableRows = [];
      let j = i;

      while (j < lines.length) {
        const line = lines[j];
        // Does this line look like a table row?
        // It must have 2 or more items, and items must be separated by gaps or distinct columns
        // Check if items are distinct columns (gap >= 20 between items)
        const cols = [];
        let curCol = [line.items[0]];

        for (let k = 1; k < line.items.length; k++) {
          const prev = line.items[k - 1];
          const curr = line.items[k];
          const gap = curr.x - (prev.x + prev.w);
          // If gap >= 18pt or curr.x is significantly spaced, it's a new column
          if (gap >= 18) {
            cols.push(curCol);
            curCol = [curr];
          } else {
            curCol.push(curr);
          }
        }
        cols.push(curCol);

        // A line is a table candidate if cols.length >= 2, AND it is NOT a bullet point or sentence
        const isBullet = /^[•\-\*]\s*|^\d+[\.\)]\s*/.test(line.fullText);
        const isHeading = line.items[0].h >= 14 || (line.items[0].bold && line.items.length === 1 && line.fullText.length < 50);

        if (cols.length >= 2 && !isBullet && !isHeading) {
          tableRows.push({ line, cols, y: line.y });
          j++;
        } else {
          break;
        }
      }

      // Only treat as a table if there are AT LEAST 2 rows (or if it continues a table)
      // And check if column positions somewhat align
      if (tableRows.length >= 2) {
        // Verify column alignment consistency
        const col0X = tableRows.map(r => r.cols[0][0].x);
        const col1X = tableRows.map(r => r.cols[1][0].x);
        const col0Spread = Math.max(...col0X) - Math.min(...col0X);
        const col1Spread = Math.max(...col1X) - Math.min(...col1X);

        if (col0Spread <= 25 && col1Spread <= 35) {
          // Valid table!
          pageBlocks.push({
            type: 'table',
            rows: tableRows.map(tr => tr.cols.map(c => ({
              text: c.map(it => it.str).join(' ').trim(),
              bold: c.some(it => it.bold),
              italic: c.some(it => it.italic),
              hasHindi: c.some(it => it.hasHindi),
              fontSize: c[0].h,
              x: c[0].x,
              w: c[c.length - 1].x + c[c.length - 1].w - c[0].x
            }))),
            page: pageNum
          });
          i = j;
          continue;
        }
      }

      // Not a table row -> it's text (heading, paragraph, or bullet list)
      const line = lines[i];
      const isBullet = /^[•\-\*]\s+/.test(line.fullText) || /^•/.test(line.fullText);
      const isNumbered = /^\d+[\.\)]\s+/.test(line.fullText);
      const fontSize = line.items[0].h;
      const isHeading1 = fontSize >= 18;
      const isHeading2 = fontSize >= 13 && fontSize < 18 && (line.items[0].bold || /^\d+\.\s+/.test(line.fullText));

      if (isHeading1 || isHeading2) {
        pageBlocks.push({
          type: 'heading',
          level: isHeading1 ? 1 : 2,
          text: line.fullText,
          runs: line.items,
          page: pageNum
        });
        i++;
      } else if (isBullet || isNumbered) {
        // Bullet or numbered item - collect continuation lines
        const bulletLines = [line];
        let nextI = i + 1;
        while (nextI < lines.length) {
          const nextLine = lines[nextI];
          const nextIsBullet = /^[•\-\*]\s+/.test(nextLine.fullText) || /^•/.test(nextLine.fullText) || /^\d+[\.\)]\s+/.test(nextLine.fullText);
          const nextIsHeading = nextLine.items[0].h >= 13 && (nextLine.items[0].bold || /^\d+\.\s+/.test(nextLine.fullText));
          const yDiff = Math.abs(lines[nextI - 1].y - nextLine.y);

          // Continuation if indented or regular line gap (< 18pt) and not a new bullet/heading
          if (!nextIsBullet && !nextIsHeading && yDiff <= 18 && nextLine.startX >= line.startX) {
            bulletLines.push(nextLine);
            nextI++;
          } else {
            break;
          }
        }

        pageBlocks.push({
          type: isBullet ? 'bullet' : 'numbered',
          lines: bulletLines,
          text: bulletLines.map(bl => bl.fullText).join(' '),
          page: pageNum
        });
        i = nextI;
      } else {
        // Regular paragraph - collect continuation lines
        const paraLines = [line];
        let nextI = i + 1;
        while (nextI < lines.length) {
          const nextLine = lines[nextI];
          const nextIsBullet = /^[•\-\*]\s+/.test(nextLine.fullText) || /^•/.test(nextLine.fullText) || /^\d+[\.\)]\s+/.test(nextLine.fullText);
          const nextIsHeading = nextLine.items[0].h >= 13 && (nextLine.items[0].bold || /^\d+\.\s+/.test(nextLine.fullText));
          const yDiff = Math.abs(lines[nextI - 1].y - nextLine.y);

          // Continuation if normal line spacing (<= 18pt) and not a bullet or heading
          if (!nextIsBullet && !nextIsHeading && yDiff <= 18 && Math.abs(nextLine.startX - line.startX) <= 15) {
            paraLines.push(nextLine);
            nextI++;
          } else {
            break;
          }
        }

        pageBlocks.push({
          type: 'paragraph',
          lines: paraLines,
          text: paraLines.map(pl => pl.fullText).join(' '),
          page: pageNum
        });
        i = nextI;
      }
    }

    allPageBlocks.push({ pageNum, blocks: pageBlocks, viewport });
  }

  // Print inspection of extracted blocks
  console.log('\n--- EXTRACTED BLOCKS SUMMARY ---');
  allPageBlocks.forEach(pb => {
    console.log(`\n=== PAGE ${pb.pageNum} (${pb.blocks.length} blocks) ===`);
    pb.blocks.forEach((b, idx) => {
      if (b.type === 'heading') {
        console.log(`[${idx}] HEADING ${b.level}: "${b.text}"`);
      } else if (b.type === 'bullet') {
        console.log(`[${idx}] BULLET (${b.lines.length} lines): "${b.text.slice(0, 80)}..."`);
      } else if (b.type === 'numbered') {
        console.log(`[${idx}] NUMBERED (${b.lines.length} lines): "${b.text.slice(0, 80)}..."`);
      } else if (b.type === 'table') {
        console.log(`[${idx}] TABLE (${b.rows.length} rows, ${b.rows[0].length} cols):`);
        b.rows.slice(0, 3).forEach(r => console.log(`      ${r.map(c => c.text).join(' | ')}`));
        if (b.rows.length > 3) console.log(`      ... and ${b.rows.length - 3} more rows`);
      } else {
        console.log(`[${idx}] PARAGRAPH (${b.lines.length} lines): "${b.text.slice(0, 80)}..."`);
      }
    });
  });

  return allPageBlocks;
}

const filePath = 'C:/Users/khush/Downloads/JajritiYatra-Content.pdf';
prototypeConvert(fs.readFileSync(filePath)).catch(console.error);
