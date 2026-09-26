import fs from 'fs'
import zlib from 'zlib'
import { Document, Packer, Paragraph, ImageRun } from 'docx'
import * as pdfjsLib from 'pdfjs-dist'

// Minimal pure-JS PNG encoder from RGB/RGBA
export function encodePng(width, height, data, isRgb = false) {
  // Line filter byte (0 = None) + pixel data per row
  const bytesPerPixel = isRgb ? 3 : 4
  const rowBytes = width * bytesPerPixel
  const rawData = Buffer.alloc(height * (1 + rowBytes))

  let srcPos = 0
  let dstPos = 0

  for (let y = 0; y < height; y++) {
    rawData[dstPos++] = 0 // Filter type 0
    if (isRgb) {
      for (let x = 0; x < width; x++) {
        rawData[dstPos++] = data[srcPos++]
        rawData[dstPos++] = data[srcPos++]
        rawData[dstPos++] = data[srcPos++]
      }
    } else {
      for (let x = 0; x < width; x++) {
        rawData[dstPos++] = data[srcPos++]
        rawData[dstPos++] = data[srcPos++]
        rawData[dstPos++] = data[srcPos++]
        rawData[dstPos++] = data[srcPos++]
      }
    }
  }

  const compressed = zlib.deflateSync(rawData)

  // PNG Signature
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR Chunk
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // Bit depth
  ihdr[9] = isRgb ? 2 : 6 // Color type (2 = RGB, 6 = RGBA)
  ihdr[10] = 0 // Compression
  ihdr[11] = 0 // Filter
  ihdr[12] = 0 // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr)
  const idatChunk = makeChunk('IDAT', compressed)
  const iendChunk = makeChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([pngSig, ihdrChunk, idatChunk, iendChunk])
}

// CRC32 implementation for PNG chunks
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  }
  crcTable[n] = c
}

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeChunk(type, data) {
  const len = data.length
  const buf = Buffer.alloc(4 + 4 + len + 4)
  buf.writeUInt32BE(len, 0)
  buf.write(type, 4, 4, 'ascii')
  data.copy(buf, 8)
  const typeAndData = buf.subarray(4, 8 + len)
  const c = crc32(typeAndData)
  buf.writeUInt32BE(c, 8 + len)
  return buf
}

async function testImageExtraction() {
  console.log('Testing image extraction from extracted-pages-merged.pdf...')
  const buf = fs.readFileSync('extracted-pages-merged.pdf')
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
  const page = await doc.getPage(1)
  const opList = await page.getOperatorList()

  // Track transform matrix for images
  let curTransform = [1, 0, 0, 1, 0, 0]
  const images = []

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i]
    const args = opList.argsArray[i]

    if (fn === pdfjsLib.OPS.transform) {
      curTransform = args
    } else if (
      fn === pdfjsLib.OPS.paintImageXObject ||
      fn === pdfjsLib.OPS.paintJpegXObject
    ) {
      const objId = args[0]
      const [scaleX, skewY, skewX, scaleY, transX, transY] = curTransform
      const imgObj = await new Promise((resolve) => page.objs.get(objId, resolve))
      if (imgObj && imgObj.data) {
        const isRgb = imgObj.kind === 2 || imgObj.data.length === imgObj.width * imgObj.height * 3
        const pngBuf = encodePng(imgObj.width, imgObj.height, imgObj.data, isRgb)
        images.push({
          objId,
          x: transX,
          y: transY,
          w: Math.abs(scaleX),
          h: Math.abs(scaleY),
          origW: imgObj.width,
          origH: imgObj.height,
          pngBuf
        })
      }
    }
  }

  console.log(`Extracted ${images.length} images:`)
  for (const img of images) {
    console.log(`- Image ${img.objId}: pos=(${img.x}, ${img.y}), size=(${img.w}pt x ${img.h}pt), pngSize=${img.pngBuf.length} bytes`)
  }

  // Create docx with this image
  if (images.length > 0) {
    const docxDoc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: 'Document with Extracted Image:' }),
          new Paragraph({
            children: [
              new ImageRun({
                data: images[0].pngBuf,
                transformation: {
                  width: Math.min(480, images[0].w || 300),
                  height: Math.min(600, images[0].h || 250)
                }
              })
            ]
          })
        ]
      }]
    })
    const docxBuffer = await Packer.toBuffer(docxDoc)
    fs.writeFileSync('scratch/test-extracted-image.docx', docxBuffer)
    console.log('✓ Successfully wrote scratch/test-extracted-image.docx with extracted image!')
  }
}

testImageExtraction().catch(console.error)
