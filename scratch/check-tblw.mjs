import fs from 'fs';

if (fs.existsSync('d:/pdf/scratch/gaurav-doc.xml')) {
  const gXml = fs.readFileSync('d:/pdf/scratch/gaurav-doc.xml', 'utf-8');
  const gTblW = gXml.match(/<w:tblW[^>]*>/g);
  console.log('Gaurav tblW:', gTblW);
}

const sXml = fs.readFileSync('d:/pdf/scratch/sahbhagi-doc.xml', 'utf-8');
const sTblW = sXml.match(/<w:tblW[^>]*>/g);
console.log('Sahbhagi tblW:', sTblW);
