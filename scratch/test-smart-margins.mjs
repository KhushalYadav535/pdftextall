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

async function testWithSmartMargins() {
  const filePath = 'C:/Users/khush/Downloads/JajritiYatra-Content.pdf';
  const arrayBuffer = fs.readFileSync(filePath);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const numPages = pdf.numPages;

  console.log(`Smart margins test on ${numPages} pages...`);

  // Detect overall PDF margins and page dimensions from first few pages
  let docWidthDxa = 11906;
  let docHeightDxa = 16838;
  let docOrientation = PageOrientation.PORTRAIT;

  let minObservedX = Infinity;
  let maxObservedX = -Infinity;
  let minObservedY = Infinity;
  let maxObservedY = -Infinity;
  let viewportWidth = 595;
  let viewportHeight = 842;

  for (let p = 1; p <= Math.min(3, numPages); p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1.0 });
    if (p === 1) {
      viewportWidth = vp.width;
      viewportHeight = vp.height;
      const isLandscape = vp.width > vp.height;
      docOrientation = isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT;
      docWidthDxa = Math.round(vp.width * 20);
      docHeightDxa = Math.round(vp.height * 20);
    }
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const x = Math.round(it.transform[4]);
      const y = Math.round(it.transform[5]);
      const w = Math.round(it.width || 10);
      if (x > 10 && x < vp.width - 10) {
        minObservedX = Math.min(minObservedX, x);
        maxObservedX = Math.max(maxObservedX, x + w);
      }
      if (y > 20 && y < vp.height - 20) {
        minObservedY = Math.min(minObservedY, y);
        maxObservedY = Math.max(maxObservedY, y);
      }
    }
  }

  // Calculate margins in DXA
  const leftMarginDxa = Math.max(480, Math.min(1440, Math.round((minObservedX - 4) * 20)));
  const rightMarginDxa = Math.max(480, Math.min(1440, Math.round((viewportWidth - maxObservedX - 4) * 20)));
  const topMarginDxa = Math.max(480, Math.min(1440, Math.round((viewportHeight - maxObservedY - 8) * 20)));
  const bottomMarginDxa = Math.max(480, Math.min(1440, Math.round((minObservedY - 8) * 20)));

  console.log(`Detected margins (DXA): left=${leftMarginDxa}, right=${rightMarginDxa}, top=${topMarginDxa}, bottom=${bottomMarginDxa}`);
  console.log(`Document size (DXA): ${docWidthDxa} x ${docHeightDxa}`);

  const pageContentWidthDxa = docWidthDxa - leftMarginDxa - rightMarginDxa;
  console.log(`Printable width (DXA): ${pageContentWidthDxa}`);
}

testWithSmartMargins().catch(console.error);
