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
  ShadingType,
  Packer
} from 'docx';

async function generatePerfectDocx() {
  const filePath = 'C:/Users/khush/Downloads/JajritiYatra-Content.pdf';
  const arrayBuffer = fs.readFileSync(filePath);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const numPages = pdf.numPages;

  console.log(`Generating perfect DOCX for ${numPages} pages...`);

  // First page geometry
  const p1 = await pdf.getPage(1);
  const vp1 = p1.getViewport({ scale: 1.0 });
  const docWidthDxa = Math.round(vp1.width * 20);
  const docHeightDxa = Math.round(vp1.height * 20);
  const leftMarginDxa = 660; // 33pt
  const rightMarginDxa = 660;
  const topMarginDxa = 720;
  const bottomMarginDxa = 720;
  const pageContentWidthDxa = docWidthDxa - leftMarginDxa - rightMarginDxa;

  const docChildren = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    const opList = await page.getOperatorList();

    // Extract vertical lines & horizontal divider lines
    const vLines = [];
    const hLines = [];
    let curFillColorHex = 'F5F5F5';
    let curStrokeColorHex = 'CBD5E1';

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (fn === pdfjsLib.OPS.setFillRGBColor) {
        const r = Math.round(args[0] <= 1 ? args[0] * 255 : args[0]);
        const g = Math.round(args[1] <= 1 ? args[1] * 255 : args[1]);
        const b = Math.round(args[2] <= 1 ? args[2] * 255 : args[2]);
        curFillColorHex = [r, g, b].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('').toUpperCase();
      } else if (fn === pdfjsLib.OPS.setStrokeRGBColor) {
        const r = Math.round(args[0] <= 1 ? args[0] * 255 : args[0]);
        const g = Math.round(args[1] <= 1 ? args[1] * 255 : args[1]);
        const b = Math.round(args[2] <= 1 ? args[2] * 255 : args[2]);
        curStrokeColorHex = [r, g, b].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('').toUpperCase();
      } else if (fn === pdfjsLib.OPS.constructPath) {
        const ops = args[0] || [];
        const params = args[1] || [];
        let pIdx = 0;
        for (const op of ops) {
          if (op === 19) {
            const rx = params[pIdx++];
            const ry = params[pIdx++];
            const rw = params[pIdx++];
            const rh = params[pIdx++];
            if (rw <= 2 && rh > 8) {
              vLines.push(Math.round(rx));
            }
            if (rh <= 2 && rw > 50) {
              // Convert viewport Y to top-down or bottom-up
              hLines.push({ y: Math.round(viewport.height - ry), rawY: Math.round(ry), w: Math.round(rw), x: Math.round(rx), color: curStrokeColorHex });
            }
          }
        }
      }
    }

    const uniqueVLines = [...new Set(vLines)].sort((a, b) => a - b);

    // Filter and group body text items
    const headerThreshold = viewport.height - 35;
    const footerThreshold = 35;

    const bodyItems = (textContent.items || [])
      .filter(it => it.str && it.str.trim())
      .map(it => {
        const fontSize = Math.round(it.height || Math.abs(it.transform[0]) || 10);
        return {
          str: it.str,
          x: Math.round(it.transform[4]),
          y: Math.round(it.transform[5]),
          w: Math.round(it.width || (it.str.length * fontSize * 0.5)),
          h: fontSize,
          bold: /bold|black|heavy|semibold/i.test(it.fontName || ''),
          italic: /italic|oblique/i.test(it.fontName || ''),
          hasHindi: /[\u0900-\u097F]/.test(it.str)
        };
      })
      .filter(it => it.y < headerThreshold && it.y > footerThreshold);

    // Group items into lines
    const lineMap = {};
    for (const it of bodyItems) {
      const y = it.y;
      let foundY = Object.keys(lineMap).find(ly => Math.abs(Number(ly) - y) <= 4);
      if (!foundY) {
        foundY = y;
        lineMap[foundY] = [];
      }
      lineMap[foundY].push(it);
    }

    const sortedY = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
    const lines = sortedY.map(y => {
      const items = lineMap[y].sort((a, b) => a.x - b.x);
      return {
        y,
        items,
        startX: items[0].x,
        endX: items[items.length - 1].x + items[items.length - 1].w,
        fullText: items.map(it => it.str).join(' ').trim()
      };
    }).filter(l => l.fullText.length > 0);

    let i = 0;
    while (i < lines.length) {
      const currentLine = lines[i];

      // Table Detection
      let tableRows = [];
      let j = i;

      while (j < lines.length) {
        const line = lines[j];
        const isBullet = /^[•\-\*]\s*|^\d+[\.\)]\s*/.test(line.fullText);
        const isHeading = line.items[0].h >= 13 && (line.items[0].bold || /^\d+\.\s+/.test(line.fullText));
        if (isBullet || isHeading) break;

        // Separate columns
        const cols = [];
        let curCol = [line.items[0]];

        for (let k = 1; k < line.items.length; k++) {
          const prev = line.items[k - 1];
          const curr = line.items[k];
          const gap = curr.x - (prev.x + prev.w);
          const colDist = curr.x - prev.x;
          if (gap >= 8 || colDist >= 35) {
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
        // Table found!
        // Determine column count and boundaries
        // Check if rows consistently have N columns
        const rowColCounts = tableRows.map(r => r.cols.length);
        const mostFrequentCount = rowColCounts.sort((a,b) =>
          rowColCounts.filter(v => v===a).length - rowColCounts.filter(v => v===b).length
        ).pop();

        let numCols = mostFrequentCount;

        // Check if uniqueVLines define the columns
        let colWidthsDxa = [];
        let tableWidthDxa = pageContentWidthDxa;

        // Filter vLines that are within the table's X range
        const tblMinX = Math.min(...tableRows.map(r => r.line.startX)) - 10;
        const tblMaxX = Math.max(...tableRows.map(r => r.line.endX)) + 15;
        const matchingVLines = uniqueVLines.filter(x => x >= tblMinX && x <= tblMaxX + 25);

        if (matchingVLines.length >= 3 && matchingVLines.length === numCols + 1) {
          // Exact vector vertical lines match!
          numCols = matchingVLines.length - 1;
          const colWidthsPt = [];
          for (let c = 0; c < numCols; c++) {
            colWidthsPt.push(matchingVLines[c + 1] - matchingVLines[c]);
          }
          const totalPt = colWidthsPt.reduce((a, b) => a + b, 0);
          tableWidthDxa = Math.round(totalPt * 20);
          colWidthsDxa = colWidthsPt.map(w => Math.round(w * 20));
        } else {
          // If all rows have same number of columns, use column index directly!
          const maxCols = Math.max(...rowColCounts);
          numCols = maxCols;
          // Calculate max width for each column index
          const colWidthsPt = Array(numCols).fill(0);
          tableRows.forEach(tr => {
            tr.cols.forEach((c, cIdx) => {
              const w = (c[c.length - 1].x + c[c.length - 1].w) - c[0].x;
              colWidthsPt[cIdx] = Math.max(colWidthsPt[cIdx], w + 15);
            });
          });
          const totalPt = colWidthsPt.reduce((a, b) => a + b, 0);
          tableWidthDxa = Math.min(pageContentWidthDxa, Math.round(totalPt * 20));
          colWidthsDxa = colWidthsPt.map(w => Math.round((w / totalPt) * tableWidthDxa));
        }

        const docxRows = [];
        tableRows.forEach((tr, rIdx) => {
          const isHeader = rIdx === 0 && (tr.cols.every(c => c.some(it => it.bold)) || tr.cols[0].map(it => it.str).join('').toLowerCase() === 'day');
          const cells = [];

          for (let cIdx = 0; cIdx < numCols; cIdx++) {
            // If matchingVLines used:
            let colItem = null;
            if (matchingVLines.length === numCols + 1) {
              const leftBound = matchingVLines[cIdx] - 5;
              const rightBound = matchingVLines[cIdx + 1] + 5;
              colItem = tr.cols.find(c => c[0].x >= leftBound && c[0].x < rightBound);
            } else {
              // Direct index mapping
              colItem = tr.cols[cIdx];
            }

            const cellText = colItem ? colItem.map(it => it.str).join(' ').trim() : '';
            const isBold = isHeader || (colItem && colItem.some(it => it.bold));
            const hasHindi = colItem ? colItem.some(it => it.hasHindi) : false;
            const cellFontSize = Math.round(((colItem && colItem[0]?.h) || 10) * 2);

            const isNumeric = /^[$\u20AC\u00A3\u20B9]?\s*[\d,]+(\.\d+)?%?$/.test(cellText);
            const cellAlign = isHeader
              ? AlignmentType.CENTER
              : (isNumeric ? AlignmentType.RIGHT : (cellText.length <= 4 ? AlignmentType.CENTER : AlignmentType.LEFT));

            cells.push(
              new TableCell({
                width: { size: colWidthsDxa[cIdx], type: WidthType.DXA },
                shading: isHeader ? { fill: 'F5F5F5', type: ShadingType.CLEAR } : undefined,
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                  left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                  right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' }
                },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    alignment: cellAlign,
                    spacing: { before: 20, after: 20, line: 240 },
                    children: [
                      new TextRun({
                        text: cellText || ' ',
                        bold: isBold,
                        size: cellFontSize,
                        font: hasHindi ? 'Nirmala UI' : 'Calibri',
                        complexScript: hasHindi,
                        color: '000000'
                      })
                    ]
                  })
                ]
              })
            );
          }

          docxRows.push(
            new TableRow({
              tableHeader: isHeader,
              cantSplit: true,
              children: cells
            })
          );
        });

        docChildren.push(
          new Table({
            columnWidths: colWidthsDxa,
            width: { size: tableWidthDxa, type: WidthType.DXA },
            rows: docxRows
          })
        );
        docChildren.push(new Paragraph({ spacing: { before: 40, after: 40 } }));

        i = j;
        continue;
      }

      // Non-table content
      const line = lines[i];
      const isBullet = /^[•\-\*]\s+/.test(line.fullText) || /^•/.test(line.fullText);
      const isNumbered = /^\d+[\.\)]\s+/.test(line.fullText);
      const fontSize = line.items[0].h;
      const isHeading1 = fontSize >= 18;
      const isHeading2 = fontSize >= 13 && fontSize < 18 && (line.items[0].bold || /^\d+\.\s+/.test(line.fullText));

      if (isHeading1 || isHeading2) {
        // Check if there is a horizontal divider line under this heading
        // In PDF coordinate, heading Y is in points from bottom (line.y)
        // Check if any hLine has y close to line.y (within 20pt)
        const hasUnderline = hLines.some(hl => Math.abs(hl.rawY - line.y) <= 25 || Math.abs((viewport.height - hl.rawY) - (viewport.height - line.y)) <= 25);

        docChildren.push(
          new Paragraph({
            heading: isHeading1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
            border: hasUnderline ? {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1', space: 4 }
            } : undefined,
            spacing: {
              before: Math.max(80, Math.min(280, Math.round(fontSize * 10))),
              after: hasUnderline ? 100 : Math.max(40, Math.min(140, Math.round(fontSize * 4))),
              line: 260
            },
            children: line.items.map((it, itIdx) => new TextRun({
              text: it.str + (itIdx < line.items.length - 1 ? ' ' : ''),
              bold: true,
              size: Math.round(it.h * 2),
              color: '000000',
              font: it.hasHindi ? 'Nirmala UI' : 'Calibri',
              complexScript: it.hasHindi
            }))
          })
        );
        i++;
      } else if (isBullet || isNumbered) {
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

        const runs = [];
        bulletLines.forEach((bl, blIdx) => {
          bl.items.forEach((it, itIdx) => {
            runs.push(
              new TextRun({
                text: it.str + (itIdx < bl.items.length - 1 ? ' ' : (blIdx < bulletLines.length - 1 ? ' ' : '')),
                bold: it.bold,
                italics: it.italic,
                size: Math.round(it.h * 2),
                font: it.hasHindi ? 'Nirmala UI' : 'Calibri',
                complexScript: it.hasHindi,
                color: '000000'
              })
            );
          });
        });

        docChildren.push(
          new Paragraph({
            spacing: { before: 30, after: 30, line: 240 },
            indent: { left: 360, hanging: 240 },
            children: runs
          })
        );
        i = nextI;
      } else {
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

        // Check if this line has a divider line below it (e.g. Source note)
        const hasUnderline = hLines.some(hl => Math.abs(hl.rawY - line.y) <= 25);

        const runs = [];
        paraLines.forEach((pl, plIdx) => {
          pl.items.forEach((it, itIdx) => {
            runs.push(
              new TextRun({
                text: it.str + (itIdx < pl.items.length - 1 ? ' ' : (plIdx < paraLines.length - 1 ? ' ' : '')),
                bold: it.bold,
                italics: it.italic,
                size: Math.round(it.h * 2),
                font: it.hasHindi ? 'Nirmala UI' : 'Calibri',
                complexScript: it.hasHindi,
                color: '000000'
              })
            );
          });
        });

        docChildren.push(
          new Paragraph({
            border: hasUnderline ? {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1', space: 4 }
            } : undefined,
            spacing: { before: 30, after: hasUnderline ? 80 : 60, line: 240 },
            children: runs
          })
        );
        i = nextI;
      }
    }

    if (pageNum < numPages) {
      docChildren.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: docWidthDxa, height: docHeightDxa, orientation: PageOrientation.PORTRAIT },
          margin: { top: topMarginDxa, right: rightMarginDxa, bottom: bottomMarginDxa, left: leftMarginDxa }
        }
      },
      children: docChildren
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync('d:/pdf/scratch/perfect-jajriti.docx', buffer);
  console.log('Saved d:/pdf/scratch/perfect-jajriti.docx');

  // Check table structure in output
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml').async('string');
  const tblMatches = xml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g);
  let tIdx = 0;
  for (const tm of tblMatches) {
    const tblXml = tm[0];
    const rows = tblXml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
    console.log(`\nTable ${tIdx++}: ${rows.length} rows`);
    rows.slice(0, 3).forEach(r => {
      const cells = [];
      const cMatches = r.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g);
      for (const cm of cMatches) {
        const text = [...cm[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('');
        cells.push(text);
      }
      console.log('   Row:', cells.join(' | '));
    });
  }
}

generatePerfectDocx().catch(console.error);
