import fs from 'fs'
import * as pdfjsLib from 'pdfjs-dist'

async function inspectItems() {
  const buf = fs.readFileSync('scratch/test-docs/edge-cases-test.pdf')
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
  const page = await doc.getPage(1)
  const textContent = await page.getTextContent()

  const items = textContent.items
    .filter((it) => it.str && it.str.trim())
    .map((it) => {
      const x = Math.round(it.transform?.[4] || 0)
      const y = Math.round(it.transform?.[5] || 0)
      const w = Math.round(it.width || (it.str.length * 5))
      const h = Math.round(it.height || 10)
      return { str: it.str, x, y, w, h }
    })

  console.log('All items on page 1:')
  for (const it of items) {
    console.log(`x=${it.x.toString().padStart(3)}, y=${it.y.toString().padStart(3)}, w=${it.w.toString().padStart(3)} | ${it.str}`)
  }
}

inspectItems().catch(console.error)
