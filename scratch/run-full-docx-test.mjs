import { convertPdfToDocx } from '../src/lib/iloveEngine.js'
import * as jszip from 'jszip'
import fs from 'fs'

async function run() {
  const buffer = fs.readFileSync('src/output/anuragsy.pdf')
  console.log('Starting conversion of anuragsy.pdf...')
  const res = await convertPdfToDocx(buffer.buffer)
  const docxBytes = Buffer.from(await res.docxBlob.arrayBuffer())

  // Overwrite src/output/anuragsy.docx with the latest perfected conversion!
  fs.writeFileSync('src/output/anuragsy.docx', docxBytes)
  console.log(`Saved ${docxBytes.length} bytes to src/output/anuragsy.docx!`)

  // Inspect the generated docx
  const zip = await jszip.default.loadAsync(docxBytes)
  const xml = await zip.file('word/document.xml').async('string')

  // Check table borders
  const tblBorders = xml.match(/<w:tblBorders[\s\S]*?<\/w:tblBorders>/g) || []
  console.log(`\nFound ${tblBorders.length} tables:`)
  tblBorders.forEach((tb, i) => console.log(`  Table ${i} borders: ${tb}`))

  // Check paragraphs and text runs
  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || []
  console.log(`\nTotal paragraphs: ${paragraphs.length}`)
  paragraphs.forEach((p, i) => {
    const runs = p.match(/<w:r[\s\S]*?<\/w:r>/g) || []
    const runInfos = runs
      .map((r) => {
        const tMatch = r.match(/<w:t[\s\S]*?>([\s\S]*?)<\/w:t>/)
        const t = tMatch ? tMatch[1] : ''
        const cMatch = r.match(/<w:color\s+w:val="([^"]+)"/)
        const c = cMatch ? cMatch[1] : '000000'
        const b = /<w:b\/>|<w:b\s+w:val="true"/.test(r)
        return { t, c, b }
      })
      .filter((r) => r.t.trim())

    if (runInfos.length > 0) {
      console.log(
        `P${i}: ` +
          runInfos
            .map((r) => `[#${r.c}${r.b ? ',B' : ''}] ${JSON.stringify(r.t)}`)
            .join(' ')
      )
    }
  })
}

run().catch((err) => {
  console.error('Conversion failed:', err)
  process.exit(1)
})
