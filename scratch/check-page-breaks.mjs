import fs from 'fs';

const docXml = fs.readFileSync('d:/pdf/scratch/sahbhagi-doc.xml', 'utf-8');

// Let's trace all elements and their properties
const pOrTblRegex = /<(w:p|w:tbl)\b[\s\S]*?<\/\1>/g;
let match;
let elIndex = 0;

const elements = [];
while ((match = pOrTblRegex.exec(docXml)) !== null) {
  const type = match[1];
  const xml = match[0];
  if (type === 'w:p') {
    const pStyle = xml.match(/<w:pStyle[^>]*w:val="([^"]*)"/)?.[1] || 'Normal';
    const jc = xml.match(/<w:jc[^>]*w:val="([^"]*)"/)?.[1] || 'left';
    const sBefore = Number(xml.match(/<w:spacing[^>]*w:before="([^"]*)"/)?.[1] || 0) / 20;
    const sAfter = Number(xml.match(/<w:spacing[^>]*w:after="([^"]*)"/)?.[1] || 0) / 20;
    const hasPageBr = xml.includes('w:type="page"');
    const hasKeepNext = xml.includes('<w:keepNext');
    
    // Extract runs
    const rMatches = xml.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g);
    let runs = [];
    for (const rm of rMatches) {
      const rXml = rm[0];
      const sz = rXml.match(/<w:sz[^>]*w:val="([^"]*)"/)?.[1];
      const clr = rXml.match(/<w:color[^>]*w:val="([^"]*)"/)?.[1];
      const b = rXml.includes('<w:b/>') || rXml.includes('<w:b ');
      const i = rXml.includes('<w:i/>') || rXml.includes('<w:i ');
      const t = Array.from(rXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)).map(m => m[1]).join('');
      if (t) {
        runs.push({ text: t, sz: sz ? Number(sz)/2 : undefined, clr, b, i });
      }
    }
    const fullText = runs.map(r => r.text).join('');
    elements.push({
      type: 'p',
      index: elIndex++,
      pStyle,
      jc,
      sBefore,
      sAfter,
      hasPageBr,
      hasKeepNext,
      runs,
      text: fullText
    });
  } else {
    // tbl
    const rows = xml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
    const tblW = xml.match(/<w:tblW[^>]*w:w="([^"]*)"/)?.[1];
    elements.push({
      type: 'tbl',
      index: elIndex++,
      tblW: tblW ? Number(tblW)/20 : 450,
      rowCount: rows.length
    });
  }
}

console.log(`Parsed ${elements.length} elements.`);
// Print page break points
elements.forEach((el) => {
  if (el.hasPageBr) {
    console.log(`Explicit PageBreak at element ${el.index}: "${el.text.slice(0, 40)}"`);
  }
});
