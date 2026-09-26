import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function testTableDetection() {
  const filePath = 'C:/Users/khush/Downloads/JajritiYatra-Content.pdf';
  const arrayBuffer = fs.readFileSync(filePath);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const numPages = pdf.numPages;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    const rawItems = (textContent.items || [])
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({
        str: it.str,
        x: Math.round(it.transform?.[4] || 0),
        y: Math.round(it.transform?.[5] || 0),
        w: Math.round(it.width || (it.str.length * 5)),
        h: Math.round(it.height || 10),
        bold: /bold|black|heavy|semibold/i.test(it.fontName || '')
      }));

    const headerThreshold = viewport.height - 35;
    const footerThreshold = 35;
    const bodyItems = rawItems.filter(it => it.y < headerThreshold && it.y > footerThreshold);

    const lineMap = {};
    for (const it of bodyItems) {
      const y = it.y;
      let foundY = Object.keys(lineMap).find((ly) => Math.abs(Number(ly) - y) <= 4);
      if (!foundY) {
        foundY = y;
        lineMap[foundY] = [];
      }
      lineMap[foundY].push(it);
    }

    const sortedY = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
    const lines = sortedY.map((y) => {
      const items = lineMap[y].sort((a, b) => a.x - b.x);
      return {
        y,
        items,
        startX: items[0].x,
        endX: items[items.length - 1].x + items[items.length - 1].w,
        fullText: items.map((it) => it.str).join(' ').trim()
      };
    }).filter((l) => l.fullText.length > 0);

    let i = 0;
    while (i < lines.length) {
      let tableRows = [];
      let j = i;

      while (j < lines.length) {
        const line = lines[j];
        const isBullet = /^[•\-\*]\s*|^\d+[\.\)]\s*/.test(line.fullText);
        const isHeading = line.items[0].h >= 13 && (line.items[0].bold || /^\d+\.\s+/.test(line.fullText));
        if (isBullet || isHeading) break;

        const cols = [];
        let curCol = [line.items[0]];

        for (let k = 1; k < line.items.length; k++) {
          const prev = line.items[k - 1];
          const curr = line.items[k];
          const gap = curr.x - (prev.x + prev.w);
          const colDist = curr.x - prev.x;
          // Split if visual gap >= 8pt OR distance between starts >= 35pt
          if (gap >= 8 || colDist >= 35) {
            cols.push(curCol);
            curCol = [curr];
          } else {
            curCol.push(curr);
          }
        }
        cols.push(curCol);

        if (cols.length >= 2) {
          tableRows.push({ line, cols, y: line.y });
          j++;
        } else {
          break;
        }
      }

      if (tableRows.length >= 2) {
        console.log(`Page ${pageNum} Table detected (${tableRows.length} rows):`);
        tableRows.forEach(r => {
          console.log(`   ${r.cols.map(c => c.map(it => it.str).join(' ')).join(' | ')}`);
        });
        i = j;
        continue;
      }

      i++;
    }
  }
}

testTableDetection().catch(console.error);
