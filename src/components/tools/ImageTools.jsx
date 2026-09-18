import React, { useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import {
  Download, Image as ImageIcon, Sliders, RefreshCw, Copy, Check,
  Sparkles, FileArchive, Layers, Palette, Eye, ArrowRight
} from 'lucide-react'
import {
  compressImage, convertImageFormat, generateFaviconPack,
  applyPhotoFilters, generateMeme, extractColorPalette, rasterizeSvg
} from '../../lib/imageEngine.js'
import styles from './StudioTools.module.css'

function ImageDropper({ onFile, file, accept = { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.svg'] }, label = 'Drop image here or click to browse' }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxFiles: 1,
    onDrop: ([f]) => f && onFile(f)
  })

  if (file) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ImageIcon size={18} color="#10b981" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{file.name}</span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>({(file.size / 1024).toFixed(1)} KB)</span>
        </div>
        <button className={styles.btnSecondary} onClick={() => onFile(null)}>Change Image</button>
      </div>
    )
  }

  return (
    <div {...getRootProps()} style={{ border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: isDragActive ? '#f0fdf4' : '#f8fafc', transition: 'all 0.2s' }}>
      <input {...getInputProps()} />
      <ImageIcon size={32} color="#10b981" style={{ margin: '0 auto 8px', display: 'block' }} />
      <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#334155' }}>{isDragActive ? 'Drop image here...' : label}</p>
      <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Supports PNG, JPG, WebP, SVG</span>
    </div>
  )
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ─── 1. COMPRESS IMAGE TOOL ─── */
export function CompressImageTool() {
  const [file, setFile] = useState(null)
  const [quality, setQuality] = useState(75)
  const [maxWidth, setMaxWidth] = useState(1920)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleCompress = async () => {
    if (!file) return
    try {
      setLoading(true)
      const res = await compressImage(file, {
        quality: quality / 100,
        maxWidth: Number(maxWidth) || 0,
        mimeType: file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      })
      setResult(res)
      toast.success(`Saved ${res.savingsPercent}% of file size!`)
    } catch (err) {
      toast.error('Compression failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Sliders size={16} /> Compress Image</span>
        </div>
        <ImageDropper file={file} onFile={(f) => { setFile(f); setResult(null); }} />

        {file && (
          <div className={styles.twoCol}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>
                  <span>Compression Quality</span>
                  <span className={styles.sliderValue}>{quality}%</span>
                </div>
                <div className={styles.sliderRow}>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={quality}
                    className={styles.slider}
                    onChange={(e) => setQuality(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  <span>Max Width (Optional Downscale)</span>
                  <span className={styles.fieldHint}>0 = original width</span>
                </label>
                <input
                  type="number"
                  className={styles.input}
                  value={maxWidth}
                  onChange={(e) => setMaxWidth(e.target.value)}
                  placeholder="e.g. 1920"
                />
              </div>

              <button className={styles.btnPrimary} onClick={handleCompress} disabled={loading}>
                {loading ? 'Compressing...' : 'Compress Image'}
              </button>
            </div>

            <div className={styles.previewBox}>
              {result ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <img src={result.dataUrl} alt="Compressed preview" className={styles.previewImg} />
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <span className={styles.statBadge}>
                      Original: {(result.originalSize / 1024).toFixed(1)} KB
                    </span>
                    <span className={styles.statBadge} style={{ background: '#ecfdf5', color: '#047857' }}>
                      Compressed: {(result.compressedSize / 1024).toFixed(1)} KB (-{result.savingsPercent}%)
                    </span>
                  </div>
                  <button
                    className={styles.btnPrimary}
                    style={{ width: '100%' }}
                    onClick={() => triggerDownload(result.blob, `compressed-${file.name}`)}
                  >
                    <Download size={15} /> Download Compressed Image
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  Adjust quality and click Compress to view instant results
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 2. CONVERT IMAGE FORMAT TOOL ─── */
export function ConvertImageTool() {
  const [file, setFile] = useState(null)
  const [targetFormat, setTargetFormat] = useState('image/webp')
  const [quality, setQuality] = useState(90)
  const [loading, setLoading] = useState(false)
  const [converted, setConverted] = useState(null)

  const handleConvert = async () => {
    if (!file) return
    try {
      setLoading(true)
      const res = await convertImageFormat(file, targetFormat, quality / 100)
      const ext = targetFormat === 'image/webp' ? 'webp' : targetFormat === 'image/png' ? 'png' : 'jpg'
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
      setConverted({ ...res, filename: `${baseName}.${ext}` })
      toast.success(`Converted to ${ext.toUpperCase()} successfully!`)
    } catch (err) {
      toast.error('Conversion failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><RefreshCw size={16} /> Convert Image Format</span>
        </div>
        <ImageDropper file={file} onFile={(f) => { setFile(f); setConverted(null); }} />

        {file && (
          <div className={styles.twoCol} style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Target Format</label>
                <select className={styles.select} value={targetFormat} onChange={(e) => setTargetFormat(e.target.value)}>
                  <option value="image/webp">WebP (Modern, compact web format)</option>
                  <option value="image/png">PNG (Lossless transparency)</option>
                  <option value="image/jpeg">JPEG / JPG (Universal photo format)</option>
                </select>
              </div>

              {targetFormat !== 'image/png' && (
                <div className={styles.fieldGroup}>
                  <div className={styles.fieldLabel}>
                    <span>Export Quality</span>
                    <span className={styles.sliderValue}>{quality}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={quality}
                    className={styles.slider}
                    onChange={(e) => setQuality(Number(e.target.value))}
                  />
                </div>
              )}

              <button className={styles.btnPrimary} onClick={handleConvert} disabled={loading}>
                {loading ? 'Converting...' : 'Convert Image'}
              </button>
            </div>

            <div className={styles.previewBox}>
              {converted ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
                  <span className={styles.statBadge}>
                    New Size: {(converted.size / 1024).toFixed(1)} KB ({converted.width}x{converted.height}px)
                  </span>
                  <button
                    className={styles.btnPrimary}
                    style={{ width: '100%' }}
                    onClick={() => triggerDownload(converted.blob, converted.filename)}
                  >
                    <Download size={15} /> Download {converted.filename}
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  Select format and click Convert
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 3. FAVICON & APP ICON GENERATOR TOOL ─── */
export function FaviconGeneratorTool() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleGenerate = async () => {
    if (!file) return
    try {
      setLoading(true)
      setProgress(10)
      const zipBlob = await generateFaviconPack(file, p => setProgress(p))
      triggerDownload(zipBlob, 'favicon-app-icons-pack.zip')
      toast.success('Favicon & App Icon package downloaded!')
    } catch (err) {
      toast.error('Generation failed: ' + err.message)
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><FileArchive size={16} /> Favicon & App Icon Generator</span>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          Upload your logo or icon to instantly generate a complete production-ready icon suite:
          16x16, 32x32, 48x48, Apple Touch Icon (180x180), Android Chrome (192x192 & 512x512), plus <code>site.webmanifest</code> and HTML link tags bundled in a ZIP.
        </p>

        <ImageDropper file={file} onFile={setFile} label="Drop your 512x512 or square logo here" />

        {file && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
            <button className={styles.btnPrimary} onClick={handleGenerate} disabled={loading} style={{ minWidth: '220px' }}>
              <Download size={16} /> {loading ? `Packaging (${progress}%)...` : 'Generate Icon Pack (.ZIP)'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 4. PHOTO FILTERS & ADJUSTMENTS TOOL ─── */
export function PhotoFiltersTool() {
  const [file, setFile] = useState(null)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [blur, setBlur] = useState(0)
  const [grayscale, setGrayscale] = useState(0)
  const [sepia, setSepia] = useState(0)
  const [invert, setInvert] = useState(0)
  const [hueRotate, setHueRotate] = useState(0)
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    if (!file) return
    const timer = setTimeout(async () => {
      const res = await applyPhotoFilters(file, {
        brightness, contrast, saturation, blur, grayscale, sepia, invert, hueRotate
      })
      setPreviewUrl(res.dataUrl)
    }, 100)
    return () => clearTimeout(timer)
  }, [file, brightness, contrast, saturation, blur, grayscale, sepia, invert, hueRotate])

  const handleReset = () => {
    setBrightness(100)
    setContrast(100)
    setSaturation(100)
    setBlur(0)
    setGrayscale(0)
    setSepia(0)
    setInvert(0)
    setHueRotate(0)
  }

  const handleDownload = async () => {
    if (!file) return
    const res = await applyPhotoFilters(file, {
      brightness, contrast, saturation, blur, grayscale, sepia, invert, hueRotate
    })
    triggerDownload(res.blob, `filtered-${file.name}`)
    toast.success('Filtered image saved!')
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Sparkles size={16} /> Photo Filters & Adjustments</span>
          {file && <button className={styles.btnSecondary} onClick={handleReset}>Reset All</button>}
        </div>
        <ImageDropper file={file} onFile={(f) => { setFile(f); handleReset(); }} />

        {file && (
          <div className={styles.twoCol}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}><span>Brightness</span><span className={styles.sliderValue}>{brightness}%</span></div>
                <input type="range" min="20" max="200" value={brightness} className={styles.slider} onChange={e => setBrightness(e.target.value)} />
              </div>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}><span>Contrast</span><span className={styles.sliderValue}>{contrast}%</span></div>
                <input type="range" min="20" max="200" value={contrast} className={styles.slider} onChange={e => setContrast(e.target.value)} />
              </div>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}><span>Saturation</span><span className={styles.sliderValue}>{saturation}%</span></div>
                <input type="range" min="0" max="200" value={saturation} className={styles.slider} onChange={e => setSaturation(e.target.value)} />
              </div>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}><span>Blur</span><span className={styles.sliderValue}>{blur}px</span></div>
                <input type="range" min="0" max="20" value={blur} className={styles.slider} onChange={e => setBlur(e.target.value)} />
              </div>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}><span>Grayscale (B&W)</span><span className={styles.sliderValue}>{grayscale}%</span></div>
                <input type="range" min="0" max="100" value={grayscale} className={styles.slider} onChange={e => setGrayscale(e.target.value)} />
              </div>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}><span>Sepia Vintage</span><span className={styles.sliderValue}>{sepia}%</span></div>
                <input type="range" min="0" max="100" value={sepia} className={styles.slider} onChange={e => setSepia(e.target.value)} />
              </div>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}><span>Invert Colors</span><span className={styles.sliderValue}>{invert}%</span></div>
                <input type="range" min="0" max="100" value={invert} className={styles.slider} onChange={e => setInvert(e.target.value)} />
              </div>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}><span>Hue Rotation</span><span className={styles.sliderValue}>{hueRotate}°</span></div>
                <input type="range" min="0" max="360" value={hueRotate} className={styles.slider} onChange={e => setHueRotate(e.target.value)} />
              </div>
            </div>

            <div className={styles.previewBox}>
              {previewUrl && <img src={previewUrl} alt="Filtered Preview" className={styles.previewImg} />}
              <button className={styles.btnPrimary} style={{ marginTop: '16px', width: '100%' }} onClick={handleDownload}>
                <Download size={15} /> Download Filtered Image
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 5. MEME GENERATOR TOOL ─── */
export function MemeGeneratorTool() {
  const [file, setFile] = useState(null)
  const [topText, setTopText] = useState('WHEN YOU DISCOVER')
  const [bottomText, setBottomText] = useState('PDFZERO IS 100% FREE')
  const [fontSize, setFontSize] = useState(40)
  const [allCaps, setAllCaps] = useState(true)
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    if (!file) return
    const timer = setTimeout(async () => {
      const res = await generateMeme(file, { topText, bottomText, fontSize, allCaps })
      setPreviewUrl(res.dataUrl)
    }, 120)
    return () => clearTimeout(timer)
  }, [file, topText, bottomText, fontSize, allCaps])

  const handleDownload = async () => {
    if (!file) return
    const res = await generateMeme(file, { topText, bottomText, fontSize, allCaps })
    triggerDownload(res.blob, `meme-${Date.now()}.png`)
    toast.success('Meme saved!')
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><ImageIcon size={16} /> Meme Generator</span>
        </div>
        <ImageDropper file={file} onFile={setFile} label="Upload template or photo for your meme" />

        {file && (
          <div className={styles.twoCol}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Top Text</label>
                <input
                  type="text"
                  className={styles.input}
                  value={topText}
                  onChange={(e) => setTopText(e.target.value)}
                  placeholder="TOP TEXT..."
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Bottom Text</label>
                <input
                  type="text"
                  className={styles.input}
                  value={bottomText}
                  onChange={(e) => setBottomText(e.target.value)}
                  placeholder="BOTTOM TEXT..."
                />
              </div>

              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>
                  <span>Font Size</span>
                  <span className={styles.sliderValue}>{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="80"
                  value={fontSize}
                  className={styles.slider}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allCaps}
                  onChange={(e) => setAllCaps(e.target.checked)}
                />
                Force ALL CAPS (Classic Meme Style)
              </label>
            </div>

            <div className={styles.previewBox}>
              {previewUrl && <img src={previewUrl} alt="Meme Preview" className={styles.previewImg} />}
              <button className={styles.btnPrimary} style={{ marginTop: '16px', width: '100%' }} onClick={handleDownload}>
                <Download size={15} /> Download Meme
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 6. COLOR PALETTE EXTRACTOR TOOL ─── */
export function PaletteExtractorTool() {
  const [file, setFile] = useState(null)
  const [palette, setPalette] = useState([])
  const [loading, setLoading] = useState(false)

  const handleFile = async (f) => {
    setFile(f)
    if (!f) {
      setPalette([])
      return
    }
    try {
      setLoading(true)
      const colors = await extractColorPalette(f, 8)
      setPalette(colors)
      toast.success('Extracted dominant color palette!')
    } catch (err) {
      toast.error('Palette extraction failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const copyColor = (hex) => {
    navigator.clipboard.writeText(hex)
    toast.success(`Copied ${hex} to clipboard!`)
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Palette size={16} /> Color Palette Extractor</span>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          Upload any photo, logo, or artwork to instantly extract the dominant color palette with hex codes. Click any color swatch to copy to your clipboard.
        </p>

        <ImageDropper file={file} onFile={handleFile} />

        {palette.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <span className={styles.fieldLabel} style={{ marginBottom: '8px' }}>Extracted Colors ({palette.length})</span>
            <div className={styles.colorSwatches}>
              {palette.map((c, i) => (
                <div
                  key={i}
                  className={styles.colorCard}
                  style={{ background: c.hex, color: c.isDark ? '#ffffff' : '#0f172a' }}
                  onClick={() => copyColor(c.hex)}
                  title="Click to copy HEX"
                >
                  <span className={styles.colorHex}>{c.hex}</span>
                  <span className={styles.colorRgb}>{c.rgb}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 7. SVG TO PNG / RASTERIZER TOOL ─── */
export function SvgRasterizerTool() {
  const [file, setFile] = useState(null)
  const [svgCode, setSvgCode] = useState('')
  const [scale, setScale] = useState(2)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFile = async (f) => {
    setFile(f)
    if (f) {
      const text = await f.text()
      setSvgCode(text)
    }
  }

  const handleRasterize = async () => {
    if (!svgCode.trim()) {
      toast.error('Please upload an SVG file or paste SVG code')
      return
    }
    try {
      setLoading(true)
      const res = await rasterizeSvg(svgCode, scale)
      setResult(res)
      toast.success(`Rasterized to ${res.width}x${res.height} PNG!`)
    } catch (err) {
      toast.error('SVG conversion failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Layers size={16} /> SVG to High-Res PNG Rasterizer</span>
        </div>

        <ImageDropper
          file={file}
          onFile={handleFile}
          accept={{ 'image/svg+xml': ['.svg'] }}
          label="Drop .SVG vector file here"
        />

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Or Paste SVG Code</label>
          <textarea
            className={styles.textarea}
            rows={4}
            placeholder="<svg xmlns='http://www.w3.org/2000/svg' ...>...</svg>"
            value={svgCode}
            onChange={(e) => setSvgCode(e.target.value)}
          />
        </div>

        <div className={styles.twoCol}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Export Resolution Scale</label>
            <select className={styles.select} value={scale} onChange={(e) => setScale(Number(e.target.value))}>
              <option value="1">1x (Standard resolution)</option>
              <option value="2">2x (Retina / Crisp HD)</option>
              <option value="4">4x (Ultra HD 4K Print)</option>
              <option value="8">8x (Super High-Res 8K)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className={styles.btnPrimary} style={{ width: '100%' }} onClick={handleRasterize} disabled={loading}>
              {loading ? 'Rendering...' : 'Rasterize to PNG'}
            </button>
          </div>
        </div>

        {result && (
          <div className={styles.previewBox} style={{ marginTop: '14px' }}>
            <img src={result.dataUrl} alt="Rasterized PNG" className={styles.previewImg} />
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className={styles.statBadge}>{result.width} x {result.height} px</span>
              <button className={styles.btnPrimary} onClick={() => triggerDownload(result.blob, 'rasterized.png')}>
                <Download size={14} /> Download PNG
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
