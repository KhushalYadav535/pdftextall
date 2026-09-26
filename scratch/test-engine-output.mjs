import fs from 'fs';
import JSZip from 'jszip';
import { convertPdfToDocx } from '../src/lib/iloveEngine.js';

async function test() {
  const filePath = 'C:/Users/khush/Downloads/JajritiYatra-Content.pdf';
  const buffer = fs.readFileSync(filePath);

  console.log('Running convertPdfToDocx from src/lib/iloveEngine.js...');
  const res = await convertPdfToDocx(buffer);
  console.log('Conversion result:', {
    pageCount: res.pageCount,
    tableCount: res.tableCount,
    wordCount: res.wordCount,
  });

  const docxBuffer = Buffer.from(await res.docxBlob.arrayBuffer());
  const zip = await JSZip.loadAsync(docxBuffer);
  const xml = await zip.file('word/document.xml').async('string');

  // Check tables
  const tblMatches = [...xml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g)];
  console.log(`Found ${tblMatches.length} tables in output document.`);

  tblMatches.forEach((tm, tIdx) => {
    const tblXml = tm[0];
    const rows = tblXml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
    console.log(`\nTable ${tIdx}: ${rows.length} rows`);
    rows.slice(0, 3).forEach((r, rIdx) => {
      const cells = [];
      const cMatches = r.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g);
      for (const cm of cMatches) {
        const text = [...cm[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('');
        cells.push(text);
      }
      console.log(`  Row ${rIdx} (${cells.length} cells): ${cells.join(' | ')}`);
    });
  });

  // Check borders
  const pBdrMatches = [...xml.matchAll(/<w:pBdr>[\s\S]*?<\/w:pBdr>/g)];
  console.log(`\nFound ${pBdrMatches.length} paragraphs with borders (divider lines)!`);
}

test().catch(console.error);
