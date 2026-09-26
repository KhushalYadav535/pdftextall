import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function main() {
  const filePath = 'C:/Users/khush/Downloads/JajritiYatra-Content.pdf';
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  console.log('Total pages:', doc.numPages);

  for (let p = 1; p <= Math.min(2, doc.numPages); p++) {
    console.log(`\n=================== PAGE ${p} ===================`);
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1.0 });
    console.log(`Viewport: width=${viewport.width}, height=${viewport.height}`);
    const tc = await page.getTextContent();
    console.log(`Text items count: ${tc.items.length}`);
    
    // Group by Y
    const rowMap = {};
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      let foundY = Object.keys(rowMap).find(ry => Math.abs(Number(ry) - y) <= 4);
      if (!foundY) {
        foundY = y;
        rowMap[foundY] = [];
      }
      rowMap[foundY].push({
        x: Math.round(it.transform[4]),
        y,
        w: Math.round(it.width),
        h: Math.round(it.height),
        str: it.str,
        font: it.fontName
      });
    }

    const sortedY = Object.keys(rowMap).map(Number).sort((a, b) => b - a);
    for (const y of sortedY) {
      const items = rowMap[y].sort((a, b) => a.x - b.x);
      const lineStr = items.map(it => `[x=${it.x},w=${it.w} "${it.str}"]`).join(' ');
      console.log(`y=${y} (items=${items.length}): ${lineStr}`);
    }
  }
}

main().catch(console.error);
