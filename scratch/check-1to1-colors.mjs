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
        if (str.trim()) {
          textColors.push({ str: str.trim(), color: curColor })
        }
      }
    }

    const items = tc.items.filter((it) => it.str && it.str.trim())
    console.log(`\n=== PAGE ${p}: textColors (${textColors.length}) vs items (${items.length}) ===`)
    for (let i = 0; i < Math.max(textColors.length, items.length); i++) {
      const op = textColors[i] ? `[#${textColors[i].color}] ${JSON.stringify(textColors[i].str)}` : 'MISSING'
      const it = items[i] ? JSON.stringify(items[i].str.trim()) : 'MISSING'
      console.log(`  ${i}: OP: ${op.padEnd(50)} | TC: ${it}`)
    }
  }
}

run()
