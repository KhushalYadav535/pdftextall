import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function main() {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(fs.readFileSync('C:/Users/khush/Downloads/JajritiYatra-Content.pdf')) }).promise;
  const p3 = await doc.getPage(3);
  const tc3 = await p3.getTextContent();
  console.log('=== PAGE 3 ITEMS (last 15) ===');
  tc3.items.filter(it => it.str.trim()).slice(-15).forEach(it => {
    console.log(`x=${Math.round(it.transform[4])}, y=${Math.round(it.transform[5])}, w=${Math.round(it.width)}: "${it.str}"`);
  });

  const p4 = await doc.getPage(4);
  const tc4 = await p4.getTextContent();
  console.log('\n=== PAGE 4 ITEMS (first 15) ===');
  tc4.items.filter(it => it.str.trim()).slice(0, 15).forEach(it => {
    console.log(`x=${Math.round(it.transform[4])}, y=${Math.round(it.transform[5])}, w=${Math.round(it.width)}: "${it.str}"`);
  });
}

main().catch(console.error);
