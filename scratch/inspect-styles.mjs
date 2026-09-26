import fs from 'fs';

const stylesXml = fs.readFileSync('d:/pdf/scratch/word_styles.xml', 'utf-8');

// Match styles
const styleMatches = stylesXml.matchAll(/<w:style\b[^>]*w:styleId="([^"]*)"[\s\S]*?<\/w:style>/g);
for (const sm of styleMatches) {
  const id = sm[1];
  const body = sm[0];
  const name = body.match(/<w:name[^>]*w:val="([^"]*)"/)?.[1] || '';
  const sz = body.match(/<w:sz[^>]*w:val="([^"]*)"/)?.[1];
  const color = body.match(/<w:color[^>]*w:val="([^"]*)"/)?.[1];
  const b = body.includes('<w:b/>') || body.includes('<w:b ');
  const spacing = body.match(/<w:spacing[^>]*\/>/)?.[0] || '';
  const rFonts = body.match(/<w:rFonts[^>]*\/>/)?.[0] || '';
  const ind = body.match(/<w:ind[^>]*\/>/)?.[0] || '';
  console.log(`Style "${id}" (name: "${name}"): sz=${sz ? sz/2 : 'inherit'}, color=${color || 'inherit'}, bold=${b}, spacing=${spacing}, ind=${ind}, fonts=${rFonts}`);
}

// Check docDefaults
const docDefaults = stylesXml.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/)?.[0];
console.log('\nDocDefaults:', docDefaults);
