import 'regenerator-runtime/runtime.js';
import fs from 'fs';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function testFontEmbedding() {
  console.log('Testing fontkit font embedding with subset: true...');
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load NotoSansDevanagari-Regular.ttf
  const devanagariBytes = fs.readFileSync('public/fonts/NotoSansDevanagari-Regular.ttf');
  const devanagariFont = await pdfDoc.embedFont(devanagariBytes, { subset: true });
  console.log('✓ Embedded NotoSansDevanagari (subset: true)');

  // Load NotoSans-Regular.ttf
  const notoSansBytes = fs.readFileSync('public/fonts/NotoSans-Regular.ttf');
  const notoSansFont = await pdfDoc.embedFont(notoSansBytes, { subset: true });
  console.log('✓ Embedded NotoSans (subset: true)');

  const page = pdfDoc.addPage([600, 400]);

  const hindiText = 'नमस्ते भारत! यह एक परीक्षण दस्तावेज़ है।';
  const unicodeText = 'Special Unicode: € • “quotes” — em-dash ō ł ż';

  console.log('Testing unicodeText with NotoSans...');
  page.drawText(unicodeText, {
    x: 50,
    y: 250,
    size: 14,
    font: notoSansFont,
  });
  console.log('✓ NotoSans drawText succeeded!');

  console.log('Testing hindiText with NotoSansDevanagari...');
  try {
    page.drawText(hindiText, {
      x: 50,
      y: 300,
      size: 16,
      font: devanagariFont,
    });
    console.log('✓ NotoSansDevanagari drawText succeeded with subset: true!');
  } catch (e) {
    console.log('NotoSansDevanagari failed with subset: true:', e.message);
    console.log('Retrying with subset: false...');
    const devanagariFull = await pdfDoc.embedFont(devanagariBytes, { subset: false });
    page.drawText(hindiText, {
      x: 50,
      y: 300,
      size: 16,
      font: devanagariFull,
    });
    console.log('✓ NotoSansDevanagari drawText succeeded with subset: false!');
  }

  const savedBytes = await pdfDoc.save();
  console.log(`✓ Saved PDF (${savedBytes.length} bytes)`);

  // Verify with pdf.js getTextContent
  const doc = await pdfjsLib.getDocument({ data: savedBytes }).promise;
  const p1 = await doc.getPage(1);
  const tc = await p1.getTextContent();
  const extracted = tc.items.map(it => it.str).join(' ');
  console.log('✓ Extracted text in pdf.js:', extracted);

  if (!extracted.includes('नमस्ते') || !extracted.includes('भारत')) {
    throw new Error('FAILED: Hindi text was not properly extracted in pdf.js');
  }
  if (!extracted.includes('€') || !extracted.includes('quotes')) {
    throw new Error('FAILED: Unicode text was not properly extracted in pdf.js');
  }

  console.log('✓ ALL FONT EMBEDDING TESTS PASSED!');
}

testFontEmbedding().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
