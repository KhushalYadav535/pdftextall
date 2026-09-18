import React, { useState, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import {
  Pipette, Palette, Crop, LayoutGrid, PenTool, Download,
  Copy, Check, RefreshCw, Undo, Trash2, Sliders, Image as ImageIcon
} from 'lucide-react'
import styles from './StudioTools.module.css'

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button className={styles.btnSecondary} onClick={handleCopy} style={{ padding: '4px 10px', fontSize: '11px' }}>
      {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
      {copied ? 'Copied' : label}
    </button>
  )
}

function triggerDownload(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

/* ─── 1. SCREEN EYEDROPPER & COLOR PICKER ─── */
export function ColorPickerTool() {
  const [hex, setHex] = useState('#10b981')

  const openEyedropper = async () => {
    if ('EyeDropper' in window) {
      try {
        const eyeDropper = new window.EyeDropper()
        const result = await eyeDropper.open()
        if (result && result.sRGBHex) {
          setHex(result.sRGBHex)
          toast.success(`Picked color: ${result.sRGBHex}`)
        }
      } catch {
        // user cancelled
      }
    } else {
      toast.error('The EyeDropper API is supported in Chrome, Edge, and Opera.')
    }
  }

  // Calculate RGB and HSL
  const r = parseInt(hex.slice(1, 3), 16) || 0
  const g = parseInt(hex.slice(3, 5), 16) || 0
  const b = parseInt(hex.slice(5, 7), 16) || 0
  const rgb = `rgb(${r}, ${g}, ${b})`

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Pipette size={16} /> Screen Eyedropper & Color Converter</span>
          {'EyeDropper' in window && (
            <button className={styles.btnPrimary} onClick={openEyedropper}>
              <Pipette size={14} /> Pick Color from Screen
            </button>
          )}
        </div>

        <div className={styles.twoCol}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Select Color</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={hex}
                  onChange={e => setHex(e.target.value)}
                  style={{ width: '56px', height: '44px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  className={styles.input}
                  value={hex.toUpperCase()}
                  onChange={e => setHex(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <div><strong>HEX:</strong> <code>{hex.toUpperCase()}</code></div>
                <CopyButton text={hex.toUpperCase()} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <div><strong>RGB:</strong> <code>{rgb}</code></div>
                <CopyButton text={rgb} />
              </div>
            </div>
          </div>

          <div className={styles.previewBox} style={{ background: hex, minHeight: '180px', borderRadius: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.9)', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, color: '#0f172a' }}>
              {hex.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 2. CSS GRADIENT GENERATOR ─── */
export function GradientGeneratorTool() {
  const [type, setType] = useState('linear') // 'linear' | 'radial'
  const [angle, setAngle] = useState(135)
  const [color1, setColor1] = useState('#10b981')
  const [color2, setColor2] = useState('#3b82f6')
  const [color3, setColor3] = useState('#8b5cf6')

  const gradientCss = type === 'linear'
    ? `linear-gradient(${angle}deg, ${color1} 0%, ${color2} 50%, ${color3} 100%)`
    : `radial-gradient(circle, ${color1} 0%, ${color2} 50%, ${color3} 100%)`

  const fullCss = `background: ${gradientCss};`

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Palette size={16} /> CSS Gradient Generator</span>
          <CopyButton text={fullCss} label="Copy CSS" />
        </div>

        <div className={styles.twoCol}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className={styles.pillTabs}>
              <button className={`${styles.pillBtn} ${type === 'linear' ? styles.pillBtnActive : ''}`} onClick={() => setType('linear')}>Linear Gradient</button>
              <button className={`${styles.pillBtn} ${type === 'radial' ? styles.pillBtnActive : ''}`} onClick={() => setType('radial')}>Radial Gradient</button>
            </div>

            {type === 'linear' && (
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}><span>Angle</span><span className={styles.sliderValue}>{angle}°</span></div>
                <input type="range" min="0" max="360" value={angle} className={styles.slider} onChange={e => setAngle(Number(e.target.value))} />
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className={styles.fieldGroup} style={{ flex: 1 }}>
                <label className={styles.fieldLabel}>Color 1</label>
                <input type="color" value={color1} onChange={e => setColor1(e.target.value)} style={{ width: '100%', height: '38px', border: 'none', borderRadius: '6px', cursor: 'pointer' }} />
              </div>
              <div className={styles.fieldGroup} style={{ flex: 1 }}>
                <label className={styles.fieldLabel}>Color 2</label>
                <input type="color" value={color2} onChange={e => setColor2(e.target.value)} style={{ width: '100%', height: '38px', border: 'none', borderRadius: '6px', cursor: 'pointer' }} />
              </div>
              <div className={styles.fieldGroup} style={{ flex: 1 }}>
                <label className={styles.fieldLabel}>Color 3</label>
                <input type="color" value={color3} onChange={e => setColor3(e.target.value)} style={{ width: '100%', height: '38px', border: 'none', borderRadius: '6px', cursor: 'pointer' }} />
              </div>
            </div>

            <div className={styles.codeBox}>
              {fullCss}
            </div>
          </div>

          <div className={styles.previewBox} style={{ background: gradientCss, minHeight: '220px', borderRadius: '12px' }} />
        </div>
      </div>
    </div>
  )
}

/* ─── 3. IMAGE ASPECT RATIO CROPPER ─── */
export function AspectCropperTool() {
  const [file, setFile] = useState(null)
  const [ratio, setRatio] = useState('1:1') // '1:1', '16:9', '9:16', '4:3'
  const [croppedUrl, setCroppedUrl] = useState(null)
  const canvasRef = useRef(null)

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
    onDrop: ([f]) => {
      setFile(f)
      setCroppedUrl(null)
    }
  })

  useEffect(() => {
    if (!file) return
    const img = new Image()
    img.src = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let targetW = img.naturalWidth
      let targetH = img.naturalHeight

      if (ratio === '1:1') {
        const side = Math.min(targetW, targetH)
        canvas.width = side
        canvas.height = side
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, (targetW - side) / 2, (targetH - side) / 2, side, side, 0, 0, side, side)
      } else if (ratio === '16:9') {
        const sideH = Math.min(targetH, Math.round(targetW * 9 / 16))
        const sideW = Math.round(sideH * 16 / 9)
        canvas.width = sideW
        canvas.height = sideH
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, (targetW - sideW) / 2, (targetH - sideH) / 2, sideW, sideH, 0, 0, sideW, sideH)
      } else if (ratio === '9:16') {
        const sideW = Math.min(targetW, Math.round(targetH * 9 / 16))
        const sideH = Math.round(sideW * 16 / 9)
        canvas.width = sideW
        canvas.height = sideH
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, (targetW - sideW) / 2, (targetH - sideH) / 2, sideW, sideH, 0, 0, sideW, sideH)
      } else if (ratio === '4:3') {
        const sideH = Math.min(targetH, Math.round(targetW * 3 / 4))
        const sideW = Math.round(sideH * 4 / 3)
        canvas.width = sideW
        canvas.height = sideH
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, (targetW - sideW) / 2, (targetH - sideH) / 2, sideW, sideH, 0, 0, sideW, sideH)
      }

      setCroppedUrl(canvas.toDataURL('image/png'))
    }
  }, [file, ratio])

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Crop size={16} /> Image Aspect Ratio Cropper</span>
          {croppedUrl && (
            <button className={styles.btnPrimary} onClick={() => triggerDownload(croppedUrl, `cropped-${ratio.replace(':', 'x')}.png`)}>
              <Download size={14} /> Download Cropped Image (.PNG)
            </button>
          )}
        </div>

        <div {...getRootProps()} style={{ border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '24px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
          <input {...getInputProps()} />
          <ImageIcon size={28} color="#10b981" style={{ margin: '0 auto 6px', display: 'block' }} />
          <span>{file ? file.name : 'Drop photo to crop by aspect ratio'}</span>
        </div>

        {file && (
          <div className={styles.twoCol} style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span className={styles.fieldLabel}>Choose Target Aspect Ratio</span>
              <div className={styles.pillTabs}>
                <button className={`${styles.pillBtn} ${ratio === '1:1' ? styles.pillBtnActive : ''}`} onClick={() => setRatio('1:1')}>1:1 (Square / Instagram)</button>
                <button className={`${styles.pillBtn} ${ratio === '16:9' ? styles.pillBtnActive : ''}`} onClick={() => setRatio('16:9')}>16:9 (YouTube / Landscape)</button>
                <button className={`${styles.pillBtn} ${ratio === '9:16' ? styles.pillBtnActive : ''}`} onClick={() => setRatio('9:16')}>9:16 (Stories / Reels)</button>
                <button className={`${styles.pillBtn} ${ratio === '4:3' ? styles.pillBtnActive : ''}`} onClick={() => setRatio('4:3')}>4:3 (Standard)</button>
              </div>
            </div>

            <div className={styles.previewBox}>
              {croppedUrl && <img src={croppedUrl} alt="Cropped preview" className={styles.previewImg} />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 4. PHOTO COLLAGE MAKER ─── */
export function PhotoCollageTool() {
  const [images, setImages] = useState([])
  const [collageUrl, setCollageUrl] = useState(null)
  const [spacing, setSpacing] = useState(8)
  const [bgColor, setBgColor] = useState('#ffffff')

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    multiple: true,
    onDrop: (files) => {
      setImages(files.slice(0, 4))
    }
  })

  useEffect(() => {
    if (images.length === 0) {
      setCollageUrl(null)
      return
    }

    Promise.all(images.map(f => {
      return new Promise(resolve => {
        const img = new Image()
        img.src = URL.createObjectURL(f)
        img.onload = () => resolve(img)
      })
    })).then(loadedImgs => {
      const canvas = document.createElement('canvas')
      const totalW = 1200
      const totalH = images.length === 2 ? 600 : 1200
      canvas.width = totalW
      canvas.height = totalH
      const ctx = canvas.getContext('2d')

      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, totalW, totalH)

      if (loadedImgs.length === 2) {
        const cellW = (totalW - spacing * 3) / 2
        const cellH = totalH - spacing * 2
        ctx.drawImage(loadedImgs[0], spacing, spacing, cellW, cellH)
        ctx.drawImage(loadedImgs[1], spacing * 2 + cellW, spacing, cellW, cellH)
      } else if (loadedImgs.length >= 3) {
        const cellW = (totalW - spacing * 3) / 2
        const cellH = (totalH - spacing * 3) / 2
        ctx.drawImage(loadedImgs[0], spacing, spacing, cellW, cellH)
        ctx.drawImage(loadedImgs[1], spacing * 2 + cellW, spacing, cellW, cellH)
        if (loadedImgs[2]) ctx.drawImage(loadedImgs[2], spacing, spacing * 2 + cellH, cellW, cellH)
        if (loadedImgs[3]) ctx.drawImage(loadedImgs[3], spacing * 2 + cellW, spacing * 2 + cellH, cellW, cellH)
      }

      setCollageUrl(canvas.toDataURL('image/png'))
    })
  }, [images, spacing, bgColor])

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><LayoutGrid size={16} /> Photo Grid Collage Maker</span>
          {collageUrl && (
            <button className={styles.btnPrimary} onClick={() => triggerDownload(collageUrl, 'photo-collage.png')}>
              <Download size={14} /> Download Collage (.PNG)
            </button>
          )}
        </div>

        <div {...getRootProps()} style={{ border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '24px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
          <input {...getInputProps()} />
          <LayoutGrid size={28} color="#10b981" style={{ margin: '0 auto 6px', display: 'block' }} />
          <span>{images.length > 0 ? `${images.length} photos selected` : 'Drop 2 to 4 photos here to build a grid collage'}</span>
        </div>

        {collageUrl && (
          <div className={styles.twoCol} style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}><span>Grid Spacing</span><span className={styles.sliderValue}>{spacing}px</span></div>
                <input type="range" min="0" max="32" value={spacing} className={styles.slider} onChange={e => setSpacing(Number(e.target.value))} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={styles.fieldLabel}>Border Color:</span>
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ width: '36px', height: '36px', border: 'none', borderRadius: '6px', cursor: 'pointer' }} />
              </div>
            </div>

            <div className={styles.previewBox}>
              <img src={collageUrl} alt="Collage preview" className={styles.previewImg} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 5. QUICK WHITEBOARD & SCRATCHPAD ─── */
export function WhiteboardTool() {
  const canvasRef = useRef(null)
  const [color, setColor] = useState('#0f172a')
  const [size, setSize] = useState(3)
  const [tool, setTool] = useState('pen') // 'pen' | 'eraser'
  const isDrawing = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 800
    canvas.height = 450
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 800, 450)
  }, [])

  const startDraw = (e) => {
    isDrawing.current = true
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e) => {
    if (!isDrawing.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    ctx.lineTo(x, y)
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
    ctx.lineWidth = tool === 'eraser' ? size * 5 : size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  const stopDraw = () => {
    isDrawing.current = false
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    toast.success('Whiteboard cleared')
  }

  const downloadCanvas = () => {
    const canvas = canvasRef.current
    triggerDownload(canvas.toDataURL('image/png'), 'whiteboard-drawing.png')
    toast.success('Drawing saved!')
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><PenTool size={16} /> Quick Whiteboard & Doodle Scratchpad</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={styles.btnSecondary} onClick={clearCanvas}><Trash2 size={13} /> Clear</button>
            <button className={styles.btnPrimary} onClick={downloadCanvas}><Download size={13} /> Save as PNG</button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
          <div className={styles.pillTabs}>
            <button className={`${styles.pillBtn} ${tool === 'pen' ? styles.pillBtnActive : ''}`} onClick={() => setTool('pen')}>Pencil</button>
            <button className={`${styles.pillBtn} ${tool === 'eraser' ? styles.pillBtnActive : ''}`} onClick={() => setTool('eraser')}>Eraser</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Color:</span>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '32px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px' }}>
            <span style={{ fontSize: '12px' }}>Thickness:</span>
            <input type="range" min="1" max="20" value={size} className={styles.slider} onChange={e => setSize(Number(e.target.value))} />
            <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{size}px</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', background: '#f1f5f9', padding: '16px', borderRadius: '8px' }}>
          <canvas
            ref={canvasRef}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            style={{ width: '100%', maxWidth: '800px', height: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
          />
        </div>
      </div>
    </div>
  )
}
