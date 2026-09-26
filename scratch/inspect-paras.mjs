import fs from 'fs';

const docXml = fs.readFileSync('d:/pdf/scratch/sahbhagi-doc.xml', 'utf-8');

// Match all paragraphs and tables in order
const pOrTblRegex = /<(w:p|w:tbl)\b[\s\S]*?<\/\1>/g;
let match;
let index = 0;

const items = [];
while ((match = pOrTblRegex.exec(docXml)) !== null) {
  const type = match[1];
  const xml = match[0];
  if (type === 'w:p') {
    // extract style, text, spacing, pBdr, br
    const pStyle = xml.match(/<w:pStyle[^>]*w:val="([^"]*)"/)?.[1] || '';
    const jc = xml.match(/<w:jc[^>]*w:val="([^"]*)"/)?.[1] || '';
    const spacing = xml.match(/<w:spacing[^>]*\/>/)?.[0] || '';
    const hasPageBr = xml.includes('w:type="page"');
    const texts = [];
    const tMatches = xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
    for (const tm of tMatches) {
      texts.push(tm[1]);
    }
    const text = texts.join('');
    items.push({ type: 'p', pStyle, jc, spacing, hasPageBr, text: text.slice(0, 80), fullLen: text.length });
  } else {
    // tbl
    const rows = xml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
    items.push({ type: 'tbl', rowCount: rows.length });
  }
}

console.log(`Total elements: ${items.length}`);
items.slice(0, 35).forEach((it, i) => {
  if (it.type === 'p') {
    console.log(`[${i}] P (${it.pStyle || 'Normal'}, jc=${it.jc || 'left'}, ${it.spacing}): "${it.text}" ${it.hasPageBr ? '[PAGE BREAK]' : ''}`);
  } else {
    console.log(`[${i}] TBL with ${it.rowCount} rows`);
  }
});
