import fs from 'node:fs'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

async function testColorAndLayout() {
  const buf = fs.readFileSync('src/output/anuragsy.pdf')
  const task = pdfjsLib.getDocument({ data: new Uint8Array(buf) })
  const pdf = await task.promise

  for (let pageNum = 1; pageNum <= 2; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const tc = await page.getTextContent()
    const opList = await page.getOperatorList()

    // 1. Text color extraction
    const textColors = []
    let curColorHex = '000000'

    for (let opIdx = 0; opIdx < opList.fnArray.length; opIdx++) {
      const fn = opList.fnArray[opIdx]
      const args = opList.argsArray[opIdx]

      if (fn === pdfjsLib.OPS.setFillRGBColor) {
        const r = args[0] <= 1 && args[1] <= 1 && args[2] <= 1 && (args[0] > 0 || args[1] > 0 || args[2] > 0)
          ? Math.round(args[0] * 255)
          : Math.round(args[0])
        const g = args[0] <= 1 && args[1] <= 1 && args[2] <= 1 && (args[0] > 0 || args[1] > 0 || args[2] > 0)
          ? Math.round(args[1] * 255)
          : Math.round(args[1])
        const b = args[0] <= 1 && args[1] <= 1 && args[2] <= 1 && (args[0] > 0 || args[1] > 0 || args[2] > 0)
          ? Math.round(args[2] * 255)
          : Math.round(args[2])
        curColorHex = [r, g, b].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('').toUpperCase()
      } else if (fn === pdfjsLib.OPS.setFillGray) {
        const val = args[0] <= 1 ? Math.round(args[0] * 255) : Math.round(args[0])
        const h = Math.max(0, Math.min(255, val)).toString(16).padStart(2, '0').toUpperCase()
        curColorHex = h + h + h
      } else if (fn === pdfjsLib.OPS.showText || fn === pdfjsLib.OPS.showSpacedText) {
        let str = ''
        if (fn === pdfjsLib.OPS.showText) {
          str = (args[0] || []).map((g) => g?.unicode || g?.char || (typeof g === 'string' ? g : '')).join('')
        } else if (fn === pdfjsLib.OPS.showSpacedText) {
          str = (args[0] || []).map((g) => (typeof g === 'string' ? g : (g?.unicode || g?.char || ''))).join('')
        }
        str = str.trim()
        if (str) {
          const isWhite = curColorHex === 'FFFFFF' || curColorHex === 'FEFEFE'
          textColors.push({ str, color: isWhite ? '000000' : curColorHex })
        }
      }
    }

    console.log(`\n=== PAGE ${pageNum} COLORS ===`)
    let colorCursor = 0
    for (const it of tc.items) {
      const itTrim = (it.str || '').trim()
      if (!itTrim) continue
      let itemColor = '000000'

      for (let tcIdx = colorCursor; tcIdx < textColors.length; tcIdx++) {
        const tc = textColors[tcIdx]
        if (!tc.str) continue
        if (tc.str === itTrim) {
          itemColor = tc.color
          colorCursor = tcIdx + 1
          break
        }
        if (itTrim.length >= 3 && (tc.str.includes(itTrim) || itTrim.includes(tc.str))) {
          itemColor = tc.color
          colorCursor = tcIdx
          break
        }
      }
      if (itemColor === '000000') {
        const fallbackMatch = textColors.find((tc) =>
          tc.str === itTrim || (itTrim.length >= 3 && tc.str.length >= 3 && (tc.str.includes(itTrim) || itTrim.includes(tc.str)))
        )
        if (fallbackMatch) itemColor = fallbackMatch.color
      }

      console.log(`  "${itTrim}" -> #${itemColor}`)
    }
  }
}

testColorAndLayout().catch(console.error)
