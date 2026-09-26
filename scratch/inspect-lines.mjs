import fs from 'node:fs'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

async function inspectLines() {
  const buf = fs.readFileSync('src/output/anuragsy.pdf')
  const task = pdfjsLib.getDocument({ data: new Uint8Array(buf) })
  const doc = await task.promise

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    console.log(`\n=== PAGE ${p} ===`)
    
    // Group into lines by Y
    const lineMap = {}
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue
      const y = Math.round(it.transform[5] * 10) / 10
      let foundY = Object.keys(lineMap).find(ly => Math.abs(Number(ly) - y) <= 4)
      if (!foundY) {
        foundY = y
        lineMap[foundY] = []
      }
      lineMap[foundY].push(it)
    }

    const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a)
    for (let i = 0; i < sortedYs.length; i++) {
      const y = sortedYs[i]
      const items = lineMap[y].sort((a, b) => a.transform[4] - b.transform[4])
      const lineText = items.map(it => it.str).join(' ').trim()
      const prevY = i > 0 ? sortedYs[i - 1] : null
      const yDiff = prevY !== null ? (prevY - y).toFixed(1) : '0'
      const startX = items[0].transform[4].toFixed(1)
      const endX = (items[items.length - 1].transform[4] + items[items.length - 1].width).toFixed(1)
      const fontSize = items[0].height.toFixed(1)
      console.log(`[Y=${y.toFixed(1)} dy=${yDiff} X=${startX}..${endX} fs=${fontSize}] ${lineText}`)
    }
  }
}

inspectLines().catch(console.error)
