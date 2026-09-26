import { createWorker } from 'tesseract.js'

let worker = null
let workerReady = false
let workerLang = null

export const OCR_LANGS = [
  { id: 'eng', label: 'English' },
  { id: 'hin', label: 'Hindi (हिन्दी)' },
  { id: 'eng+hin', label: 'English + Hindi' },
]

export async function initOcr(onProgress, lang = 'eng') {
  if (workerReady && worker && workerLang === lang) return worker
  // Language switch → rebuild worker (traineddata cached in IndexedDB after first load)
  if (worker) {
    try { await worker.terminate() } catch { /* noop */ }
    worker = null
    workerReady = false
  }
  try {
    worker = await createWorker(lang, 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round((m.progress || 0) * 100))
        }
      },
    })
    workerReady = true
    workerLang = lang
    return worker
  } catch (err) {
    workerReady = false
    worker = null
    workerLang = null
    throw err
  }
}

/**
 * Run OCR on a rendered canvas element.
 * Returns array of word objects: { text, x, y, width, height, confidence }
 */
export async function ocrCanvas(canvas, onProgress, lang = 'eng') {
  const w = await initOcr(onProgress, lang)
  const input = (typeof canvas !== 'string' && canvas?.toDataURL) ? canvas.toDataURL('image/png') : canvas
  const { data } = await w.recognize(input)

  const words = []
  for (const block of data.blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        for (const word of line.words || []) {
          if (!word.text.trim() || word.confidence < 30) continue
          words.push({
            id:         `ocr-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            str:        word.text,
            x:          word.bbox.x0,
            y:          word.bbox.y0,
            width:      word.bbox.x1 - word.bbox.x0,
            height:     word.bbox.y1 - word.bbox.y0,
            fontSize:   Math.max((word.bbox.y1 - word.bbox.y0) * 0.8, 8),
            fontName:   'Helvetica',
            color:      '#000000',
            confidence: word.confidence,
            fromOcr:    true,
          })
        }
      }
    }
  }
  return words
}

export async function terminateOcr() {
  if (worker) { await worker.terminate(); worker = null; workerReady = false }
}

/**
 * Build a REAL searchable PDF: original page pixels as background +
 * invisible (transparent) text layer from Tesseract words, so any viewer
 * can select / Ctrl+F the text. 100% client-side, no server.
 *
 * pages: [{ canvas, words: [{str,x,y,width,height}] (canvas-pixel coords), pageWidthPt, pageHeightPt }]
 */
export async function createSearchablePdf(pages) {
  const { PDFDocument, StandardFonts } = await import('pdf-lib')
  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)

  for (const pg of pages) {
    const { canvas, words, pageWidthPt, pageHeightPt } = pg
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
    if (!blob) throw new Error('Could not encode page image')
    const imgBytes = await blob.arrayBuffer()
    const embedded = await out.embedJpg(imgBytes)
    const page = out.addPage([pageWidthPt, pageHeightPt])
    page.drawImage(embedded, { x: 0, y: 0, width: pageWidthPt, height: pageHeightPt })

    const sx = pageWidthPt / canvas.width
    const sy = pageHeightPt / canvas.height
    for (const w of words || []) {
      if (!w.str || !w.str.trim()) continue
      const xPt = w.x * sx
      // canvas y=0 is top; PDF y=0 is bottom
      const topPt = w.y * sy
      const hPt = Math.max(w.height * sy, 4)
      const yPt = pageHeightPt - topPt - hPt
      const wPt = Math.max(w.width * sx, 2)
      // Fit font size to box height, then squeeze horizontally via width calc
      let size = Math.min(hPt * 0.95, 48)
      size = Math.max(size, 4)
      const textW = font.widthOfTextAtSize(w.str, size)
      const xScale = textW > 0 ? Math.min(wPt / textW, 3) : 1
      page.drawText(w.str, {
        x: xPt,
        y: yPt,
        size,
        font,
        opacity: 0, // invisible but selectable + searchable
        xSkew: { angle: 0, x: 0 },
      })
      // Compensate width mismatch by re-drawing scaled if far off
      if (xScale < 0.5 || xScale > 1.6) {
        // pdf-lib has no horizontal scaling; accept approximate placement —
        // search/select still works, which is the goal.
      }
    }
  }

  return out.save({ useObjectStreams: true })
}
