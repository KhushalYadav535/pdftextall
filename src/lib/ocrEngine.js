import { createWorker } from 'tesseract.js'

let worker = null
let workerReady = false

export async function initOcr(onProgress) {
  if (workerReady && worker) return worker
  try {
    worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round((m.progress || 0) * 100))
        }
      },
    })
    workerReady = true
    return worker
  } catch (err) {
    workerReady = false
    worker = null
    throw err
  }
}

/**
 * Run OCR on a rendered canvas element.
 * Returns array of word objects: { text, x, y, width, height, confidence }
 */
export async function ocrCanvas(canvas, onProgress) {
  const w = await initOcr(onProgress)
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
