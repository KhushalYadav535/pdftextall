import fs from 'fs';

const docXml = fs.readFileSync('d:/pdf/scratch/sahbhagi-doc.xml', 'utf8');
const headerXml = fs.existsSync('d:/pdf/scratch/word_header1.xml') ? fs.readFileSync('d:/pdf/scratch/word_header1.xml', 'utf8') : '';
const footerXml = fs.existsSync('d:/pdf/scratch/word_footer1.xml') ? fs.readFileSync('d:/pdf/scratch/word_footer1.xml', 'utf8') : '';

console.log('--- HEADER XML ---');
console.log(headerXml.substring(0, 1000));

console.log('--- FOOTER XML ---');
console.log(footerXml.substring(0, 1000));

console.log('--- SEARCH HINDI IN DOC ---');
const hindiMatches = docXml.match(/[\u0900-\u097F]+/g);
console.log('Hindi matches found:', hindiMatches);

console.log('--- FIRST 15 PARAGRAPHS IN DOC ---');
const pMatches = [...docXml.matchAll(/<w:p[\s>].*?<\/w:p>/gs)];
pMatches.slice(0, 15).forEach((m, idx) => {
  const p = m[0];
  const text = [...p.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map(t => t[1]).join('');
  const pPr = (p.match(/<w:pPr>.*?<\/w:pPr>/s) || [''])[0];
  console.log(`[P ${idx}] text="${text}"`);
  if (p.includes('Page') || p.includes('PAGE') || p.includes('fld')) {
    console.log(`   [Field in P ${idx}]:`, p.substring(0, 500));
  }
});

console.log('--- FIRST TABLE IN DOC ---');
const tblMatch = docXml.match(/<w:tbl[\s>].*?<\/w:tbl>/s);
if (tblMatch) {
  const tbl = tblMatch[0];
  console.log('Table found, length:', tbl.length);
  // Check shading in table cells
  const shdMatches = [...tbl.matchAll(/<w:shd[^>]*>/g)];
  console.log('Shading tags in table:', shdMatches.map(m => m[0]));
  // Check tr count
  const trMatches = [...tbl.matchAll(/<w:tr[\s>].*?<\/w:tr>/gs)];
  console.log('Row count:', trMatches.length);
  trMatches.slice(0, 3).forEach((tr, rIdx) => {
    const cells = [...tr[0].matchAll(/<w:tc[\s>].*?<\/w:tc>/gs)];
    console.log(` Row ${rIdx} (${cells.length} cells):`);
    cells.forEach((c, cIdx) => {
      const tcText = [...c[0].matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map(t => t[1]).join('');
      const tcPr = (c[0].match(/<w:tcPr>.*?<\/w:tcPr>/s) || [''])[0];
      console.log(`   Cell ${cIdx}: "${tcText}", tcPr: ${tcPr}`);
    });
  });
}
