import fs from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { exportPdf } from '../src/lib/pdfExporter.js'

async function runTest() {
  console.log('--- Testing GAP-P0-2: Interactive AcroForm Fields ---')
  const pdfPath = path.resolve('scratch/test-docs/fillable-form-test.pdf')
  const originalBuffer = fs.readFileSync(pdfPath).buffer

  const formFieldsToFill = {
    'applicant.name': 'Jane Doe',
    'applicant.subscribe': true,
    'applicant.plan': 'Pro',
    'applicant.country': 'Germany',
  }

  // --- Test 1: Keep fillable export ---
  console.log('\n[Test 1] Exporting with Keep Fillable (flattenForm = false)...')
  const keepFillableBytes = await exportPdf(
    originalBuffer,
    {}, // no visual layer edits
    1,
    {},
    {},
    '',
    null,
    formFieldsToFill,
    false // flattenForm = false
  )

  fs.writeFileSync('scratch/test-docs/output-keep-fillable.pdf', Buffer.from(keepFillableBytes))
  console.log(`Saved scratch/test-docs/output-keep-fillable.pdf (${keepFillableBytes.length} bytes)`)

  // Verify in pdf.js
  const keepTask = pdfjsLib.getDocument({ data: new Uint8Array(keepFillableBytes) })
  const keepDoc = await keepTask.promise
  const keepPage = await keepDoc.getPage(1)
  const keepAnnots = await keepPage.getAnnotations()
  console.log(`Keep fillable widget annotations count: ${keepAnnots.length}`)

  const nameAnnot = keepAnnots.find(a => a.fieldName === 'applicant.name')
  const subAnnot = keepAnnots.find(a => a.fieldName === 'applicant.subscribe')
  const planAnnots = keepAnnots.filter(a => a.fieldName === 'applicant.plan')
  const countryAnnot = keepAnnots.find(a => a.fieldName === 'applicant.country')

  if (!nameAnnot || nameAnnot.fieldValue !== 'Jane Doe') {
    throw new Error(`applicant.name mismatch! Expected 'Jane Doe', got: ${nameAnnot?.fieldValue}`)
  }
  console.log(`  ✓ applicant.name = "${nameAnnot.fieldValue}"`)

  if (!subAnnot || (subAnnot.fieldValue !== 'Yes' && subAnnot.fieldValue !== true)) {
    throw new Error(`applicant.subscribe mismatch! Expected 'Yes'/true, got: ${subAnnot?.fieldValue}`)
  }
  console.log(`  ✓ applicant.subscribe = "${subAnnot.fieldValue}"`)

  const selectedPlan = planAnnots.find(a => a.fieldValue === a.buttonValue || a.fieldValue === '1')
  if (!selectedPlan) {
    throw new Error(`applicant.plan mismatch! Pro option not selected`)
  }
  console.log(`  ✓ applicant.plan selected correctly (buttonValue ${selectedPlan.buttonValue})`)

  if (!countryAnnot || !JSON.stringify(countryAnnot.fieldValue).includes('Germany')) {
    throw new Error(`applicant.country mismatch! Expected 'Germany', got: ${JSON.stringify(countryAnnot?.fieldValue)}`)
  }
  console.log(`  ✓ applicant.country = ${JSON.stringify(countryAnnot.fieldValue)}`)

  // Verify in pdf-lib
  const keepPdfLib = await PDFDocument.load(keepFillableBytes)
  const keepLibForm = keepPdfLib.getForm()
  const libName = keepLibForm.getTextField('applicant.name').getText()
  const libSub = keepLibForm.getCheckBox('applicant.subscribe').isChecked()
  const libPlan = keepLibForm.getRadioGroup('applicant.plan').getSelected()
  const libCountry = keepLibForm.getDropdown('applicant.country').getSelected()
  console.log(`  ✓ pdf-lib verification: name="${libName}", sub=${libSub}, plan="${libPlan}", country="${libCountry}"`)

  if (libName !== 'Jane Doe' || !libSub || libPlan !== 'Pro' || !libCountry.includes('Germany')) {
    throw new Error('pdf-lib verification failed!')
  }

  // --- Test 2: Flatten Form export ---
  console.log('\n[Test 2] Exporting with Flatten Form (flattenForm = true)...')
  const flattenedBytes = await exportPdf(
    originalBuffer,
    {}, // no visual layer edits
    1,
    {},
    {},
    '',
    null,
    formFieldsToFill,
    true // flattenForm = true
  )

  fs.writeFileSync('scratch/test-docs/output-flattened.pdf', Buffer.from(flattenedBytes))
  console.log(`Saved scratch/test-docs/output-flattened.pdf (${flattenedBytes.length} bytes)`)

  // Verify in pdf.js
  const flatTask = pdfjsLib.getDocument({ data: new Uint8Array(flattenedBytes) })
  const flatDoc = await flatTask.promise
  const flatPage = await flatDoc.getPage(1)
  const flatAnnots = await flatPage.getAnnotations()
  console.log(`Flattened widget annotations count: ${flatAnnots.length}`)

  if (flatAnnots.length !== 0) {
    throw new Error(`Expected 0 annotations after flatten, got: ${flatAnnots.length}`)
  }
  console.log('  ✓ 0 interactive annotations remain (all burned into page stream)')

  const textContent = await flatPage.getTextContent()
  const pageText = textContent.items.map(i => i.str).join(' ')
  console.log(`Extracted page text sample: "${pageText.slice(0, 100)}..."`)

  if (!pageText.includes('Jane Doe')) {
    throw new Error(`Expected flattened text to contain 'Jane Doe', but was not found!`)
  }
  console.log('  ✓ Flattened text contains "Jane Doe"')

  if (!pageText.includes('Germany')) {
    throw new Error(`Expected flattened text to contain 'Germany', but was not found!`)
  }
  console.log('  ✓ Flattened text contains "Germany"')

  console.log('\n=== ALL GAP-P0-2 FORM FILL & FLATTEN TESTS PASSED! ===\n')
}

runTest().catch(err => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})
