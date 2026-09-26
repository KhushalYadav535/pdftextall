import fs from 'fs';
import JSZip from 'jszip';

async function main() {
  const zip = await JSZip.loadAsync(fs.readFileSync('d:/pdf/scratch/output-jajriti.docx'));
  const xml = await zip.file('word/document.xml').async('string');
  const pCount = (xml.match(/<w:p\b/g) || []).length;
  const tblCount = (xml.match(/<w:tbl\b/g) || []).length;
  const brCount = (xml.match(/w:type="page"/g) || []).length;
  console.log('Paragraphs:', pCount);
  console.log('Tables:', tblCount);
  console.log('Page breaks:', brCount);

  // Let's inspect all tables
  const tblMatches = xml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g);
  let tIdx = 0;
  for (const tm of tblMatches) {
    const tblXml = tm[0];
    const rows = tblXml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
    console.log(`Table ${tIdx++}: ${rows.length} rows`);
    rows.slice(0, 3).forEach(r => {
      const cells = [];
      const cMatches = r.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g);
      for (const cm of cMatches) {
        const text = [...cm[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('');
        cells.push(text);
      }
      console.log('   Row:', cells.join(' | '));
    });
  }
}

main().catch(console.error);
