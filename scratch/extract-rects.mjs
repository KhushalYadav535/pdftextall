import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function main() {
  const filePath = 'C:/Users/khush/Downloads/JajritiYatra-Content.pdf';
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;

  for (let p = 1; p <= 2; p++) {
    const page = await doc.getPage(p);
    const opList = await page.getOperatorList();
    const rects = [];
    const lines = [];

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      // constructPath: op 19 is rectangle: [19], [x, y, w, h]
      if (fn === pdfjsLib.OPS.constructPath) {
        const ops = args[0];
        const params = args[1];
        let pIdx = 0;
        for (const op of ops) {
          if (op === 19) { // rectangle
            const rx = params[pIdx++];
            const ry = params[pIdx++];
            const rw = params[pIdx++];
            const rh = params[pIdx++];
            rects.push({ x: rx, y: ry, w: rw, h: rh });
          }
        }
      }
    }
    console.log(`Page ${p} rects/lines (${rects.length}):`, rects.slice(0, 15));
  }
}

main().catch(console.error);
