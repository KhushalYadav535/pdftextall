import fs from 'fs'
import * as pdfjsLib from 'pdfjs-dist'

async function testColumnSorting() {
  const buf = fs.readFileSync('scratch/test-docs/edge-cases-test.pdf')
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 1.0 })
  const textContent = await page.getTextContent()

  const allItems = textContent.items
    .filter((it) => it.str && it.str.trim())
    .map((it) => {
      const x = Math.round(it.transform?.[4] || 0)
      const y = Math.round(it.transform?.[5] || 0)
      const w = Math.round(it.width || (it.str.length * 5))
      const h = Math.round(it.height || 10)
      return { str: it.str, x, y, w, h }
    })

  const headerThreshold = viewport.height - 35
  const footerThreshold = 35
  const bodyItems = allItems.filter(it => it.y < headerThreshold && it.y > footerThreshold)

  // 1. Initial line grouping by Y
  const initialLineMap = {}
  for (const it of bodyItems) {
    const y = it.y
    let foundY = Object.keys(initialLineMap).find((ly) => Math.abs(Number(ly) - y) <= 4)
    if (!foundY) {
      foundY = y
      initialLineMap[foundY] = []
    }
    initialLineMap[foundY].push(it)
  }

  // 2. Identify candidate multi-column lines (not tables, wide text segments on both sides)
  const colLines = []
  for (const y of Object.keys(initialLineMap)) {
    const items = initialLineMap[y].sort((a, b) => a.x - b.x)
    for (let k = 1; k < items.length; k++) {
      const prev = items[k - 1]
      const curr = items[k]
      const gap = curr.x - (prev.x + prev.w)
      // Check if both sides have significant text width (>= 80pt) and gap >= 25pt
      if (gap >= 25 && prev.w >= 80 && curr.w >= 80) {
        colLines.push({
          y: Number(y),
          gutterLeft: prev.x + prev.w,
          gutterRight: curr.x,
          gap
        })
      }
    }
  }

  let finalLines = []

  if (colLines.length >= 2) {
    const colTopY = Math.max(...colLines.map(l => l.y))
    const gutterLeft = Math.max(...colLines.map(l => l.gutterLeft))
    const gutterRight = Math.min(...colLines.map(l => l.gutterRight))
    const gutterCenter = (gutterLeft + gutterRight) / 2

    const maxX = Math.max(...bodyItems.map(it => it.x + it.w))
    // Find where the 2-column text ends (before next table or section)
    let colBottomY = Math.min(...colLines.map(l => l.y))
    const sortedAllY = Object.keys(initialLineMap).map(Number).sort((a, b) => b - a)

    for (const y of sortedAllY) {
      if (y < colTopY) {
        const lineItems = initialLineMap[y].sort((a, b) => a.x - b.x)
        // Check if this line is part of a 3+ column table
        let numGaps = 0
        for (let k = 1; k < lineItems.length; k++) {
          if (lineItems[k].x - (lineItems[k - 1].x + lineItems[k - 1].w) >= 15) {
            numGaps++
          }
        }
        if (numGaps >= 2) {
          // 3+ columns detected! This is a table or columnar grid, so stop 2-column block
          break
        }

        // Check if every item is either strictly in col1 or strictly in col2
        const isColLine = lineItems.every(it => it.x + it.w <= gutterCenter + 10 || it.x >= gutterCenter - 10)
        if (isColLine) {
          colBottomY = Math.min(colBottomY, y)
        } else {
          // Spanning line -> stop column block
          break
        }
      }
    }

    console.log(`Detected 2-Column Block: y=${colBottomY}..${colTopY}, gutter=[${gutterLeft}..${gutterRight}], center=${gutterCenter}`)

    const preColItems = bodyItems.filter(it => it.y > colTopY + 4)
    const postColItems = bodyItems.filter(it => it.y < colBottomY - 4)
    const inColItems = bodyItems.filter(it => it.y >= colBottomY - 4 && it.y <= colTopY + 4)

    const col1Items = inColItems.filter(it => it.x + it.w <= gutterCenter)
    const col2Items = inColItems.filter(it => it.x >= gutterCenter)
    const spanItems = inColItems.filter(it => it.x < gutterCenter && it.x + it.w > gutterCenter)

    function groupItemsToLines(items) {
      const lMap = {}
      for (const it of items) {
        const y = it.y
        let foundY = Object.keys(lMap).find((ly) => Math.abs(Number(ly) - y) <= 4)
        if (!foundY) {
          foundY = y
          lMap[foundY] = []
        }
        lMap[foundY].push(it)
      }
      return Object.keys(lMap).map(Number).sort((a, b) => b - a).map((y) => {
        const lineItems = lMap[y].sort((a, b) => a.x - b.x)
        return {
          y,
          items: lineItems,
          startX: lineItems[0].x,
          endX: lineItems[lineItems.length - 1].x + lineItems[lineItems.length - 1].w,
          fullText: lineItems.map((it) => it.str).join(' ').trim()
        }
      }).filter((l) => l.fullText.length > 0)
    }

    // 1. Pre-column lines
    finalLines.push(...groupItemsToLines(preColItems))
    // 2. Left column lines
    finalLines.push(...groupItemsToLines(col1Items))
    // 3. Right column lines
    finalLines.push(...groupItemsToLines(col2Items))
    // 4. Any mid-span items
    finalLines.push(...groupItemsToLines(spanItems))
    // 5. Post-column lines (tables, bottom sections)
    finalLines.push(...groupItemsToLines(postColItems))
  }

  console.log('\n=== FINAL RESTRUCTURED READING ORDER ===')
  finalLines.forEach((l, idx) => {
    console.log(`${(idx + 1).toString().padStart(2)}. (y=${l.y}, x=${l.startX}) ${l.fullText}`)
  })
}

testColumnSorting().catch(console.error)
