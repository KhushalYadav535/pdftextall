import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

async function renderPdfToPng() {
  const data = new Uint8Array(fs.readFileSync('d:/pdf/scratch/gaurav-converted.pdf'));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  console.log('Pages:', doc.numPages);
  
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    const pngBuf = canvas.toBuffer('image/png');
    fs.writeFileSync(`d:/pdf/scratch/gaurav-page-${i}.png`, pngBuf);
    console.log(`Rendered page ${i} to d:/pdf/scratch/gaurav-page-${i}.png`);
  }
}

renderPdfToPng().catch(console.error);
