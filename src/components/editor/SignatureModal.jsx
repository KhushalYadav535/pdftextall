import React, { useState, useRef, useEffect } from 'react'
import { X, PenTool, Type, Upload, RotateCcw, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './SignatureModal.module.css'

const SIGN_FONTS = [
  { id: 'great-vibes', name: 'Great Vibes', family: "'Great Vibes', cursive" },
  { id: 'dancing-script', name: 'Dancing Script', family: "'Dancing Script', cursive" },
  { id: 'caveat', name: 'Caveat', family: "'Caveat', cursive" },
  { id: 'sacramento', name: 'Sacramento', family: "'Sacramento', cursive" },
]

export default function SignatureModal({ isOpen, onClose, onSave }) {
  const [tab, setTab] = useState('draw') // 'draw' | 'type' | 'upload'
  const [typedName, setTypedName] = useState('')
  const [selectedFont, setSelectedFont] = useState(SIGN_FONTS[0].id)
  const [uploadedDataUrl, setUploadedDataUrl] = useState(null)
  const [color, setColor] = useState('#0f172a')

  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef({ x: 0, y: 0 })
  const hasDrawnRef = useRef(false)

  // Initialize canvas
  useEffect(() => {
    if (!isOpen || tab !== 'draw') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasDrawnRef.current = false
  }, [isOpen, tab])

  if (!isOpen) return null

  // Drawing helpers
  const startDrawing = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    isDrawingRef.current = true
    lastPointRef.current = { x, y }
    hasDrawnRef.current = true
  }

  const draw = (e) => {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(x, y)
    ctx.stroke()

    lastPointRef.current = { x, y }
  }

  const stopDrawing = () => {
    isDrawingRef.current = false
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasDrawnRef.current = false
  }

  // Handle image upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image (PNG or JPG)')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setUploadedDataUrl(reader.result)
    }
    reader.readAsDataURL(file)
  }

  // Generate signature data URL
  const handleSaveSignature = () => {
    if (tab === 'draw') {
      const canvas = canvasRef.current
      if (!canvas || !hasDrawnRef.current) {
        toast.error('Please draw your signature first')
        return
      }
      onSave(canvas.toDataURL('image/png'), 180, 70)
      onClose()
    } else if (tab === 'type') {
      if (!typedName.trim()) {
        toast.error('Please type your name')
        return
      }
      // Render text into temporary off-screen canvas to convert to crisp PNG
      const offCanvas = document.createElement('canvas')
      offCanvas.width = 400
      offCanvas.height = 160
      const ctx = offCanvas.getContext('2d')
      const chosen = SIGN_FONTS.find(f => f.id === selectedFont) || SIGN_FONTS[0]

      ctx.clearRect(0, 0, offCanvas.width, offCanvas.height)
      ctx.fillStyle = color
      ctx.font = `60px ${chosen.family}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(typedName, 200, 80)

      onSave(offCanvas.toDataURL('image/png'), 200, 80)
      onClose()
    } else if (tab === 'upload') {
      if (!uploadedDataUrl) {
        toast.error('Please upload a signature image')
        return
      }
      onSave(uploadedDataUrl, 180, 70)
      onClose()
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <PenTool size={18} className={styles.titleIcon} />
            <h3 className={styles.title}>Create Signature</h3>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tabBtn} ${tab === 'draw' ? styles.tabActive : ''}`}
            onClick={() => setTab('draw')}
          >
            <PenTool size={15} />
            <span>Draw</span>
          </button>
          <button
            className={`${styles.tabBtn} ${tab === 'type' ? styles.tabActive : ''}`}
            onClick={() => setTab('type')}
          >
            <Type size={15} />
            <span>Type</span>
          </button>
          <button
            className={`${styles.tabBtn} ${tab === 'upload' ? styles.tabActive : ''}`}
            onClick={() => setTab('upload')}
          >
            <Upload size={15} />
            <span>Upload</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.body}>
          {tab === 'draw' && (
            <div className={styles.drawSection}>
              <div className={styles.canvasContainer}>
                <canvas
                  ref={canvasRef}
                  width={460}
                  height={180}
                  className={styles.canvas}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
                <div className={styles.signLine} />
              </div>
              <div className={styles.drawControls}>
                <div className={styles.colorRow}>
                  <label className={styles.label}>Ink Color:</label>
                  {['#0f172a', '#1d4ed8', '#047857'].map(c => (
                    <button
                      key={c}
                      className={`${styles.colorCircle} ${color === c ? styles.colorActive : ''}`}
                      style={{ background: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
                <button className={styles.clearBtn} onClick={clearCanvas}>
                  <RotateCcw size={14} /> Clear
                </button>
              </div>
            </div>
          )}

          {tab === 'type' && (
            <div className={styles.typeSection}>
              <input
                type="text"
                placeholder="Type your name..."
                value={typedName}
                onChange={e => setTypedName(e.target.value)}
                className={styles.typeInput}
                autoFocus
              />
              <div className={styles.fontGrid}>
                {SIGN_FONTS.map(f => (
                  <div
                    key={f.id}
                    className={`${styles.fontCard} ${selectedFont === f.id ? styles.fontActive : ''}`}
                    onClick={() => setSelectedFont(f.id)}
                  >
                    <span className={styles.fontPreview} style={{ fontFamily: f.family, color }}>
                      {typedName || 'Your Signature'}
                    </span>
                    <span className={styles.fontName}>{f.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'upload' && (
            <div className={styles.uploadSection}>
              <label className={styles.uploadDrop}>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                {uploadedDataUrl ? (
                  <div className={styles.uploadedPreview}>
                    <img src={uploadedDataUrl} alt="Signature preview" />
                    <span>Click to change image</span>
                  </div>
                ) : (
                  <div className={styles.uploadPrompt}>
                    <Upload size={32} />
                    <span>Click or drag signature image here (PNG / JPG)</span>
                    <small>Transparent PNG works best</small>
                  </div>
                )}
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.applyBtn} onClick={handleSaveSignature}>
            <Check size={16} /> Place Signature
          </button>
        </div>
      </div>
    </div>
  )
}
