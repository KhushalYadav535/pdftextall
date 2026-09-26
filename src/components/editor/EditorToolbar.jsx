import React, { useState, useEffect, useRef } from 'react'
import {
  Type, Image as ImageIcon, PenLine, Highlighter,
  Eraser, Square, CheckSquare, Search, Undo2, Redo2,
  ZoomIn, ZoomOut, Download, Scan, Loader2, Bold,
  Italic, Underline, PanelLeft, SlidersHorizontal, Check, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { usePdfStore } from '../../store/pdfStore.js'
import { exportPdf, downloadBytes } from '../../lib/pdfExporter.js'
import { renderPage } from '../../lib/pdfRenderer.js'
import { ocrCanvas } from '../../lib/ocrEngine.js'
import SignatureModal from './SignatureModal.jsx'
import FindReplaceModal from './FindReplaceModal.jsx'
import DropZone from '../ui/DropZone.jsx'
import styles from './EditorToolbar.module.css'

const FONTS = [
  'Arial', 'Helvetica', 'Times New Roman', 'Georgia',
  'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS',
  'Calibri', 'Cambria', 'Garamond', 'Palatino',
]

export default function EditorToolbar() {
  const {
    activeTool, setActiveTool, zoom, setZoom,
    file, editLayers, pageCount, fileName, pageBgs, blockBgs,
    currentPage, addTextBlock, addAnnotation,
    selectedElement, selectedElementPage,
    updateTextBlock, commitExtractedEdit,
    undoEdit, redoEdit,
    mobilePagesOpen, mobilePropertiesOpen,
    setMobilePagesOpen, setMobilePropertiesOpen,
    textItems, pdfPassword,
    formFields, flattenForm, setFlattenForm,
    editorMode, setEditorMode,
  } = usePdfStore()

  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [isSignOpen, setIsSignOpen] = useState(false)
  const [isFindOpen, setIsFindOpen] = useState(false)
  const [formsMenuOpen, setFormsMenuOpen] = useState(false)

  const imageInputRef = useRef(null)

  // Mirror selected element's current formatting in the toolbar
  const sel = selectedElement
  const [fontFamily, setFontFamily] = useState('Arial')
  const [fontSize, setFontSize] = useState(12)
  const [bold, setBold] = useState(false)
  const [italic, setItalic] = useState(false)
  const [underline, setUnderline] = useState(false)
  const [color, setColor] = useState('#0f172a')

  useEffect(() => {
    if (!sel) return
    const rawFamily = sel.fontFamily || 'Arial'
    const match = FONTS.find(f => rawFamily.toLowerCase().includes(f.toLowerCase()))
    setFontFamily(match || 'Arial')
    setFontSize(Math.round(sel.fontSize || 12))
    setBold(sel.fontBold || false)
    setItalic(sel.fontItalic || false)
    setUnderline(sel.fontUnderline || false)
    setColor(sel.color || '#0f172a')
  }, [sel?.id, sel?.fontBold, sel?.fontItalic, sel?.fontSize, sel?.color])

  const applyFormat = (updates) => {
    if (!sel || !selectedElementPage) return
    if (sel.isExtracted && !sel.isEdited) {
      commitExtractedEdit(selectedElementPage, sel, sel.str)
      updateTextBlock(selectedElementPage, `edited-${sel.id}`, updates)
    } else {
      updateTextBlock(selectedElementPage, sel.id, updates)
    }
  }

  const handleFontFamily = (f) => {
    setFontFamily(f)
    const cssMap = {
      'Arial': 'Arial, "Noto Sans", Helvetica, sans-serif',
      'Helvetica': 'Helvetica, Arial, sans-serif',
      'Times New Roman': '"Times New Roman", "Noto Serif", Times, serif',
      'Georgia': 'Georgia, "Noto Serif", serif',
      'Courier New': '"Courier New", Courier, monospace',
      'Verdana': 'Verdana, Arial, sans-serif',
      'Tahoma': 'Tahoma, Arial, sans-serif',
      'Trebuchet MS': '"Trebuchet MS", Arial, sans-serif',
      'Calibri': 'Calibri, Arial, sans-serif',
      'Cambria': 'Cambria, Georgia, serif',
      'Garamond': 'Garamond, Georgia, serif',
      'Palatino': '"Palatino Linotype", Georgia, serif',
    }
    applyFormat({ fontFamily: cssMap[f] || f, fontName: f })
  }

  const handleFontSize = (v) => {
    const n = Math.max(4, Math.min(200, Number(v)))
    setFontSize(n)
    applyFormat({ fontSize: n })
  }

  const handleBold = () => {
    const next = !bold
    setBold(next)
    applyFormat({ fontBold: next })
  }

  const handleItalic = () => {
    const next = !italic
    setItalic(next)
    applyFormat({ fontItalic: next })
  }

  const handleUnderline = () => {
    const next = !underline
    setUnderline(next)
    applyFormat({ fontUnderline: next })
  }

  const handleColor = (v) => {
    setColor(v)
    applyFormat({ color: v })
  }

  const handleUndo = () => {
    if (!undoEdit()) { toast('Nothing to undo'); return }
    toast('Undone', { duration: 800 })
  }

  const handleRedo = () => {
    if (!redoEdit()) { toast('Nothing to redo'); return }
    toast('Redone', { duration: 800 })
  }

  // Handle Export / Download
  const handleExport = async () => {
    if (!file) { toast.error('No PDF loaded'); return }
    // Pre-export sanity: count real edits, flag empties (covered original + no
    // replacement = intentional erase, but the user should know).
    let editCount = 0
    const emptyEdits = []
    for (let p = 1; p <= pageCount; p++) {
      for (const t of editLayers?.[p]?.texts || []) {
        if (t.isEdited || String(t.str || '').trim()) {
          editCount++
          if (!String(t.str || '').trim()) emptyEdits.push(`page ${p}`)
        }
      }
    }
    const annCount = Array.from({ length: pageCount }, (_, i) => (editLayers?.[i + 1]?.annotations || []).length).reduce((a, b) => a + b, 0)
    if (editCount === 0 && annCount === 0 && Object.keys(formFields || {}).length === 0 && !flattenForm) {
      toast.error('No edits yet — double-click any text to edit, then Apply Changes')
      return
    }
    if (emptyEdits.length) {
      toast(`Note: ${emptyEdits.length} cleared text block(s) (${emptyEdits.join(', ')}) will be covered with background on export`, { icon: '🧹', duration: 4000 })
    }
    const tid = toast.loading(`Exporting PDF with ${editCount} text edit(s)...`)
    try {
      const onPageFallback = (pageNum, reason) => {
        toast(`Page ${pageNum} flattened: ${reason}`, { icon: '⚠️', duration: 4500 })
      }
      const bytes = await exportPdf(
        file,
        editLayers,
        pageCount,
        pageBgs,
        blockBgs,
        pdfPassword,
        onPageFallback,
        formFields,
        flattenForm
      )
      downloadBytes(bytes, `edited-${fileName || 'document.pdf'}`)
      toast.success('PDF successfully downloaded!', { id: tid })
      if (pdfPassword) {
        toast('Exported as unprotected PDF (password removed)', { icon: '🔓', duration: 4000 })
      }
    } catch (e) {
      toast.error('Export failed: ' + e.message, { id: tid })
    }
  }

  // Handle OCR for current page
  const handleOcr = async () => {
    if (!file || ocrRunning) return
    setOcrRunning(true)
    setOcrProgress(0)
    const tid = toast.loading('Running OCR on page...')
    try {
      const { canvas } = await renderPage(currentPage, 1.5)
      const words = await ocrCanvas(canvas, pct => {
        setOcrProgress(pct)
        toast.loading(`OCR Recognizing: ${pct}%`, { id: tid })
      })
      if (!words.length) {
        toast.error('No text recognized on this page', { id: tid })
        return
      }
      words.forEach(w => addTextBlock(currentPage, w))
      toast.success(`OCR complete! Added ${words.length} editable words`, { id: tid })
    } catch (e) {
      toast.error('OCR failed: ' + e.message, { id: tid })
    } finally {
      setOcrRunning(false)
      setOcrProgress(0)
    }
  }

  // Image Upload handler
  const handleImageSelect = (e) => {
    const imgFile = e.target.files?.[0]
    if (!imgFile) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
      img.onload = () => {
        const aspect = img.width / img.height
        const targetWidth = Math.min(200, img.width)
        const targetHeight = Math.round(targetWidth / aspect)

        addAnnotation(currentPage, {
          id: `img-${Date.now()}`,
          type: 'image',
          x: 100,
          y: 100,
          width: targetWidth,
          height: targetHeight,
          dataUrl: reader.result,
        })
        toast.success('Image inserted! Drag to position.', { icon: '🖼️' })
      }
      img.src = reader.result
    }
    reader.readAsDataURL(imgFile)
    e.target.value = '' // reset input
  }

  // Signature save handler
  const handleSaveSignature = (dataUrl, width, height) => {
    addAnnotation(currentPage, {
      id: `sign-${Date.now()}`,
      type: 'sign',
      x: 120,
      y: 160,
      width,
      height,
      dataUrl,
    })
    toast.success('Signature added! Drag to position.', { icon: '✍️' })
  }

  const hasSelection = !!sel

  return (
    <div className={styles.toolbarWrapper}>
      <header className={styles.toolbar}>
        {/* Mobile toggle */}
        <button
          className={`${styles.toolBtn} ${styles.mobileOnly} ${mobilePagesOpen ? styles.active : ''}`}
          onClick={() => setMobilePagesOpen(!mobilePagesOpen)}
          title="Pages"
          aria-label="Toggle pages panel"
        >
          <PanelLeft size={16} />
        </button>

        <DropZone compact />
        <div className={styles.sep} />

        {/* Mode Switcher: Edit vs Fill */}
        <div className={styles.modeSwitcher} role="group" aria-label="Editor Mode">
          <button
            type="button"
            className={`${styles.modeBtn} ${editorMode === 'edit' ? styles.modeActive : ''}`}
            onClick={() => setEditorMode('edit')}
            title="Edit Mode: Edit text, add shapes, images, signatures, annotations"
          >
            <Type size={14} />
            <span>Edit</span>
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${editorMode === 'fill' ? styles.modeActiveFill : ''}`}
            onClick={() => setEditorMode('fill')}
            title="Form Fill Mode: Interactively fill form fields (text, checkboxes, radios, dropdowns)"
          >
            <CheckSquare size={14} />
            <span>Fill Form</span>
          </button>
        </div>

        <div className={styles.sep} />

        {/* Primary Sejda-style Actions */}
        <div className={styles.toolGroup}>
          {/* Text Tool */}
          <button
            className={`${styles.toolBtn} ${activeTool === 'text' ? styles.active : ''}`}
            onClick={() => setActiveTool('text')}
            title="Text (Click anywhere to insert or click existing text to edit)"
          >
            <Type size={16} />
            <span className={styles.toolLabel}>Text</span>
          </button>

          {/* Forms Dropdown / Toggle */}
          <div className={styles.relativeWrap}>
            <button
              className={`${styles.toolBtn} ${['check', 'cross'].includes(activeTool) ? styles.active : ''}`}
              onClick={() => setFormsMenuOpen(!formsMenuOpen)}
              title="Forms & Checkmarks"
            >
              <CheckSquare size={16} />
              <span className={styles.toolLabel}>Forms</span>
            </button>

            {formsMenuOpen && (
              <div className={styles.dropdownMenu}>
                <button
                  className={styles.dropdownItem}
                  onClick={() => { setActiveTool('check'); setFormsMenuOpen(false) }}
                >
                  <Check size={16} color="#10b981" strokeWidth={3} />
                  <span>Checkmark (✓)</span>
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={() => { setActiveTool('cross'); setFormsMenuOpen(false) }}
                >
                  <X size={16} color="#ef4444" strokeWidth={3} />
                  <span>Cross (✗)</span>
                </button>
              </div>
            )}
          </div>

          {/* Image Upload */}
          <button
            className={styles.toolBtn}
            onClick={() => imageInputRef.current?.click()}
            title="Add Image or Logo"
          >
            <ImageIcon size={16} />
            <span className={styles.toolLabel}>Images</span>
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            style={{ display: 'none' }}
            onChange={handleImageSelect}
          />

          {/* Signature Tool */}
          <button
            className={styles.toolBtn}
            onClick={() => setIsSignOpen(true)}
            title="Add Signature (Draw, Type, Upload)"
          >
            <PenLine size={16} />
            <span className={styles.toolLabel}>Sign</span>
          </button>

          {/* Whiteout / Eraser */}
          <button
            className={`${styles.toolBtn} ${activeTool === 'whiteout' ? styles.active : ''}`}
            onClick={() => setActiveTool('whiteout')}
            title="Whiteout (Cleanly cover/erase any content)"
          >
            <Eraser size={16} />
            <span className={styles.toolLabel}>Whiteout</span>
          </button>

          {/* Annotate / Highlight */}
          <button
            className={`${styles.toolBtn} ${activeTool === 'highlight' ? styles.active : ''}`}
            onClick={() => setActiveTool('highlight')}
            title="Highlight Text"
          >
            <Highlighter size={16} />
            <span className={styles.toolLabel}>Annotate</span>
          </button>

          {/* Shapes */}
          <button
            className={`${styles.toolBtn} ${['shape', 'rect'].includes(activeTool) ? styles.active : ''}`}
            onClick={() => setActiveTool('shape')}
            title="Shapes (Rectangle)"
          >
            <Square size={16} />
            <span className={styles.toolLabel}>Shapes</span>
          </button>

          {/* Find & Replace */}
          <button
            className={styles.toolBtn}
            onClick={() => setIsFindOpen(true)}
            title="Find & Replace Text"
          >
            <Search size={16} />
            <span className={styles.toolLabel}>Find</span>
          </button>
        </div>

        <div className={`${styles.sep} ${styles.desktopOnly}`} />

        {/* Undo / Redo */}
        <div className={styles.toolGroup}>
          <button className={styles.iconBtn} onClick={handleUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
            <Undo2 size={15} />
          </button>
          <button className={styles.iconBtn} onClick={handleRedo} title="Redo (Ctrl+Y)" aria-label="Redo">
            <Redo2 size={15} />
          </button>
        </div>

        <div className={styles.sep} />

        {/* Zoom */}
        <div className={styles.zoomGroup}>
          <button className={styles.iconBtn} onClick={() => setZoom(zoom - 0.15)} title="Zoom out">
            <ZoomOut size={15} />
          </button>
          <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
          <button className={styles.iconBtn} onClick={() => setZoom(zoom + 0.15)} title="Zoom in">
            <ZoomIn size={15} />
          </button>
        </div>

        <div className={styles.spacer} />

        {/* OCR Button */}
        <button
          className={`${styles.ocrBtn} ${ocrRunning ? styles.ocrRunning : ''}`}
          onClick={handleOcr}
          disabled={ocrRunning || !file}
          title="Run OCR on current page to make scanned text editable"
        >
          {ocrRunning ? (
            <><Loader2 size={14} className={styles.spin} /> OCR {ocrProgress}%</>
          ) : (
            <><Scan size={14} /> OCR Page</>
          )}
        </button>

        <div className={styles.sep} />

        {/* Flatten Form Toggle */}
        <label
          className={styles.flattenToggle}
          title="Flatten Form: Turn filled form fields into permanent static content upon export (uncheck to keep fillable)"
        >
          <input
            type="checkbox"
            checked={flattenForm}
            onChange={e => setFlattenForm(e.target.checked)}
          />
          <span className={styles.flattenLabel}>Flatten Form</span>
        </label>

        <div className={styles.sep} />

        {/* Big Green Sejda Action Button */}
        <button
          className={styles.applyBtn}
          onClick={handleExport}
          disabled={!file}
          title="Apply changes and download final PDF"
        >
          <Download size={15} strokeWidth={2.5} />
          <span>Apply Changes</span>
        </button>

        {/* Mobile properties toggle */}
        <button
          className={`${styles.iconBtn} ${styles.mobileOnly} ${mobilePropertiesOpen ? styles.active : ''}`}
          onClick={() => setMobilePropertiesOpen(!mobilePropertiesOpen)}
          title="Properties"
        >
          <SlidersHorizontal size={16} />
        </button>
      </header>

      {/* Floating/Inline Formatting Sub-Bar when Text is Selected */}
      {hasSelection && (
        <div className={styles.formatBar}>
          <span className={styles.formatLabel}>Font:</span>
          <select
            className={styles.select}
            value={fontFamily}
            onChange={e => handleFontFamily(e.target.value)}
          >
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>

          <div className={styles.fontSizeWrap}>
            <button className={styles.sizeBtn} onClick={() => handleFontSize(fontSize - 1)}>-</button>
            <input
              type="number"
              className={styles.numInput}
              value={fontSize}
              min={4}
              max={200}
              onChange={e => handleFontSize(e.target.value)}
            />
            <button className={styles.sizeBtn} onClick={() => handleFontSize(fontSize + 1)}>+</button>
          </div>

          <div className={styles.fmtGroup}>
            <button
              className={`${styles.fmtBtn} ${bold ? styles.fmtActive : ''}`}
              onClick={handleBold}
              title="Bold"
            >
              <Bold size={14} />
            </button>
            <button
              className={`${styles.fmtBtn} ${italic ? styles.fmtActive : ''}`}
              onClick={handleItalic}
              title="Italic"
            >
              <Italic size={14} />
            </button>
            <button
              className={`${styles.fmtBtn} ${underline ? styles.fmtActive : ''}`}
              onClick={handleUnderline}
              title="Underline"
            >
              <Underline size={14} />
            </button>
          </div>

          <div className={styles.colorWrap} title="Text Color">
            <input
              type="color"
              className={styles.colorPicker}
              value={color}
              onChange={e => handleColor(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      <SignatureModal
        isOpen={isSignOpen}
        onClose={() => setIsSignOpen(false)}
        onSave={handleSaveSignature}
      />

      <FindReplaceModal
        isOpen={isFindOpen}
        onClose={() => setIsFindOpen(false)}
        textItems={textItems}
      />
    </div>
  )
}
