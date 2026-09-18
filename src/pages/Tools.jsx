import React, { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Scissors, Merge, FileDown, RotateCcw, ScanLine, Lock,
  Unlock, Droplets, EyeOff, Edit3, FileSearch, Layers,
  ChevronRight, Upload, FileText, X, Loader2, RotateCw, Image as ImageIcon,
  GripVertical, Check, ArrowLeft, Trash2, Hash, Moon, Copy, CheckSquare,
  Search, FileCode, Sliders, FolderArchive, ArrowDownToLine, PenTool,
  Crop, GitCompare, QrCode, BookOpen, Maximize2, LayoutGrid, ShieldAlert,
  ChevronLeft, Eye, Video, Mic, Music, Code, FileJson, Table, Binary,
  KeyRound, Cpu, FileDiff, Type, AlignLeft, ShieldCheck, Key, Sparkles, Palette,
  Volume2, Wind, Barcode, Wifi, Contact, Camera, Pipette, Activity, Globe, Laptop,
  Timer, Scale, Dices, Clock, Monitor, Stamp, Grid, RefreshCw, Circle, Award, Calculator, FileArchive,
  Wrench, FileSpreadsheet, Archive
} from 'lucide-react'
import Navbar from '../components/layout/Navbar.jsx'
import {
  mergePdfs, splitPdf, compressPdf, rotatePdf, rotateAllPages,
  addWatermark, extractPages, reorderPages, downloadBytes, downloadBlob,
  compressPdfToTarget, protectPdf, pdfToImages, imagesToPdf,
  deletePagesFromPdf, addPageNumbers, convertToGrayscale, flattenPdf, extractAllText,
  cropPdf, nUpPdf, resizePdf, readPdfMetadata, updatePdfMetadata,
  invertPdfColors, createBooklet, stampQrCode, extractImagesFromPdf
} from '../lib/pdfExporter.js'
import { loadPdf, renderThumbnail, renderPage } from '../lib/pdfRenderer.js'
import { ocrCanvas } from '../lib/ocrEngine.js'
import { usePdfStore } from '../store/pdfStore.js'
import {
  CompressImageTool, ConvertImageTool, FaviconGeneratorTool,
  PhotoFiltersTool, MemeGeneratorTool, PaletteExtractorTool, SvgRasterizerTool
} from '../components/tools/ImageTools.jsx'
import {
  BackgroundRemoverTool, PassportPhotoTool, ImageRedactorTool,
  ImageWatermarkTool, GridSplitterTool, ExactResizerTool,
  AsciiArtTool, PolaroidMakerTool
} from '../components/tools/ImageProTools.jsx'
import {
  PdfRedactTool, PdfCleanBlankTool, PdfOrganizeTool,
  PdfBatesTool, PdfInkSaverTool, PdfFormBuilderTool,
  ImagesToPdfProTool
} from '../components/tools/PdfProTools.jsx'
import {
  SignatureExtractorTool, CircularAvatarTool, NoCropSquareTool,
  BatchRenamerTool, DuotoneTool, PixelArtTool,
  PdfInterleaveTool, CertificateGeneratorTool, PdfCostCalculatorTool,
  PdfDuplicateTool
} from '../components/tools/SpecialtyTools.jsx'
import {
  ScreenRecorderTool, VideoToAudioTool, AudioTrimmerTool, VoiceRecorderTool
} from '../components/tools/MediaTools.jsx'
import {
  JsonFormatterTool, JsonCsvTool, Base64Tool, JwtDebuggerTool,
  RegexTesterTool, HashGeneratorTool, UuidGeneratorTool, CssShadowTool
} from '../components/tools/DevTools.jsx'
import {
  TextDiffTool, MarkdownLiveTool, CaseConverterTool,
  TextCounterTool, LoremGeneratorTool
} from '../components/tools/TextTools.jsx'
import {
  AesEncryptTool, SteganographyTool, PasswordGeneratorTool, ExifStripperTool
} from '../components/tools/SecurityTools.jsx'
import {
  TextToSpeechTool, SpeechToTextTool, WhiteNoiseTool
} from '../components/tools/VoiceTools.jsx'
import {
  BarcodeGeneratorTool, QrScannerTool, WifiQrTool, VCardQrTool
} from '../components/tools/BarcodeTools.jsx'
import {
  ColorPickerTool, GradientGeneratorTool, AspectCropperTool,
  PhotoCollageTool, WhiteboardTool
} from '../components/tools/DesignTools.jsx'
import {
  ToneGeneratorTool, MetronomeTool, AudioReverserTool
} from '../components/tools/AcousticsTools.jsx'
import {
  UrlParserTool, CodeFormatterTool, DeviceDiagnosticsTool
} from '../components/tools/WebTools.jsx'
import {
  PomodoroTimerTool, EpochConverterTool, UnitConverterTool,
  ScreenCalculatorTool, DecisionMakerTool
} from '../components/tools/ProductivityTools.jsx'
import {
  RepairPdfTool, PdfToMarkdownTool, PdfSummarizerTool,
  PdfTranslateTool, PdfToPdfATool, ScanToPdfTool,
  HtmlToPdfTool, PdfToExcelTool, PdfToWordTool, WordToPdfTool
} from '../components/tools/ILoveTools.jsx'
import styles from './Tools.module.css'

/* ─────────────────── shared helpers ─────────────────── */

function FileDropper({
  onFile,
  file,
  onClear,
  multiple = false,
  label = 'Drop PDF here or click to browse',
  accept = { 'application/pdf': ['.pdf'] }
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxFiles: multiple ? undefined : 1,
    onDrop: multiple
      ? (files) => onFile(files)
      : ([f]) => f && onFile(f),
  })

  if (!multiple && file) {
    return (
      <div className={styles.fileChip}>
        <FileText size={15} />
        <span className={styles.fileName}>{file.name}</span>
        <span className={styles.fileSize}>{(file.size / 1024).toFixed(0)} KB</span>
        <button className={styles.removeBtn} onClick={onClear}><X size={13} /></button>
      </div>
    )
  }

  return (
    <div {...getRootProps()} className={`${styles.dropArea} ${isDragActive ? styles.dropActive : ''}`}>
      <input {...getInputProps()} />
      <Upload size={28} />
      <span>{isDragActive ? 'Drop it!' : label}</span>
    </div>
  )
}

function ToolShell({ title, desc, children, wide = false }) {
  return (
    <div className={`${styles.toolUI} ${wide ? styles.toolUIWide : ''}`}>
      <h2 className={styles.toolUITitle}>{title}</h2>
      <p className={styles.toolUIDesc}>{desc}</p>
      {children}
    </div>
  )
}

function ActionBtn({ onClick, disabled, loading, icon: Icon, children }) {
  return (
    <button className={styles.actionBtn} onClick={onClick} disabled={disabled || loading}>
      {loading ? <Loader2 size={15} className={styles.spin} /> : Icon ? <Icon size={15} /> : null}
      {children}
    </button>
  )
}

const WATERMARK_FONT_OPTIONS = [
  { id: 'Helvetica', label: 'Helvetica / Arial', css: 'Arial, Helvetica, sans-serif' },
  { id: 'Times-Roman', label: 'Times / Georgia', css: 'Georgia, "Times New Roman", serif' },
  { id: 'Courier', label: 'Courier Mono', css: '"Courier New", Courier, monospace' },
]

const WATERMARK_POSITION_PRESETS = [
  ['top-left', 'Top Left'],
  ['top', 'Top'],
  ['top-right', 'Top Right'],
  ['center', 'Center'],
  ['bottom-left', 'Bottom Left'],
  ['bottom', 'Bottom'],
  ['bottom-right', 'Bottom Right'],
]

let previewMeasureCtx = null

function getPreviewMeasureContext() {
  if (!previewMeasureCtx && typeof document !== 'undefined') {
    previewMeasureCtx = document.createElement('canvas').getContext('2d')
  }
  return previewMeasureCtx
}

function measurePreviewText(text, fontSize, fontFamily, bold, italic) {
  const ctx = getPreviewMeasureContext()
  if (!ctx) {
    return {
      width: Math.max((text || '').length * fontSize * 0.58, fontSize * 2),
      height: fontSize * 1.08,
    }
  }

  ctx.font = `${italic ? 'italic ' : ''}${bold ? '700 ' : '400 '}${fontSize}px ${fontFamily}`
  return {
    width: Math.max(ctx.measureText(text || '').width, fontSize * 2),
    height: fontSize * 1.08,
  }
}

function parseWatermarkPages(mode, input, totalPages) {
  const allPages = Array.from({ length: totalPages }, (_, i) => i + 1)
  if (mode === 'all') return allPages
  if (!input.trim()) throw new Error(mode === 'specific' ? 'Enter specific page numbers' : 'Enter page ranges')

  const pages = []
  for (const rawPart of input.split(',')) {
    const part = rawPart.trim()
    if (!part) continue

    if (mode === 'specific') {
      if (!/^\d+$/.test(part)) throw new Error('Specific pages must look like: 1, 3, 7')
      pages.push(Number(part))
      continue
    }

    if (/^\d+$/.test(part)) {
      pages.push(Number(part))
      continue
    }

    const match = part.match(/^(\d+)\s*-\s*(\d+)$/)
    if (!match) throw new Error('Ranges must look like: 1-3, 5, 8-10')
    const start = Number(match[1])
    const end = Number(match[2])
    if (end < start) throw new Error(`Invalid range: ${part}`)
    for (let page = start; page <= end; page += 1) pages.push(page)
  }

  const unique = [...new Set(pages)].sort((a, b) => a - b)
  if (!unique.length) throw new Error('No pages matched your selection')
  if (unique.some((page) => page < 1 || page > totalPages)) {
    throw new Error(`Page selection must stay within 1-${totalPages}`)
  }
  return unique
}

function getPresetPosition(preset, pageWidth, pageHeight, markWidth, markHeight, margin = 18) {
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
      return { x: (pageWidth - markWidth) / 2, y: margin }
    case 'bottom':
      return { x: (pageWidth - markWidth) / 2, y: pageHeight - markHeight - margin }
    case 'center':
    default:
      return { x: (pageWidth - markWidth) / 2, y: (pageHeight - markHeight) / 2 }
  }
}

function buildPreviewPlacements(pageWidth, pageHeight, markWidth, markHeight, options) {
  if (!options.tiled) {
    const base = getPresetPosition(options.positionPreset, pageWidth, pageHeight, markWidth, markHeight)
    return [{ x: base.x + options.offsetX, y: base.y + options.offsetY }]
  }

  const stepX = markWidth + Math.max(markWidth * 0.65, 24)
  const stepY = markHeight + Math.max(markHeight * 0.9, 18)
  const placements = []

  for (let row = 0, y = -markHeight * 0.3 + options.offsetY; y < pageHeight + markHeight; row += 1, y += stepY) {
    const rowShift = row % 2 === 0 ? 0 : stepX / 2
    for (let x = -markWidth * 0.4 + options.offsetX - rowShift; x < pageWidth + markWidth; x += stepX) {
      placements.push({ x, y })
    }
  }

  return placements.slice(0, 80)
}

/* ─────────────────── individual tools ─────────────────── */

function MergeTool() {
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)

  const onDrop = useCallback((dropped) => {
    setFiles(prev => [...prev, ...dropped])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    onDrop,
  })

  const handleMerge = async () => {
    if (files.length < 2) { toast.error('Add at least 2 PDFs'); return }
    setBusy(true)
    const tid = toast.loading(`Merging ${files.length} files...`)
    try {
      const buffers = await Promise.all(files.map(f => f.arrayBuffer()))
      const bytes = await mergePdfs(buffers)
      downloadBytes(bytes, 'merged.pdf')
      toast.success(`Done! Merged ${files.length} PDFs`, { id: tid })
    } catch (e) { toast.error('Merge failed: ' + e.message, { id: tid }) }
    setBusy(false)
  }

  return (
    <ToolShell title="Merge PDFs" desc="Combine multiple PDFs into one file. Add them below — order matters.">
      <div {...getRootProps()} className={`${styles.dropArea} ${isDragActive ? styles.dropActive : ''}`}>
        <input {...getInputProps()} />
        <Upload size={28} /><span>{isDragActive ? 'Drop!' : 'Drop PDFs here or click to add more'}</span>
      </div>
      {files.length > 0 && (
        <div className={styles.fileList}>
          {files.map((f, i) => (
            <div key={i} className={styles.fileChip}>
              <span className={styles.fileIndex}>{i + 1}</span>
              <FileText size={14} />
              <span className={styles.fileName}>{f.name}</span>
              <span className={styles.fileSize}>{(f.size/1024).toFixed(0)} KB</span>
              <button className={styles.removeBtn} onClick={() => setFiles(fs => fs.filter((_,j)=>j!==i))}><X size={12}/></button>
            </div>
          ))}
        </div>
      )}
      <ActionBtn onClick={handleMerge} disabled={files.length < 2} loading={busy} icon={Merge}>
        Merge {files.length} PDFs → merged.pdf
      </ActionBtn>
    </ToolShell>
  )
}

function SplitTool() {
  const [file, setFile] = useState(null)
  const [mode, setMode] = useState('range') // range | every | all
  const [from, setFrom] = useState(1)
  const [to,   setTo]   = useState(1)
  const [every, setEvery] = useState(1)
  const [busy, setBusy] = useState(false)

  const handleSplit = async () => {
    if (!file) return
    setBusy(true)
    const tid = toast.loading('Splitting...')
    try {
      const buf = await file.arrayBuffer()
      const doc = await loadPdf(buf.slice(0))
      const total = doc.numPages
      let ranges = []

      if (mode === 'range')  ranges = [{ from, to: Math.min(to, total) }]
      if (mode === 'every')  { for (let i=1; i<=total; i+=every) ranges.push({ from: i, to: Math.min(i+every-1, total) }) }
      if (mode === 'all')    { for (let i=1; i<=total; i++) ranges.push({ from: i, to: i }) }

      const results = await splitPdf(buf, ranges)
      results.forEach((bytes, i) => downloadBytes(bytes, `split-part-${i+1}.pdf`))
      toast.success(`Split into ${results.length} file(s)`, { id: tid })
    } catch (e) { toast.error('Split failed: ' + e.message, { id: tid }) }
    setBusy(false)
  }

  return (
    <ToolShell title="Split PDF" desc="Split by page range, every N pages, or extract every page separately.">
      <FileDropper file={file} onFile={setFile} onClear={() => setFile(null)} />
      <div className={styles.modeRow}>
        {[['range','By range'],['every','Every N pages'],['all','All pages']].map(([v,l])=>(
          <button key={v} className={`${styles.modeBtn} ${mode===v?styles.modeBtnActive:''}`} onClick={()=>setMode(v)}>{l}</button>
        ))}
      </div>
      {mode === 'range' && (
        <div className={styles.rangeRow}>
          <label>From page <input type="number" min={1} value={from} onChange={e=>setFrom(+e.target.value)} className={styles.numInput}/></label>
          <label>To page   <input type="number" min={1} value={to}   onChange={e=>setTo(+e.target.value)}   className={styles.numInput}/></label>
        </div>
      )}
      {mode === 'every' && (
        <div className={styles.rangeRow}>
          <label>Split every <input type="number" min={1} value={every} onChange={e=>setEvery(+e.target.value)} className={styles.numInput}/> pages</label>
        </div>
      )}
      <ActionBtn onClick={handleSplit} disabled={!file} loading={busy} icon={Scissors}>Split PDF</ActionBtn>
    </ToolShell>
  )
}

function CompressTool() {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [targetKb, setTargetKb] = useState('')
  const [preset, setPreset] = useState('balanced')
  const [progress, setProgress] = useState(null)

  const handleCompress = async () => {
    if (!file) return
    const targetBytes = targetKb ? Math.max(1, Number(targetKb)) * 1024 : null
    if (targetKb && (!Number.isFinite(targetBytes) || targetBytes <= 0)) {
      toast.error('Enter a valid target size in KB')
      return
    }
    if (targetBytes && targetBytes >= file.size) {
      toast.error('Target size must be smaller than the original file')
      return
    }

    setBusy(true)
    setProgress(null)
    const tid = toast.loading(targetBytes ? 'Optimizing toward target size...' : 'Compressing...')
    try {
      const buf   = await file.arrayBuffer()
      const output = targetBytes
        ? await compressPdfToTarget(buf, {
            targetBytes,
            preset,
            onProgress: (p) => {
              setProgress(p)
              toast.loading(`Attempt ${p.attempt}/${p.attempts} - page ${p.page}/${p.pages}`, { id: tid })
            },
          })
        : { bytes: await compressPdf(buf), mode: 'lossless', reachedTarget: true }
      const bytes = output.bytes
      const saved = ((file.size - bytes.byteLength) / file.size * 100).toFixed(1)
      const name  = `compressed-${file.name}`
      downloadBytes(bytes, name)
      setResult({ original: file.size, compressed: bytes.byteLength, saved, ...output, targetBytes })
      toast.success(output.reachedTarget ? `Compressed to ${(bytes.byteLength/1024).toFixed(0)} KB` : `Best possible: ${(bytes.byteLength/1024).toFixed(0)} KB`, { id: tid })
    } catch (e) { toast.error('Compress failed: ' + e.message, { id: tid }) }
    setProgress(null)
    setBusy(false)
  }

  return (
    <ToolShell title="Compress PDF" desc="Choose a target size and PDFZero will optimize visually toward it in-browser.">
      <FileDropper file={file} onFile={setFile} onClear={() => { setFile(null); setResult(null); setProgress(null) }} />
      <div className={styles.formGrid}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Target size in KB</label>
          <input
            className={styles.formInput}
            type="number"
            min={1}
            value={targetKb}
            onChange={e=>setTargetKb(e.target.value)}
            placeholder={file ? `e.g. ${Math.max(50, Math.round(file.size / 1024 * 0.35))}` : 'e.g. 100'}
          />
        </div>
        <div className={styles.modeRow}>
          {[
            ['balanced', 'Balanced'],
            ['high', 'Better quality'],
            ['small', 'Smallest size'],
          ].map(([id, label]) => (
            <button key={id} className={`${styles.modeBtn} ${preset===id?styles.modeBtnActive:''}`} onClick={()=>setPreset(id)}>{label}</button>
          ))}
        </div>
      </div>
      {progress && (
        <div className={styles.progressBox}>
          <div className={styles.progressText}>Attempt {progress.attempt}/{progress.attempts} - page {progress.page}/{progress.pages}</div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${((progress.page / progress.pages) * 100).toFixed(0)}%` }} />
          </div>
        </div>
      )}
      {result && (
        <div className={styles.resultBox}>
          <div className={styles.resultRow}><span>Original</span><strong>{(result.original/1024).toFixed(0)} KB</strong></div>
          <div className={styles.resultRow}><span>Compressed</span><strong>{(result.compressed/1024).toFixed(0)} KB</strong></div>
          {result.targetBytes && <div className={styles.resultRow}><span>Target</span><strong>{(result.targetBytes/1024).toFixed(0)} KB</strong></div>}
          <div className={styles.resultRow}><span>Mode</span><strong>{result.mode === 'visual' ? 'Visual' : 'Lossless'}</strong></div>
          <div className={`${styles.resultRow} ${styles.resultSaved}`}><span>Space saved</span><strong>{result.saved}%</strong></div>
          {!result.reachedTarget && <div className={styles.infoBox}>The target was too aggressive for this PDF. The downloaded file is the smallest acceptable result PDFZero could create.</div>}
        </div>
      )}
      <div className={styles.infoBox}>Target-size compression can convert pages into images to reach much smaller files. Text selection may be lost in visual mode.</div>
      <ActionBtn onClick={handleCompress} disabled={!file} loading={busy} icon={FileDown}>{targetKb ? `Compress below ${targetKb} KB` : 'Lossless Compress PDF'}</ActionBtn>
    </ToolShell>
  )
}

function RotateTool() {
  const [file, setFile]   = useState(null)
  const [mode, setMode]   = useState('all') // all | single
  const [page, setPage]   = useState(1)
  const [angle, setAngle] = useState(90)
  const [busy, setBusy]   = useState(false)

  const handleRotate = async () => {
    if (!file) return
    setBusy(true)
    const tid = toast.loading('Rotating...')
    try {
      const buf   = await file.arrayBuffer()
      const bytes = mode === 'all'
        ? await rotateAllPages(buf, angle)
        : await rotatePdf(buf, page, angle)
      downloadBytes(bytes, `rotated-${file.name}`)
      toast.success('Rotated PDF downloaded', { id: tid })
    } catch (e) { toast.error('Rotate failed: ' + e.message, { id: tid }) }
    setBusy(false)
  }

  return (
    <ToolShell title="Rotate PDF" desc="Rotate all pages or a specific page by 90°, 180°, or 270°.">
      <FileDropper file={file} onFile={setFile} onClear={() => setFile(null)} />
      <div className={styles.modeRow}>
        {[['all','All pages'],['single','Single page']].map(([v,l])=>(
          <button key={v} className={`${styles.modeBtn} ${mode===v?styles.modeBtnActive:''}`} onClick={()=>setMode(v)}>{l}</button>
        ))}
      </div>
      {mode === 'single' && (
        <div className={styles.rangeRow}>
          <label>Page number <input type="number" min={1} value={page} onChange={e=>setPage(+e.target.value)} className={styles.numInput}/></label>
        </div>
      )}
      <div className={styles.angleRow}>
        {[90,180,270].map(a => (
          <button key={a} className={`${styles.angleBtn} ${angle===a?styles.angleBtnActive:''}`} onClick={()=>setAngle(a)}>
            <RotateCw size={14}/> {a}°
          </button>
        ))}
      </div>
      <ActionBtn onClick={handleRotate} disabled={!file} loading={busy} icon={RotateCcw}>Rotate {angle}°</ActionBtn>
    </ToolShell>
  )
}

function WatermarkTool() {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewSrc, setPreviewSrc] = useState('')
  const [previewDims, setPreviewDims] = useState({ width: 360, height: 480 })
  const [pageSize, setPageSize] = useState({ width: 595, height: 842 })
  const [pageCount, setPageCount] = useState(0)

  const [watermarkType, setWatermarkType] = useState('text')
  const [text, setText] = useState('CONFIDENTIAL')
  const [fontFamily, setFontFamily] = useState('Helvetica')
  const [bold, setBold] = useState(true)
  const [italic, setItalic] = useState(false)
  const [color, setColor] = useState('#737373')
  const [size, setSize] = useState(52)
  const [opacity, setOpacity] = useState(15)
  const [rotation, setRotation] = useState(315)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [positionPreset, setPositionPreset] = useState('center')
  const [tiled, setTiled] = useState(false)
  const [pageMode, setPageMode] = useState('all')
  const [pageInput, setPageInput] = useState('')

  const [imageFile, setImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [imageDims, setImageDims] = useState({ width: 1, height: 1 })
  const [imageScale, setImageScale] = useState(28)

  useEffect(() => {
    if (!file) {
      setPreviewSrc('')
      setPageCount(0)
      return
    }

    let cancelled = false
    setPreviewLoading(true)

    ;(async () => {
      try {
        const buf = await file.arrayBuffer()
        const doc = await loadPdf(buf.slice(0))
        if (cancelled) return
        setPageCount(doc.numPages)
        const firstPage = await doc.getPage(1)
        const viewport = firstPage.getViewport({ scale: 1 })
        if (cancelled) return
        setPageSize({ width: viewport.width, height: viewport.height })
        const preview = await renderPage(1, 0.65)
        if (cancelled) return
        setPreviewSrc(preview.canvas.toDataURL('image/jpeg', 0.88))
        setPreviewDims({ width: preview.width, height: preview.height })
      } catch (e) {
        if (!cancelled) {
          setPreviewSrc('')
          toast.error('Preview failed: ' + e.message)
        }
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [file])

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl('')
      setImageDims({ width: 1, height: 1 })
      return
    }

    const url = URL.createObjectURL(imageFile)
    setImagePreviewUrl(url)
    const img = new window.Image()
    img.onload = () => setImageDims({ width: img.width || 1, height: img.height || 1 })
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const previewScaleX = previewDims.width / pageSize.width
  const previewScaleY = previewDims.height / pageSize.height
  const previewFont = WATERMARK_FONT_OPTIONS.find((font) => font.id === fontFamily)?.css || WATERMARK_FONT_OPTIONS[0].css
  const previewFontSize = Math.max(size * previewScaleY, 12)
  const textMetrics = measurePreviewText(text || 'CONFIDENTIAL', previewFontSize, previewFont, bold, italic)
  const previewImageWidth = previewDims.width * (imageScale / 100)
  const previewImageHeight = previewImageWidth * (imageDims.height / imageDims.width)
  const previewMarkWidth = watermarkType === 'text' ? textMetrics.width : previewImageWidth
  const previewMarkHeight = watermarkType === 'text' ? textMetrics.height : previewImageHeight
  const previewItems = buildPreviewPlacements(previewDims.width, previewDims.height, previewMarkWidth, previewMarkHeight, {
    positionPreset,
    offsetX: offsetX * previewScaleX,
    offsetY: offsetY * previewScaleY,
    tiled,
  })

  const canApply = !!file && (
    (watermarkType === 'text' && text.trim()) ||
    (watermarkType === 'image' && imageFile)
  )

  const handleWatermark = async () => {
    if (!file) return

    let targetPages
    try {
      targetPages = parseWatermarkPages(pageMode, pageInput, pageCount)
    } catch (e) {
      toast.error(e.message)
      return
    }

    if (watermarkType === 'text' && !text.trim()) {
      toast.error('Enter watermark text')
      return
    }
    if (watermarkType === 'image' && !imageFile) {
      toast.error('Choose a PNG or JPG watermark image')
      return
    }

    setBusy(true)
    const tid = toast.loading('Applying watermark...')
    try {
      const buf = await file.arrayBuffer()
      const options = {
        type: watermarkType,
        text: text.trim(),
        fontFamily,
        bold,
        italic,
        color,
        fontSize: size,
        opacity: opacity / 100,
        rotation,
        offsetX,
        offsetY,
        positionPreset,
        tiled,
        targetPages,
        imageScale,
      }

      if (watermarkType === 'image' && imageFile) {
        options.imageBytes = await imageFile.arrayBuffer()
        options.imageType = imageFile.type
      }

      const bytes = await addWatermark(buf, options)
      downloadBytes(bytes, `watermarked-${file.name}`)
      toast.success(`Watermark applied to ${targetPages.length} page${targetPages.length === 1 ? '' : 's'}`, { id: tid })
    } catch (e) {
      toast.error('Failed: ' + e.message, { id: tid })
    }
    setBusy(false)
  }

  return (
    <ToolShell title="Add Watermark" desc="Text or image watermarks with live preview, placement control, page targeting, and tiled mode." wide>
      <FileDropper file={file} onFile={setFile} onClear={() => setFile(null)} />

      <div className={styles.watermarkLayout}>
        <div className={styles.watermarkPanel}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionCardTitle}>Watermark Type</div>
            <div className={styles.modeRow}>
              <button className={`${styles.modeBtn} ${watermarkType === 'text' ? styles.modeBtnActive : ''}`} onClick={() => setWatermarkType('text')}>
                Text
              </button>
              <button className={`${styles.modeBtn} ${watermarkType === 'image' ? styles.modeBtnActive : ''}`} onClick={() => setWatermarkType('image')}>
                <ImageIcon size={13} /> Image
              </button>
            </div>

            {watermarkType === 'text' ? (
              <div className={styles.watermarkFieldGrid}>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Watermark text</label>
                  <input className={styles.formInput} value={text} onChange={e => setText(e.target.value)} placeholder="e.g. CONFIDENTIAL" />
                </div>
                <div className={styles.dualGrid}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Font family</label>
                    <select className={styles.formInput} value={fontFamily} onChange={e => setFontFamily(e.target.value)}>
                      {WATERMARK_FONT_OPTIONS.map((font) => (
                        <option key={font.id} value={font.id}>{font.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Text color</label>
                    <div className={styles.colorInputRow}>
                      <input className={styles.colorInput} type="color" value={color} onChange={e => setColor(e.target.value)} />
                      <input className={styles.formInput} value={color} onChange={e => setColor(e.target.value)} />
                    </div>
                  </div>
                </div>
                <div className={styles.toggleRow}>
                  <button className={`${styles.toggleBtn} ${bold ? styles.toggleBtnActive : ''}`} onClick={() => setBold(v => !v)}>Bold</button>
                  <button className={`${styles.toggleBtn} ${italic ? styles.toggleBtnActive : ''}`} onClick={() => setItalic(v => !v)}>Italic</button>
                </div>
              </div>
            ) : (
              <div className={styles.watermarkFieldGrid}>
                {imageFile ? (
                  <div className={styles.fileChip}>
                    <ImageIcon size={15} />
                    <span className={styles.fileName}>{imageFile.name}</span>
                    <span className={styles.fileSize}>{(imageFile.size / 1024).toFixed(0)} KB</span>
                    <button className={styles.removeBtn} onClick={() => setImageFile(null)}><X size={13} /></button>
                  </div>
                ) : (
                  <label className={styles.imageDropArea}>
                    <input type="file" accept="image/png,image/jpeg" hidden onChange={e => setImageFile(e.target.files?.[0] || null)} />
                    <ImageIcon size={18} />
                    <span>Choose PNG or JPG watermark image</span>
                  </label>
                )}
              </div>
            )}
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionCardTitle}>Appearance</div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>
                {watermarkType === 'text' ? `Font size: ${size}pt` : `Image size: ${imageScale}% of page width`}
              </label>
              <input
                type="range"
                min={watermarkType === 'text' ? 18 : 10}
                max={watermarkType === 'text' ? 140 : 60}
                value={watermarkType === 'text' ? size : imageScale}
                onChange={e => watermarkType === 'text' ? setSize(+e.target.value) : setImageScale(+e.target.value)}
                className={styles.slider}
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Opacity: {opacity}%</label>
              <input type="range" min={5} max={80} value={opacity} onChange={e => setOpacity(+e.target.value)} className={styles.slider} />
            </div>
            <div className={styles.dualGrid}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Rotation</label>
                <div className={styles.inlineControlRow}>
                  <input type="range" min={0} max={360} value={rotation} onChange={e => setRotation(+e.target.value)} className={styles.slider} />
                  <input className={styles.miniInput} type="number" min={0} max={360} value={rotation} onChange={e => setRotation(Math.max(0, Math.min(360, +e.target.value || 0)))} />
                </div>
              </div>
              <label className={styles.checkPill}>
                <input type="checkbox" checked={tiled} onChange={e => setTiled(e.target.checked)} />
                Repeated / tiled
              </label>
            </div>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionCardTitle}>Placement</div>
            <div className={styles.presetGrid}>
              {WATERMARK_POSITION_PRESETS.map(([id, label]) => (
                <button key={id} className={`${styles.presetBtn} ${positionPreset === id ? styles.presetBtnActive : ''}`} onClick={() => setPositionPreset(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div className={styles.dualGrid}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>X offset</label>
                <input className={styles.formInput} type="number" value={offsetX} onChange={e => setOffsetX(+e.target.value || 0)} />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Y offset</label>
                <input className={styles.formInput} type="number" value={offsetY} onChange={e => setOffsetY(+e.target.value || 0)} />
              </div>
            </div>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionCardTitle}>Pages</div>
            <div className={styles.modeRow}>
              <button className={`${styles.modeBtn} ${pageMode === 'all' ? styles.modeBtnActive : ''}`} onClick={() => setPageMode('all')}>All pages</button>
              <button className={`${styles.modeBtn} ${pageMode === 'specific' ? styles.modeBtnActive : ''}`} onClick={() => setPageMode('specific')}>Specific pages</button>
              <button className={`${styles.modeBtn} ${pageMode === 'ranges' ? styles.modeBtnActive : ''}`} onClick={() => setPageMode('ranges')}>Page ranges</button>
            </div>
            {pageMode !== 'all' && (
              <div className={styles.formField}>
                <label className={styles.formLabel}>
                  {pageMode === 'specific' ? 'Pages like 1, 3, 7' : 'Ranges like 1-3, 6, 9-12'}
                </label>
                <input className={styles.formInput} value={pageInput} onChange={e => setPageInput(e.target.value)} placeholder={pageMode === 'specific' ? '1, 3, 7' : '1-3, 6, 9-12'} />
              </div>
            )}
            <div className={styles.infoBox}>Loaded PDF: {pageCount || 0} page{pageCount === 1 ? '' : 's'}.</div>
          </div>
        </div>

        <div className={`${styles.watermarkPanel} ${styles.previewPanel}`}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionCardTitle}>Live Preview</div>
            <div className={styles.previewMeta}>Preview uses page 1 of your PDF and updates as you change settings.</div>
            {previewLoading ? (
              <div className={styles.previewEmpty}><Loader2 size={18} className={styles.spin} /> Rendering preview...</div>
            ) : previewSrc ? (
              <div className={styles.previewFrame} style={{ aspectRatio: `${previewDims.width} / ${previewDims.height}` }}>
                <img src={previewSrc} alt="Watermark preview" className={styles.previewImage} />
                <div className={styles.previewOverlay}>
                  {previewItems.map((item, index) => (
                    watermarkType === 'text' ? (
                      <div
                        key={`${item.x}-${item.y}-${index}`}
                        className={styles.previewTextMark}
                        style={{
                          left: item.x,
                          top: item.y,
                          fontSize: previewFontSize,
                          fontFamily: previewFont,
                          fontWeight: bold ? 700 : 400,
                          fontStyle: italic ? 'italic' : 'normal',
                          color,
                          opacity: opacity / 100,
                          transform: `rotate(${rotation}deg)`,
                        }}
                      >
                        {text || 'CONFIDENTIAL'}
                      </div>
                    ) : imagePreviewUrl ? (
                      <img
                        key={`${item.x}-${item.y}-${index}`}
                        src={imagePreviewUrl}
                        alt=""
                        className={styles.previewImageMark}
                        style={{
                          left: item.x,
                          top: item.y,
                          width: previewImageWidth,
                          height: previewImageHeight,
                          opacity: opacity / 100,
                          transform: `rotate(${rotation}deg)`,
                        }}
                      />
                    ) : null
                  ))}
                </div>
              </div>
            ) : (
              <div className={styles.previewEmpty}>Add a PDF to generate the preview.</div>
            )}
          </div>
          <ActionBtn onClick={handleWatermark} disabled={!canApply} loading={busy} icon={Droplets}>
            Apply Watermark
          </ActionBtn>
        </div>
      </div>
    </ToolShell>
  )
}

function ExtractTool() {
  const [file, setFile]   = useState(null)
  const [pages, setPages] = useState('')
  const [busy, setBusy]   = useState(false)

  const handleExtract = async () => {
    if (!file || !pages.trim()) return
    setBusy(true)
    const tid = toast.loading('Extracting...')
    try {
      const buf = await file.arrayBuffer()
      // Parse "1,3,5-8" style input
      const nums = []
      for (const part of pages.split(',')) {
        const t = part.trim()
        if (t.includes('-')) {
          const [a,b] = t.split('-').map(Number)
          for (let i=a; i<=b; i++) nums.push(i)
        } else {
          const n = Number(t)
          if (!isNaN(n)) nums.push(n)
        }
      }
      const unique = [...new Set(nums)].sort((a,b)=>a-b)
      const bytes  = await extractPages(buf, unique)
      downloadBytes(bytes, `extracted-pages-${file.name}`)
      toast.success(`Extracted ${unique.length} pages`, { id: tid })
    } catch (e) { toast.error('Extract failed: ' + e.message, { id: tid }) }
    setBusy(false)
  }

  return (
    <ToolShell title="Extract Pages" desc="Pull specific pages out of a PDF into a new file.">
      <FileDropper file={file} onFile={setFile} onClear={() => setFile(null)} />
      <div className={styles.formField}>
        <label className={styles.formLabel}>Pages to extract (e.g. 1, 3, 5-8)</label>
        <input className={styles.formInput} value={pages} onChange={e=>setPages(e.target.value)} placeholder="1, 3, 5-8, 12" />
      </div>
      <ActionBtn onClick={handleExtract} disabled={!file || !pages.trim()} loading={busy} icon={FileSearch}>Extract Pages</ActionBtn>
    </ToolShell>
  )
}

function ReorderTool() {
  const [file, setFile]     = useState(null)
  const [thumbs, setThumbs] = useState([])
  const [order, setOrder]   = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy]     = useState(false)
  const dragIdx = React.useRef(null)

  const onFile = async (f) => {
    setFile(f)
    setLoading(true)
    try {
      const buf = await f.arrayBuffer()
      const doc = await loadPdf(buf.slice(0))
      const total = doc.numPages
      const pages = Array.from({length: total}, (_,i) => i+1)
      setOrder(pages)
      const ts = []
      for (let i=1; i<=Math.min(total,20); i++) {
        const dataUrl = await renderThumbnail(i)
        ts.push({ page: i, dataUrl })
      }
      setThumbs(ts)
    } catch (e) { toast.error('Failed to load: ' + e.message) }
    setLoading(false)
  }

  const handleDragStart = (i) => { dragIdx.current = i }
  const handleDragOver  = (e) => e.preventDefault()
  const handleDrop      = (i) => {
    if (dragIdx.current === null || dragIdx.current === i) return
    const newOrder = [...order]
    const [moved]  = newOrder.splice(dragIdx.current, 1)
    newOrder.splice(i, 0, moved)
    setOrder(newOrder)
    const newThumbs = [...thumbs]
    const [mt] = newThumbs.splice(dragIdx.current, 1)
    newThumbs.splice(i, 0, mt)
    setThumbs(newThumbs)
    dragIdx.current = null
  }

  const handleSave = async () => {
    if (!file) return
    setBusy(true)
    const tid = toast.loading('Reordering pages...')
    try {
      const buf   = await file.arrayBuffer()
      const bytes = await reorderPages(buf, order)
      downloadBytes(bytes, `reordered-${file.name}`)
      toast.success('Done!', { id: tid })
    } catch (e) { toast.error('Failed: ' + e.message, { id: tid }) }
    setBusy(false)
  }

  return (
    <ToolShell title="Reorder Pages" desc="Drag and drop pages into the order you want, then download.">
      {!file
        ? <FileDropper file={null} onFile={onFile} onClear={() => {}} />
        : (
          <>
            <div className={styles.fileChip}>
              <FileText size={14}/>
              <span className={styles.fileName}>{file.name}</span>
              <button className={styles.removeBtn} onClick={() => { setFile(null); setThumbs([]); setOrder([]) }}><X size={12}/></button>
            </div>
            {loading
              ? <div className={styles.loadingRow}><Loader2 size={18} className={styles.spin}/> Loading pages...</div>
              : (
                <div className={styles.reorderGrid}>
                  {thumbs.map((t, i) => (
                    <div
                      key={t.page}
                      className={styles.reorderCard}
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(i)}
                    >
                      <div className={styles.reorderHandle}><GripVertical size={12}/></div>
                      <img src={t.dataUrl} alt={`Page ${t.page}`} className={styles.reorderThumb} />
                      <span className={styles.reorderNum}>{i+1}</span>
                    </div>
                  ))}
                </div>
              )
            }
            <ActionBtn onClick={handleSave} disabled={!file || loading} loading={busy} icon={Check}>Save Reordered PDF</ActionBtn>
          </>
        )
      }
    </ToolShell>
  )
}

function OcrTool() {
  const [file, setFile]     = useState(null)
  const [busy, setBusy]     = useState(false)
  const [progress, setProgress] = useState(0)
  const navigate = useNavigate()

  const handleOcr = async () => {
    if (!file) return
    setBusy(true)
    setProgress(0)
    const tid = toast.loading('Initialising OCR engine...')
    try {
      const { renderPage } = await import('../lib/pdfRenderer.js')
      const { ocrCanvas }  = await import('../lib/ocrEngine.js')
      const buf = await file.arrayBuffer()
      const doc = await loadPdf(buf.slice(0))
      const total = doc.numPages
      const allText = []

      for (let p = 1; p <= total; p++) {
        toast.loading(`OCR page ${p}/${total}...`, { id: tid })
        const { canvas } = await renderPage(p, 1)
        const words = await ocrCanvas(canvas, pct => setProgress(Math.round((p-1)/total*100 + pct/total)))
        if (words.length) allText.push(`--- Page ${p} ---\n` + words.map(w=>w.str).join(' '))
      }

      // Download as searchable text file
      const blob = new Blob([allText.join('\n\n')], { type: 'text/plain' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = file.name.replace('.pdf','') + '-ocr.txt'; a.click()
      URL.revokeObjectURL(url)
      toast.success(`OCR complete — ${total} pages`, { id: tid })
    } catch (e) { toast.error('OCR failed: ' + e.message, { id: tid }) }
    setBusy(false)
    setProgress(0)
  }

  return (
    <ToolShell title="OCR Scanner" desc="Extract text from scanned or image-based PDFs using Tesseract.js — runs 100% offline.">
      <FileDropper file={file} onFile={setFile} onClear={() => setFile(null)} />
      {busy && (
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          <span>{progress}%</span>
        </div>
      )}
      <ActionBtn onClick={handleOcr} disabled={!file} loading={busy} icon={ScanLine}>
        {busy ? `Scanning... ${progress}%` : 'Run OCR & Download Text'}
      </ActionBtn>
    </ToolShell>
  )
}

function ProtectTool() {
  const [file, setFile] = useState(null)
  const [pw, setPw]     = useState('')
  const [ownerPw, setOwnerPw] = useState('')
  const [algorithm, setAlgorithm] = useState('AES-256')
  const [allowPrinting, setAllowPrinting] = useState(true)
  const [allowCopying, setAllowCopying] = useState(false)
  const [allowModifying, setAllowModifying] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleProtect = async () => {
    if (!file || !pw) return
    setBusy(true)
    const tid = toast.loading('Encrypting...')
    try {
      const buf = await file.arrayBuffer()
      const bytes = await protectPdf(buf, pw, {
        ownerPassword: ownerPw || pw,
        algorithm,
        allowPrinting,
        allowCopying,
        allowModifying,
      })
      downloadBytes(bytes, `protected-${file.name}`)
      toast.success('Password-protected PDF downloaded', { id: tid })
    } catch (e) { toast.error('Failed: ' + e.message, { id: tid }) }
    setBusy(false)
  }

  return (
    <ToolShell title="Protect PDF" desc="Add a real open-password lock with AES-256 encryption directly in your browser.">
      <FileDropper file={file} onFile={setFile} onClear={() => setFile(null)} />
      <div className={styles.formGrid}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Open password</label>
          <input className={styles.formInput} type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Required to open PDF" />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Owner password</label>
          <input className={styles.formInput} type="password" value={ownerPw} onChange={e=>setOwnerPw(e.target.value)} placeholder="Optional admin password" />
        </div>
        <div className={styles.modeRow}>
          {['AES-256', 'RC4'].map(id => (
            <button key={id} className={`${styles.modeBtn} ${algorithm===id?styles.modeBtnActive:''}`} onClick={()=>setAlgorithm(id)}>{id}</button>
          ))}
        </div>
        <div className={styles.checkGrid}>
          <label><input type="checkbox" checked={allowPrinting} onChange={e=>setAllowPrinting(e.target.checked)} /> Allow printing</label>
          <label><input type="checkbox" checked={allowCopying} onChange={e=>setAllowCopying(e.target.checked)} /> Allow copying</label>
          <label><input type="checkbox" checked={allowModifying} onChange={e=>setAllowModifying(e.target.checked)} /> Allow editing</label>
        </div>
      </div>
      <div className={styles.infoBox}>
        Modern readers support AES-256. Use RC4 only if you need compatibility with older PDF readers.
      </div>
      <ActionBtn onClick={handleProtect} disabled={!file || !pw} loading={busy} icon={Lock}>Protect PDF</ActionBtn>
    </ToolShell>
  )
}
function UnlockTool() {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)

  const handleUnlock = async () => {
    if (!file) return
    setBusy(true)
    const tid = toast.loading('Removing restrictions...')
    try {
      const { PDFDocument } = await import('pdf-lib')
      const buf   = await file.arrayBuffer()
      const doc   = await PDFDocument.load(buf, { ignoreEncryption: true })
      const bytes = await doc.save()
      downloadBytes(bytes, `unlocked-${file.name}`)
      toast.success('PDF saved without restrictions', { id: tid })
    } catch (e) { toast.error('Failed: ' + e.message, { id: tid }) }
    setBusy(false)
  }

  return (
    <ToolShell title="Unlock PDF" desc="Remove copy/print restrictions from a PDF you own.">
      <FileDropper file={file} onFile={setFile} onClear={() => setFile(null)} />
      <div className={styles.infoBox}>
        ℹ️ This removes PDF user restrictions (copy, print). It does not bypass strong AES-256 owner passwords.
      </div>
      <ActionBtn onClick={handleUnlock} disabled={!file} loading={busy} icon={Unlock}>Remove Restrictions</ActionBtn>
    </ToolShell>
  )
}

function RedactTool() {
  const navigate = useNavigate()
  return (
    <ToolShell title="Redact PDF" desc="Permanently black out sensitive content in the PDF editor.">
      <div className={styles.infoBox} style={{ borderColor: 'rgba(232,69,69,0.3)', background: 'rgba(232,69,69,0.05)' }}>
        🎯 Redaction works in the <strong>PDF Editor</strong>. Open your PDF, select the <strong>Redact tool</strong> in the toolbar, then drag over any content to permanently black it out.
      </div>
      <ActionBtn onClick={() => navigate('/editor')} icon={Edit3}>Open PDF Editor</ActionBtn>
    </ToolShell>
  )
}

function EditTool() {
  const navigate = useNavigate()
  return (
    <ToolShell title="Edit PDF" desc="Full in-browser PDF editor — edit text, add annotations, sign, and more.">
      <ActionBtn onClick={() => navigate('/editor')} icon={Edit3}>Open PDF Editor →</ActionBtn>
    </ToolShell>
  )
}

/* ── New Suite Tools ── */

function PdfToImagesTool() {
  const [file, setFile] = useState(null)
  const [format, setFormat] = useState('image/jpeg')
  const [scale, setScale] = useState(2)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)

  const handleConvert = async () => {
    if (!file) return
    setBusy(true)
    setProgress(0)
    const tid = toast.loading('Converting pages to images...')
    try {
      const data = await pdfToImages(file, { format, scale }, (p) => setProgress(p))
      setResult(data)
      toast.success(`Converted ${data.totalPages} page(s) successfully!`, { id: tid })
    } catch (e) {
      toast.error('Conversion failed: ' + e.message, { id: tid })
    }
    setBusy(false)
  }

  const downloadSingle = (img) => {
    downloadBlob(img.blob, img.name)
  }

  const downloadAllZip = () => {
    if (!result?.zipBlob) return
    downloadBlob(result.zipBlob, `${file?.name?.replace(/\.pdf$/i, '') || 'converted'}-images.zip`)
  }

  return (
    <ToolShell
      title="PDF to JPG / PNG"
      desc="Extract all pages from your PDF as high-resolution images. Download each page or grab the complete ZIP archive."
      wide={Boolean(result)}
    >
      <FileDropper file={file} onFile={(f) => { setFile(f); setResult(null) }} onClear={() => { setFile(null); setResult(null) }} />
      <div className={styles.optRow}>
        <div className={styles.optGroup}>
          <label className={styles.optLabel}>Image Format</label>
          <div className={styles.modeRow}>
            <button className={`${styles.modeBtn} ${format === 'image/jpeg' ? styles.modeBtnActive : ''}`} onClick={() => setFormat('image/jpeg')}>JPG (Smaller)</button>
            <button className={`${styles.modeBtn} ${format === 'image/png' ? styles.modeBtnActive : ''}`} onClick={() => setFormat('image/png')}>PNG (Lossless)</button>
          </div>
        </div>
        <div className={styles.optGroup}>
          <label className={styles.optLabel}>Resolution Quality</label>
          <div className={styles.modeRow}>
            <button className={`${styles.modeBtn} ${scale === 1.5 ? styles.modeBtnActive : ''}`} onClick={() => setScale(1.5)}>150 DPI (Standard)</button>
            <button className={`${styles.modeBtn} ${scale === 2 ? styles.modeBtnActive : ''}`} onClick={() => setScale(2)}>300 DPI (High Res)</button>
          </div>
        </div>
      </div>
      <ActionBtn onClick={handleConvert} disabled={!file} loading={busy} icon={ImageIcon}>
        {busy ? `Converting (${progress}%)...` : 'Convert to Images'}
      </ActionBtn>

      {result && (
        <div style={{ marginTop: 20 }}>
          <div className={styles.zipBar}>
            <span className={styles.zipInfo}>✓ {result.totalPages} page(s) ready</span>
            <button className={styles.zipBtn} onClick={downloadAllZip}>
              <FolderArchive size={16} /> Download All (ZIP)
            </button>
          </div>
          <div className={styles.imgGrid}>
            {result.images.map((img) => (
              <div key={img.pageNumber} className={styles.imgCard}>
                <img src={img.dataUrl} alt={`Page ${img.pageNumber}`} />
                <div className={styles.imgCardBottom}>
                  <span className={styles.imgCardLabel}>Page {img.pageNumber}</span>
                  <button className={styles.dlSingleBtn} onClick={() => downloadSingle(img)}>
                    <ArrowDownToLine size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ToolShell>
  )
}

function ImagesToPdfTool() {
  const [files, setFiles] = useState([])
  const [orientation, setOrientation] = useState('auto')
  const [pageSize, setPageSize] = useState('a4')
  const [margin, setMargin] = useState(18)
  const [busy, setBusy] = useState(false)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] },
    onDrop: (dropped) => setFiles(prev => [...prev, ...dropped]),
  })

  const handleConvert = async () => {
    if (files.length === 0) return
    setBusy(true)
    const tid = toast.loading(`Combining ${files.length} images into PDF...`)
    try {
      const imageItems = await Promise.all(
        files.map(async f => ({
          name: f.name,
          type: f.type,
          buffer: await f.arrayBuffer(),
        }))
      )
      const bytes = await imagesToPdf(imageItems, { orientation, pageSize, margin })
      downloadBytes(bytes, 'images-combined.pdf')
      toast.success(`Generated PDF with ${files.length} page(s)`, { id: tid })
    } catch (e) {
      toast.error('Failed to convert: ' + e.message, { id: tid })
    }
    setBusy(false)
  }

  return (
    <ToolShell title="Images to PDF" desc="Convert JPG, PNG, and WebP images into a single professional PDF document.">
      <div {...getRootProps()} className={`${styles.dropArea} ${isDragActive ? styles.dropActive : ''}`}>
        <input {...getInputProps()} />
        <Upload size={28} />
        <span>{isDragActive ? 'Drop images here!' : 'Drop JPG, PNG, or WebP images here (or click to browse)'}</span>
      </div>

      {files.length > 0 && (
        <div className={styles.fileList}>
          {files.map((f, i) => (
            <div key={i} className={styles.fileChip}>
              <span className={styles.fileIndex}>{i + 1}</span>
              <ImageIcon size={14} />
              <span className={styles.fileName}>{f.name}</span>
              <span className={styles.fileSize}>{(f.size / 1024).toFixed(0)} KB</span>
              <button className={styles.removeBtn} onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.optRow}>
        <div className={styles.optGroup}>
          <label className={styles.optLabel}>Orientation</label>
          <div className={styles.modeRow}>
            {[['auto', 'Auto'], ['portrait', 'Portrait'], ['landscape', 'Landscape']].map(([val, label]) => (
              <button key={val} className={`${styles.modeBtn} ${orientation === val ? styles.modeBtnActive : ''}`} onClick={() => setOrientation(val)}>{label}</button>
            ))}
          </div>
        </div>
        <div className={styles.optGroup}>
          <label className={styles.optLabel}>Page Sizing</label>
          <div className={styles.modeRow}>
            {[['a4', 'Standard A4'], ['fit', 'Fit Image']].map(([val, label]) => (
              <button key={val} className={`${styles.modeBtn} ${pageSize === val ? styles.modeBtnActive : ''}`} onClick={() => setPageSize(val)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.optGroup} style={{ marginTop: 8 }}>
        <label className={styles.optLabel}>Margin: {margin}px</label>
        <input type="range" min="0" max="50" step="5" value={margin} onChange={e => setMargin(Number(e.target.value))} className={styles.rangeInput} />
      </div>

      <ActionBtn onClick={handleConvert} disabled={files.length === 0} loading={busy} icon={FileDown}>
        Convert {files.length} Image{files.length === 1 ? '' : 's'} to PDF
      </ActionBtn>
    </ToolShell>
  )
}

function DeletePagesTool() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [thumbs, setThumbs] = useState([])
  const [selectedToDelete, setSelectedToDelete] = useState(new Set())

  const handleFile = async (f) => {
    setFile(f)
    setLoading(true)
    setSelectedToDelete(new Set())
    try {
      const buf = await f.arrayBuffer()
      const doc = await loadPdf(buf.slice(0))
      const total = doc.numPages
      const ts = []
      for (let i = 1; i <= total; i++) {
        const dataUrl = await renderThumbnail(i)
        ts.push({ pageNum: i, dataUrl })
      }
      setThumbs(ts)
    } catch (e) {
      toast.error('Failed to load PDF: ' + e.message)
    }
    setLoading(false)
  }

  const togglePage = (pageNum) => {
    setSelectedToDelete(prev => {
      const next = new Set(prev)
      if (next.has(pageNum)) next.delete(pageNum)
      else next.add(pageNum)
      return next
    })
  }

  const handleDelete = async () => {
    if (!file || selectedToDelete.size === 0) return
    if (selectedToDelete.size >= thumbs.length) {
      toast.error('Cannot delete all pages. Keep at least 1 page.')
      return
    }
    setBusy(true)
    const tid = toast.loading(`Deleting ${selectedToDelete.size} page(s)...`)
    try {
      const bytes = await deletePagesFromPdf(file, Array.from(selectedToDelete))
      downloadBytes(bytes, `deleted-${file.name}`)
      toast.success(`Removed ${selectedToDelete.size} page(s) successfully!`, { id: tid })
    } catch (e) {
      toast.error('Failed to delete pages: ' + e.message, { id: tid })
    }
    setBusy(false)
  }

  return (
    <ToolShell
      title="Delete Pages"
      desc="Visually select and remove unwanted pages from your document with a single click."
      wide={thumbs.length > 0}
    >
      <FileDropper file={file} onFile={handleFile} onClear={() => { setFile(null); setThumbs([]); setSelectedToDelete(new Set()) }} />

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--tx-3)', padding: 16 }}>
          <Loader2 size={18} className={styles.spin} /> Generating visual page thumbnails...
        </div>
      )}

      {thumbs.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 6px' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-2)' }}>
              Click pages to mark for deletion ({selectedToDelete.size} selected):
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => setSelectedToDelete(new Set(thumbs.map(t => t.pageNum)))}
              >
                Select All
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => setSelectedToDelete(new Set())}
              >
                Clear
              </button>
            </div>
          </div>

          <div className={styles.deleteGrid}>
            {thumbs.map(({ pageNum, dataUrl }) => {
              const isSelected = selectedToDelete.has(pageNum)
              return (
                <div
                  key={pageNum}
                  className={`${styles.deleteCard} ${isSelected ? styles.deleteCardActive : ''}`}
                  onClick={() => togglePage(pageNum)}
                >
                  <img src={dataUrl} alt={`Page ${pageNum}`} style={{ width: '100%', height: 160, objectFit: 'contain' }} />
                  {isSelected && (
                    <div className={styles.deleteOverlay}>
                      <Trash2 size={24} />
                      <span>Delete</span>
                    </div>
                  )}
                  <div className={styles.deleteCardFooter}>
                    Page {pageNum} {isSelected ? '(Will delete)' : ''}
                  </div>
                </div>
              )
            })}
          </div>

          <ActionBtn
            onClick={handleDelete}
            disabled={selectedToDelete.size === 0 || selectedToDelete.size >= thumbs.length}
            loading={busy}
            icon={Trash2}
          >
            {selectedToDelete.size === 0
              ? 'Select pages above to delete'
              : `Delete ${selectedToDelete.size} Page${selectedToDelete.size === 1 ? '' : 's'} & Download`}
          </ActionBtn>
        </div>
      )}
    </ToolShell>
  )
}

function PageNumbersTool() {
  const [file, setFile] = useState(null)
  const [position, setPosition] = useState('bottom-center')
  const [format, setFormat] = useState('Page {n} of {total}')
  const [fontSize, setFontSize] = useState(10)
  const [startAt, setStartAt] = useState(1)
  const [color, setColor] = useState('#475569')
  const [busy, setBusy] = useState(false)

  const handleAddNumbers = async () => {
    if (!file) return
    setBusy(true)
    const tid = toast.loading('Adding page numbers...')
    try {
      const bytes = await addPageNumbers(file, { position, format, fontSize, startAt, color })
      downloadBytes(bytes, `numbered-${file.name}`)
      toast.success('Page numbers added successfully!', { id: tid })
    } catch (e) {
      toast.error('Failed to add page numbers: ' + e.message, { id: tid })
    }
    setBusy(false)
  }

  return (
    <ToolShell title="Add Page Numbers" desc="Insert custom page numbers, headers, or bates numbering into your PDF document.">
      <FileDropper file={file} onFile={setFile} onClear={() => setFile(null)} />

      <div className={styles.formGrid}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Position on Page</label>
          <div className={styles.modeRow}>
            {[
              ['bottom-left', 'Bottom Left'],
              ['bottom-center', 'Bottom Center'],
              ['bottom-right', 'Bottom Right'],
              ['top-center', 'Top Center'],
              ['top-right', 'Top Right'],
            ].map(([val, label]) => (
              <button key={val} className={`${styles.modeBtn} ${position === val ? styles.modeBtnActive : ''}`} onClick={() => setPosition(val)}>{label}</button>
            ))}
          </div>
        </div>

        <div className={styles.formField}>
          <label className={styles.formLabel}>Numbering Format</label>
          <div className={styles.modeRow}>
            {[
              ['Page {n} of {total}', 'Page 1 of 10'],
              ['{n} / {total}', '1 / 10'],
              ['{n}', '1, 2, 3...'],
              ['Page {n}', 'Page 1, 2...'],
            ].map(([val, label]) => (
              <button key={val} className={`${styles.modeBtn} ${format === val ? styles.modeBtnActive : ''}`} onClick={() => setFormat(val)}>{label}</button>
            ))}
          </div>
        </div>

        <div className={styles.optRow}>
          <div className={styles.optGroup}>
            <label className={styles.optLabel}>Font Size</label>
            <div className={styles.modeRow}>
              {[9, 10, 12, 14].map(sz => (
                <button key={sz} className={`${styles.modeBtn} ${fontSize === sz ? styles.modeBtnActive : ''}`} onClick={() => setFontSize(sz)}>{sz} pt</button>
              ))}
            </div>
          </div>
          <div className={styles.optGroup}>
            <label className={styles.optLabel}>Start Counting At</label>
            <input
              type="number"
              min="1"
              value={startAt}
              onChange={e => setStartAt(Number(e.target.value) || 1)}
              className={styles.formInput}
              style={{ width: 100 }}
            />
          </div>
        </div>
      </div>

      <ActionBtn onClick={handleAddNumbers} disabled={!file} loading={busy} icon={Hash}>
        Add Page Numbers & Download
      </ActionBtn>
    </ToolShell>
  )
}

function GrayscaleTool() {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleConvert = async () => {
    if (!file) return
    setBusy(true)
    setProgress(0)
    const tid = toast.loading('Converting to Black & White...')
    try {
      const bytes = await convertToGrayscale(file, (p) => setProgress(p))
      downloadBytes(bytes, `bw-${file.name}`)
      toast.success('Converted to Black & White PDF successfully!', { id: tid })
    } catch (e) {
      toast.error('Conversion failed: ' + e.message, { id: tid })
    }
    setBusy(false)
  }

  return (
    <ToolShell
      title="Grayscale / Black & White"
      desc="Transform all colored text, images, and artwork into clean monochrome grayscale. Save printer ink and ensure uniform scanning standards."
    >
      <FileDropper file={file} onFile={setFile} onClear={() => setFile(null)} />
      <div className={styles.infoBox}>
        🖨️ <strong>Printer Friendly:</strong> Removes all color toner usage by rendering every vector element and image into balanced black, white, and gray tones.
      </div>
      <ActionBtn onClick={handleConvert} disabled={!file} loading={busy} icon={Moon}>
        {busy ? `Processing (${progress}%)...` : 'Convert to Black & White PDF'}
      </ActionBtn>
    </ToolShell>
  )
}

function FlattenTool() {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)

  const handleFlatten = async () => {
    if (!file) return
    setBusy(true)
    const tid = toast.loading('Flattening document...')
    try {
      const bytes = await flattenPdf(file)
      downloadBytes(bytes, `flattened-${file.name}`)
      toast.success('Document flattened successfully!', { id: tid })
    } catch (e) {
      toast.error('Failed to flatten: ' + e.message, { id: tid })
    }
    setBusy(false)
  }

  return (
    <ToolShell
      title="Flatten PDF"
      desc="Permanently merge interactive form fields, checkboxes, and annotations directly into the document content so they cannot be altered or removed."
    >
      <FileDropper file={file} onFile={setFile} onClear={() => setFile(null)} />
      <div className={styles.infoBox}>
        🔒 <strong>Read-Only Protection:</strong> After flattening, all form inputs, radio buttons, and digital annotations become permanent background graphics.
      </div>
      <ActionBtn onClick={handleFlatten} disabled={!file} loading={busy} icon={CheckSquare}>
        Flatten PDF
      </ActionBtn>
    </ToolShell>
  )
}

function PdfToTextTool() {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [text, setText] = useState('')

  const handleExtract = async () => {
    if (!file) return
    setBusy(true)
    setProgress(0)
    const tid = toast.loading('Extracting text...')
    try {
      const extracted = await extractAllText(file, (p) => setProgress(p))
      setText(extracted)
      toast.success('Text extracted successfully!', { id: tid })
    } catch (e) {
      toast.error('Extraction failed: ' + e.message, { id: tid })
    }
    setBusy(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    toast.success('Copied text to clipboard!')
  }

  const handleDownloadTxt = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    downloadBlob(blob, `${file?.name?.replace(/\.pdf$/i, '') || 'extracted'}.txt`)
  }

  return (
    <ToolShell
      title="Extract Text / PDF to TXT"
      desc="Extract all readable plain text from your PDF document for search, indexing, or editing in text editors."
      wide={Boolean(text)}
    >
      <FileDropper file={file} onFile={(f) => { setFile(f); setText('') }} onClear={() => { setFile(null); setText('') }} />

      <ActionBtn onClick={handleExtract} disabled={!file} loading={busy} icon={FileCode}>
        {busy ? `Extracting (${progress}%)...` : 'Extract All Text'}
      </ActionBtn>

      {text && (
        <div className={styles.textViewWrap}>
          <div className={styles.textStats}>
            <span>{text.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
            <span>•</span>
            <span>{text.length.toLocaleString()} characters</span>
          </div>
          <textarea className={styles.textAreaBox} value={text} onChange={e => setText(e.target.value)} />
          <div className={styles.textActionRow}>
            <button className={styles.actionBtn} onClick={handleCopy}>
              <Copy size={14} /> Copy to Clipboard
            </button>
            <button className={styles.actionBtn} onClick={handleDownloadTxt} style={{ background: '#0284c7' }}>
              <FileDown size={14} /> Download .txt
            </button>
          </div>
        </div>
      )}
    </ToolShell>
  )
}

function SignPdfTool() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)

  const handleFile = (f) => {
    setFile(f)
    usePdfStore.getState().setFile(f, f.name, f.size)
    usePdfStore.getState().setActiveTool('sign')
    toast.success(`Loaded ${f.name} into Signature Editor!`)
    navigate('/editor')
  }

  const handleOpenEditor = () => {
    usePdfStore.getState().setActiveTool('sign')
    navigate('/editor')
  }

  return (
    <ToolShell
      title="Sign PDF"
      desc="Draw, type in elegant handwriting fonts, or upload your digital signature to place anywhere on your PDF."
    >
      <FileDropper file={file} onFile={handleFile} onClear={() => setFile(null)} label="Drop PDF to sign or click to browse" />
      <div className={styles.infoBox}>
        ✍️ <strong>Full Signature Suite:</strong> Includes real-time smooth canvas drawing, 4 handwriting cursive font styles, and transparent signature image upload.
      </div>
      <ActionBtn onClick={handleOpenEditor} icon={PenTool}>
        Open Signature Tool in Editor →
      </ActionBtn>
    </ToolShell>
  )
}

/* ── Compare PDFs Tool ── */
function ComparePdfTool() {
  const [fileA, setFileA] = useState(null)
  const [fileB, setFileB] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [imgA, setImgA] = useState(null)
  const [imgB, setImgB] = useState(null)
  const [diffImg, setDiffImg] = useState(null)
  const [viewMode, setViewMode] = useState('side-by-side')
  const [loading, setLoading] = useState(false)
  const [diffPercent, setDiffPercent] = useState(0)

  const renderComparison = useCallback(async () => {
    if (!fileA || !fileB) return
    setLoading(true)
    try {
      const [bufA, bufB] = await Promise.all([fileA.arrayBuffer(), fileB.arrayBuffer()])
      const [pdfA, pdfB] = await Promise.all([
        pdfjsLib.getDocument({ data: bufA.slice(0) }).promise,
        pdfjsLib.getDocument({ data: bufB.slice(0) }).promise,
      ])
      const total = Math.max(pdfA.numPages, pdfB.numPages)
      setTotalPages(total)

      const targetPage = Math.min(page, total)
      const pageObjA = targetPage <= pdfA.numPages ? await pdfA.getPage(targetPage) : null
      const pageObjB = targetPage <= pdfB.numPages ? await pdfB.getPage(targetPage) : null

      const renderCanvas = async (pObj) => {
        if (!pObj) return null
        const vp = pObj.getViewport({ scale: 1.5 })
        const c = document.createElement('canvas')
        c.width = Math.round(vp.width)
        c.height = Math.round(vp.height)
        const ctx = c.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, c.width, c.height)
        await pObj.render({ canvasContext: ctx, viewport: vp }).promise
        return c
      }

      const [canvA, canvB] = await Promise.all([renderCanvas(pageObjA), renderCanvas(pageObjB)])
      if (canvA) setImgA(canvA.toDataURL('image/png'))
      if (canvB) setImgB(canvB.toDataURL('image/png'))

      if (canvA && canvB) {
        const w = Math.max(canvA.width, canvB.width)
        const h = Math.max(canvA.height, canvB.height)
        const diffCanvas = document.createElement('canvas')
        diffCanvas.width = w
        diffCanvas.height = h
        const diffCtx = diffCanvas.getContext('2d')
        diffCtx.fillStyle = '#ffffff'
        diffCtx.fillRect(0, 0, w, h)

        const ctxA = canvA.getContext('2d')
        const ctxB = canvB.getContext('2d')
        const dataA = ctxA.getImageData(0, 0, canvA.width, canvA.height).data
        const dataB = ctxB.getImageData(0, 0, canvB.width, canvB.height).data
        const diffData = diffCtx.createImageData(w, h)
        const out = diffData.data

        let diffPixels = 0
        const totalPx = w * h

        for (let j = 0; j < out.length; j += 4) {
          const rA = dataA[j] ?? 255
          const gA = dataA[j + 1] ?? 255
          const bA = dataA[j + 2] ?? 255

          const rB = dataB[j] ?? 255
          const gB = dataB[j + 1] ?? 255
          const bB = dataB[j + 2] ?? 255

          const diff = Math.abs(rA - rB) + Math.abs(gA - gB) + Math.abs(bA - bB)
          if (diff > 45) {
            diffPixels++
            out[j] = 239
            out[j + 1] = 68
            out[j + 2] = 68
            out[j + 3] = 255
          } else {
            const gray = Math.round(0.299 * rA + 0.587 * gA + 0.114 * bA)
            out[j] = Math.min(255, gray + 40)
            out[j + 1] = Math.min(255, gray + 40)
            out[j + 2] = Math.min(255, gray + 40)
            out[j + 3] = 180
          }
        }
        diffCtx.putImageData(diffData, 0, 0)
        setDiffImg(diffCanvas.toDataURL('image/png'))
        setDiffPercent(((diffPixels / totalPx) * 100).toFixed(1))
      }
    } catch (e) {
      toast.error('Compare failed: ' + e.message)
    }
    setLoading(false)
  }, [fileA, fileB, page])

  useEffect(() => {
    if (fileA && fileB) renderComparison()
  }, [fileA, fileB, page, renderComparison])

  return (
    <ToolShell
      title="Compare PDFs"
      desc="Visually inspect and highlight differences between two versions of a document with pixel-level precision."
      wide={Boolean(fileA && fileB)}
    >
      <div className={styles.dualDropWrap}>
        <div>
          <label className={styles.optLabel} style={{ marginBottom: 6 }}>Document A (Original)</label>
          <FileDropper file={fileA} onFile={setFileA} onClear={() => { setFileA(null); setImgA(null) }} label="Drop Original PDF A" />
        </div>
        <div>
          <label className={styles.optLabel} style={{ marginBottom: 6 }}>Document B (Modified)</label>
          <FileDropper file={fileB} onFile={setFileB} onClear={() => { setFileB(null); setImgB(null) }} label="Drop Modified PDF B" />
        </div>
      </div>

      {fileA && fileB && (
        <div>
          <div className={styles.compareToolbar}>
            <div className={styles.comparePageNav}>
              <button
                type="button"
                className={styles.ghostBtn}
                style={{ padding: '4px 8px' }}
                disabled={page <= 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                type="button"
                className={styles.ghostBtn}
                style={{ padding: '4px 8px' }}
                disabled={page >= totalPages || loading}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight size={14} />
              </button>
              {loading && <Loader2 size={14} className={styles.spin} />}
            </div>

            <div className={styles.compareViews}>
              <button
                type="button"
                className={`${styles.modeBtn} ${viewMode === 'side-by-side' ? styles.modeBtnActive : ''}`}
                onClick={() => setViewMode('side-by-side')}
              >
                Side-by-Side
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${viewMode === 'diff' ? styles.modeBtnActive : ''}`}
                onClick={() => setViewMode('diff')}
              >
                Difference Heatmap ({diffPercent}% Changed)
              </button>
            </div>
          </div>

          {viewMode === 'side-by-side' ? (
            <div className={styles.compareSideBySide}>
              <div className={styles.diffCard}>
                <div className={styles.diffCardHeader}>Document A (Original)</div>
                <div className={styles.diffCardBody}>
                  {imgA && <img src={imgA} alt="Doc A" />}
                </div>
              </div>
              <div className={styles.diffCard}>
                <div className={styles.diffCardHeader}>Document B (Modified)</div>
                <div className={styles.diffCardBody}>
                  {imgB && <img src={imgB} alt="Doc B" />}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.diffCard}>
              <div className={styles.diffCardHeader}>
                <span>Difference Heatmap</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>● Red = Changed Content</span>
              </div>
              <div className={styles.diffCardBody}>
                {diffImg && <img src={diffImg} alt="Diff" />}
              </div>
            </div>
          )}
        </div>
      )}
    </ToolShell>
  )
}

/* ── Crop PDF Tool ── */
function CropPdfTool() {
  const [file, setFile] = useState(null)
  const [top, setTop] = useState(20)
  const [right, setRight] = useState(20)
  const [bottom, setBottom] = useState(20)
  const [left, setLeft] = useState(20)
  const [allPages, setAllPages] = useState(true)
  const [pageNum, setPageNum] = useState(1)
  const [busy, setBusy] = useState(false)

  const applyPreset = (t, r, b, l) => {
    setTop(t)
    setRight(r)
    setBottom(b)
    setLeft(l)
  }

  const handleCrop = async () => {
    if (!file) return
    setBusy(true)
    const tid = toast.loading('Cropping document...')
    try {
      const bytes = await cropPdf(file, { top, right, bottom, left, allPages, pageNum })
      downloadBytes(bytes, `cropped-${file.name}`)
      toast.success('Document cropped successfully!', { id: tid })
    } catch (e) {
      toast.error('Crop failed: ' + e.message, { id: tid })
    }
    setBusy(false)
  }

  return (
    <ToolShell title="Crop PDF" desc="Trim margins, remove white borders, or crop pages without losing vector quality.">
      <FileDropper file={file} onFile={setFile} onClear={() => setFile(null)} />

      <div className={styles.optGroup}>
        <label className={styles.optLabel}>Preset Trim Margins</label>
        <div className={styles.modeRow}>
          <button className={styles.modeBtn} onClick={() => applyPreset(25, 25, 25, 25)}>10mm Margins</button>
          <button className={styles.modeBtn} onClick={() => applyPreset(50, 50, 50, 50)}>20mm Margins</button>
          <button className={styles.modeBtn} onClick={() => applyPreset(40, 0, 0, 0)}>Trim Header (40pt)</button>
          <button className={styles.modeBtn} onClick={() => applyPreset(0, 0, 40, 0)}>Trim Footer (40pt)</button>
          <button className={styles.modeBtn} onClick={() => applyPreset(0, 0, 0, 0)}>Reset (0)</button>
        </div>
      </div>

      <div className={styles.cropGrid}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Top Trim (pt)</label>
          <input type="number" min="0" max="300" value={top} onChange={e => setTop(Number(e.target.value) || 0)} className={styles.formInput} />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Right Trim (pt)</label>
          <input type="number" min="0" max="300" value={right} onChange={e => setRight(Number(e.target.value) || 0)} className={styles.formInput} />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Bottom Trim (pt)</label>
          <input type="number" min="0" max="300" value={bottom} onChange={e => setBottom(Number(e.target.value) || 0)} className={styles.formInput} />
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Left Trim (pt)</label>
          <input type="number" min="0" max="300" value={left} onChange={e => setLeft(Number(e.target.value) || 0)} className={styles.formInput} />
        </div>
      </div>

      <div className={styles.checkGrid}>
        <label>
          <input type="checkbox" checked={allPages} onChange={e => setAllPages(e.target.checked)} />
          Apply crop to all pages in document
        </label>
      </div>

      {!allPages && (
        <div className={styles.formField} style={{ maxWidth: 160 }}>
          <label className={styles.formLabel}>Target Page</label>
          <input type="number" min="1" value={pageNum} onChange={e => setPageNum(Number(e.target.value) || 1)} className={styles.formInput} />
        </div>
      )}

      <ActionBtn onClick={handleCrop} disabled={!file} loading={busy} icon={Crop}>
        Crop PDF & Download
      </ActionBtn>
    </ToolShell>
  )
}

/* ── Extract Raw Images Tool ── */
function ExtractImagesTool() {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)

  const handleExtract = async () => {
    if (!file) return
    setBusy(true)
    setProgress(0)
    const tid = toast.loading('Extracting embedded images...')
    try {
      const data = await extractImagesFromPdf(file, (p) => setProgress(p))
      setResult(data)
      if (data.totalImages === 0) {
        toast('No embedded raster photos found in this PDF', { icon: 'ℹ️', id: tid })
      } else {
        toast.success(`Extracted ${data.totalImages} image(s)!`, { id: tid })
      }
    } catch (e) {
      toast.error('Extraction failed: ' + e.message, { id: tid })
    }
    setBusy(false)
  }

  const downloadAll = () => {
    if (!result?.zipBlob) return
    downloadBlob(result.zipBlob, `${file?.name?.replace(/\.pdf$/i, '') || 'extracted'}-images.zip`)
  }

  return (
    <ToolShell
      title="Extract Images"
      desc="Extract all embedded photos and bitmap graphics from your PDF at their original resolution."
      wide={Boolean(result && result.images.length > 0)}
    >
      <FileDropper file={file} onFile={(f) => { setFile(f); setResult(null) }} onClear={() => { setFile(null); setResult(null) }} />

      <ActionBtn onClick={handleExtract} disabled={!file} loading={busy} icon={ImageIcon}>
        {busy ? `Scanning (${progress}%)...` : 'Extract Embedded Images'}
      </ActionBtn>

      {result && result.images.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className={styles.zipBar}>
            <span className={styles.zipInfo}>✓ {result.totalImages} image(s) extracted</span>
            <button className={styles.zipBtn} onClick={downloadAll}>
              <FolderArchive size={16} /> Download All (ZIP)
            </button>
          </div>
          <div className={styles.imgGrid}>
            {result.images.map((img) => (
              <div key={img.id} className={styles.imgCard}>
                <img src={img.dataUrl} alt={`Extracted ${img.id}`} />
                <div className={styles.imgCardBottom}>
                  <span className={styles.imgCardLabel}>{img.width}×{img.height} (P{img.pageNum})</span>
                  <button className={styles.dlSingleBtn} onClick={() => downloadBlob(img.blob, img.name)}>
                    <ArrowDownToLine size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ToolShell>
  )
}

/* ── N-Up Tool (Multiple Pages Per Sheet) ── */
function NUpTool() {
  const [file, setFile] = useState(null)
  const [n, setN] = useState(2)
  const [border, setBorder] = useState(true)
  const [margin, setMargin] = useState(16)
  const [busy, setBusy] = useState(false)

  const handleGenerate = async () => {
    if (!file) return
    setBusy(true)
    const tid = toast.loading(`Generating ${n}-in-1 handouts...`)
    try {
      const bytes = await nUpPdf(file, { n, border, margin })
      downloadBytes(bytes, `${n}up-${file.name}`)
      toast.success(`Generated ${n}-Up PDF successfully!`, { id: tid })
    } catch (e) {
      toast.error('Failed: ' + e.message, { id: tid })
    }
    setBusy(false)
  }

  return (
    <ToolShell
      title="Multiple Pages per Sheet (N-Up)"
      desc="Print 2 or 4 slides/pages onto a single A4 sheet. Save 50% to 75% on printing paper and toner."
    >
      <FileDropper file={file} onFile={setFile} onClear={() => setFile(null)} />

      <label className={styles.optLabel}>Select Layout</label>
      <div className={styles.layoutCardGrid}>
        <div
          className={`${styles.layoutCard} ${n === 2 ? styles.layoutCardActive : ''}`}
          onClick={() => setN(2)}
        >
          <LayoutGrid size={28} style={{ color: n === 2 ? 'var(--accent)' : 'var(--tx-3)' }} />
          <span className={styles.layoutCardTitle}>2-Up (2 in 1)</span>
          <span className={styles.layoutCardSub}>Side-by-Side (A4 Landscape)</span>
        </div>
        <div
          className={`${styles.layoutCard} ${n === 4 ? styles.layoutCardActive : ''}`}
          onClick={() => setN(4)}
        >
          <LayoutGrid size={28} style={{ color: n === 4 ? 'var(--accent)' : 'var(--tx-3)' }} />
          <span className={styles.layoutCardTitle}>4-Up (4 in 1)</span>
          <span className={styles.layoutCardSub}>2×2 Grid (A4 Portrait)</span>
        </div>
      </div>

      <div className={styles.checkGrid}>
        <label>
          <input type="checkbox" checked={border} onChange={e => setBorder(e.target.checked)} />
          Draw thin border outline around each slide
        </label>
      </div>

      <div className={styles.optGroup}>
        <label className={styles.optLabel}>Margin: {margin}pt</label>
        <input type="range" min="8" max="36" step="4" value={margin} onChange={e => setMargin(Number(e.target.value))} className={styles.rangeInput} />
      </div>

      <ActionBtn onClick={handleGenerate} disabled={!file} loading={busy} icon={LayoutGrid}>
        Generate {n}-Up Handouts & Download
      </ActionBtn>
    </ToolShell>
  )
}

/* ── Resize PDF Dimensions Tool ── */
function ResizePdfTool() {
  const [file, setFile] = useState(null)
  const [targetSize, setTargetSize] = useState('a4')
  const [margin, setMargin] = useState(14)
  const [busy, setBusy] = useState(false)

  const handleResize = async () => {
    if (!file) return
    setBusy(true)
    const tid = toast.loading('Resizing document pages...')
    try {
      const bytes = await resizePdf(file, { targetSize, margin })
      downloadBytes(bytes, `resized-${targetSize}-${file.name}`)
      toast.success(`Standardized to ${targetSize.toUpperCase()}!`, { id: tid })
    } catch (e) {
      toast.error('Resize failed: ' + e.message, { id: tid })
    }
    setBusy(false)
  }

  return (
    <ToolShell
      title="Resize PDF Dimensions"
      desc="Standardize page dimensions to standard international print formats (A4, US Letter, Legal, A3) with centered scaling."
    >
      <FileDropper file={file} onFile={setFile} onClear={() => setFile(null)} />

      <div className={styles.optGroup}>
        <label className={styles.optLabel}>Target Paper Standard</label>
        <div className={styles.modeRow}>
          {[
            ['a4', 'Standard A4 (210×297mm)'],
            ['letter', 'US Letter (8.5×11in)'],
            ['legal', 'US Legal (8.5×14in)'],
            ['a3', 'A3 / Poster (297×420mm)'],
            ['a5', 'A5 / Booklet (148×210mm)'],
          ].map(([val, label]) => (
            <button key={val} className={`${styles.modeBtn} ${targetSize === val ? styles.modeBtnActive : ''}`} onClick={() => setTargetSize(val)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <ActionBtn onClick={handleResize} disabled={!file} loading={busy} icon={Maximize2}>
        Resize to {targetSize.toUpperCase()} & Download
      </ActionBtn>
    </ToolShell>
  )
}

/* ── Metadata Editor & Sanitize Tool ── */
function MetadataTool() {
  const [file, setFile] = useState(null)
  const [meta, setMeta] = useState({ title: '', author: '', subject: '', keywords: '', creator: '', producer: '' })
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleFile = async (f) => {
    setFile(f)
    setLoading(true)
    try {
      const read = await readPdfMetadata(f)
      setMeta({
        title: read.title || '',
        author: read.author || '',
        subject: read.subject || '',
        keywords: read.keywords || '',
        creator: read.creator || '',
        producer: read.producer || '',
      })
    } catch (e) {
      toast.error('Failed to read metadata: ' + e.message)
    }
    setLoading(false)
  }

  const handleSave = async (sanitize = false) => {
    if (!file) return
    setBusy(true)
    const tid = toast.loading(sanitize ? 'Sanitizing document...' : 'Saving metadata...')
    try {
      const bytes = await updatePdfMetadata(file, meta, sanitize)
      downloadBytes(bytes, sanitize ? `sanitized-${file.name}` : `updated-${file.name}`)
      toast.success(sanitize ? 'All metadata wiped clean!' : 'Metadata updated successfully!', { id: tid })
      if (sanitize) {
        setMeta({ title: '', author: '', subject: '', keywords: '', creator: '', producer: '' })
      }
    } catch (e) {
      toast.error('Failed: ' + e.message, { id: tid })
    }
    setBusy(false)
  }

  return (
    <ToolShell
      title="PDF Metadata Editor & Sanitize"
      desc="Inspect and update document properties (Author, Title, Keywords) or wipe hidden privacy tracking information."
    >
      <FileDropper file={file} onFile={handleFile} onClear={() => setFile(null)} />

      {loading && (
        <div style={{ display: 'flex', gap: 10, color: 'var(--tx-3)', padding: 12 }}>
          <Loader2 size={16} className={styles.spin} /> Reading document properties...
        </div>
      )}

      {file && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>Document Properties</span>
            <button type="button" className={styles.sanitizeBtn} onClick={() => handleSave(true)} disabled={busy}>
              <ShieldAlert size={14} /> Wipe All Metadata (Sanitize)
            </button>
          </div>

          <div className={styles.metaGrid}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Title</label>
              <input type="text" className={styles.formInput} value={meta.title} onChange={e => setMeta({ ...meta, title: e.target.value })} placeholder="Document Title" />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Author</label>
              <input type="text" className={styles.formInput} value={meta.author} onChange={e => setMeta({ ...meta, author: e.target.value })} placeholder="Author Name" />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Subject</label>
              <input type="text" className={styles.formInput} value={meta.subject} onChange={e => setMeta({ ...meta, subject: e.target.value })} placeholder="Subject / Description" />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Keywords (Comma separated)</label>
              <input type="text" className={styles.formInput} value={meta.keywords} onChange={e => setMeta({ ...meta, keywords: e.target.value })} placeholder="e.g. invoice, contract, legal" />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Creator Software</label>
              <input type="text" className={styles.formInput} value={meta.creator} onChange={e => setMeta({ ...meta, creator: e.target.value })} placeholder="Creating Application" />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>PDF Producer</label>
              <input type="text" className={styles.formInput} value={meta.producer} onChange={e => setMeta({ ...meta, producer: e.target.value })} placeholder="PDF Engine" />
            </div>
          </div>

          <ActionBtn onClick={() => handleSave(false)} disabled={!file} loading={busy} icon={Check}>
            Save Updated Metadata & Download
          </ActionBtn>
        </div>
      )}
    </ToolShell>
  )
}

/* ── Dark Mode / Invert Colors Tool ── */
function InvertColorsTool() {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleInvert = async () => {
    if (!file) return
    setBusy(true)
    setProgress(0)
    const tid = toast.loading('Inverting colors for dark mode...')
    try {
      const bytes = await invertPdfColors(file, (p) => setProgress(p))
      downloadBytes(bytes, `darkmode-${file.name}`)
      toast.success('Dark Mode PDF generated successfully!', { id: tid })
    } catch (e) {
      toast.error('Invert failed: ' + e.message, { id: tid })
    }
    setBusy(false)
  }

  return (
    <ToolShell
      title="Dark Mode / Invert Colors PDF"
      desc="Transform documents into true high-contrast night mode (black background, white text) for comfortable reading and OLED power savings."
    >
      <FileDropper file={file} onFile={setFile} onClear={() => setFile(null)} />
      <div className={styles.infoBox}>
        🌙 <strong>Eye Comfort:</strong> Replaces blinding white glare with dark canvas background while preserving sharp typography and contrast.
      </div>
      <ActionBtn onClick={handleInvert} disabled={!file} loading={busy} icon={Moon}>
        {busy ? `Processing (${progress}%)...` : 'Convert to Dark Mode PDF'}
      </ActionBtn>
    </ToolShell>
  )
}

/* ── Booklet Creator Tool ── */
function BookletTool() {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)

  const handleBooklet = async () => {
    if (!file) return
    setBusy(true)
    const tid = toast.loading('Creating print booklet imposition...')
    try {
      const bytes = await createBooklet(file)
      downloadBytes(bytes, `booklet-${file.name}`)
      toast.success('Booklet generated successfully!', { id: tid })
    } catch (e) {
      toast.error('Booklet failed: ' + e.message, { id: tid })
    }
    setBusy(false)
  }

  return (
    <ToolShell
      title="Booklet Creator"
      desc="Re-order pages into double-sided saddle-stitch booklet format. Print 2-sided (short-edge flip) and fold in half to create an instant book."
    >
      <FileDropper file={file} onFile={setFile} onClear={() => setFile(null)} />
      <div className={styles.infoBox}>
        📖 <strong>Print Instructions:</strong> When printing the output PDF, select <strong>Double-Sided Printing</strong> with <strong>Flip on Short Edge</strong>. Fold the printed sheets down the middle for a sequential book!
      </div>
      <ActionBtn onClick={handleBooklet} disabled={!file} loading={busy} icon={BookOpen}>
        Create Printable Booklet & Download
      </ActionBtn>
    </ToolShell>
  )
}

/* ── QR Code Stamp Tool ── */
function QrCodeTool() {
  const [file, setFile] = useState(null)
  const [text, setText] = useState('https://example.com')
  const [position, setPosition] = useState('bottom-right')
  const [size, setSize] = useState(80)
  const [pages, setPages] = useState('all')
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    import('qrcode').then(QRCode => {
      QRCode.default.toDataURL(text || 'https://', { margin: 1, width: 200 }).then(url => {
        if (active) setPreviewUrl(url)
      })
    }).catch(() => {})
    return () => { active = false }
  }, [text])

  const handleStamp = async () => {
    if (!file || !text.trim()) return
    setBusy(true)
    const tid = toast.loading('Stamping QR Code onto PDF...')
    try {
      const bytes = await stampQrCode(file, { text, position, size, pages })
      downloadBytes(bytes, `qr-${file.name}`)
      toast.success('QR Code stamped successfully!', { id: tid })
    } catch (e) {
      toast.error('Stamp failed: ' + e.message, { id: tid })
    }
    setBusy(false)
  }

  return (
    <ToolShell
      title="Stamp QR Code onto PDF"
      desc="Generate and embed dynamic QR codes (links, payments, verification IDs) directly onto any PDF page."
    >
      <FileDropper file={file} onFile={setFile} onClear={() => setFile(null)} />

      <div className={styles.formField}>
        <label className={styles.formLabel}>QR Code Content (URL or Text)</label>
        <input
          type="text"
          className={styles.formInput}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="https://example.com or any tracking ID"
        />
      </div>

      {previewUrl && (
        <div className={styles.qrPreviewBox}>
          <img src={previewUrl} alt="QR Preview" style={{ width: 110, height: 110 }} />
          <span style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 6 }}>Live QR Code Preview</span>
        </div>
      )}

      <div className={styles.formGrid}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Position on Page</label>
          <div className={styles.modeRow}>
            {[
              ['bottom-right', 'Bottom Right'],
              ['bottom-left', 'Bottom Left'],
              ['top-right', 'Top Right'],
              ['top-left', 'Top Left'],
              ['center', 'Center'],
            ].map(([val, label]) => (
              <button key={val} className={`${styles.modeBtn} ${position === val ? styles.modeBtnActive : ''}`} onClick={() => setPosition(val)}>{label}</button>
            ))}
          </div>
        </div>

        <div className={styles.formField}>
          <label className={styles.formLabel}>Apply to Pages</label>
          <div className={styles.modeRow}>
            {[
              ['all', 'All Pages'],
              ['first', 'First Page Only'],
              ['last', 'Last Page Only'],
            ].map(([val, label]) => (
              <button key={val} className={`${styles.modeBtn} ${pages === val ? styles.modeBtnActive : ''}`} onClick={() => setPages(val)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.optGroup} style={{ marginTop: 10 }}>
        <label className={styles.optLabel}>QR Size: {size}×{size} pt</label>
        <input type="range" min="50" max="180" step="10" value={size} onChange={e => setSize(Number(e.target.value))} className={styles.rangeInput} />
      </div>

      <ActionBtn onClick={handleStamp} disabled={!file || !text.trim()} loading={busy} icon={QrCode}>
        Stamp QR Code & Download
      </ActionBtn>
    </ToolShell>
  )
}

/* ─────────────────── tool registry ─────────────────── */
const TOOL_DEFS = [
  // PDF Organize (8 tools)
  { id:'merge',          icon:Merge,            label:'Merge PDFs',       color:'#3b82f6', studio:'PDF', category:'Organize', desc:'Combine multiple PDFs into one single file.' },
  { id:'split',          icon:Scissors,         label:'Split PDF',        color:'#e84545', studio:'PDF', category:'Organize', desc:'Split by page range or every N pages.' },
  { id:'delete-pages',   icon:Trash2,           label:'Delete Pages',     color:'#ef4444', studio:'PDF', category:'Organize', desc:'Visually select and remove unwanted pages.' },
  { id:'extract',        icon:FileSearch,       label:'Extract Pages',    color:'#f59e0b', studio:'PDF', category:'Organize', desc:'Pull specific pages into a new PDF file.' },
  { id:'reorder',        icon:Layers,           label:'Reorder Pages',    color:'#8b5cf6', studio:'PDF', category:'Organize', desc:'Drag-and-drop pages to reorder your document.' },
  { id:'rotate',         icon:RotateCcw,        label:'Rotate PDF',       color:'#06b6d4', studio:'PDF', category:'Organize', desc:'Rotate individual pages or entire documents.' },
  { id:'n-up',           icon:LayoutGrid,       label:'N-Up / Handouts',  color:'#0ea5e9', studio:'PDF', category:'Organize', desc:'2-in-1 or 4-in-1 pages per sheet printing.' },
  { id:'booklet',        icon:BookOpen,         label:'Booklet Creator',  color:'#6366f1', studio:'PDF', category:'Organize', desc:'Imposition layout for folded book printing.' },

  // PDF Convert (5 tools)
  { id:'pdf-to-images',  icon:ImageIcon,        label:'PDF to JPG / PNG', color:'#10b981', studio:'PDF', category:'Convert',  desc:'Convert pages to high-res images or ZIP archive.' },
  { id:'images-to-pdf',  icon:FileDown,         label:'Images to PDF',    color:'#059669', studio:'PDF', category:'Convert',  desc:'Convert JPG, PNG, and WebP images into a PDF.' },
  { id:'extract-images', icon:FolderArchive,    label:'Extract Images',   color:'#14b8a6', studio:'PDF', category:'Convert',  desc:'Extract all embedded photos into a ZIP archive.' },
  { id:'pdf-to-text',    icon:FileCode,         label:'PDF to Text',      color:'#6366f1', studio:'PDF', category:'Convert',  desc:'Extract plain text from document to TXT file.' },
  { id:'ocr',            icon:ScanLine,         label:'OCR Scanner',      color:'#10b981', studio:'PDF', category:'Convert',  desc:'Extract text from scanned non-searchable PDFs.' },

  // PDF Edit (5 tools)
  { id:'edit',           icon:Edit3,            label:'Edit PDF',         color:'#e84545', studio:'PDF', category:'Edit',     desc:'Full editor: text, shapes, whiteout, and images.' },
  { id:'sign',           icon:PenTool,          label:'Sign PDF',         color:'#2563eb', studio:'PDF', category:'Edit',     desc:'Draw, type cursive, or upload your signature.' },
  { id:'crop',           icon:Crop,             label:'Crop PDF',         color:'#f97316', studio:'PDF', category:'Edit',     desc:'Trim margins and remove white borders losslessly.' },
  { id:'page-numbers',   icon:Hash,             label:'Page Numbers',     color:'#8b5cf6', studio:'PDF', category:'Edit',     desc:'Insert custom headers, footers, and Bates numbers.' },
  { id:'qr-code',        icon:QrCode,           label:'Stamp QR Code',    color:'#4f46e5', studio:'PDF', category:'Edit',     desc:'Embed dynamic QR verification codes onto pages.' },

  // PDF Optimize (5 tools)
  { id:'compress',       icon:Sliders,          label:'Compress PDF',     color:'#f59e0b', studio:'PDF', category:'Optimize', desc:'Target-size compression with visual fidelity.' },
  { id:'resize',         icon:Maximize2,        label:'Resize Dimensions',color:'#3b82f6', studio:'PDF', category:'Optimize', desc:'Standardize page size to A4, Letter, A3, Legal.' },
  { id:'grayscale',      icon:Moon,             label:'Grayscale PDF',    color:'#64748b', studio:'PDF', category:'Optimize', desc:'Convert all colors to black & white for ink saving.' },
  { id:'dark-mode',      icon:Eye,              label:'Dark Mode PDF',    color:'#1e293b', studio:'PDF', category:'Optimize', desc:'Invert colors for night reading and OLED screens.' },
  { id:'flatten',        icon:CheckSquare,      label:'Flatten PDF',      color:'#0ea5e9', studio:'PDF', category:'Optimize', desc:'Make form fields and annotations permanent.' },

  // PDF Secure (7 tools)
  { id:'compare',        icon:GitCompare,       label:'Compare PDFs',     color:'#ec4899', studio:'PDF', category:'Secure',   desc:'Visual diff highlighting differences between 2 PDFs.' },
  { id:'metadata',       icon:ShieldAlert,      label:'Metadata & Clean', color:'#d97706', studio:'PDF', category:'Secure',   desc:'Inspect, edit properties, or wipe tracking info.' },
  { id:'watermark',      icon:Droplets,         label:'Add Watermark',    color:'#06b6d4', studio:'PDF', category:'Secure',   desc:'Add text or stamp watermark with visual preview.' },
  { id:'protect',        icon:Lock,             label:'Protect PDF',      color:'#dc2626', studio:'PDF', category:'Secure',   desc:'Add AES-256 password encryption & restrictions.' },
  { id:'unlock',         icon:Unlock,           label:'Unlock PDF',       color:'#10b981', studio:'PDF', category:'Secure',   desc:'Remove copy and printing password restrictions.' },
  { id:'redact',         icon:EyeOff,           label:'Redact PDF',       color:'#1e293b', studio:'PDF', category:'Secure',   desc:'Permanently black out sensitive data.' },
  { id:'pdf-redact-pro', icon:ShieldAlert,      label:'PDF Blackout Redactor', color:'#ef4444', studio:'PDF', category:'Secure', desc:'Permanently black out sensitive text, accounts, or numbers.' },

  // PDF Advanced (10 tools)
  { id:'pdf-clean-blank',icon:Scissors,         label:'Blank Page Cleaner',color:'#10b981', studio:'PDF', category:'Organize', desc:'Auto-detect and delete empty scanner pages with 1 click.' },
  { id:'pdf-organize',   icon:Layers,           label:'Visual Page Arranger', color:'#8b5cf6', studio:'PDF', category:'Organize', desc:'Visually drag, reorder, rotate, or delete pages in a grid.' },
  { id:'pdf-bates',      icon:Hash,             label:'Bates Stamping & Headers', color:'#0ea5e9', studio:'PDF', category:'Edit', desc:'Legal Bates numbering, confidential headers, and page counts.' },
  { id:'pdf-ink-saver',  icon:FileText,         label:'Ink Saver B&W Dither', color:'#64748b', studio:'PDF', category:'Optimize', desc:'High-contrast monochrome filter saving up to 80% printer toner.' },
  { id:'pdf-form-builder',icon:CheckSquare,     label:'Form Field Builder',color:'#2563eb', studio:'PDF', category:'Edit', desc:'Add fillable interactive text fields and checkboxes to any PDF.' },
  { id:'images-to-pdf-pro',icon:FileDown,       label:'Multi-Image to PDF Pro', color:'#059669', studio:'PDF', category:'Convert', desc:'Batch convert photos to PDF with A4 presets and custom margins.' },
  { id:'pdf-interleave', icon:Layers,           label:'Alternate & Mix Scans', color:'#6366f1', studio:'PDF', category:'Organize', desc:'Collate separate Odd and Even page scans into 1 sequential PDF.' },
  { id:'certificate-generator',icon:Award,      label:'Bulk Certificate Generator', color:'#f97316', studio:'PDF', category:'Convert', desc:'Upload 1 PDF template + paste names -> generate certificates as a ZIP.' },
  { id:'pdf-cost-calculator',icon:Calculator,   label:'PDF Page & Cost Calculator', color:'#14b8a6', studio:'PDF', category:'Optimize', desc:'Inspect multiple PDFs to count total pages and calculate print costs.' },
  { id:'pdf-duplicate-pages',icon:Copy,         label:'PDF Page Duplicator', color:'#3b82f6', studio:'PDF', category:'Organize', desc:'Repeat forms, receipts, or flyers 5x, 10x, or 50x for mass printing.' },

  // iLovePDF Parity & Advanced Suite (10 tools)
  { id:'pdf-to-word',    icon:FileText,         label:'PDF to Word (.docx)', color:'#2563eb', studio:'PDF', category:'Convert', desc:'Convert PDF into editable Microsoft Word DOCX.' },
  { id:'word-to-pdf',    icon:FileDown,         label:'Word (.docx) to PDF', color:'#3b82f6', studio:'PDF', category:'Convert', desc:'Convert DOCX documents to standard A4 PDF.' },
  { id:'pdf-to-excel',   icon:FileSpreadsheet,  label:'PDF to Excel / CSV', color:'#10b981', studio:'PDF', category:'Convert', desc:'Extract tables and spreadsheets into structured CSV.' },
  { id:'pdf-to-markdown',icon:BookOpen,         label:'PDF to Markdown',  color:'#6366f1', studio:'PDF', category:'Convert', desc:'Convert document to structured Markdown headings.' },
  { id:'html-to-pdf',    icon:Code,             label:'HTML to PDF',      color:'#f59e0b', studio:'PDF', category:'Convert', desc:'Live HTML/CSS sandboxed code renderer to PDF.' },
  { id:'scan-to-pdf',    icon:Camera,           label:'Scan to PDF',      color:'#10b981', studio:'PDF', category:'Convert', desc:'Scan paper docs with webcam or phone camera.' },
  { id:'pdf-to-pdfa',    icon:Archive,          label:'PDF to PDF/A',     color:'#059669', studio:'PDF', category:'Optimize', desc:'ISO 19005-1 archival standard for long-term preservation.' },
  { id:'repair-pdf',     icon:Wrench,           label:'Repair PDF',       color:'#ef4444', studio:'PDF', category:'Optimize', desc:'Reconstruct corrupt xref tables and broken headers.' },
  { id:'pdf-summarize',  icon:Sparkles,         label:'AI PDF Summarizer',color:'#8b5cf6', studio:'PDF', category:'Edit',     desc:'In-browser NLP executive TL;DR and key takeaways.' },
  { id:'pdf-translate',  icon:Globe,            label:'PDF Translator',   color:'#06b6d4', studio:'PDF', category:'Edit',     desc:'Translate document text to Hindi, Spanish & 50+ langs.' },

  // Image Studio (21 tools)
  { id:'compress-image',     icon:Sliders,          label:'Compress Image',       color:'#10b981', studio:'Image', category:'Image', desc:'Compress JPG, PNG, and WebP with custom quality & dimensions.' },
  { id:'convert-image',      icon:RefreshCw,        label:'Convert Image',        color:'#06b6d4', studio:'Image', category:'Image', desc:'Instant format conversion between WebP, PNG, and JPG.' },
  { id:'favicon-generator',  icon:FolderArchive,    label:'Favicon Generator',    color:'#6366f1', studio:'Image', category:'Image', desc:'Generate complete suite of 16px to 512px app icons in a ZIP.' },
  { id:'photo-filters',      icon:Sparkles,         label:'Photo Filters',        color:'#ec4899', studio:'Image', category:'Image', desc:'Adjust brightness, contrast, saturation, blur, and vintage sepia.' },
  { id:'meme-generator',     icon:ImageIcon,        label:'Meme Generator',       color:'#f59e0b', studio:'Image', category:'Image', desc:'Create classic viral memes with custom top and bottom captions.' },
  { id:'palette-extractor',  icon:Palette,          label:'Palette Extractor',    color:'#8b5cf6', studio:'Image', category:'Image', desc:'Extract dominant color palettes and hex codes from any image.' },
  { id:'svg-to-png',         icon:Layers,           label:'SVG to PNG',           color:'#059669', studio:'Image', category:'Image', desc:'Rasterize SVG vector artwork to crisp 2x, 4K, or 8K PNG.' },
  { id:'remove-bg',          icon:Scissors,         label:'Magic Background Remover', color:'#10b981', studio:'Image', category:'Image', desc:'Erase background to transparent PNG with chroma color keying.' },
  { id:'passport-photo',     icon:Stamp,            label:'Passport Photo Maker', color:'#3b82f6', studio:'Image', category:'Image', desc:'2x2" and 35x45mm photos with 4x6 and A4 printable cut sheets.' },
  { id:'image-blur',         icon:ShieldAlert,      label:'Privacy Face Blur & Censor', color:'#ef4444', studio:'Image', category:'Image', desc:'Draw censor boxes over faces, license plates, and cards to pixelate.' },
  { id:'image-watermark',    icon:Stamp,            label:'Photo Watermark Pro',  color:'#06b6d4', studio:'Image', category:'Image', desc:'Stamp copyright text or logo with repeating tile grid protection.' },
  { id:'grid-splitter',      icon:Grid,             label:'Instagram Grid Splitter', color:'#ec4899', studio:'Image', category:'Image', desc:'Slice photos into 3x1, 3x2, or 3x3 square tiles and export ZIP.' },
  { id:'exact-resizer',      icon:Maximize2,        label:'Exact Dimension & DPI Resizer', color:'#8b5cf6', studio:'Image', category:'Image', desc:'Resize by px, mm, cm, or inches with 72, 150, or 300 print DPI.' },
  { id:'ascii-art',          icon:Sparkles,         label:'ASCII Art Generator',  color:'#f59e0b', studio:'Image', category:'Image', desc:'Convert photos into retro ASCII characters and copyable text art.' },
  { id:'polaroid-maker',     icon:ImageIcon,        label:'Vintage Polaroid Maker', color:'#f97316', studio:'Image', category:'Image', desc:'Wrap photos in vintage Polaroid frames with handwritten captions.' },
  { id:'signature-extractor',icon:PenTool,          label:'Paper Signature Extractor', color:'#2563eb', studio:'Image', category:'Image', desc:'Extract handwritten signatures from paper photos into transparent PNG.' },
  { id:'avatar-maker',       icon:Circle,           label:'Circular Avatar Maker', color:'#10b981', studio:'Image', category:'Image', desc:'Crop photos into circular PFP avatars with stylish ring borders.' },
  { id:'no-crop-square',     icon:Maximize2,        label:'No-Crop Square & Blur Pad', color:'#f59e0b', studio:'Image', category:'Image', desc:'Fit rectangular photos into 1:1 Instagram/WhatsApp square with blurred padding.' },
  { id:'batch-renamer',      icon:FileArchive,      label:'Batch Image Renamer', color:'#8b5cf6', studio:'Image', category:'Image', desc:'Sequentially rename dozens of photos with dates and prefix into a ZIP.' },
  { id:'duotone-fx',         icon:Sparkles,         label:'Spotify Duotone FX', color:'#ec4899', studio:'Image', category:'Image', desc:'Transform photos into 2-color high-contrast poster artwork.' },
  { id:'pixel-art',          icon:Grid,             label:'8-Bit Pixel Art Maker', color:'#06b6d4', studio:'Image', category:'Image', desc:'Convert photos into retro 8-bit / 16-bit video game pixel art.' },

  // Media & Audio Studio (4 tools)
  { id:'screen-recorder',    icon:Video,            label:'Screen Recorder',      color:'#ef4444', studio:'Media', category:'Media', desc:'Record screen, tab, or full window with mic and system audio.' },
  { id:'video-to-audio',     icon:Music,            label:'Video to Audio',       color:'#f97316', studio:'Media', category:'Media', desc:'Extract pure uncompressed WAV soundtrack from any video file.' },
  { id:'audio-trimmer',      icon:Scissors,         label:'Audio Trimmer',        color:'#3b82f6', studio:'Media', category:'Media', desc:'Losslessly cut and slice audio clips with waveform scrubber.' },
  { id:'voice-recorder',     icon:Mic,              label:'Voice Recorder',       color:'#10b981', studio:'Media', category:'Media', desc:'Record voice notes directly with real-time speed controls.' },

  // Developer Studio (8 tools)
  { id:'json-formatter',     icon:FileJson,         label:'JSON Formatter',       color:'#3b82f6', studio:'Developer', category:'Developer', desc:'Validate, format, indent, or minify JSON data in real time.' },
  { id:'json-to-csv',        icon:Table,            label:'JSON ⇄ CSV',           color:'#0ea5e9', studio:'Developer', category:'Developer', desc:'Bidirectional converter between JSON arrays and CSV tables.' },
  { id:'base64',             icon:Binary,           label:'Base64 Tool',          color:'#8b5cf6', studio:'Developer', category:'Developer', desc:'Encode and decode text or files to Base64 data URLs.' },
  { id:'jwt-debugger',       icon:KeyRound,         label:'JWT Debugger',         color:'#ec4899', studio:'Developer', category:'Developer', desc:'Decode and verify JSON Web Token claims and expiry.' },
  { id:'regex-tester',       icon:Code,             label:'Regex Tester',         color:'#10b981', studio:'Developer', category:'Developer', desc:'Test regular expressions with real-time match group detection.' },
  { id:'hash-generator',     icon:Hash,             label:'Hash Generator',       color:'#f59e0b', studio:'Developer', category:'Developer', desc:'Generate SHA-256, MD5, SHA-1, and SHA-512 cryptographic checksums.' },
  { id:'uuid-generator',     icon:Cpu,              label:'UUID Generator',       color:'#6366f1', studio:'Developer', category:'Developer', desc:'Generate RFC-4122 v4 UUIDs and compact NanoIDs in bulk.' },
  { id:'css-shadow',         icon:Sparkles,         label:'CSS Box Shadow',       color:'#06b6d4', studio:'Developer', category:'Developer', desc:'Interactive box-shadow and elevation code generator.' },

  // Text & Docs Studio (5 tools)
  { id:'text-diff',          icon:FileDiff,         label:'Text Diff Checker',    color:'#ef4444', studio:'Text', category:'Text', desc:'Side-by-side visual difference comparison between text versions.' },
  { id:'markdown-live',      icon:BookOpen,         label:'Markdown Live',        color:'#059669', studio:'Text', category:'Text', desc:'Live Markdown editor with split HTML preview and export.' },
  { id:'case-converter',     icon:Type,             label:'Case Converter',       color:'#3b82f6', studio:'Text', category:'Text', desc:'Convert to camelCase, snake_case, kebab-case, Title Case, etc.' },
  { id:'text-counter',       icon:AlignLeft,        label:'Word & Density Counter',color:'#8b5cf6',studio:'Text', category:'Text', desc:'Count words, characters, lines, and analyze reading time & density.' },
  { id:'lorem-generator',    icon:FileText,         label:'Lorem Ipsum',          color:'#64748b', studio:'Text', category:'Text', desc:'Generate custom paragraphs, sentences, and words of dummy text.' },

  // Security & Privacy Studio (4 tools)
  { id:'aes-encrypt',        icon:Lock,             label:'AES-256 Encryptor',    color:'#dc2626', studio:'Security', category:'Security', desc:'Client-side zero-knowledge AES-256 file encryption with password.' },
  { id:'steganography',      icon:EyeOff,           label:'Steganography',        color:'#7c3aed', studio:'Security', category:'Security', desc:'Hide secret confidential text invisibly inside image pixels.' },
  { id:'password-generator', icon:Key,              label:'Password Generator',   color:'#10b981', studio:'Security', category:'Security', desc:'Generate military-grade passwords with entropy strength meter.' },
  { id:'strip-exif',         icon:ShieldCheck,      label:'Strip EXIF Metadata',  color:'#f59e0b', studio:'Security', category:'Security', desc:'Wipe GPS, camera details, and device tracking tags from photos.' },

  // Voice & Speech Studio (3 tools)
  { id:'text-to-speech',     icon:Volume2,          label:'Text-to-Speech (TTS)', color:'#10b981', studio:'Voice', category:'Voice', desc:'Natural voice speech reader with custom speed, pitch, and accents.' },
  { id:'speech-to-text',     icon:Mic,              label:'Speech-to-Text Voice', color:'#ef4444', studio:'Voice', category:'Voice', desc:'Transcribe microphone speech into editable text in real time.' },
  { id:'white-noise',        icon:Wind,             label:'Ambient Sound Machine',color:'#06b6d4', studio:'Voice', category:'Voice', desc:'Acoustic white, pink, and brown noise generator for deep focus & sleep.' },

  // Barcode & Smart Codes (4 tools)
  { id:'barcode-generator',  icon:Barcode,          label:'Barcode Generator',    color:'#0ea5e9', studio:'Barcode', category:'Barcode', desc:'Generate 1D barcodes (Code 128, Code 39) with custom dimensions.' },
  { id:'qr-scanner',         icon:Camera,           label:'Camera & Image QR Scan',color:'#f59e0b', studio:'Barcode', category:'Barcode', desc:'Scan and decode QR codes live via camera or image drop.' },
  { id:'wifi-qr',            icon:Wifi,             label:'WiFi Instant Connect QR',color:'#8b5cf6',studio:'Barcode', category:'Barcode', desc:'One-scan WiFi auto-connection QR code for homes and offices.' },
  { id:'vcard-qr',           icon:Contact,          label:'vCard Contact Card QR',color:'#6366f1', studio:'Barcode', category:'Barcode', desc:'Digital business card QR that saves contact info to phones.' },

  // Design & Visual Graphics (5 tools)
  { id:'color-picker',       icon:Pipette,          label:'Screen Eyedropper',    color:'#ec4899', studio:'Design', category:'Design', desc:'Pick any pixel color from your screen with RGB/HEX conversion.' },
  { id:'gradient-generator', icon:Palette,          label:'CSS Gradient Designer',color:'#8b5cf6', studio:'Design', category:'Design', desc:'Design multi-stop linear and radial CSS gradients with 1-click code.' },
  { id:'aspect-cropper',     icon:Crop,             label:'Aspect Ratio Cropper', color:'#f97316', studio:'Design', category:'Design', desc:'Crop images perfectly for 1:1, 16:9, and 9:16 social formats.' },
  { id:'photo-collage',      icon:LayoutGrid,       label:'Photo Grid Collage',   color:'#10b981', studio:'Design', category:'Design', desc:'Combine 2 to 4 photos into uniform grid layouts with spacing.' },
  { id:'whiteboard',         icon:PenTool,          label:'Quick Whiteboard',     color:'#3b82f6', studio:'Design', category:'Design', desc:'Freehand drawing scratchpad with pencil, eraser, and PNG export.' },

  // Audio & Acoustics (3 tools)
  { id:'tone-generator',     icon:Activity,         label:'Tone Generator',       color:'#f59e0b', studio:'Acoustics', category:'Acoustics', desc:'Precision audio frequency sound wave generator and 440Hz tuner.' },
  { id:'metronome',          icon:Music,            label:'Metronome & Tap Tempo',color:'#06b6d4', studio:'Acoustics', category:'Acoustics', desc:'Audible tempo metronome with visual beats and tap tempo calculator.' },
  { id:'audio-reverser',     icon:RotateCcw,        label:'Audio Reverser',       color:'#ef4444', studio:'Acoustics', category:'Acoustics', desc:'Play sound tracks backward and export reversed WAV audio.' },

  // Web & Network (3 tools)
  { id:'url-parser',         icon:Globe,            label:'URL & Params Editor',  color:'#0ea5e9', studio:'Web', category:'Web', desc:'Inspect URL components and edit query parameters with live rebuild.' },
  { id:'code-formatter',     icon:Code,             label:'Code Formatter',       color:'#6366f1', studio:'Web', category:'Web', desc:'Beautify and minify HTML, CSS, and JavaScript code in your browser.' },
  { id:'device-diagnostics', icon:Laptop,           label:'Device Diagnostics',   color:'#10b981', studio:'Web', category:'Web', desc:'Hardware report: screen DPI, GPU renderer, battery, and CPU cores.' },

  // Everyday Productivity (5 tools)
  { id:'pomodoro-timer',     icon:Timer,            label:'Pomodoro Focus Timer', color:'#ef4444', studio:'Productivity', category:'Productivity', desc:'25-minute focus intervals and breaks with audio chime alerts.' },
  { id:'epoch-converter',    icon:Clock,            label:'UNIX Timestamp Converter',color:'#3b82f6',studio:'Productivity', category:'Productivity', desc:'Convert timestamps to human dates and human dates to epoch.' },
  { id:'unit-converter',     icon:Scale,            label:'Universal Unit Converter',color:'#f59e0b',studio:'Productivity', category:'Productivity', desc:'Convert length, weight, temperature, data storage, and speed.' },
  { id:'screen-calculator',  icon:Monitor,          label:'Screen PPI Calculator',color:'#8b5cf6', studio:'Productivity', category:'Productivity', desc:'Calculate reduced aspect ratios and screen pixel density (PPI).' },
  { id:'decision-maker',     icon:Dices,            label:'Decision Maker & Dice',color:'#ec4899', studio:'Productivity', category:'Productivity', desc:'Fair random choice wheel spinner, coin flipper, and dice roller.' },
]

const TOOL_COMPONENTS = {
  // PDF
  edit: EditTool,
  merge: MergeTool,
  split: SplitTool,
  'delete-pages': DeletePagesTool,
  extract: ExtractTool,
  reorder: ReorderTool,
  rotate: RotateTool,
  'pdf-to-images': PdfToImagesTool,
  'images-to-pdf': ImagesToPdfTool,
  'extract-images': ExtractImagesTool,
  'pdf-to-text': PdfToTextTool,
  ocr: OcrTool,
  sign: SignPdfTool,
  crop: CropPdfTool,
  'page-numbers': PageNumbersTool,
  'n-up': NUpTool,
  resize: ResizePdfTool,
  'qr-code': QrCodeTool,
  booklet: BookletTool,
  compress: CompressTool,
  grayscale: GrayscaleTool,
  'dark-mode': InvertColorsTool,
  flatten: FlattenTool,
  compare: ComparePdfTool,
  metadata: MetadataTool,
  watermark: WatermarkTool,
  protect: ProtectTool,
  unlock: UnlockTool,
  redact: RedactTool,
  'pdf-redact-pro': PdfRedactTool,
  'pdf-clean-blank': PdfCleanBlankTool,
  'pdf-organize': PdfOrganizeTool,
  'pdf-bates': PdfBatesTool,
  'pdf-ink-saver': PdfInkSaverTool,
  'pdf-form-builder': PdfFormBuilderTool,
  'images-to-pdf-pro': ImagesToPdfProTool,
  'pdf-interleave': PdfInterleaveTool,
  'certificate-generator': CertificateGeneratorTool,
  'pdf-cost-calculator': PdfCostCalculatorTool,
  'pdf-duplicate-pages': PdfDuplicateTool,
  'pdf-to-word': PdfToWordTool,
  'word-to-pdf': WordToPdfTool,
  'pdf-to-excel': PdfToExcelTool,
  'pdf-to-markdown': PdfToMarkdownTool,
  'html-to-pdf': HtmlToPdfTool,
  'scan-to-pdf': ScanToPdfTool,
  'pdf-to-pdfa': PdfToPdfATool,
  'repair-pdf': RepairPdfTool,
  'pdf-summarize': PdfSummarizerTool,
  'pdf-translate': PdfTranslateTool,

  // Image Studio
  'compress-image': CompressImageTool,
  'convert-image': ConvertImageTool,
  'favicon-generator': FaviconGeneratorTool,
  'photo-filters': PhotoFiltersTool,
  'meme-generator': MemeGeneratorTool,
  'palette-extractor': PaletteExtractorTool,
  'svg-to-png': SvgRasterizerTool,
  'remove-bg': BackgroundRemoverTool,
  'passport-photo': PassportPhotoTool,
  'image-blur': ImageRedactorTool,
  'image-watermark': ImageWatermarkTool,
  'grid-splitter': GridSplitterTool,
  'exact-resizer': ExactResizerTool,
  'ascii-art': AsciiArtTool,
  'polaroid-maker': PolaroidMakerTool,
  'signature-extractor': SignatureExtractorTool,
  'avatar-maker': CircularAvatarTool,
  'no-crop-square': NoCropSquareTool,
  'batch-renamer': BatchRenamerTool,
  'duotone-fx': DuotoneTool,
  'pixel-art': PixelArtTool,

  // Media Studio
  'screen-recorder': ScreenRecorderTool,
  'video-to-audio': VideoToAudioTool,
  'audio-trimmer': AudioTrimmerTool,
  'voice-recorder': VoiceRecorderTool,

  // Developer Studio
  'json-formatter': JsonFormatterTool,
  'json-to-csv': JsonCsvTool,
  base64: Base64Tool,
  'jwt-debugger': JwtDebuggerTool,
  'regex-tester': RegexTesterTool,
  'hash-generator': HashGeneratorTool,
  'uuid-generator': UuidGeneratorTool,
  'css-shadow': CssShadowTool,

  // Text Studio
  'text-diff': TextDiffTool,
  'markdown-live': MarkdownLiveTool,
  'case-converter': CaseConverterTool,
  'text-counter': TextCounterTool,
  'lorem-generator': LoremGeneratorTool,

  // Security Studio
  'aes-encrypt': AesEncryptTool,
  steganography: SteganographyTool,
  'password-generator': PasswordGeneratorTool,
  'strip-exif': ExifStripperTool,

  // Voice Studio
  'text-to-speech': TextToSpeechTool,
  'speech-to-text': SpeechToTextTool,
  'white-noise': WhiteNoiseTool,

  // Barcode Studio
  'barcode-generator': BarcodeGeneratorTool,
  'qr-scanner': QrScannerTool,
  'wifi-qr': WifiQrTool,
  'vcard-qr': VCardQrTool,

  // Design Studio
  'color-picker': ColorPickerTool,
  'gradient-generator': GradientGeneratorTool,
  'aspect-cropper': AspectCropperTool,
  'photo-collage': PhotoCollageTool,
  whiteboard: WhiteboardTool,

  // Acoustics Studio
  'tone-generator': ToneGeneratorTool,
  metronome: MetronomeTool,
  'audio-reverser': AudioReverserTool,

  // Web Studio
  'url-parser': UrlParserTool,
  'code-formatter': CodeFormatterTool,
  'device-diagnostics': DeviceDiagnosticsTool,

  // Productivity Studio
  'pomodoro-timer': PomodoroTimerTool,
  'epoch-converter': EpochConverterTool,
  'unit-converter': UnitConverterTool,
  'screen-calculator': ScreenCalculatorTool,
  'decision-maker': DecisionMakerTool,
}

const CATEGORIES = [
  'All', 'PDF', 'Image', 'Media', 'Developer', 'Text',
  'Security', 'Voice', 'Barcode', 'Design', 'Acoustics', 'Web', 'Productivity'
]

export default function Tools() {
  const { toolId } = useParams()
  const navigate = useNavigate()
  const [activeCat, setActiveCat] = useState('All')
  const [activeTool, setActiveTool] = useState(toolId || null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (toolId && TOOL_COMPONENTS[toolId]) {
      setActiveTool(toolId)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (!toolId) {
      setActiveTool(null)
    }
  }, [toolId])

  const filtered = TOOL_DEFS.filter(tool => {
    const matchCat = activeCat === 'All' || tool.studio === activeCat || tool.category === activeCat
    const matchSearch = !searchQuery.trim() ||
      tool.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tool.studio && tool.studio.toLowerCase().includes(searchQuery.toLowerCase())) ||
      tool.category.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCat && matchSearch
  })

  const ToolUI = activeTool ? TOOL_COMPONENTS[activeTool] : null

  return (
    <div className={styles.page}>
      <Navbar variant="app" />
      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>Omni Super-Suite</span>
            <span className={styles.toolCount}>{TOOL_DEFS.length}</span>
          </div>
          <div className={styles.searchWrap}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search 80+ free tools..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={styles.cats}>
            {CATEGORIES.map(c => (
              <button key={c} className={`${styles.catBtn} ${activeCat===c?styles.catActive:''}`} onClick={()=>setActiveCat(c)}>{c}</button>
            ))}
          </div>
          <div className={styles.toolList}>
            {filtered.map(tool => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.id}
                  className={`${styles.toolListItem} ${activeTool===tool.id?styles.toolListActive:''}`}
                  onClick={() => {
                    setActiveTool(tool.id)
                    navigate(`/tools/${tool.id}`)
                  }}
                >
                  <div className={styles.toolListIcon} style={{ background: tool.color+'18' }}>
                    <Icon size={15} style={{ color: tool.color }} />
                  </div>
                  <div className={styles.toolListInfo}>
                    <span className={styles.toolListName}>{tool.label}</span>
                    <span className={styles.toolListCat}>{tool.studio || tool.category}</span>
                  </div>
                  <ChevronRight size={12} className={styles.toolListArrow}/>
                </button>
              )
            })}
          </div>
        </div>

        <div className={styles.content}>
          {ToolUI
            ? <>
                <button
                  className={styles.backBtn}
                  onClick={() => {
                    setActiveTool(null)
                    navigate('/tools')
                  }}
                >
                  <ArrowLeft size={14}/> All tools ({TOOL_DEFS.length})
                </button>
                <ToolUI />
              </>
            : (
              <div className={styles.toolGrid}>
                <div className={styles.toolGridHeader}>
                  <h1 className={styles.toolGridTitle}>All 80+ Super-Suite Tools</h1>
                  <p className={styles.toolGridSub}>80 world-class utilities across PDF, Image, Media, Voice, Barcodes, Design, Developer, Text, Security, and Productivity — 100% free, zero cost, and runs entirely in your browser.</p>
                </div>
                <div className={styles.cards}>
                  {filtered.map(tool => {
                    const Icon = tool.icon
                    return (
                      <div
                        key={tool.id}
                        className={styles.toolCard}
                        onClick={() => {
                          setActiveTool(tool.id)
                          navigate(`/tools/${tool.id}`)
                        }}
                      >
                        <div className={styles.toolCardIcon} style={{ background: tool.color+'18' }}>
                          <Icon size={22} style={{ color: tool.color }} />
                        </div>
                        <div className={styles.toolCardName}>{tool.label}</div>
                        <div className={styles.toolCardDesc}>{tool.desc}</div>
                        <span className={styles.freeBadge}>{tool.studio || 'Free'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}
