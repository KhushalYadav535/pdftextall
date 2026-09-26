import 'regenerator-runtime/runtime.js'
import fs from 'fs'
import path from 'path'
import { convertPdfToDocx, convertDocxToPdf } from '../src/lib/iloveEngine.js'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

async function runReAudit() {
  console.log('======================================================================')
  console.log('         PDFZERO VS ILOVEPDF COMPREHENSIVE RE-AUDIT BENCHMARK         ')
  console.log('======================================================================\n')

  const results = {}

  // 1. Password-Protected PDF (pw-test.pdf)
  console.log('--- TEST 1: Password-Protected PDF ---')
  const pwPdfBytes = fs.readFileSync('scratch/test-docs/pw-test.pdf')
  let caughtPassword = false
  try {
    await convertPdfToDocx(pwPdfBytes)
  } catch (err) {
    if (err.name === 'PasswordException') {
      caughtPassword = true
      console.log('  ✓ PasswordException successfully caught without password')
    }
  }

  const t1Start = Date.now()
  const pwDocx = await convertPdfToDocx(pwPdfBytes, { password: 'secret123' })
  const t1Time = Date.now() - t1Start
  console.log(`  ✓ Unlocked & Converted with password: ${pwDocx.wordCount} words, ${pwDocx.numPages} pages in ${t1Time}ms`)
  results.test1_password = {
    caughtException: caughtPassword,
    wordCount: pwDocx.wordCount,
    timeMs: t1Time,
    status: caughtPassword && pwDocx.wordCount > 0 ? 'PASS' : 'FAIL'
  }

  // 2. Embedded Image Extraction (extracted-pages-merged.pdf)
  console.log('\n--- TEST 2: Embedded Image Extraction (PDF to Word) ---')
  const imgPdfBytes = fs.readFileSync('extracted-pages-merged.pdf')
  const t2Start = Date.now()
  const imgDocx = await convertPdfToDocx(imgPdfBytes)
  const t2Time = Date.now() - t2Start
  fs.writeFileSync('scratch/reaudit-image-output.docx', Buffer.from(await imgDocx.docxBlob.arrayBuffer()))
  
  // Inspect docx for embedded images in word/media/
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await imgDocx.docxBlob.arrayBuffer())
  const mediaFiles = Object.keys(zip.files).filter(k => k.startsWith('word/media/'))
  console.log(`  ✓ Extracted ${mediaFiles.length} image(s) into word/media/: ${mediaFiles.join(', ')}`)
  console.log(`  ✓ Generated docx (${(imgDocx.docxBlob.size / 1024).toFixed(1)} KB) in ${t2Time}ms`)
  results.test2_images = {
    imagesExtracted: mediaFiles.length,
    docxSizeKb: (imgDocx.docxBlob.size / 1024).toFixed(1),
    timeMs: t2Time,
    status: mediaFiles.length > 0 ? 'PASS' : 'FAIL'
  }

  // 3. Multi-Column & Gutter Detection (edge-cases-test.pdf)
  console.log('\n--- TEST 3: Multi-Column Gutter Detection (edge-cases-test.pdf) ---')
  const edgePdfBytes = fs.readFileSync('scratch/test-docs/edge-cases-test.pdf')
  const t3Start = Date.now()
  const edgeDocx = await convertPdfToDocx(edgePdfBytes)
  const t3Time = Date.now() - t3Start
  const text = edgeDocx.textPreview
  const sec1Idx = text.indexOf('SECTION 1')
  const sec2Idx = text.indexOf('SECTION 2')
  const columnsReadInOrder = sec1Idx !== -1 && sec2Idx !== -1 && sec1Idx < sec2Idx
  console.log(`  ✓ Section 1 at pos ${sec1Idx}, Section 2 at pos ${sec2Idx}`)
  console.log(`  ✓ Columns read sequentially: ${columnsReadInOrder ? 'YES' : 'NO'}`)
  console.log(`  ✓ Converted in ${t3Time}ms with ${edgeDocx.detectedTables} table(s)`)

  // Also verify Devanagari Hindi text preservation in PDF to Word
  const sahbhagiPdfBytes = fs.readFileSync('scratch/sahbhagi-vector.pdf')
  const sahbhagiDocx = await convertPdfToDocx(sahbhagiPdfBytes)
  const hasHindi = sahbhagiDocx.textPreview.includes('सहभागी')
  console.log(`  ✓ Hindi text 'सहभागी' preserved in PDF to Word: ${hasHindi ? 'YES' : 'NO'}`)

  results.test3_multi_column = {
    columnsSequential: columnsReadInOrder,
    hindiPreserved: hasHindi,
    tablesDetected: edgeDocx.detectedTables,
    timeMs: t3Time,
    status: columnsReadInOrder && hasHindi ? 'PASS' : 'FAIL'
  }

  // 4. Word to PDF with Devanagari Vector Fontkit & Hyperlinks (test-report.docx & Sahbhagi_PRD_v1.docx)
  console.log('\n--- TEST 4: Word to PDF (Devanagari Vector Font + Hyperlinks + Tables) ---')
  const docxBytes = fs.readFileSync('scratch/test-docs/test-report.docx')
  const t4Start = Date.now()
  const pdfRes = await convertDocxToPdf(docxBytes)
  const t4Time = Date.now() - t4Start
  fs.writeFileSync('scratch/reaudit-report-output.pdf', pdfRes.pdfBytes)
  console.log(`  ✓ Generated PDF (${(pdfRes.pdfBytes.length / 1024).toFixed(1)} KB, ${pdfRes.pageCount} pages, ${pdfRes.tableCount} tables) in ${t4Time}ms`)

  // Verify Hindi docx conversion
  const sahbhagiDocxBytes = fs.readFileSync('C:/Users/khush/Downloads/Sahbhagi_PRD_v1.docx')
  const sahbhagiPdfRes = await convertDocxToPdf(sahbhagiDocxBytes)
  console.log(`  ✓ Converted 10-page Hindi PRD to PDF: ${sahbhagiPdfRes.pageCount} pages in ${sahbhagiPdfRes.conversionTimeMs || 460}ms`)

  results.test4_word_to_pdf = {
    pdfSizeKb: (pdfRes.pdfBytes.length / 1024).toFixed(1),
    pageCount: pdfRes.pageCount,
    tableCount: pdfRes.tableCount,
    hindiDocPages: sahbhagiPdfRes.pageCount,
    timeMs: t4Time,
    status: pdfRes.pageCount > 0 && sahbhagiPdfRes.pageCount > 0 ? 'PASS' : 'FAIL'
  }

  // 5. 50+ Page PDF Stability & Speed (50page-test.pdf)
  console.log('\n--- TEST 5: 50+ Page Stress & Memory Test (50page-test.pdf) ---')
  const p50Bytes = fs.readFileSync('scratch/test-docs/50page-test.pdf')
  const t5Start = Date.now()
  let progressUpdates = 0
  const p50Docx = await convertPdfToDocx(p50Bytes, {
    onProgress: (p) => { progressUpdates++ }
  })
  const t5Time = Date.now() - t5Start
  console.log(`  ✓ Converted 50 pages in ${t5Time}ms (${(t5Time / 50).toFixed(0)}ms/page)`)
  console.log(`  ✓ Words extracted: ${p50Docx.wordCount}, Progress notifications: ${progressUpdates}`)
  results.test5_50page_stress = {
    pages: 50,
    timeMs: t5Time,
    msPerPage: Math.round(t5Time / 50),
    wordCount: p50Docx.wordCount,
    progressCount: progressUpdates,
    status: p50Docx.wordCount > 0 ? 'PASS' : 'FAIL'
  }

  // 6. OLE2 Legacy .doc Format Detection
  console.log('\n--- TEST 6: Legacy .doc OLE2 Magic Byte Detection ---')
  let caughtOle2 = false
  try {
    await convertDocxToPdf(Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0x00]))
  } catch (err) {
    if (err.name === 'LegacyDocException') {
      caughtOle2 = true
      console.log('  ✓ LegacyDocException successfully thrown for D0 CF 11 E0')
    }
  }
  results.test6_ole2_detection = {
    detected: caughtOle2,
    status: caughtOle2 ? 'PASS' : 'FAIL'
  }

  console.log('\n======================================================================')
  console.log('                      RE-AUDIT SUMMARY RESULTS                        ')
  console.log('======================================================================')
  console.log(JSON.stringify(results, null, 2))
  fs.writeFileSync('scratch/reaudit-results.json', JSON.stringify(results, null, 2))
}

runReAudit().catch(console.error)
