import fs from 'node:fs'
import { convertPdfToDocx } from '../src/lib/iloveEngine.js'
import JSZip from 'jszip'

async function testConversion() {
  console.log('Testing convertPdfToDocx on src/output/anuragsy.pdf...')
  const pdfBuf = fs.readFileSync('src/output/anuragsy.pdf').buffer
  const result = await convertPdfToDocx(pdfBuf)

  const docxBlob = result.docxBlob
  const arrayBuffer = await docxBlob.arrayBuffer()
  fs.writeFileSync('scratch/test-anuragsy-fixed.docx', Buffer.from(arrayBuffer))
  console.log(`Saved scratch/test-anuragsy-fixed.docx (${arrayBuffer.byteLength} bytes)`)

  const zip = await JSZip.loadAsync(arrayBuffer)
  const docXml = await zip.file('word/document.xml').async('text')

  const tblRegex = /<w:tbl(?:\s|>)/g
  const tblCount = (docXml.match(tblRegex) || []).length
  console.log('DOCX tables count:', tblCount)

  const pRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g
  const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g
  let pm
  let pCount = 0
  const paragraphs = []
  while ((pm = pRegex.exec(docXml)) !== null) {
    pCount++
    let pText = ''
    let tm
    while ((tm = tRegex.exec(pm[1])) !== null) {
      pText += tm[1]
    }
    if (pText.trim()) paragraphs.push(pText.trim())
  }
  console.log('DOCX non-empty paragraphs count:', paragraphs.length)
  console.log('\nSample paragraphs:')
  console.log(paragraphs.slice(0, 20).join('\n---\n'))
}

testConversion().catch(err => console.error('Error:', err))
