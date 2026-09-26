import fs from 'node:fs'
import JSZip from 'jszip'

async function inspectDocxColors() {
  const docxBuf = fs.readFileSync('scratch/test-anuragsy-fixed.docx')
  const zip = await JSZip.loadAsync(docxBuf)
  const docXml = await zip.file('word/document.xml').async('text')

  const rRegex = /<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g
  let rm
  console.log('--- Colored Text Runs in Fixed DOCX ---')
  while ((rm = rRegex.exec(docXml)) !== null) {
    const rContent = rm[1]
    const colorMatch = rContent.match(/<w:color\s+w:val="([^"]+)"/)
    const textMatch = rContent.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/)
    if (textMatch && textMatch[1].trim()) {
      const color = colorMatch ? '#' + colorMatch[1] : '#000000'
      if (color !== '#000000') {
        console.log(`[${color}] ${JSON.stringify(textMatch[1].trim())}`)
      }
    }
  }
}

inspectDocxColors().catch(console.error)
