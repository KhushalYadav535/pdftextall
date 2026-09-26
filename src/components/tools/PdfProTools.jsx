import React, { useState, useEffect, useRef } from 'react'
import {
  Upload, Download, ShieldAlert, Sparkles, Trash2, ArrowLeft, ArrowRight,
  RotateCw, Check, Layers, FileText, CheckSquare, Sliders, RefreshCw,
  Hash, Scissors, Plus, Eye
} from 'lucide-react'
import toast from 'react-hot-toast'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, rgb } from 'pdf-lib'
import {
  detectBlankPages, removeBlankPages, applyTrueRedactions,
  applyBatesStamping, applyInkSaverDither, addInteractiveFormFields,
  imagesToPdfPro
} from '../../lib/pdfProEngine.js'
import styles from './StudioTools.module.css'

/* ─────────────────────────────────────────────────────────────
   1. PDF Redaction / Permanent Blackout Censor
───────────────────────────────────────────────────────────── */
export function PdfRedactTool() {
  const [file, setFile] = useState(null)
  const [arrayBuffer, setArrayBuffer] = useState(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [boxes, setBoxes] = useState([]) // [{ x, y, width, height, normalized }]
  const [drawing, setDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentBox, setCurrentBox] = useState(null)
  const [loading, setLoading] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const canvasRef = useRef(null)

  const handleFile = async (e) => {
    const f = e.target?.files?.[0] || e.dataTransfer?.files?.[0]
    if (!f) return
    setFile(f)
    setBoxes([])
    setDownloadUrl(null)
    const buf = await f.arrayBuffer()
    setArrayBuffer(buf)
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) })
    const pdf = await loadingTask.promise
    setPdfDoc(pdf)
    setNumPages(pdf.numPages)
    setCurrentPage(1)
  }

  // Render current page to canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return
    let active = true

    pdfDoc.getPage(currentPage).then((page) => {
      if (!active) return
      const viewport = page.getViewport({ scale: 1.2 })
      const canvas = canvasRef.current
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')

      page.render({ canvasContext: ctx, viewport }).promise.then(() => {
        if (!active) return
        // Draw drawn boxes for this page
        boxes
          .filter((b) => b.pageNum === currentPage)
          .forEach((b) => {
            ctx.fillStyle = '#000000'
            ctx.fillRect(b.x * canvas.width, b.y * canvas.height, b.width * canvas.width, b.height * canvas.height)
          })
      })
    })

    return () => { active = false }
  }, [pdfDoc, currentPage, boxes])

  const getCanvasPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    }
  }

  const onMouseDown = (e) => {
    if (!pdfDoc) return
    setStartPos(getCanvasPos(e))
    setDrawing(true)
  }

  const onMouseMove = (e) => {
    if (!drawing) return
    const pos = getCanvasPos(e)
    setCurrentBox({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y)
    })
  }

  const onMouseUp = () => {
    if (drawing && currentBox && currentBox.width > 0.01 && currentBox.height > 0.01) {
      setBoxes([...boxes, { ...currentBox, pageNum: currentPage, normalized: true }])
    }
    setDrawing(false)
    setCurrentBox(null)
  }

  const handleApply = async () => {
    if (!arrayBuffer || boxes.length === 0) {
      toast('Please draw at least one blackout rectangle on the PDF', { icon: 'ℹ️' })
      return
    }
    setLoading(true)
    try {
      // Group boxes by page
      const pageMap = {}
      boxes.forEach((b) => {
        if (!pageMap[b.pageNum]) pageMap[b.pageNum] = []
        pageMap[b.pageNum].push(b)
      })
      const redactionList = Object.keys(pageMap).map((p) => ({
        pageNum: Number(p),
        boxes: pageMap[p]
      }))

      const newPdfBytes = await applyTrueRedactions(arrayBuffer, redactionList)
      const blob = new Blob([newPdfBytes], { type: 'application/pdf' })
      setDownloadUrl(URL.createObjectURL(blob))
      toast.success('True redaction baked in — text underneath is gone!')
    } catch (err) {
      toast.error('Redaction error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <ShieldAlert size={20} className={styles.toolIcon} />
        <div>
          <h3>PDF Permanent Blackout Redactor</h3>
          <p>Permanently black out sensitive text, passwords, bank accounts, or Aadhaar numbers on PDF pages.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label
            className={styles.dropZone}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              handleFile(e)
            }}
          >
            <Upload size={32} />
            <span>Drop PDF here to redact</span>
            <input type="file" accept="application/pdf" onChange={handleFile} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className={styles.secondaryBtn}
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  style={{ padding: '6px 10px' }}
                >
                  <ArrowLeft size={14} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Page {currentPage} of {numPages}</span>
                <button
                  className={styles.secondaryBtn}
                  disabled={currentPage >= numPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  style={{ padding: '6px 10px' }}
                >
                  <ArrowRight size={14} />
                </button>
              </div>

              <button className={styles.secondaryBtn} onClick={() => setBoxes([])}>
                <Trash2 size={15} /> Clear Marks ({boxes.length})
              </button>

              <button className={styles.primaryBtn} onClick={handleApply} disabled={loading || boxes.length === 0}>
                <ShieldAlert size={16} />
                {loading ? 'Redacting...' : 'Bake Redactions'}
              </button>
            </div>

            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                👉 <strong>Drag your mouse on the PDF page</strong> to draw black redaction boxes:
              </p>
              <div style={{ display: 'inline-block', position: 'relative', border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
                <canvas
                  ref={canvasRef}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  style={{ maxHeight: 500, maxWidth: '100%', cursor: 'crosshair', display: 'block' }}
                />
                {currentBox && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${currentBox.x * 100}%`,
                      top: `${currentBox.y * 100}%`,
                      width: `${currentBox.width * 100}%`,
                      height: `${currentBox.height * 100}%`,
                      backgroundColor: 'rgba(0,0,0,0.85)',
                      border: '1px solid red',
                      pointerEvents: 'none'
                    }}
                  />
                )}
              </div>
            </div>

            {downloadUrl && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <a href={downloadUrl} download="redacted-document.pdf" className={styles.downloadBtn}>
                  <Download size={16} /> Download Permanently Redacted PDF
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   2. PDF Blank Page Auto-Detector & Cleaner
───────────────────────────────────────────────────────────── */
export function PdfCleanBlankTool() {
  const [file, setFile] = useState(null)
  const [arrayBuffer, setArrayBuffer] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState('')
  const [blankPages, setBlankPages] = useState(null)
  const [totalPages, setTotalPages] = useState(0)
  const [selectedToDelete, setSelectedToDelete] = useState([])
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [cleaning, setCleaning] = useState(false)

  const handleFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setBlankPages(null)
    setDownloadUrl(null)
    const buf = await f.arrayBuffer()
    setArrayBuffer(buf)
  }

  const handleScan = async () => {
    if (!arrayBuffer) return
    setScanning(true)
    try {
      const { blankPages: detected, totalPages: total } = await detectBlankPages(
        arrayBuffer,
        0.002,
        (current, max) => setScanProgress(`Analyzing page ${current} of ${max}...`)
      )
      setBlankPages(detected)
      setTotalPages(total)
      setSelectedToDelete(detected)
      if (detected.length === 0) {
        toast('No completely blank pages detected!', { icon: '✅' })
      } else {
        toast.success(`Found ${detected.length} blank page(s)!`)
      }
    } catch (err) {
      toast.error('Scan error: ' + err.message)
    } finally {
      setScanning(false)
    }
  }

  const handleRemove = async () => {
    if (!arrayBuffer || selectedToDelete.length === 0) return
    setCleaning(true)
    try {
      const cleanBytes = await removeBlankPages(arrayBuffer, selectedToDelete)
      const blob = new Blob([cleanBytes], { type: 'application/pdf' })
      setDownloadUrl(URL.createObjectURL(blob))
      toast.success(`Removed ${selectedToDelete.length} blank page(s)!`)
    } catch (err) {
      toast.error('Error removing pages: ' + err.message)
    } finally {
      setCleaning(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Scissors size={20} className={styles.toolIcon} />
        <div>
          <h3>PDF Blank Page Auto-Cleaner</h3>
          <p>Scan PDF for empty scanner pages and remove them automatically with 1 click.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop scanned PDF here</span>
            <input type="file" accept="application/pdf" onChange={handleFile} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <span style={{ fontSize: 13, color: '#64748b' }}>
                File: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(0)} KB)
              </span>

              <button className={styles.primaryBtn} onClick={handleScan} disabled={scanning}>
                <RefreshCw size={16} className={scanning ? styles.spinning : ''} />
                {scanning ? scanProgress : 'Auto-Scan for Blank Pages'}
              </button>
            </div>

            {blankPages !== null && (
              <div style={{ marginTop: 16 }}>
                {blankPages.length === 0 ? (
                  <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, color: '#166534', textAlign: 'center' }}>
                    ✅ Great news! All {totalPages} pages contain real content. No blank pages found.
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
                      Found {blankPages.length} Blank Page(s) out of {totalPages}:
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
                      {blankPages.map((pageNum) => (
                        <label
                          key={pageNum}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            background: selectedToDelete.includes(pageNum) ? '#fee2e2' : '#f1f5f9',
                            border: `1px solid ${selectedToDelete.includes(pageNum) ? '#ef4444' : '#cbd5e1'}`,
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 13
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedToDelete.includes(pageNum)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedToDelete([...selectedToDelete, pageNum])
                              else setSelectedToDelete(selectedToDelete.filter((p) => p !== pageNum))
                            }}
                          />
                          Page {pageNum}
                        </label>
                      ))}
                    </div>

                    <button
                      className={styles.primaryBtn}
                      onClick={handleRemove}
                      disabled={cleaning || selectedToDelete.length === 0}
                    >
                      <Trash2 size={16} />
                      {cleaning ? 'Cleaning...' : `Delete Selected Blank Pages (${selectedToDelete.length})`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {downloadUrl && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <a href={downloadUrl} download={`cleaned-${file.name}`} className={styles.downloadBtn}>
                  <Download size={16} /> Download Cleaned PDF
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   3. Visual Drag-and-Drop Page Arranger
───────────────────────────────────────────────────────────── */
export function PdfOrganizeTool() {
  const [file, setFile] = useState(null)
  const [arrayBuffer, setArrayBuffer] = useState(null)
  const [pages, setPages] = useState([]) // [{ originalIndex, rotation, thumbUrl }]
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState(null)

  const handleFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setDownloadUrl(null)
    setLoading(true)
    try {
      const buf = await f.arrayBuffer()
      setArrayBuffer(buf)
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) })
      const pdf = await loadingTask.promise
      const numPages = pdf.numPages
      const pageList = []

      for (let i = 1; i <= numPages; i++) {
        const p = await pdf.getPage(i)
        const viewport = p.getViewport({ scale: 0.3 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        await p.render({ canvasContext: ctx, viewport }).promise
        pageList.push({
          id: i,
          originalIndex: i - 1,
          rotation: 0,
          thumbUrl: canvas.toDataURL()
        })
      }
      setPages(pageList)
    } catch (err) {
      toast.error('Failed to load PDF pages: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const movePage = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= pages.length) return
    const updated = [...pages]
    const [moved] = updated.splice(index, 1)
    updated.splice(target, 0, moved)
    setPages(updated)
  }

  const rotatePage = (index) => {
    const updated = [...pages]
    updated[index].rotation = (updated[index].rotation + 90) % 360
    setPages(updated)
  }

  const deletePage = (index) => {
    if (pages.length <= 1) {
      toast.error('A PDF must contain at least 1 page')
      return
    }
    setPages(pages.filter((_, i) => i !== index))
  }

  const handleExport = async () => {
    if (!arrayBuffer || pages.length === 0) return
    setExporting(true)
    try {
      const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
      const outDoc = await PDFDocument.create()

      for (const p of pages) {
        const [copied] = await outDoc.copyPages(srcDoc, [p.originalIndex])
        if (p.rotation) {
          copied.setRotation({ angle: (copied.getRotation().angle + p.rotation) % 360 })
        }
        outDoc.addPage(copied)
      }

      const outBytes = await outDoc.save()
      const blob = new Blob([outBytes], { type: 'application/pdf' })
      setDownloadUrl(URL.createObjectURL(blob))
      toast.success('Organized PDF exported!')
    } catch (err) {
      toast.error('Export error: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Layers size={20} className={styles.toolIcon} />
        <div>
          <h3>Visual PDF Page Arranger & Organizer</h3>
          <p>Reorder, rotate, or delete individual pages visually using an interactive thumbnail grid.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop PDF to visually organize pages</span>
            <input type="file" accept="application/pdf" onChange={handleFile} hidden />
          </label>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <RefreshCw size={24} className={styles.spinning} />
            <p style={{ marginTop: 8 }}>Rendering page thumbnails...</p>
          </div>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <span style={{ fontSize: 13, color: '#64748b' }}>
                Total Pages: <strong>{pages.length}</strong>
              </span>

              <button className={styles.primaryBtn} onClick={handleExport} disabled={exporting}>
                <Check size={16} />
                {exporting ? 'Saving PDF...' : 'Save & Download Reorganized PDF'}
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 16,
              marginTop: 16
            }}>
              {pages.map((p, idx) => (
                <div
                  key={p.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: 8,
                    textAlign: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{ overflow: 'hidden', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img
                      src={p.thumbUrl}
                      alt={`Page ${idx + 1}`}
                      style={{
                        maxHeight: '100%',
                        maxWidth: '100%',
                        transform: `rotate(${p.rotation}deg)`,
                        transition: 'transform 0.2s ease'
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginTop: 6 }}>
                    Page {idx + 1}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 6 }}>
                    <button
                      className={styles.secondaryBtn}
                      disabled={idx === 0}
                      onClick={() => movePage(idx, -1)}
                      title="Move Left"
                      style={{ padding: '4px 6px' }}
                    >
                      <ArrowLeft size={12} />
                    </button>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => rotatePage(idx)}
                      title="Rotate 90°"
                      style={{ padding: '4px 6px' }}
                    >
                      <RotateCw size={12} />
                    </button>
                    <button
                      className={styles.secondaryBtn}
                      disabled={idx === pages.length - 1}
                      onClick={() => movePage(idx, 1)}
                      title="Move Right"
                      style={{ padding: '4px 6px' }}
                    >
                      <ArrowRight size={12} />
                    </button>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => deletePage(idx)}
                      title="Delete Page"
                      style={{ padding: '4px 6px', color: '#ef4444' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {downloadUrl && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <a href={downloadUrl} download="reordered-document.pdf" className={styles.downloadBtn}>
                  <Download size={16} /> Download Reorganized PDF
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   4. PDF Bates Stamping & Header/Footer
───────────────────────────────────────────────────────────── */
export function PdfBatesTool() {
  const [file, setFile] = useState(null)
  const [prefix, setPrefix] = useState('DOC-')
  const [startNum, setStartNum] = useState(1)
  const [digits, setDigits] = useState(6)
  const [headerText, setHeaderText] = useState('CONFIDENTIAL - DO NOT DISTRIBUTE')
  const [footerText, setFooterText] = useState('')
  const [position, setPosition] = useState('bottom-right')
  const [includeTotal, setIncludeTotal] = useState(true)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleApply = async () => {
    if (!file) return
    setLoading(true)
    try {
      const buf = await file.arrayBuffer()
      const newBytes = await applyBatesStamping(buf, {
        prefix,
        startNumber: startNum,
        digits,
        headerText,
        footerText,
        position,
        includeTotal
      })
      const blob = new Blob([newBytes], { type: 'application/pdf' })
      setDownloadUrl(URL.createObjectURL(blob))
      toast.success('Bates numbers & headers stamped!')
    } catch (err) {
      toast.error('Bates stamping error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Hash size={20} className={styles.toolIcon} />
        <div>
          <h3>PDF Legal Bates Stamping & Header/Footer</h3>
          <p>Add legal Bates numbering (DOC-000001), confidential headers, and page numbers across all pages.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop PDF to add Bates numbers or headers</span>
            <input type="file" accept="application/pdf" onChange={(e) => { setFile(e.target.files?.[0]); setDownloadUrl(null); }} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <div className={styles.inputGroup}>
                <label>Prefix:</label>
                <input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)} style={{ width: 100 }} />
              </div>

              <div className={styles.inputGroup}>
                <label>Start #:</label>
                <input type="number" value={startNum} onChange={(e) => setStartNum(Number(e.target.value))} style={{ width: 80 }} />
              </div>

              <div className={styles.inputGroup}>
                <label>Digits (Padding):</label>
                <input type="number" value={digits} onChange={(e) => setDigits(Number(e.target.value))} style={{ width: 70 }} />
              </div>

              <div className={styles.inputGroup}>
                <label>Bates Position:</label>
                <select value={position} onChange={(e) => setPosition(e.target.value)}>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-center">Bottom Center</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-center">Top Center</option>
                </select>
              </div>

              <div className={styles.inputGroup} style={{ flex: 2 }}>
                <label>Document Header Text:</label>
                <input type="text" value={headerText} onChange={(e) => setHeaderText(e.target.value)} />
              </div>

              <button className={styles.primaryBtn} onClick={handleApply} disabled={loading}>
                <Hash size={16} />
                {loading ? 'Stamping...' : 'Stamp Bates & Headers'}
              </button>
            </div>

            {downloadUrl && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <a href={downloadUrl} download={`bates-stamped-${file.name}`} className={styles.downloadBtn}>
                  <Download size={16} /> Download Bates Stamped PDF
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   5. PDF Ink Saver / 1-Bit B&W Dither
───────────────────────────────────────────────────────────── */
export function PdfInkSaverTool() {
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState('')
  const [loading, setLoading] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState(null)

  const handleProcess = async () => {
    if (!file) return
    setLoading(true)
    try {
      const buf = await file.arrayBuffer()
      const cleanBytes = await applyInkSaverDither(buf, (curr, max) => {
        setProgress(`Processing page ${curr} of ${max}...`)
      })
      const blob = new Blob([cleanBytes], { type: 'application/pdf' })
      setDownloadUrl(URL.createObjectURL(blob))
      toast.success('PDF converted to Ink-Saving High Contrast monochrome!')
    } catch (err) {
      toast.error('Ink saver error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <FileText size={20} className={styles.toolIcon} />
        <div>
          <h3>PDF Ink Saver (80% Cartridge Saver)</h3>
          <p>Remove heavy dark backgrounds and colored graphics into high-contrast black & white pages for printer economy.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop PDF to convert for ink saving</span>
            <input type="file" accept="application/pdf" onChange={(e) => { setFile(e.target.files?.[0]); setDownloadUrl(null); }} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <span style={{ fontSize: 13, color: '#64748b' }}>
                File: <strong>{file.name}</strong>
              </span>

              <button className={styles.primaryBtn} onClick={handleProcess} disabled={loading}>
                <RefreshCw size={16} className={loading ? styles.spinning : ''} />
                {loading ? progress : 'Convert to Ink Saver PDF'}
              </button>
            </div>

            {downloadUrl && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <a href={downloadUrl} download={`ink-saver-${file.name}`} className={styles.downloadBtn}>
                  <Download size={16} /> Download Ink-Saved PDF
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   6. PDF Interactive Form Field Builder
───────────────────────────────────────────────────────────── */
export function PdfFormBuilderTool() {
  const [file, setFile] = useState(null)
  const [fields, setFields] = useState([
    { name: 'full_name', type: 'text', pageNum: 1, x: 100, y: 150, width: 200, height: 24, defaultValue: '' },
    { name: 'agree_terms', type: 'checkbox', pageNum: 1, x: 100, y: 100, width: 20, height: 20, defaultChecked: false }
  ])
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const addField = (type) => {
    const id = fields.length + 1
    if (type === 'checkbox') {
      setFields([...fields, { name: `check_${id}`, type: 'checkbox', pageNum: 1, x: 100, y: 100 + id * 30, width: 20, height: 20, defaultChecked: false }])
    } else {
      setFields([...fields, { name: `input_${id}`, type: 'text', pageNum: 1, x: 100, y: 100 + id * 30, width: 200, height: 24, defaultValue: '' }])
    }
  }

  const handleApply = async () => {
    if (!file) return
    setLoading(true)
    try {
      const buf = await file.arrayBuffer()
      const newBytes = await addInteractiveFormFields(buf, fields)
      const blob = new Blob([newBytes], { type: 'application/pdf' })
      setDownloadUrl(URL.createObjectURL(blob))
      toast.success('Fillable AcroForm fields added!')
    } catch (err) {
      toast.error('Form builder error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <CheckSquare size={20} className={styles.toolIcon} />
        <div>
          <h3>PDF Interactive Form Builder</h3>
          <p>Add fillable text fields, checkboxes, and interactive AcroForm inputs onto any PDF page.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop PDF to add fillable form inputs</span>
            <input type="file" accept="application/pdf" onChange={(e) => { setFile(e.target.files?.[0]); setDownloadUrl(null); }} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <button className={styles.secondaryBtn} onClick={() => addField('text')}>
                <Plus size={15} /> Add Text Field
              </button>
              <button className={styles.secondaryBtn} onClick={() => addField('checkbox')}>
                <Plus size={15} /> Add Checkbox
              </button>
              <button className={styles.primaryBtn} onClick={handleApply} disabled={loading}>
                <Check size={16} />
                {loading ? 'Building Form...' : 'Generate Fillable PDF'}
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>Form Fields List ({fields.length}):</p>
              {fields.map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: 8,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    marginBottom: 6,
                    fontSize: 13
                  }}
                >
                  <span style={{ fontWeight: 600, textTransform: 'uppercase', color: '#64748b' }}>{f.type}</span>
                  <input
                    type="text"
                    value={f.name}
                    onChange={(e) => {
                      const upd = [...fields]
                      upd[i].name = e.target.value
                      setFields(upd)
                    }}
                    placeholder="Field name"
                    style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
                  />
                  <span>Page:</span>
                  <input
                    type="number"
                    value={f.pageNum}
                    onChange={(e) => {
                      const upd = [...fields]
                      upd[i].pageNum = Number(e.target.value)
                      setFields(upd)
                    }}
                    style={{ width: 50, padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
                  />
                  <span>X:</span>
                  <input
                    type="number"
                    value={f.x}
                    onChange={(e) => {
                      const upd = [...fields]
                      upd[i].x = Number(e.target.value)
                      setFields(upd)
                    }}
                    style={{ width: 60, padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
                  />
                  <span>Y:</span>
                  <input
                    type="number"
                    value={f.y}
                    onChange={(e) => {
                      const upd = [...fields]
                      upd[i].y = Number(e.target.value)
                      setFields(upd)
                    }}
                    style={{ width: 60, padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1' }}
                  />
                  <button
                    className={styles.secondaryBtn}
                    onClick={() => setFields(fields.filter((_, idx) => idx !== i))}
                    style={{ padding: '4px 8px', color: '#ef4444' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {downloadUrl && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <a href={downloadUrl} download={`fillable-${file.name}`} className={styles.downloadBtn}>
                  <Download size={16} /> Download Fillable AcroForm PDF
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   7. Advanced Multi-Image to PDF Pro
───────────────────────────────────────────────────────────── */
export function ImagesToPdfProTool() {
  const [files, setFiles] = useState([])
  const [pageSize, setPageSize] = useState('a4') // 'a4', 'letter', 'legal', 'original'
  const [orientation, setOrientation] = useState('auto')
  const [margin, setMargin] = useState(20)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFiles = (e) => {
    const list = Array.from(e.target.files || [])
    if (list.length > 0) {
      setFiles((prev) => [...prev, ...list])
      setDownloadUrl(null)
    }
  }

  const handleGenerate = async () => {
    if (files.length === 0) return
    setLoading(true)
    try {
      const pdfBytes = await imagesToPdfPro(files, { pageSize, orientation, margin })
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      setDownloadUrl(URL.createObjectURL(blob))
      toast.success(`Converted ${files.length} images into a PDF!`)
    } catch (err) {
      toast.error('PDF Generation error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Layers size={20} className={styles.toolIcon} />
        <div>
          <h3>Multi-Image to PDF Pro (A4 & Margins)</h3>
          <p>Batch convert photos to clean PDF with custom page size (A4, Letter), margins, and orientation.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        <div className={styles.controlsCol}>
          <div className={styles.settingsRow}>
            <label className={styles.secondaryBtn} style={{ cursor: 'pointer' }}>
              <Upload size={15} /> Add Images ({files.length})
              <input type="file" accept="image/*" multiple onChange={handleFiles} hidden />
            </label>

            <div className={styles.inputGroup}>
              <label>Page Size:</label>
              <select value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
                <option value="a4">A4 Document</option>
                <option value="letter">US Letter</option>
                <option value="legal">US Legal</option>
                <option value="original">Fit Image Size</option>
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label>Orientation:</label>
              <select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
                <option value="auto">Auto (Match Image)</option>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label>Margins ({margin} pt):</label>
              <input
                type="range"
                min="0"
                max="50"
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
              />
            </div>

            <button className={styles.primaryBtn} onClick={handleGenerate} disabled={loading || files.length === 0}>
              <Layers size={16} />
              {loading ? 'Building PDF...' : 'Convert to PDF'}
            </button>
          </div>

          {files.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                {files.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'relative',
                      minWidth: 80,
                      height: 80,
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      overflow: 'hidden',
                      background: '#f8fafc'
                    }}
                  >
                    <img
                      src={URL.createObjectURL(f)}
                      alt={`Upload ${i}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <button
                      onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        background: 'rgba(0,0,0,0.6)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '50%',
                        width: 18,
                        height: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {downloadUrl && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <a href={downloadUrl} download="converted-images.pdf" className={styles.downloadBtn}>
                <Download size={16} /> Download Combined PDF
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
