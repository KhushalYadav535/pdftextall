import fs from 'fs';

const docXml = fs.readFileSync('d:/pdf/scratch/sahbhagi-doc.xml', 'utf-8');
const stylesXml = fs.existsSync('d:/pdf/scratch/word_styles.xml') ? fs.readFileSync('d:/pdf/scratch/word_styles.xml', 'utf-8') : '';

console.log('DocXml length:', docXml.length);

// Check pgSz, pgMar
const pgSzMatch = docXml.match(/<w:pgSz[^>]*>/g);
console.log('pgSz:', pgSzMatch);
const pgMarMatch = docXml.match(/<w:pgMar[^>]*>/g);
console.log('pgMar:', pgMarMatch);

// Check tblGrid
const tblGrids = docXml.match(/<w:tblGrid[\s\S]*?<\/w:tblGrid>/g);
console.log('Found tblGrids count:', tblGrids?.length);
if (tblGrids) {
  tblGrids.forEach((g, idx) => console.log(`Table ${idx} grid:`, g));
}

// Check first table properties
const tblPrs = docXml.match(/<w:tblPr[\s\S]*?<\/w:tblPr>/g);
if (tblPrs) {
  tblPrs.forEach((tp, idx) => console.log(`Table ${idx} tblPr:`, tp));
}

// Check keepNext or pageBreakBefore
const keepNexts = docXml.match(/<w:keepNext[^>]*>/g);
console.log('keepNext count:', keepNexts?.length);
const pbb = docXml.match(/<w:pageBreakBefore[^>]*>/g);
console.log('pageBreakBefore count:', pbb?.length);

// Check br type="page"
const pageBrs = docXml.match(/<w:br[^>]*w:type="page"[^>]*>/g);
console.log('page br count:', pageBrs?.length);

// Check default line spacing and font size in stylesXml or docXml
const defaultSz = stylesXml.match(/<w:sz[^>]*>/g);
console.log('Styles sz:', defaultSz?.slice(0, 10));
const defaultSpacing = stylesXml.match(/<w:spacing[^>]*>/g);
console.log('Styles spacing:', defaultSpacing?.slice(0, 10));
