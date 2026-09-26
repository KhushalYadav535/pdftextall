import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function main() {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(fs.readFileSync('C:/Users/khush/Downloads/JajritiYatra-Content.pdf')) }).promise;
  const p2 = await doc.getPage(2);
  const tc2 = await p2.getTextContent();
  console.log('=== PAGE 2 ITEMS (y < 220) ===');
  tc2.items.filter(it => it.str.trim() && Math.round(it.transform[5]) < 220).forEach(it => {
    console.log(`x=${Math.round(it.transform[4])}, y=${Math.round(it.transform[5])}, font=${it.fontName}, h=${Math.round(it.height)}: "${it.str}"`);
  });
}

main().catch(console.error);
