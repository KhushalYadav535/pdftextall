import React, { useState, useRef, useEffect } from 'react'
import {
  Upload, Download, RefreshCw, Scissors, ShieldAlert, Sparkles,
  Sliders, Copy, Check, Grid, Image as ImageIcon, Maximize2, Trash2,
  FileArchive, Stamp, ZoomIn
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  removeBackgroundByColor, removeBackgroundSmart, removeBackgroundAI,
  createPassportSheet, applyPrivacyRedaction,
  applyWatermark, splitImageToGrid, resizeImageWithDpi, generateAsciiArt,
  renderPolaroid, loadImage
} from '../../lib/imageProEngine.js'
import styles from './StudioTools.module.css'

/* ─────────────────────────────────────────────────────────────
   1. Background Remover / Color Key Eraser
───────────────────────────────────────────────────────────── */
export function BackgroundRemoverTool() {
  const [file, setFile] = useState(null)
  const [mode, setMode] = useState('smart') // smart | chroma | ai
  const [tolerance, setTolerance] = useState(32)
  const [targetColor, setTargetColor] = useState({ r: 255, g: 255, b: 255 })
  const [colorHex, setColorHex] = useState('#ffffff')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [aiNote, setAiNote] = useState('')
  const canvasRef = useRef(null)

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setPreviewUrl(null)
      setAiNote('')
    }
  }

  const handleProcess = async () => {
    if (!file) return
    setLoading(true)
    setAiNote('')
    try {
      let blob
      if (mode === 'ai') {
        setAiNote('AI model pehli baar CDN se download hoga (~40MB), phir cached rahega…')
        blob = await removeBackgroundAI(file, (k, p) => setAiNote(`AI ${k}: ${p}%`))
      } else if (mode === 'smart') {
        blob = await removeBackgroundSmart(file, tolerance)
      } else {
        blob = await removeBackgroundByColor(file, targetColor, tolerance, 1)
      }
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setAiNote('')
      toast.success(mode === 'ai' ? 'AI background removed!' : 'Background erased to transparent PNG!')
    } catch (err) {
      toast.error('Failed: ' + err.message)
      setAiNote(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleHexChange = (e) => {
    const hex = e.target.value
    setColorHex(hex)
    const r = parseInt(hex.slice(1, 3), 16) || 255
    const g = parseInt(hex.slice(3, 5), 16) || 255
    const b = parseInt(hex.slice(5, 7), 16) || 255
    setTargetColor({ r, g, b })
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Scissors size={20} className={styles.toolIcon} />
        <div>
          <h3>Background Remover (Smart + AI)</h3>
          <p>Smart auto-detect, classic chroma, ya real AI portrait cutout — remove.bg jaisa, free.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop image here or click to upload</span>
            <input type="file" accept="image/*" onChange={handleFile} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                ['smart', 'Smart Auto (Recommended)'],
                ['chroma', 'Chroma Pick'],
                ['ai', 'AI Portrait (needs net once)'],
              ].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setMode(v)}
                  style={{
                    padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: mode === v ? 700 : 500,
                    border: mode === v ? '1px solid #10b981' : '1px solid var(--brd)',
                    background: mode === v ? '#10b981' : 'var(--bg-card)',
                    color: mode === v ? '#fff' : 'var(--tx-2)', cursor: 'pointer',
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className={styles.settingsRow}>
              {mode === 'chroma' && (
              <div className={styles.inputGroup}>
                <label>Target BG Color:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="color" value={colorHex} onChange={handleHexChange} style={{ width: 44, height: 36, cursor: 'pointer' }} />
                  <span style={{ fontSize: 13, fontFamily: 'monospace' }}>{colorHex}</span>
                </div>
              </div>
              )}

              <div className={styles.inputGroup}>
                <label>Tolerance ({tolerance}):</label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                />
              </div>

              <button className={styles.primaryBtn} onClick={handleProcess} disabled={loading}>
                <RefreshCw size={16} className={loading ? styles.spinning : ''} />
                {loading ? 'Processing...' : mode === 'ai' ? 'Remove BG with AI' : 'Erase Background'}
              </button>
            </div>
            {aiNote && (
              <div style={{ fontSize: 12, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px' }}>
                {aiNote}
              </div>
            )}

            {previewUrl && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <div style={{
                  display: 'inline-block',
                  background: 'repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%) 50% / 16px 16px',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid #cbd5e1'
                }}>
                  <img src={previewUrl} alt="Erased BG" style={{ maxHeight: 300, maxWidth: '100%', objectFit: 'contain' }} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <a href={previewUrl} download="transparent-image.png" className={styles.downloadBtn}>
                    <Download size={16} /> Download Transparent PNG
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   2. Passport & Visa Photo Sheet Maker
───────────────────────────────────────────────────────────── */
export function PassportPhotoTool() {
  const [file, setFile] = useState(null)
  const [country, setCountry] = useState('india')
  const [sheet, setSheet] = useState('4x6')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [border, setBorder] = useState(true)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    if (!file) return
    setLoading(true)
    try {
      const res = await createPassportSheet(file, { country, sheet, bgColor, border })
      const url = URL.createObjectURL(res.blob)
      setResult({ url, ...res })
      toast.success('Printable Passport Sheet Generated!')
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Stamp size={20} className={styles.toolIcon} />
        <div>
          <h3>Passport & Visa Photo Sheet Maker</h3>
          <p>Create standard 2x2" or 35x45mm photos and 4x6 / A4 printable sheets with cut guidelines.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop portrait / headshot photo here</span>
            <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0]); setResult(null); }} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <div className={styles.inputGroup}>
                <label>Photo Preset:</label>
                <select value={country} onChange={(e) => setCountry(e.target.value)}>
                  <option value="india">India / US Passport (2x2 inch / 51x51mm)</option>
                  <option value="schengen">Schengen / UK Visa (35x45 mm)</option>
                  <option value="stamp">Stamp Size (1x1.25 inch)</option>
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label>Print Sheet Type:</label>
                <select value={sheet} onChange={(e) => setSheet(e.target.value)}>
                  <option value="4x6">4x6 inch Photo Paper (4 to 6 photos)</option>
                  <option value="a4">A4 Full Sheet (Up to 16 photos)</option>
                  <option value="single">Single Photo (Cropped 300 DPI)</option>
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label>Background Fill:</label>
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{ width: 44, height: 36 }} />
              </div>

              <button className={styles.primaryBtn} onClick={handleGenerate} disabled={loading}>
                <Sparkles size={16} />
                {loading ? 'Generating...' : 'Create Printable Sheet'}
              </button>
            </div>

            {result && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <img
                  src={result.url}
                  alt="Passport Sheet"
                  style={{ maxHeight: 320, maxWidth: '100%', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <div style={{ marginTop: 12 }}>
                  <a href={result.url} download={`passport-sheet-${country}-${sheet}.jpg`} className={styles.downloadBtn}>
                    <Download size={16} /> Download 300 DPI Printable JPEG
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   3. Privacy Face Blur & Redactor
───────────────────────────────────────────────────────────── */
export function ImageRedactorTool() {
  const [file, setFile] = useState(null)
  const [mode, setMode] = useState('pixelate') // 'pixelate', 'blur', 'blackout'
  const [intensity, setIntensity] = useState(16)
  const [boxes, setBoxes] = useState([])
  const [drawing, setDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentBox, setCurrentBox] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const canvasRef = useRef(null)
  const [loadedImg, setLoadedImg] = useState(null)

  const handleFile = async (e) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setBoxes([])
      setPreviewUrl(null)
      const img = await loadImage(f)
      setLoadedImg(img)
    }
  }

  // Draw overlay canvas
  useEffect(() => {
    if (!loadedImg || !canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = loadedImg.width
    canvas.height = loadedImg.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(loadedImg, 0, 0)

    // Draw existing boxes
    boxes.forEach((b) => {
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 3
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'
      ctx.fillRect(b.x, b.y, b.w, b.h)
      ctx.strokeRect(b.x, b.y, b.w, b.h)
    })

    if (currentBox) {
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.strokeRect(currentBox.x, currentBox.y, currentBox.w, currentBox.h)
      ctx.setLineDash([])
    }
  }, [loadedImg, boxes, currentBox])

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  const onMouseDown = (e) => {
    if (!loadedImg) return
    const pos = getCanvasCoords(e)
    setStartPos(pos)
    setDrawing(true)
  }

  const onMouseMove = (e) => {
    if (!drawing) return
    const pos = getCanvasCoords(e)
    setCurrentBox({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      w: Math.abs(pos.x - startPos.x),
      h: Math.abs(pos.y - startPos.y)
    })
  }

  const onMouseUp = () => {
    if (drawing && currentBox && currentBox.w > 5 && currentBox.h > 5) {
      setBoxes([...boxes, currentBox])
    }
    setDrawing(false)
    setCurrentBox(null)
  }

  const handleApply = async () => {
    if (!file || boxes.length === 0) {
      toast('Please draw at least one censor rectangle over the photo', { icon: 'ℹ️' })
      return
    }
    setLoading(true)
    try {
      const blob = await applyPrivacyRedaction(file, boxes, mode, intensity)
      setPreviewUrl(URL.createObjectURL(blob))
      toast.success('Sensitive regions redacted!')
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
          <h3>Privacy Face Blur & Censor Redactor</h3>
          <p>Draw boxes over faces, license plates, Aadhaar, or credit cards to pixelate or blackout.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop photo to censor / blur</span>
            <input type="file" accept="image/*" onChange={handleFile} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <div className={styles.inputGroup}>
                <label>Censor Style:</label>
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="pixelate">Mosaic / Pixelate</option>
                  <option value="blur">Gaussian Blur</option>
                  <option value="blackout">Solid Blackout</option>
                </select>
              </div>

              {mode !== 'blackout' && (
                <div className={styles.inputGroup}>
                  <label>Intensity ({intensity}):</label>
                  <input
                    type="range"
                    min="8"
                    max="40"
                    value={intensity}
                    onChange={(e) => setIntensity(Number(e.target.value))}
                  />
                </div>
              )}

              <button className={styles.secondaryBtn} onClick={() => setBoxes([])}>
                <Trash2 size={15} /> Clear Boxes ({boxes.length})
              </button>

              <button className={styles.primaryBtn} onClick={handleApply} disabled={loading || boxes.length === 0}>
                <ShieldAlert size={16} />
                {loading ? 'Applying...' : 'Apply Redaction'}
              </button>
            </div>

            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                👉 <strong>Drag your mouse on the image</strong> to draw redaction boxes:
              </p>
              <canvas
                ref={canvasRef}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                style={{
                  maxHeight: 380,
                  maxWidth: '100%',
                  cursor: 'crosshair',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8
                }}
              />
            </div>

            {previewUrl && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <h4>Redacted Output Preview:</h4>
                <img src={previewUrl} alt="Redacted" style={{ maxHeight: 300, maxWidth: '100%', borderRadius: 8 }} />
                <div style={{ marginTop: 12 }}>
                  <a href={previewUrl} download="redacted-image.png" className={styles.downloadBtn}>
                    <Download size={16} /> Download Redacted PNG
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   4. Photo Watermark Pro
───────────────────────────────────────────────────────────── */
export function ImageWatermarkTool() {
  const [file, setFile] = useState(null)
  const [text, setText] = useState('CONFIDENTIAL')
  const [opacity, setOpacity] = useState(0.4)
  const [angle, setAngle] = useState(-30)
  const [fontSize, setFontSize] = useState(36)
  const [color, setColor] = useState('#ffffff')
  const [tile, setTile] = useState(true)
  const [position, setPosition] = useState('center')
  const [resultUrl, setResultUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleApply = async () => {
    if (!file) return
    setLoading(true)
    try {
      const blob = await applyWatermark(file, {
        text, opacity, angle, fontSize, color, tile, position
      })
      setResultUrl(URL.createObjectURL(blob))
      toast.success('Watermark stamped!')
    } catch (err) {
      toast.error('Watermark error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Stamp size={20} className={styles.toolIcon} />
        <div>
          <h3>Photo Watermark Pro (Tile Grid & Angle)</h3>
          <p>Protect images with customizable text watermark or anti-theft repeating grid pattern.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop image here to watermark</span>
            <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0]); setResultUrl(null); }} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <div className={styles.inputGroup} style={{ flex: 2 }}>
                <label>Watermark Text:</label>
                <input type="text" value={text} onChange={(e) => setText(e.target.value)} />
              </div>

              <div className={styles.inputGroup}>
                <label>Repeat Tile Pattern:</label>
                <button
                  className={tile ? styles.primaryBtn : styles.secondaryBtn}
                  onClick={() => setTile(!tile)}
                  style={{ padding: '8px 12px' }}
                >
                  {tile ? 'Full Grid Repeat (Active)' : 'Single Stamp'}
                </button>
              </div>

              <div className={styles.inputGroup}>
                <label>Opacity ({(opacity * 100).toFixed(0)}%):</label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Angle ({angle}°):</label>
                <input
                  type="range"
                  min="-90"
                  max="90"
                  value={angle}
                  onChange={(e) => setAngle(Number(e.target.value))}
                />
              </div>

              <button className={styles.primaryBtn} onClick={handleApply} disabled={loading}>
                <Stamp size={16} />
                {loading ? 'Stamping...' : 'Apply Watermark'}
              </button>
            </div>

            {resultUrl && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <img src={resultUrl} alt="Watermarked" style={{ maxHeight: 320, maxWidth: '100%', borderRadius: 8 }} />
                <div style={{ marginTop: 12 }}>
                  <a href={resultUrl} download="watermarked-image.jpg" className={styles.downloadBtn}>
                    <Download size={16} /> Download Watermarked Image
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   5. Social Media Grid Splitter (Instagram 3x3)
───────────────────────────────────────────────────────────── */
export function GridSplitterTool() {
  const [file, setFile] = useState(null)
  const [gridType, setGridType] = useState('3x3') // '3x1', '3x2', '3x3'
  const [loading, setLoading] = useState(false)
  const [zipBlob, setZipBlob] = useState(null)

  const handleSplit = async () => {
    if (!file) return
    setLoading(true)
    try {
      const [cols, rows] = gridType.split('x').map(Number)
      const zip = await splitImageToGrid(file, rows, cols)
      setZipBlob(zip)
      toast.success(`Image split into ${rows * cols} tiles!`)
    } catch (err) {
      toast.error('Error splitting grid: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Grid size={20} className={styles.toolIcon} />
        <div>
          <h3>Social Media Grid Splitter (Instagram 3x3)</h3>
          <p>Slice any photo into 3x1, 3x2, or 3x3 square tiles and download all as a ZIP package.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop image to split for Instagram grid</span>
            <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0]); setZipBlob(null); }} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <div className={styles.inputGroup}>
                <label>Grid Layout:</label>
                <select value={gridType} onChange={(e) => setGridType(e.target.value)}>
                  <option value="3x3">3x3 Grid (9 Instagram Posts)</option>
                  <option value="3x2">3x2 Grid (6 Posts)</option>
                  <option value="3x1">3x1 Horizontal Carousel (3 Posts)</option>
                </select>
              </div>

              <button className={styles.primaryBtn} onClick={handleSplit} disabled={loading}>
                <Grid size={16} />
                {loading ? 'Splitting Tiles...' : 'Split Image & Pack ZIP'}
              </button>
            </div>

            {zipBlob && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <a
                  href={URL.createObjectURL(zipBlob)}
                  download={`instagram-grid-${gridType}.zip`}
                  className={styles.downloadBtn}
                >
                  <FileArchive size={16} /> Download Grid Tiles (ZIP)
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
   6. Exact Dimension & DPI Resizer
───────────────────────────────────────────────────────────── */
export function ExactResizerTool() {
  const [file, setFile] = useState(null)
  const [width, setWidth] = useState(600)
  const [height, setHeight] = useState(600)
  const [unit, setUnit] = useState('px')
  const [dpi, setDpi] = useState(300)
  const [lockAspect, setLockAspect] = useState(true)
  const [aspectRatio, setAspectRatio] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFile = async (e) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      const img = await loadImage(f)
      setWidth(img.width)
      setHeight(img.height)
      setAspectRatio(img.width / img.height)
      setResult(null)
    }
  }

  const handleWidthChange = (val) => {
    setWidth(val)
    if (lockAspect && aspectRatio) {
      setHeight(Math.round(val / aspectRatio))
    }
  }

  const handleResize = async () => {
    if (!file) return
    setLoading(true)
    try {
      const res = await resizeImageWithDpi(file, { width, height, unit, dpi })
      const url = URL.createObjectURL(res.blob)
      setResult({ url, ...res })
      toast.success('Image resized with exact DPI!')
    } catch (err) {
      toast.error('Resize error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Maximize2 size={20} className={styles.toolIcon} />
        <div>
          <h3>Exact Dimension & DPI Resizer</h3>
          <p>Resize by pixels, mm, cm, or inches for passport forms, govt applications, and print DPI.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop image to resize</span>
            <input type="file" accept="image/*" onChange={handleFile} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <div className={styles.inputGroup}>
                <label>Unit:</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="px">Pixels (px)</option>
                  <option value="mm">Millimeters (mm)</option>
                  <option value="cm">Centimeters (cm)</option>
                  <option value="in">Inches (in)</option>
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label>Width ({unit}):</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => handleWidthChange(Number(e.target.value))}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Height ({unit}):</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Print DPI:</label>
                <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))}>
                  <option value={72}>72 DPI (Standard Web)</option>
                  <option value={150}>150 DPI (Medium Quality)</option>
                  <option value={300}>300 DPI (High Res Print)</option>
                </select>
              </div>

              <button className={styles.primaryBtn} onClick={handleResize} disabled={loading}>
                <Maximize2 size={16} />
                {loading ? 'Resizing...' : 'Resize Image'}
              </button>
            </div>

            {result && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#64748b' }}>
                  Output size: {result.width} x {result.height} px ({(result.blob.size / 1024).toFixed(1)} KB)
                </p>
                <a href={result.url} download="resized-photo.jpg" className={styles.downloadBtn}>
                  <Download size={16} /> Download Resized Photo
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
   7. ASCII Art Generator
───────────────────────────────────────────────────────────── */
export function AsciiArtTool() {
  const [file, setFile] = useState(null)
  const [width, setWidth] = useState(80)
  const [asciiText, setAsciiText] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!file) return
    setLoading(true)
    try {
      const art = await generateAsciiArt(file, { width })
      setAsciiText(art)
      toast.success('ASCII Art Generated!')
    } catch (err) {
      toast.error('ASCII error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(asciiText)
    setCopied(true)
    toast.success('Copied ASCII art to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Sparkles size={20} className={styles.toolIcon} />
        <div>
          <h3>ASCII Art Photo Converter</h3>
          <p>Transform any picture into retro ASCII text art with copyable characters.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop photo to convert to ASCII text</span>
            <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0]); setAsciiText(''); }} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <div className={styles.inputGroup}>
                <label>Resolution Columns ({width}):</label>
                <input
                  type="range"
                  min="40"
                  max="140"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                />
              </div>

              <button className={styles.primaryBtn} onClick={handleGenerate} disabled={loading}>
                <Sparkles size={16} />
                {loading ? 'Generating...' : 'Render ASCII Art'}
              </button>

              {asciiText && (
                <button className={styles.secondaryBtn} onClick={handleCopy}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy Text'}
                </button>
              )}
            </div>

            {asciiText && (
              <pre style={{
                marginTop: 16,
                padding: 16,
                background: '#0f172a',
                color: '#10b981',
                fontSize: 7,
                lineHeight: '7px',
                fontFamily: 'monospace',
                overflowX: 'auto',
                borderRadius: 8,
                whiteSpace: 'pre'
              }}>
                {asciiText}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   8. Vintage Polaroid & Aesthetic Frame Creator
───────────────────────────────────────────────────────────── */
export function PolaroidMakerTool() {
  const [file, setFile] = useState(null)
  const [caption, setCaption] = useState('Golden Hour Memories')
  const [tilt, setTilt] = useState(-2)
  const [resultUrl, setResultUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleRender = async () => {
    if (!file) return
    setLoading(true)
    try {
      const blob = await renderPolaroid(file, caption, { tiltAngle: tilt })
      setResultUrl(URL.createObjectURL(blob))
      toast.success('Vintage Polaroid Created!')
    } catch (err) {
      toast.error('Polaroid error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <ImageIcon size={20} className={styles.toolIcon} />
        <div>
          <h3>Vintage Polaroid & Aesthetic Frame</h3>
          <p>Wrap photos into classic Polaroid white frames with handwritten captions and soft shadows.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop photo for Polaroid frame</span>
            <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0]); setResultUrl(null); }} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <div className={styles.inputGroup} style={{ flex: 2 }}>
                <label>Polaroid Handwritten Caption:</label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="E.g. Summer in Paris 2024"
                />
              </div>

              <div className={styles.inputGroup}>
                <label>Card Tilt Angle ({tilt}°):</label>
                <input
                  type="range"
                  min="-8"
                  max="8"
                  value={tilt}
                  onChange={(e) => setTilt(Number(e.target.value))}
                />
              </div>

              <button className={styles.primaryBtn} onClick={handleRender} disabled={loading}>
                <Sparkles size={16} />
                {loading ? 'Developing...' : 'Create Polaroid'}
              </button>
            </div>

            {resultUrl && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <img src={resultUrl} alt="Polaroid" style={{ maxHeight: 380, maxWidth: '100%' }} />
                <div style={{ marginTop: 12 }}>
                  <a href={resultUrl} download="vintage-polaroid.png" className={styles.downloadBtn}>
                    <Download size={16} /> Download Polaroid PNG
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
