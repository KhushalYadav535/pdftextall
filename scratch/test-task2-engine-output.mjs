import fs from 'fs'
import { convertPdfToDocx } from '../src/lib/iloveEngine.js'

async function testTask2() {
  console.log('=== TESTING TASK 2: MULTI-COLUMN GUTTER DETECTION IN ENGINE ===')

  const pdfBuf = fs.readFileSync('scratch/test-docs/edge-cases-test.pdf')
  const res = await convertPdfToDocx(pdfBuf.buffer)

  console.log('Text preview from converted DOCX:\n')
  console.log(res.textPreview)

  // Verify that Section 1 text appears before Section 2 text
  const text = res.textPreview
  const posSec1 = text.indexOf('SECTION 1: CORE ARCHITECTURE')
  const posSec1Body = text.indexOf('Our distributed document processing engine is')
  const posSec2 = text.indexOf('SECTION 2: FORMAT FIDELITY')
  const posSec2Body = text.indexOf('Converting between fixed-layout vector PDFs')

  console.log('\nPositions in text:')
  console.log('- SECTION 1:', posSec1)
  console.log('- SECTION 1 Body:', posSec1Body)
  console.log('- SECTION 2:', posSec2)
  console.log('- SECTION 2 Body:', posSec2Body)

  // Check for the old bug: "SECTION 1: CORE ARCHITECTURE SECTION 2: FORMAT FIDELITY"
  const hasMergedBug = text.includes('SECTION 1: CORE ARCHITECTURE SECTION 2: FORMAT FIDELITY')
  if (hasMergedBug) {
    console.error('✗ FAILED: Lines are still merged horizontally!')
    process.exit(1)
  }

  if (posSec1 >= 0 && posSec1Body > posSec1 && posSec2 > posSec1Body && posSec2Body > posSec2) {
    console.log('\n✓ SUCCESS: Column 1 read fully, followed by Column 2!')
  } else {
    console.error('✗ FAILED: Reading order did not match expected sequence!')
    process.exit(1)
  }
}

testTask2().catch(err => {
  console.error('Task 2 Test Error:', err)
  process.exit(1)
})
