import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

import path from 'path';
import { fileURLToPath } from 'url';

async function renderSahbhagiPages() {
  const data = new Uint8Array(fs.readFileSync('d:/pdf/scratch/sahbhagi-fixed.pdf'));
  const fontDir = path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/';
  const doc = await pdfjsLib.getDocument({ 
    data,
    standardFontDataUrl: fontDir
  }).promise;
  console.log('Pages:', doc.numPages);
  
  for (let i = 1; i <= Math.min(3, doc.numPages); i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    const pngBuf = canvas.toBuffer('image/png');
    const outPath = `d:/pdf/scratch/sahbhagi-page-${i}.png`;
    fs.writeFileSync(outPath, pngBuf);
    console.log(`Rendered page ${i} to ${outPath}`);
    
    // Also copy to artifacts directory for viewing
    const artifactPath = `C:/Users/khush/.gemini/antigravity-ide/brain/c9123aa1-7554-44bc-8236-27349b99b1db/sahbhagi-page-${i}.png`;
    fs.writeFileSync(artifactPath, pngBuf);
  }
}

renderSahbhagiPages().catch(console.error);
