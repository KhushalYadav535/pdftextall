import fs from 'fs';
import JSZip from 'jszip';

async function analyzeAll() {
  const buf = fs.readFileSync('C:/Users/khush/Downloads/Sahbhagi_PRD_v1.docx');
  const zip = await JSZip.loadAsync(buf);
  const docXml = await zip.file('word/document.xml').async('string');
  const stylesXml = await zip.file('word/styles.xml').async('string');
  
  console.log('--- STYLES IN SAHBHAGI ---');
  // Parse all style elements
  const styleRegex = /<w:style\b[^>]*w:styleId="([^"]*)"[\s\S]*?<\/w:style>/g;
  let m;
  const styles = {};
  while ((m = styleRegex.exec(stylesXml)) !== null) {
    const id = m[1];
    const sXml = m[0];
    const name = sXml.match(/<w:name[^>]*w:val="([^"]*)"/)?.[1] || '';
    const sz = sXml.match(/<w:sz[^>]*w:val="([^"]*)"/)?.[1];
    const color = sXml.match(/<w:color[^>]*w:val="([^"]*)"/)?.[1];
    const b = sXml.includes('<w:b/>') || sXml.includes('<w:b ');
    const i = sXml.includes('<w:i/>') || sXml.includes('<w:i ');
    const spacingBefore = sXml.match(/<w:spacing[^>]*w:before="([^"]*)"/)?.[1];
    const spacingAfter = sXml.match(/<w:spacing[^>]*w:after="([^"]*)"/)?.[1];
    const indLeft = sXml.match(/<w:ind[^>]*w:left="([^"]*)"/)?.[1];
    const indHanging = sXml.match(/<w:ind[^>]*w:hanging="([^"]*)"/)?.[1];
    
    styles[id] = {
      name,
      sz: sz ? Number(sz) / 2 : undefined,
      color,
      b,
      i,
      spacingBefore: spacingBefore ? Number(spacingBefore) / 20 : undefined,
      spacingAfter: spacingAfter ? Number(spacingAfter) / 20 : undefined,
      indLeft: indLeft ? Number(indLeft) / 20 : undefined,
      indHanging: indHanging ? Number(indHanging) / 20 : undefined
    };
  }
  
  console.log(JSON.stringify(styles, null, 2));
}

analyzeAll().catch(console.error);
