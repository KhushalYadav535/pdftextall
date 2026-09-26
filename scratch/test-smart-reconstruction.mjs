import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import fs from 'fs'

async function run() {
  const data = new Uint8Array(fs.readFileSync('src/output/anuragsy.pdf'))
  const doc = await pdfjs.getDocument({ data }).promise

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    const items = tc.items
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({
        str: it.str.trim(),
        x: Math.round(it.transform[4]),
        y: Math.round(it.transform[5]),
        w: Math.round(it.width || 0),
        h: Math.round(it.height || 10)
      }))

    const lMap = {}
    for (const it of items) {
      let foundY = Object.keys(lMap).find((ly) => Math.abs(Number(ly) - it.y) <= 4)
      if (!foundY) {
        foundY = it.y
        lMap[foundY] = []
      }
      lMap[foundY].push(it)
    }

    console.log(`\n=== PAGE ${p} ===`)
    Object.keys(lMap)
      .map(Number)
      .sort((a, b) => b - a)
      .forEach((y) => {
        const lineItems = lMap[y].sort((a, b) => a.x - b.x)
        let reconstructed = ''
        for (let i = 0; i < lineItems.length; i++) {
          const curr = lineItems[i]
          if (i === 0) {
            reconstructed += curr.str
          } else {
            const prev = lineItems[i - 1]
            const gap = curr.x - (prev.x + prev.w)
            const prevEndsWithOpen = /[\(\[\{“"']$/.test(prev.str)
            const currStartsWithClose = /^[\)\]\}”"',\.\?!;:]/.test(curr.str)
            const isSplitWord =
              (prev.str === 'Ass' && curr.str === 'ociate') ||
              (prev.str === 'As' && curr.str === 'sistant') ||
              (prev.str === '4' && curr.str === '70228') ||
              (prev.str === 'Mr' && curr.str === '.') ||
              (prev.str.endsWith('0621PY24') && curr.str.startsWith('MP23'))

            if (prevEndsWithOpen || currStartsWithClose || isSplitWord || gap < 2) {
              reconstructed += curr.str
            } else {
              reconstructed += ' ' + curr.str
            }
          }
        }
        console.log(`  [Y=${y}] ${reconstructed}`)
      })
  }
}

run()
