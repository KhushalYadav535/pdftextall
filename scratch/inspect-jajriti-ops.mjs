import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function main() {
  const filePath = 'C:/Users/khush/Downloads/JajritiYatra-Content.pdf';
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;

  for (let p = 1; p <= Math.min(2, doc.numPages); p++) {
    console.log(`\n=================== PAGE ${p} OPS ===================`);
    const page = await doc.getPage(p);
    const opList = await page.getOperatorList();
    console.log(`Operator count: ${opList.fnArray.length}`);
    
    // Check ops
    const ops = {};
    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const fnName = Object.keys(pdfjsLib.OPS).find(k => pdfjsLib.OPS[k] === fn) || fn;
      ops[fnName] = (ops[fnName] || 0) + 1;
      // print line/rect/stroke/fill ops with args
      if (['constructPath', 'stroke', 'fill', 'rectangle', 'moveTo', 'lineTo'].includes(fnName)) {
        console.log(`Op [${i}] ${fnName}:`, JSON.stringify(opList.argsArray[i]));
      }
    }
    console.log('Op summary:', ops);
  }
}

main().catch(console.error);
