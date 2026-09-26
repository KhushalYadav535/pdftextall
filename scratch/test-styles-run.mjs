import fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// We will write a test function that implements these enhancements and runs on Sahbhagi_PRD_v1.docx
async function runTest() {
  const buf = fs.readFileSync('C:/Users/khush/Downloads/Sahbhagi_PRD_v1.docx');
  const zip = await JSZip.loadAsync(buf);
  
  // Parse styles.xml
  const stylesMap = {};
  let docDefaultSize = 11;
  let docDefaultColor = '1F2937';
  const stylesFile = zip.file('word/styles.xml');
  if (stylesFile) {
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
  }
  console.log('DocDefaultSize:', docDefaultSize);
  console.log('Parsed styles:', Object.keys(stylesMap));
}

runTest().catch(console.error);
