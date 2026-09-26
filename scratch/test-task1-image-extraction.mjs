import fs from 'fs'
import JSZip from 'jszip'
import { convertPdfToDocx } from '../src/lib/iloveEngine.js'

async function testTask1() {
  console.log('=== TESTING TASK 1: PDF TO WORD IMAGE EXTRACTION ===')

  const pdfBuf = fs.readFileSync('extracted-pages-merged.pdf')
  console.log(`Input PDF size: ${pdfBuf.length} bytes`)

  const res = await convertPdfToDocx(pdfBuf.buffer)
  console.log('Conversion result:', {
    numPages: res.numPages,
    detectedTables: res.detectedTables,
    wordCount: res.wordCount,
    usedOcr: res.usedOcr,
    docxBlobSize: res.docxBlob.size
  })

  // Inspect the generated docx blob using JSZip
  const docxArrayBuffer = await res.docxBlob.arrayBuffer()
  const zip = await JSZip.loadAsync(docxArrayBuffer)
  
  // Find image files in word/media/
  const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('word/media/') && !f.endsWith('/'))
  console.log('Media files in generated DOCX:', mediaFiles)

  if (mediaFiles.length > 0) {
    for (const mf of mediaFiles) {
      const imgData = await zip.file(mf).async('uint8array')
      console.log(`- ${mf}: ${imgData.length} bytes`)
    }
    console.log('✓ SUCCESS: Images extracted and inserted into DOCX via ImageRun!')
  } else {
    console.error('✗ FAILED: No media files found in generated DOCX!')
    process.exit(1)
  }

  // Save docx to scratch
  fs.writeFileSync('scratch/task1-output.docx', Buffer.from(docxArrayBuffer))
  console.log('Saved output to scratch/task1-output.docx')
}

testTask1().catch(err => {
  console.error('Task 1 Test Error:', err)
  process.exit(1)
})
