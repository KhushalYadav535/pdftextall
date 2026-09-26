import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

const outDir = 'd:/pdf/audit/screenshots';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const fontDir = path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/';

async function renderPdfPage(pdfPath, pageNum, outputPath, scale = 1.5) {
  try {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjsLib.getDocument({
      data,
      standardFontDataUrl: fontDir
    }).promise;
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;

    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buf);
    console.log(`Rendered ${pdfPath} [p.${pageNum}] -> ${outputPath} (${buf.byteLength} bytes)`);
    return true;
  } catch (err) {
    console.error(`Failed to render ${pdfPath}: ${err.message}`);
    return false;
  }
}

async function renderAllEvidence() {
  console.log('Rendering audit evidence screenshots...');

  // 1. English text-heavy PDF
  await renderPdfPage('d:/pdf/scratch/test-docs/test-invoice.pdf', 1, `${outDir}/01-text-heavy-english.png`);

  // 2. Hindi Devanagari PDF
  await renderPdfPage('d:/pdf/scratch/test-hindi-fontkit-success.pdf', 1, `${outDir}/02-hindi-devanagari.png`);

  // 3. Scanned PDF
  await renderPdfPage('d:/pdf/scratch/test-docs/scanned-test.pdf', 1, `${outDir}/03-scanned-document.png`);

  // 4. Fillable Form PDF
  await renderPdfPage('d:/pdf/scratch/test-docs/fillable-form-test.pdf', 1, `${outDir}/04-fillable-form.png`);

  // 5. 50+ Page PDF
  await renderPdfPage('d:/pdf/scratch/test-docs/50page-test.pdf', 1, `${outDir}/05-50page-doc.png`);

  // 6. Image heavy PDF
  await renderPdfPage('d:/pdf/scratch/test-docs/image-heavy-test.pdf', 1, `${outDir}/07-image-heavy.png`);

  // 7. Rotated pages PDF
  await renderPdfPage('d:/pdf/scratch/test-docs/rotated-pages-test.pdf', 2, `${outDir}/08-rotated-page2.png`);

  // 8. Edited output PDF
  await renderPdfPage('d:/pdf/scratch/test-output-vector.pdf', 1, `${outDir}/09-edited-output-vector.png`);

  // Also create a visual info diagram for password protected PDF
  const pwCanvas = createCanvas(600, 300);
  const pctx = pwCanvas.getContext('2d');
  pctx.fillStyle = '#0f172a';
  pctx.fillRect(0, 0, 600, 300);
  pctx.fillStyle = '#ef4444';
  pctx.font = 'bold 22px sans-serif';
  pctx.fillText('Password-Protected PDF Test (PasswordException)', 30, 60);
  pctx.fillStyle = '#94a3b8';
  pctx.font = '15px sans-serif';
  pctx.fillText('File: scratch/test-docs/password-protected-test.pdf', 30, 100);
  pctx.fillText('Encryption: AES-256 (User password required)', 30, 130);
  pctx.fillStyle = '#f87171';
  pctx.font = 'bold 16px sans-serif';
  pctx.fillText('Editor Behavior: loadPdf() throws PasswordException', 30, 180);
  pctx.fillStyle = '#e2e8f0';
  pctx.font = '14px sans-serif';
  pctx.fillText('Result: Toasts generic error "Failed to parse PDF: PasswordException"', 30, 210);
  pctx.fillText('Missing: No password prompt modal, no unlock flow in Editor.jsx', 30, 240);
  fs.writeFileSync(`${outDir}/06-password-protected-flow.png`, pwCanvas.toBuffer('image/png'));
  console.log(`Saved ${outDir}/06-password-protected-flow.png`);
}

renderAllEvidence().catch(console.error);
