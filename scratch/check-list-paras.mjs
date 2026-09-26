import fs from 'fs';

const docXml = fs.readFileSync('d:/pdf/scratch/sahbhagi-doc.xml', 'utf-8');

// Find all paragraphs with ListParagraph or numPr
const listParas = docXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g);
let count = 0;
for (const p of listParas) {
  const xml = p[0];
  if (xml.includes('ListParagraph') || xml.includes('w:numPr')) {
    count++;
    if (count <= 5) {
      console.log(`--- List Para ${count} ---`);
      console.log(xml.slice(0, 500));
    }
  }
}
console.log(`Total list paragraphs: ${count}`);
