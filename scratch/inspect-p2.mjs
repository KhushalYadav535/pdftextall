import fs from 'fs';

const docXml = fs.readFileSync('d:/pdf/scratch/sahbhagi-doc.xml', 'utf-8');
const p2 = docXml.match(/<w:p\b[\s\S]*?<\/w:p>/g)?.[2];
console.log('Paragraph 2 XML:\n', p2);
