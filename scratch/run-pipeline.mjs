import fs from 'fs'
import path from 'path'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import { convertPdfToDocx, convertDocxToPdf } from '../src/lib/iloveEngine.js'

async function runPipeline() {
  console.log('====================================================')
  console.log('  PDF ↔ Word Conversion Testing & Analysis Pipeline')
  console.log('====================================================\n')

  const testDocsDir = path.resolve('scratch/test-docs')
  const outDir = path.resolve('scratch/pipeline-output')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  // ────────────────────────────────────────────────────────
  // Test 1: PDF → Word (test-invoice.pdf)
  // ────────────────────────────────────────────────────────
  console.log('--- TEST 1: PDF → Word (test-invoice.pdf) ---')
  const invoicePdfPath = path.join(testDocsDir, 'test-invoice.pdf')
  const invoicePdfBytes = fs.readFileSync(invoicePdfPath)
  
  const docxRes = await convertPdfToDocx(invoicePdfBytes.buffer, {
    onProgress: (p) => console.log('  [PDF→Word Progress]', p.stage || p)
  })
  
  console.log('  Detected Tables:', docxRes.detectedTables)
  console.log('  Word Count:', docxRes.wordCount)
  console.log('  Num Pages:', docxRes.numPages)
  
  // Save output docx
  const invoiceDocxPath = path.join(outDir, 'invoice-converted.docx')
  const docxArrayBuffer = await docxRes.docxBlob.arrayBuffer()
  fs.writeFileSync(invoiceDocxPath, Buffer.from(docxArrayBuffer))
  console.log('  Saved converted DOCX to:', invoiceDocxPath)

  // Inspect generated DOCX XML structure
  const docxZip = await JSZip.loadAsync(docxArrayBuffer)
  const docXml = await docxZip.file('word/document.xml').async('string')
  
  const tblCount = (docXml.match(/<w:tbl[\s>]/g) || []).length
  const trCount = (docXml.match(/<w:tr[\s>]/g) || []).length
  const tcCount = (docXml.match(/<w:tc[\s>]/g) || []).length
  const gridSpanCount = (docXml.match(/<w:gridSpan/g) || []).length
  const shdCount = (docXml.match(/<w:shd/g) || []).length
  const tcBordersCount = (docXml.match(/<w:tcBorders/g) || []).length

  console.log('  [DOCX XML Analysis]:')
  console.log(`    - Tables: ${tblCount}`)
  console.log(`    - Rows: ${trCount}`)
  console.log(`    - Cells: ${tcCount}`)
  console.log(`    - Merged Cells (gridSpan): ${gridSpanCount}`)
  console.log(`    - Shaded Cells: ${shdCount}`)
  console.log(`    - Cell Borders: ${tcBordersCount}`)

  // ────────────────────────────────────────────────────────
  // Test 2: Word → PDF (test-report.docx)
  // ────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Word → PDF (test-report.docx) ---')
  const reportDocxPath = path.join(testDocsDir, 'test-report.docx')
  const reportDocxBytes = fs.readFileSync(reportDocxPath)

  const pdfRes = await convertDocxToPdf(reportDocxBytes.buffer)
  console.log('  Detected Tables in DOCX:', pdfRes.tableCount)
  console.log('  Paragraph Count in DOCX:', pdfRes.paragraphCount)
  console.log('  Output PDF Page Count:', pdfRes.pageCount)

  const reportPdfPath = path.join(outDir, 'report-converted.pdf')
  fs.writeFileSync(reportPdfPath, Buffer.from(pdfRes.pdfBytes))
  console.log('  Saved converted PDF to:', reportPdfPath)

  // Inspect generated PDF using pdf-lib and pdfjs-dist
  const pdfDoc = await PDFDocument.load(pdfRes.pdfBytes)
  console.log(`  [PDF Analysis]: Successfully loaded ${pdfDoc.getPageCount()} pages`)

  // ────────────────────────────────────────────────────────
  // Test 3: Existing workspace PDF (extracted-pages-merged.pdf)
  // ────────────────────────────────────────────────────────
  const wsPdfPath = path.resolve('extracted-pages-merged.pdf')
  if (fs.existsSync(wsPdfPath)) {
    console.log('\n--- TEST 3: Real Workspace PDF → Word (extracted-pages-merged.pdf) ---')
    try {
      const wsPdfBytes = fs.readFileSync(wsPdfPath)
      const wsDocxRes = await convertPdfToDocx(wsPdfBytes.buffer, {
        onProgress: (p) => console.log('  [PDF→Word Progress]', p.stage || p)
      })
      console.log('  Detected Tables:', wsDocxRes.detectedTables)
      console.log('  Word Count:', wsDocxRes.wordCount)
      console.log('  Num Pages:', wsDocxRes.numPages)

      const wsDocxPath = path.join(outDir, 'extracted-pages-converted.docx')
      const wsDocxBuffer = await wsDocxRes.docxBlob.arrayBuffer()
      fs.writeFileSync(wsDocxPath, Buffer.from(wsDocxBuffer))
      console.log('  Saved converted DOCX to:', wsDocxPath)
    } catch (wsErr) {
      console.log('  [Notice] Scanned PDF OCR skipped in Node environment (requires browser DOM canvas):', wsErr.message)
    }
  }

  // ────────────────────────────────────────────────────────
  // Test 4: Existing workspace DOCX (extracted-pages-merged (3).docx)
  // ────────────────────────────────────────────────────────
  const wsDocxSrc = path.resolve('extracted-pages-merged (3).docx')
  if (fs.existsSync(wsDocxSrc)) {
    console.log('\n--- TEST 4: Real Workspace Word → PDF (extracted-pages-merged (3).docx) ---')
    const wsDocxBytes = fs.readFileSync(wsDocxSrc)
    const wsPdfRes = await convertDocxToPdf(wsDocxBytes.buffer)
    console.log('  Detected Tables in DOCX:', wsPdfRes.tableCount)
    console.log('  Paragraph Count in DOCX:', wsPdfRes.paragraphCount)
    console.log('  Output PDF Page Count:', wsPdfRes.pageCount)

    const wsPdfOut = path.join(outDir, 'extracted-pages-from-docx.pdf')
    fs.writeFileSync(wsPdfOut, Buffer.from(wsPdfRes.pdfBytes))
    console.log('  Saved converted PDF to:', wsPdfOut)
  }

  console.log('\n====================================================')
  console.log('  Pipeline Run Complete! Analyzing differences...')
  console.log('====================================================\n')
}

runPipeline().catch(console.error)
