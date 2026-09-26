import fs from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

async function test() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Check if Nirmala.ttc or another font can be embedded
  try {
    const fontBytes = fs.readFileSync('C:/Windows/Fonts/Nirmala.ttc');
    console.log('Nirmala.ttc size:', fontBytes.length);
    // ttc is a font collection, fontkit might need a specific font or ttf
    const customFont = await pdfDoc.embedFont(fontBytes);
    const page = pdfDoc.addPage([600, 400]);
    page.drawText('सहभागी — every voice, every language, counted', {
      x: 50,
      y: 300,
      size: 16,
      font: customFont,
      color: rgb(0, 0.5, 0.5)
    });
    const bytes = await pdfDoc.save();
    fs.writeFileSync('d:/pdf/scratch/test-hindi-output.pdf', bytes);
    console.log('Successfully rendered Hindi with fontkit! Bytes:', bytes.length);
    return;
  } catch (err) {
    console.log('Fontkit Nirmala error:', err.message);
  }

  // Check Canvas rendering fallback
  try {
    const { createCanvas } = await import('@napi-rs/canvas');
    const canvas = createCanvas(500, 50);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0F766E';
    ctx.font = 'italic 16px "Nirmala UI", sans-serif';
    ctx.fillText('सहभागी — every voice, every language, counted', 0, 35);
    const pngBuf = canvas.toBuffer('image/png');
    const embeddedPng = await pdfDoc.embedPng(pngBuf);
    const page = pdfDoc.addPage([600, 400]);
    page.drawImage(embeddedPng, {
      x: 50,
      y: 300,
      width: 400,
      height: 40
    });
    const bytes = await pdfDoc.save();
    fs.writeFileSync('d:/pdf/scratch/test-hindi-canvas.pdf', bytes);
    console.log('Successfully rendered Hindi with Canvas! Bytes:', bytes.length);
  } catch (cErr) {
    console.log('Canvas fallback error:', cErr.message);
  }
}

test().catch(console.error);
