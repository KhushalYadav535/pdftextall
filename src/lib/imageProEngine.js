import JSZip from 'jszip'

/**
 * Helper to load an image source (File, Blob, or URL) into an HTMLImageElement
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (err) => reject(new Error('Failed to load image: ' + err))
    if (typeof src === 'string') {
      img.src = src
    } else if (src instanceof Blob || src instanceof File) {
      img.src = URL.createObjectURL(src)
    } else {
      reject(new Error('Invalid image source type'))
    }
  })
}

/**
 * 1. Background Remover / Color Key Eraser (Chroma / Magic Wand)
 * Removes background based on a target color and tolerance with optional edge feathering.
 */
export async function removeBackgroundByColor(imgSource, targetColor = { r: 255, g: 255, b: 255 }, tolerance = 30, feather = 1) {
  const img = await loadImage(imgSource)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imgData.data
  const tolSq = tolerance * tolerance * 3

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const dr = r - targetColor.r
    const dg = g - targetColor.g
    const db = b - targetColor.b
    const distSq = dr * dr + dg * dg + db * db

    if (distSq <= tolSq) {
      if (feather > 0 && distSq > tolSq * 0.75) {
        // Soft edge feather
        const ratio = (distSq - tolSq * 0.75) / (tolSq * 0.25)
        data[i + 3] = Math.round(255 * ratio)
      } else {
        data[i + 3] = 0 // transparent
      }
    }
  }

  ctx.putImageData(imgData, 0, 0)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

/**
 * 2. Passport & Visa Photo Sheet Maker
 * Generates single cropped photo or multi-photo printable sheet (4x6 inch or A4) with cut guidelines.
 */
export async function createPassportSheet(imgSource, options = {}) {
  const {
    country = 'india', // 'india', 'us', 'schengen', 'stamp'
    sheet = '4x6', // 'single', '4x6', 'a4'
    bgColor = '#ffffff',
    border = true
  } = options

  const img = await loadImage(imgSource)

  // Standard dimensions at 300 DPI:
  // India / US: 2x2 inch = 600 x 600 px
  // Schengen / UK: 35 x 45 mm (~ 1.38 x 1.77 in) = 413 x 531 px
  // Stamp size: 1 x 1.25 inch = 300 x 375 px
  let photoW = 600
  let photoH = 600
  if (country === 'schengen') {
    photoW = 413
    photoH = 531
  } else if (country === 'stamp') {
    photoW = 300
    photoH = 375
  }

  // Create single photo canvas (center cropped)
  const singleCanvas = document.createElement('canvas')
  singleCanvas.width = photoW
  singleCanvas.height = photoH
  const sCtx = singleCanvas.getContext('2d')
  sCtx.fillStyle = bgColor
  sCtx.fillRect(0, 0, photoW, photoH)

  // Compute crop
  const scale = Math.max(photoW / img.width, photoH / img.height)
  const sw = photoW / scale
  const sh = photoH / scale
  const sx = (img.width - sw) / 2
  const sy = (img.height - sh) / 2
  sCtx.drawImage(img, sx, sy, sw, sh, 0, 0, photoW, photoH)

  if (border) {
    sCtx.strokeStyle = '#d1d5db'
    sCtx.lineWidth = 2
    sCtx.strokeRect(1, 1, photoW - 2, photoH - 2)
  }

  if (sheet === 'single') {
    return new Promise((resolve) => {
      singleCanvas.toBlob((blob) => resolve({ blob, width: photoW, height: photoH }), 'image/jpeg', 0.95)
    })
  }

  // Sheet sizes at 300 DPI:
  // 4x6 inch = 1200 x 1800 px (or 1800 x 1200 landscape)
  // A4 = 2480 x 3508 px
  let sheetW = 1800
  let sheetH = 1200
  let cols = 2
  let rows = 2

  if (sheet === '4x6') {
    sheetW = 1800
    sheetH = 1200
    cols = country === 'schengen' || country === 'stamp' ? 3 : 2
    rows = 2
  } else if (sheet === 'a4') {
    sheetW = 2480
    sheetH = 3508
    cols = country === 'schengen' || country === 'stamp' ? 4 : 3
    rows = country === 'stamp' ? 6 : 4
  }

  const sheetCanvas = document.createElement('canvas')
  sheetCanvas.width = sheetW
  sheetCanvas.height = sheetH
  const mCtx = sheetCanvas.getContext('2d')
  mCtx.fillStyle = '#ffffff'
  mCtx.fillRect(0, 0, sheetW, sheetH)

  // Grid distribution
  const totalW = cols * photoW
  const totalH = rows * photoH
  const gapX = Math.floor((sheetW - totalW) / (cols + 1))
  const gapY = Math.floor((sheetH - totalH) / (rows + 1))

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = gapX + c * (photoW + gapX)
      const y = gapY + r * (photoH + gapY)
      mCtx.drawImage(singleCanvas, x, y)

      // Light cut marks (dashed corner markers)
      mCtx.strokeStyle = '#cbd5e1'
      mCtx.lineWidth = 1
      mCtx.setLineDash([4, 4])
      mCtx.strokeRect(x - 2, y - 2, photoW + 4, photoH + 4)
      mCtx.setLineDash([])
    }
  }

  // Footer metadata
  mCtx.fillStyle = '#64748b'
  mCtx.font = '24px sans-serif'
  mCtx.textAlign = 'center'
  mCtx.fillText(
    `Omni-Utility Passport Sheet (${country.toUpperCase()} - ${cols * rows} Photos @ 300 DPI Print)`,
    sheetW / 2,
    sheetH - 30
  )

  return new Promise((resolve) => {
    sheetCanvas.toBlob((blob) => resolve({ blob, width: sheetW, height: sheetH }), 'image/jpeg', 0.95)
  })
}

/**
 * 3. Privacy Face Blur & Pixelate Redactor
 * Applies mosaic pixelation or Gaussian-like box blur to user-selected regions.
 */
export async function applyPrivacyRedaction(imgSource, boxes = [], mode = 'pixelate', intensity = 16) {
  const img = await loadImage(imgSource)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  for (const box of boxes) {
    const bx = Math.max(0, Math.floor(box.x))
    const by = Math.max(0, Math.floor(box.y))
    const bw = Math.min(canvas.width - bx, Math.floor(box.w))
    const bh = Math.min(canvas.height - by, Math.floor(box.h))

    if (bw <= 0 || bh <= 0) continue

    if (mode === 'blackout') {
      ctx.fillStyle = '#000000'
      ctx.fillRect(bx, by, bw, bh)
    } else if (mode === 'pixelate') {
      const blockSize = Math.max(4, Math.floor(intensity))
      const tempCanvas = document.createElement('canvas')
      const scaledW = Math.max(1, Math.floor(bw / blockSize))
      const scaledH = Math.max(1, Math.floor(bh / blockSize))
      tempCanvas.width = scaledW
      tempCanvas.height = scaledH
      const tCtx = tempCanvas.getContext('2d')
      tCtx.imageSmoothingEnabled = false
      tCtx.drawImage(canvas, bx, by, bw, bh, 0, 0, scaledW, scaledH)

      ctx.imageSmoothingEnabled = false
      ctx.drawImage(tempCanvas, 0, 0, scaledW, scaledH, bx, by, bw, bh)
      ctx.imageSmoothingEnabled = true
    } else {
      // Blur
      ctx.save()
      ctx.filter = `blur(${Math.max(4, intensity)}px)`
      ctx.drawImage(canvas, bx, by, bw, bh, bx, by, bw, bh)
      ctx.restore()
    }
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

/**
 * 4. Batch/Single Photo Watermark Pro
 * Applies text or logo watermark with opacity, angle, and tile repeat mode.
 */
export async function applyWatermark(imgSource, options = {}) {
  const {
    text = 'CONFIDENTIAL',
    logoSource = null,
    opacity = 0.35,
    angle = -30,
    fontSize = 36,
    color = '#ffffff',
    tile = false,
    position = 'bottom-right' // 'center', 'bottom-right', 'top-left'
  } = options

  const img = await loadImage(imgSource)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  ctx.save()
  ctx.globalAlpha = opacity

  if (logoSource) {
    const logo = await loadImage(logoSource)
    const lw = Math.min(canvas.width * 0.3, logo.width)
    const lh = (lw / logo.width) * logo.height
    let lx = canvas.width - lw - 20
    let ly = canvas.height - lh - 20
    if (position === 'center') {
      lx = (canvas.width - lw) / 2
      ly = (canvas.height - lh) / 2
    } else if (position === 'top-left') {
      lx = 20
      ly = 20
    }
    ctx.drawImage(logo, lx, ly, lw, lh)
  } else {
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.fillStyle = color

    if (tile) {
      const rad = (angle * Math.PI) / 180
      const stepX = fontSize * 10
      const stepY = fontSize * 6

      for (let x = -canvas.width; x < canvas.width * 2; x += stepX) {
        for (let y = -canvas.height; y < canvas.height * 2; y += stepY) {
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(rad)
          ctx.fillText(text, 0, 0)
          ctx.restore()
        }
      }
    } else {
      ctx.save()
      let tx = canvas.width - 20
      let ty = canvas.height - 20
      ctx.textAlign = 'right'

      if (position === 'center') {
        tx = canvas.width / 2
        ty = canvas.height / 2
        ctx.textAlign = 'center'
      } else if (position === 'top-left') {
        tx = 20
        ty = fontSize + 10
        ctx.textAlign = 'left'
      }

      ctx.translate(tx, ty)
      ctx.rotate((angle * Math.PI) / 180)
      ctx.fillText(text, 0, 0)
      ctx.restore()
    }
  }

  ctx.restore()

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95)
  })
}

/**
 * 5. Social Media Multi-Grid Image Splitter (Instagram 3x3 / Carousel)
 * Splits an image into a grid of squares and downloads a ZIP package.
 */
export async function splitImageToGrid(imgSource, rows = 3, cols = 3) {
  const img = await loadImage(imgSource)
  const zip = new JSZip()

  // Make overall image square or exact ratio
  const tileW = Math.floor(img.width / cols)
  const tileH = Math.floor(img.height / rows)

  const canvas = document.createElement('canvas')
  canvas.width = tileW
  canvas.height = tileH
  const ctx = canvas.getContext('2d')

  let count = 1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.clearRect(0, 0, tileW, tileH)
      ctx.drawImage(
        img,
        c * tileW, r * tileH, tileW, tileH,
        0, 0, tileW, tileH
      )
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '')
      zip.file(`tile_${String(count).padStart(2, '0')}_r${r + 1}_c${c + 1}.jpg`, base64Data, { base64: true })
      count++
    }
  }

  return zip.generateAsync({ type: 'blob' })
}

/**
 * 6. Exact Dimension & DPI Resizer
 * Resizes image by pixels, mm, cm, or inches with aspect lock and DPI support.
 */
export async function resizeImageWithDpi(imgSource, options = {}) {
  const {
    width,
    height,
    unit = 'px', // 'px', 'mm', 'cm', 'in'
    dpi = 300,
    format = 'image/jpeg',
    quality = 0.92
  } = options

  const img = await loadImage(imgSource)

  let pxW = width
  let pxH = height

  // Conversion factor to px based on DPI
  if (unit === 'in') {
    pxW = Math.round(width * dpi)
    pxH = Math.round(height * dpi)
  } else if (unit === 'mm') {
    pxW = Math.round((width / 25.4) * dpi)
    pxH = Math.round((height / 25.4) * dpi)
  } else if (unit === 'cm') {
    pxW = Math.round((width / 2.54) * dpi)
    pxH = Math.round((height / 2.54) * dpi)
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, pxW)
  canvas.height = Math.max(1, pxH)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve({ blob, width: canvas.width, height: canvas.height }), format, quality)
  })
}

/**
 * 7. ASCII Art Generator
 * Converts any photo into text ASCII art with customizable character sets.
 */
export async function generateAsciiArt(imgSource, options = {}) {
  const {
    width = 100,
    charset = '@%#*+=-:. ', // from dense to sparse
    inverted = false
  } = options

  const img = await loadImage(imgSource)
  const aspect = img.height / img.width
  // Font characters are typically roughly 2x taller than wide, so multiply height by 0.55
  const height = Math.floor(width * aspect * 0.55)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)

  const imgData = ctx.getImageData(0, 0, width, height).data
  const chars = inverted ? charset.split('').reverse().join('') : charset

  let textResult = ''
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const r = imgData[idx]
      const g = imgData[idx + 1]
      const b = imgData[idx + 2]
      // Perceived luminance
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      const charIndex = Math.floor((lum / 255) * (chars.length - 1))
      textResult += chars[charIndex]
    }
    textResult += '\n'
  }

  return textResult
}

/**
 * 8. Vintage Polaroid & Aesthetic Frame Creator
 * Wraps photo in a classic Polaroid border with drop shadow, subtle rotation, and handwritten caption.
 */
export async function renderPolaroid(imgSource, caption = 'Summer Memories', options = {}) {
  const {
    bgColor = '#faf9f6',
    textColor = '#1e293b',
    borderWidth = 36,
    bottomBorder = 110,
    tiltAngle = -2
  } = options

  const img = await loadImage(imgSource)
  const photoW = img.naturalWidth || img.width
  const photoH = img.naturalHeight || img.height

  const cardW = photoW + borderWidth * 2
  const cardH = photoH + borderWidth + bottomBorder

  // Inner card canvas
  const cardCanvas = document.createElement('canvas')
  cardCanvas.width = cardW
  cardCanvas.height = cardH
  const cCtx = cardCanvas.getContext('2d')

  // Polaroid white background
  cCtx.fillStyle = bgColor
  cCtx.fillRect(0, 0, cardW, cardH)

  // Draw main photo
  cCtx.drawImage(img, borderWidth, borderWidth, photoW, photoH)

  // Subtle inner photo border
  cCtx.strokeStyle = 'rgba(0,0,0,0.08)'
  cCtx.lineWidth = 1
  cCtx.strokeRect(borderWidth, borderWidth, photoW, photoH)

  // Caption text
  if (caption) {
    cCtx.fillStyle = textColor
    const fontSize = Math.max(20, Math.floor(photoW * 0.05))
    cCtx.font = `italic 600 ${fontSize}px "Caveat", "Brush Script MT", "Comic Sans MS", cursive, sans-serif`
    cCtx.textAlign = 'center'
    cCtx.fillText(caption, cardW / 2, cardH - Math.floor(bottomBorder * 0.35))
  }

  // Final canvas with padding and drop shadow
  const padding = 60
  const finalCanvas = document.createElement('canvas')
  finalCanvas.width = cardW + padding * 2
  finalCanvas.height = cardH + padding * 2
  const fCtx = finalCanvas.getContext('2d')

  fCtx.save()
  fCtx.translate(finalCanvas.width / 2, finalCanvas.height / 2)
  fCtx.rotate((tiltAngle * Math.PI) / 180)

  // Shadow
  fCtx.shadowColor = 'rgba(0, 0, 0, 0.25)'
  fCtx.shadowBlur = 24
  fCtx.shadowOffsetX = 6
  fCtx.shadowOffsetY = 12

  fCtx.drawImage(cardCanvas, -cardW / 2, -cardH / 2)
  fCtx.restore()

  return new Promise((resolve) => {
    finalCanvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

/**
 * 9. Paper Signature Extractor
 * Converts photos of pen signatures on paper into clean, transparent PNG signatures.
 */
export async function extractSignature(imgSource, threshold = 185, inkMode = 'original') {
  const img = await loadImage(imgSource)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = imgData.data

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b

    if (lum >= threshold) {
      // Paper background -> pure transparent
      d[i + 3] = 0
    } else {
      // Ink pixel
      const alpha = Math.min(255, Math.round((1 - lum / threshold) * 350))
      d[i + 3] = alpha

      if (inkMode === 'blue') {
        d[i] = 30; d[i + 1] = 64; d[i + 2] = 175
      } else if (inkMode === 'black') {
        d[i] = 15; d[i + 1] = 23; d[i + 2] = 42
      }
    }
  }

  ctx.putImageData(imgData, 0, 0)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

/**
 * 10. Circular Avatar & Profile Picture Maker
 */
export async function createCircularAvatar(imgSource, options = {}) {
  const {
    borderColor = '#10b981',
    borderWidth = 12,
    size = 512,
    shadow = true
  } = options

  const img = await loadImage(imgSource)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const center = size / 2
  const radius = center - borderWidth - (shadow ? 12 : 0)

  if (shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
    ctx.shadowBlur = 16
    ctx.shadowOffsetY = 6
  }

  // Draw border circle
  ctx.beginPath()
  ctx.arc(center, center, radius + borderWidth / 2, 0, Math.PI * 2)
  ctx.strokeStyle = borderColor
  ctx.lineWidth = borderWidth
  ctx.stroke()

  ctx.shadowColor = 'transparent'

  // Clip circular inner
  ctx.save()
  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.clip()

  // Center-crop image into inner circle
  const innerSize = radius * 2
  const scale = Math.max(innerSize / img.width, innerSize / img.height)
  const sw = innerSize / scale
  const sh = innerSize / scale
  const sx = (img.width - sw) / 2
  const sy = (img.height - sh) / 2

  ctx.drawImage(img, sx, sy, sw, sh, center - radius, center - radius, innerSize, innerSize)
  ctx.restore()

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

/**
 * 11. No-Crop Square & Blur Padder
 */
export async function createNoCropSquare(imgSource, options = {}) {
  const { blur = 24, bgMode = 'blur', solidColor = '#ffffff' } = options
  const img = await loadImage(imgSource)

  const size = Math.max(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  if (bgMode === 'solid') {
    ctx.fillStyle = solidColor
    ctx.fillRect(0, 0, size, size)
  } else {
    // Blurred background replica
    ctx.save()
    ctx.filter = `blur(${blur}px) brightness(0.85)`
    ctx.drawImage(img, -20, -20, size + 40, size + 40)
    ctx.restore()
  }

  // Draw crisp centered image
  const dx = (size - img.width) / 2
  const dy = (size - img.height) / 2

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 20
  ctx.drawImage(img, dx, dy, img.width, img.height)
  ctx.restore()

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.94)
  })
}

/**
 * 12. Batch Image Renamer & Sequencer
 */
export async function batchRenameImages(files, options = {}) {
  const { baseName = 'Photo', startNum = 1, digits = 3, addDate = false } = options
  const zip = new JSZip()
  const dateStr = new Date().toISOString().split('T')[0]

  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const ext = f.name.split('.').pop() || 'jpg'
    const num = String(startNum + i).padStart(digits, '0')
    const finalName = addDate
      ? `${baseName}_${dateStr}_${num}.${ext}`
      : `${baseName}_${num}.${ext}`

    zip.file(finalName, f)
  }

  return zip.generateAsync({ type: 'blob' })
}

/**
 * 13. Spotify-Style Duotone Color Filter
 */
export async function applyDuotoneFilter(imgSource, darkHex = '#0f172a', lightHex = '#ec4899') {
  const img = await loadImage(imgSource)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  const parseHex = (h) => ({
    r: parseInt(h.slice(1, 3), 16) || 0,
    g: parseInt(h.slice(3, 5), 16) || 0,
    b: parseInt(h.slice(5, 7), 16) || 0
  })

  const c1 = parseHex(darkHex)
  const c2 = parseHex(lightHex)

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = imgData.data

  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255
    d[i] = Math.round(c1.r + (c2.r - c1.r) * lum)
    d[i + 1] = Math.round(c1.g + (c2.g - c1.g) * lum)
    d[i + 2] = Math.round(c1.b + (c2.b - c1.b) * lum)
  }

  ctx.putImageData(imgData, 0, 0)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.94)
  })
}

/**
 * 14. 8-Bit Pixel Art Converter
 */
export async function convertToPixelArt(imgSource, pixelSize = 12) {
  const img = await loadImage(imgSource)
  const scaledW = Math.max(1, Math.floor(img.width / pixelSize))
  const scaledH = Math.max(1, Math.floor(img.height / pixelSize))

  const smallCanvas = document.createElement('canvas')
  smallCanvas.width = scaledW
  smallCanvas.height = scaledH
  const sCtx = smallCanvas.getContext('2d')
  sCtx.drawImage(img, 0, 0, scaledW, scaledH)

  const finalCanvas = document.createElement('canvas')
  finalCanvas.width = img.width
  finalCanvas.height = img.height
  const fCtx = finalCanvas.getContext('2d')
  fCtx.imageSmoothingEnabled = false
  fCtx.drawImage(smallCanvas, 0, 0, scaledW, scaledH, 0, 0, img.width, img.height)

  return new Promise((resolve) => {
    finalCanvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}
