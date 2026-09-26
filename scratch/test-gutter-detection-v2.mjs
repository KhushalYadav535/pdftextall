import fs from 'fs'
import * as pdfjsLib from 'pdfjs-dist'

async function testGutterV2() {
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

  // Filter out headers/footers
  const headerThreshold = viewport.height - 35
  const footerThreshold = 35
  const bodyItems = allItems.filter(it => it.y < headerThreshold && it.y > footerThreshold)

  // Step 1: Detect lines grouped by Y (tolerance 4pt)
  const lineMap = {}
  for (const it of bodyItems) {
    const y = it.y
    let foundY = Object.keys(lineMap).find((ly) => Math.abs(Number(ly) - y) <= 4)
    if (!foundY) {
      foundY = y
      lineMap[foundY] = []
    }
    lineMap[foundY].push(it)
  }

  // Step 2: Check which lines have multi-column characteristics (multiple items separated by wide gap)
  // A wide gap between columns is typically >= 25pt, and each column has substantial width
  const multiColLines = []
  for (const y of Object.keys(lineMap)) {
    const items = lineMap[y].sort((a, b) => a.x - b.x)
    for (let k = 1; k < items.length; k++) {
      const gap = items[k].x - (items[k - 1].x + items[k - 1].w)
      if (gap >= 25 && items[k - 1].w >= 60 && items[k].w >= 60) {
        multiColLines.push({
          y: Number(y),
          gutterLeft: items[k - 1].x + items[k - 1].w,
          gutterRight: items[k].x,
          gap
        })
      }
    }
  }

  console.log(`Found ${multiColLines.length} lines with column gap >= 25pt:`)
  for (const m of multiColLines) {
    console.log(`- y=${m.y}: gap=${m.gap}pt [${m.gutterLeft} .. ${m.gutterRight}]`)
  }

  if (multiColLines.length >= 2) {
    // We have a multi-column block!
    const colTopY = Math.max(...multiColLines.map(m => m.y))
    const colBottomY = Math.min(...multiColLines.map(m => m.y))
    const gutterLeft = Math.max(...multiColLines.map(m => m.gutterLeft))
    const gutterRight = Math.min(...multiColLines.map(m => m.gutterRight))
    const gutterCenter = (gutterLeft + gutterRight) / 2

    console.log(`\nDetected 2-Column Block from y=${colBottomY} to y=${colTopY}`)
    console.log(`Gutter Center: ${gutterCenter} (Left boundary: ${gutterLeft}, Right boundary: ${gutterRight})`)

    // Now partition items in this Y-band:
    const colBandItems = bodyItems.filter(it => it.y >= colBottomY - 4 && it.y <= colTopY + 4)
    const col1Items = colBandItems.filter(it => it.x + it.w <= gutterCenter)
    const col2Items = colBandItems.filter(it => it.x >= gutterCenter)

    console.log(`\n=== Left Column Text (Read First) ===`)
    const col1Lines = {}
    for (const it of col1Items) {
      const y = it.y
      let foundY = Object.keys(col1Lines).find((ly) => Math.abs(Number(ly) - y) <= 4)
      if (!foundY) { foundY = y; col1Lines[foundY] = []; }
      col1Lines[foundY].push(it)
    }
    const col1SortedY = Object.keys(col1Lines).map(Number).sort((a, b) => b - a)
    for (const y of col1SortedY) {
      console.log(' ', col1Lines[y].sort((a, b) => a.x - b.x).map(it => it.str).join(' '))
    }

    console.log(`\n=== Right Column Text (Read Second) ===`)
    const col2Lines = {}
    for (const it of col2Items) {
      const y = it.y
      let foundY = Object.keys(col2Lines).find((ly) => Math.abs(Number(ly) - y) <= 4)
      if (!foundY) { foundY = y; col2Lines[foundY] = []; }
      col2Lines[foundY].push(it)
    }
    const col2SortedY = Object.keys(col2Lines).map(Number).sort((a, b) => b - a)
    for (const y of col2SortedY) {
      console.log(' ', col2Lines[y].sort((a, b) => a.x - b.x).map(it => it.str).join(' '))
    }
  }
}

testGutterV2().catch(console.error)
