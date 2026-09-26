// Repro: "edited name invisible" — exercises the REAL store + REAL exporter.
// Case A (control): Helvetica original  -> expect new name visible.
// Case B (suspect):  embedded-font original -> exporter re-embeds with subset:true.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import * as pdfjsLegacy from 'pdfjs-dist/legacy/build/pdf.mjs'
import fontkit from '@pdf-lib/fontkit'
import zlib from 'node:zlib'
import fs from 'node:fs'
import { loadPdf, extractTextItems } from '../src/lib/pdfRenderer.js'
import { exportPdf } from '../src/lib/pdfExporter.js'
import { usePdfStore } from '../src/store/pdfStore.js'

const notoSans = fs.readFileSync(new URL('../public/fonts/NotoSans-Regular.ttf', import.meta.url))

async function makeOriginal(kind) {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const page = doc.addPage([595.28, 841.89])
  const titleF = await doc.embedFont(StandardFonts.HelveticaBold)
  page.drawText('Certificate of Achievement', { x: 120, y: 700, size: 26, font: titleF, color: rgb(0, 0, 0) })
  if (kind === 'embedded') {
    const f = await doc.embedFont(notoSans, { subset: false }) // valid full embed (like Word originals)
    page.drawText('Rahul Sharma', { x: 180, y: 600, size: 24, font: f, color: rgb(0.1, 0.1, 0.1) })
  } else {
    const f = await doc.embedFont(StandardFonts.Helvetica)
    page.drawText('Rahul Sharma', { x: 180, y: 600, size: 24, font: f, color: rgb(0.1, 0.1, 0.1) })
  }
  return new Uint8Array(await doc.save())
}

async function extractOutputText(bytes) {
  const doc = await pdfjsLegacy.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise
  let out = ''
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    out += tc.items.map((i) => i.str).join(' ') + '\n'
  }
  await doc.destroy()
  return out
}

// Pull embedded FontFile2 programs out of raw PDF bytes
function extractFontFile2(bytes) {
  const bins = []
  const buf = Buffer.from(bytes)
  let idx = 0
  while (true) {
    const s = buf.indexOf('/FontFile2', idx)
    if (s === -1) break
    const streamStart = buf.indexOf('stream', s)
    let dataStart = streamStart + 6
    while (buf[dataStart] === 0x0d || buf[dataStart] === 0x0a) dataStart++
    const end = buf.indexOf('endstream', dataStart)
    let raw = buf.subarray(dataStart, end)
    while (raw.length && (raw[raw.length - 1] === 0x0d || raw[raw.length - 1] === 0x0a)) raw = raw.subarray(0, -1)
    try { bins.push(zlib.inflateSync(raw)) } catch { bins.push(raw) }
    idx = end + 9
  }
  return bins
}

function glyphCommandCount(fontBytes, ch) {
  try {
    const font = fontkit.create(Buffer.from(fontBytes))
    const cp = ch.codePointAt(0)
    const glyph = font.getGlyph(cp)
    const cmds = glyph.path?.commands || []
    return { ok: true, bbox: glyph.bbox, commands: cmds.length }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

async function runCase(kind) {
  console.log(`\n===== CASE ${kind} =====`)
  usePdfStore.getState().reset()
  const orig = await makeOriginal(kind)
  await loadPdf(orig.buffer.slice(0))
  const items = await extractTextItems(1)
  const nameBlock = items.find((i) => (i.str || '').includes('Rahul'))
  if (!nameBlock) { console.log('SETUP FAIL: name block not extracted'); return }
  console.log('extracted block:', JSON.stringify({ str: nameBlock.str, x: nameBlock.x, y: nameBlock.y, fontSize: nameBlock.fontSize, color: nameBlock.color, stdFont: nameBlock.stdFont, fontName: nameBlock.fontName }))

  // Simulate user: double-click, type new name, press Enter
  const st = usePdfStore.getState()
  st.commitExtractedEdit(1, nameBlock, 'Aarav Sharma')
  const after = usePdfStore.getState()
  const edited = (after.editLayers[1]?.texts || []).find((t) => t.isEdited)
  console.log('committed edit:', JSON.stringify({ str: edited?.str, id: edited?.id, originalId: edited?.originalId }))

  const fallbacks = []
  const out = await exportPdf(orig.buffer.slice(0), after.editLayers, 1, after.pageBgs, after.blockBgs, '', (p, r) => fallbacks.push([p, r]), {}, false)
  console.log('export fallbacks:', JSON.stringify(fallbacks))
  const text = await extractOutputText(out)
  const hasNew = text.includes('Aarav Sharma')
  console.log('output text has NEW name:', hasNew)
  console.log('output text sample:', JSON.stringify(text.trim().slice(0, 120)))

  // Font integrity: every embedded FontFile2 must draw 'A' with real outlines
  const programs = extractFontFile2(out)
  console.log('embedded FontFile2 programs:', programs.length)
  const ref = glyphCommandCount(notoSans, 'A')
  console.log('reference NotoSans glyph A commands:', ref.commands)
  programs.forEach((prog, i) => {
    const got = glyphCommandCount(prog, 'A')
    console.log(`  program[${i}] size=${prog.length} glyphA:`, got.ok ? `commands=${got.commands} bbox=${JSON.stringify(got.bbox)}` : `PARSE FAIL ${got.error}`)
  })
  return { hasNew, programs }
}

await runCase('helvetica')
await runCase('embedded')
console.log('\nDONE')
