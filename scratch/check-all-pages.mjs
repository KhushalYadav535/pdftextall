import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function checkPages() {
  const bytes = fs.readFileSync('d:/pdf/scratch/sahbhagi-enhanced.pdf');
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
  console.log(`Total pages: ${doc.numPages}`);
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const texts = tc.items.map(it => it.str.trim()).filter(Boolean);
    console.log(`Page ${p}: First: "${texts[0]}", Last: "${texts[texts.length - 1]}"`);
  }
}

checkPages().catch(console.error);
