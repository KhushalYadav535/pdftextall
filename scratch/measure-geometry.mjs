import fs from 'fs'
import path from 'path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

globalThis.pdfjsLib = pdfjsLib
const { convertPdfToDocx, convertDocxToPdf } = await import('../src/lib/iloveEngine.js')

async function measureGeometry() {
  const origPdfBytes = fs.readFileSync('scratch/test-docs/test-invoice.pdf')
  
  // Convert original PDF -> DOCX -> roundtrip PDF
  const { docxBlob } = await convertPdfToDocx(origPdfBytes.buffer)
  const docxBuf = Buffer.from(await docxBlob.arrayBuffer())
  const { pdfBytes: rtPdfBytes } = await convertDocxToPdf(docxBuf)

  // Load both in pdfjs
  const origDoc = await pdfjsLib.getDocument({ data: new Uint8Array(origPdfBytes), useSystemFonts: true }).promise
  const origPage = await origDoc.getPage(1)
  const origContent = await origPage.getTextContent()

  const rtDoc = await pdfjsLib.getDocument({ data: new Uint8Array(rtPdfBytes), useSystemFonts: true }).promise
  const rtPage = await rtDoc.getPage(1)
  const rtContent = await rtPage.getTextContent()

  const origItems = origContent.items.filter(i => i.str && i.str.trim()).map(it => ({
    str: it.str.trim(),
    x: Math.round(it.transform[4]),
    y: Math.round(it.transform[5]),
    w: Math.round(it.width),
    h: Math.round(it.height)
  }))

  const rtItems = rtContent.items.filter(i => i.str && i.str.trim()).map(it => ({
    str: it.str.trim(),
    x: Math.round(it.transform[4]),
    y: Math.round(it.transform[5]),
    w: Math.round(it.width),
    h: Math.round(it.height)
  }))

  console.log(`Original items: ${origItems.length}, Roundtrip items: ${rtItems.length}`)

  // Find matches and calculate displacements
  const matched = []
  const usedRtIdx = new Set()

  for (const o of origItems) {
    let bestIdx = -1
    let bestScore = Infinity
    for (let rIdx = 0; rIdx < rtItems.length; rIdx++) {
      if (usedRtIdx.has(rIdx)) continue
      const r = rtItems[rIdx]
      // Check if text matches or contains
      const cleanO = o.str.toLowerCase().replace(/[^a-z0-9]/g, '')
      const cleanR = r.str.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (cleanO === cleanR || cleanR.includes(cleanO) || cleanO.includes(cleanR)) {
        const dx = Math.abs(o.x - r.x)
        const dy = Math.abs(o.y - r.y)
        const score = dx + dy * 2
        if (score < bestScore) {
          bestScore = score
          bestIdx = rIdx
        }
      }
    }

    if (bestIdx !== -1 && bestScore < 120) {
      usedRtIdx.add(bestIdx)
      const r = rtItems[bestIdx]
      matched.push({
        origStr: o.str,
        rtStr: r.str,
        origX: o.x,
        rtX: r.x,
        dx: r.x - o.x,
        origY: o.y,
        rtY: r.y,
        dy: r.y - o.y,
        origW: o.w,
        rtW: r.w,
        dw: r.w - o.w
      })
    }
  }

  const dxValues = matched.map(m => Math.abs(m.dx))
  const dyValues = matched.map(m => Math.abs(m.dy))

  const meanDx = Math.round((dxValues.reduce((a, b) => a + b, 0) / dxValues.length) * 10) / 10
  const meanDy = Math.round((dyValues.reduce((a, b) => a + b, 0) / dyValues.length) * 10) / 10

  console.log('\n=== VISUAL GEOMETRY & DISPLACEMENT REPORT ===')
  console.log(`Matched Items: ${matched.length} of ${origItems.length}`)
  console.log(`Mean Horizontal Displacement (Δx): ${meanDx} pt`)
  console.log(`Mean Vertical / Baseline Displacement (Δy): ${meanDy} pt`)
  console.log(`\nSample Item Alignments:`)
  matched.slice(0, 10).forEach(m => {
    console.log(`  "${m.origStr}": (x: ${m.origX} -> ${m.rtX}, Δx: ${m.dx}pt) | (y: ${m.origY} -> ${m.rtY}, Δy: ${m.dy}pt)`)
  })

  // Save report
  const geoReport = {
    totalOriginalItems: origItems.length,
    totalRoundtripItems: rtItems.length,
    matchedItemsCount: matched.length,
    meanHorizontalDisplacementPt: meanDx,
    meanVerticalDisplacementPt: meanDy,
    matchedSample: matched
  }
  fs.writeFileSync('scratch/diff-reports/geometry-report.json', JSON.stringify(geoReport, null, 2))
  console.log('\nGeometry report saved to: scratch/diff-reports/geometry-report.json')
}

measureGeometry().catch(console.error)
