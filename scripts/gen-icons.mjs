// Generates PWA icons (emerald gradient rounded square + white doc glyph).
// Pure JS via pngjs — no native deps. Run: node scripts/gen-icons.mjs
import { PNG } from 'pngjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dir, '..', 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })

function lerp(a, b, t) { return Math.round(a + (b - a) * t) }

// Diagonal gradient: #10b981 -> #0ea5e9 -> #6366f1
function gradColor(x, y, size) {
  const t = (x + y) / (2 * size)
  let r, g, b
  if (t < 0.5) {
    const k = t / 0.5
    r = lerp(0x10, 0x0e, k); g = lerp(0xb9, 0xa5, k); b = lerp(0x81, 0xe9, k)
  } else {
    const k = (t - 0.5) / 0.5
    r = lerp(0x0e, 0x63, k); g = lerp(0xa5, 0x66, k); b = lerp(0xe9, 0xf1, k)
  }
  return [r, g, b]
}

function drawIcon(size, { rounded = true, padding = 0 } = {}) {
  const png = new PNG({ width: size, height: size })
  const radius = rounded ? Math.round(size * 0.22) : 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2
      // rounded corners
      if (rounded) {
        const cx = Math.min(x, size - 1 - x)
        const cy = Math.min(y, size - 1 - y)
        if (cx < radius && cy < radius) {
          const dx = radius - cx, dy = radius - cy
          if (dx * dx + dy * dy > radius * radius) {
            png.data[idx + 3] = 0
            continue
          }
        }
      }
      const [r, g, b] = gradColor(x, y, size)
      png.data[idx] = r; png.data[idx + 1] = g; png.data[idx + 2] = b
      png.data[idx + 3] = 255
    }
  }
  // White document glyph: rounded rect page + folded corner + text lines + zero badge
  const px = (v) => Math.round((v * size) / 512)
  const pageX = px(150), pageY = px(90), pageW = px(212), pageH = px(300)
  const drawWhite = (x0, y0, w, h, rad) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue
        if (rad > 0) {
          const cx = Math.min(x - x0, x0 + w - 1 - x)
          const cy = Math.min(y - y0, y0 + h - 1 - y)
          if (cx < rad && cy < rad) {
            const dx = rad - cx, dy = rad - cy
            if (dx * dx + dy * dy > rad * rad) continue
          }
        }
        const i = (size * y + x) << 2
        png.data[i] = 255; png.data[i + 1] = 255; png.data[i + 2] = 255; png.data[i + 3] = 255
      }
    }
  }
  const drawEmerald = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue
        const i = (size * y + x) << 2
        const [r, g, b] = gradColor(x, y, size)
        png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255
      }
    }
  }
  drawWhite(pageX, pageY, pageW, pageH, px(20))
  // Emerald text lines on the page
  drawEmerald(pageX + px(28), pageY + px(44), px(120), px(16))
  drawEmerald(pageX + px(28), pageY + px(78), px(156), px(16))
  drawEmerald(pageX + px(28), pageY + px(112), px(100), px(16))
  // Emerald "0" badge
  const bx = pageX + px(118), by = pageY + pageH - px(40), bw = px(120), bh = px(96)
  drawEmerald(bx, by, bw, bh)
  return png
}

for (const size of [192, 512]) {
  const png = drawIcon(size)
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), PNG.sync.write(png))
  console.log('wrote icon-' + size + '.png')
}
// maskable needs full-bleed (no rounding, extra padding)
for (const size of [192, 512]) {
  const png = drawIcon(size, { rounded: false })
  fs.writeFileSync(path.join(outDir, `maskable-${size}.png`), PNG.sync.write(png))
  console.log('wrote maskable-' + size + '.png')
}
