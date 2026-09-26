import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function testTableFix() {
  const filePath = 'C:/Users/khush/Downloads/JajritiYatra-Content.pdf';
  const arrayBuffer = fs.readFileSync(filePath);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const page = await pdf.getPage(1);
  const tc = await page.getTextContent();
  const opList = await page.getOperatorList();

  // Extract vertical line X positions
  const vLines = [];
  const hLines = [];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];
    if (fn === pdfjsLib.OPS.constructPath) {
      const ops = args[0] || [];
      const params = args[1] || [];
      let pIdx = 0;
      for (const op of ops) {
        if (op === 19) {
          const rx = params[pIdx++];
          const ry = params[pIdx++];
          const rw = params[pIdx++];
          const rh = params[pIdx++];
          if (rw <= 2 && rh > 5) {
            vLines.push(Math.round(rx));
          }
          if (rh <= 2 && rw > 20) {
            hLines.push({ y: Math.round(ry), w: Math.round(rw), x: Math.round(rx) });
          }
        }
      }
    }
  }

  const uniqueVLines = [...new Set(vLines)].sort((a, b) => a - b);
  console.log('Vertical lines on page 1:', uniqueVLines);
  console.log('Horizontal divider lines on page 1:', hLines);

  // Check table rows on page 1
  const bodyItems = tc.items.filter(it => it.str.trim()).map(it => ({
    str: it.str,
    x: Math.round(it.transform[4]),
    y: Math.round(it.transform[5]),
    w: Math.round(it.width)
  }));

  const tableItems = bodyItems.filter(it => it.y <= 90);
  console.log('\nTable items on page 1:');
  tableItems.forEach(it => {
    // Find which column it falls into using vertical lines
    let col = -1;
    for (let c = 0; c < uniqueVLines.length - 1; c++) {
      if (it.x >= uniqueVLines[c] - 5 && it.x < uniqueVLines[c + 1] + 5) {
        col = c;
        break;
      }
    }
    console.log(`   "${it.str}" (x=${it.x}, y=${it.y}) -> Column ${col} (bounds: [${uniqueVLines[col]}, ${uniqueVLines[col+1]}])`);
  });
}

testTableFix().catch(console.error);
