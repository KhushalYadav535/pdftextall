import fs from 'node:fs'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

// Let's test the table detection and paragraph merging algorithms on anuragsy.pdf
async function testAlgorithm() {
  const buf = fs.readFileSync('src/output/anuragsy.pdf')
  const task = pdfjsLib.getDocument({ data: new Uint8Array(buf) })
  const pdf = await task.promise

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.0 })
    const tc = await page.getTextContent()

    // Extract items
    const allItems = (tc.items || [])
      .filter(it => it.str && it.str.trim())
      .map(it => {
        const fontSize = Math.round(it.height || Math.abs(it.transform?.[0]) || 10)
        return {
          str: it.str,
          x: Math.round(it.transform[4] * 10) / 10,
          y: Math.round(it.transform[5] * 10) / 10,
          w: Math.round((it.width || it.str.length * fontSize * 0.5) * 10) / 10,
          h: fontSize,
          bold: /bold|black|heavy|semibold/i.test(it.fontName || ''),
        }
      })

    // Group items into lines
    const lMap = {}
    for (const it of allItems) {
      const y = it.y
      let foundY = Object.keys(lMap).find(ly => Math.abs(Number(ly) - y) <= 4)
      if (!foundY) {
        foundY = y
        lMap[foundY] = []
      }
      lMap[foundY].push(it)
    }

    const lines = Object.keys(lMap).map(Number).sort((a, b) => b - a).map(y => {
      const lineItems = lMap[y].sort((a, b) => a.x - b.x)
      return {
        y,
        items: lineItems,
        startX: lineItems[0].x,
        endX: lineItems[lineItems.length - 1].x + lineItems[lineItems.length - 1].w,
        fullText: lineItems.map(it => it.str).join(' ').trim(),
        fontSize: lineItems[0].h
      }
    }).filter(l => l.fullText.length > 0)

    console.log(`\n================ PAGE ${pageNum} (${lines.length} raw lines) ================`)

    // Test Table Detection
    // A true table must have:
    // 1. Explicit vector lines (drawnLines), OR
    // 2. A borderless table:
    //    - At least 2 or 3 rows
    //    - Consistent column boundaries across rows (each row has >= 2 columns separated by a true gutter >= 24pt)
    //    - Columns align vertically across rows within tolerance (+/- 12pt)
    //    - The lines are NOT continuous prose sentences
    
    function isProseLine(line) {
      const text = line.fullText.trim()
      // Ends with lowercase word, preposition, comma, or continuation
      if (/[,\-–—\(\/]$/.test(text)) return true
      if (/\b(the|and|of|in|for|by|with|that|entitled|is|to|on|at|from|an|a|as|or|this|his|her|during)\s*$/i.test(text)) return true
      if (/^([a-z]|study\b|inference\b|supervision\b|award\b|curriculum\b|marketed\b|requirement\b|examiner\b)/.test(text)) return true
      return false
    }

    // Identify candidate tables
    let i = 0
    while (i < lines.length) {
      const line = lines[i]

      // Check if this line has 2 or more columns separated by a significant gutter (>= 24pt)
      const cols = []
      let curCol = [line.items[0]]
      for (let k = 1; k < line.items.length; k++) {
        const prev = line.items[k - 1]
        const curr = line.items[k]
        const gap = curr.x - (prev.x + prev.w)
        if (gap >= 24) {
          cols.push(curCol)
          curCol = [curr]
        } else {
          curCol.push(curr)
        }
      }
      cols.push(curCol)

      // Only candidate table row if cols.length >= 2 and NOT prose
      if (cols.length >= 2 && !isProseLine(line)) {
        // Look ahead for matching rows with aligned columns
        const tblRows = [{ line, cols }]
        let j = i + 1
        while (j < lines.length) {
          const nextL = lines[j]
          if (isProseLine(nextL)) break

          const nextCols = []
          let nextCurCol = [nextL.items[0]]
          for (let k = 1; k < nextL.items.length; k++) {
            const prev = nextL.items[k - 1]
            const curr = nextL.items[k]
            const gap = curr.x - (prev.x + prev.w)
            if (gap >= 24) {
              nextCols.push(nextCurCol)
              nextCurCol = [curr]
            } else {
              nextCurCol.push(curr)
            }
          }
          nextCols.push(nextCurCol)

          // Check if columns align with previous row (first col start, last col start)
          if (nextCols.length >= 2) {
            const col1Diff = Math.abs(nextCols[0][0].x - cols[0][0].x)
            const col2Diff = Math.abs(nextCols[1][0].x - cols[1][0].x)
            if (col1Diff <= 25 || col2Diff <= 25) {
              tblRows.push({ line: nextL, cols: nextCols })
              j++
              continue
            }
          }
          break
        }

        if (tblRows.length >= 2) {
          // Check if this is a 2-column signature / meta block
          const isSignatureBlock = tblRows.every(r => r.cols.length === 2 && (r.cols[1][0].x - (r.cols[0][r.cols[0].length - 1].x + r.cols[0][r.cols[0].length - 1].w)) >= 80)
          if (isSignatureBlock) {
            console.log(`[2-Column Signature Block (${tblRows.length} rows)] at Y=${line.y}:`)
            tblRows.forEach(r => console.log(`  Col1: "${r.cols[0].map(it => it.str).join(' ')}" | Col2: "${r.cols[1].map(it => it.str).join(' ')}"`))
          } else {
            console.log(`[Table (${tblRows.length} rows, ${cols.length} cols)] at Y=${line.y}`)
          }
          i = j
          continue
        }
      }

      // Paragraph Collection test
      const paraLines = [line]
      let nextI = i + 1
      while (nextI < lines.length) {
        const nextL = lines[nextI]
        const yDiff = Math.abs(lines[nextI - 1].y - nextL.y)
        const maxAllowedYDiff = Math.max(26, Math.round(line.fontSize * 2.2))

        // Check if nextL continues the paragraph:
        // 1. yDiff is within paragraph line spacing
        // 2. Either same startX (+/- 15pt), OR line ends with prose continuation, OR both are centered
        const prevText = lines[nextI - 1].fullText.trim()
        const isPrevProse = isProseLine(lines[nextI - 1])
        const sameStartX = Math.abs(nextL.startX - line.startX) <= 15
        const isCentered = Math.abs((line.startX + line.endX) / 2 - (viewport.width / 2)) <= 35 &&
                           Math.abs((nextL.startX + nextL.endX) / 2 - (viewport.width / 2)) <= 35

        if (yDiff <= maxAllowedYDiff && (sameStartX || isPrevProse || (isCentered && yDiff <= 28))) {
          paraLines.push(nextL)
          nextI++
        } else {
          break
        }
      }

      const mergedText = paraLines.map(l => l.fullText).join(' ')
      console.log(`[Paragraph (${paraLines.length} lines, startX=${line.startX.toFixed(0)})]: "${mergedText.slice(0, 100)}${mergedText.length > 100 ? '...' : ''}"`)
      i = nextI
    }
  }
}

testAlgorithm().catch(console.error)
