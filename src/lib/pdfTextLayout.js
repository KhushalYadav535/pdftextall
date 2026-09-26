export const DEFAULT_BASE_SCALE = 1.5

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const round2 = (value) => Math.round(value * 100) / 100

export function textChars(text = '') {
  return [...String(text)]
}

export function splitTextLines(text = '') {
  return String(text).replace(/\r/g, '').split('\n')
}

function estimatedCharWeight(ch) {
  if (ch === ' ') return 0.36
  if (/[ilI.,:;|'`!]/.test(ch)) return 0.32
  if (/[mwMW@#%&]/.test(ch)) return 0.92
  if (/[0-9]/.test(ch)) return 0.58
  if (/[A-Z]/.test(ch)) return 0.68
  return 0.56
}

export function estimateGlyphsForRun(text = '', width = 0, fontSize = 12) {
  const chars = textChars(text)
  if (!chars.length) return []

  const weights = chars.map(estimatedCharWeight)
  const estimatedWidth = weights.reduce((sum, weight) => sum + weight * fontSize, 0)
  const scale = estimatedWidth > 0 && width > 0 ? width / estimatedWidth : 1
  let xOffset = 0

  return chars.map((unicode, index) => {
    const advance = round2(weights[index] * fontSize * scale)
    const glyph = {
      index,
      unicode,
      advance,
      xOffset: round2(xOffset),
      tjAdjustment: 0,
      canReuseOriginalGlyph: true,
    }
    xOffset += advance
    return glyph
  })
}

export function buildExtractedTextMetrics(item, geom, baseScale = DEFAULT_BASE_SCALE) {
  const originalWidth = round2(geom.width)
  const originalHeight = round2(geom.height)
  const glyphs = estimateGlyphsForRun(item.str || '', originalWidth, geom.fontSize)

  return {
    originalStr: item.str || '',
    originalWidth,
    originalHeight,
    originalFontSize: round2(geom.fontSize),
    originalBaselineOffset: round2(geom.baselineOffset),
    lineHeight: originalHeight,
    maxEditWidth: originalWidth,
    maxEditHeight: originalHeight,
    naturalGlyphCount: glyphs.length,
    averageAdvance: glyphs.length ? round2(originalWidth / glyphs.length) : 0,
    widthPts: round2(originalWidth / baseScale),
    heightPts: round2(originalHeight / baseScale),
    glyphs,
    kerning: [],
    kerningSource: 'pdfjs-estimated',
  }
}

export function getOriginalBox(block = {}) {
  const fontSize = block.originalFontSize ?? block.fontSize ?? 12
  return {
    x: block.originalX ?? block.x ?? 0,
    y: block.originalY ?? block.y ?? 0,
    width: block.originalWidth ?? block.width ?? fontSize * 4,
    height: block.originalHeight ?? block.height ?? fontSize,
    fontSize,
    baselineOffset: block.originalBaselineOffset ?? block.baselineOffset ?? fontSize * 0.8,
    lineHeight: block.originalLineHeight ?? block.lineHeight ?? block.height ?? fontSize * 1.1,
  }
}

export function measureLineWidth(font, text, size) {
  if (!text) return 0
  try {
    return font.widthOfTextAtSize(text, size)
  } catch {
    return textChars(text).length * size * 0.55
  }
}

// ─── Contrast safety (anti-invisible-text) ───────────────────────────────
// Guarantees overlay/replacement text can never render in (near-)background
// color. If the chosen color has too little contrast against the background
// (bad canvas sample, transparent, white-on-white…), falls back to solid
// black on light backgrounds or solid white on dark ones. Pure + testable.
const NAMED_COLORS = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
  blue: '#0000ff', transparent: null,
}

export function parseColorToRgb(color) {
  if (!color) return null
  if (typeof color !== 'string') return null
  const c = color.trim().toLowerCase()
  if (c === 'transparent') return null
  if (NAMED_COLORS[c] !== undefined) {
    return NAMED_COLORS[c] ? parseColorToRgb(NAMED_COLORS[c]) : null
  }
  if (c.startsWith('#')) {
    let hex = c.slice(1)
    if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('')
    if (hex.length !== 6) return null
    const v = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
    return v.some(Number.isNaN) ? null : v
  }
  const m = c.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const parts = m[1].split(',').map((p) => Number(p.trim()))
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
      return [parts[0], parts[1], parts[2]]
    }
  }
  return null
}

function relativeLuminance([r, g, b]) {
  const f = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export function contrastRatio(fgCss, bgCss) {
  const fg = parseColorToRgb(fgCss)
  const bg = parseColorToRgb(bgCss)
  if (!fg || !bg) return 0
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

// Returns a guaranteed-visible text color for the given background.
export function ensureTextContrast(color, bg, minRatio = 3) {
  const rgb = parseColorToRgb(color)
  if (rgb && contrastRatio(color, bg) >= minRatio) return color
  // Pick black or white — whichever contrasts more with the background
  const bgLum = (() => {
    const b = parseColorToRgb(bg)
    return b ? relativeLuminance(b) : 1
  })()
  return bgLum > 0.35 ? '#000000' : '#ffffff'
}

export function planSingleLineFit({
  block,
  text,
  font,
  size,
  baseScale = DEFAULT_BASE_SCALE,
  preserveWidth = true,
}) {
  const naturalWidth = measureLineWidth(font, text, size)
  const originalBox = getOriginalBox(block)
  const targetWidth = preserveWidth ? Math.max(originalBox.width / baseScale, 0.1) : naturalWidth
  const chars = textChars(text)
  const slots = Math.max(chars.length - 1, 0)
  const tolerance = Math.max(0.35, size * 0.025)

  if (!preserveWidth || !targetWidth || chars.length <= 1 || naturalWidth <= targetWidth + tolerance) {
    return {
      text,
      size,
      naturalWidth,
      targetWidth,
      characterSpacing: 0,
      width: naturalWidth,
      overflow: preserveWidth && naturalWidth > targetWidth + tolerance,
      status: 'natural',
    }
  }

  const spacing = slots ? (targetWidth - naturalWidth) / slots : 0
  const minSpacing = -size * 0.18
  const maxSpacing = 0

  if (spacing >= minSpacing && spacing <= maxSpacing) {
    return {
      text,
      size,
      naturalWidth,
      targetWidth,
      characterSpacing: spacing,
      width: targetWidth,
      overflow: false,
      status: Math.abs(spacing) <= tolerance ? 'natural' : 'tracking-fit',
    }
  }

  if (naturalWidth > targetWidth) {
    const fittedSize = clamp(size * (targetWidth / naturalWidth), size * 0.88, size)
    const fittedWidth = measureLineWidth(font, text, fittedSize)
    const fittedSpacing = slots ? (targetWidth - fittedWidth) / slots : 0
    if (fittedSpacing >= minSpacing && fittedSpacing <= maxSpacing) {
      return {
        text,
        size: fittedSize,
        naturalWidth,
        targetWidth,
        characterSpacing: fittedSpacing,
        width: targetWidth,
        overflow: false,
        status: fittedSize === size ? 'tracking-fit' : 'size-fit',
      }
    }
  }

  return {
    text,
    size,
    naturalWidth,
    targetWidth,
    characterSpacing: clamp(spacing, minSpacing, maxSpacing),
    width: naturalWidth + clamp(spacing, minSpacing, maxSpacing) * slots,
    overflow: naturalWidth > targetWidth + tolerance,
    status: 'overflow',
  }
}

export function layoutTextForBlock({
  block,
  text,
  font,
  size,
  baseScale = DEFAULT_BASE_SCALE,
  preserveWidth = true,
}) {
  const lines = splitTextLines(text)
  const originalBox = getOriginalBox(block)
  const lineHeight = Math.max((originalBox.lineHeight || originalBox.height) / baseScale, size * 1.05)
  const maxLines = Math.max(1, Math.floor(Math.max(originalBox.height, originalBox.lineHeight) / Math.max(originalBox.lineHeight, 1)))
  const fittedLines = lines.map((line) => planSingleLineFit({
    block,
    text: line,
    font,
    size,
    baseScale,
    preserveWidth,
  }))
  const overflow = fittedLines.some((line) => line.overflow) || lines.length > maxLines

  return {
    lines: fittedLines,
    lineHeight,
    maxLines,
    overflow,
    status: overflow ? 'overflow' : fittedLines.some((line) => line.status !== 'natural') ? 'fit' : 'natural',
  }
}
