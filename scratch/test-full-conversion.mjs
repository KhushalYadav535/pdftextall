import fs from 'fs';
import JSZip from 'jszip';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

function parseDocxXmlTree(xmlStr) {
  const root = { tag: 'root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const tagRegex = /<(\/)?([\w:-]+)([^>]*?)(\/)?>|([^<]+)/g;
  let match;

  while ((match = tagRegex.exec(xmlStr)) !== null) {
    const isClose = !!match[1];
    const tagName = match[2];
    const rawAttrs = match[3];
    const isSelfClosing = !!match[4];
    const textContent = match[5];

    if (textContent) {
      const current = stack[stack.length - 1];
      if (current) current.text += textContent;
      continue;
    }

    if (isClose) {
      if (stack.length > 1 && stack[stack.length - 1].tag === tagName) {
        stack.pop();
      }
    } else if (tagName) {
      const attrs = {};
      if (rawAttrs) {
        const attrRegex = /([\w:-]+)="([^"]*)"/g;
        let aMatch;
        while ((aMatch = attrRegex.exec(rawAttrs)) !== null) {
          attrs[aMatch[1]] = aMatch[2];
        }
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

function hexToRgb(hex, defaultColor = rgb(0.12, 0.15, 0.2)) {
  if (!hex || typeof hex !== 'string') return defaultColor;
  const clean = hex.replace(/^#/, '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return rgb(r, g, b);
  }
  return defaultColor;
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

function wrapText(text, font, size, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const sanitized = sanitizeForPdf(testLine);
    const w = font.widthOfTextAtSize(sanitized, size);
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

async function convertDocx(docxBuffer) {
  const zip = await JSZip.loadAsync(docxBuffer);
  const docXmlFile = zip.file('word/document.xml');
  const xmlStr = await docXmlFile.async('string');
  const tree = parseDocxXmlTree(xmlStr);

  const wDoc = tree.children.find(c => c.tag === 'w:document') || tree.children[0];
  const body = wDoc?.children?.find(c => c.tag === 'w:body');

  let pageWidth = 612;
  let pageHeight = 792;
  let marginTop = 19;
  let marginBottom = 19;
  let marginLeft = 31;
  let marginRight = 31;

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

  let prevSpacingAfter = 0;

  for (let bIdx = 0; bIdx < body.children.length; bIdx++) {
    const child = body.children[bIdx];
    if (child.tag !== 'w:p') continue;

    const pPr = child.children?.find((c) => c.tag === 'w:pPr');
    const jc = pPr?.children?.find((c) => c.tag === 'w:jc')?.attrs?.['w:val'] || 'left';
    const isList = pPr?.children?.some((c) => c.tag === 'w:numPr');
    const pBdr = pPr?.children?.find((c) => c.tag === 'w:pBdr');
    const btmBdr = pBdr?.children?.find((c) => c.tag === 'w:bottom');
    const spacing = pPr?.children?.find((c) => c.tag === 'w:spacing');
    const spacingBefore = Number(spacing?.attrs?.['w:before'] || 0) / 20;
    const spacingAfter = Number(spacing?.attrs?.['w:after'] || 0) / 20;

    // Parse runs
    const runs = [];
    function extractRuns(node) {
      if (!node) return;
      if (node.tag === 'w:r') { runs.push(node); return; }
      if (node.children) node.children.forEach(extractRuns);
    }
    extractRuns(child);

    // Extract run details
    const runItems = [];
    let hasTab = false;

    runs.forEach((r) => {
      const rPr = r.children?.find((c) => c.tag === 'w:rPr');
      const b = rPr?.children?.some((c) => c.tag === 'w:b');
      const it = rPr?.children?.some((c) => c.tag === 'w:i');
      const sz = rPr?.children?.find((c) => c.tag === 'w:sz')?.attrs?.['w:val'];
      const clr = rPr?.children?.find((c) => c.tag === 'w:color')?.attrs?.['w:val'];

      const runFont = b ? fontBold : (it ? fontItalic : fontRegular);
      const runSize = sz ? Math.max(8.5, Number(sz) / 2) : 10;
      const runColor = clr ? hexToRgb(clr) : rgb(0.13, 0.13, 0.13);

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
    if (!fullText) {
      currentY -= 2;
      continue;
    }

    // Word margin collapsing between paragraphs
    const interParaGap = Math.max(prevSpacingAfter, spacingBefore);
    currentY -= interParaGap;
    prevSpacingAfter = spacingAfter;

    // Check if this paragraph has right tab alignment (e.g. Education lines)
    if (hasTab) {
      const tabIdx = runItems.findIndex(ri => ri.isTab);
      const leftRuns = runItems.slice(0, tabIdx);
      const rightRuns = runItems.slice(tabIdx + 1);

      const fontSize = leftRuns[0]?.size || 10;
      const lineH = fontSize * 1.14;
      ensureSpace(lineH);

      // Draw left runs
      let curX = marginLeft + (isList ? 14 : 0);
      for (const lr of leftRuns) {
        const sanitized = sanitizeForPdf(lr.text);
        if (!sanitized) continue;
        page.drawText(sanitized, {
          x: curX,
          y: currentY,
          size: lr.size,
          font: lr.font,
          color: lr.color
        });
        curX += lr.font.widthOfTextAtSize(sanitized, lr.size);
      }

      // Draw right runs (right aligned)
      let totalRightW = 0;
      for (const rr of rightRuns) {
        const sanitized = sanitizeForPdf(rr.text);
        if (sanitized) totalRightW += rr.font.widthOfTextAtSize(sanitized, rr.size);
      }
      let rightX = marginLeft + contentWidth - totalRightW;
      for (const rr of rightRuns) {
        const sanitized = sanitizeForPdf(rr.text);
        if (!sanitized) continue;
        page.drawText(sanitized, {
          x: rightX,
          y: currentY,
          size: rr.size,
          font: rr.font,
          color: rr.color
        });
        rightX += rr.font.widthOfTextAtSize(sanitized, rr.size);
      }

      currentY -= lineH;
      continue;
    }

    // List item (Bullet point)
    const isBulletLine = isList || /^[•*]\s+/.test(fullText);
    let lineText = fullText;
    if (isBulletLine) {
      lineText = lineText.replace(/^[•*]\s*/, '');
    }

    const firstRun = runItems[0] || {};
    const fontSize = firstRun.size || 10;
    const font = firstRun.font || fontRegular;
    const textColor = firstRun.color || rgb(0.13, 0.13, 0.13);
    const lineH = fontSize * 1.14;
    const isCentered = jc === 'center';

    let lastLineBaseline = currentY;

    if (isBulletLine) {
      // Available width for bullet text
      const maxTextW = contentWidth - 14;
      const wrappedLines = wrapText(lineText, font, fontSize, maxTextW);

      ensureSpace(wrappedLines.length * lineH);

      // Draw bullet dot aligned with first line
      const bulletX = marginLeft + 6;
      const bulletY = currentY + fontSize * 0.3;
      page.drawCircle({
        x: bulletX,
        y: bulletY,
        size: 1.4,
        color: textColor
      });

      // Draw wrapped lines
      for (const wl of wrappedLines) {
        lastLineBaseline = currentY;
        const sanitized = sanitizeForPdf(wl);
        page.drawText(sanitized, {
          x: marginLeft + 14,
          y: currentY,
          size: fontSize,
          font,
          color: textColor
        });
        currentY -= lineH;
      }
    } else {
      // Normal paragraph (may wrap or be centered)
      const maxTextW = contentWidth;
      const wrappedLines = wrapText(lineText, font, fontSize, maxTextW);

      ensureSpace(wrappedLines.length * lineH);

      for (const wl of wrappedLines) {
        lastLineBaseline = currentY;
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

    // Bottom border (divider line under heading)
    const hasBottomBorder = btmBdr && btmBdr.attrs?.['w:val'] !== 'none' && btmBdr.attrs?.['w:val'] !== 'nil';
    if (hasBottomBorder) {
      const bColorHex = btmBdr.attrs?.['w:color'] || '1F4E5F';
      const bSz = Number(btmBdr.attrs?.['w:sz']) || 6;
      const bThickness = Math.max(0.75, bSz / 8);
      const bColor = hexToRgb(bColorHex, rgb(0.12, 0.3, 0.37));
      // Place line 3.5pt below the baseline of the heading text
      const lineY = lastLineBaseline - 3.5;
      page.drawLine({
        start: { x: marginLeft, y: lineY },
        end: { x: marginLeft + contentWidth, y: lineY },
        thickness: bThickness,
        color: bColor
      });
      // Ensure the next paragraph baseline is placed safely below the divider line
      currentY = lineY - (fontSize * 0.85 + Math.max(3, spacingAfter));
    }
  }

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, numPages: pdfDoc.getPageCount() };
}

async function run() {
  const buf = fs.readFileSync('C:/Users/khush/Downloads/Dr_Gaurav_Yadav_Resume (1).docx');
  const res = await convertDocx(buf);
  console.log(`Generated PDF: ${res.numPages} page(s), ${res.pdfBytes.length} bytes`);
  fs.writeFileSync('d:/pdf/scratch/gaurav-perfect.pdf', res.pdfBytes);

  // Render to PNG
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(res.pdfBytes) }).promise;
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const vp = p.getViewport({ scale: 1.5 });
    const c = createCanvas(vp.width, vp.height);
    await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    fs.writeFileSync(`d:/pdf/scratch/gaurav-perfect-p${i}.png`, c.toBuffer('image/png'));
    console.log(`Saved render: d:/pdf/scratch/gaurav-perfect-p${i}.png`);
  }
}

run().catch(console.error);
