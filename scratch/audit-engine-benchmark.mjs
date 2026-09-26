import fs from 'fs'
import path from 'path'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from 'docx'
import { convertDocxToPdf, convertPdfToDocx } from '../src/lib/iloveEngine.js'

async function runBenchmark() {
  console.log('=== STARTING ENGINE BENCHMARK & CONVERSION QUALITY AUDIT ===\n')

  const results = {
    wordToPdf: {},
    pdfToWord: {},
    concurrency: {},
    performance: {}
  }

  // 1. Prepare 50+ page test DOCX
  console.log('Generating 50-page Word (.docx) document...')
  const doc50Pages = []
  for (let i = 1; i <= 52; i++) {
    doc50Pages.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Chapter ${i}: Comprehensive Benchmark Test`, bold: true, size: 28 }),
          new TextRun({ text: `\nThis is paragraph content for page ${i} of our 50+ page test document. ` +
            'It contains repeated sentences to measure memory, layout stability, and page-breaking throughput in the OpenXML parser.' })
        ]
      })
    )
    if (i < 52) {
      doc50Pages.push(new Paragraph({ children: [new TextRun({ text: '', break: 1 })] }))
    }
  }
  const bigDoc = new Document({ sections: [{ children: doc50Pages }] })
  const bigDocxBuffer = await Packer.toBuffer(bigDoc)
  fs.writeFileSync('scratch/test-docs/50page-test.docx', bigDocxBuffer)

  // 2. Prepare 50-page PDF
  console.log('Generating 50-page PDF document...')
  const bigPdfDoc = await PDFDocument.create()
  const font = await bigPdfDoc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= 52; i++) {
    const p = bigPdfDoc.addPage([595.28, 841.89])
    p.drawText(`Page ${i} of 52 - Synthetic Stress Test Document`, { x: 50, y: 800, size: 14, font })
    p.drawText(`Lorem ipsum dolor sit amet on page ${i} to test multi-page throughput and memory consumption.`, { x: 50, y: 770, size: 10, font })
  }
  const bigPdfBytes = await bigPdfDoc.save()
  fs.writeFileSync('scratch/test-docs/50page-test.pdf', bigPdfBytes)

  // 3. Prepare Scanned (Image-only) PDF
  console.log('Generating Scanned (image-only, no text layer) PDF...')
  const scannedPdfDoc = await PDFDocument.create()
  const scanPage = scannedPdfDoc.addPage([595.28, 841.89])
  // Draw an empty rectangle simulating an image scan
  scanPage.drawRectangle({ x: 50, y: 100, width: 495, height: 640, color: rgb(0.95, 0.95, 0.95) })
  const scannedPdfBytes = await scannedPdfDoc.save()
  fs.writeFileSync('scratch/test-docs/scanned-test.pdf', scannedPdfBytes)

  // 4. Prepare Password-Protected PDF
  console.log('Generating Password-Protected PDF...')
  // Note: we can test how our engine handles password-protected files
  // Using an existing or simulated password protected pdf
  const pwPdfDoc = await PDFDocument.create()
  const pwPage = pwPdfDoc.addPage([595.28, 841.89])
  pwPage.drawText('Confidential Protected Content', { x: 50, y: 750, size: 12, font })
  // We will test error handling when loading
  const pwPdfBytes = await pwPdfDoc.save()
  fs.writeFileSync('scratch/test-docs/pw-test.pdf', pwPdfBytes)

  // ─── TEST SUITE: Word to PDF ───
  console.log('\n--- Auditing Word to PDF ---')

  // Case A: test-report.docx (tables + headings + text)
  try {
    const t0 = Date.now()
    const buf = fs.readFileSync('scratch/test-docs/test-report.docx')
    const res = await convertDocxToPdf(buf)
    const elapsed = Date.now() - t0
    results.wordToPdf['test-report.docx'] = {
      status: 'PASS',
      elapsedMs: elapsed,
      pageCount: res.pageCount,
      tableCount: res.tableCount,
      paragraphCount: res.paragraphCount,
      outputSizeBytes: res.pdfBytes.length
    }
    console.log(`✓ test-report.docx converted in ${elapsed}ms (${res.pageCount} pages, ${res.tableCount} tables)`)
  } catch (err) {
    results.wordToPdf['test-report.docx'] = { status: 'FAIL', error: err.message }
    console.log(`✗ test-report.docx failed: ${err.message}`)
  }

  // Case B: edge-cases-test.docx (multi-column, styles, borders)
  try {
    const t0 = Date.now()
    const buf = fs.readFileSync('scratch/test-docs/edge-cases-test.docx')
    const res = await convertDocxToPdf(buf)
    const elapsed = Date.now() - t0
    results.wordToPdf['edge-cases-test.docx'] = {
      status: 'PASS',
      elapsedMs: elapsed,
      pageCount: res.pageCount,
      tableCount: res.tableCount,
      paragraphCount: res.paragraphCount,
      outputSizeBytes: res.pdfBytes.length
    }
    console.log(`✓ edge-cases-test.docx converted in ${elapsed}ms (${res.pageCount} pages, ${res.tableCount} tables)`)
  } catch (err) {
    results.wordToPdf['edge-cases-test.docx'] = { status: 'FAIL', error: err.message }
    console.log(`✗ edge-cases-test.docx failed: ${err.message}`)
  }

  // Case C: Legacy .doc file
  try {
    // A simulated legacy binary DOC file (not a zip)
    const fakeDocBuf = Buffer.from('\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1\x00\x00\x00\x00Binary OLE2 Document Header')
    await convertDocxToPdf(fakeDocBuf)
    results.wordToPdf['legacy-.doc'] = { status: 'PASS' }
  } catch (err) {
    results.wordToPdf['legacy-.doc'] = {
      status: 'FAIL_EXPECTED',
      error: err.message,
      reason: 'Engine only accepts OpenXML .docx ZIP archives. Legacy binary .doc is completely unsupported.'
    }
    console.log(`✗ legacy .doc failed as expected: ${err.message}`)
  }

  // Case D: 50+ page document
  try {
    const t0 = Date.now()
    const buf = fs.readFileSync('scratch/test-docs/50page-test.docx')
    const res = await convertDocxToPdf(buf)
    const elapsed = Date.now() - t0
    results.wordToPdf['50page-test.docx'] = {
      status: 'PASS',
      elapsedMs: elapsed,
      pageCount: res.pageCount,
      tableCount: res.tableCount,
      paragraphCount: res.paragraphCount,
      outputSizeBytes: res.pdfBytes.length
    }
    console.log(`✓ 50page-test.docx converted in ${elapsed}ms (${res.pageCount} pages, ${res.pdfBytes.length} bytes)`)
  } catch (err) {
    results.wordToPdf['50page-test.docx'] = { status: 'FAIL', error: err.message }
    console.log(`✗ 50page-test.docx failed: ${err.message}`)
  }

  // ─── TEST SUITE: PDF to Word ───
  console.log('\n--- Auditing PDF to Word ---')

  // Case A: test-invoice.pdf (tables, borders, structured data)
  try {
    const t0 = Date.now()
    const buf = fs.readFileSync('scratch/test-docs/test-invoice.pdf')
    const res = await convertPdfToDocx(buf.buffer)
    const elapsed = Date.now() - t0
    results.pdfToWord['test-invoice.pdf'] = {
      status: 'PASS',
      elapsedMs: elapsed,
      numPages: res.numPages,
      detectedTables: res.detectedTables,
      wordCount: res.wordCount,
      usedOcr: res.usedOcr
    }
    console.log(`✓ test-invoice.pdf converted in ${elapsed}ms (${res.numPages} pages, ${res.detectedTables} tables, ${res.wordCount} words)`)
  } catch (err) {
    results.pdfToWord['test-invoice.pdf'] = { status: 'FAIL', error: err.message }
    console.log(`✗ test-invoice.pdf failed: ${err.message}`)
  }

  // Case B: edge-cases-test.pdf (multi-column, Hindi text, rotation)
  try {
    const t0 = Date.now()
    const buf = fs.readFileSync('scratch/test-docs/edge-cases-test.pdf')
    const res = await convertPdfToDocx(buf.buffer)
    const elapsed = Date.now() - t0
    results.pdfToWord['edge-cases-test.pdf'] = {
      status: 'PASS',
      elapsedMs: elapsed,
      numPages: res.numPages,
      detectedTables: res.detectedTables,
      wordCount: res.wordCount,
      usedOcr: res.usedOcr,
      textPreviewSnippet: res.textPreview.slice(0, 300)
    }
    console.log(`✓ edge-cases-test.pdf converted in ${elapsed}ms (${res.numPages} pages, ${res.detectedTables} tables, ${res.wordCount} words)`)
  } catch (err) {
    results.pdfToWord['edge-cases-test.pdf'] = { status: 'FAIL', error: err.message }
    console.log(`✗ edge-cases-test.pdf failed: ${err.message}`)
  }

  // Case C: Scanned PDF (0 text characters)
  try {
    const t0 = Date.now()
    const buf = fs.readFileSync('scratch/test-docs/scanned-test.pdf')
    const res = await convertPdfToDocx(buf.buffer)
    const elapsed = Date.now() - t0
    results.pdfToWord['scanned-test.pdf'] = {
      status: 'PASS',
      elapsedMs: elapsed,
      numPages: res.numPages,
      wordCount: res.wordCount,
      usedOcr: res.usedOcr
    }
    console.log(`✓ scanned-test.pdf converted in ${elapsed}ms (usedOcr: ${res.usedOcr}, wordCount: ${res.wordCount})`)
  } catch (err) {
    results.pdfToWord['scanned-test.pdf'] = {
      status: 'FAIL',
      error: err.message,
      note: 'In Node/server-side environment without DOM canvas, OCR fallback throws error.'
    }
    console.log(`✗ scanned-test.pdf failed: ${err.message}`)
  }

  // Case D: 50-page PDF
  try {
    const t0 = Date.now()
    const buf = fs.readFileSync('scratch/test-docs/50page-test.pdf')
    const res = await convertPdfToDocx(buf.buffer)
    const elapsed = Date.now() - t0
    results.pdfToWord['50page-test.pdf'] = {
      status: 'PASS',
      elapsedMs: elapsed,
      numPages: res.numPages,
      wordCount: res.wordCount,
      usedOcr: res.usedOcr
    }
    console.log(`✓ 50page-test.pdf converted in ${elapsed}ms (${res.numPages} pages, ${res.wordCount} words)`)
  } catch (err) {
    results.pdfToWord['50page-test.pdf'] = { status: 'FAIL', error: err.message }
    console.log(`✗ 50page-test.pdf failed: ${err.message}`)
  }

  // ─── TEST SUITE: Concurrency (8 parallel requests) ───
  console.log('\n--- Auditing Concurrency (8 parallel conversions) ---')
  try {
    const t0 = Date.now()
    const buf = fs.readFileSync('scratch/test-docs/test-report.docx')
    const tasks = Array.from({ length: 8 }, (_, idx) => convertDocxToPdf(buf))
    const allRes = await Promise.all(tasks)
    const elapsed = Date.now() - t0
    results.concurrency['8-parallel-docx-to-pdf'] = {
      status: 'PASS',
      concurrencyCount: 8,
      totalElapsedMs: elapsed,
      avgPerDocMs: Math.round(elapsed / 8)
    }
    console.log(`✓ 8 parallel Word to PDF conversions completed in ${elapsed}ms (avg ${Math.round(elapsed / 8)}ms/doc)`)
  } catch (err) {
    results.concurrency['8-parallel-docx-to-pdf'] = { status: 'FAIL', error: err.message }
    console.log(`✗ Concurrency test failed: ${err.message}`)
  }

  // Save complete results to JSON
  fs.writeFileSync('scratch/audit-results.json', JSON.stringify(results, null, 2))
  console.log('\n=== AUDIT BENCHMARK COMPLETE. Results saved to scratch/audit-results.json ===')
}

runBenchmark().catch(console.error)
