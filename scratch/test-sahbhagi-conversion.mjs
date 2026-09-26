import fs from 'fs';
import { convertDocxToPdf } from '../src/lib/iloveEngine.js';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function test() {
  const buf = fs.readFileSync('C:/Users/khush/Downloads/Sahbhagi_PRD_v1.docx');
  const res = await convertDocxToPdf(buf);
  console.log(`Converted successfully! Pages: ${res.pageCount}, bytes: ${res.pdfBytes.length}`);
  fs.writeFileSync('d:/pdf/scratch/sahbhagi-fixed.pdf', res.pdfBytes);

  // Inspect page 1 text items
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(res.pdfBytes) }).promise;
  const page1 = await doc.getPage(1);
  const tc1 = await page1.getTextContent();
  console.log('--- Page 1 Text Items ---');
  tc1.items.forEach(it => {
    if (it.str.trim()) {
      console.log(`  [y=${it.transform[5].toFixed(1)}, x=${it.transform[4].toFixed(1)}] "${it.str}"`);
    }
  });

  // Check footer on page 1 and page 2
  const page2 = await doc.getPage(2);
  const tc2 = await page2.getTextContent();
  console.log('--- Page 2 Footer Text ---');
  tc2.items.filter(it => it.transform[5] < 30 && it.str.trim()).forEach(it => {
    console.log(`  [y=${it.transform[5].toFixed(1)}] "${it.str}"`);
  });
}

test().catch(console.error);
