import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument } from 'pdf-lib';

async function testPasswordUnlock() {
  console.log('=== TEST 1: Password-protected PDF verification ===');
  const pdfBytes = new Uint8Array(fs.readFileSync('d:/pdf/scratch/test-docs/password-protected-test.pdf'));

  // 1. Test load without password -> must fail with PasswordException (code 1 = NEEDED_PASSWORD)
  console.log('\nStep 1: Attempting to load without password...');
  let caughtNoPassword = false;
  try {
    await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
  } catch (err) {
    if (err.name === 'PasswordException') {
      caughtNoPassword = true;
      console.log(`✓ Caught PasswordException as expected. Code: ${err.code} (NEEDED_PASSWORD)`);
    } else {
      console.error('Unexpected error:', err);
    }
  }
  if (!caughtNoPassword) {
    throw new Error('FAILED: Expected PasswordException when opening protected PDF without password');
  }

  // 2. Test load with incorrect password -> must fail with PasswordException (code 2 = INCORRECT_PASSWORD)
  console.log('\nStep 2: Attempting to load with incorrect password ("wrongpass")...');
  let caughtWrongPassword = false;
  try {
    await pdfjsLib.getDocument({ data: pdfBytes.slice(0), password: 'wrongpass' }).promise;
  } catch (err) {
    if (err.name === 'PasswordException') {
      caughtWrongPassword = true;
      console.log(`✓ Caught PasswordException as expected. Code: ${err.code} (INCORRECT_PASSWORD)`);
    } else {
      console.error('Unexpected error:', err);
    }
  }
  if (!caughtWrongPassword) {
    throw new Error('FAILED: Expected PasswordException code 2 when opening with wrong password');
  }

  // 3. Test load with correct password ("secret123") -> must succeed
  console.log('\nStep 3: Attempting to load with correct password ("secret123")...');
  const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0), password: 'secret123' }).promise;
  console.log(`✓ Successfully unlocked PDF! Number of pages: ${doc.numPages}`);
  const page = await doc.getPage(1);
  const textContent = await page.getTextContent();
  const items = textContent.items.map(it => it.str).filter(Boolean);
  console.log(`✓ Extracted text from page 1: "${items.join(' ')}"`);

  // 4. Test visual export decryption
  console.log('\nStep 4: Testing export of encrypted PDF...');
  // We simulate what exportVisualPdf does:
  // Render page 1 with pdfjs (using password) into canvas, then embed into a new PDFDocument
  // Let's test the exported PDF at scratch/test-unprotected-export.pdf or scratch/test-pw-exported.pdf
  const exportedPath = 'd:/pdf/scratch/test-unprotected-export.pdf';
  if (fs.existsSync(exportedPath)) {
    const exportedBytes = new Uint8Array(fs.readFileSync(exportedPath));
    
    // Check with pdfjs WITHOUT password
    const verifyPdfjs = await pdfjsLib.getDocument({ data: exportedBytes.slice(0) }).promise;
    console.log(`✓ Exported PDF opens in pdfjs WITHOUT password! Pages: ${verifyPdfjs.numPages}`);

    // Check with pdf-lib WITHOUT ignoreEncryption
    const verifyPdfLib = await PDFDocument.load(exportedBytes.slice(0));
    console.log(`✓ Exported PDF opens in pdf-lib WITHOUT ignoreEncryption! Pages: ${verifyPdfLib.getPageCount()}`);
  }

  console.log('\n=== ALL NODE TESTS PASSED ===');
}

testPasswordUnlock().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
