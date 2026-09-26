import fs from 'fs'
import path from 'path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import JSZip from 'jszip'

globalThis.pdfjsLib = pdfjsLib

const { convertPdfToDocx, convertDocxToPdf } = await import('../src/lib/iloveEngine.js')

async function diagnose() {
  const pdfBytes = fs.readFileSync('scratch/test-docs/test-invoice.pdf')
  
  // 1. Original PDF items
  const origDoc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes), useSystemFonts: true }).promise
  const origPage = await origDoc.getPage(1)
  const origContent = await origPage.getTextContent()
  
  console.log(`=== ORIGINAL INVOICE PDF (${origContent.items.length} items) ===`)
  const origItems = origContent.items.map(it => ({
    str: it.str,
    x: Math.round(it.transform[4]),
    y: Math.round(it.transform[5]),
    w: Math.round(it.width),
    h: Math.round(it.height),
    fontName: it.fontName
  }))
  
  console.log(origItems.map(i => `[x=${i.x}, y=${i.y}, w=${i.w}, h=${i.h}] "${i.str}"`).join('\n'))

  // 2. Convert to DOCX
  const { docxBlob } = await convertPdfToDocx(pdfBytes.buffer)
  const docxBuf = Buffer.from(await docxBlob.arrayBuffer())
  
  // Inspect DOCX XML
  const zip = await JSZip.loadAsync(docxBuf)
  const docXml = await zip.file('word/document.xml').async('string')
  console.log('\n=== INTERMEDIATE DOCX (word/document.xml snippet) ===')
  // Print paragraphs and table structure
  const pMatches = [...docXml.matchAll(/<w:p[\s>](.*?)<\/w:p>/gs)].map(m => m[0])
  console.log(`Found ${pMatches.length} paragraphs in DOCX`)
  pMatches.slice(0, 15).forEach((p, idx) => {
    const text = [...p.matchAll(/<w:t[^>]*>([^<]+)<\/w:t>/g)].map(m => m[1]).join('')
    console.log(`  P${idx + 1}: "${text}"`)
  })

  // 3. Convert DOCX -> Roundtrip PDF
  const { pdfBytes: rtBytes } = await convertDocxToPdf(docxBuf)
  const rtDoc = await pdfjsLib.getDocument({ data: new Uint8Array(rtBytes), useSystemFonts: true }).promise
  const rtPage = await rtDoc.getPage(1)
  const rtContent = await rtPage.getTextContent()
  
  console.log(`\n=== ROUNDTRIP PDF (${rtContent.items.length} items) ===`)
  const rtItems = rtContent.items.map(it => ({
    str: it.str,
    x: Math.round(it.transform[4]),
    y: Math.round(it.transform[5]),
    w: Math.round(it.width),
    h: Math.round(it.height)
  }))
  console.log(rtItems.map(i => `[x=${i.x}, y=${i.y}, w=${i.w}, h=${i.h}] "${i.str}"`).join('\n'))

  // 4. Token diff analysis
  const origWords = origItems.flatMap(i => i.str.split(/\s+/)).map(w => w.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean)
  const rtWords = rtItems.flatMap(i => i.str.split(/\s+/)).map(w => w.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean)
  const rtWordSet = new Set(rtWords)

  const missing = []
  const found = []
  for (const w of origWords) {
    if (rtWordSet.has(w)) {
      found.push(w)
    } else {
      missing.push(w)
    }
  }

  console.log('\n=== WORD-LEVEL RECALL ANALYSIS ===')
  console.log(`Total original words: ${origWords.length}`)
  console.log(`Found in roundtrip: ${found.length}`)
  console.log(`Missing in roundtrip: ${missing.length}`)
  if (missing.length > 0) {
    console.log(`Missing words:`, missing)
  }
  const pct = Math.round((found.length / origWords.length) * 1000) / 10
  console.log(`Measured Invoice Roundtrip Fidelity: ${pct}%`)
}

diagnose().catch(console.error)
