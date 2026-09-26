import fs from 'fs'
import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

globalThis.pdfjsLib = pdfjsLib
const { convertPdfToDocx } = await import('../src/lib/iloveEngine.js')

async function check() {
  const pdfBytes = fs.readFileSync('scratch/test-docs/test-invoice.pdf')
  const { docxBlob } = await convertPdfToDocx(pdfBytes.buffer)
  const zip = await JSZip.loadAsync(await docxBlob.arrayBuffer())
  const docXml = await zip.file('word/document.xml').async('string')
  
  const trs = [...docXml.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)]
  trs.forEach((tr, rIdx) => {
    const tcs = [...tr[0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)]
    console.log(`Row ${rIdx}: ${tcs.length} cells`)
    tcs.forEach((tc, cIdx) => {
      const spanMatch = tc[0].match(/<w:gridSpan\s+w:val="(\d+)"/)
      const text = [...tc[0].matchAll(/<w:t[^>]*>([^<]+)<\/w:t>/g)].map(m => m[1]).join('')
      console.log(`   Cell ${cIdx} [span=${spanMatch ? spanMatch[1] : '1'}]: "${text}"`)
    })
  })
}

check().catch(console.error)
