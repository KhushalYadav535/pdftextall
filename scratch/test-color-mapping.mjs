import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function main() {
  const filePath = 'C:/Users/khush/Downloads/JajritiYatra-Content.pdf';
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;

  for (let p = 1; p <= 2; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const opList = await page.getOperatorList();

    console.log(`\n=== PAGE ${p} ===`);
    console.log(`TextContent items: ${tc.items.length}`);

    // Map showText ops to text strings and colors
    const textOps = [];
    let curColorHex = '000000';

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (fn === pdfjsLib.OPS.setFillRGBColor) {
        // args can be 0..255 or 0..1
        const r = args[0] <= 1 && args[1] <= 1 && args[2] <= 1 && (args[0] > 0 || args[1] > 0 || args[2] > 0)
          ? Math.round(args[0] * 255)
          : Math.round(args[0]);
        const g = args[0] <= 1 && args[1] <= 1 && args[2] <= 1 && (args[0] > 0 || args[1] > 0 || args[2] > 0)
          ? Math.round(args[1] * 255)
          : Math.round(args[1]);
        const b = args[0] <= 1 && args[1] <= 1 && args[2] <= 1 && (args[0] > 0 || args[1] > 0 || args[2] > 0)
          ? Math.round(args[2] * 255)
          : Math.round(args[2]);
        curColorHex = [r, g, b].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('').toUpperCase();
      } else if (fn === pdfjsLib.OPS.setFillGray) {
        const val = args[0] <= 1 ? Math.round(args[0] * 255) : Math.round(args[0]);
        const h = Math.max(0, Math.min(255, val)).toString(16).padStart(2, '0').toUpperCase();
        curColorHex = h + h + h;
      } else if (fn === pdfjsLib.OPS.showText) {
        const str = args[0].map(g => g?.unicode || g?.char || (typeof g === 'string' ? g : '')).join('');
        textOps.push({ str, color: curColorHex });
      }
    }

    console.log(`showText count: ${textOps.length}`);
    tc.items.filter(it => it.str && it.str.trim()).slice(0, 10).forEach((it, idx) => {
      const matchedOp = textOps.find(to => to.str && (to.str.includes(it.str) || it.str.includes(to.str)));
      console.log(`Item [${idx}] "${it.str.slice(0, 25)}" -> matched color: #${matchedOp?.color || '000000'}`);
    });
  }
}

main().catch(console.error);
