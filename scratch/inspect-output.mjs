import fs from 'fs'
import path from 'path'
import * as pdfjsLib from 'pdfjs-dist'
import JSZip from 'jszip'

async function inspectOutputs() {
  console.log('--- Inspecting report-converted.pdf ---')
  const pdfPath = path.resolve('scratch/test-output/report-converted.pdf')
  const pdfBytes = fs.readFileSync(pdfPath)
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise
  const page = await doc.getPage(1)
  const textContent = await page.getTextContent()

  console.log(`Extracted ${textContent.items.length} text items:`)
  textContent.items.forEach((it) => {
    console.log(`  [x: ${Math.round(it.transform[4])}, y: ${Math.round(it.transform[5])}] "${it.str}"`)
  })

  console.log('\n--- Inspecting extracted-pages-merged (3).docx ---')
  const docxPath = path.resolve('extracted-pages-merged (3).docx')
  const docxBytes = fs.readFileSync(docxPath)
  const zip = await JSZip.loadAsync(docxBytes)
  console.log('Files in DOCX:')
  Object.keys(zip.files).forEach(f => console.log('  ', f))

  const docXml = await zip.file('word/document.xml')?.async('string')
  if (docXml) {
    console.log('Sample word/document.xml snippet:')
    console.log(docXml.slice(0, 1000))
  }
}

inspectOutputs().catch(console.error)
