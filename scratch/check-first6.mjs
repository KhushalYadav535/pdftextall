import fs from 'fs';

const xml = fs.readFileSync('d:/pdf/scratch/gaurav-doc.xml', 'utf8');
const pMatches = [...xml.matchAll(/<w:p[\s>].*?<\/w:p>/gs)];

for (let idx = 0; idx <= 6; idx++) {
  const p = pMatches[idx][0];
  const text = [...p.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/gs)].map(t => t[1]).join('');
  const pPr = (p.match(/<w:pPr>.*?<\/w:pPr>/s) || [''])[0];
  console.log(`=== [P ${idx}] ===`);
  console.log(`Text: "${text}"`);
  console.log(`pPr: ${pPr}`);
  const runs = [...p.matchAll(/<w:r[\s>].*?<\/w:r>/gs)];
  runs.forEach((r, rIdx) => {
    console.log(`   Run ${rIdx}: ${r[0]}`);
  });
}
