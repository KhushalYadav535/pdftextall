import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function check() {
  const data = new Uint8Array(fs.readFileSync('d:/pdf/scratch/gaurav-perfect.pdf'));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  console.log('Total pages:', doc.numPages);
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const tc = await p.getTextContent();
    const nonEmpties = tc.items.filter(item => item.str.trim());
    console.log('Total text items:', nonEmpties.length);
    nonEmpties.forEach(item => {
      console.log('  [y=' + item.transform[5].toFixed(1) + '] ' + item.str.substring(0, 50));
    });
  }
}
check();
