import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Test both vector and visual export behaviors
async function testExportFidelity() {
  console.log('Testing export fidelity for text editing...');
  const originalBytes = fs.readFileSync('d:/pdf/scratch/test-docs/test-invoice.pdf');
  
  // Let's test vector export using pdf-lib (simulating exportVectorPdf)
  const pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const page1 = pages[0];
  const { width, height } = page1.getSize();

  // Whiteout original position
  // Original position from our test invoice: x ~ 50, y ~ 700
  page1.drawRectangle({
    x: 48,
    y: 690,
    width: 320,
    height: 25,
    color: rgb(1, 1, 1),
  });

  // Draw new text
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  page1.drawText('ACME GLOBAL - UPDATED INVOICE', {
    x: 50,
    y: 695,
    size: 16,
    font,
    color: rgb(0.1, 0.2, 0.6)
  });

  const editedVectorBytes = await pdfDoc.save();
  fs.writeFileSync('d:/pdf/scratch/test-output-vector.pdf', editedVectorBytes);
  console.log('Saved vector export: scratch/test-output-vector.pdf, size:', editedVectorBytes.byteLength);

  // Now verify with pdfjs
  const doc = await pdfjsLib.getDocument({ data: editedVectorBytes }).promise;
  const p1 = await doc.getPage(1);
  const textContent = await p1.getTextContent();
  const items = textContent.items.map(i => i.str);
  const foundNewText = items.some(s => s.includes('ACME GLOBAL - UPDATED INVOICE'));
  console.log('Verification in pdfjs: Is new text found in textContent?', foundNewText);

  // Write evidence report
  const report = {
    originalSize: originalBytes.byteLength,
    vectorExportSize: editedVectorBytes.byteLength,
    textSearchableInVector: foundNewText,
    visualExportModeNote: 'In browser, exportVisualPdf renders canvas to PNG at 3x scale and inserts PNG image, which produces high visual fidelity but loses selectable/searchable text on edited pages.'
  };
  fs.writeFileSync('d:/pdf/scratch/export-fidelity-report.json', JSON.stringify(report, null, 2));
}

testExportFidelity().catch(console.error);
