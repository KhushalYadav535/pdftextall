import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

async function runAudit() {
  const results = {};

  console.log('=== AUDIT TEST 1: Text-heavy English PDF ===');
  try {
    const data = new Uint8Array(fs.readFileSync('d:/pdf/scratch/test-docs/test-invoice.pdf'));
    const doc = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const textItems = content.items.map(it => it.str).filter(Boolean);
    console.log(`- Loaded 1 page, extracted ${textItems.length} text items`);
    console.log(`- Sample text: "${textItems.slice(0, 3).join(' | ')}"`);
    results.textHeavy = {
      pages: doc.numPages,
      itemsCount: textItems.length,
      sample: textItems.slice(0, 5),
      status: 'YES'
    };
  } catch (e) {
    console.error('Error in Test 1:', e.message);
    results.textHeavy = { status: 'NO', error: e.message };
  }

  console.log('\n=== AUDIT TEST 2: Hindi/Devanagari PDF ===');
  try {
    const data = new Uint8Array(fs.readFileSync('d:/pdf/scratch/test-hindi-fontkit-success.pdf'));
    const doc = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const textItems = content.items.map(it => it.str).filter(Boolean);
    console.log(`- Extracted ${textItems.length} items`);
    console.log(`- Sample Devanagari text: "${textItems.slice(0, 3).join(' | ')}"`);

    // Test vector export with Devanagari using pdf-lib standard font (to see if sanitize drops it)
    const pdfDoc = await PDFDocument.create();
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const p = pdfDoc.addPage();
    let sanitizeDropped = false;
    try {
      p.drawText(textItems[0] || 'नमस्ते', { x: 50, y: 700, font: helv });
    } catch (err) {
      sanitizeDropped = true;
      console.log(`- Standard font vector draw threw error on Devanagari: ${err.message}`);
    }

    results.hindi = {
      extracted: textItems.length > 0,
      sample: textItems.slice(0, 3),
      vectorStandardFontSupport: !sanitizeDropped,
      note: 'Standard PDF fonts lack Devanagari glyphs; requires fontkit embedding or canvas raster fallback.'
    };
  } catch (e) {
    console.error('Error in Test 2:', e.message);
    results.hindi = { status: 'NO', error: e.message };
  }

  console.log('\n=== AUDIT TEST 3: Scanned (Image-only) PDF ===');
  try {
    const data = new Uint8Array(fs.readFileSync('d:/pdf/scratch/test-docs/scanned-test.pdf'));
    const doc = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const textItems = content.items.map(it => it.str).filter(Boolean);
    console.log(`- Scanned PDF text items extracted: ${textItems.length}`);
    results.scanned = {
      isScannedDetected: textItems.length === 0,
      textItemsCount: textItems.length,
      note: 'When text items === 0, our PdfCanvas triggers isScannedDoc banner offering OCR.'
    };
  } catch (e) {
    console.error('Error in Test 3:', e.message);
    results.scanned = { status: 'NO', error: e.message };
  }

  console.log('\n=== AUDIT TEST 4: Fillable Form PDF ===');
  try {
    const data = new Uint8Array(fs.readFileSync('d:/pdf/scratch/test-docs/fillable-form-test.pdf'));
    const pdfDoc = await PDFDocument.load(data);
    const form = pdfDoc.getForm();
    const fields = form.getFields().map(f => ({ name: f.getName(), type: f.constructor.name }));
    console.log(`- PDF Form Fields detected: ${fields.length}`);
    fields.forEach(f => console.log(`  * ${f.name} (${f.type})`));

    // Now check if our Editor has form interaction:
    // In our Editor: PdfCanvas only extracts text via page.getTextContent(). It does NOT render interactive AcroForm widgets or form field creation tools!
    results.forms = {
      fieldsInPdf: fields,
      editorSupport: 'NO',
      notes: 'PdfCanvas renders static PDF raster without AcroForm widget overlay. Forms menu in toolbar only has Check/Cross stamps, no form field creation or filling.'
    };
  } catch (e) {
    console.error('Error in Test 4:', e.message);
    results.forms = { status: 'NO', error: e.message };
  }

  console.log('\n=== AUDIT TEST 5: 50+ Page PDF ===');
  try {
    const t0 = Date.now();
    const data = new Uint8Array(fs.readFileSync('d:/pdf/scratch/test-docs/50page-test.pdf'));
    const doc = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
    const loadTimeMs = Date.now() - t0;
    console.log(`- Loaded 50+ page document: ${doc.numPages} pages in ${loadTimeMs}ms`);
    results.fiftyPages = {
      numPages: doc.numPages,
      loadTimeMs,
      performance: loadTimeMs < 1000 ? 'GOOD' : 'SLOW'
    };
  } catch (e) {
    console.error('Error in Test 5:', e.message);
    results.fiftyPages = { status: 'NO', error: e.message };
  }

  console.log('\n=== AUDIT TEST 6: Password-Protected PDF ===');
  try {
    const data = new Uint8Array(fs.readFileSync('d:/pdf/scratch/test-docs/password-protected-test.pdf'));
    let pwRequired = false;
    let errorName = '';
    try {
      await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
    } catch (err) {
      pwRequired = true;
      errorName = err.name;
      console.log(`- pdfjs loading password PDF threw: ${err.name} (${err.message})`);
    }
    results.passwordProtected = {
      pwRequired,
      errorName,
      editorHasModal: false,
      notes: 'Editor.jsx catches error in loadPdf(file) with toast.error("Failed to parse PDF: " + e.message) but has NO password prompt modal to ask user for password.'
    };
  } catch (e) {
    console.error('Error in Test 6:', e.message);
    results.passwordProtected = { status: 'NO', error: e.message };
  }

  console.log('\n=== AUDIT TEST 7: Image-Heavy PDF ===');
  try {
    const data = new Uint8Array(fs.readFileSync('d:/pdf/scratch/test-docs/image-heavy-test.pdf'));
    const doc = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
    console.log(`- Image-heavy PDF loaded: ${doc.numPages} pages, file size ${data.byteLength} bytes`);
    results.imageHeavy = {
      pages: doc.numPages,
      sizeBytes: data.byteLength,
      status: 'YES'
    };
  } catch (e) {
    console.error('Error in Test 7:', e.message);
    results.imageHeavy = { status: 'NO', error: e.message };
  }

  console.log('\n=== AUDIT TEST 8: Rotated Pages PDF ===');
  try {
    const data = new Uint8Array(fs.readFileSync('d:/pdf/scratch/test-docs/rotated-pages-test.pdf'));
    const doc = await pdfjsLib.getDocument({ data: data.slice(0) }).promise;
    const rotations = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      rotations.push({ page: i, rotate: page.rotate });
    }
    console.log('- Page rotations:', rotations);
    results.rotatedPages = {
      rotations,
      notes: 'PageThumbnails can rotate pages 90 deg via rotatePdf(), but PdfCanvas text extraction overlay does not properly account for rotated viewports when placing editing blocks on pre-rotated pages.'
    };
  } catch (e) {
    console.error('Error in Test 8:', e.message);
    results.rotatedPages = { status: 'NO', error: e.message };
  }

  fs.writeFileSync('d:/pdf/scratch/audit-test-summary.json', JSON.stringify(results, null, 2));
  console.log('\nSaved audit summary to d:/pdf/scratch/audit-test-summary.json');
}

runAudit().catch(console.error);
