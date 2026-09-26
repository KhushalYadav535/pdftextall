import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function compare() {
  const docXml = fs.readFileSync('d:/pdf/scratch/sahbhagi-doc.xml', 'utf8');
  // Extract all text from docx
  const docxWords = docXml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .split(/\s+/)
    .filter(w => w.length > 1);

  const pdfData = new Uint8Array(fs.readFileSync('C:/Users/khush/Downloads/Sahbhagi_PRD_v1.pdf'));
  const doc = await pdfjsLib.getDocument({ data: pdfData }).promise;
  console.log('PDF pages:', doc.numPages);
  
  let pdfText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pdfText += ' ' + tc.items.map(it => it.str).join(' ');
  }

  const pdfWords = pdfText.split(/\s+/).filter(w => w.length > 1);
  console.log(`Docx words: ${docxWords.length}, PDF words: ${pdfWords.length}`);

  // Check how many docx words are found in PDF
  let matched = 0;
  let missing = [];
  const pdfTextLower = pdfText.toLowerCase();
  for (const w of docxWords) {
    if (pdfTextLower.includes(w.toLowerCase())) {
      matched++;
    } else {
      if (!missing.includes(w)) missing.push(w);
    }
  }

  console.log(`Word match: ${matched} / ${docxWords.length} (${((matched / docxWords.length) * 100).toFixed(1)}%)`);
  console.log('Sample missing words:', missing.slice(0, 30));
}

compare().catch(console.error);
