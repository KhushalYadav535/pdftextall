import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function testDynamic() {
  const filePath = 'C:/Users/khush/Downloads/JajritiYatra-Content.pdf';
  const arrayBuffer = fs.readFileSync(filePath);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  for (let p = 1; p <= 2; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    const opList = await page.getOperatorList();

    const textColors = [];
    let curColorHex = '000000';

    for (let opIdx = 0; opIdx < opList.fnArray.length; opIdx++) {
      const fn = opList.fnArray[opIdx];
      const args = opList.argsArray[opIdx];

      if (fn === pdfjsLib.OPS.setFillRGBColor) {
        const r = args[0] <= 1 && args[1] <= 1 && args[2] <= 1 && (args[0] > 0 || args[1] > 0 || args[2] > 0)
          ? Math.round(args[0] * 255)
          : Math.round(args[0]);
        const g = args[0] <= 1 && args[1] <= 1 && args[2] <= 1 && (args[0] > 0 || args[1] > 0 || args[2] > 0)
          ? Math.round(args[1] * 255)
          : Math.round(args[1]);
        const b = args[0] <= 1 && args[1] <= 1 && args[2] <= 1 && (args[0] > 0 || args[1] > 0 || args[2] > 0)
          ? Math.round(args[2] * 255)
          : Math.round(args[2]);
        curColorHex = [r, g, b].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('').toUpperCase();
      } else if (fn === pdfjsLib.OPS.setFillGray) {
        const val = args[0] <= 1 ? Math.round(args[0] * 255) : Math.round(args[0]);
        const h = Math.max(0, Math.min(255, val)).toString(16).padStart(2, '0').toUpperCase();
        curColorHex = h + h + h;
      } else if (fn === pdfjsLib.OPS.showText) {
        const str = (args[0] || []).map((g) => g?.unicode || g?.char || (typeof g === 'string' ? g : '')).join('');
        textColors.push({ str, color: curColorHex });
      }
    }

    let colorCursor = 0;
    const allItems = (textContent.items || [])
      .filter((it) => it.str && it.str.trim())
      .map((it) => {
        const hasHindi = /[\u0900-\u097F]/.test(it.str);
        const fontSize = Math.round(it.height || Math.abs(it.transform?.[0]) || 10);

        let itemColor = '000000';
        for (let tcIdx = colorCursor; tcIdx < textColors.length; tcIdx++) {
          const tc = textColors[tcIdx];
          if (tc.str && (tc.str.includes(it.str) || it.str.includes(tc.str))) {
            itemColor = tc.color;
            colorCursor = tcIdx;
            break;
          }
        }
        if (itemColor === '000000') {
          const fallbackMatch = textColors.find((tc) => tc.str && (tc.str.includes(it.str) || it.str.includes(tc.str)));
          if (fallbackMatch) itemColor = fallbackMatch.color;
        }

        let fontFamily = 'Calibri';
        if (hasHindi) fontFamily = 'Nirmala UI';
        else if (/times|georgia|serif/i.test(it.fontName || '')) fontFamily = 'Times New Roman';
        else if (/courier|mono|consolas/i.test(it.fontName || '')) fontFamily = 'Courier New';
        else if (/arial|helvetica|sans/i.test(it.fontName || '')) fontFamily = 'Arial';

        return {
          str: it.str,
          fontSize,
          bold: /bold|black|heavy|semibold/i.test(it.fontName || ''),
          italic: /italic|oblique/i.test(it.fontName || ''),
          color: itemColor,
          fontFamily
        };
      });

    console.log(`\nPage ${p} dynamic items sample:`);
    allItems.slice(0, 5).forEach(it => {
      console.log(`   "${it.str.slice(0, 30)}" -> font=${it.fontFamily}, size=${it.fontSize}, bold=${it.bold}, color=#${it.color}`);
    });
  }
}

testDynamic().catch(console.error);
