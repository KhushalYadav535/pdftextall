import fs from 'fs';
import JSZip from 'jszip';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';

function hexToRgb(hex, defaultColor = rgb(0.12, 0.15, 0.2)) {
  if (!hex || typeof hex !== 'string') return defaultColor;
  const clean = hex.replace(/^#/, '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return rgb(r, g, b);
  }
  return defaultColor;
}

function rgbToHex(color) {
  if (!color) return '#000000';
  const r = Math.round(color.red * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.green * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.blue * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

async function test() {
  const docxBuffer = fs.readFileSync('C:/Users/khush/Downloads/Sahbhagi_PRD_v1.docx');
  const zip = await JSZip.loadAsync(docxBuffer);
  
  // Test canvas rendering of Hindi text
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  
  const text = 'सहभागी — every voice, every language, counted';
  const scale = 2;
  const contentWidth = 504;
  const fontSize = 11;
  const lineH = 16;
  const canvas = createCanvas(Math.ceil(contentWidth * scale), Math.ceil(lineH * 2 * scale));
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#0F766E';
  ctx.font = `italic ${fontSize}pt "Nirmala UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(text, contentWidth / 2, fontSize * 1.2);
  
  const pngBytes = canvas.toBuffer('image/png');
  const img = await pdfDoc.embedPng(pngBytes);
  
  page.drawImage(img, {
    x: 54,
    y: 650,
    width: contentWidth,
    height: lineH * 2
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('d:/pdf/scratch/test-hindi-canvas-out.pdf', pdfBytes);
  console.log('Saved test-hindi-canvas-out.pdf, size:', pdfBytes.length);
}

test().catch(console.error);
