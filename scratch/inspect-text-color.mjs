import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function main() {
  const filePath = 'C:/Users/khush/Downloads/JajritiYatra-Content.pdf';
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const tc = await page.getTextContent();
  console.log('Keys of first text item:', Object.keys(tc.items[0]));
  console.log('Sample item:', tc.items[0]);
  console.log('tc.styles:', Object.keys(tc.styles).slice(0, 5));
  console.log('Sample style:', Object.values(tc.styles)[0]);
}

main().catch(console.error);
