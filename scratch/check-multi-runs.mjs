import fs from 'fs';

const xml = fs.readFileSync('d:/pdf/scratch/gaurav-doc.xml', 'utf8');
const pMatches = [...xml.matchAll(/<w:p[\s>].*?<\/w:p>/gs)];

pMatches.forEach((m, idx) => {
  const p = m[0];
  const runs = [...p.matchAll(/<w:r[\s>].*?<\/w:r>/gs)];
  if (runs.length > 1) {
    const text = p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`P ${idx} (${runs.length} runs): "${text}"`);
  }
});
