import fs from 'fs';
import JSZip from 'jszip';

async function checkNumbering() {
  const buf = fs.readFileSync('C:/Users/khush/Downloads/Sahbhagi_PRD_v1.docx');
  const zip = await JSZip.loadAsync(buf);
  if (zip.file('word/numbering.xml')) {
    const numXml = await zip.file('word/numbering.xml').async('string');
    console.log('Numbering XML exists, length:', numXml.length);
    console.log(numXml.slice(0, 1000));
  } else {
    console.log('No numbering.xml');
  }
}

checkNumbering().catch(console.error);
