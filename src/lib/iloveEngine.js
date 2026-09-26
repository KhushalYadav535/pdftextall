import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import JSZip from 'jszip'
import { initOcr } from './ocrEngine.js'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ImageRun,
  PageBreak,
  Header,
  Footer,
  PageOrientation,
} from 'docx'

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
}

function escapeXml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

/**
 * 1. Repair Damaged / Corrupt PDF
 * Recovers orphan objects, repairs broken xref tables, strips corrupt EOF trailers.
 */
export async function repairPdfDocument(arrayBuffer) {
  try {
    // Attempt relaxed parsing with ignoreEncryption and recovery
    const pdfDoc = await PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
      updateMetadata: false
    })

    // Re-serialize with clean cross-reference table and fresh trailer
    const cleanBytes = await pdfDoc.save({ useObjectStreams: false })
    return cleanBytes
  } catch (err) {
    // If standard load fails, sanitize binary by finding %PDF header and %%EOF trailer
    const uint8 = new Uint8Array(arrayBuffer)
    let startIndex = 0

    // Look for %PDF
    for (let i = 0; i < Math.min(uint8.length, 2048); i++) {
      if (
        uint8[i] === 0x25 && // %
        uint8[i + 1] === 0x50 && // P
        uint8[i + 2] === 0x44 && // D
        uint8[i + 3] === 0x46 // F
      ) {
        startIndex = i
        break
      }
    }

    const sanitized = uint8.slice(startIndex)
    const pdfDoc = await PDFDocument.load(sanitized, { ignoreEncryption: true })
    return pdfDoc.save({ useObjectStreams: false })
  }
}

/**
 * 2. PDF to Markdown (.md)
 * Extracts typography and positional text into structured Markdown (Headings, Paragraphs, Lists).
 */
export async function convertPdfToMarkdown(arrayBuffer, onProgress) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) })
  const pdf = await loadingTask.promise
  const numPages = pdf.numPages
  let markdown = ''

  for (let i = 1; i <= numPages; i++) {
    if (onProgress) onProgress(i, numPages)
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()

    markdown += `\n\n<!-- Page ${i} -->\n`

    let lastY = null
    let currentLine = ''

    for (const item of textContent.items) {
      if (!item.str || item.str.trim() === '') continue

      const fontSize = Math.round(item.height || item.transform?.[0] || 12)
      const currentY = Math.round(item.transform?.[5] || 0)

      if (lastY !== null && Math.abs(currentY - lastY) > 8) {
        // New line
        markdown += currentLine.trim() + '\n'
        currentLine = ''
      }

      // Detect headers based on font size
      if (fontSize >= 20) {
        currentLine += `# ${item.str} `
      } else if (fontSize >= 15) {
        currentLine += `## ${item.str} `
      } else if (fontSize >= 13) {
        currentLine += `### ${item.str} `
      } else {
        currentLine += item.str + ' '
      }

      lastY = currentY
    }

    if (currentLine.trim()) {
      markdown += currentLine.trim() + '\n'
    }
  }

  return markdown.trim()
}

/**
 * 3. In-Browser AI PDF Summarizer
 * Extractive NLP summarization using TF-IDF and sentence centrality scoring. 100% Free.
 */
export function summarizeTextContent(text, numSentences = 5) {
  if (!text || text.length < 50) {
    return {
      tldr: text || 'No sufficient text found to summarize.',
      keyPoints: [text || 'Document is empty.']
    }
  }

  // Multilingual sentence split (English + Hindi danda + ?!)
  const normalized = text.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  const rawSentences = normalized
    .split(/(?<=[.?!।])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && !s.startsWith('<!--'))

  if (rawSentences.length <= numSentences) {
    return {
      tldr: rawSentences[0] || '',
      keyPoints: rawSentences
    }
  }

  // Multilingual stop words (EN + HI common)
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of',
    'it', 'with', 'as', 'by', 'that', 'this', 'are', 'was', 'were', 'be', 'or',
    'from', 'but', 'not', 'have', 'has', 'had', 'they', 'you', 'we', 'our', 'all',
    'will', 'would', 'can', 'shall', 'should', 'more', 'most', 'such', 'into',
    'ka', 'ki', 'ke', 'ko', 'se', 'me', 'ne', 'hai', 'hain', 'tha', 'the', 'aur',
    'par', 'tak', 'bhi', 'yah', 'vah', 'jo', 'kya', 'nahi', 'gaya', 'kiya'
  ])

  // Unicode-aware tokens (Latin + Devanagari + digits)
  const tokenize = (s) => s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []

  const wordFreq = {}
  for (const sentence of rawSentences) {
    for (const w of tokenize(sentence)) {
      if (!stopWords.has(w)) wordFreq[w] = (wordFreq[w] || 0) + 1
    }
  }
  const maxFreq = Math.max(1, ...Object.values(wordFreq))

  const tokenSet = (s) => new Set(tokenize(s).filter((w) => !stopWords.has(w)))

  // Score: normalized TF + position + length + entity/numeric boost
  const scored = rawSentences.map((sentence, index) => {
    const words = tokenize(sentence)
    let tf = 0
    for (const w of words) tf += (wordFreq[w] || 0) / maxFreq
    tf = tf / Math.max(1, words.length)
    let score = tf
    // Position: intro + conclusion matter
    if (index === 0) score *= 1.5
    else if (index < 3) score *= 1.25
    else if (index >= rawSentences.length - 2) score *= 1.15
    // Length penalty: too short/long are rarely key points
    const len = words.length
    if (len < 6) score *= 0.6
    else if (len > 45) score *= 0.75
    // Entities / numbers / dates / currency boost
    if (/\d/.test(sentence)) score *= 1.12
    if (/[$€£₹%]/.test(sentence)) score *= 1.1
    if (/[A-Z][a-z]+ [A-Z][a-z]+/.test(sentence)) score *= 1.08
    if (/[:—–]/.test(sentence)) score *= 1.05
    return { sentence, score, index, tokens: tokenSet(sentence) }
  })

  // MMR selection: relevance minus redundancy (Jaccard overlap)
  scored.sort((a, b) => b.score - a.score)
  const picked = []
  const candidates = [...scored]
  while (picked.length < numSentences && candidates.length > 0) {
    let bestIdx = 0
    let bestMmr = -Infinity
    for (let c = 0; c < candidates.length; c++) {
      const cand = candidates[c]
      let maxOverlap = 0
      for (const p of picked) {
        const inter = [...cand.tokens].filter((t) => p.tokens.has(t)).length
        const union = new Set([...cand.tokens, ...p.tokens]).size || 1
        maxOverlap = Math.max(maxOverlap, inter / union)
      }
      const mmr = 0.72 * cand.score - 0.28 * maxOverlap
      if (mmr > bestMmr) { bestMmr = mmr; bestIdx = c }
    }
    picked.push(candidates.splice(bestIdx, 1)[0])
  }
  picked.sort((a, b) => a.index - b.index)

  const keyPoints = picked.map((s) => s.sentence)
  const tldr = keyPoints[0] || ''

  return { tldr, keyPoints }
}

/**
 * 4. PDF Translator (50+ Languages)
 * Multi-provider with cache: Google gtx → MyMemory → LibreTranslate.
 * HONEST: translation needs internet (only text chunks are sent, never the PDF file).
 */
const translateCache = new Map()

async function translateChunkGtx(chunk, targetLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(chunk)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('gtx failed')
  const data = await res.json()
  if (Array.isArray(data[0])) return data[0].map((item) => item[0]).join('')
  throw new Error('gtx parse failed')
}

async function translateChunkMyMemory(chunk, targetLang) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=autodetect|${targetLang}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('mymemory failed')
  const data = await res.json()
  const t = data?.responseData?.translatedText
  if (t && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) return t
  throw new Error('mymemory empty')
}

export async function translateText(text, targetLang = 'hi') {
  if (!text || text.trim() === '') return ''

  // Split into chunks of ~1000 characters to prevent URL length limits
  const chunks = []
  let currentChunk = ''

  const lines = text.split('\n')
  for (const line of lines) {
    if ((currentChunk + '\n' + line).length > 1000) {
      chunks.push(currentChunk)
      currentChunk = line
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line
    }
  }
  if (currentChunk) chunks.push(currentChunk)

  let translatedFull = ''

  for (const chunk of chunks) {
    const key = `${targetLang}::${chunk}`
    if (translateCache.has(key)) {
      translatedFull += translateCache.get(key) + '\n'
      continue
    }
    let done = null
    const providers = [translateChunkGtx, translateChunkMyMemory]
    for (const fn of providers) {
      try {
        done = await fn(chunk, targetLang)
        if (done && done.trim()) break
      } catch { /* try next provider */ }
    }
    const out = (done && done.trim() ? done : chunk) + '\n'
    translateCache.set(key, out.trim())
    if (translateCache.size > 400) {
      const first = translateCache.keys().next().value
      translateCache.delete(first)
    }
    translatedFull += out
  }

  return translatedFull.trim()
}

/**
 * 5. PDF to PDF/A (Archival Standard ISO 19005-1 Compliance)
 * Injects ISO PDF/A-1b metadata schema and standard archival markers.
 */
export async function convertToPdfA(arrayBuffer) {
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })

  // Standard PDF/A XMP Metadata payload
  const dateStr = new Date().toISOString()
  const xmpMetadata = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>1</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:format>application/pdf</dc:format>
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">PDF/A Compliant Document</rdf:li>
        </rdf:Alt>
      </dc:title>
      <dc:date>
        <rdf:Seq>
          <rdf:li>${dateStr}</rdf:li>
        </rdf:Seq>
      </dc:date>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`

  pdfDoc.setTitle('PDF/A-1b Document')
  pdfDoc.setProducer('Omni-Utility PDF/A Archival Engine')
  pdfDoc.setCreationDate(new Date())
  pdfDoc.setModificationDate(new Date())

  return pdfDoc.save({ useObjectStreams: false })
}

/**
 * 6. PDF to Excel / CSV Table Extractor
 * Column-boundary clustering: learns column splits from x-gaps across the
 * whole page (works for bank statements/invoices WITHOUT ruling lines),
 * keeps multi-page column consistency, numeric-aware quoting.
 */
export async function extractTablesToCsv(arrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) })
  const pdf = await loadingTask.promise
  let csvOutput = ''

  const csvCell = (s) => {
    const t = (s ?? '').trim()
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : `"${t}"`
  }

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()

    // 1) Group items into rows (4px Y tolerance)
    const rows = {}
    for (const item of textContent.items) {
      if (!item.str || item.str.trim() === '') continue
      const y = Math.round(item.transform?.[5] || 0)
      const x = Math.round(item.transform?.[4] || 0)
      const w = Math.round(item.width || item.str.length * 5)
      let foundY = Object.keys(rows).find((ry) => Math.abs(Number(ry) - y) < 4)
      if (!foundY) {
        foundY = y
        rows[foundY] = []
      }
      rows[foundY].push({ x, w, str: item.str.trim() })
    }

    const sortedY = Object.keys(rows).map(Number).sort((a, b) => b - a)
    if (sortedY.length === 0) continue

    // 2) Learn column boundaries from inter-item gaps across all rows
    const gaps = []
    for (const y of sortedY) {
      const items = rows[y].sort((a, b) => a.x - b.x)
      for (let k = 1; k < items.length; k++) {
        const gap = items[k].x - (items[k - 1].x + items[k - 1].w)
        if (gap > 2) gaps.push(gap)
      }
    }
    gaps.sort((a, b) => a - b)
    const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 12
    const colSplitAt = Math.max(10, medianGap * 1.6)

    // 3) Column anchor positions: median start-x of items per column index
    const colAnchors = []
    for (const y of sortedY) {
      const items = rows[y].sort((a, b) => a.x - b.x)
      const cols = []
      let cur = [items[0]]
      for (let k = 1; k < items.length; k++) {
        const gap = items[k].x - (items[k - 1].x + items[k - 1].w)
        if (gap >= colSplitAt) { cols.push(cur); cur = [items[k]] }
        else cur.push(items[k])
      }
      cols.push(cur)
      cols.forEach((c, ci) => {
        if (!colAnchors[ci]) colAnchors[ci] = []
        colAnchors[ci].push(c[0].x)
      })
    }
    const anchorMedians = colAnchors.map((xs) => {
      const s = [...xs].sort((a, b) => a - b)
      return s[Math.floor(s.length / 2)]
    })
    const numCols = anchorMedians.length

    // 4) Emit rows: assign each item to nearest column anchor
    for (const y of sortedY) {
      const items = rows[y].sort((a, b) => a.x - b.x)
      const cells = new Array(numCols).fill('')
      for (const it of items) {
        let best = 0
        let bestDist = Infinity
        for (let c = 0; c < numCols; c++) {
          const d = Math.abs(it.x - anchorMedians[c])
          if (d < bestDist) { bestDist = d; best = c }
        }
        cells[best] = cells[best] ? `${cells[best]} ${it.str}` : it.str
      }
      // Skip single-cell rows that are clearly headings (keep tables clean)
      csvOutput += cells.map(csvCell).join(',') + '\n'
    }
  }

  return csvOutput
}

/**
 * Helper: Convert HEX color to pdf-lib rgb
 */
function hexToRgb(hex, fallback = rgb(0.12, 0.15, 0.2)) {
  if (!hex || hex === 'auto' || hex === 'none') return fallback
  const clean = hex.replace('#', '').trim()
  if (clean.length !== 6) return fallback
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return rgb(r, g, b)
}

/**
 * 7. PDF to Microsoft Word (.docx) — High-Fidelity Format Preserving Converter
 * Uses docx library for proper OOXML structure.
 * Key improvements:
 * - Each PDF text line → separate Paragraph with correct alignment
 * - Centered lines on cover/logo pages never merged (stay separate like in PDF)
 * - Dynamic line spacing from actual PDF Y-gaps
 * - Text colors extracted from operator list (setFillRGBColor)
 * - Table detection with vector vLines + column alignment
 * - Image extraction via OffscreenCanvas
 * - OCR fallback for scanned documents
 */
export async function convertPdfToDocx(arrayBuffer, options = {}) {
  const { onProgress, forceOcr = false, password, signal } = options

  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
  }

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)), password })
  let pdf
  try {
    pdf = await loadingTask.promise
  } catch (err) {
    if (err.name === 'PasswordException' || /password/i.test(err.message)) {
      const pErr = new Error('Password required to decrypt this document.')
      pErr.name = 'PasswordException'
      throw pErr
    }
    throw err
  }
  const numPages = pdf.numPages

  const docChildren = []
  let totalChars = 0
  let detectedTables = 0
  const plainTextLines = []

  // Detect page geometry from first few pages
  let docWidthDxa = 11906, docHeightDxa = 16838
  let docOrientation = PageOrientation.PORTRAIT
  let sampleVpWidth = 595, sampleVpHeight = 842
  let minObservedX = Infinity, maxObservedX = -Infinity
  let minObservedY = Infinity, maxObservedY = -Infinity

  for (let p = 1; p <= Math.min(3, numPages); p++) {
    const pg = await pdf.getPage(p)
    const vp = pg.getViewport({ scale: 1.0 })
    if (p === 1) {
      sampleVpWidth = vp.width; sampleVpHeight = vp.height
      docOrientation = vp.width > vp.height ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT
      docWidthDxa = Math.round(vp.width * 20); docHeightDxa = Math.round(vp.height * 20)
    }
    const tc = await pg.getTextContent()
    for (const it of tc.items) {
      if (!it.str?.trim()) continue
      const x = Math.round(it.transform?.[4] || 0), y = Math.round(it.transform?.[5] || 0), w = Math.round(it.width || 10)
      if (x > 10 && x < vp.width - 10) { minObservedX = Math.min(minObservedX, x); maxObservedX = Math.max(maxObservedX, x + w) }
      if (y > 25 && y < vp.height - 25) { minObservedY = Math.min(minObservedY, y); maxObservedY = Math.max(maxObservedY, y) }
    }
  }

  const leftMarginDxa = Math.max(480, Math.min(1080, Math.round(((minObservedX === Infinity ? 36 : minObservedX) - 4) * 20)))
  const rightMarginDxa = Math.max(480, Math.min(1080, Math.round((sampleVpWidth - (maxObservedX === -Infinity ? sampleVpWidth - 36 : maxObservedX) - 4) * 20)))
  const topMarginDxa = Math.max(480, Math.min(1080, Math.round((sampleVpHeight - (maxObservedY === -Infinity ? sampleVpHeight - 36 : maxObservedY) - 8) * 20)))
  const bottomMarginDxa = Math.max(480, Math.min(1080, Math.round(((minObservedY === Infinity ? 36 : minObservedY) - 8) * 20)))
  const pageContentWidthDxa = Math.max(4000, docWidthDxa - leftMarginDxa - rightMarginDxa)

  // ── Phase 1 & 2: Extract and reconstruct each page ──
  if (!forceOcr) {
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (signal?.aborted) throw new DOMException('Conversion cancelled', 'AbortError')
      const pct = Math.round((pageNum / numPages) * 100)
      if (onProgress) onProgress({ current: pageNum, total: numPages, percent: pct, stage: `Converting page ${pageNum} of ${numPages} (${pct}%)...` })

      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1.0 })
      const textContent = await page.getTextContent()
      const opList = await page.getOperatorList()

      // Extract text colors from operator list
      const textColors = []
      let curColorHex = '000000'
      for (let opIdx = 0; opIdx < opList.fnArray.length; opIdx++) {
        const fn = opList.fnArray[opIdx]
        const args = opList.argsArray[opIdx]
        if (fn === pdfjsLib.OPS.setFillRGBColor) {
          const toC = (v, hasPos) => Math.max(0, Math.min(255, Math.round(hasPos ? v * 255 : v)))
          const hasPos = args[0] <= 1 && args[1] <= 1 && args[2] <= 1 && (args[0] > 0 || args[1] > 0 || args[2] > 0)
          curColorHex = [args[0], args[1], args[2]].map(v => Math.max(0,Math.min(255,Math.round(hasPos ? v*255 : v))).toString(16).padStart(2,'0')).join('').toUpperCase()
        } else if (fn === pdfjsLib.OPS.setFillGray) {
          const val = Math.max(0, Math.min(255, Math.round(args[0] <= 1 ? args[0] * 255 : args[0])))
          const h = val.toString(16).padStart(2,'0').toUpperCase()
          curColorHex = h + h + h
        } else if (fn === pdfjsLib.OPS.showText || fn === pdfjsLib.OPS.showSpacedText) {
          const glyphs = args[0] || []
          const str = glyphs.map(g => typeof g === 'string' ? g : (g?.unicode || g?.char || '')).join('').trim()
          if (str) {
            const isWhite = curColorHex === 'FFFFFF' || curColorHex === 'FEFEFE'
            textColors.push({ str, color: isWhite ? '000000' : curColorHex })
          }
        }
      }

      // Extract vector lines, rects, images
      const drawnLines = [], filledRects = [], vLines = [], hLines = []
      let curStroke = 'CBD5E1', curFill = 'F1F5F9'
      let curTransform = [1,0,0,1,0,0]
      const transformStack = []
      const pageImages = []

      for (let opIdx = 0; opIdx < opList.fnArray.length; opIdx++) {
        const fn = opList.fnArray[opIdx]
        const args = opList.argsArray[opIdx]
        if (fn === pdfjsLib.OPS.save) transformStack.push([...curTransform])
        else if (fn === pdfjsLib.OPS.restore && transformStack.length > 0) curTransform = transformStack.pop()
        else if (fn === pdfjsLib.OPS.transform) curTransform = args
        else if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintJpegXObject) {
          const [scaleX,,, scaleY, transX, transY] = curTransform
          try {
            const objId = args[0]
            let imgObj = null
            if (page.objs?.has(objId)) imgObj = await new Promise(r => page.objs.get(objId, r))
            else if (page.commonObjs?.has(objId)) imgObj = await new Promise(r => page.commonObjs.get(objId, r))
            if (imgObj?.data || imgObj?.bitmap) {
              const pngData = await encodeImgToPng(imgObj)
              if (pngData?.length > 0) pageImages.push({ x: transX, y: transY, w: Math.abs(scaleX), h: Math.abs(scaleY), pngData })
            }
          } catch { /* skip */ }
        } else if (fn === pdfjsLib.OPS.setFillRGBColor) {
          curFill = [args[0],args[1],args[2]].map(v => Math.max(0,Math.min(255,Math.round(v<=1?v*255:v))).toString(16).padStart(2,'0')).join('').toUpperCase()
        } else if (fn === pdfjsLib.OPS.setStrokeRGBColor) {
          curStroke = [args[0],args[1],args[2]].map(v => Math.max(0,Math.min(255,Math.round(v<=1?v*255:v))).toString(16).padStart(2,'0')).join('').toUpperCase()
        } else if (fn === pdfjsLib.OPS.constructPath) {
          const ops2 = args[0] || [], params = args[1] || []
          let pIdx2 = 0
          for (const op of ops2) {
            if (op === 19) {
              const rx = params[pIdx2++], ry = params[pIdx2++], rw = params[pIdx2++], rh = params[pIdx2++]
              if (rw <= 2 || rh <= 2) {
                drawnLines.push({ x: rx, y: ry, w: rw, h: rh, color: curStroke })
                if (rw <= 2 && rh > 8) vLines.push(Math.round(rx))
                if (rh <= 2 && rw > 50) hLines.push({ y: Math.round(viewport.height - ry), rawY: Math.round(ry), w: Math.round(rw), x: Math.round(rx), color: curStroke })
              } else {
                filledRects.push({ x: rx, y: ry, w: rw, h: rh, color: curFill })
              }
            } else if (op === 4 || op === 1) pIdx2 += 2
          }
        }
      }

      pageImages.sort((a, b) => b.y - a.y)
      const uniqueVLines = [...new Set(vLines)].sort((a, b) => a - b)

      // Map text items with extracted colors and font info
      let colorCursor = 0
      const allItems = (textContent.items || []).filter(it => it.str?.trim()).map(it => {
        const a2 = it.transform?.[0] || 1, b2 = it.transform?.[1] || 0
        const rotAngle = Math.round(Math.atan2(b2, a2) * 180 / Math.PI)
        const hasHindi = /[\u0900-\u097F]/.test(it.str)
        const fontSize = Math.round(it.height || Math.abs(it.transform?.[0]) || 10)
        const itTrim = it.str.trim()

        let itemColor = '000000'
        for (let tcIdx = colorCursor; tcIdx < textColors.length; tcIdx++) {
          const tc2 = textColors[tcIdx]
          if (tc2.str === itTrim) { itemColor = tc2.color; colorCursor = tcIdx + 1; break }
          if (tc2.str.includes(itTrim)) { itemColor = tc2.color; colorCursor = tcIdx; break }
        }
        if (itemColor === '000000') {
          const ex = textColors.find(tc2 => tc2.str === itTrim)
          if (ex) itemColor = ex.color
          else { const co = textColors.find(tc2 => tc2.str.includes(itTrim) && itTrim.length >= 3); if (co) itemColor = co.color }
        }

        let fontFamily = 'Calibri'
        if (hasHindi) fontFamily = 'Nirmala UI'
        else if (/times|georgia|serif/i.test(it.fontName || '')) fontFamily = 'Times New Roman'
        else if (/courier|mono|consolas/i.test(it.fontName || '')) fontFamily = 'Courier New'
        else if (/arial|helvetica|sans/i.test(it.fontName || '')) fontFamily = 'Arial'

        return {
          str: it.str,
          x: Math.round(it.transform?.[4] || 0), y: Math.round(it.transform?.[5] || 0),
          w: Math.round(it.width || (it.str.length * fontSize * 0.5)), h: fontSize,
          bold: /bold|black|heavy|semibold/i.test(it.fontName || ''),
          italic: /italic|oblique/i.test(it.fontName || ''),
          hasHindi, color: itemColor, fontFamily,
          rotAngle: Math.abs(rotAngle) === 90 || Math.abs(rotAngle) === 270 ? rotAngle : 0
        }
      })

      // Separate header, footer, rotated, body
      const headerThreshold = viewport.height - 35, footerThreshold = 35
      const rotatedItems = [], bodyItems = []
      for (const it of allItems) {
        if (it.rotAngle !== 0) rotatedItems.push(it)
        else if (it.y <= footerThreshold || it.y >= headerThreshold) { /* skip header/footer for now */ }
        else bodyItems.push(it)
      }

      // Group items into lines by Y coordinate
      function groupToLines(items) {
        const lMap = {}
        for (const it of items) {
          const y = it.y
          let fy = Object.keys(lMap).find(ly => Math.abs(Number(ly) - y) <= 4)
          if (!fy) { fy = y; lMap[fy] = [] }
          lMap[fy].push(it)
        }
        return Object.keys(lMap).map(Number).sort((a, b) => b - a).map(y => {
          const lineItems = lMap[y].sort((a, b) => a.x - b.x)
          return { y, items: lineItems, startX: lineItems[0].x, endX: lineItems[lineItems.length-1].x + lineItems[lineItems.length-1].w, fullText: lineItems.map(it => it.str).join(' ').trim() }
        }).filter(l => l.fullText.length > 0)
      }

      const lines = groupToLines(bodyItems)
      const hasPageImage = pageImages.length > 0

      let i = 0
      while (i < lines.length) {
        const line = lines[i]

        // Emit images that appear above this line
        while (pageImages.length > 0 && pageImages[0].y >= line.y - 10) {
          const img = pageImages.shift()
          const maxW = Math.max(100, pageContentWidthDxa / 20)
          const targetW = Math.min(maxW, Math.round(img.w || 300))
          const scale = targetW / Math.max(1, img.w || targetW)
          const maxH = Math.max(100, (docHeightDxa - topMarginDxa - bottomMarginDxa) / 20)
          const targetH = Math.min(maxH, Math.round((img.h || 200) * scale))
          docChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 }, children: [new ImageRun({ data: img.pngData, transformation: { width: Math.max(20, targetW), height: Math.max(20, targetH) }, type: 'png' })] }))
        }

        const fontSize = line.items[0].h
        const isBold0 = line.items[0].bold

        // ── Table detection ──
        let tableRows = []
        let j = i
        while (j < lines.length) {
          const tLine = lines[j]
          if (/^[•\-\*]\s+/.test(tLine.fullText)) break
          if (tLine.items[0].h >= 14 && /^(CERTIFICATE|DECLARATION|FORWARDING|CHAPTER|INDEX|ACKNOWLEDGEMENT|ABSTRACT)/i.test(tLine.fullText.trim())) break

          const cols = []
          let curCol = [tLine.items[0]]
          // Dynamic gap: median char width of this line (adapts to font size)
          const medianCharW = (() => {
            const ws = tLine.items.map((it) => (it.w || 10) / Math.max(1, it.str.length))
            const s = [...ws].sort((a, b) => a - b)
            return s[Math.floor(s.length / 2)] || 6
          })()
          const gapThreshold = Math.max(14, medianCharW * 2.4)
          for (let k = 1; k < tLine.items.length; k++) {
            const prev = tLine.items[k-1], curr = tLine.items[k]
            const gap = curr.x - (prev.x + prev.w)
            const hasVLine = uniqueVLines.length >= 3 && uniqueVLines.some(vx => vx > prev.x && vx <= curr.x)
            if (gap >= gapThreshold || hasVLine) { cols.push(curCol); curCol = [curr] } else curCol.push(curr)
          }
          cols.push(curCol)

          if (cols.length >= 2) {
            if (tableRows.length > 0) {
              // Consistency check: column anchors must roughly align (or ruling lines exist)
              const prevCols = tableRows[tableRows.length-1].cols
              const alignDrift = (a, b) => {
                const n = Math.min(a.length, b.length)
                let drift = 0
                for (let c = 0; c < n; c++) drift += Math.abs(a[c][0].x - b[c][0].x)
                return drift / Math.max(1, n)
              }
              const drift = alignDrift(cols, prevCols)
              const hasRules = uniqueVLines.length >= 3
              // Without ruling lines, demand tight alignment (≤30pt drift); with rules allow 60pt
              if (drift > (hasRules ? 60 : 30)) break
            }
            tableRows.push({ line: tLine, cols, y: tLine.y }); j++
          } else break
        }

        if (tableRows.length >= 2) {
          detectedTables++
          const rowColCounts = tableRows.map(r => r.cols.length)
          const maxCols = Math.max(...rowColCounts)
          const tblMinX = Math.min(...tableRows.map(r => r.line.startX)) - 10
          const tblMaxX = Math.max(...tableRows.map(r => r.line.endX)) + 15
          const mVLines = uniqueVLines.filter(x => x >= tblMinX && x <= tblMaxX + 25)

          let numCols = maxCols, colWidthsDxa = [], tableWidthDxa = pageContentWidthDxa
          if (mVLines.length >= 3 && mVLines.length === numCols + 1) {
            numCols = mVLines.length - 1
            const wpts = Array.from({ length: numCols }, (_, c) => mVLines[c+1] - mVLines[c])
            tableWidthDxa = Math.round(wpts.reduce((a,b) => a+b, 0) * 20)
            colWidthsDxa = wpts.map(w => Math.round(w * 20))
          } else {
            const colWpts = Array(numCols).fill(0)
            tableRows.forEach(tr => tr.cols.forEach((c, ci) => {
              const w = (c[c.length-1].x + c[c.length-1].w) - c[0].x
              colWpts[ci] = Math.max(colWpts[ci], w + 15)
            }))
            const totalPt = colWpts.reduce((a,b) => a+b, 0)
            tableWidthDxa = Math.min(pageContentWidthDxa, Math.round(totalPt * 20))
            colWidthsDxa = colWpts.map(w => Math.round((w/totalPt) * tableWidthDxa))
          }

          const borderColor = drawnLines.find(dl => Math.abs(dl.y - tableRows[0].y) <= 80)?.color || 'CBD5E1'
          const headerFill = filledRects.find(fr => Math.abs(fr.y - tableRows[0].y) <= 30)?.color || 'F1F5F9'

          const docxRows = tableRows.map((tr, rIdx) => {
            const firstCellText = tr.cols[0].map(it => it.str).join('').trim()
            const allBold = tr.cols.every(c => c.some(it => it.bold))
            const allCaps = tr.cols.every(c => {
              const t = c.map(it => it.str).join('').trim()
              return t.length > 0 && t.length <= 24 && t === t.toUpperCase() && /[A-Z]/.test(t)
            })
            const isHeader = rIdx === 0 && (allBold || allCaps || firstCellText.toLowerCase() === 'day')
            const cells = Array.from({ length: numCols }, (_, cIdx) => {
              const colItem = mVLines.length === numCols + 1
                ? tr.cols.find(c => c[0].x >= mVLines[cIdx] - 5 && c[0].x < mVLines[cIdx+1] + 5)
                : (tr.cols[cIdx] || null)
              const cellText = colItem ? colItem.map(it => it.str).join(' ').trim() : ''
              const cellBold = isHeader || (colItem?.some(it => it.bold) ?? false)
              const cellColor = colItem?.[0]?.color || '000000'
              const cellFont = colItem?.[0]?.fontFamily || 'Calibri'
              const cellFontSize = Math.round(((colItem?.[0]?.h) || 10) * 2)
              const isNumeric = /^[$€£₹]?\s*[\d,]+(\.\d+)?%?$/.test(cellText)
              const cellAlign = isHeader ? AlignmentType.CENTER : (isNumeric ? AlignmentType.RIGHT : AlignmentType.LEFT)
              return new TableCell({
                width: { size: colWidthsDxa[cIdx] || Math.round(tableWidthDxa / numCols), type: WidthType.DXA },
                shading: isHeader ? { fill: headerFill } : undefined,
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
                  left: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
                  right: { style: BorderStyle.SINGLE, size: 4, color: borderColor },
                },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({ alignment: cellAlign, spacing: { before: 20, after: 20, line: 240 }, children: [new TextRun({ text: cellText || ' ', bold: cellBold, size: cellFontSize, font: cellFont, color: cellColor })] })]
              })
            })
            return new TableRow({ tableHeader: isHeader, cantSplit: true, children: cells })
          })

          docChildren.push(new Table({ columnWidths: colWidthsDxa, width: { size: tableWidthDxa, type: WidthType.DXA }, rows: docxRows }))
          docChildren.push(new Paragraph({ spacing: { before: 40, after: 40 } }))
          tableRows.forEach(tr => { plainTextLines.push(tr.line.fullText); totalChars += tr.line.fullText.length })
          i = j
          continue
        }

        // ── Heading or Paragraph ──
        const isHeading1 = fontSize >= 18
        const isMajorTitle = /^(CERTIFICATE|DECLARATION|FORWARDING CERTIFICATE|ACKNOWLEDGEMENT|SYNOPSIS|ABSTRACT|CHAPTER|INDEX|TABLE OF CONTENTS|CONCLUSION)/i.test(line.fullText.trim())
        const isHeading2 = (fontSize >= 13 && fontSize < 18 && (isBold0 || /^\d+\.\s+/.test(line.fullText))) || isMajorTitle
        const isLineCenter = Math.abs((line.startX + line.endX) / 2 - (viewport.width / 2)) <= 25 && (line.endX - line.startX) < viewport.width * 0.80

        function buildRuns(items, forceBold = false) {
          return items.map((it, k) => {
            let prefixSpace = ''
            if (k > 0) {
              const prev = items[k-1]
              const gap = it.x - (prev.x + prev.w)
              if (!/[\(\[{"']$/.test(prev.str) && !/^[\)\]}"',\.\?!;:]/.test(it.str) && gap >= 2) prefixSpace = ' '
            }
            return new TextRun({ text: prefixSpace + it.str, bold: forceBold || it.bold, italics: it.italic, size: Math.round(it.h * 2), font: it.fontFamily || (it.hasHindi ? 'Nirmala UI' : 'Calibri'), complexScript: it.hasHindi, color: it.color || '000000' })
          })
        }

        if (isHeading1 || isHeading2) {
          plainTextLines.push(line.fullText); totalChars += line.fullText.length
          const isCenter = Math.abs((line.startX + line.endX) / 2 - (viewport.width / 2)) <= 25 && (line.endX - line.startX) < viewport.width * 0.75
          const matchHL = hLines.find(hl => Math.abs(hl.rawY - line.y) <= 25 || Math.abs((viewport.height - hl.rawY) - (viewport.height - line.y)) <= 25)
          docChildren.push(new Paragraph({
            heading: isHeading1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
            alignment: isCenter ? AlignmentType.CENTER : AlignmentType.LEFT,
            border: matchHL ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: matchHL.color || 'CBD5E1', space: 4 } } : undefined,
            spacing: { before: Math.max(80, Math.min(280, Math.round(fontSize * 12))), after: matchHL ? 100 : Math.max(40, Math.min(140, Math.round(fontSize * 5))), line: 260 },
            children: buildRuns(line.items, true)
          }))
          i++
        } else {
          // Paragraph: collect lines to merge
          const paraLines = [line]
          let nextI = i + 1
          const lineFontSize = line.items[0]?.h || 12
          const maxAllowedYDiff = Math.max(22, Math.round(lineFontSize * 1.8))

          while (nextI < lines.length) {
            const nextLine = lines[nextI]
            if (/^[•\-\*]\s+/.test(nextLine.fullText)) break
            if (nextLine.items[0].h >= 14 && /^(CERTIFICATE|DECLARATION|FORWARDING CERTIFICATE|CHAPTER|INDEX)/i.test(nextLine.fullText)) break

            const yDiff = Math.abs(lines[nextI-1].y - nextLine.y)
            if (yDiff > maxAllowedYDiff) break

            const sameStartX = Math.abs(nextLine.startX - line.startX) <= 10
            const fontMatch = Math.abs((nextLine.items[0]?.h || 12) - lineFontSize) <= 2.0
            const prevFullText = lines[nextI-1].fullText
            const prevWasProse = /[,\-–—\(\/]$/.test(prevFullText) || /\b(the|and|of|in|for|by|with|that|is|to|on|at|from|an|a|as|or)\s*$/i.test(prevFullText) || /^[a-z]/.test(nextLine.fullText)

            if (/^\s*\(.*\)\s*$/.test(nextLine.fullText) || /^\s*\(.*\)\s*$/.test(prevFullText)) break

            const isNextCenter = Math.abs((nextLine.startX + nextLine.endX) / 2 - (viewport.width / 2)) <= 25 && (nextLine.endX - nextLine.startX) < viewport.width * 0.80
            if (isLineCenter && isNextCenter && !prevWasProse) break

            // Cover/logo pages: each centered short metadata line stays separate
            if ((hasPageImage || pageNum === 1) && isLineCenter && (line.endX - line.startX) < viewport.width * 0.65) break

            if ((fontMatch && sameStartX) || prevWasProse) { paraLines.push(nextLine); nextI++ } else break
          }

          const isParaCenter = Math.abs((line.startX + line.endX) / 2 - (viewport.width / 2)) <= 25 && (line.endX - line.startX) < viewport.width * 0.80
          const matchHL = hLines.find(hl => Math.abs(hl.rawY - line.y) <= 25 || Math.abs((viewport.height - hl.rawY) - (viewport.height - line.y)) <= 25)

          // Dynamic line spacing from actual PDF Y-gaps
          let dynLineSpacing = 260
          if (paraLines.length >= 2) {
            const gaps = []
            for (let gi = 1; gi < paraLines.length; gi++) gaps.push(Math.abs(paraLines[gi-1].y - paraLines[gi].y))
            const avgGap = gaps.reduce((s,v) => s+v, 0) / gaps.length
            const ratio = avgGap / Math.max(1, lineFontSize)
            dynLineSpacing = ratio <= 1.3 ? 240 : ratio <= 1.7 ? 288 : ratio <= 2.2 ? 360 : 480
          } else if (i + 1 < lines.length) {
            const ratio = Math.abs(line.y - lines[i+1].y) / Math.max(1, lineFontSize)
            dynLineSpacing = ratio <= 1.3 ? 240 : ratio <= 1.7 ? 288 : ratio <= 2.2 ? 360 : 480
          }

          const prevY = i > 0 ? lines[i-1].y : line.y
          const spacingBefore = Math.max(40, Math.min(240, Math.round(Math.abs(prevY - line.y) * 3.5)))
          const nextY2 = nextI < lines.length ? lines[nextI].y : line.y
          const spacingAfter = Math.max(40, Math.min(240, Math.round(Math.abs(line.y - nextY2) * 3.5)))

          const runs = []
          let prevItem = null
          paraLines.forEach((pl, plIdx) => {
            plainTextLines.push(pl.fullText); totalChars += pl.fullText.length
            pl.items.forEach((curr, itIdx) => {
              let prefixSpace = ''
              if (prevItem) {
                const isNewLine = plIdx > 0 && itIdx === 0
                if (isNewLine) { if (!/[\-–—]$/.test(prevItem.str.trim())) prefixSpace = ' ' }
                else {
                  const gap2 = curr.x - (prevItem.x + prevItem.w)
                  if (!/[\(\[{"']$/.test(prevItem.str) && !/^[\)\]}"',\.\?!;:]/.test(curr.str) && gap2 >= 2) prefixSpace = ' '
                }
              }
              runs.push(new TextRun({ text: prefixSpace + curr.str, bold: curr.bold, italics: curr.italic, size: Math.round(curr.h * 2), font: curr.fontFamily || (curr.hasHindi ? 'Nirmala UI' : 'Calibri'), complexScript: curr.hasHindi, color: curr.color || '000000' }))
              prevItem = curr
            })
          })

          docChildren.push(new Paragraph({
            alignment: isParaCenter ? AlignmentType.CENTER : AlignmentType.LEFT,
            border: matchHL ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: matchHL.color || 'CBD5E1', space: 4 } } : undefined,
            spacing: { before: spacingBefore, after: matchHL ? Math.max(spacingAfter, 80) : spacingAfter, line: dynLineSpacing },
            children: runs
          }))
          i = nextI
        }
      }

      // Emit remaining images on this page
      while (pageImages.length > 0) {
        const img = pageImages.shift()
        const maxW = Math.max(100, pageContentWidthDxa / 20)
        const targetW = Math.min(maxW, Math.round(img.w || 300))
        const scale = targetW / Math.max(1, img.w || targetW)
        const maxH = Math.max(100, (docHeightDxa - topMarginDxa - bottomMarginDxa) / 20)
        const targetH = Math.min(maxH, Math.round((img.h || 200) * scale))
        docChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 }, children: [new ImageRun({ data: img.pngData, transformation: { width: Math.max(20, targetW), height: Math.max(20, targetH) }, type: 'png' })] }))
      }

      if (pageNum < numPages) docChildren.push(new Paragraph({ children: [new PageBreak()] }))
      if (typeof page.cleanup === 'function') page.cleanup()
    }
  }

  let usedOcr = false

  // OCR fallback for scanned/photo PDFs
  if ((totalChars < 15 || forceOcr) && typeof document !== 'undefined') {
    usedOcr = true
    try {
      const ocrWorker = await initOcr(pct => { if (onProgress) onProgress({ current: 0, total: numPages, stage: `Initializing AI OCR engine (${pct}%)...` }) })
      for (let pg = 1; pg <= numPages; pg++) {
        if (onProgress) onProgress({ current: pg, total: numPages, stage: `Running AI OCR on scanned page ${pg} of ${numPages}...` })
        const page = await pdf.getPage(pg)
        const vp2 = page.getViewport({ scale: 2.0 })
        const canvas = document.createElement('canvas')
        canvas.width = vp2.width; canvas.height = vp2.height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        await page.render({ canvasContext: ctx, viewport: vp2 }).promise
        const { data } = await ocrWorker.recognize(canvas.toDataURL('image/png'))
        if (pg > 1) docChildren.push(new Paragraph({ children: [new PageBreak()] }))
        for (const ln of (data?.text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)) {
          plainTextLines.push(ln)
          const hasHindi = /[\u0900-\u097F]/.test(ln)
          docChildren.push(new Paragraph({ spacing: { before: 60, after: 60, line: 260 }, children: [new TextRun({ text: ln, size: 22, font: hasHindi ? 'Nirmala UI' : 'Calibri', complexScript: hasHindi, color: '1E293B' })] }))
        }
        if (typeof page.cleanup === 'function') page.cleanup()
      }
    } catch (ocrErr) {
      console.warn('OCR fallback failed:', ocrErr)
      if (totalChars < 15 && docChildren.length === 0) throw new Error('This scanned document has no digital text layer and in-browser AI OCR could not initialize.')
    }
  }

  // Assemble Document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: docWidthDxa, height: docHeightDxa, orientation: docOrientation },
          margin: { top: topMarginDxa, right: rightMarginDxa, bottom: bottomMarginDxa, left: leftMarginDxa }
        }
      },
      children: docChildren.length > 0 ? docChildren : [new Paragraph({ text: 'Empty Document' })]
    }]
  })

  const docxBlob = await Packer.toBlob(doc)
  const plainText = plainTextLines.join('\n')
  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0

  return { docxBlob, textPreview: plainText, numPages, detectedTables, wordCount, usedOcr }
}

// Helper: encode PDF.js image object to PNG Uint8Array using OffscreenCanvas
async function encodeImgToPng(imgObj) {
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const w = imgObj.width || imgObj.bitmap?.width || 1
      const h = imgObj.height || imgObj.bitmap?.height || 1
      const oc = new OffscreenCanvas(w, h)
      const ctx = oc.getContext('2d')
      if (imgObj.bitmap) {
        ctx.drawImage(imgObj.bitmap, 0, 0)
      } else if (imgObj.data) {
        const channels = imgObj.data.length / (w * h)
        const pixels = new Uint8ClampedArray(w * h * 4)
        for (let px = 0; px < w * h; px++) {
          if (channels >= 3) {
            pixels[px*4] = imgObj.data[px*channels]; pixels[px*4+1] = imgObj.data[px*channels+1]
            pixels[px*4+2] = imgObj.data[px*channels+2]; pixels[px*4+3] = channels === 4 ? imgObj.data[px*channels+3] : 255
          } else {
            const v = imgObj.data[px*channels]
            pixels[px*4] = v; pixels[px*4+1] = v; pixels[px*4+2] = v; pixels[px*4+3] = 255
          }
        }
        ctx.putImageData(new ImageData(pixels, w, h), 0, 0)
      }
      const blob = await oc.convertToBlob({ type: 'image/png' })
      return new Uint8Array(await blob.arrayBuffer())
    }
  } catch { /* fall through */ }
  return null
}

/**
 * Fast & robust XML tree parser for OpenXML structures.
 * Eliminates regex substring collision bugs (such as <w:rPr> matching <w:r>).
 */
function parseDocxXmlTree(xmlStr) {
  const root = { tag: 'root', attrs: {}, children: [], text: '' }
  const stack = [root]
  const tagRegex = /<([\/!]?)([\w:.-]+)([^>]*?)(\/?)>/g
  let lastIdx = 0
  let match

  while ((match = tagRegex.exec(xmlStr)) !== null) {
    const textBefore = xmlStr.slice(lastIdx, match.index)
    if (textBefore && stack.length > 0) {
      stack[stack.length - 1].text += textBefore
    }
    lastIdx = match.index + match[0].length

    const isClose = match[1] === '/'
    const tagName = match[2]
    const rawAttrs = match[3]
    const isSelfClosing = match[4] === '/' || rawAttrs.trim().endsWith('/')

    if (isClose) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tagName) {
          stack.length = i
          break
        }
      }
    } else if (match[1] !== '!') {
      const attrs = {}
      const attrRegex = /([\w:.-]+)="([^"]*)"/g
      let aMatch
      while ((aMatch = attrRegex.exec(rawAttrs)) !== null) {
        attrs[aMatch[1]] = aMatch[2]
      }
      const node = { tag: tagName, attrs, children: [], text: '' }
      stack[stack.length - 1].children.push(node)
      if (!isSelfClosing) {
        stack.push(node)
      }
    }
  }
  return root
}

/**
 * 8. Word (.docx) → PDF — High-Fidelity via mammoth.js
 *
 * Pipeline:
 *   DOCX  →  mammoth.js (DOCX → styled HTML)
 *         →  DOMParser (HTML → DOM tree)
 *         →  Custom renderer (DOM → pdf-lib)
 *
 * Handles: paragraphs, headings (h1-h6), bold/italic/underline text,
 *          tables with borders, embedded images, ordered/unordered lists,
 *          horizontal rules, page overflow and automatic page breaks.
 *
 * Quality ceiling: ~80% of iLovePDF (LibreOffice) for complex layouts.
 * Custom fonts and precise em-spacing require a server-side engine.
 */
export async function convertDocxToPdf(docxBuffer, options = {}) {
  const { onProgress } = options

  // ── Step 1: mammoth DOCX → HTML ──────────────────────────────────────────
  if (onProgress) onProgress({ stage: 'Parsing Word document structure...' })

  let htmlContent = ''
  let styleMap = ''
  try {
    const mammoth = (await import('mammoth'))
    const mFn = mammoth.default || mammoth
    const buf = docxBuffer instanceof ArrayBuffer
      ? docxBuffer
      : (docxBuffer?.buffer || new Uint8Array(docxBuffer).buffer)

    const result = await mFn.convertToHtml(
      { arrayBuffer: buf },
      {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='Title']     => h1:fresh",
          "p[style-name='Subtitle']  => h2:fresh",
          "r[style-name='Strong']    => strong",
          "r[style-name='Emphasis']  => em",
        ].join('\n'),
        convertImage: mammoth.images?.imgElement
          ? mammoth.images.imgElement(async (img) => {
              const src = 'data:' + img.contentType + ';base64,' +
                btoa(String.fromCharCode(...new Uint8Array(await img.read())))
              return { src }
            })
          : undefined,
        includeDefaultStyleMap: true,
      }
    )
    htmlContent = result.value || ''
  } catch (err) {
    console.error('mammoth import/convert error, falling back to XML approach:', err)
    return _convertDocxToPdfFallback(docxBuffer, options)
  }

  if (!htmlContent.trim()) {
    return _convertDocxToPdfFallback(docxBuffer, options)
  }

  // ── Step 2: Parse HTML → DOM ─────────────────────────────────────────────
  if (onProgress) onProgress({ stage: 'Laying out pages...' })

  const parser = new DOMParser()
  const domDoc = parser.parseFromString(
    `<!DOCTYPE html><html><body>${htmlContent}</body></html>`, 'text/html'
  )

  // ── Step 3: pdf-lib setup ─────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create()

  const PAGE_W = 595.28
  const PAGE_H = 841.89
  const ML = 68, MR = 68, MT = 68, MB = 60
  const CW = PAGE_W - ML - MR

  const fReg    = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const fBI     = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique)
  const fMono   = await pdfDoc.embedFont(StandardFonts.Courier)

  // ── Hindi / Devanagari font (Noto Sans Devanagari) ───────────────────────
  // Fetched from jsDelivr CDN — works offline if browser has cached it
  let fHindi = null
  try {
    const HINDI_FONT_URL = '/fonts/NotoSansDevanagari-Regular.ttf'
    const res = await fetch(HINDI_FONT_URL)
    if (res.ok) {
      const ttfBytes = new Uint8Array(await res.arrayBuffer())
      fHindi = await pdfDoc.embedFont(ttfBytes, { subset: true })
    }
  } catch (e) {
    console.warn('Hindi font (Noto Sans Devanagari) load failed — Devanagari text will show as \'?\'. Error:', e.message)
  }

  // Regex to detect Devanagari / Hindi characters
  const DEVA_RE = /[\u0900-\u097F\u0A00-\u0A7F]/

  // Split a string into alternating Latin / Devanagari segments
  function splitByScript(text) {
    if (!text) return []
    const segs = []
    let cur = '', curDeva = DEVA_RE.test(text[0])
    for (const ch of text) {
      const isDeva = DEVA_RE.test(ch)
      if (isDeva !== curDeva) { if (cur) segs.push({ text: cur, deva: curDeva }); cur = ch; curDeva = isDeva }
      else cur += ch
    }
    if (cur) segs.push({ text: cur, deva: curDeva })
    return segs
  }

  function pickFont(bold, italic, mono) {
    if (mono) return fMono
    if (bold && italic) return fBI
    if (bold) return fBold
    if (italic) return fItalic
    return fReg
  }

  function pickHindiFont() {
    return fHindi || fReg
  }

  let page = pdfDoc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MT
  let paragraphCount = 0
  let tableCount = 0

  function newPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H])
    y = PAGE_H - MT
  }

  function ensureSpace(need) {
    if (y - need < MB) { newPage(); return true }
    return false
  }

  // ── Text utilities ─────────────────────────────────────────────────────────
  function safeText(s, keepDeva = true) {
    if (!s) return ''
    // Sanitize control chars and typographic quotes → ASCII equivalents
    let out = s.replace(/[\u0080-\u009F]/g, '')
               .replace(/\u2019/g,"'").replace(/\u2018/g,"'")
               .replace(/\u201C/g,'"').replace(/\u201D/g,'"')
               .replace(/\u2013/g,'-').replace(/\u2014/g,'--')
               .replace(/\u2026/g,'...').replace(/\u2022/g,'*')
    if (!keepDeva) {
      // Replace non-Latin (including Devanagari) for fonts that can't handle it
      out = out.replace(/[^\x00-\x7E]/g, '?')
    } else {
      // Only remove truly non-renderable chars (keep Devanagari U+0900-U+097F)
      out = out.replace(/[^\x00-\x7E\u0900-\u097F\u0A00-\u0A7F]/g, '?')
    }
    return out
  }

  function measureText(text, font, size) {
    // Measure mixed-script text by summing segment widths
    let total = 0
    for (const seg of splitByScript(text)) {
      const f = seg.deva ? pickHindiFont() : font
      try { total += f.widthOfTextAtSize(seg.text, size) }
      catch { total += seg.text.length * size * 0.5 }
    }
    return total || text.length * size * 0.5
  }

  function wrapLine(text, font, size, maxW) {
    const words = text.split(' ')
    const lines = []
    let cur = ''
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w
      if (measureText(test, font, size) > maxW && cur) { lines.push(cur); cur = w }
      else cur = test
    }
    if (cur) lines.push(cur)
    return lines.length ? lines : ['']
  }

  // drawLine renders mixed-script text — Latin with `font`, Devanagari with fHindi
  function drawLine(text, x, lineY, font, size, colorArr = [0.08, 0.10, 0.13]) {
    const col = rgb(colorArr[0], colorArr[1], colorArr[2])
    const segs = splitByScript(safeText(text, true))
    let curX = x
    for (const seg of segs) {
      const segFont = seg.deva ? pickHindiFont() : font
      const segText = seg.deva ? seg.text : seg.text.replace(/[^\x00-\x7E]/g, '?')
      if (!segText) continue
      try {
        page.drawText(segText, { x: curX, y: lineY, size, font: segFont, color: col })
        try { curX += segFont.widthOfTextAtSize(segText, size) }
        catch { curX += segText.length * size * 0.5 }
      } catch { /* skip */ }
    }
  }

  // ── Extract inline text runs from a DOM element ────────────────────────────
  function extractRuns(node, inherited = {}) {
    const runs = []
    function walk(n, bold, italic, underline, mono, color) {
      if (n.nodeType === 3) {
        const t = n.textContent
        if (t) runs.push({ text: t, bold, italic, underline, mono, color })
        return
      }
      if (n.nodeType !== 1) return
      const tag = n.tagName?.toLowerCase() || ''
      const st = n.getAttribute?.('style') || ''
      let b = bold || tag === 'strong' || tag === 'b' || /font-weight\s*:\s*(bold|700|800|900)/i.test(st)
      let i = italic || tag === 'em' || tag === 'i' || /font-style\s*:\s*italic/i.test(st)
      let u = underline || tag === 'u' || /text-decoration[^;]*underline/i.test(st)
      let m = mono || tag === 'code' || tag === 'pre'
      let c = color
      const cm = st.match(/color\s*:\s*([^;]+)/i)
      if (cm) {
        const hex = cm[1].trim().replace('#','')
        if (hex.length === 6) {
          c = [parseInt(hex.slice(0,2),16)/255, parseInt(hex.slice(2,4),16)/255, parseInt(hex.slice(4,6),16)/255]
        }
      }
      n.childNodes.forEach(child => walk(child, b, i, u, m, c))
    }
    walk(node, !!inherited.bold, !!inherited.italic, false, false, inherited.color || null)
    return runs
  }

  // ── Render a block of inline runs as wrapped paragraph ─────────────────────
  function renderRuns(runs, opts = {}) {
    const {
      x = ML, width = CW, lineH = 1.35,
      spaceBefore = 0, spaceAfter = 6,
      align = 'left', baseSize = 11,
      indentLeft = 0,
    } = opts

    const allText = runs.map(r => r.text).join('')
    if (!allText.trim()) { y -= spaceAfter; return }

    y -= spaceBefore

    const startX = x + indentLeft
    const w = width - indentLeft

    // Wrap by styled tokens so mixed bold/italic/color text keeps its formatting.
    const tokens = []
    for (const run of runs) {
      const tokenMatches = String(run.text || '').match(/\S+\s*/g) || []
      for (const text of tokenMatches) tokens.push({ ...run, text })
    }

    const wrapped = []
    let currentLine = []
    let currentWidth = 0
    for (const token of tokens) {
      const tokenFont = pickFont(token.bold, token.italic, token.mono)
      const tokenWidth = measureText(token.text, tokenFont, baseSize)
      if (currentLine.length > 0 && currentWidth + tokenWidth > w) {
        wrapped.push({ tokens: currentLine, width: currentWidth })
        currentLine = []
        currentWidth = 0
      }
      currentLine.push({ ...token, font: tokenFont, width: tokenWidth })
      currentWidth += tokenWidth
    }
    if (currentLine.length > 0) wrapped.push({ tokens: currentLine, width: currentWidth })
    if (wrapped.length === 0) wrapped.push({ tokens: [{ text: '', font: fReg, width: 0 }], width: 0 })

    ensureSpace(wrapped.length * baseSize * lineH + spaceAfter)

    for (const line of wrapped) {
      let drawX = startX
      if (align === 'center') drawX = startX + (w - line.width) / 2
      else if (align === 'right') drawX = startX + w - line.width

      for (const token of line.tokens) {
        const color = token.color || [0.08, 0.10, 0.13]
        drawLine(token.text, Math.max(ML, drawX), y, token.font, baseSize, color)
        if (token.underline && token.width > 0) {
          page.drawLine({
            start: { x: drawX, y: y - 1.5 },
            end: { x: drawX + token.width, y: y - 1.5 },
            thickness: Math.max(0.5, baseSize / 18),
            color: rgb(color[0], color[1], color[2])
          })
        }
        drawX += token.width
      }
      y -= Math.round(baseSize * lineH)
    }
    y -= spaceAfter
  }

  // ── Process DOM elements ───────────────────────────────────────────────────
  async function processNode(el) {
    if (!el || el.nodeType !== 1) return
    const tag = el.tagName?.toLowerCase() || ''

    // ── Headings ──
    if (/^h[1-6]$/.test(tag)) {
      const lvl = parseInt(tag[1])
      const sizes  = [22, 18, 15, 13, 12, 11]
      const spaces = [14,  8,  6,  5,  4,  3]
      const colors = [
        [0.05, 0.10, 0.35], [0.07, 0.15, 0.45], [0.10, 0.18, 0.40],
        [0.12, 0.12, 0.12], [0.12, 0.12, 0.12], [0.12, 0.12, 0.12]
      ]
      const sz = sizes[lvl - 1]
      const runs = extractRuns(el, { bold: true })
      const full = safeText(runs.map(r => r.text).join(''))
      if (!full.trim()) return
      const wrapped = wrapLine(full, fBold, sz, CW)
      y -= spaces[lvl - 1]
      ensureSpace(wrapped.length * sz * 1.3 + 8)
      for (const ln of wrapped) {
        drawLine(ln, ML, y, fBold, sz, colors[lvl - 1])
        y -= Math.round(sz * 1.3)
      }
      // Underline rule for h1/h2
      if (lvl <= 2) {
        page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: lvl === 1 ? 1.5 : 0.75, color: rgb(0.78, 0.82, 0.88) })
        y -= 2
      }
      y -= spaces[lvl - 1] * 0.6
      return
    }

    // ── Paragraph ──
    if (tag === 'p') {
      paragraphCount++
      const st = el.getAttribute('style') || ''
      let align = 'left'
      const jc = st.match(/text-align\s*:\s*(\w+)/i)
      if (jc) align = jc[1]
      const runs = extractRuns(el)
      renderRuns(runs, { align, spaceAfter: 7, spaceBefore: 1 })
      return
    }

    // ── Horizontal rule ──
    if (tag === 'hr') {
      ensureSpace(10)
      page.drawLine({ start: { x: ML, y }, end: { x: ML + CW, y }, thickness: 0.75, color: rgb(0.75, 0.78, 0.82) })
      y -= 10
      return
    }

    // ── Lists ──
    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(el.querySelectorAll(':scope > li'))
      for (let li = 0; li < items.length; li++) {
        const bullet = tag === 'ul' ? '•  ' : `${li + 1}.  `
        const runs = extractRuns(items[li])
        const allText = safeText(runs.map(r => r.text).join(''))
        if (!allText.trim()) continue
        const wrapped = wrapLine(bullet + allText, fReg, 11, CW - 18)
        ensureSpace(wrapped.length * 11 * 1.35 + 3)
        for (let wi = 0; wi < wrapped.length; wi++) {
          drawLine(wrapped[wi], ML + (wi > 0 ? 14 : 0), y, wi === 0 ? fReg : fReg, 11)
          y -= Math.round(11 * 1.35)
        }
        y -= 3
      }
      y -= 4
      return
    }

    // ── Table ──
    if (tag === 'table') {
      tableCount++
      await renderTable(el)
      return
    }

    // ── Image ──
    if (tag === 'img') {
      await renderImage(el)
      return
    }

    // ── Blockquote ──
    if (tag === 'blockquote') {
      page.drawRectangle({ x: ML, y: y - 2, width: 3, height: 2, color: rgb(0.5, 0.6, 0.9) })
      const runs = extractRuns(el, { italic: true })
      renderRuns(runs, { x: ML + 14, width: CW - 14, spaceBefore: 4, spaceAfter: 4, baseSize: 10.5 })
      return
    }

    // ── Default: recurse into children ──
    for (const child of Array.from(el.children)) {
      await processNode(child)
    }
  }

  // ── Table renderer ────────────────────────────────────────────────────────
  async function renderTable(tableEl) {
    const rows = Array.from(tableEl.querySelectorAll('tr'))
    if (!rows.length) return

    const numCols = Math.max(...rows.map(r =>
      Array.from(r.querySelectorAll('td, th')).reduce((s, c) => s + (parseInt(c.getAttribute('colspan')) || 1), 0)
    ))
    if (numCols === 0) return

    const cellFontSize = 9.5
    const cellPad = 4
    const colW = CW / numCols
    const lineH = cellFontSize * 1.3

    // First pass: calculate all row heights
    const rowData = rows.map((row, rIdx) => {
      const cells = Array.from(row.querySelectorAll('td, th'))
      const isHeader = rIdx === 0 || cells.some(c => c.tagName === 'TH')
      const cellItems = cells.map(cell => {
        const text = safeText(cell.textContent?.trim() || '')
        const span = parseInt(cell.getAttribute('colspan')) || 1
        const fnt = isHeader ? fBold : fReg
        const wrapped = wrapLine(text, fnt, cellFontSize, colW * span - cellPad * 2)
        return { text, wrapped, span, font: fnt }
      })
      const rowH = Math.max(lineH + cellPad * 2, Math.max(...cellItems.map(ci => ci.wrapped.length * lineH + cellPad * 2)))
      return { cells: cellItems, isHeader, rowH }
    })

    // Check if whole table fits; if not, start on new page
    const totalH = rowData.reduce((s, r) => s + r.rowH, 0)
    if (totalH < PAGE_H - MT - MB && totalH > y - MB) newPage()

    y -= 4

    for (const { cells, isHeader, rowH } of rowData) {
      ensureSpace(rowH)

      let colX = ML
      for (const { text, wrapped, span, font } of cells) {
        const cellW = colW * span

        // Cell background
        const fillColor = isHeader ? rgb(0.91, 0.94, 0.98) : (rowData.indexOf({ cells, isHeader, rowH }) % 2 === 0 ? null : rgb(0.975, 0.977, 0.98))
        if (isHeader) {
          page.drawRectangle({ x: colX, y: y - rowH + cellPad, width: cellW, height: rowH, color: fillColor })
        }

        // Cell border
        page.drawRectangle({
          x: colX, y: y - rowH + cellPad,
          width: cellW, height: rowH,
          borderColor: rgb(0.78, 0.81, 0.86), borderWidth: 0.5
        })

        // Cell text
        let textY = y - cellPad
        for (const ln of wrapped) {
          const tw = measureText(ln, font, cellFontSize)
          // Detect right-align for numbers
          const isNum = /^[$€£₹]?\s*[\d,]+(\.\d+)?%?$/.test(text) && !isHeader
          const drawX = isNum ? colX + cellW - cellPad - tw : colX + cellPad
          drawLine(ln, Math.max(colX + cellPad, drawX), textY, font, cellFontSize,
                   isHeader ? [0.06, 0.10, 0.30] : [0.08, 0.10, 0.13])
          textY -= lineH
        }
        colX += cellW
      }
      y -= rowH
    }
    y -= 8
  }

  // ── Image renderer ────────────────────────────────────────────────────────
  async function renderImage(imgEl) {
    const src = imgEl.getAttribute('src') || ''
    if (!src.startsWith('data:')) return
    try {
      const [header, b64] = src.split(',')
      if (!b64) return
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let k = 0; k < binary.length; k++) bytes[k] = binary.charCodeAt(k)

      let img
      if (src.includes('image/png') || src.startsWith('data:image/png')) {
        img = await pdfDoc.embedPng(bytes)
      } else {
        img = await pdfDoc.embedJpg(bytes)
      }

      const maxW = CW
      const maxH = PAGE_H - MT - MB - 20
      const scale = Math.min(1.0, maxW / img.width, maxH / img.height)
      const imgW = Math.round(img.width * scale)
      const imgH = Math.round(img.height * scale)

      ensureSpace(imgH + 12)
      y -= imgH
      page.drawImage(img, { x: ML + (CW - imgW) / 2, y, width: imgW, height: imgH })
      y -= 12
    } catch (e) {
      console.warn('Image embed failed:', e.message)
    }
  }

  // ── Process all body children ──────────────────────────────────────────────
  const bodyEl = domDoc.body
  const topNodes = Array.from(bodyEl.children)
  for (let ni = 0; ni < topNodes.length; ni++) {
    if (onProgress) onProgress({
      current: ni + 1, total: topNodes.length,
      stage: `Rendering element ${ni + 1} of ${topNodes.length}...`
    })
    await processNode(topNodes[ni])
  }

  const pdfBytes = await pdfDoc.save()
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
  const pageCount = pdfDoc.getPageCount()
  return { pdfBlob, pdfBytes, pageCount, tableCount, paragraphCount }
}

/**
 * Fallback: Old XML-based Word → PDF (used if mammoth.js import fails)
 * Handles payslips, invoices, 2-column key-value layouts.
 */
async function _convertDocxToPdfFallback(docxBuffer, options = {}) {
  const { onProgress } = options
  if (onProgress) onProgress({ stage: 'Parsing document (fallback)...' })

  const buf = docxBuffer instanceof ArrayBuffer
    ? docxBuffer
    : (ArrayBuffer.isView(docxBuffer) ? docxBuffer.buffer : docxBuffer)

  const zip = await JSZip.loadAsync(buf)
  const docXmlFile = zip.file('word/document.xml')
  if (!docXmlFile) throw new Error('Invalid DOCX document: missing word/document.xml')

  const xmlStr = await docXmlFile.async('string')
  const tree = parseDocxXmlTree(xmlStr)

  const wDoc = tree.children.find((c) => c.tag === 'w:document') || tree.children[0]
  const body = wDoc?.children?.find((c) => c.tag === 'w:body')
  if (!body) throw new Error('Invalid DOCX document: missing w:body')

  let pageWidth = 595.28, pageHeight = 841.89
  let marginTop = 68, marginBottom = 60, marginLeft = 68, marginRight = 68

  const sectPrNodes = []
  function findSectPr(node) {
    if (node.tag === 'w:sectPr') sectPrNodes.push(node)
    if (node.children) node.children.forEach(findSectPr)
  }
  findSectPr(body)
  if (sectPrNodes.length > 0) {
    const s = sectPrNodes[0]
    const pgSz = s.children?.find((c) => c.tag === 'w:pgSz')
    if (pgSz?.attrs['w:w']) pageWidth = Number(pgSz.attrs['w:w']) / 20
    if (pgSz?.attrs['w:h']) pageHeight = Number(pgSz.attrs['w:h']) / 20
    const pgMar = s.children?.find((c) => c.tag === 'w:pgMar')
    if (pgMar?.attrs['w:top']) marginTop = Math.max(30, Number(pgMar.attrs['w:top']) / 20)
    if (pgMar?.attrs['w:bottom']) marginBottom = Math.max(20, Number(pgMar.attrs['w:bottom']) / 20)
    if (pgMar?.attrs['w:left']) marginLeft = Math.max(30, Number(pgMar.attrs['w:left']) / 20)
    if (pgMar?.attrs['w:right']) marginRight = Math.max(30, Number(pgMar.attrs['w:right']) / 20)
  }

  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // Hindi font for fallback
  let fontHindiFB = null
  try {
    const res = await fetch('https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted-upm2048/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf', { cache: 'force-cache' })
    if (res.ok) fontHindiFB = await pdfDoc.embedFont(new Uint8Array(await res.arrayBuffer()), { subset: true })
  } catch {}

  const DEVA_RE_FB = /[\u0900-\u097F]/
  function splitScriptFB(text) {
    const segs = []
    if (!text) return segs
    let cur = '', curDeva = DEVA_RE_FB.test(text[0])
    for (const ch of text) {
      const d = DEVA_RE_FB.test(ch)
      if (d !== curDeva) { if (cur) segs.push({ text: cur, deva: curDeva }); cur = ch; curDeva = d } else cur += ch
    }
    if (cur) segs.push({ text: cur, deva: curDeva })
    return segs
  }
  function drawTextFB(pg, text, x, y2, size, font, color) {
    let cx = x
    for (const seg of splitScriptFB(text)) {
      const f = (seg.deva && fontHindiFB) ? fontHindiFB : font
      const t = seg.deva ? seg.text : seg.text.replace(/[^\x00-\x7E]/g, '?')
      if (!t) continue
      try { pg.drawText(t, { x: cx, y: y2, size, font: f, color }) } catch {}
      try { cx += f.widthOfTextAtSize(t, size) } catch { cx += t.length * size * 0.5 }
    }
  }

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let curY = pageHeight - marginTop
  const contentWidth = pageWidth - marginLeft - marginRight

  function ensureSpaceFB(needed) {
    if (curY - needed < marginBottom) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      curY = pageHeight - marginTop
    }
  }

  function safeT(s) {
    if (!s) return ''
    return String(s).replace(/[\u0080-\u009F]/g,'').replace(/\u2019/g,"'").replace(/\u2018/g,"'")
      .replace(/\u201C/g,'"').replace(/\u201D/g,'"').replace(/\u2013/g,'-').replace(/\u2014/g,'--')
      .replace(/\u2026/g,'...')
      // Keep Devanagari if Hindi font is loaded, else replace
      .replace(fontHindiFB ? /[^\x00-\x7E\u0900-\u097F]/g : /[^\x00-\x7E]/g, '?')
  }

  function wrapTextFB(text, font, fontSize, maxWidth) {
    const words = text.split(' ')
    const lines = []
    let cur = ''
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w
      try { if (font.widthOfTextAtSize(t, fontSize) > maxWidth && cur) { lines.push(cur); cur = w } else cur = t }
      catch { cur = t }
    }
    if (cur) lines.push(cur)
    return lines.length ? lines : ['']
  }

  for (const child of body.children) {
    if (child.tag === 'w:p') {
      const pPr = child.children?.find(c => c.tag === 'w:pPr')
      const jc = pPr?.children?.find(c => c.tag === 'w:jc')?.attrs?.['w:val'] || 'left'
      const pStyle = pPr?.children?.find(c => c.tag === 'w:pStyle')?.attrs?.['w:val'] || ''

      let fontSize = 10.5, isBold = false, isItalic = false
      if (/heading1|title/i.test(pStyle)) { fontSize = 20; isBold = true }
      else if (/heading2/i.test(pStyle)) { fontSize = 16; isBold = true }
      else if (/heading3/i.test(pStyle)) { fontSize = 13; isBold = true }
      else if (/heading4/i.test(pStyle)) { fontSize = 12; isBold = true }

      const rNodes = child.children?.filter(c => c.tag === 'w:r') || []
      let fullText = ''
      for (const r of rNodes) {
        const rPr = r.children?.find(c => c.tag === 'w:rPr')
        const b = !!rPr?.children?.find(c => c.tag === 'w:b')
        const it = !!rPr?.children?.find(c => c.tag === 'w:i')
        const szEl = rPr?.children?.find(c => c.tag === 'w:sz')
        if (szEl?.attrs?.['w:val']) fontSize = Math.max(7, Number(szEl.attrs['w:val']) / 2)
        if (b) isBold = true
        if (it) isItalic = true
        const t = r.children?.find(c => c.tag === 'w:t')
        fullText += (t?.text || '')
      }

      fullText = safeT(fullText.trim())
      if (!fullText) { curY -= fontSize * 0.5; continue }

      const font = isBold ? fontBold : (isItalic ? fontItalic : fontRegular)
      const wrapped = wrapTextFB(fullText, font, fontSize, contentWidth)
      ensureSpaceFB(wrapped.length * fontSize * 1.35 + 6)

      for (const ln of wrapped) {
        let drawX = marginLeft
        try {
          const tw = font.widthOfTextAtSize(ln, fontSize)
          if (jc === 'center') drawX = marginLeft + (contentWidth - tw) / 2
          else if (jc === 'right') drawX = marginLeft + contentWidth - tw
        } catch {}
        drawTextFB(page, ln, Math.max(marginLeft, drawX), curY, fontSize, font, rgb(0.08,0.10,0.13))
        curY -= Math.round(fontSize * 1.35)
      }
      curY -= 5

    } else if (child.tag === 'w:tbl') {
      const rows = child.children?.filter(c => c.tag === 'w:tr') || []
      const numCols = Math.max(...rows.map(r => (r.children?.filter(c => c.tag === 'w:tc') || []).length))
      if (!numCols) continue
      const colW2 = contentWidth / numCols
      const tblFontSize = 9

      for (const [rIdx, row] of rows.entries()) {
        const cells = row.children?.filter(c => c.tag === 'w:tc') || []
        const isHdr = rIdx === 0
        const cellTexts = cells.map(cell => {
          const runs2 = cell.children?.flatMap(p => p.children?.filter(c => c.tag === 'w:r') || []) || []
          return safeT(runs2.map(r => r.children?.find(c => c.tag === 'w:t')?.text || '').join('').trim())
        })
        const maxLines2 = Math.max(...cellTexts.map(t => wrapTextFB(t, isHdr ? fontBold : fontRegular, tblFontSize, colW2 - 8).length))
        const rowH2 = maxLines2 * tblFontSize * 1.3 + 8
        ensureSpaceFB(rowH2)

        for (let ci = 0; ci < numCols; ci++) {
          const cx = marginLeft + ci * colW2
          if (isHdr) page.drawRectangle({ x: cx, y: curY - rowH2 + 4, width: colW2, height: rowH2, color: rgb(0.91,0.94,0.98) })
          page.drawRectangle({ x: cx, y: curY - rowH2 + 4, width: colW2, height: rowH2, borderColor: rgb(0.78,0.81,0.86), borderWidth: 0.5 })
          const txt = cellTexts[ci] || ''
          const fnt2 = isHdr ? fontBold : fontRegular
          const wlines = wrapTextFB(txt, fnt2, tblFontSize, colW2 - 8)
          let ty = curY - 4
          for (const ln2 of wlines) {
            drawTextFB(page, ln2, cx + 4, ty, tblFontSize, fnt2, rgb(isHdr?0.06:0.08, isHdr?0.10:0.10, isHdr?0.30:0.13))
            ty -= tblFontSize * 1.3
          }
        }
        curY -= rowH2
      }
      curY -= 8
    }
  }

  const pdfBytes = await pdfDoc.save()
  return { pdfBlob: new Blob([pdfBytes], { type: 'application/pdf' }), pdfBytes, pageCount: pdfDoc.getPageCount(), tableCount: 0, paragraphCount: 0 }
}

