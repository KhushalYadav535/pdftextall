import fs from 'node:fs'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import JSZip from 'jszip'

async function inspect() {
  const pdfBuf = fs.readFileSync('src/output/anuragsy.pdf')
  const docxBuf = fs.readFileSync('src/output/anuragsy.docx')

  console.log('PDF size:', pdfBuf.length, 'bytes')
  console.log('DOCX size:', docxBuf.length, 'bytes')

  // Inspect PDF
  const task = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuf) })
  const pdfDoc = await task.promise
  console.log('\n================ PDF DETAILS ================')
  console.log('Total pages:', pdfDoc.numPages)
  
  const allPdfText = []
  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page = await pdfDoc.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    console.log(`\n--- Page ${p} (${vp.width.toFixed(1)} x ${vp.height.toFixed(1)} pt) ---`)
    const tc = await page.getTextContent()
    console.log('Text items count:', tc.items.length)
    
    // Group items into lines
    const lineMap = new Map()
    for (const item of tc.items) {
      const y = Math.round(item.transform[5] * 10) / 10
      // find nearest line within 3pt
      let matchedKey = null
      for (const k of lineMap.keys()) {
        if (Math.abs(k - y) <= 3) {
          matchedKey = k
          break
        }
      }
      if (matchedKey === null) {
        matchedKey = y
        lineMap.set(matchedKey, [])
      }
      lineMap.get(matchedKey).push({
        str: item.str,
        x: item.transform[4],
        fontName: item.fontName,
        width: item.width,
        height: item.height,
      })
    }

    // Sort lines by y descending (top to bottom)
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)
    for (const y of sortedYs) {
      const lineItems = lineMap.get(y).sort((a, b) => a.x - b.x)
      const lineText = lineItems.map(i => i.str).join(' ').trim()
      if (lineText) {
        allPdfText.push(`[P${p} Y=${y.toFixed(0)}] ${lineText}`)
      }
    }
  }

  console.log(`Extracted PDF lines (${allPdfText.length}):`)
  console.log(allPdfText.join('\n'))

  // Inspect DOCX
  console.log('\n================ DOCX DETAILS ================')
  const zip = await JSZip.loadAsync(docxBuf)
  const docXml = await zip.file('word/document.xml').async('text')
  
  // Also check styles.xml
  let stylesXml = ''
  if (zip.file('word/styles.xml')) {
    stylesXml = await zip.file('word/styles.xml').async('text')
  }

  // Parse paragraphs
  const pRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g
  const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g
  const allDocxParagraphs = []
  let pm
  let pIndex = 0
  while ((pm = pRegex.exec(docXml)) !== null) {
    pIndex++
    const pContent = pm[1]
    let pText = ''
    let tm
    while ((tm = tRegex.exec(pContent)) !== null) {
      pText += tm[1]
    }
    
    // Check formatting on paragraph
    const isBold = pContent.includes('<w:b/>') || pContent.includes('<w:b ')
    const isItalic = pContent.includes('<w:i/>') || pContent.includes('<w:i ')
    const headingMatch = pContent.match(/<w:pStyle\s+w:val="([^"]+)"/)
    const pStyle = headingMatch ? headingMatch[1] : null
    
    if (pText.trim()) {
      allDocxParagraphs.push({
        index: pIndex,
        text: pText.trim(),
        style: pStyle,
        bold: isBold,
        italic: isItalic
      })
    }
  }

  console.log(`Extracted DOCX paragraphs (${allDocxParagraphs.length}):`)
  for (const p of allDocxParagraphs) {
    console.log(`[P${p.index}${p.style ? ` style=${p.style}` : ''}${p.bold ? ' BOLD' : ''}] ${p.text}`)
  }

  // Check tables
  const tblRegex = /<w:tbl(?:\s|>)/g
  const tblCount = (docXml.match(tblRegex) || []).length
  console.log('\nDOCX tables count:', tblCount)

  // Check media
  const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('word/media/'))
  console.log('DOCX media files:', mediaFiles)

  // Check page breaks & drawings
  const pageBreaks = (docXml.match(/<w:br\s+w:type="page"\s*\/>/g) || []).length
  const lastRenderedBreaks = (docXml.match(/<w:lastRenderedPageBreak\s*\/>/g) || []).length
  const sectPrs = (docXml.match(/<w:sectPr(?:\s|>)/g) || []).length
  console.log('\nExplicit page breaks (<w:br w:type="page"/>):', pageBreaks)
  console.log('lastRenderedPageBreak:', lastRenderedBreaks)
  console.log('Section breaks (<w:sectPr>):', sectPrs)

  const drawings = (docXml.match(/<w:drawing(?:\s|>)/g) || []).length
  console.log('Image drawings count in docx:', drawings)

  // Write comparison summary to a JSON file for analysis
  fs.writeFileSync('scratch/pdf-docx-comparison.json', JSON.stringify({
    pdfTextCount: allPdfText.length,
    docxParagraphCount: allDocxParagraphs.length,
    pdfLines: allPdfText,
    docxParagraphs: allDocxParagraphs,
    docxTables: tblCount,
    docxMedia: mediaFiles,
    pageBreaks,
    drawings
  }, null, 2))
}

inspect().catch(err => console.error(err))
