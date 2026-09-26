import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

async function renderPages() {
  const { convertDocxToPdf } = await import('../src/lib/iloveEngine.js');
  const docxBuf = fs.readFileSync('d:/pdf/scratch/output-jajriti-v2.docx');
  const res = await convertDocxToPdf(docxBuf);
  
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(res.pdfBytes) }).promise;
  console.log(`Rendering ${doc.numPages} pages to PNG...`);

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;
    const imgBuf = canvas.toBuffer('image/png');
    fs.writeFileSync(`d:/pdf/scratch/jajriti-page-${p}.png`, imgBuf);
    console.log(`Saved jajriti-page-${p}.png (${imgBuf.length} bytes)`);
  }
}

renderPages().catch(console.error);
