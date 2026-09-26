import fs from 'fs';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';

async function main() {
  const dir = 'd:/pdf/scratch/test-docs';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // 1. Fillable Form PDF
  console.log('Creating fillable form PDF...');
  const formDoc = await PDFDocument.create();
  const formPage = formDoc.addPage([600, 750]);
  const form = formDoc.getForm();
  const helv = await formDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await formDoc.embedFont(StandardFonts.HelveticaBold);

  formPage.drawText('Application Form (Fillable)', { x: 50, y: 700, size: 20, font: helvBold });
  
  // Text Field
  formPage.drawText('Full Name:', { x: 50, y: 640, size: 12, font: helv });
  const nameField = form.createTextField('applicant.name');
  nameField.setText('John Doe');
  nameField.addToPage(formPage, { x: 150, y: 630, width: 250, height: 25 });

  // Checkbox
  formPage.drawText('Subscribe to newsletter:', { x: 50, y: 580, size: 12, font: helv });
  const subCheck = form.createCheckBox('applicant.subscribe');
  subCheck.check();
  subCheck.addToPage(formPage, { x: 220, y: 575, width: 20, height: 20 });

  // Radio Group
  formPage.drawText('Account Type:', { x: 50, y: 520, size: 12, font: helv });
  const radioGroup = form.createRadioGroup('applicant.plan');
  radioGroup.addOptionToPage('Free', formPage, { x: 160, y: 515, width: 18, height: 18 });
  formPage.drawText('Free', { x: 185, y: 518, size: 11, font: helv });
  radioGroup.addOptionToPage('Pro', formPage, { x: 240, y: 515, width: 18, height: 18 });
  formPage.drawText('Pro', { x: 265, y: 518, size: 11, font: helv });
  radioGroup.select('Pro');

  // Dropdown
  formPage.drawText('Country:', { x: 50, y: 460, size: 12, font: helv });
  const countryDrop = form.createDropdown('applicant.country');
  countryDrop.addOptions(['India', 'United States', 'Germany', 'Japan', 'United Kingdom']);
  countryDrop.select('India');
  countryDrop.addToPage(formPage, { x: 150, y: 450, width: 200, height: 25 });

  const formBytes = await formDoc.save();
  fs.writeFileSync(`${dir}/fillable-form-test.pdf`, formBytes);
  console.log('Saved fillable-form-test.pdf');

  // 2. Rotated Pages PDF
  console.log('Creating rotated pages PDF...');
  const rotDoc = await PDFDocument.create();
  const p1 = rotDoc.addPage([600, 800]);
  p1.drawText('Page 1: Normal Orientation (0 deg)', { x: 50, y: 700, size: 18, font: helvBold });

  const p2 = rotDoc.addPage([600, 800]);
  p2.setRotation(degrees(90));
  p2.drawText('Page 2: Rotated 90 Degrees Clockwise', { x: 50, y: 700, size: 18, font: helvBold });

  const p3 = rotDoc.addPage([600, 800]);
  p3.setRotation(degrees(180));
  p3.drawText('Page 3: Rotated 180 Degrees', { x: 50, y: 700, size: 18, font: helvBold });

  const p4 = rotDoc.addPage([600, 800]);
  p4.setRotation(degrees(270));
  p4.drawText('Page 4: Rotated 270 Degrees', { x: 50, y: 700, size: 18, font: helvBold });

  const rotBytes = await rotDoc.save();
  fs.writeFileSync(`${dir}/rotated-pages-test.pdf`, rotBytes);
  console.log('Saved rotated-pages-test.pdf');

  // 3. Image-heavy PDF
  console.log('Creating image-heavy PDF...');
  const imgDoc = await PDFDocument.create();
  // Create 1x1 or sample png bytes
  // Minimal 1x1 PNG:
  const redPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const bluePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPifDwAErQGAKhJcLQAAAABJRU5ErkJggg==', 'base64');
  const embeddedRed = await imgDoc.embedPng(redPng);
  const embeddedBlue = await imgDoc.embedPng(bluePng);

  for (let i = 1; i <= 5; i++) {
    const page = imgDoc.addPage([600, 800]);
    page.drawText(`Image Heavy Document - Page ${i}`, { x: 50, y: 750, size: 16, font: helvBold });
    page.drawImage(embeddedRed, { x: 50, y: 400, width: 220, height: 300 });
    page.drawImage(embeddedBlue, { x: 310, y: 400, width: 220, height: 300 });
    page.drawImage(embeddedBlue, { x: 50, y: 50, width: 220, height: 300 });
    page.drawImage(embeddedRed, { x: 310, y: 50, width: 220, height: 300 });
  }
  const imgBytes = await imgDoc.save();
  fs.writeFileSync(`${dir}/image-heavy-test.pdf`, imgBytes);
  console.log('Saved image-heavy-test.pdf');

  // 4. Password Protected PDF
  console.log('Creating encrypted password PDF...');
  const pwDoc = await PDFDocument.create();
  const pwPage = pwDoc.addPage([500, 400]);
  pwPage.drawText('Confidential: Password Protected Document', { x: 50, y: 300, size: 16, font: helvBold });
  pwPage.drawText('Password is: secret123', { x: 50, y: 250, size: 14, font: helv });
  const rawBytes = await pwDoc.save();
  const encryptedBytes = await encryptPDF(new Uint8Array(rawBytes), 'secret123', {
    ownerPassword: 'admin',
    algorithm: 'AES-256'
  });
  fs.writeFileSync(`${dir}/password-protected-test.pdf`, Buffer.from(encryptedBytes));
  console.log('Saved password-protected-test.pdf');
}

main().catch(console.error);
