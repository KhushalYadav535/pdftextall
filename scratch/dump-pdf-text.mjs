import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function dump() {
  const data = new Uint8Array(fs.readFileSync('d:/pdf/scratch/gaurav-converted.pdf'));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  console.log('Pages:', doc.numPages);
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    console.log(`--- Page ${i} (${textContent.items.length} items) ---`);
    textContent.items.forEach(item => {
      console.log(`[x=${item.transform[4].toFixed(1)}, y=${item.transform[5].toFixed(1)}] "${item.str}"`);
    });
  }
}

dump().catch(console.error);
