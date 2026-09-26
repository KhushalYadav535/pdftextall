import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function auditDynamicFeatures() {
  const filePath = 'C:/Users/khush/Downloads/JajritiYatra-Content.pdf';
  const arrayBuffer = fs.readFileSync(filePath);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const numPages = pdf.numPages;

  console.log('=== AUDITING DYNAMIC EXTRACTION CAPABILITIES ===');
  console.log(`Document has ${numPages} pages.`);

  for (let p = 1; p <= Math.min(2, numPages); p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1.0 });
    const tc = await page.getTextContent();
    const opList = await page.getOperatorList();

    // 1. Vector graphics / lines / rectangles
    const drawnLines = [];
    const filledRects = [];
    let curFillColor = 'FFFFFF';
    let curStrokeColor = '000000';

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (fn === pdfjsLib.OPS.setFillRGBColor) {
        const r = Math.round((args[0] <= 1 ? args[0] * 255 : args[0]));
        const g = Math.round((args[1] <= 1 ? args[1] * 255 : args[1]));
        const b = Math.round((args[2] <= 1 ? args[2] * 255 : args[2]));
        curFillColor = [r, g, b].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('').toUpperCase();
      } else if (fn === pdfjsLib.OPS.setStrokeRGBColor) {
        const r = Math.round((args[0] <= 1 ? args[0] * 255 : args[0]));
        const g = Math.round((args[1] <= 1 ? args[1] * 255 : args[1]));
        const b = Math.round((args[2] <= 1 ? args[2] * 255 : args[2]));
        curStrokeColor = [r, g, b].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('').toUpperCase();
      } else if (fn === pdfjsLib.OPS.constructPath) {
        const ops = args[0];
        const params = args[1];
        let pIdx = 0;
        for (const op of ops) {
          if (op === 19) { // rectangle
            const rx = params[pIdx++];
            const ry = params[pIdx++];
            const rw = params[pIdx++];
            const rh = params[pIdx++];
            if (rw <= 2 || rh <= 2) {
              drawnLines.push({ x: rx, y: ry, w: rw, h: rh, color: curStrokeColor });
            } else {
              filledRects.push({ x: rx, y: ry, w: rw, h: rh, color: curFillColor });
            }
          }
        }
      }
    }

    console.log(`\nPage ${p}:`);
    console.log(`   Drawn vector lines: ${drawnLines.length}`);
    console.log(`   Filled background rects: ${filledRects.length}`);
    if (drawnLines.length > 0) {
      console.log(`   Sample line color: #${drawnLines[0].color}, dimensions: w=${drawnLines[0].w}, h=${drawnLines[0].h}`);
    }
    if (filledRects.length > 0) {
      console.log(`   Sample fill color: #${filledRects[0].color}, dimensions: w=${filledRects[0].w}, h=${filledRects[0].h}`);
    }
  }
}

auditDynamicFeatures().catch(console.error);
