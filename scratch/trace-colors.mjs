import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function main() {
  const filePath = 'C:/Users/khush/Downloads/JajritiYatra-Content.pdf';
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const opList = await page.getOperatorList();

  console.log('Total ops on page 1:', opList.fnArray.length);

  // Let's trace color and text operations
  let curFillRgb = [0, 0, 0];
  let curStrokeRgb = [0, 0, 0];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];
    const fnName = Object.keys(pdfjsLib.OPS).find(k => pdfjsLib.OPS[k] === fn) || fn;

    if (fnName === 'setFillRGBColor') {
      curFillRgb = args;
    } else if (fnName === 'showText') {
      // args[0] is array of glyphs/text
      const text = args[0].map(g => g?.unicode || g?.char || (typeof g === 'string' ? g : '')).join('');
      const hex = curFillRgb.map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
      console.log(`[Op ${i}] showText "${text.slice(0, 30)}" -> fill RGB: [${curFillRgb.join(',')}], hex: #${hex}`);
    }
  }
}

main().catch(console.error);
