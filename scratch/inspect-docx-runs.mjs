import * as jszip from 'jszip'
import fs from 'fs'

async function run() {
  const zip = await jszip.default.loadAsync(fs.readFileSync('scratch/test_out.docx'))
  const xml = await zip.file('word/document.xml').async('string')
  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || []

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

run()
