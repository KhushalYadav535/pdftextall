import fs from 'fs';

const xml = fs.readFileSync('d:/pdf/scratch/gaurav-doc.xml', 'utf8');

const pMatches = [...xml.matchAll(/<w:p[\s>].*?<\/w:p>/gs)];
console.log('Total paragraphs:', pMatches.length);

pMatches.forEach((m, idx) => {
  const p = m[0];
  const text = [...p.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map(t => t[1]).join('');
  const hasPBdr = p.includes('w:pBdr');
  const hasTab = p.includes('w:tab');
  const pPr = (p.match(/<w:pPr>.*?<\/w:pPr>/s) || [''])[0];
  console.log(`--- [P ${idx}] ---`);
  console.log(`Text: "${text}"`);
  console.log(`pPr: ${pPr}`);
  console.log(`hasPBdr: ${hasPBdr}, hasTab: ${hasTab}`);
  if (hasTab) {
    // print all runs in this paragraph
    const runs = [...p.matchAll(/<w:r[\s>].*?<\/w:r>/gs)];
    runs.forEach((r, rIdx) => {
      console.log(`   Run ${rIdx}: ${r[0]}`);
    });
  }
  if (p.includes('PROFILE')) {
    console.log(`   Full PROFILE P: ${p}`);
  }
});
