// Repro v3: faithful bitmap (same geometry the browser canvas has) ->
// run REAL sampling fns, verify regions + values.
import { createCanvas } from '@napi-rs/canvas'
import { sampleLocalBackground, sampleTextColor, BASE_SCALE } from '../src/lib/pdfRenderer.js'

// Browser bitmap at zoom=1,dpr=1 is BASE_SCALE-space pixels.
// Name block from repro v2: x=108, y=113.78, w=175.32, h=30.64, fontSize=22.5
const W = Math.floor(595.28 * BASE_SCALE), H = Math.floor(841.89 * BASE_SCALE)
const canvas = createCanvas(W, H)
const ctx = canvas.getContext('2d')
ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
// Paint the name glyphs roughly where the PDF raster has them:
// block box top y=113.78, baseline = y + fontSize*0.8 = 131.78
ctx.fillStyle = '#000000'
ctx.font = `700 ${22.5}px Arial, sans-serif`
ctx.textBaseline = 'alphabetic'
ctx.fillText('RAMESH KUMAR', 108, 113.78 + 22.5 * 0.8)

const name = { x: 108, y: 113.78, width: 175.32, height: 30.64, fontSize: 22.5 }
const scale = 1 // zoom*dpr

const bg = sampleLocalBackground(canvas, name.x, name.y, name.width, name.height, scale)
console.log('localBg (expect white-ish):', bg)
const tc = sampleTextColor(canvas, name.x, name.y, name.width, name.height, scale, 'white')
console.log('textColor (expect near-black):', tc)

// Now simulate a TALL bbox (merged multi-line block) and a TINY bbox (single word)
const tall = { x: 108, y: 113.78, width: 400, height: 120, fontSize: 22.5 }
console.log('tall-box bg:', sampleLocalBackground(canvas, tall.x, tall.y, tall.width, tall.height, scale))
console.log('tall-box color:', sampleTextColor(canvas, tall.x, tall.y, tall.width, tall.height, scale, 'white'))
console.log('DONE')
