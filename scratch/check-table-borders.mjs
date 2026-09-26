import fs from 'node:fs'
import JSZip from 'jszip'

async function check() {
  const docxBuf = fs.readFileSync('src/output/anuragsy.docx')
  const zip = await JSZip.loadAsync(docxBuf)
  const docXml = await zip.file('word/document.xml').async('text')
  const tbls = docXml.match(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g) || []
  console.log('Tables found in anuragsy.docx:', tbls.length)
  tbls.forEach((tbl, idx) => {
    const borders = tbl.match(/<w:tcBorders>([\s\S]*?)<\/w:tcBorders>/)
    console.log(`Table ${idx + 1} tcBorders sample:`, borders ? borders[1] : 'none')
  })
}

check().catch(console.error)
