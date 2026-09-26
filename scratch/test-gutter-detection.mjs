import fs from 'fs'
import * as pdfjsLib from 'pdfjs-dist'

async function testGutterDetection() {
  console.log('Testing column gutter detection on edge-cases-test.pdf...')
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

  console.log(`Page 1 has ${allItems.length} text items.`)

  // Filter out page header and footer
  const headerThreshold = viewport.height - 35
  const footerThreshold = 35
  const bodyItems = allItems.filter(it => it.y < headerThreshold && it.y > footerThreshold)

  const minX = Math.min(...bodyItems.map(it => it.x))
  const maxX = Math.max(...bodyItems.map(it => it.x + it.w))
  const spanW = maxX - minX

  console.log(`Body items span X: ${minX} to ${maxX} (width = ${spanW}pt)`)

  // Analyze potential vertical gutters between 30% and 70% of span
  const binSize = 2
  const startBin = Math.floor(minX)
  const endBin = Math.ceil(maxX)
  const numBins = Math.ceil((endBin - startBin) / binSize)
  const occupancy = new Int32Array(numBins)

  // Only consider items in the middle Y region (where columns might be)
  for (const it of bodyItems) {
    const b0 = Math.max(0, Math.floor((it.x - startBin) / binSize))
    const b1 = Math.min(numBins - 1, Math.floor((it.x + it.w - startBin) / binSize))
    for (let b = b0; b <= b1; b++) {
      occupancy[b]++
    }
  }

  // Find longest zero or near-zero run in 30%..70% of span
  const searchStart = Math.floor(numBins * 0.25)
  const searchEnd = Math.floor(numBins * 0.75)

  let bestGutterStart = -1
  let bestGutterLen = 0
  let curGutterStart = -1
  let curGutterLen = 0

  for (let b = searchStart; b <= searchEnd; b++) {
    if (occupancy[b] === 0) {
      if (curGutterStart === -1) curGutterStart = b
      curGutterLen++
      if (curGutterLen > bestGutterLen) {
        bestGutterLen = curGutterLen
        bestGutterStart = curGutterStart
      }
    } else {
      curGutterStart = -1
      curGutterLen = 0
    }
  }

  const gutterWidthPt = bestGutterLen * binSize
  const gutterXStart = startBin + bestGutterStart * binSize
  const gutterXEnd = gutterXStart + gutterWidthPt
  const gutterCenter = (gutterXStart + gutterXEnd) / 2

  console.log(`Gutter detected: [${gutterXStart}, ${gutterXEnd}] (width = ${gutterWidthPt}pt, center = ${gutterCenter})`)

  if (gutterWidthPt >= 18) {
    console.log('✓ Multi-column layout confirmed with gutter width >= 18pt!')

    // Partition items into:
    // 1. col1: strictly left of gutterCenter
    // 2. col2: strictly right of gutterCenter
    // 3. span: items crossing gutterCenter (e.g. title, wide tables)
    const col1 = []
    const col2 = []
    const span = []

    for (const it of bodyItems) {
      if (it.x + it.w <= gutterCenter + 5) {
        col1.push(it)
      } else if (it.x >= gutterCenter - 5) {
        col2.push(it)
      } else {
        span.push(it)
      }
    }

    console.log(`Col1 items: ${col1.length}, Col2 items: ${col2.length}, Spanning items: ${span.length}`)

    // Find vertical bounds of columns
    const colTopY = Math.max(...col1.concat(col2).map(it => it.y))
    const colBottomY = Math.min(...col1.concat(col2).map(it => it.y))

    const preCol = span.filter(it => it.y > colTopY - 5)
    const postCol = span.filter(it => it.y < colBottomY + 5)
    const midSpan = span.filter(it => it.y <= colTopY - 5 && it.y >= colBottomY + 5)

    console.log(`Pre-column items: ${preCol.map(it => it.str).join(' ')}`)
    console.log(`\nCol 1 (Left) reading order:`)
    const col1Y = [...new Set(col1.map(it => it.y))].sort((a, b) => b - a)
    for (const y of col1Y) {
      const line = col1.filter(it => it.y === y).sort((a, b) => a.x - b.x).map(it => it.str).join(' ')
      console.log(`  ${line}`)
    }

    console.log(`\nCol 2 (Right) reading order:`)
    const col2Y = [...new Set(col2.map(it => it.y))].sort((a, b) => b - a)
    for (const y of col2Y) {
      const line = col2.filter(it => it.y === y).sort((a, b) => a.x - b.x).map(it => it.str).join(' ')
      console.log(`  ${line}`)
    }

    console.log(`\nPost-column items: ${postCol.map(it => it.str).join(' ')}`)
  }
}

testGutterDetection().catch(console.error)
