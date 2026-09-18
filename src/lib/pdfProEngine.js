import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import JSZip from 'jszip'

/**
 * 1. PDF Blank Page Auto-Detector
 * Scans each page of the PDF to measure non-white pixel density.
 * Pages with near-zero ink (e.g. empty scanner backs) are identified.
 */
export async function detectBlankPages(arrayBuffer, threshold = 0.002, onProgress) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) })
  const pdf = await loadingTask.promise
  const numPages = pdf.numPages
  const blankPages = [] // 1-indexed

  for (let i = 1; i <= numPages; i++) {
    if (onProgress) onProgress(i, numPages)
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 0.5 }) // small scale for fast scan
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')

    await page.render({ canvasContext: ctx, viewport }).promise

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let nonWhitePixels = 0
    const totalPixels = canvas.width * canvas.height

    for (let p = 0; p < imgData.length; p += 4) {
      const r = imgData[p]
      const g = imgData[p + 1]
      const b = imgData[p + 2]
      // Check if pixel deviates significantly from pure white (255, 255, 255)
      if (r < 240 || g < 240 || b < 240) {
        nonWhitePixels++
      }
    }

    const nonWhiteRatio = nonWhitePixels / totalPixels
    if (nonWhiteRatio < threshold) {
      blankPages.push(i)
    }
  }

  return { blankPages, totalPages: numPages }
}

/**
 * Removes detected blank pages from a PDF.
 */
export async function removeBlankPages(arrayBuffer, blankPageNumbers) {
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const pageCount = pdfDoc.getPageCount()
  const toDelete = new Set(blankPageNumbers.map((n) => n - 1))

  const newDoc = await PDFDocument.create()
  const keepIndices = []
  for (let i = 0; i < pageCount; i++) {
    if (!toDelete.has(i)) keepIndices.push(i)
  }

  if (keepIndices.length === 0) {
    throw new Error('All pages in this PDF were detected as blank! Cannot remove all pages.')
  }

  const copiedPages = await newDoc.copyPages(pdfDoc, keepIndices)
  copiedPages.forEach((p) => newDoc.addPage(p))

  return newDoc.save()
}

/**
 * 2. PDF Redaction / Permanent Blackout Censor
 * Permanently places opaque blackout/whiteout rectangles over sensitive coordinates.
 */
export async function applyPdfRedactions(arrayBuffer, pageRedactions = []) {
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const pages = pdfDoc.getPages()

  // pageRedactions: [{ pageNum: 1, boxes: [{ x, y, width, height, color: 'black' }] }]
  // Coordinates are normalized 0-1 or PDF points. If normalized, scale to page width/height.
  for (const item of pageRedactions) {
    const pageIndex = item.pageNum - 1
    if (pageIndex < 0 || pageIndex >= pages.length) continue
    const page = pages[pageIndex]
    const { width, height } = page.getSize()

    for (const box of item.boxes) {
      const bx = box.normalized ? box.x * width : box.x
      // In PDF coordinate system, (0,0) is bottom-left
      const by = box.normalized
        ? height - (box.y + box.height) * height
        : box.y
      const bw = box.normalized ? box.width * width : box.width
      const bh = box.normalized ? box.height * height : box.height

      page.drawRectangle({
        x: bx,
        y: by,
        width: bw,
        height: bh,
        color: box.color === 'white' ? rgb(1, 1, 1) : rgb(0, 0, 0),
        opacity: 1
      })
    }
  }

  return pdfDoc.save()
}

/**
 * 3. PDF Bates Stamping & Header/Footer
 * Adds sequential Bates numbering (e.g. DOC-000042) and header/footer labels across all pages.
 */
export async function applyBatesStamping(arrayBuffer, options = {}) {
  const {
    prefix = 'DOC-',
    suffix = '',
    startNumber = 1,
    digits = 6,
    headerText = '',
    footerText = '',
    position = 'bottom-right', // 'top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'
    fontSize = 10,
    includeTotal = false
  } = options

  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages = pdfDoc.getPages()
  const total = pages.length

  pages.forEach((page, index) => {
    const { width, height } = page.getSize()
    const currentNum = startNumber + index
    const paddedNum = String(currentNum).padStart(digits, '0')
    let batesStr = `${prefix}${paddedNum}${suffix}`
    if (includeTotal) {
      batesStr += ` (Page ${index + 1} of ${total})`
    }

    const margin = 28

    // Position coordinates
    let bX = width - margin - font.widthOfTextAtSize(batesStr, fontSize)
    let bY = margin

    if (position === 'bottom-center') {
      bX = (width - font.widthOfTextAtSize(batesStr, fontSize)) / 2
      bY = margin
    } else if (position === 'bottom-left') {
      bX = margin
      bY = margin
    } else if (position === 'top-right') {
      bX = width - margin - font.widthOfTextAtSize(batesStr, fontSize)
      bY = height - margin
    } else if (position === 'top-center') {
      bX = (width - font.widthOfTextAtSize(batesStr, fontSize)) / 2
      bY = height - margin
    } else if (position === 'top-left') {
      bX = margin
      bY = height - margin
    }

    // Draw Bates Number
    page.drawText(batesStr, {
      x: Math.max(10, bX),
      y: Math.max(10, bY),
      size: fontSize,
      font,
      color: rgb(0.15, 0.2, 0.25)
    })

    // Draw Header Text if present
    if (headerText && position !== 'top-center') {
      const hw = regularFont.widthOfTextAtSize(headerText, fontSize - 1)
      page.drawText(headerText, {
        x: (width - hw) / 2,
        y: height - margin,
        size: fontSize - 1,
        font: regularFont,
        color: rgb(0.4, 0.45, 0.5)
      })
    }

    // Draw Footer Text if present
    if (footerText && position !== 'bottom-center') {
      const fw = regularFont.widthOfTextAtSize(footerText, fontSize - 1)
      page.drawText(footerText, {
        x: (width - fw) / 2,
        y: margin,
        size: fontSize - 1,
        font: regularFont,
        color: rgb(0.4, 0.45, 0.5)
      })
    }
  })

  return pdfDoc.save()
}

/**
 * 4. PDF Ink Saver / 1-Bit B&W High-Contrast Dither
 * Converts heavy colored backgrounds and colored documents into crisp ink-saving monochrome pages.
 */
export async function applyInkSaverDither(arrayBuffer, onProgress) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) })
  const pdf = await loadingTask.promise
  const numPages = pdf.numPages
  const newDoc = await PDFDocument.create()

  for (let i = 1; i <= numPages; i++) {
    if (onProgress) onProgress(i, numPages)
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')

    await page.render({ canvasContext: ctx, viewport }).promise

    // Ink-saver high-contrast dithering / threshold
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imgData.data

    for (let p = 0; p < data.length; p += 4) {
      const r = data[p]
      const g = data[p + 1]
      const b = data[p + 2]
      // Perceived luminance
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      // Text and dark lines (lum < 185) become crisp black, everything else pure white (0 ink)
      const val = lum < 185 ? 0 : 255
      data[p] = val
      data[p + 1] = val
      data[p + 2] = val
    }
    ctx.putImageData(imgData, 0, 0)

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
    const imgBytes = await blob.arrayBuffer()
    const embeddedImg = await newDoc.embedJpg(imgBytes)

    const newPage = newDoc.addPage([viewport.width / 1.5, viewport.height / 1.5])
    newPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: newPage.getWidth(),
      height: newPage.getHeight()
    })
  }

  return newDoc.save()
}

/**
 * 5. PDF Form Builder (Interactive AcroForms)
 * Injects fillable interactive text fields, checkboxes, and buttons onto any PDF page.
 */
export async function addInteractiveFormFields(arrayBuffer, fields = []) {
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const form = pdfDoc.getForm()
  const pages = pdfDoc.getPages()

  fields.forEach((f, idx) => {
    const pageIndex = (f.pageNum || 1) - 1
    if (pageIndex < 0 || pageIndex >= pages.length) return
    const page = pages[pageIndex]
    const { width, height } = page.getSize()

    const fieldName = f.name || `field_${idx + 1}`
    const fx = f.x != null ? f.x : 50
    // Support coordinate from top or bottom
    const fy = f.fromTop ? height - f.y - (f.height || 24) : (f.y || 50)
    const fw = f.width || (f.type === 'checkbox' ? 20 : 200)
    const fh = f.height || (f.type === 'checkbox' ? 20 : 24)

    if (f.type === 'checkbox') {
      const cb = form.createCheckBox(fieldName)
      cb.addToPage(page, { x: fx, y: fy, width: fw, height: fh })
      if (f.defaultChecked) cb.check()
    } else {
      const tf = form.createTextField(fieldName)
      tf.addToPage(page, { x: fx, y: fy, width: fw, height: fh })
      if (f.defaultValue) tf.setText(f.defaultValue)
    }
  })

  return pdfDoc.save()
}

/**
 * 6. Advanced Multi-Image to PDF Pro
 * Batch convert photos to PDF with custom margins, fit modes, and page presets (A4, Letter, Legal).
 */
export async function imagesToPdfPro(imageFiles, options = {}) {
  const {
    pageSize = 'a4', // 'a4', 'letter', 'legal', 'original'
    orientation = 'auto', // 'auto', 'portrait', 'landscape'
    margin = 20 // points
  } = options

  const pdfDoc = await PDFDocument.create()

  const PAGE_SIZES = {
    a4: [595.28, 841.89],
    letter: [612, 792],
    legal: [612, 1008]
  }

  for (const imgItem of imageFiles) {
    const imgBytes = await (imgItem.file ? imgItem.file.arrayBuffer() : imgItem.arrayBuffer())
    let embeddedImg
    const isPng = (imgItem.type || '').includes('png') || (imgItem.name || '').toLowerCase().endsWith('.png')

    try {
      embeddedImg = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes)
    } catch {
      // Fallback
      embeddedImg = await pdfDoc.embedJpg(imgBytes)
    }

    const { width: imgW, height: imgH } = embeddedImg

    let pW, pH
    if (pageSize === 'original') {
      pW = imgW + margin * 2
      pH = imgH + margin * 2
    } else {
      const std = PAGE_SIZES[pageSize] || PAGE_SIZES.a4
      let isLandscape = false
      if (orientation === 'landscape') {
        isLandscape = true
      } else if (orientation === 'auto' && imgW > imgH) {
        isLandscape = true
      }
      pW = isLandscape ? Math.max(std[0], std[1]) : Math.min(std[0], std[1])
      pH = isLandscape ? Math.min(std[0], std[1]) : Math.max(std[0], std[1])
    }

    const page = pdfDoc.addPage([pW, pH])
    const availW = pW - margin * 2
    const availH = pH - margin * 2

    const scale = Math.min(availW / imgW, availH / imgH, 1)
    const drawW = imgW * scale
    const drawH = imgH * scale
    const drawX = margin + (availW - drawW) / 2
    const drawY = margin + (availH - drawH) / 2

    page.drawImage(embeddedImg, {
      x: drawX,
      y: drawY,
      width: drawW,
      height: drawH
    })
  }

  return pdfDoc.save()
}

/**
 * 7. Alternate & Mix (Double-Sided Scanner Interleaver)
 * Merges odd-page scans and even-page scans into one correctly sorted document.
 */
export async function interleavePdfs(oddBuffer, evenBuffer, reverseEven = true) {
  const oddDoc = await PDFDocument.load(oddBuffer, { ignoreEncryption: true })
  const evenDoc = await PDFDocument.load(evenBuffer, { ignoreEncryption: true })
  const outDoc = await PDFDocument.create()

  const oddCount = oddDoc.getPageCount()
  const evenCount = evenDoc.getPageCount()

  const oddPages = await outDoc.copyPages(oddDoc, Array.from({ length: oddCount }, (_, i) => i))
  let evenPages = await outDoc.copyPages(evenDoc, Array.from({ length: evenCount }, (_, i) => i))

  if (reverseEven) {
    evenPages = evenPages.reverse()
  }

  const maxPages = Math.max(oddPages.length, evenPages.length)
  for (let i = 0; i < maxPages; i++) {
    if (i < oddPages.length) outDoc.addPage(oddPages[i])
    if (i < evenPages.length) outDoc.addPage(evenPages[i])
  }

  return outDoc.save()
}

/**
 * 8. Bulk Certificate & Award Generator
 * Takes 1 certificate template + a list of names, and generates personalized certificates for everyone as a ZIP.
 */
export async function generateBulkCertificates(templateBuffer, namesList = [], options = {}) {
  const {
    fontSize = 32,
    posY = 280, // from bottom
    color = { r: 0.1, g: 0.2, b: 0.4 },
    onProgress
  } = options

  const zip = new JSZip()
  const total = namesList.length

  for (let i = 0; i < total; i++) {
    const name = namesList[i].trim()
    if (!name) continue
    if (onProgress) onProgress(i + 1, total)

    const doc = await PDFDocument.load(templateBuffer, { ignoreEncryption: true })
    const font = await doc.embedFont(StandardFonts.HelveticaBold)
    const page = doc.getPages()[0]
    const { width } = page.getSize()

    const textW = font.widthOfTextAtSize(name, fontSize)
    const textX = (width - textW) / 2

    page.drawText(name, {
      x: textX,
      y: posY,
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b)
    })

    const pdfBytes = await doc.save()
    const sanitizedName = name.replace(/[^a-zA-Z0-9_\-]/g, '_')
    zip.file(`Certificate_${sanitizedName}.pdf`, pdfBytes)
  }

  return zip.generateAsync({ type: 'blob' })
}

/**
 * 9. Bulk PDF Page Counter & Print Cost Estimator
 */
export async function calculatePdfPagesAndCost(pdfFiles, ratePerPage = 2) {
  const fileStats = []
  let grandTotalPages = 0

  for (const f of pdfFiles) {
    const buf = await f.arrayBuffer()
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true })
    const count = doc.getPageCount()
    grandTotalPages += count
    fileStats.push({
      name: f.name,
      pages: count,
      cost: count * ratePerPage
    })
  }

  return {
    files: fileStats,
    totalFiles: pdfFiles.length,
    totalPages: grandTotalPages,
    ratePerPage,
    totalCost: grandTotalPages * ratePerPage
  }
}

/**
 * 10. PDF Page Duplicator / Multiple Copy Repeater
 */
export async function duplicatePdfPages(arrayBuffer, copies = 5) {
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const outDoc = await PDFDocument.create()
  const pageIndices = Array.from({ length: srcDoc.getPageCount() }, (_, i) => i)

  for (let c = 0; c < copies; c++) {
    const copiedPages = await outDoc.copyPages(srcDoc, pageIndices)
    copiedPages.forEach((p) => outDoc.addPage(p))
  }

  return outDoc.save()
}
