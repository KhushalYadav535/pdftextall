import fs from 'fs';
import { convertDocxToPdf } from '../src/lib/iloveEngine.js';

async function test() {
  const buf = fs.readFileSync('C:/Users/khush/Downloads/Dr_Gaurav_Yadav_Resume (1).docx');
  const res = await convertDocxToPdf(buf);
  fs.writeFileSync('d:/pdf/scratch/gaurav-converted.pdf', res.pdfBytes);
  console.log('Converted successfully! Output size:', res.pdfBytes.length);
}

test().catch(console.error);
