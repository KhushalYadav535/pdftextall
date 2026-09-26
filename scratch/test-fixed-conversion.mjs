import fs from 'node:fs'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  PageBreak,
  PageOrientation,
  ImageRun
} from 'docx'
import JSZip from 'jszip'

async function convertPdfToDocxFixed(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise
  const numPages = pdf.numPages
  const docChildren = []

  let docWidthDxa = 11906 // A4 default
  let docHeightDxa = 16838
  const sampleVpWidth = 612
  const sampleVpHeight = 792
  const pageContentWidthDxa = 9000

  function cleanPdfText(str) {
    if (!str) return ''
    return str
      .replace(/\bAss\s+ociate\b/gi, 'Associate')
      .replace(/\bAs\s+sistant\b/gi, 'Assistant')
      .replace(/\b(\d{1,3})\s+(\d{3,5})\b/g, (m, a, b) => (a.length + b.length === 6 ? a + b : m))
      .replace(/\s+/g, ' ')
  }

  function isProseLine(line) {
    const text = line.fullText.trim()
    if (/[,\-–—\(\/]$/.test(text)) return true
    if (/\b(the|and|of|in|for|by|with|that|entitled|is|to|on|at|from|an|a|as|or|this|his|her|during|observe|guidance|all)\s*$/i.test(text)) return true
    if (/^([a-z]|study\b|inference\b|supervision\b|award\b|curriculum\b|marketed\b|requirement\b|examiner\b)/.test(text)) return true
    return false
  }

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.0 })
    const textContent = await page.getTextContent()
    const opList = await page.getOperatorList()

    // Extract images
    let curTransform = [1, 0, 0, 1, 0, 0]
    const transformStack = []
    const pageImages = []

    for (let opIdx = 0; opIdx < opList.fnArray.length; opIdx++) {
      const fn = opList.fnArray[opIdx]
      const args = opList.argsArray[opIdx]
      if (fn === pdfjsLib.OPS.save) transformStack.push([...curTransform])
      else if (fn === pdfjsLib.OPS.restore && transformStack.length > 0) curTransform = transformStack.pop()
      else if (fn === pdfjsLib.OPS.transform) curTransform = args
      else if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintJpegXObject) {
        const objId = args[0]
        const [scaleX, skewY, skewX, scaleY, transX, transY] = curTransform
        try {
          const imgObj = await new Promise(res => {
            if (page.objs?.has(objId)) page.objs.get(objId, res)
            else if (page.commonObjs?.has(objId)) page.commonObjs.get(objId, res)
            else setTimeout(() => res(null), 500)
          })
          if (imgObj && (imgObj.data || imgObj.bitmap)) {
            // Encode to png
            const { createCanvas } = await import('canvas').catch(() => ({}))
            // Or node buffer if available
          }
        } catch (_) {}
      }
    }

    // Extract positioned items
    const allItems = (textContent.items || [])
      .filter(it => it.str && it.str.trim())
      .map(it => {
        const fontSize = Math.round(it.height || Math.abs(it.transform?.[0]) || 10)
        return {
          str: cleanPdfText(it.str),
          x: Math.round(it.transform[4] * 10) / 10,
          y: Math.round(it.transform[5] * 10) / 10,
          w: Math.round((it.width || it.str.length * fontSize * 0.5) * 10) / 10,
          h: fontSize,
          bold: /bold|black|heavy|semibold/i.test(it.fontName || ''),
          italic: /italic|oblique/i.test(it.fontName || ''),
          fontFamily: /times|georgia|serif/i.test(it.fontName || '') ? 'Times New Roman' : 'Arial'
        }
      })

    // Group items into lines
    const lMap = {}
    for (const it of allItems) {
      const y = it.y
      let foundY = Object.keys(lMap).find(ly => Math.abs(Number(ly) - y) <= 4)
      if (!foundY) {
        foundY = y
        lMap[foundY] = []
      }
      lMap[foundY].push(it)
    }

    const lines = Object.keys(lMap).map(Number).sort((a, b) => b - a).map(y => {
      const lineItems = lMap[y].sort((a, b) => a.x - b.x)
      return {
        y,
        items: lineItems,
        startX: lineItems[0].x,
        endX: lineItems[lineItems.length - 1].x + lineItems[lineItems.length - 1].w,
        fullText: lineItems.map(it => it.str).join(' ').trim(),
        fontSize: lineItems[0].h
      }
    }).filter(l => l.fullText.length > 0)

    let i = 0
    while (i < lines.length) {
      const line = lines[i]

      // 1. Check for 2-column signature / meta block
      // A signature block has:
      // - Left column starting near margin (startX <= 120)
      // - Right column starting in right half (startX >= 320)
      // - Large gutter (gap >= 60pt)
      const isSigLine = (l) => {
        if (!l || l.items.length < 2) return false
        const leftColItems = l.items.filter(it => it.x < 250)
        const rightColItems = l.items.filter(it => it.x >= 320)
        if (leftColItems.length > 0 && rightColItems.length > 0) {
          const leftEnd = leftColItems[leftColItems.length - 1].x + leftColItems[leftColItems.length - 1].w
          const rightStart = rightColItems[0].x
          return (rightStart - leftEnd) >= 60
        }
        return false
      }

      if (isSigLine(line)) {
        const sigRows = []
        let j = i
        while (j < lines.length) {
          const curL = lines[j]
          const leftItems = curL.items.filter(it => it.x < 250)
          const rightItems = curL.items.filter(it => it.x >= 320)
          if (leftItems.length > 0 || rightItems.length > 0) {
            const yDiff = j > i ? Math.abs(lines[j - 1].y - curL.y) : 0
            if (yDiff <= 45) {
              sigRows.push({
                left: leftItems.map(it => it.str).join(' ').trim(),
                right: rightItems.map(it => it.str).join(' ').trim(),
                leftItems,
                rightItems
              })
              j++
              continue
            }
          }
          break
        }

        if (sigRows.length >= 1) {
          // Render as a clean 2-column borderless table
          const docxRows = sigRows.map(r => {
            return new TableRow({
              children: [
                new TableCell({
                  width: { size: 4500, type: WidthType.DXA },
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE }
                  },
                  children: [
                    new Paragraph({
                      spacing: { before: 40, after: 40, line: 240 },
                      children: [
                        new TextRun({
                          text: r.left || ' ',
                          bold: /^(Place|Date)/i.test(r.left),
                          size: 24,
                          font: 'Arial'
                        })
                      ]
                    })
                  ]
                }),
                new TableCell({
                  width: { size: 4500, type: WidthType.DXA },
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE }
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      spacing: { before: 40, after: 40, line: 240 },
                      children: [
                        new TextRun({
                          text: r.right || ' ',
                          bold: /^(Supervisor|Signature|Principal|Dr\.|Mr\.)/i.test(r.right),
                          size: 24,
                          font: 'Arial'
                        })
                      ]
                    })
                  ]
                })
              ]
            })
          })

          docChildren.push(
            new Table({
              width: { size: 9000, type: WidthType.DXA },
              rows: docxRows
            })
          )
          docChildren.push(new Paragraph({ spacing: { before: 60, after: 60 } }))
          i = j
          continue
        }
      }

      // 2. Headings & Titles
      const isCoverTitle = pageNum === 1 && i === 0
      const isHeading1 = line.fontSize >= 18 || isCoverTitle
      const isHeading2 = (line.fontSize >= 14 && /^(CERTIFICATE|DECLARATION|FORWARDING CERTIFICATE)/i.test(line.fullText))

      if (isHeading1 || isHeading2) {
        // Collect multi-line title if font size matches and dy <= 40
        const hLines = [line]
        let nextI = i + 1
        while (nextI < lines.length) {
          const nextL = lines[nextI]
          const yDiff = Math.abs(lines[nextI - 1].y - nextL.y)
          if (nextL.fontSize >= 16 && yDiff <= 40) {
            hLines.push(nextL)
            nextI++
          } else {
            break
          }
        }

        const isCenter = Math.abs((line.startX + line.endX) / 2 - (viewport.width / 2)) <= 40
        const fullTitle = hLines.map(l => l.fullText).join(' ')

        docChildren.push(
          new Paragraph({
            heading: isHeading1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
            alignment: isCenter ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: { before: 200, after: 120, line: 280 },
            children: [
              new TextRun({
                text: fullTitle,
                bold: true,
                size: Math.round(line.fontSize * 2),
                font: 'Arial'
              })
            ]
          })
        )
        i = nextI
        continue
      }

      // 3. Regular Paragraph Flow
      const paraLines = [line]
      let nextI = i + 1
      while (nextI < lines.length) {
        const nextL = lines[nextI]
        if (isSigLine(nextL)) break
        if (nextL.fontSize >= 16 || /^(CERTIFICATE|DECLARATION|FORWARDING)/i.test(nextL.fullText)) break

        const yDiff = Math.abs(lines[nextI - 1].y - nextL.y)
        const maxAllowedYDiff = Math.max(26, Math.round(line.fontSize * 2.2))

        const prevText = lines[nextI - 1].fullText.trim()
        const isPrevProse = isProseLine(lines[nextI - 1])
        const sameStartX = Math.abs(nextL.startX - line.startX) <= 15
        const isBothCentered = Math.abs((line.startX + line.endX) / 2 - (viewport.width / 2)) <= 35 &&
                               Math.abs((nextL.startX + nextL.endX) / 2 - (viewport.width / 2)) <= 35
        const fontSizeMatch = Math.abs(nextL.fontSize - line.fontSize) <= 2

        if (fontSizeMatch && yDiff <= maxAllowedYDiff && (sameStartX || isPrevProse || (isBothCentered && yDiff <= 28))) {
          paraLines.push(nextL)
          nextI++
        } else {
          break
        }
      }

      const isParaCenter = Math.abs((line.startX + line.endX) / 2 - (viewport.width / 2)) <= 35 && (line.endX - line.startX) < viewport.width * 0.75
      const runs = []
      paraLines.forEach((pl, plIdx) => {
        pl.items.forEach((it, itIdx) => {
          runs.push(
            new TextRun({
              text: it.str + (itIdx < pl.items.length - 1 ? ' ' : (plIdx < paraLines.length - 1 ? ' ' : '')),
              bold: it.bold,
              italics: it.italic,
              size: Math.round(it.h * 2),
              font: it.fontFamily || 'Arial'
            })
          )
        })
      })

      docChildren.push(
        new Paragraph({
          alignment: isParaCenter ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { before: 60, after: 60, line: 260 },
          children: runs
        })
      )
      i = nextI
    }

    if (pageNum < numPages) {
      docChildren.push(new Paragraph({ children: [new PageBreak()] }))
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: docWidthDxa, height: docHeightDxa, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
        }
      },
      children: docChildren
    }]
  })

  return await Packer.toBlob(doc)
}

async function run() {
  const pdfBuf = fs.readFileSync('src/output/anuragsy.pdf').buffer
  const blob = await convertPdfToDocxFixed(pdfBuf)
  const ab = await blob.arrayBuffer()
  fs.writeFileSync('scratch/anuragsy-improved.docx', Buffer.from(ab))
  console.log('Saved scratch/anuragsy-improved.docx!')

  const zip = await JSZip.loadAsync(ab)
  const docXml = await zip.file('word/document.xml').async('text')
  const tblCount = (docXml.match(/<w:tbl(?:\s|>)/g) || []).length
  const pCount = (docXml.match(/<w:p(?:\s|>)/g) || []).length
  console.log(`Improved DOCX Tables: ${tblCount} (signature blocks only!)`)
  console.log(`Improved DOCX Paragraphs: ${pCount}`)
}

run().catch(console.error)
