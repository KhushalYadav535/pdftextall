import fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

function parseDocxXmlTree(xmlStr) {
  const root = { tag: 'root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const tagRegex = /<([\/!]?)([\w:.-]+)([^>]*?)(\/?)>/g;
  let lastIdx = 0;
  let match;

  while ((match = tagRegex.exec(xmlStr)) !== null) {
    const textBefore = xmlStr.slice(lastIdx, match.index);
    if (textBefore && stack.length > 0) {
      stack[stack.length - 1].text += textBefore;
    }
    lastIdx = match.index + match[0].length;

    const isClose = match[1] === '/';
    const tagName = match[2];
    const rawAttrs = match[3];
    const isSelfClosing = match[4] === '/' || rawAttrs.trim().endsWith('/');

    if (isClose) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tagName) {
          stack.length = i;
          break;
        }
      }
    } else if (match[1] !== '!') {
      const attrs = {};
      const attrRegex = /([\w:.-]+)="([^"]*)"/g;
      let aMatch;
      while ((aMatch = attrRegex.exec(rawAttrs)) !== null) {
        attrs[aMatch[1]] = aMatch[2];
      }
      const node = { tag: tagName, attrs, children: [], text: '' };
      stack[stack.length - 1].children.push(node);
      if (!isSelfClosing) {
        stack.push(node);
      }
    }
  }
  return root;
}

function hexToRgb(hex, fallback = rgb(0.12, 0.15, 0.2)) {
  if (!hex || typeof hex !== 'string') return fallback;
  const clean = hex.replace(/^#/, '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
  }
  return fallback;
}

function isColorDark(hex) {
  if (!hex || typeof hex !== 'string') return false;
  const clean = hex.replace(/^#/, '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum < 0.5;
  }
  return false;
}

function unescapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function sanitizeForPdf(str) {
  if (!str) return '';
  return unescapeXml(String(str))
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF\u2022]/g, ' ');
}

function safeWidth(font, text, size) {
  if (!text) return 0;
  return font.widthOfTextAtSize(sanitizeForPdf(text), size);
}

function wrapText(text, font, size, maxWidth) {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const w = safeWidth(font, testLine, size);
    if (w <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines.length > 0 ? lines : [text];
}

function getAllRuns(node) {
  const runs = [];
  function traverse(n) {
    if (!n) return;
    if (n.tag === 'w:r') {
      runs.push(n);
      return;
    }
    if (n.children) {
      for (const c of n.children) {
        traverse(c);
      }
    }
  }
  traverse(node);
  return runs;
}

async function convertDocxToPdfEnhanced(docxBuffer) {
  const zip = await JSZip.loadAsync(docxBuffer);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('Invalid DOCX document: missing word/document.xml');
  }

  // Parse styles.xml
  const stylesMap = {};
  let docDefaultSize = 11;
  const stylesFile = zip.file('word/styles.xml');
  if (stylesFile) {
    try {
      const sStr = await stylesFile.async('string');
      const defSzMatch = sStr.match(/<w:docDefaults>[\s\S]*?<w:rPrDefault>[\s\S]*?<w:sz\b[^>]*w:val="([^"]*)"/);
      if (defSzMatch) {
        docDefaultSize = Number(defSzMatch[1]) / 2;
      }
      const styleRegex = /<w:style\b[^>]*w:styleId="([^"]*)"[\s\S]*?<\/w:style>/g;
      let sm;
      while ((sm = styleRegex.exec(sStr)) !== null) {
        const id = sm[1];
        const body = sm[0];
        const sz = body.match(/<w:sz\b[^>]*w:val="([^"]*)"/)?.[1];
        const color = body.match(/<w:color\b[^>]*w:val="([^"]*)"/)?.[1];
        const b = body.includes('<w:b/>') || body.includes('<w:b ');
        const i = body.includes('<w:i/>') || body.includes('<w:i ');
        const sBefore = body.match(/<w:spacing\b[^>]*w:before="([^"]*)"/)?.[1];
        const sAfter = body.match(/<w:spacing\b[^>]*w:after="([^"]*)"/)?.[1];
        
        stylesMap[id] = {
          sz: sz ? Number(sz) / 2 : undefined,
          color: color && color !== 'auto' ? color : undefined,
          b: b || undefined,
          i: i || undefined,
          spacingBefore: sBefore ? Number(sBefore) / 20 : undefined,
          spacingAfter: sAfter ? Number(sAfter) / 20 : undefined,
        };
      }
    } catch (e) {
      console.warn('Could not parse styles.xml:', e);
    }
  }

  const xmlStr = await docXmlFile.async('string');
  const tree = parseDocxXmlTree(xmlStr);
  const wDoc = tree.children.find(c => c.tag === 'w:document') || tree.children[0];
  const body = wDoc?.children?.find(c => c.tag === 'w:body');
  if (!body) {
    throw new Error('Invalid DOCX document: missing w:body');
  }

  let pageWidth = 595.28;
  let pageHeight = 841.89;
  let marginTop = 40;
  let marginBottom = 30;
  let marginLeft = 40;
  let marginRight = 40;

  const sectPrNodes = [];
  function findSectPr(node) {
    if (node.tag === 'w:sectPr') sectPrNodes.push(node);
    if (node.children) node.children.forEach(findSectPr);
  }
  findSectPr(body);

  if (sectPrNodes.length > 0) {
    const s = sectPrNodes[0];
    const pgSz = s.children?.find((c) => c.tag === 'w:pgSz');
    if (pgSz?.attrs['w:w']) pageWidth = Number(pgSz.attrs['w:w']) / 20;
    if (pgSz?.attrs['w:h']) pageHeight = Number(pgSz.attrs['w:h']) / 20;

    if (pgSz?.attrs['w:orient'] === 'landscape' && pageWidth < pageHeight) {
      const tmp = pageWidth;
      pageWidth = pageHeight;
      pageHeight = tmp;
    }

    const pgMar = s.children?.find((c) => c.tag === 'w:pgMar');
    if (pgMar?.attrs['w:top']) marginTop = Math.max(15, Number(pgMar.attrs['w:top']) / 20);
    if (pgMar?.attrs['w:bottom']) marginBottom = Math.max(15, Number(pgMar.attrs['w:bottom']) / 20);
    if (pgMar?.attrs['w:left']) marginLeft = Math.max(20, Number(pgMar.attrs['w:left']) / 20);
    if (pgMar?.attrs['w:right']) marginRight = Math.max(20, Number(pgMar.attrs['w:right']) / 20);
  }

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - marginTop;
  const contentWidth = pageWidth - marginLeft - marginRight;

  function ensureSpace(needed) {
    if (currentY - needed < marginBottom) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      currentY = pageHeight - marginTop;
    }
  }

  let tableCount = 0;
  let paragraphCount = 0;
  let prevSpacingAfter = 0;

  for (let bIdx = 0; bIdx < body.children.length; bIdx++) {
    const child = body.children[bIdx];

    if (child.tag === 'w:p') {
      paragraphCount++;
      const pPr = child.children?.find((c) => c.tag === 'w:pPr');
      const pStyle = pPr?.children?.find((c) => c.tag === 'w:pStyle')?.attrs?.['w:val'] || '';
      const styleDef = stylesMap[pStyle] || {};
      const isHeading = /heading/i.test(pStyle) || (styleDef.sz && styleDef.sz >= 12);
      const jc = pPr?.children?.find((c) => c.tag === 'w:jc')?.attrs?.['w:val'] || 'left';
      const isList = pPr?.children?.some((c) => c.tag === 'w:numPr') || /list/i.test(pStyle);

      // Spacing before / after (with style inheritance)
      const spacing = pPr?.children?.find((c) => c.tag === 'w:spacing');
      const spacingBefore = spacing?.attrs?.['w:before'] 
        ? Number(spacing.attrs['w:before']) / 20 
        : (styleDef.spacingBefore || 0);
      const spacingAfter = spacing?.attrs?.['w:after'] 
        ? Number(spacing.attrs['w:after']) / 20 
        : (styleDef.spacingAfter || (isHeading ? 6 : 0));

      const runs = getAllRuns(child);
      let hasPageBreak = false;
      runs.forEach((r) => {
        if (r.children?.some((rc) => rc.tag === 'w:br' && rc.attrs?.['w:type'] === 'page')) {
          hasPageBreak = true;
        }
      });

      if (hasPageBreak) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        currentY = pageHeight - marginTop;
      }

      // Extract run details with style inheritance
      const runItems = [];
      let hasTab = false;

      runs.forEach((r) => {
        const rPr = r.children?.find((c) => c.tag === 'w:rPr');
        const b = rPr?.children?.some((c) => c.tag === 'w:b') ?? styleDef.b ?? false;
        const it = rPr?.children?.some((c) => c.tag === 'w:i') ?? styleDef.i ?? false;
        const szVal = rPr?.children?.find((c) => c.tag === 'w:sz')?.attrs?.['w:val'];
        const clrVal = rPr?.children?.find((c) => c.tag === 'w:color')?.attrs?.['w:val'];

        const runFont = b ? fontBold : (it ? fontItalic : fontRegular);
        const runSize = szVal ? Math.max(8.5, Number(szVal) / 2) : (styleDef.sz || docDefaultSize);
        const runColor = clrVal ? hexToRgb(clrVal) : (styleDef.color ? hexToRgb(styleDef.color) : rgb(0.12, 0.15, 0.2));

        r.children?.forEach((rc) => {
          if (rc.tag === 'w:t') {
            const raw = unescapeXml(rc.text);
            if (raw.includes('\t')) {
              hasTab = true;
              const parts = raw.split('\t');
              if (parts[0]) {
                runItems.push({ text: parts[0], font: runFont, size: runSize, color: runColor, isBold: b, isItalic: it });
              }
              runItems.push({ isTab: true });
              if (parts[1]) {
                runItems.push({ text: parts[1], font: runFont, size: runSize, color: runColor, isBold: b, isItalic: it });
              }
            } else {
              runItems.push({ text: raw, font: runFont, size: runSize, color: runColor, isBold: b, isItalic: it });
            }
          } else if (rc.tag === 'w:tab') {
            hasTab = true;
            runItems.push({ isTab: true });
          }
        });
      });

      const fullText = runItems.map(ri => ri.isTab ? '\t' : ri.text).join('').trim();

      // Empty paragraph handling
      if (!fullText) {
        const emptyGap = Math.max(spacingBefore, spacingAfter);
        currentY -= emptyGap > 0 ? emptyGap : 4;
        continue;
      }

      // Margin collapsing
      const interParaGap = Math.max(prevSpacingAfter, spacingBefore);
      currentY -= interParaGap;
      prevSpacingAfter = spacingAfter;

      // Heading keep-with-next: Ensure space for heading + subsequent content
      if (isHeading) {
        ensureSpace((runItems[0]?.size || 14) + 40);
      }

      // Render paragraph
      const firstRun = runItems[0] || {};
      const fontSize = firstRun.size || docDefaultSize;
      const font = firstRun.font || fontRegular;
      const textColor = firstRun.color || rgb(0.12, 0.15, 0.2);
      const lineH = fontSize * 1.16;

      const isBulletLine = isList || /^[•*]\s+/.test(fullText);
      let lineText = fullText;
      if (isBulletLine) {
        lineText = lineText.replace(/^[•*]\s*/, '');
      }

      if (isBulletLine) {
        const bulletIndent = 18;
        const textIndent = 36;
        const maxTextW = contentWidth - textIndent;
        const wrappedLines = wrapText(lineText, font, fontSize, maxTextW);

        ensureSpace(wrappedLines.length * lineH);

        // Draw bullet dot
        const bulletX = marginLeft + bulletIndent;
        const bulletY = currentY + fontSize * 0.3;
        page.drawCircle({
          x: bulletX,
          y: bulletY,
          size: 1.8,
          color: textColor
        });

        for (const wl of wrappedLines) {
          const sanitized = sanitizeForPdf(wl);
          page.drawText(sanitized, {
            x: marginLeft + textIndent,
            y: currentY,
            size: fontSize,
            font,
            color: textColor
          });
          currentY -= lineH;
        }
      } else {
        const isCentered = jc === 'center';
        const maxTextW = contentWidth;
        const wrappedLines = wrapText(lineText, font, fontSize, maxTextW);

        ensureSpace(wrappedLines.length * lineH);

        for (const wl of wrappedLines) {
          const sanitized = sanitizeForPdf(wl);
          let drawX = marginLeft;
          if (isCentered) {
            const w = font.widthOfTextAtSize(sanitized, fontSize);
            drawX = marginLeft + (contentWidth - w) / 2;
          } else if (jc === 'right') {
            const w = font.widthOfTextAtSize(sanitized, fontSize);
            drawX = marginLeft + contentWidth - w;
          }
          page.drawText(sanitized, {
            x: drawX,
            y: currentY,
            size: fontSize,
            font,
            color: textColor
          });
          currentY -= lineH;
        }
      }

    } else if (child.tag === 'w:tbl') {
      tableCount++;
      // Keep table with header: ensure space for at least 2 rows (header + 1 data row)
      ensureSpace(45);
      currentY -= 6;

      const tblGrid = child.children?.find((c) => c.tag === 'w:tblGrid');
      const gridCols = tblGrid?.children?.filter((c) => c.tag === 'w:gridCol')?.map((c) => Number(c.attrs?.['w:w']) || 0) || [];
      const trNodes = child.children?.filter((c) => c.tag === 'w:tr') || [];
      if (trNodes.length === 0) continue;

      const numCols = Math.max(gridCols.length, 1);
      const totalDxa = gridCols.reduce((a, b) => a + b, 0);

      // Check tblW
      const tblPr = child.children?.find((c) => c.tag === 'w:tblPr');
      const tblWAttr = tblPr?.children?.find((c) => c.tag === 'w:tblW')?.attrs;
      let tableW = contentWidth;
      if (tblWAttr?.['w:type'] === 'dxa' && tblWAttr?.['w:w']) {
        const dxaW = Number(tblWAttr['w:w']) / 20;
        if (dxaW > 0 && dxaW <= contentWidth) {
          tableW = dxaW;
        }
      }

      let colWidths = [];
      if (gridCols.length === numCols && totalDxa > 0) {
        colWidths = gridCols.map((w) => (w / totalDxa) * tableW);
      } else {
        colWidths = Array(numCols).fill(tableW / numCols);
      }

      const tableFontSize = 9;
      const tableLineH = 12;
      const cellPad = 4;
      let headerRowData = null;

      function drawTableRow(cells, rHeight) {
        let colOffset = 0;
        for (let cIdx = 0; cIdx < cells.length; cIdx++) {
          const cData = cells[cIdx];
          const cellX = marginLeft + colOffset;
          const cellY = currentY - rHeight;

          if (cData.fillHex) {
            page.drawRectangle({
              x: cellX,
              y: cellY,
              width: cData.cellW,
              height: rHeight,
              color: hexToRgb(cData.fillHex, rgb(0.9, 0.93, 0.96))
            });
          }

          // Border: 0.5pt subtle grey
          page.drawRectangle({
            x: cellX,
            y: cellY,
            width: cData.cellW,
            height: rHeight,
            borderColor: rgb(0.75, 0.75, 0.75),
            borderWidth: 0.5
          });

          // Text
          let textY = currentY - cellPad - tableFontSize + 1;
          for (const line of cData.lines) {
            let drawX = cellX + cellPad;
            const lineW = safeWidth(cData.font, line, tableFontSize);
            if (cData.align === 'center') {
              drawX = cellX + (cData.cellW - lineW) / 2;
            } else if (cData.align === 'right') {
              drawX = cellX + cData.cellW - cellPad - lineW;
            }

            const sanitized = sanitizeForPdf(line);
            page.drawText(sanitized, {
              x: drawX,
              y: textY,
              size: tableFontSize,
              font: cData.font,
              color: cData.color
            });
            textY -= tableLineH;
          }

          colOffset += cData.cellW;
        }
        currentY -= rHeight;
      }

      for (let rIdx = 0; rIdx < trNodes.length; rIdx++) {
        const tr = trNodes[rIdx];
        const tcNodes = tr.children?.filter((c) => c.tag === 'w:tc') || [];
        const isHeader = rIdx === 0 || tr.children?.some((c) => c.tag === 'w:trPr' && c.children?.some((tc) => tc.tag === 'w:tblHeader'));

        const cellsData = [];
        let maxLines = 1;
        let colCursor = 0;

        for (let tcIdx = 0; tcIdx < tcNodes.length; tcIdx++) {
          const tc = tcNodes[tcIdx];
          const tcPr = tc.children?.find((c) => c.tag === 'w:tcPr');
          const gridSpan = Math.max(1, Number(tcPr?.children?.find((c) => c.tag === 'w:gridSpan')?.attrs?.['w:val']) || 1);

          let cellW = 0;
          for (let s = 0; s < gridSpan; s++) {
            cellW += colWidths[colCursor + s] || (tableW / numCols);
          }

          let fillHex = isHeader ? 'E2E8F0' : null;
          let align = isHeader ? 'center' : 'left';
          let cellBold = isHeader;

          const shd = tcPr?.children?.find((c) => c.tag === 'w:shd')?.attrs?.['w:fill'];
          if (shd && shd !== 'auto' && shd !== 'none') fillHex = shd;

          const pNodes = tc.children?.filter((c) => c.tag === 'w:p') || [];
          const lines = [];
          const maxTextW = Math.max(15, cellW - cellPad * 2);
          let cellTextColor = null;

          pNodes.forEach((p) => {
            const pPr = p.children?.find((c) => c.tag === 'w:pPr');
            const jc = pPr?.children?.find((c) => c.tag === 'w:jc')?.attrs?.['w:val'];
            if (jc) align = jc;
            let pText = '';
            const runs = getAllRuns(p);
            runs.forEach((r) => {
              const rPr = r.children?.find((c) => c.tag === 'w:rPr');
              if (rPr?.children?.some((c) => c.tag === 'w:b')) cellBold = true;
              const clr = rPr?.children?.find((c) => c.tag === 'w:color')?.attrs?.['w:val'];
              if (clr && clr !== 'auto') cellTextColor = hexToRgb(clr);
              r.children?.forEach((rc) => {
                if (rc.tag === 'w:t') pText += unescapeXml(rc.text);
              });
            });

            const font = cellBold ? fontBold : fontRegular;
            const words = pText.trim().split(/\s+/).filter(Boolean);
            let curLine = '';

            for (const w of words) {
              const testLine = curLine ? `${curLine} ${w}` : w;
              if (safeWidth(font, testLine, tableFontSize) > maxTextW) {
                if (curLine) lines.push(curLine);
                curLine = w;
              } else {
                curLine = testLine;
              }
            }
            if (curLine) lines.push(curLine);
          });

          if (lines.length > maxLines) maxLines = lines.length;

          const font = cellBold ? fontBold : fontRegular;
          let finalCellColor = cellTextColor;
          if (!finalCellColor) {
            if (fillHex && isColorDark(fillHex)) {
              finalCellColor = rgb(1, 1, 1);
            } else if (isHeader) {
              finalCellColor = rgb(0.08, 0.15, 0.3);
            } else {
              finalCellColor = rgb(0.12, 0.15, 0.2);
            }
          }

          cellsData.push({
            lines,
            fillHex,
            align,
            font,
            cellW,
            gridSpan,
            color: finalCellColor
          });

          colCursor += gridSpan;
        }

        const rowHeight = Math.max(18, maxLines * tableLineH + cellPad * 2);

        if (currentY - rowHeight < marginBottom) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          currentY = pageHeight - marginTop;

          if (headerRowData && !isHeader) {
            drawTableRow(headerRowData.cells, headerRowData.rHeight);
          }
        }

        if (isHeader && !headerRowData) {
          headerRowData = { cells: cellsData, rHeight: rowHeight };
        }

        drawTableRow(cellsData, rowHeight);
      }

      currentY -= 8;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return {
    pdfBytes,
    pageCount: pdfDoc.getPageCount(),
    tableCount,
    paragraphCount
  };
}

async function test() {
  const buf = fs.readFileSync('C:/Users/khush/Downloads/Sahbhagi_PRD_v1.docx');
  const res = await convertDocxToPdfEnhanced(buf);
  console.log(`Enhanced converted! Pages: ${res.pageCount}, bytes: ${res.pdfBytes.length}`);
  fs.writeFileSync('d:/pdf/scratch/sahbhagi-enhanced.pdf', res.pdfBytes);

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(res.pdfBytes) }).promise;
  console.log(`Doc has ${doc.numPages} pages.`);
  for (let p = 1; p <= Math.min(doc.numPages, 4); p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const texts = tc.items.map(it => it.str.trim()).filter(Boolean);
    console.log(`--- Page ${p} (items: ${texts.length}) ---`);
    console.log(`First 3: ${JSON.stringify(texts.slice(0, 3))}`);
    console.log(`Last 3: ${JSON.stringify(texts.slice(-3))}`);
  }
}

test().catch(console.error);
