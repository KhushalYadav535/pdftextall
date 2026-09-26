import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import JSZip from 'jszip';
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

async function convertAndInspect() {
  const filePath = 'C:/Users/khush/Downloads/JajritiYatra-Content.pdf';
  const arrayBuffer = fs.readFileSync(filePath);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const numPages = pdf.numPages;

  console.log(`Processing ${numPages} pages...`);

  // Document page properties
  let docWidthDxa = 11906; // A4 default
  let docHeightDxa = 16838;
  let docOrientation = PageOrientation.PORTRAIT;
  let globalHeader = null;
  let globalFooter = null;

  const docChildren = [];
  const pageContentWidthDxa = 9026; // ~11906 - 2880 margins

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
    let i = 0;
    while (i < lines.length) {
      const currentLine = lines[i];

      // Table detection: check if consecutive lines share aligned columns
      // A table must have >= 2 rows, each with >= 2 columns
      let tableRows = [];
      let j = i;

      while (j < lines.length) {
        const line = lines[j];
        // Don't treat bullet points, numbered steps, or headings as table rows
        const isBullet = /^[•\-\*]\s*|^\d+[\.\)]\s*/.test(line.fullText);
        const isHeading = line.items[0].h >= 13 && (line.items[0].bold || /^\d+\.\s+/.test(line.fullText));
        if (isBullet || isHeading) break;

        // Check if line has multiple items with distinct gaps (>= 18pt)
        const cols = [];
        let curCol = [line.items[0]];

        for (let k = 1; k < line.items.length; k++) {
          const prev = line.items[k - 1];
          const curr = line.items[k];
          const gap = curr.x - (prev.x + prev.w);
          if (gap >= 16) {
            cols.push(curCol);
            curCol = [curr];
          } else {
            curCol.push(curr);
          }
        }
        cols.push(curCol);

        if (cols.length >= 2) {
          tableRows.push({ line, cols, y: line.y });
          j++;
        } else {
          break;
        }
      }

      if (tableRows.length >= 2) {
        // Build table
        // Find column cluster X coordinates
        const allColStarts = [];
        tableRows.forEach(r => {
          r.cols.forEach(c => allColStarts.push(c[0].x));
        });
        allColStarts.sort((a, b) => a - b);

        const colClusters = [];
        for (const x of allColStarts) {
          const match = colClusters.find(c => Math.abs(c.avg - x) <= 20);
          if (match) {
            match.points.push(x);
            match.avg = Math.round(match.points.reduce((a, b) => a + b, 0) / match.points.length);
          } else {
            colClusters.push({ avg: x, points: [x] });
          }
        }
        colClusters.sort((a, b) => a.avg - b.avg);
        const numCols = Math.max(colClusters.length, 2);

        // Estimate column widths proportionally
        const colWidths = [];
        for (let c = 0; c < numCols; c++) {
          const startX = colClusters[c].avg;
          const nextStartX = c + 1 < numCols ? colClusters[c + 1].avg : (tableRows[0].line.endX + 20);
          colWidths.push(Math.max(20, nextStartX - startX));
        }
        const totalW = colWidths.reduce((a, b) => a + b, 0);
        const colWidthsDxa = colWidths.map(w => Math.round((w / totalW) * pageContentWidthDxa));

        const docxRows = [];
        tableRows.forEach((tr, rIdx) => {
          const isHeader = rIdx === 0 && (tr.cols.every(c => c.some(it => it.bold)) || tr.cols[0].map(it => it.str).join('').toLowerCase() === 'day');
          const cells = [];

          for (let cIdx = 0; cIdx < numCols; cIdx++) {
            // Find cell matching this column cluster
            const colItem = tr.cols.find(c => Math.abs(c[0].x - colClusters[cIdx].avg) <= 25);
            const cellText = colItem ? colItem.map(it => it.str).join(' ').trim() : '';
            const isBold = isHeader || (colItem && colItem.some(it => it.bold));
            const hasHindi = colItem ? colItem.some(it => it.hasHindi) : false;

            cells.push(new TableCell({
              width: { size: colWidthsDxa[cIdx], type: WidthType.DXA },
              shading: isHeader ? { fill: 'F1F5F9', type: ShadingType.CLEAR } : undefined,
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' }
              },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
                  spacing: { before: 20, after: 20, line: 240 },
                  children: [
                    new TextRun({
                      text: cellText || ' ',
                      bold: isBold,
                      size: 20,
                      font: hasHindi ? 'Nirmala UI' : 'Calibri',
                      complexScript: hasHindi,
                      color: isHeader ? '1E293B' : '334155'
                    })
                  ]
                })
              ]
            }));
          }

          docxRows.push(new TableRow({
            tableHeader: isHeader,
            cantSplit: true,
            children: cells
          }));
        });

        docChildren.push(new Table({
          columnWidths: colWidthsDxa,
          width: { size: pageContentWidthDxa, type: WidthType.DXA },
          rows: docxRows
        }));
        docChildren.push(new Paragraph({ spacing: { before: 80, after: 80 } }));

        i = j;
        continue;
      }

      // Not a table
      const line = lines[i];
      const isBullet = /^[•\-\*]\s+/.test(line.fullText) || /^•/.test(line.fullText);
      const isNumbered = /^\d+[\.\)]\s+/.test(line.fullText);
      const fontSize = line.items[0].h;
      const isHeading1 = fontSize >= 18;
      const isHeading2 = fontSize >= 13 && fontSize < 18 && (line.items[0].bold || /^\d+\.\s+/.test(line.fullText));

      if (isHeading1 || isHeading2) {
        docChildren.push(new Paragraph({
          heading: isHeading1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          spacing: {
            before: isHeading1 ? 240 : 160,
            after: isHeading1 ? 100 : 80,
            line: 260
          },
          children: line.items.map((it, itIdx) => new TextRun({
            text: it.str + (itIdx < line.items.length - 1 ? ' ' : ''),
            bold: true,
            size: isHeading1 ? 32 : 26,
            color: isHeading1 ? '1E3A8A' : '2563EB',
            font: it.hasHindi ? 'Nirmala UI' : 'Calibri',
            complexScript: it.hasHindi
          }))
        }));
        i++;
      } else if (isBullet || isNumbered) {
        // Collect bullet / numbered lines
        const bulletLines = [line];
        let nextI = i + 1;
        while (nextI < lines.length) {
          const nextLine = lines[nextI];
          const nextIsBullet = /^[•\-\*]\s+/.test(nextLine.fullText) || /^•/.test(nextLine.fullText) || /^\d+[\.\)]\s+/.test(nextLine.fullText);
          const nextIsHeading = nextLine.items[0].h >= 13 && (nextLine.items[0].bold || /^\d+\.\s+/.test(nextLine.fullText));
          const yDiff = Math.abs(lines[nextI - 1].y - nextLine.y);

          if (!nextIsBullet && !nextIsHeading && yDiff <= 18 && nextLine.startX >= line.startX) {
            bulletLines.push(nextLine);
            nextI++;
          } else {
            break;
          }
        }

        // Build runs for bullet
        const runs = [];
        bulletLines.forEach((bl, blIdx) => {
          bl.items.forEach((it, itIdx) => {
            runs.push(new TextRun({
              text: it.str + (itIdx < bl.items.length - 1 ? ' ' : (blIdx < bulletLines.length - 1 ? ' ' : '')),
              bold: it.bold,
              italics: it.italic,
              size: Math.round(it.h * 2),
              font: it.hasHindi ? 'Nirmala UI' : 'Calibri',
              complexScript: it.hasHindi,
              color: '1E293B'
            }));
          });
        });

        docChildren.push(new Paragraph({
          spacing: { before: 40, after: 40, line: 240 },
          indent: { left: 360, hanging: 240 },
          children: runs
        }));

        i = nextI;
      } else {
        // Collect paragraph lines
        const paraLines = [line];
        let nextI = i + 1;
        while (nextI < lines.length) {
          const nextLine = lines[nextI];
          const nextIsBullet = /^[•\-\*]\s+/.test(nextLine.fullText) || /^•/.test(nextLine.fullText) || /^\d+[\.\)]\s+/.test(nextLine.fullText);
          const nextIsHeading = nextLine.items[0].h >= 13 && (nextLine.items[0].bold || /^\d+\.\s+/.test(nextLine.fullText));
          const yDiff = Math.abs(lines[nextI - 1].y - nextLine.y);

          if (!nextIsBullet && !nextIsHeading && yDiff <= 18 && Math.abs(nextLine.startX - line.startX) <= 15) {
            paraLines.push(nextLine);
            nextI++;
          } else {
            break;
          }
        }

        const runs = [];
        paraLines.forEach((pl, plIdx) => {
          pl.items.forEach((it, itIdx) => {
            runs.push(new TextRun({
              text: it.str + (itIdx < pl.items.length - 1 ? ' ' : (plIdx < paraLines.length - 1 ? ' ' : '')),
              bold: it.bold,
              italics: it.italic,
              size: Math.round(it.h * 2),
              font: it.hasHindi ? 'Nirmala UI' : 'Calibri',
              complexScript: it.hasHindi,
              color: '334155'
            }));
          });
        });

        docChildren.push(new Paragraph({
          spacing: { before: 40, after: 80, line: 240 },
          children: runs
        }));

        i = nextI;
      }
    }

    // Add page break only if not last page
    if (pageNum < numPages) {
      docChildren.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: docWidthDxa, height: docHeightDxa, orientation: docOrientation },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
        }
      },
      children: docChildren
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync('d:/pdf/scratch/output-jajriti.docx', buffer);
  console.log('Saved d:/pdf/scratch/output-jajriti.docx, size:', buffer.length);
}

convertAndInspect().catch(console.error);
