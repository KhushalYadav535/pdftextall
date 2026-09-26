import 'regenerator-runtime/runtime.js'
import {
  PDFDocument,
  rgb,
  StandardFonts,
  degrees,
  pushGraphicsState,
  popGraphicsState,
  beginText,
  endText,
  setFillingColor,
  setFontAndSize,
  setTextMatrix,
  setCharacterSpacing,
  setWordSpacing,
  setCharacterSqueeze,
  setTextRenderingMode,
  showText,
} from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import fontkit from '@pdf-lib/fontkit'
import JSZip from 'jszip'
import { encryptPDF } from '@pdfsmaller/pdf-encrypt'
import { BASE_SCALE, classifyFont, getEmbeddedFontData } from './pdfRenderer.js'
import { layoutTextForBlock, splitTextLines, textChars, ensureTextContrast } from './pdfTextLayout.js'

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc ||= new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
}

// ─── Color ────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  if (!hex || hex === 'transparent') return rgb(0,0,0)
  const c = hex.replace('#','').padEnd(6,'0')
  return rgb(
    parseInt(c.slice(0,2),16)/255,
    parseInt(c.slice(2,4),16)/255,
    parseInt(c.slice(4,6),16)/255,
  )
}

// ─── Font picker ──────────────────────────────────────────────────────────
// pdf-lib's built-in path only has the 14 standard fonts. This is a browser
// fallback, not high-fidelity font preservation; the advanced engine should
// reuse embedded fonts or embed measured substitutes whenever possible.
function pickStdFont(block) {
  // Prefer pre-classified info if present
  const info   = classifyFont(block.fontName || block.stdFont || '')
  const family = block.stdFont  || info.family
  const bold   = block.fontBold   ?? info.bold
  const italic = block.fontItalic ?? info.italic

  if (family === 'Courier') {
    if (bold && italic) return StandardFonts.CourierBoldOblique
    if (bold)           return StandardFonts.CourierBold
    if (italic)         return StandardFonts.CourierOblique
    return StandardFonts.Courier
  }
  if (family === 'Times-Roman') {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic
    if (bold)           return StandardFonts.TimesRomanBold
    if (italic)         return StandardFonts.TimesRomanItalic
    return StandardFonts.TimesRoman
  }
  // Everything else → Helvetica family
  if (bold && italic) return StandardFonts.HelveticaBoldOblique
  if (bold)           return StandardFonts.HelveticaBold
  if (italic)         return StandardFonts.HelveticaOblique
  return StandardFonts.Helvetica
}

// ─── Coordinate conversion ────────────────────────────────────────────────
// Canvas coords (BASE_SCALE px, top-left origin)
//   → PDF user-space points (bottom-left origin)
//
// Derivation:
//   cy = top of glyph in canvas px
//   baseline_canvas = cy + fontSize_canvas * 1.0  (CSS lineHeight=1.25, baseline at ~80% → matches tx[5])
//   baseline_pts = baseline_canvas / BASE_SCALE
//   pdf_y = pageHeight_pts - baseline_pts
function canvasToPdf(cx, cy, cFontSize, pageH, cBaselineOffset) {
  const x        = cx / BASE_SCALE
  const size     = Math.max(cFontSize / BASE_SCALE, 1)
  const baseline = (cy + (cBaselineOffset ?? cFontSize * 0.8)) / BASE_SCALE
  const y        = pageH - baseline
  return { x, y, size }
}

const pageFontKeyCache = new WeakMap()

function getPageFontKey(page, font) {
  let pageCache = pageFontKeyCache.get(page)
  if (!pageCache) {
    pageCache = new Map()
    pageFontKeyCache.set(page, pageCache)
  }

  const ref = font?.ref
  const key = `${font?.name || 'font'}:${ref?.objectNumber ?? ''}:${ref?.generationNumber ?? ''}`
  if (!pageCache.has(key)) {
    pageCache.set(key, page.node.newFontDictionary(font.name, font.ref))
  }
  return pageCache.get(key)
}

function normalizeHorizontalScale(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 100
  return n <= 10 ? n * 100 : n
}

function fontSupportsText(font, text) {
  try {
    const supported = new Set(font.getCharacterSet?.() || [])
    if (!supported.size) return false

    for (const ch of textChars(text)) {
      if (ch === '\n' || ch === '\r' || ch === '\t') continue
      if (!supported.has(ch.codePointAt(0))) return false
    }

    return true
  } catch {
    return false
  }
}

function drawVectorTextLine(page, text, options, block, spacing = 0) {
  const encoded = options.font.encodeText(text)
  const fontKey = getPageFontKey(page, options.font)
  const angle = (Number(block.rotation) || 0) * Math.PI / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const charSpacing = (Number(block.charSpacing) || 0) + (Number(spacing) || 0)
  const wordSpacing = Number(block.wordSpacing) || 0
  const horizontalScale = normalizeHorizontalScale(block.horizontalScale)
  const renderingMode = Number.isFinite(Number(block.textRenderingMode))
    ? Number(block.textRenderingMode)
    : 0

  page.pushOperators(
    pushGraphicsState(),
    beginText(),
    setFillingColor(options.color),
    setFontAndSize(fontKey, options.size),
    setCharacterSpacing(charSpacing),
    setWordSpacing(wordSpacing),
    setCharacterSqueeze(horizontalScale),
    setTextRenderingMode(renderingMode),
    setTextMatrix(cos, sin, -sin, cos, options.x, options.y),
    showText(encoded),
    endText(),
    popGraphicsState(),
  )
}

function drawLineWithSpacing(page, text, options, spacing = 0, block = {}) {
  const chars = textChars(text)
  if (!chars.length) return

  try {
    drawVectorTextLine(page, text, options, block, spacing)
    return
  } catch (_) {
    // Fall back to pdf-lib's public drawText path for fonts that cannot encode
    // the edited string. The caller will retry with Helvetica if this also fails.
    if (!spacing) {
      page.drawText(text, options)
      return
    }
  }

  let cursorX = options.x
  for (const ch of chars) {
    if (ch !== ' ') page.drawText(ch, { ...options, x: cursorX })
    cursorX += options.font.widthOfTextAtSize(ch, options.size) + spacing
  }
}

function drawFittedText(page, text, options, block) {
  const preserveWidth = Boolean(block.isEdited && block.originalWidth)
  const explicitLines = splitTextLines(text)
  const layout = layoutTextForBlock({
    block,
    text,
    font: options.font,
    size: options.size,
    baseScale: BASE_SCALE,
    preserveWidth,
  })

  layout.lines.forEach((line, index) => {
    const y = options.y - index * layout.lineHeight
    const lineOptions = { ...options, y, size: line.size }
    if (!explicitLines[index]?.length) return
    drawLineWithSpacing(page, line.text, lineOptions, line.characterSpacing, block)
  })

  return {
    status: layout.status,
    overflow: layout.overflow,
    lineCount: layout.lines.length,
  }
}

// ─── Whiteout helpers ─────────────────────────────────────────────────────
function whiteoutBlock(page, block, pageH, bgRgb) {
  const source = {
    x: block.originalX ?? block.x,
    y: block.originalY ?? block.y,
    width: block.originalWidth ?? block.width,
    height: block.originalHeight ?? block.height,
    fontSize: block.originalFontSize ?? block.fontSize ?? 12,
    baselineOffset: block.originalBaselineOffset ?? block.baselineOffset,
  }
  const { x, y, size } = canvasToPdf(source.x, source.y, source.fontSize, pageH, source.baselineOffset)
  const w = (source.width || source.fontSize * 6) / BASE_SCALE + 6
  const h = (source.height || source.fontSize) / BASE_SCALE + 2
  page.drawRectangle({
    x: x - 2,
    y: y - size * 0.2,
    width: w,
    height: h + size * 0.2,
    color: bgRgb,
  })
}

function parseRgbString(str) {
  if (!str) return rgb(1,1,1)
  const m = str.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (m) return rgb(+m[1]/255, +m[2]/255, +m[3]/255)
  return rgb(1,1,1)
}

function rgbArrayToCss([r, g, b]) {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
}

function sampleCanvasBg(ctx, canvas, x, y, w, h, fallback = 'rgb(255,255,255)') {
  try {
    const pts = []
    const offset = 2
    const step = Math.max(Math.round(Math.min(w, h, 10) / 2), 2)
    for (let px = x; px <= x + w; px += step) {
      pts.push([px, y - offset], [px, y + h + offset])
    }
    for (let py = y; py <= y + h; py += step) {
      pts.push([x - offset, py], [x + w + offset, py])
    }

    const colors = pts
      .map(([px, py]) => [Math.round(px), Math.round(py)])
      .filter(([px, py]) => px >= 0 && py >= 0 && px < canvas.width && py < canvas.height)
      .map(([px, py]) => [...ctx.getImageData(px, py, 1, 1).data].slice(0, 3))

    if (!colors.length) return fallback
    const median = (idx) => {
      const sorted = colors.map(c => c[idx]).sort((a, b) => a - b)
      return sorted[sorted.length >> 1]
    }
    return rgbArrayToCss([median(0), median(1), median(2)])
  } catch {
    return fallback
  }
}

function normalizeWatermarkFamily(fontFamily = 'Helvetica') {
  const raw = String(fontFamily || 'Helvetica').toLowerCase()
  if (raw.includes('times') || raw.includes('georgia') || raw.includes('serif')) return 'Times-Roman'
  if (raw.includes('courier') || raw.includes('mono')) return 'Courier'
  return 'Helvetica'
}

function pickWatermarkFontName(fontFamily = 'Helvetica', bold = false, italic = false) {
  const family = normalizeWatermarkFamily(fontFamily)
  if (family === 'Courier') {
    if (bold && italic) return StandardFonts.CourierBoldOblique
    if (bold) return StandardFonts.CourierBold
    if (italic) return StandardFonts.CourierOblique
    return StandardFonts.Courier
  }
  if (family === 'Times-Roman') {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic
    if (bold) return StandardFonts.TimesRomanBold
    if (italic) return StandardFonts.TimesRomanItalic
    return StandardFonts.TimesRoman
  }
  if (bold && italic) return StandardFonts.HelveticaBoldOblique
  if (bold) return StandardFonts.HelveticaBold
  if (italic) return StandardFonts.HelveticaOblique
  return StandardFonts.Helvetica
}

function normalizeWatermarkOptions(textOrOptions, maybeOptions = {}) {
  if (typeof textOrOptions === 'string') {
    return {
      type: 'text',
      text: textOrOptions,
      fontFamily: 'Helvetica',
      bold: true,
      italic: false,
      color: '#737373',
      fontSize: 52,
      opacity: 0.13,
      rotation: -45,
      positionPreset: 'center',
      offsetX: 0,
      offsetY: 0,
      tiled: false,
      imageScale: 28,
      targetPages: null,
      ...maybeOptions,
    }
  }

  const options = textOrOptions || {}
  return {
    type: options.type || (options.imageBytes ? 'image' : 'text'),
    text: options.text || 'CONFIDENTIAL',
    fontFamily: options.fontFamily || 'Helvetica',
    bold: options.bold ?? true,
    italic: options.italic ?? false,
    color: options.color || '#737373',
    fontSize: options.fontSize ?? 52,
    opacity: options.opacity ?? 0.13,
    rotation: options.rotation ?? -45,
    positionPreset: options.positionPreset || 'center',
    offsetX: options.offsetX ?? 0,
    offsetY: options.offsetY ?? 0,
    tiled: options.tiled ?? false,
    imageBytes: options.imageBytes || null,
    imageType: options.imageType || '',
    imageScale: options.imageScale ?? 28,
    targetPages: options.targetPages || null,
  }
}

function normalizeInputToArrayBuffer(input) {
  if (input?.arrayBuffer) return input.arrayBuffer()
  return Promise.resolve(input)
}

function resolveTargetPages(totalPages, targetPages) {
  if (!Array.isArray(targetPages) || targetPages.length === 0) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  return [...new Set(targetPages.map(Number))]
    .filter((page) => Number.isFinite(page) && page >= 1 && page <= totalPages)
    .sort((a, b) => a - b)
}

function getPresetPosition(preset, pageWidth, pageHeight, markWidth, markHeight, margin = 24) {
  switch (preset) {
    case 'top-left':
      return { x: margin, y: margin }
    case 'top-right':
      return { x: pageWidth - markWidth - margin, y: margin }
    case 'bottom-left':
      return { x: margin, y: pageHeight - markHeight - margin }
    case 'bottom-right':
      return { x: pageWidth - markWidth - margin, y: pageHeight - markHeight - margin }
    case 'top':
    case 'top-center':
      return { x: (pageWidth - markWidth) / 2, y: margin }
    case 'bottom':
    case 'bottom-center':
      return { x: (pageWidth - markWidth) / 2, y: pageHeight - markHeight - margin }
    case 'center':
    default:
      return { x: (pageWidth - markWidth) / 2, y: (pageHeight - markHeight) / 2 }
  }
}

function buildWatermarkPlacements(pageWidth, pageHeight, markWidth, markHeight, options) {
  const offsetX = Number(options.offsetX) || 0
  const offsetY = Number(options.offsetY) || 0

  if (!options.tiled) {
    const base = getPresetPosition(options.positionPreset, pageWidth, pageHeight, markWidth, markHeight)
    return [{ x: base.x + offsetX, y: base.y + offsetY }]
  }

  const stepX = markWidth + Math.max(markWidth * 0.65, 30)
  const stepY = markHeight + Math.max(markHeight * 0.9, 24)
  const startX = (-markWidth * 0.4) + offsetX
  const startY = (-markHeight * 0.3) + offsetY
  const placements = []

  for (let row = 0, y = startY; y < pageHeight + markHeight; row += 1, y += stepY) {
    const rowShift = row % 2 === 0 ? 0 : stepX / 2
    for (let x = startX - rowShift; x < pageWidth + markWidth; x += stepX) {
      placements.push({ x, y })
    }
  }

  return placements
}

// ─── Safe text encoding ────────────────────────────────────────────────────
// pdf-lib standard fonts only support WinAnsiEncoding (latin-1, chars 32-255).
// Anything outside that range must be stripped or substituted.
function sanitize(str) {
  return [...(str || '')]
    .map(ch => {
      if (ch === '\n') return '\n'
      if (ch === '\t') return ' '
      const code = ch.charCodeAt(0)
      if (code >= 32 && code <= 255) return ch
      // Common unicode → latin substitutions
      const subs = {
        '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"',
        '\u2013': '-', '\u2014': '-', '\u2026': '...', '\u00A0': ' ',
        '\u00AD': '-', '\u2022': '*', '\u2212': '-', '\u00B7': '.',
      }
      return subs[ch] || ''
    })
    .join('')
}

function canvasToPngBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Could not encode flattened page'))
        return
      }
      resolve(await blob.arrayBuffer())
    }, 'image/png')
  })
}

function drawVisualCover(ctx, canvas, block, scale, fallbackBg) {
  const fontSize = block.originalFontSize || block.fontSize || 12
  const x = (block.originalX ?? block.x ?? 0) * scale
  const y = (block.originalY ?? block.y ?? 0) * scale
  const w = Math.max((block.originalWidth || block.width || fontSize * 4) * scale, 1)
  const h = Math.max((block.originalHeight || block.height || fontSize) * scale, 1)
  const bg = sampleCanvasBg(ctx, canvas, x, y, w, h, fallbackBg)
  const pad = 2 * scale

  ctx.save()
  ctx.filter = `blur(${Math.max(1, scale)}px)`
  ctx.fillStyle = bg
  ctx.fillRect(x - 0.75 * scale, y - pad, w + pad * 2, h + pad * 2)
  ctx.restore()
}

function drawVisualText(ctx, block, scale) {
  const text = String(block.str || '')
  if (!text.trim()) return

  const sourceSize = block.fontSize || 12
  const fontSize = Math.max(sourceSize, 4) * scale
  const weight = block.fontBold ? '700' : '400'
  const style = block.fontItalic ? 'italic' : 'normal'
  const family = block.fontFamily || 'Arial, Helvetica, sans-serif'
  const baselineOffset = (block.baselineOffset ?? sourceSize * 0.8) * scale
  const lineHeight = Math.max(block.lineHeight || block.height || sourceSize, sourceSize) * scale
  const x = (block.x || 0) * scale
  const y = (block.y || 0) * scale + baselineOffset

  ctx.save()
  ctx.fillStyle = block.color || '#000000'
  ctx.font = `${style} ${weight} ${fontSize}px ${family}`
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  const angle = (Number(block.rotation) || 0) * Math.PI / 180
  ctx.translate(x, y)
  if (angle) ctx.rotate(angle)

  splitTextLines(text).forEach((line, index) => {
    if (line) ctx.fillText(line, 0, index * lineHeight)
  })

  ctx.restore()
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

async function drawVisualAnnotations(ctx, annotations, scale) {
  for (const ann of annotations || []) {
    const x = (ann.x || 0) * scale
    const y = (ann.y || 0) * scale
    const w = (ann.width || 0) * scale
    const h = (ann.height || 0) * scale

    ctx.save()
    if (ann.type === 'highlight') {
      ctx.globalAlpha = 0.4
      ctx.fillStyle = 'rgb(255,235,38)'
      ctx.fillRect(x, y, w, h)
    } else if (ann.type === 'whiteout') {
      ctx.fillStyle = ann.color || '#ffffff'
      ctx.fillRect(x, y, w, h)
    } else if (ann.type === 'redact') {
      ctx.fillStyle = '#000000'
      ctx.fillRect(x, y, w, h)
    } else if (ann.type === 'rect') {
      ctx.strokeStyle = ann.color || '#10b981'
      ctx.lineWidth = 2 * scale
      ctx.strokeRect(x, y, w, h)
    } else if (ann.type === 'ellipse') {
      ctx.strokeStyle = ann.color || '#10b981'
      ctx.lineWidth = 2 * scale
      ctx.beginPath()
      ctx.ellipse(x + w / 2, y + h / 2, Math.max(w / 2, 1), Math.max(h / 2, 1), 0, 0, Math.PI * 2)
      ctx.stroke()
    } else if (ann.type === 'check') {
      ctx.strokeStyle = ann.color || '#10b981'
      ctx.lineWidth = 3 * scale
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(x + w * 0.2, y + h * 0.5)
      ctx.lineTo(x + w * 0.45, y + h * 0.75)
      ctx.lineTo(x + w * 0.85, y + h * 0.25)
      ctx.stroke()
    } else if (ann.type === 'cross') {
      ctx.strokeStyle = ann.color || '#ef4444'
      ctx.lineWidth = 3 * scale
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x + w * 0.2, y + h * 0.2)
      ctx.lineTo(x + w * 0.8, y + h * 0.8)
      ctx.moveTo(x + w * 0.8, y + h * 0.2)
      ctx.lineTo(x + w * 0.2, y + h * 0.8)
      ctx.stroke()
    } else if ((ann.type === 'image' || ann.type === 'sign') && ann.dataUrl) {
      try {
        const img = await loadImageFromDataUrl(ann.dataUrl)
        ctx.drawImage(img, x, y, w, h)
      } catch (_) {}
    }
    ctx.restore()
  }
}

function layerHasVisualEdits(layer) {
  if (!layer) return false

  const hasTextEdits = (layer.texts || []).some((block) => {
    if (block?.isEdited) return true
    return Boolean(String(block?.str || '').trim())
  })

  return hasTextEdits || Boolean((layer.annotations || []).length)
}

async function exportVisualPdf(originalArrayBuffer, editLayers, pageCount, pageBgs, password = '') {
  const requestedPageCount = Number(pageCount) || 0
  const isEncrypted = Boolean(password)
  const requestedEditedPages = new Set()

  for (let i = 1; i <= requestedPageCount; i++) {
    if (isEncrypted || layerHasVisualEdits(editLayers?.[i])) requestedEditedPages.add(i)
  }

  if (!isEncrypted && !requestedEditedPages.size) {
    return new Uint8Array(originalArrayBuffer.slice(0))
  }

  const srcTask = pdfjsLib.getDocument({
    data: originalArrayBuffer.slice(0),
    fontExtraProperties: true,
    ...(password ? { password } : {}),
  })
  const src = await srcTask.promise
  const out = await PDFDocument.create()
  const renderScale = 3

  try {
    let totalPages = requestedPageCount || src.numPages
    let originalDoc = null
    const copiedUneditedPages = new Map()

    if (!isEncrypted) {
      originalDoc = await PDFDocument.load(originalArrayBuffer.slice(0), { ignoreEncryption: true })
      totalPages = Math.min(
        totalPages,
        src.numPages,
        originalDoc.getPageCount(),
      )
      const editedPages = new Set(
        [...requestedEditedPages].filter((pageNum) => pageNum >= 1 && pageNum <= totalPages)
      )
      const uneditedPageNums = []

      for (let i = 1; i <= totalPages; i++) {
        if (!editedPages.has(i)) uneditedPageNums.push(i)
      }

      if (uneditedPageNums.length) {
        const copiedPages = await out.copyPages(originalDoc, uneditedPageNums.map((pageNum) => pageNum - 1))
        copiedPages.forEach((page, index) => {
          copiedUneditedPages.set(uneditedPageNums[index], page)
        })
      }
    }

    for (let i = 1; i <= totalPages; i++) {
      if (!isEncrypted && copiedUneditedPages.has(i)) {
        const copiedPage = copiedUneditedPages.get(i)
        if (copiedPage) out.addPage(copiedPage)
        continue
      }

      const page = await src.getPage(i)
      const viewport = page.getViewport({ scale: renderScale })
      const baseViewport = page.getViewport({ scale: 1 })
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { alpha: false })

      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport }).promise

      const layer = editLayers?.[i] || { texts: [], annotations: [] }
      const coordScale = renderScale / BASE_SCALE
      const fallbackBg = pageBgs?.[i] || 'rgb(255,255,255)'

      for (const block of layer.texts || []) {
        if (block.isEdited) drawVisualCover(ctx, canvas, block, coordScale, fallbackBg)
      }
      for (const block of layer.texts || []) {
        drawVisualText(ctx, block, coordScale)
      }
      await drawVisualAnnotations(ctx, layer.annotations, coordScale)

      const pngBytes = await canvasToPngBytes(canvas)
      const png = await out.embedPng(pngBytes)
      const outPage = out.addPage([baseViewport.width, baseViewport.height])
      outPage.drawImage(png, {
        x: 0,
        y: 0,
        width: baseViewport.width,
        height: baseViewport.height,
      })

      canvas.width = 1
      canvas.height = 1
    }

    return await out.save({ useObjectStreams: true, addDefaultPage: false })
  } finally {
    await srcTask.destroy()
  }
}

// ─── Fontkit GPOS patch & font byte loaders ───────────────────────────────
let gposPatched = false
function patchFontkitGPOS(fontInstance) {
  if (gposPatched) return
  try {
    const fkFont = fontInstance?.embedder?.font || fontInstance
    const gpos = fkFont?._layoutEngine?.engine?.GPOSProcessor
    if (gpos) {
      const proto = Object.getPrototypeOf(gpos)
      if (proto && !proto._nullAnchorPatched) {
        const origGetAnchor = proto.getAnchor
        proto.getAnchor = function (anchor) {
          if (!anchor) return { x: 0, y: 0 }
          try {
            return origGetAnchor.call(this, anchor) || { x: 0, y: 0 }
          } catch {
            return { x: 0, y: 0 }
          }
        }
        const origApplyAnchor = proto.applyAnchor
        proto.applyAnchor = function (baseGlyphIndex, baseAnchor, markAnchor) {
          if (!baseAnchor || !markAnchor) return
          try {
            return origApplyAnchor.call(this, baseGlyphIndex, baseAnchor, markAnchor)
          } catch {
            return
          }
        }
        proto._nullAnchorPatched = true
        gposPatched = true
      }
    }
  } catch (_) {}
}

let devanagariFontBytesCache = null
let notoSansFontBytesCache = null

async function loadFontBytes(filename) {
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const res = await fetch(`/fonts/${filename}`)
    if (!res.ok) throw new Error(`Failed to load font /fonts/${filename}: ${res.statusText}`)
    return new Uint8Array(await res.arrayBuffer())
  }
  // Node.js environment
  try {
    const dynamicImport = new Function('m', 'return import(m)')
    const fs = await dynamicImport('fs')
    const path = await dynamicImport('path')
    const candidates = [
      path.resolve(process.cwd(), 'public/fonts', filename),
      path.resolve(process.cwd(), 'dist/fonts', filename),
      path.resolve(process.cwd(), 'scratch', filename),
    ]
    for (const p of candidates) {
      if (fs.existsSync(p)) return new Uint8Array(fs.readFileSync(p))
    }
  } catch (_) {}
  throw new Error(`Font file ${filename} not found`)
}

async function getDevanagariFontBytes() {
  if (devanagariFontBytesCache) return devanagariFontBytesCache
  devanagariFontBytesCache = await loadFontBytes('NotoSansDevanagari-Regular.ttf')
  try {
    const sample = fontkit.create(devanagariFontBytesCache)
    patchFontkitGPOS(sample)
  } catch (_) {}
  return devanagariFontBytesCache
}

async function getNotoSansFontBytes() {
  if (notoSansFontBytesCache) return notoSansFontBytesCache
  notoSansFontBytesCache = await loadFontBytes('NotoSans-Regular.ttf')
  try {
    const sample = fontkit.create(notoSansFontBytesCache)
    patchFontkitGPOS(sample)
  } catch (_) {}
  return notoSansFontBytesCache
}

function hasDevanagari(text) {
  return /[\u0900-\u097F]/.test(text)
}

function isWinAnsi(str) {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code === 10 || code === 13 || code === 9) continue
    if (code < 32 || code > 255) return false
  }
  return true
}

async function getVectorFont(pdfDoc, block, pageNum, text = '', fontCache = {}) {
  // CRITICAL: NEVER embed with { subset: true } here.
  // @pdf-lib/fontkit@1.1.1 silently corrupts TrueType subsets (loca table written
  // in short format without carrying the source long format) — glyphs come out
  // with ZERO outline commands and NULL bbox, i.e. INVISIBLE text, with NO error
  // thrown (verified: glyph 'A' -> 0 commands with subset:true, 8 with subset:false).
  // Since no exception occurs, the raster fallback never triggers and the user
  // gets whiteout + blank text ("edited naam gayab"). Full embed costs more bytes
  // but ALWAYS renders. Correctness > file size for edited text.
  // 1. Devanagari / Hindi characters -> NotoSansDevanagari
  if (hasDevanagari(text)) {
    const cacheKey = 'embedded:NotoSansDevanagari'
    if (!fontCache[cacheKey]) {
      const bytes = await getDevanagariFontBytes()
      const font = await pdfDoc.embedFont(bytes, { subset: false })
      patchFontkitGPOS(font)
      fontCache[cacheKey] = font
    }
    return fontCache[cacheKey]
  }

  // 2. Non-WinAnsi Unicode characters -> NotoSans
  if (!isWinAnsi(text)) {
    const cacheKey = 'embedded:NotoSans'
    if (!fontCache[cacheKey]) {
      const bytes = await getNotoSansFontBytes()
      const font = await pdfDoc.embedFont(bytes, { subset: false })
      patchFontkitGPOS(font)
      fontCache[cacheKey] = font
    }
    return fontCache[cacheKey]
  }

  // 3. ASCII / WinAnsi characters:
  // First check if original embedded font from PDF supports this text:
  const embedded = getEmbeddedFontData(pageNum, block.fontResource, block.fontName)
  if (embedded?.bytes?.byteLength) {
    const embeddedKey = [
      'embedded',
      pageNum,
      block.fontResource?.internalName || '',
      embedded.name || block.fontName || 'font',
      embedded.bytes.byteLength,
    ].join(':')
    try {
      if (!fontCache[embeddedKey]) {
        // subset:false — see CRITICAL note above (subset:true => invisible glyphs)
        fontCache[embeddedKey] = await pdfDoc.embedFont(embedded.bytes, { subset: false })
        patchFontkitGPOS(fontCache[embeddedKey])
      }
      if (text) {
        if (!fontSupportsText(fontCache[embeddedKey], text)) {
          throw new Error('Embedded font subset cannot render replacement text')
        }
        fontCache[embeddedKey].widthOfTextAtSize(text, Math.max((block.fontSize || 12) / BASE_SCALE, 1))
        fontCache[embeddedKey].encodeText(text)
      }
      return fontCache[embeddedKey]
    } catch (_) {
      delete fontCache[embeddedKey]
    }
  }

  // Standard font fallback
  const key = pickStdFont(block)
  if (!fontCache[key]) {
    fontCache[key] = await pdfDoc.embedFont(key)
  }
  return fontCache[key]
}

function whiteoutBlockRotated(page, vp, block, bgRgb) {
  const source = {
    x: block.originalX ?? block.x,
    y: block.originalY ?? block.y,
    width: block.originalWidth ?? block.width,
    height: block.originalHeight ?? block.height,
    fontSize: block.originalFontSize ?? block.fontSize ?? 12,
  }
  const avx = source.x / BASE_SCALE
  const avy = source.y / BASE_SCALE
  const avw = (source.width || source.fontSize * 4) / BASE_SCALE
  const avh = (source.height || source.fontSize) / BASE_SCALE
  const pad = 2

  const p1 = vp.convertToPdfPoint(avx - pad, avy - pad)
  const p2 = vp.convertToPdfPoint(avx + avw + pad, avy + avh + pad)
  const minX = Math.min(p1[0], p2[0])
  const minY = Math.min(p1[1], p2[1])
  const w = Math.abs(p1[0] - p2[0])
  const h = Math.abs(p1[1] - p2[1])

  page.drawRectangle({
    x: minX,
    y: minY,
    width: w,
    height: h,
    color: bgRgb,
  })
}

async function rasterFlattenPage(pdfDoc, pdfjsDoc, pageNum, layer, pageBgs) {
  const pageIndex = pageNum - 1
  const origPage = pdfDoc.getPages()[pageIndex]
  const { width: pageW, height: pageH } = origPage.getSize()

  const pdfjsPage = await pdfjsDoc.getPage(pageNum)
  const renderScale = 3
  const viewport = pdfjsPage.getViewport({ scale: renderScale })
  const baseViewport = pdfjsPage.getViewport({ scale: 1 })

  let canvas = null
  let ctx = null
  if (typeof document !== 'undefined' && document.createElement) {
    canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(viewport.width))
    canvas.height = Math.max(1, Math.round(viewport.height))
    ctx = canvas.getContext('2d', { alpha: false })
  } else {
    // In Node.js testing environment (if canvas module is available)
    try {
      const dynamicImport = new Function('m', 'return import(m)')
      const { createCanvas } = await dynamicImport('canvas')
      if (createCanvas) {
        canvas = createCanvas(Math.max(1, Math.round(viewport.width)), Math.max(1, Math.round(viewport.height)))
        ctx = canvas.getContext('2d')
      }
    } catch (_) {}
  }

  if (!canvas || !ctx) {
    // Fallback if canvas is unavailable in pure node test:
    // Insert a new clean page without the original content stream and apply redactions
    const newPage = pdfDoc.insertPage(pageIndex, [pageW, pageH])
    pdfDoc.removePage(pageIndex + 1)
    for (const ann of layer.annotations || []) {
      if (ann.type === 'redact') {
        const avx = (ann.x || 0) / BASE_SCALE
        const avy = (ann.y || 0) / BASE_SCALE
        const avw = (ann.width || 0) / BASE_SCALE
        const avh = (ann.height || 0) / BASE_SCALE
        const p1 = baseViewport.convertToPdfPoint(avx, avy)
        const p2 = baseViewport.convertToPdfPoint(avx + avw, avy + avh)
        newPage.drawRectangle({
          x: Math.min(p1[0], p2[0]),
          y: Math.min(p1[1], p2[1]),
          width: Math.abs(p1[0] - p2[0]),
          height: Math.abs(p1[1] - p2[1]),
          color: rgb(0, 0, 0),
        })
      }
    }
    return
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await pdfjsPage.render({ canvasContext: ctx, viewport }).promise

  const coordScale = renderScale / BASE_SCALE
  const fallbackBg = pageBgs?.[pageNum] || 'rgb(255,255,255)'

  for (const block of layer.texts || []) {
    if (block.isEdited) drawVisualCover(ctx, canvas, block, coordScale, fallbackBg)
  }
  for (const block of layer.texts || []) {
    drawVisualText(ctx, block, coordScale)
  }
  await drawVisualAnnotations(ctx, layer.annotations, coordScale)

  const pngBytes = await canvasToPngBytes(canvas)
  const png = await pdfDoc.embedPng(pngBytes)

  // Replace page: insert new page and remove old page containing sensitive stream
  const newPage = pdfDoc.insertPage(pageIndex, [baseViewport.width, baseViewport.height])
  pdfDoc.removePage(pageIndex + 1)

  newPage.drawImage(png, {
    x: 0,
    y: 0,
    width: baseViewport.width,
    height: baseViewport.height,
  })

  canvas.width = 1
  canvas.height = 1
}

async function exportVectorPage(pdfDoc, pdfjsDoc, pageNum, layer, pageBgs, blockBgs, fontCache) {
  const page = pdfDoc.getPages()[pageNum - 1]
  if (!page) return

  const pdfjsPage = await pdfjsDoc.getPage(pageNum)
  const vp = pdfjsPage.getViewport({ scale: 1 })
  const pageRotation = page.getRotation().angle || 0

  // 1. Cover/whiteout original edited text
  const bgRgb = pageBgs?.[pageNum]
    ? parseRgbString(pageBgs[pageNum].replace('rgb(', '').replace(')', ''))
    : rgb(1, 1, 1)

  for (const block of layer.texts || []) {
    if (!block.isEdited) continue
    const localBgStr = blockBgs?.[pageNum]?.[block.id]
    const blockRgb = localBgStr
      ? parseRgbString(localBgStr.replace('rgb(', '').replace(')', ''))
      : bgRgb
    whiteoutBlockRotated(page, vp, block, blockRgb)
  }

  // 2. Draw replacement and new text (per-block isolated: one bad font/glyph
  //    run can never kill the whole page — it falls back to Helvetica, and only
  //    if even Helvetica fails does the page go to raster flattening)
  for (const block of layer.texts || []) {
    const text = String(block.str || '')
    if (!text.trim()) continue

    let font
    try {
      font = await getVectorFont(pdfDoc, block, pageNum, text, fontCache)
    } catch (fontErr) {
      console.warn(`Font resolve failed for block ${block.id}, using Helvetica:`, fontErr?.message)
      const fallbackKey = `fallback:${pickStdFont({ ...block, fontName: 'Helvetica', stdFont: 'Helvetica', fontBold: false, fontItalic: false })}`
      if (!fontCache[fallbackKey]) fontCache[fallbackKey] = await pdfDoc.embedFont(StandardFonts.Helvetica)
      font = fontCache[fallbackKey]
    }
    // Contrast safety (mirrors the on-screen guard): the replacement must never
    // be painted in the whiteout color — that renders literally invisible text.
    const blockBgCss = blockBgs?.[pageNum]?.[block.id] || pageBgs?.[pageNum] || 'rgb(255,255,255)'
    const color = hexToRgb(ensureTextContrast(block.color || '#000000', blockBgCss))

    const vx = (block.x || 0) / BASE_SCALE
    const fontSizePts = Math.max((block.fontSize || 12) / BASE_SCALE, 1)
    const baselineOffsetPts = (block.baselineOffset ?? (block.fontSize || 12) * 0.8) / BASE_SCALE
    const vyBaseline = (block.y || 0) / BASE_SCALE + baselineOffsetPts

    const textAngle = ((Number(block.rotation) || 0) + pageRotation) % 360
    const explicitLines = splitTextLines(text)
    const lineHeightPts = Math.max(
      (block.lineHeight || block.height || block.fontSize || 12) / BASE_SCALE,
      fontSizePts * 1.2
    )

    for (let k = 0; k < explicitLines.length; k++) {
      const lineText = explicitLines[k]
      if (!lineText) continue
      const lineVy = vyBaseline + k * lineHeightPts
      const linePBase = vp.convertToPdfPoint(vx, lineVy)

      try {
        page.drawText(lineText, {
          x: linePBase[0],
          y: linePBase[1],
          size: fontSizePts,
          font,
          color,
          rotate: degrees(textAngle),
        })
      } catch (drawErr) {
        // Last resort for this block: plain Helvetica (WinAnsi-sanitized).
        // If even this throws, let it bubble to the page-level raster fallback.
        console.warn(`drawText failed for block ${block.id}, retrying with Helvetica:`, drawErr?.message)
        const fbKey = 'fallback:Helvetica'
        if (!fontCache[fbKey]) fontCache[fbKey] = await pdfDoc.embedFont(StandardFonts.Helvetica)
        page.drawText(sanitize(lineText) || ' ', {
          x: linePBase[0],
          y: linePBase[1],
          size: fontSizePts,
          font: fontCache[fbKey],
          color,
          rotate: degrees(textAngle),
        })
      }
    }
  }

  // 3. Annotations
  for (const ann of layer.annotations || []) {
    if (ann.type === 'redact') continue // handled by true redaction
    const avx = (ann.x || 0) / BASE_SCALE
    const avy = (ann.y || 0) / BASE_SCALE
    const avw = (ann.width || 0) / BASE_SCALE
    const avh = (ann.height || 0) / BASE_SCALE

    const p1 = vp.convertToPdfPoint(avx, avy)
    const p2 = vp.convertToPdfPoint(avx + avw, avy + avh)
    const minX = Math.min(p1[0], p2[0])
    const minY = Math.min(p1[1], p2[1])
    const w = Math.abs(p1[0] - p2[0])
    const h = Math.abs(p1[1] - p2[1])

    if (ann.type === 'highlight') {
      page.drawRectangle({
        x: minX,
        y: minY,
        width: w,
        height: h,
        color: rgb(1, 0.92, 0.15),
        opacity: 0.4,
      })
    } else if (ann.type === 'whiteout') {
      page.drawRectangle({
        x: minX,
        y: minY,
        width: w,
        height: h,
        color: ann.color ? hexToRgb(ann.color) : rgb(1, 1, 1),
      })
    } else if (ann.type === 'rect') {
      page.drawRectangle({
        x: minX,
        y: minY,
        width: w,
        height: h,
        borderColor: hexToRgb(ann.color || '#10b981'),
        borderWidth: 1.5,
        opacity: 0,
      })
    } else if (ann.type === 'ellipse') {
      page.drawEllipse({
        x: minX + w / 2,
        y: minY + h / 2,
        xScale: Math.max(w / 2, 1),
        yScale: Math.max(h / 2, 1),
        borderColor: hexToRgb(ann.color || '#10b981'),
        borderWidth: 1.5,
        opacity: 0,
      })
    } else if (ann.type === 'check') {
      const strokeColor = hexToRgb(ann.color || '#10b981')
      const pStart = vp.convertToPdfPoint(avx + avw * 0.2, avy + avh * 0.5)
      const pMid = vp.convertToPdfPoint(avx + avw * 0.45, avy + avh * 0.75)
      const pEnd = vp.convertToPdfPoint(avx + avw * 0.85, avy + avh * 0.25)
      page.drawLine({ start: { x: pStart[0], y: pStart[1] }, end: { x: pMid[0], y: pMid[1] }, thickness: 2, color: strokeColor })
      page.drawLine({ start: { x: pMid[0], y: pMid[1] }, end: { x: pEnd[0], y: pEnd[1] }, thickness: 2, color: strokeColor })
    } else if (ann.type === 'cross') {
      const strokeColor = hexToRgb(ann.color || '#ef4444')
      const p1a = vp.convertToPdfPoint(avx + avw * 0.2, avy + avh * 0.2)
      const p1b = vp.convertToPdfPoint(avx + avw * 0.8, avy + avh * 0.8)
      const p2a = vp.convertToPdfPoint(avx + avw * 0.8, avy + avh * 0.2)
      const p2b = vp.convertToPdfPoint(avx + avw * 0.2, avy + avh * 0.8)
      page.drawLine({ start: { x: p1a[0], y: p1a[1] }, end: { x: p1b[0], y: p1b[1] }, thickness: 2, color: strokeColor })
      page.drawLine({ start: { x: p2a[0], y: p2a[1] }, end: { x: p2b[0], y: p2b[1] }, thickness: 2, color: strokeColor })
    } else if ((ann.type === 'image' || ann.type === 'sign') && ann.dataUrl) {
      try {
        const base64Data = ann.dataUrl.split(',')[1]
        if (base64Data) {
          const binaryString = atob(base64Data)
          const bytes = new Uint8Array(binaryString.length)
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j)
          }
          const isPng = ann.dataUrl.includes('image/png')
          const embedded = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes)
          page.drawImage(embedded, {
            x: minX,
            y: minY,
            width: w,
            height: h,
            rotate: degrees(pageRotation),
          })
        }
      } catch (_) {}
    }
  }
}

export async function exportVectorFirstPdf(
  originalArrayBuffer,
  editLayers,
  pageCount,
  pageBgs,
  blockBgs,
  onPageFallback = null,
  formFields = {},
  flattenForm = false
) {
  const pdfDoc = await PDFDocument.load(originalArrayBuffer.slice(0), { ignoreEncryption: true })
  pdfDoc.registerFontkit(fontkit)

  const pdfjsTask = pdfjsLib.getDocument({
    data: originalArrayBuffer.slice(0),
    fontExtraProperties: true,
  })
  const pdfjsDoc = await pdfjsTask.promise

  try {
    const totalPages = Math.min(
      Number(pageCount) || pdfjsDoc.numPages,
      pdfjsDoc.numPages,
      pdfDoc.getPageCount()
    )
    const fontCache = {}

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const layer = editLayers?.[pageNum]
      if (!layerHasVisualEdits(layer)) {
        // Page is untouched: keeps original stream, form fields, links, and annotations!
        continue
      }

      // Check if page has true redactions
      const hasRedaction = (layer.annotations || []).some(ann => ann.type === 'redact')
      if (hasRedaction) {
        try {
          await rasterFlattenPage(pdfDoc, pdfjsDoc, pageNum, layer, pageBgs)
          onPageFallback?.(pageNum, 'Redaction applied (content permanently removed)')
          continue
        } catch (err) {
          console.error(`Failed to flatten redacted page ${pageNum}:`, err)
        }
      }

      // Vector export
      try {
        await exportVectorPage(pdfDoc, pdfjsDoc, pageNum, layer, pageBgs, blockBgs, fontCache)
      } catch (err) {
        console.warn(`Vector export failed for page ${pageNum}, falling back to raster:`, err)
        try {
          await rasterFlattenPage(pdfDoc, pdfjsDoc, pageNum, layer, pageBgs)
          onPageFallback?.(pageNum, `Font/glyph embedding failed (${err.message})`)
        } catch (fallbackErr) {
          console.error(`Raster fallback also failed for page ${pageNum}:`, fallbackErr)
          throw fallbackErr
        }
      }
    }

    // Apply interactive AcroForm field values if provided
    if (formFields && Object.keys(formFields).length > 0) {
      try {
        const form = pdfDoc.getForm()
        for (const [fieldName, val] of Object.entries(formFields)) {
          try {
            const field = form.getField(fieldName)
            if (!field) continue

            if (typeof field.setText === 'function') {
              field.setText(String(val ?? ''))
            } else if (typeof field.check === 'function' && typeof field.uncheck === 'function') {
              if (val) {
                field.check()
              } else {
                field.uncheck()
              }
            } else if (typeof field.select === 'function') {
              try {
                field.select(String(val))
              } catch (err) {
                if (typeof field.getOptions === 'function') {
                  const opts = field.getOptions()
                  const num = Number(val)
                  if (Number.isInteger(num) && opts[num] !== undefined) {
                    field.select(opts[num])
                  } else {
                    const match = opts.find(o => String(o).toLowerCase() === String(val).toLowerCase())
                    if (match) field.select(match)
                  }
                }
              }
            }
          } catch (fErr) {
            console.warn(`Could not set form field "${fieldName}":`, fErr)
          }
        }
      } catch (formErr) {
        console.warn('Failed to access or populate AcroForm fields:', formErr)
      }
    }

    // Flatten form if requested
    if (flattenForm) {
      try {
        const form = pdfDoc.getForm()
        form.flatten()
      } catch (flattenErr) {
        console.warn('Failed to flatten AcroForm fields:', flattenErr)
      }
    }

    return await pdfDoc.save({ useObjectStreams: true, addDefaultPage: false })
  } finally {
    await pdfjsTask.destroy()
  }
}

export async function exportPdf(
  originalArrayBuffer,
  editLayers,
  pageCount,
  pageBgs,
  blockBgs,
  password = '',
  onPageFallback = null,
  formFields = {},
  flattenForm = false
) {
  // If encrypted PDF unlocked with password, use decrypted visual export
  if (password) {
    return await exportVisualPdf(originalArrayBuffer, editLayers, pageCount, pageBgs, password)
  }

  // Check if any edits exist across all pages or form field changes
  const requestedPageCount = Number(pageCount) || 0
  let hasAnyEdits = false
  for (let i = 1; i <= requestedPageCount; i++) {
    if (layerHasVisualEdits(editLayers?.[i])) {
      hasAnyEdits = true
      break
    }
  }

  const hasFormEdits = Boolean(
    (formFields && Object.keys(formFields).length > 0) || flattenForm
  )

  // If no edits at all, return untouched original bytes
  if (!hasAnyEdits && !hasFormEdits) {
    return new Uint8Array(originalArrayBuffer.slice(0))
  }

  // Vector-first export
  return await exportVectorFirstPdf(
    originalArrayBuffer,
    editLayers,
    pageCount,
    pageBgs,
    blockBgs,
    onPageFallback,
    formFields,
    flattenForm
  )
}

// ─── Standalone tool functions ─────────────────────────────────────────────
export async function mergePdfs(arrayBuffers) {
  const merged = await PDFDocument.create()
  for (const buf of arrayBuffers) {
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true })
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach(p => merged.addPage(p))
  }
  return await merged.save()
}

export async function splitPdf(arrayBuffer, ranges) {
  const src   = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const total = src.getPageCount()
  const out   = []
  for (const range of ranges) {
    const doc     = await PDFDocument.create()
    const indices = []
    for (let i = range.from-1; i < range.to && i < total; i++) indices.push(i)
    if (!indices.length) continue
    ;(await doc.copyPages(src, indices)).forEach(p => doc.addPage(p))
    out.push(await doc.save())
  }
  return out
}

export async function extractPages(arrayBuffer, pageNums) {
  const src     = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const doc     = await PDFDocument.create()
  const total   = src.getPageCount()
  const indices = [...new Set(pageNums.map(n=>n-1))]
    .filter(i=>i>=0&&i<total).sort((a,b)=>a-b)
  ;(await doc.copyPages(src, indices)).forEach(p => doc.addPage(p))
  return await doc.save()
}

export async function rotatePdf(arrayBuffer, pageNum, angle) {
  const doc  = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const page = doc.getPages()[pageNum-1]
  if (page) page.setRotation(degrees((page.getRotation().angle+angle)%360))
  return await doc.save()
}

export async function rotateAllPages(arrayBuffer, angle) {
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  doc.getPages().forEach(p => p.setRotation(degrees((p.getRotation().angle+angle)%360)))
  return await doc.save()
}

export async function removePageFromPdf(arrayBuffer, pageNum) {
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  if (doc.getPageCount()<=1) throw new Error('Cannot remove the only page')
  doc.removePage(pageNum-1)
  return await doc.save()
}

export async function addPageToPdf(arrayBuffer, position) {
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  doc.insertPage(position, [595.28,841.89])
  return await doc.save()
}

export async function reorderPages(arrayBuffer, newOrder) {
  const src = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const doc = await PDFDocument.create()
  ;(await doc.copyPages(src, newOrder.map(n=>n-1))).forEach(p => doc.addPage(p))
  return await doc.save()
}

export async function compressPdf(arrayBuffer) {
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption:true, updateMetadata:false })
  // Strip bulky metadata for extra savings (title/author/producer/subject/keywords)
  try {
    doc.setTitle('')
    doc.setAuthor('')
    doc.setSubject('')
    doc.setKeywords([])
    doc.setProducer('PDFZero')
    doc.setCreator('PDFZero (client-side)')
  } catch { /* metadata strip is best-effort */ }
  return await doc.save({ useObjectStreams:true, addDefaultPage:false })
}

/**
 * Smart one-click compress: lossless first, else single balanced visual pass.
 * Returns { bytes, mode, savedRatio } — keeps UI honest about text-select loss.
 */
export async function smartCompressPdf(arrayBuffer, onProgress) {
  const original = arrayBuffer.byteLength
  const lossless = await compressPdf(arrayBuffer)
  // If lossless already saves ≥10%, keep vectors + text selectable
  if (lossless.byteLength <= original * 0.9) {
    return { bytes: lossless, mode: 'lossless', reachedTarget: true }
  }
  // Else one balanced raster pass (scale 1.0, q0.70) — good size/quality tradeoff
  const bytes = await rasterCompressAttempt(arrayBuffer, 1.0, 0.7, onProgress, 0, 1)
  return {
    bytes,
    mode: bytes.byteLength < lossless.byteLength ? 'visual' : 'lossless',
    reachedTarget: true,
    ...(bytes.byteLength >= lossless.byteLength ? { bytes: lossless } : {}),
  }
}

function canvasToJpegBytes(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Could not encode page image'))
        return
      }
      resolve(await blob.arrayBuffer())
    }, 'image/jpeg', quality)
  })
}

function compressionAttempts(preset = 'balanced', targetRatio = 0.5) {
  const base = {
    high: [
      { scale: 1.6, quality: 0.9 }, { scale: 1.35, quality: 0.82 },
      { scale: 1.15, quality: 0.74 }, { scale: 1.0, quality: 0.66 },
      { scale: 0.85, quality: 0.58 }, { scale: 0.72, quality: 0.5 },
    ],
    balanced: [
      { scale: 1.25, quality: 0.82 }, { scale: 1.05, quality: 0.74 },
      { scale: 0.9, quality: 0.66 }, { scale: 0.76, quality: 0.58 },
      { scale: 0.64, quality: 0.5 }, { scale: 0.54, quality: 0.42 },
      { scale: 0.45, quality: 0.34 },
    ],
    small: [
      { scale: 0.95, quality: 0.7 }, { scale: 0.78, quality: 0.58 },
      { scale: 0.64, quality: 0.48 }, { scale: 0.52, quality: 0.38 },
      { scale: 0.42, quality: 0.3 }, { scale: 0.34, quality: 0.24 },
      { scale: 0.28, quality: 0.2 },
    ],
  }[preset] || []

  if (targetRatio < 0.18) return base.slice(Math.max(0, base.length - 5))
  if (targetRatio < 0.35) return base.slice(Math.max(0, base.length - 6))
  return base
}

async function rasterCompressAttempt(arrayBuffer, scale, quality, onProgress, attemptIndex, attemptCount) {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) })
  const src = await loadingTask.promise
  const out = await PDFDocument.create()

  try {
    for (let i = 1; i <= src.numPages; i++) {
      const page = await src.getPage(i)
      const baseViewport = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { alpha: false })
      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport }).promise

      const jpgBytes = await canvasToJpegBytes(canvas, quality)
      const jpg = await out.embedJpg(jpgBytes)
      const outPage = out.addPage([baseViewport.width, baseViewport.height])
      outPage.drawImage(jpg, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height })

      canvas.width = 1
      canvas.height = 1
      onProgress?.({
        attempt: attemptIndex + 1,
        attempts: attemptCount,
        page: i,
        pages: src.numPages,
        scale,
        quality,
      })
    }

    return await out.save({ useObjectStreams: true, addDefaultPage: false })
  } finally {
    await loadingTask.destroy()
  }
}

export async function compressPdfToTarget(arrayBuffer, options = {}) {
  const {
    targetBytes,
    preset = 'balanced',
    onProgress,
  } = options

  const originalBytes = arrayBuffer.byteLength
  if (!targetBytes || targetBytes <= 0) {
    const bytes = await compressPdf(arrayBuffer)
    return { bytes, mode: 'lossless', reachedTarget: !targetBytes || bytes.byteLength <= targetBytes }
  }

  const lossless = await compressPdf(arrayBuffer)
  if (lossless.byteLength <= targetBytes) {
    return { bytes: lossless, mode: 'lossless', reachedTarget: true }
  }

  const attempts = compressionAttempts(preset, targetBytes / originalBytes)
  let best = lossless
  let bestMeta = { mode: 'lossless', scale: 1, quality: 1 }

  for (let i = 0; i < attempts.length; i++) {
    const { scale, quality } = attempts[i]
    const bytes = await rasterCompressAttempt(arrayBuffer, scale, quality, onProgress, i, attempts.length)
    if (bytes.byteLength < best.byteLength) {
      best = bytes
      bestMeta = { mode: 'visual', scale, quality }
    }
    if (bytes.byteLength <= targetBytes) {
      return { bytes, ...bestMeta, reachedTarget: true }
    }
  }

  return { bytes: best, ...bestMeta, reachedTarget: best.byteLength <= targetBytes }
}

export async function protectPdf(arrayBuffer, password, options = {}) {
  if (!password) throw new Error('Password is required')
  const encrypted = await encryptPDF(new Uint8Array(arrayBuffer), password, {
    ownerPassword: options.ownerPassword || password,
    algorithm: options.algorithm || 'AES-256',
    allowPrinting: options.allowPrinting ?? true,
    allowModifying: options.allowModifying ?? false,
    allowCopying: options.allowCopying ?? false,
    allowAnnotating: options.allowAnnotating ?? false,
    allowFillingForms: options.allowFillingForms ?? true,
    allowExtraction: options.allowExtraction ?? true,
    allowAssembly: options.allowAssembly ?? false,
    allowHighQualityPrint: options.allowHighQualityPrint ?? true,
  })
  return encrypted instanceof Uint8Array ? encrypted : new Uint8Array(encrypted)
}

export async function addWatermark(input, textOrOptions, maybeOptions = {}) {
  const arrayBuffer = await normalizeInputToArrayBuffer(input)
  const options = normalizeWatermarkOptions(textOrOptions, maybeOptions)
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const pages = doc.getPages()
  const targetPages = resolveTargetPages(pages.length, options.targetPages)
  const color = hexToRgb(options.color || '#737373')
  const rotation = Number(options.rotation) || 0
  const opacity = Math.max(0.01, Math.min(Number(options.opacity) || 0.13, 1))
  const fontCache = {}

  async function getWatermarkFont() {
    const fontName = pickWatermarkFontName(options.fontFamily, options.bold, options.italic)
    if (!fontCache[fontName]) fontCache[fontName] = await doc.embedFont(fontName)
    return fontCache[fontName]
  }

  let embeddedImage = null
  if (options.type === 'image') {
    if (!options.imageBytes) throw new Error('Choose a PNG or JPG watermark image')
    const imageBytes = options.imageBytes instanceof Uint8Array
      ? options.imageBytes
      : new Uint8Array(options.imageBytes)
    embeddedImage = options.imageType === 'image/png'
      ? await doc.embedPng(imageBytes)
      : await doc.embedJpg(imageBytes)
  }

  const safeText = sanitize(options.text || 'CONFIDENTIAL') || 'CONFIDENTIAL'

  for (const pageNumber of targetPages) {
    const page = pages[pageNumber - 1]
    if (!page) continue

    const { width: pageWidth, height: pageHeight } = page.getSize()

    if (options.type === 'image') {
      const markWidth = pageWidth * ((Number(options.imageScale) || 28) / 100)
      const markHeight = markWidth * (embeddedImage.height / embeddedImage.width)
      const placements = buildWatermarkPlacements(pageWidth, pageHeight, markWidth, markHeight, options)
      for (const placement of placements) {
        page.drawImage(embeddedImage, {
          x: placement.x,
          y: pageHeight - placement.y - markHeight,
          width: markWidth,
          height: markHeight,
          opacity,
          rotate: degrees(rotation),
        })
      }
      continue
    }

    const font = await getWatermarkFont()
    const fontSize = Math.max(Number(options.fontSize) || 52, 8)
    const markWidth = font.widthOfTextAtSize(safeText, fontSize)
    const markHeight = fontSize * 1.05
    const placements = buildWatermarkPlacements(pageWidth, pageHeight, markWidth, markHeight, options)

    for (const placement of placements) {
      page.drawText(safeText, {
        x: placement.x,
        y: pageHeight - placement.y - fontSize * 0.85,
        size: fontSize,
        font,
        color,
        opacity,
        rotate: degrees(rotation),
      })
    }
  }

  return await doc.save()
}

export function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ─── PDF to JPG / PNG (Images) ─────────────────────────────────────────────
export async function pdfToImages(input, options = {}, onProgress) {
  const arrayBuffer = await normalizeInputToArrayBuffer(input)
  const format = options.format || 'image/jpeg'
  const ext = format === 'image/png' ? 'png' : 'jpg'
  const scale = Number(options.scale || 2.2)
  const quality = Number(options.quality || 0.92)

  const task = pdfjsLib.getDocument({ data: arrayBuffer.slice(0), fontExtraProperties: true })
  const pdf = await task.promise
  const numPages = pdf.numPages
  const images = []
  const zip = new JSZip()

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise

    const blob = await new Promise(resolve => canvas.toBlob(resolve, format, quality))
    const dataUrl = canvas.toDataURL(format, quality)
    const imageName = `page-${String(i).padStart(3, '0')}.${ext}`

    images.push({
      pageNumber: i,
      name: imageName,
      blob,
      dataUrl,
      width: canvas.width,
      height: canvas.height
    })
    zip.file(imageName, blob)

    if (onProgress) onProgress(Math.round((i / numPages) * 100))
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  return { images, zipBlob, totalPages: numPages }
}

// ─── Images (JPG/PNG) to PDF ───────────────────────────────────────────────
export async function imagesToPdf(imageItems, options = {}) {
  const doc = await PDFDocument.create()
  const orientation = options.orientation || 'auto'
  const margin = Number(options.margin ?? 18)
  const pageSizeMode = options.pageSize || 'a4'

  const A4_PORTRAIT = [595.28, 841.89]
  const A4_LANDSCAPE = [841.89, 595.28]

  for (const item of imageItems) {
    const bytes = item.buffer instanceof Uint8Array ? item.buffer : new Uint8Array(item.buffer)
    const isPng = item.type === 'image/png' || item.name?.toLowerCase().endsWith('.png')
    const embedded = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)

    const imgWidth = embedded.width
    const imgHeight = embedded.height

    if (pageSizeMode === 'fit') {
      const pageW = imgWidth + margin * 2
      const pageH = imgHeight + margin * 2
      const page = doc.addPage([pageW, pageH])
      page.drawImage(embedded, {
        x: margin,
        y: margin,
        width: imgWidth,
        height: imgHeight,
      })
    } else {
      let [pW, pH] = A4_PORTRAIT
      if (orientation === 'landscape' || (orientation === 'auto' && imgWidth > imgHeight)) {
        [pW, pH] = A4_LANDSCAPE
      }
      const page = doc.addPage([pW, pH])
      const availW = pW - margin * 2
      const availH = pH - margin * 2
      const scale = Math.min(availW / imgWidth, availH / imgHeight, 1)
      const drawW = imgWidth * scale
      const drawH = imgHeight * scale
      const posX = margin + (availW - drawW) / 2
      const posY = margin + (availH - drawH) / 2

      page.drawImage(embedded, {
        x: posX,
        y: posY,
        width: drawW,
        height: drawH,
      })
    }
  }

  return await doc.save()
}

// ─── Delete Pages from PDF ────────────────────────────────────────────────
export async function deletePagesFromPdf(input, pageNumbersToDelete) {
  const arrayBuffer = await normalizeInputToArrayBuffer(input)
  const src = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const total = src.getPageCount()
  const deleteSet = new Set(pageNumbersToDelete.map(Number))
  const keepIndices = []

  for (let i = 1; i <= total; i++) {
    if (!deleteSet.has(i)) keepIndices.push(i - 1)
  }

  if (keepIndices.length === 0) {
    throw new Error('Cannot delete all pages. At least one page must remain.')
  }

  const doc = await PDFDocument.create()
  const copiedPages = await doc.copyPages(src, keepIndices)
  copiedPages.forEach(p => doc.addPage(p))
  return await doc.save()
}

// ─── Add Page Numbers (Bates / Header & Footer) ───────────────────────────
export async function addPageNumbers(input, options = {}) {
  const arrayBuffer = await normalizeInputToArrayBuffer(input)
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const pages = doc.getPages()
  const total = pages.length
  const font = await doc.embedFont(StandardFonts.Helvetica)

  const position = options.position || 'bottom-center'
  const format = options.format || 'Page {n} of {total}'
  const startAt = Number(options.startAt || 1)
  const fontSize = Number(options.fontSize || 10)
  const margin = Number(options.margin || 25)
  const color = hexToRgb(options.color || '#475569')

  pages.forEach((page, idx) => {
    const pageNum = idx + startAt
    const { width, height } = page.getSize()
    const text = format
      .replace('{n}', String(pageNum))
      .replace('{total}', String(total))

    const textWidth = font.widthOfTextAtSize(text, fontSize)
    let x = margin
    let y = margin

    if (position === 'bottom-center') {
      x = (width - textWidth) / 2
      y = margin
    } else if (position === 'bottom-right') {
      x = width - margin - textWidth
      y = margin
    } else if (position === 'bottom-left') {
      x = margin
      y = margin
    } else if (position === 'top-center') {
      x = (width - textWidth) / 2
      y = height - margin - fontSize
    } else if (position === 'top-right') {
      x = width - margin - textWidth
      y = height - margin - fontSize
    }

    page.drawText(text, { x, y, size: fontSize, font, color })
  })

  return await doc.save()
}

// ─── Convert to Grayscale (Black & White) ──────────────────────────────────
export async function convertToGrayscale(input, onProgress) {
  const arrayBuffer = await normalizeInputToArrayBuffer(input)
  const task = pdfjsLib.getDocument({ data: arrayBuffer.slice(0), fontExtraProperties: true })
  const src = await task.promise
  const doc = await PDFDocument.create()
  const total = src.numPages
  const renderScale = 2.2

  for (let i = 1; i <= total; i++) {
    const page = await src.getPage(i)
    const viewport = page.getViewport({ scale: renderScale })
    const baseViewport = page.getViewport({ scale: 1 })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = imgData.data
    for (let j = 0; j < d.length; j += 4) {
      const gray = Math.round(0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2])
      d[j] = gray
      d[j + 1] = gray
      d[j + 2] = gray
    }
    ctx.putImageData(imgData, 0, 0)

    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.86))
    const imgBytes = new Uint8Array(await blob.arrayBuffer())
    const embedded = await doc.embedJpg(imgBytes)

    const outPage = doc.addPage([baseViewport.width, baseViewport.height])
    outPage.drawImage(embedded, {
      x: 0,
      y: 0,
      width: baseViewport.width,
      height: baseViewport.height,
    })

    if (onProgress) onProgress(Math.round((i / total) * 100))
  }

  return await doc.save()
}

// ─── Flatten PDF (Forms & Annotations) ────────────────────────────────────
export async function flattenPdf(input) {
  const arrayBuffer = await normalizeInputToArrayBuffer(input)
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  try {
    const form = doc.getForm()
    if (form) form.flatten()
  } catch (_) {}
  return await doc.save()
}

// ─── Extract All Plain Text ───────────────────────────────────────────────
export async function extractAllText(input, onProgress) {
  const arrayBuffer = await normalizeInputToArrayBuffer(input)
  const task = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) })
  const pdf = await task.promise
  let fullText = ''

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageStrings = content.items.map(item => item.str)
    fullText += `--- Page ${i} ---\n` + pageStrings.join(' ') + '\n\n'
    if (onProgress) onProgress(Math.round((i / pdf.numPages) * 100))
  }

  return fullText
}

// ─── Crop PDF (Margin Trimmer & Custom Box Crop) ──────────────────────────
export async function cropPdf(input, options = {}) {
  const arrayBuffer = await normalizeInputToArrayBuffer(input)
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const pages = doc.getPages()
  const topTrim = Number(options.top || 0)
  const rightTrim = Number(options.right || 0)
  const bottomTrim = Number(options.bottom || 0)
  const leftTrim = Number(options.left || 0)
  const allPages = options.allPages !== false
  const targetPageNum = Number(options.pageNum || 1)

  pages.forEach((page, idx) => {
    const currentPageNum = idx + 1
    if (!allPages && currentPageNum !== targetPageNum) return

    const box = page.getCropBox() || page.getMediaBox()
    const currentWidth = box.width
    const currentHeight = box.height

    const newX = box.x + leftTrim
    const newY = box.y + bottomTrim
    const newWidth = Math.max(20, currentWidth - leftTrim - rightTrim)
    const newHeight = Math.max(20, currentHeight - topTrim - bottomTrim)

    page.setCropBox(newX, newY, newWidth, newHeight)
    page.setMediaBox(newX, newY, newWidth, newHeight)
  })

  return await doc.save()
}

// ─── Multiple Pages Per Sheet / N-Up ──────────────────────────────────────
export async function nUpPdf(input, options = {}) {
  const arrayBuffer = await normalizeInputToArrayBuffer(input)
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const outDoc = await PDFDocument.create()
  const n = Number(options.n || 2)
  const margin = Number(options.margin ?? 18)
  const drawBorder = Boolean(options.border)
  const totalSrcPages = srcDoc.getPageCount()

  const sheetW = n === 2 ? 841.89 : 595.28
  const sheetH = n === 2 ? 595.28 : 841.89

  for (let i = 0; i < totalSrcPages; i += n) {
    const sheet = outDoc.addPage([sheetW, sheetH])
    if (n === 2) {
      const subW = (sheetW - margin * 3) / 2
      const subH = sheetH - margin * 2
      for (let slot = 0; slot < 2; slot++) {
        const pIdx = i + slot
        if (pIdx >= totalSrcPages) break
        const [embedded] = await outDoc.embedPages([srcDoc.getPage(pIdx)])
        const scale = Math.min(subW / embedded.width, subH / embedded.height)
        const actualW = embedded.width * scale
        const actualH = embedded.height * scale
        const slotX = margin + slot * (subW + margin) + (subW - actualW) / 2
        const slotY = margin + (subH - actualH) / 2
        sheet.drawPage(embedded, { x: slotX, y: slotY, width: actualW, height: actualH })
        if (drawBorder) {
          sheet.drawRectangle({
            x: slotX,
            y: slotY,
            width: actualW,
            height: actualH,
            borderColor: hexToRgb('#94a3b8'),
            borderWidth: 1,
          })
        }
      }
    } else if (n === 4) {
      const cols = 2
      const rows = 2
      const cellW = (sheetW - margin * (cols + 1)) / cols
      const cellH = (sheetH - margin * (rows + 1)) / rows
      for (let slot = 0; slot < 4; slot++) {
        const pIdx = i + slot
        if (pIdx >= totalSrcPages) break
        const col = slot % 2
        const row = Math.floor(slot / 2)
        const [embedded] = await outDoc.embedPages([srcDoc.getPage(pIdx)])
        const scale = Math.min(cellW / embedded.width, cellH / embedded.height)
        const actualW = embedded.width * scale
        const actualH = embedded.height * scale
        const slotX = margin + col * (cellW + margin) + (cellW - actualW) / 2
        const slotY = sheetH - ((row + 1) * (cellH + margin)) + (cellH - actualH) / 2
        sheet.drawPage(embedded, { x: slotX, y: slotY, width: actualW, height: actualH })
        if (drawBorder) {
          sheet.drawRectangle({
            x: slotX,
            y: slotY,
            width: actualW,
            height: actualH,
            borderColor: hexToRgb('#94a3b8'),
            borderWidth: 1,
          })
        }
      }
    }
  }

  return await outDoc.save()
}

// ─── Resize PDF Page Dimensions ───────────────────────────────────────────
export async function resizePdf(input, options = {}) {
  const arrayBuffer = await normalizeInputToArrayBuffer(input)
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const outDoc = await PDFDocument.create()
  const targetSize = options.targetSize || 'a4'
  const margin = Number(options.margin ?? 14)

  const SIZES = {
    a4: [595.28, 841.89],
    letter: [612, 792],
    legal: [612, 1008],
    a3: [841.89, 1190.55],
    a5: [419.53, 595.28],
  }
  const [baseW, baseH] = SIZES[targetSize] || SIZES.a4

  const totalPages = srcDoc.getPageCount()
  for (let i = 0; i < totalPages; i++) {
    const srcPage = srcDoc.getPage(i)
    const isSrcLandscape = srcPage.getWidth() > srcPage.getHeight()
    const [pageW, pageH] = isSrcLandscape ? [baseH, baseW] : [baseW, baseH]
    const sheet = outDoc.addPage([pageW, pageH])

    const [embedded] = await outDoc.embedPages([srcPage])
    const availW = pageW - margin * 2
    const availH = pageH - margin * 2
    const scale = Math.min(availW / embedded.width, availH / embedded.height)
    const drawW = embedded.width * scale
    const drawH = embedded.height * scale
    const x = margin + (availW - drawW) / 2
    const y = margin + (availH - drawH) / 2

    sheet.drawPage(embedded, { x, y, width: drawW, height: drawH })
  }

  return await outDoc.save()
}

// ─── Read & Update Metadata (With 1-Click Sanitize) ────────────────────────
export async function readPdfMetadata(input) {
  const arrayBuffer = await normalizeInputToArrayBuffer(input)
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  return {
    title: doc.getTitle() || '',
    author: doc.getAuthor() || '',
    subject: doc.getSubject() || '',
    keywords: (doc.getKeywords() || '').toString(),
    creator: doc.getCreator() || '',
    producer: doc.getProducer() || '',
    pageCount: doc.getPageCount(),
    creationDate: doc.getCreationDate() ? doc.getCreationDate().toISOString() : '',
    modificationDate: doc.getModificationDate() ? doc.getModificationDate().toISOString() : '',
  }
}

export async function updatePdfMetadata(input, metadata = {}, sanitize = false) {
  const arrayBuffer = await normalizeInputToArrayBuffer(input)
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  if (sanitize) {
    doc.setTitle('')
    doc.setAuthor('')
    doc.setSubject('')
    doc.setKeywords([])
    doc.setCreator('')
    doc.setProducer('')
  } else {
    if (metadata.title !== undefined) doc.setTitle(metadata.title)
    if (metadata.author !== undefined) doc.setAuthor(metadata.author)
    if (metadata.subject !== undefined) doc.setSubject(metadata.subject)
    if (metadata.keywords !== undefined) {
      doc.setKeywords(metadata.keywords.split(',').map(k => k.trim()).filter(Boolean))
    }
    if (metadata.creator !== undefined) doc.setCreator(metadata.creator)
    if (metadata.producer !== undefined) doc.setProducer(metadata.producer)
  }
  return await doc.save()
}

// ─── Invert Colors (Dark Mode PDF) ────────────────────────────────────────
export async function invertPdfColors(input, onProgress) {
  const arrayBuffer = await normalizeInputToArrayBuffer(input)
  const task = pdfjsLib.getDocument({ data: arrayBuffer.slice(0), fontExtraProperties: true })
  const src = await task.promise
  const doc = await PDFDocument.create()
  const total = src.numPages
  const renderScale = 2.2

  for (let i = 1; i <= total; i++) {
    const page = await src.getPage(i)
    const viewport = page.getViewport({ scale: renderScale })
    const baseViewport = page.getViewport({ scale: 1 })
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = imgData.data
    for (let j = 0; j < d.length; j += 4) {
      d[j] = 255 - d[j]
      d[j + 1] = 255 - d[j + 1]
      d[j + 2] = 255 - d[j + 2]
    }
    ctx.putImageData(imgData, 0, 0)

    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.88))
    const imgBytes = new Uint8Array(await blob.arrayBuffer())
    const embedded = await doc.embedJpg(imgBytes)

    const outPage = doc.addPage([baseViewport.width, baseViewport.height])
    outPage.drawImage(embedded, {
      x: 0,
      y: 0,
      width: baseViewport.width,
      height: baseViewport.height,
    })

    if (onProgress) onProgress(Math.round((i / total) * 100))
  }

  return await doc.save()
}

// ─── Booklet Creator (Folded Book Printing Imposition) ───────────────────
export async function createBooklet(input) {
  const arrayBuffer = await normalizeInputToArrayBuffer(input)
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const outDoc = await PDFDocument.create()
  const total = srcDoc.getPageCount()
  const paddedTotal = Math.ceil(total / 4) * 4

  const sheetW = 841.89
  const sheetH = 595.28
  const margin = 14
  const subW = (sheetW - margin * 3) / 2
  const subH = sheetH - margin * 2

  const sheetsCount = paddedTotal / 2
  const pagesOrder = []

  for (let s = 0; s < sheetsCount; s++) {
    const frontLeft = paddedTotal - (2 * s)
    const frontRight = 2 * s + 1
    pagesOrder.push([frontLeft, frontRight])

    const backLeft = 2 * s + 2
    const backRight = paddedTotal - (2 * s) - 1
    pagesOrder.push([backLeft, backRight])
  }

  for (const [leftP, rightP] of pagesOrder) {
    const sheet = outDoc.addPage([sheetW, sheetH])
    const drawSubPage = async (pNum, slotIndex) => {
      if (pNum > total) return
      const [embedded] = await outDoc.embedPages([srcDoc.getPage(pNum - 1)])
      const scale = Math.min(subW / embedded.width, subH / embedded.height)
      const drawW = embedded.width * scale
      const drawH = embedded.height * scale
      const x = margin + slotIndex * (subW + margin) + (subW - drawW) / 2
      const y = margin + (subH - drawH) / 2
      sheet.drawPage(embedded, { x, y, width: drawW, height: drawH })
    }
    await drawSubPage(leftP, 0)
    await drawSubPage(rightP, 1)
  }

  return await outDoc.save()
}

// ─── Stamp QR Code ────────────────────────────────────────────────────────
export async function stampQrCode(input, options = {}) {
  const arrayBuffer = await normalizeInputToArrayBuffer(input)
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const QRCode = (await import('qrcode')).default

  const text = options.text || 'https://example.com'
  const size = Number(options.size || 80)
  const position = options.position || 'bottom-right'
  const pageTarget = options.pages || 'all'
  const margin = Number(options.margin ?? 20)

  const qrDataUrl = await QRCode.toDataURL(text, { margin: 1, width: size * 3 })
  const qrBytes = await (await fetch(qrDataUrl)).arrayBuffer()
  const embeddedQr = await doc.embedPng(new Uint8Array(qrBytes))

  const pages = doc.getPages()
  const total = pages.length

  pages.forEach((page, idx) => {
    const pNum = idx + 1
    if (pageTarget === 'first' && pNum !== 1) return
    if (pageTarget === 'last' && pNum !== total) return

    const { width, height } = page.getSize()
    let x = margin
    let y = margin

    if (position === 'bottom-right') {
      x = width - size - margin
      y = margin
    } else if (position === 'bottom-left') {
      x = margin
      y = margin
    } else if (position === 'top-right') {
      x = width - size - margin
      y = height - size - margin
    } else if (position === 'top-left') {
      x = margin
      y = height - size - margin
    } else if (position === 'center') {
      x = (width - size) / 2
      y = (height - size) / 2
    }

    page.drawImage(embeddedQr, { x, y, width: size, height: size })
  })

  return await doc.save()
}

// ─── Extract Raw Images From PDF ──────────────────────────────────────────
export async function extractImagesFromPdf(input, onProgress) {
  const arrayBuffer = await normalizeInputToArrayBuffer(input)
  const task = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) })
  const pdf = await task.promise
  const extracted = []
  const zip = new JSZip()
  let imgCounter = 0

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const ops = await page.getOperatorList()

    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i]
      if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintJpegXObject) {
        const imgKey = ops.argsArray[i][0]
        try {
          const imgObj = await new Promise(resolve => {
            page.objs.get(imgKey, obj => resolve(obj))
          })
          if (imgObj && imgObj.data) {
            imgCounter++
            const canvas = document.createElement('canvas')
            canvas.width = imgObj.width
            canvas.height = imgObj.height
            const ctx = canvas.getContext('2d')

            const imgData = ctx.createImageData(imgObj.width, imgObj.height)
            const srcData = imgObj.data
            const destData = imgData.data

            if (srcData.length === imgObj.width * imgObj.height * 3) {
              let sIdx = 0
              let dIdx = 0
              while (sIdx < srcData.length) {
                destData[dIdx] = srcData[sIdx]
                destData[dIdx + 1] = srcData[sIdx + 1]
                destData[dIdx + 2] = srcData[sIdx + 2]
                destData[dIdx + 3] = 255
                sIdx += 3
                dIdx += 4
              }
            } else if (srcData.length === imgObj.width * imgObj.height * 4) {
              destData.set(srcData)
            } else if (srcData.length === imgObj.width * imgObj.height) {
              let sIdx = 0
              let dIdx = 0
              while (sIdx < srcData.length) {
                const g = srcData[sIdx]
                destData[dIdx] = g
                destData[dIdx + 1] = g
                destData[dIdx + 2] = g
                destData[dIdx + 3] = 255
                sIdx += 1
                dIdx += 4
              }
            }

            ctx.putImageData(imgData, 0, 0)
            const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
            const dataUrl = canvas.toDataURL('image/png')
            const filename = `image-p${p}-${imgCounter}.png`

            extracted.push({
              id: imgCounter,
              pageNum: p,
              name: filename,
              width: imgObj.width,
              height: imgObj.height,
              blob,
              dataUrl,
            })
            zip.file(filename, blob)
          }
        } catch (_) {}
      }
    }
    if (onProgress) onProgress(Math.round((p / pdf.numPages) * 100))
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  return { images: extracted, zipBlob, totalImages: extracted.length }
}

