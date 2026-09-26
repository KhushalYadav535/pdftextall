import fs from 'fs';
import JSZip from 'jszip';

async function checkNumbering() {
  const buf = fs.readFileSync('C:/Users/khush/Downloads/Sahbhagi_PRD_v1.docx');
  const zip = await JSZip.loadAsync(buf);
  const numXml = await zip.file('word/numbering.xml').async('string');
  
  const numMatches = numXml.matchAll(/<w:num\b[^>]*w:numId="([^"]*)"[\s\S]*?<\/w:num>/g);
  for (const nm of numMatches) {
    console.log('Num:', nm[0]);
  }
  
  const abstractMatches = numXml.matchAll(/<w:abstractNum\b[^>]*w:abstractNumId="([^"]*)"[\s\S]*?<\/w:abstractNum>/g);
  for (const am of abstractMatches) {
    const lvlMatches = am[0].matchAll(/<w:lvl\b[^>]*w:ilvl="([^"]*)"[\s\S]*?<\/w:lvl>/g);
    for (const lm of lvlMatches) {
      const ilvl = lm[1];
      const numFmt = lm[0].match(/<w:numFmt[^>]*w:val="([^"]*)"/)?.[1];
      const lvlText = lm[0].match(/<w:lvlText[^>]*w:val="([^"]*)"/)?.[1];
      const indLeft = lm[0].match(/<w:ind[^>]*w:left="([^"]*)"/)?.[1];
      const indHanging = lm[0].match(/<w:ind[^>]*w:hanging="([^"]*)"/)?.[1];
      console.log(`AbstractNum ${am[1]} lvl ${ilvl}: numFmt=${numFmt}, lvlText=${lvlText}, indLeft=${indLeft ? indLeft/20 : ''}, hanging=${indHanging ? indHanging/20 : ''}`);
    }
  }
}

checkNumbering().catch(console.error);
