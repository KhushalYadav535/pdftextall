import fs from 'fs';
import JSZip from 'jszip';

async function extract() {
  const buffer = fs.readFileSync('C:/Users/khush/Downloads/Sahbhagi_PRD_v1.docx');
  const zip = await JSZip.loadAsync(buffer);
  
  const files = Object.keys(zip.files);
  console.log('Files in docx:', files);
  
  const docXml = await zip.file('word/document.xml').async('string');
  fs.writeFileSync('d:/pdf/scratch/sahbhagi-doc.xml', docXml);
  console.log('Saved document.xml, length:', docXml.length);

  for (const f of files) {
    if (f.startsWith('word/header') || f.startsWith('word/footer') || f.startsWith('word/styles')) {
      const content = await zip.file(f).async('string');
      const safeName = f.replace(/[\/\\]/g, '_');
      fs.writeFileSync(`d:/pdf/scratch/${safeName}`, content);
      console.log(`Saved ${f} as ${safeName}`);
    }
  }
}

extract().catch(console.error);
