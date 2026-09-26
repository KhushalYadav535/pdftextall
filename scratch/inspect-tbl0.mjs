import fs from 'fs';
import JSZip from 'jszip';

async function main() {
  const zip = await JSZip.loadAsync(fs.readFileSync('d:/pdf/scratch/perfect-jajriti.docx'));
  const xml = await zip.file('word/document.xml').async('string');
  const tbl0 = xml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/)?.[0];
  const rows = tbl0.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
  console.log('Table 0 rows:', rows.length);
  rows.forEach((r, idx) => {
    const cells = [...r.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map(c => {
      return [...c[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('');
    });
    console.log(`Row ${idx} (${cells.length} cells): ${cells.join(' | ')}`);
  });
}

main().catch(console.error);
