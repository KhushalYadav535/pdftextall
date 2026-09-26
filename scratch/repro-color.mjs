// Repro v2: resume-style PDF (embedded bold heading) -> render REAL pixels ->
// run the REAL sampling functions on the name block, print what overlay gets.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import * as pdfjsLegacy from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'
import fs from 'node:fs'
import { loadPdf, extractTextItems, sampleLocalBackground, sampleTextColor, BASE_SCALE } from '../src/lib/pdfRenderer.js'

const notoBold = fs.readFileSync(new URL('../public/fonts/NotoSans-Regular.ttf', import.meta.url))

async function makeResume() {
  const doc = await PDFDocument.create()
  const { default: fontkit } = await import('@pdf-lib/fontkit')
  doc.registerFontkit(fontkit)
  const page = doc.addPage([595.28, 841.89])
  // Word-style: embedded (subset) bold-ish heading + body
  const head = await doc.embedFont(notoBold, { subset: false })
  const body = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('RAMESH KUMAR', { x: 72, y: 750, size: 15, font: head, color: rgb(0, 0, 0) })
  page.drawText('Email: rk7481267@gmail.com | Phone: +91-8182838680', { x: 72, y: 725, size: 10, font: body })
  page.drawText('CAREER OBJECTIVE', { x: 72, y: 700, size: 12, font: head })
  page.drawText('NCVT-certified Electrician with 5+ years of hands-on experience.', { x: 72, y: 680, size: 10, font: body })
  return new Uint8Array(await doc.save())
}

// node-canvas factory for pdf.js legacy render in Node
function nodeCanvasFactory() {
  return {
    create(width, height) {
      const canvas = createCanvas(width, height)
      return { canvas, context: canvas.getContext('2d') }
    },
    reset({ canvas, context }, width, height) {
      canvas.width = width; canvas.height = height
    },
    destroy() {},
  }
}

const orig = await makeResume()
await loadPdf(orig.buffer.slice(0))
const items = await extractTextItems(1)
const name = items.find((i) => (i.str || '').includes('RAMESH'))
console.log('name block:', JSON.stringify({ str: name.str, x: name.x, y: name.y, w: name.width, h: name.height, fontSize: name.fontSize, color: name.color, colorSource: name.colorSource }))

// Render real pixels at BASE_SCALE (zoom=1, dpr=1)
const pdf = await pdfjsLegacy.getDocument({ data: new Uint8Array(orig), isEvalSupported: false }).promise
const page = await pdf.getPage(1)
const viewport = page.getViewport({ scale: BASE_SCALE })
const { canvas, context } = nodeCanvasFactory().create(Math.floor(viewport.width), Math.floor(viewport.height))
context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height)
await page.render({ canvasContext: context, viewport, canvasFactory: nodeCanvasFactory() }).promise

const dpr = 1, zoom = 1, scale = zoom * dpr
// NOTE: sampleLocalBackground/sampleTextColor use ctx.getImageData — napi canvas supports it
const localBg = sampleLocalBackground(canvas, name.x, name.y, name.width, name.height, scale)
console.log('sampled localBg for overlay cover:', localBg)
const sampledColor = sampleTextColor(canvas, name.x, name.y, name.width, name.height, scale, 'white')
console.log('sampled text color for overlay text:', sampledColor)

// What the overlay will render:
console.log('OVERLAY EFFECTIVE: background=' + localBg + ' color=' + (sampledColor || name.color))
console.log('DONE')
await pdf.destroy()
