import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import fs from 'fs'

async function run() {
  const data = new Uint8Array(fs.readFileSync('src/output/anuragsy.pdf'))
  const doc = await pdfjs.getDocument({ data }).promise

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    const opList = await page.getOperatorList()

    const textColors = []
    let curColor = '000000'
    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i]
      const args = opList.argsArray[i]
      if (fn === pdfjs.OPS.setFillRGBColor) {
        const r = Math.round(args[0] <= 1 ? args[0] * 255 : args[0])
        const g = Math.round(args[1] <= 1 ? args[1] * 255 : args[1])
        const b = Math.round(args[2] <= 1 ? args[2] * 255 : args[2])
        curColor = [r, g, b]
          .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase()
      } else if (fn === pdfjs.OPS.setFillGray) {
        const val = Math.round(args[0] <= 1 ? args[0] * 255 : args[0])
        const h = Math.max(0, Math.min(255, val)).toString(16).padStart(2, '0').toUpperCase()
        curColor = h + h + h
      } else if (fn === pdfjs.OPS.showText || fn === pdfjs.OPS.showSpacedText) {
        let str = ''
        if (fn === pdfjs.OPS.showText) {
          str = (args[0] || [])
            .map((g) => g?.unicode || g?.char || (typeof g === 'string' ? g : ''))
            .join('')
        } else if (fn === pdfjs.OPS.showSpacedText) {
          str = (args[0] || [])
            .map((g) => (typeof g === 'string' ? g : g?.unicode || g?.char || ''))
            .join('')
        }
        str = str.trim()
        if (str) {
          const isWhite = curColor === 'FFFFFF' || curColor === 'FEFEFE'
          textColors.push({ str, color: isWhite ? '000000' : curColor })
        }
      }
    }

    const items = tc.items.filter((it) => it.str && it.str.trim())
    let colorCursor = 0
    console.log(`\n=== PAGE ${p} COLOR MATCHING ===`)

    items.forEach((it, idx) => {
      const itTrim = it.str.trim()
      let itemColor = '000000'

      // Sequential match
      for (let tcIdx = colorCursor; tcIdx < textColors.length; tcIdx++) {
        const tc = textColors[tcIdx]
        if (tc.str === itTrim) {
          itemColor = tc.color
          colorCursor = tcIdx + 1
          break
        }
        if (tc.str.includes(itTrim)) {
          itemColor = tc.color
          colorCursor = tcIdx
          break
        }
      }

      // Fallback: search from beginning if not found
      if (itemColor === '000000') {
        const exact = textColors.find((tc) => tc.str === itTrim)
        if (exact) {
          itemColor = exact.color
        } else {
          const contains = textColors.find((tc) => tc.str.includes(itTrim) && itTrim.length >= 3)
          if (contains) itemColor = contains.color
        }
      }

      console.log(`  ${idx}: [#${itemColor}] ${JSON.stringify(itTrim)}`)
    })
  }
}

run()
