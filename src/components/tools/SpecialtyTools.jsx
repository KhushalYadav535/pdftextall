import React, { useState } from 'react'
import {
  Upload, Download, RefreshCw, PenTool, Circle, Maximize2,
  FileArchive, Sparkles, Grid, Layers, Award, Calculator,
  Copy, FileText, Check, Trash2, ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  extractSignature, createCircularAvatar, createNoCropSquare,
  batchRenameImages, applyDuotoneFilter, convertToPixelArt
} from '../../lib/imageProEngine.js'
import {
  interleavePdfs, generateBulkCertificates, calculatePdfPagesAndCost,
  duplicatePdfPages
} from '../../lib/pdfProEngine.js'
import styles from './StudioTools.module.css'

/* ─────────────────────────────────────────────────────────────
   1. Paper Signature Extractor
───────────────────────────────────────────────────────────── */
export function SignatureExtractorTool() {
  const [file, setFile] = useState(null)
  const [threshold, setThreshold] = useState(185)
  const [inkMode, setInkMode] = useState('blue') // 'original', 'blue', 'black'
  const [resultUrl, setResultUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleProcess = async () => {
    if (!file) return
    setLoading(true)
    try {
      const blob = await extractSignature(file, threshold, inkMode)
      setResultUrl(URL.createObjectURL(blob))
      toast.success('Signature extracted with transparent background!')
    } catch (err) {
      toast.error('Extraction error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <PenTool size={20} className={styles.toolIcon} />
        <div>
          <h3>Paper Signature Extractor (Transparent PNG)</h3>
          <p>Extract handwritten signatures from photos of paper into transparent digital PNGs.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop photo of paper signature</span>
            <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0]); setResultUrl(null); }} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <div className={styles.inputGroup}>
                <label>Ink Color Enhancement:</label>
                <select value={inkMode} onChange={(e) => setInkMode(e.target.value)}>
                  <option value="blue">Enhance to Royal Blue</option>
                  <option value="black">Enhance to Deep Black</option>
                  <option value="original">Preserve Original Ink</option>
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label>Paper Clean Threshold ({threshold}):</label>
                <input
                  type="range"
                  min="130"
                  max="240"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                />
              </div>

              <button className={styles.primaryBtn} onClick={handleProcess} disabled={loading}>
                <PenTool size={16} />
                {loading ? 'Extracting...' : 'Extract Transparent Signature'}
              </button>
            </div>

            {resultUrl && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <div style={{
                  display: 'inline-block',
                  background: 'repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%) 50% / 16px 16px',
                  padding: 16,
                  borderRadius: 12,
                  border: '1px solid #cbd5e1'
                }}>
                  <img src={resultUrl} alt="Signature" style={{ maxHeight: 180, maxWidth: '100%' }} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <a href={resultUrl} download="transparent-signature.png" className={styles.downloadBtn}>
                    <Download size={16} /> Download Transparent PNG Signature
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
   2. Circular Avatar & Profile Picture Maker
───────────────────────────────────────────────────────────── */
export function CircularAvatarTool() {
  const [file, setFile] = useState(null)
  const [borderColor, setBorderColor] = useState('#10b981')
  const [borderWidth, setBorderWidth] = useState(12)
  const [resultUrl, setResultUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    if (!file) return
    setLoading(true)
    try {
      const blob = await createCircularAvatar(file, { borderColor, borderWidth })
      setResultUrl(URL.createObjectURL(blob))
      toast.success('Circular Avatar Created!')
    } catch (err) {
      toast.error('Avatar error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Circle size={20} className={styles.toolIcon} />
        <div>
          <h3>Circular Avatar & Profile Picture Maker</h3>
          <p>Crop photos into circular PFP avatars with ring borders for WhatsApp, LinkedIn, and GitHub.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop photo for profile avatar</span>
            <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0]); setResultUrl(null); }} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <div className={styles.inputGroup}>
                <label>Ring Border Color:</label>
                <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} style={{ width: 44, height: 36 }} />
              </div>

              <div className={styles.inputGroup}>
                <label>Border Width ({borderWidth}px):</label>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={borderWidth}
                  onChange={(e) => setBorderWidth(Number(e.target.value))}
                />
              </div>

              <button className={styles.primaryBtn} onClick={handleGenerate} disabled={loading}>
                <Circle size={16} />
                {loading ? 'Creating...' : 'Generate Avatar'}
              </button>
            </div>

            {resultUrl && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <img src={resultUrl} alt="Avatar" style={{ maxHeight: 240, maxWidth: '100%', borderRadius: '50%' }} />
                <div style={{ marginTop: 12 }}>
                  <a href={resultUrl} download="circular-avatar.png" className={styles.downloadBtn}>
                    <Download size={16} /> Download Circular PNG
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
   3. No-Crop Square & Blur Padder
───────────────────────────────────────────────────────────── */
export function NoCropSquareTool() {
  const [file, setFile] = useState(null)
  const [bgMode, setBgMode] = useState('blur') // 'blur', 'solid'
  const [blurAmount, setBlurAmount] = useState(24)
  const [solidColor, setSolidColor] = useState('#ffffff')
  const [resultUrl, setResultUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleProcess = async () => {
    if (!file) return
    setLoading(true)
    try {
      const blob = await createNoCropSquare(file, { bgMode, blur: blurAmount, solidColor })
      setResultUrl(URL.createObjectURL(blob))
      toast.success('1:1 Square created without cropping!')
    } catch (err) {
      toast.error('No-crop error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Maximize2 size={20} className={styles.toolIcon} />
        <div>
          <h3>No-Crop Square & Blur Padder</h3>
          <p>Fit rectangular photos into 1:1 Instagram/WhatsApp square without cropping using blurred padding.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop photo to pad to 1:1 square</span>
            <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0]); setResultUrl(null); }} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <div className={styles.inputGroup}>
                <label>Background Style:</label>
                <select value={bgMode} onChange={(e) => setBgMode(e.target.value)}>
                  <option value="blur">Blurred Replica Canvas</option>
                  <option value="solid">Solid Background Color</option>
                </select>
              </div>

              {bgMode === 'blur' ? (
                <div className={styles.inputGroup}>
                  <label>Blur Intensity ({blurAmount}px):</label>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={blurAmount}
                    onChange={(e) => setBlurAmount(Number(e.target.value))}
                  />
                </div>
              ) : (
                <div className={styles.inputGroup}>
                  <label>Pad Color:</label>
                  <input type="color" value={solidColor} onChange={(e) => setSolidColor(e.target.value)} style={{ width: 44, height: 36 }} />
                </div>
              )}

              <button className={styles.primaryBtn} onClick={handleProcess} disabled={loading}>
                <Sparkles size={16} />
                {loading ? 'Padding...' : 'Fit to 1:1 Square'}
              </button>
            </div>

            {resultUrl && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <img src={resultUrl} alt="Square" style={{ maxHeight: 320, maxWidth: '100%', borderRadius: 8 }} />
                <div style={{ marginTop: 12 }}>
                  <a href={resultUrl} download="no-crop-square.jpg" className={styles.downloadBtn}>
                    <Download size={16} /> Download 1:1 Square Photo
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
   4. Batch Image Renamer & Sequencer
───────────────────────────────────────────────────────────── */
export function BatchRenamerTool() {
  const [files, setFiles] = useState([])
  const [baseName, setBaseName] = useState('Trip_Photo')
  const [startNum, setStartNum] = useState(1)
  const [addDate, setAddDate] = useState(true)
  const [zipBlob, setZipBlob] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFiles = (e) => {
    const list = Array.from(e.target.files || [])
    if (list.length > 0) {
      setFiles((prev) => [...prev, ...list])
      setZipBlob(null)
    }
  }

  const handleRename = async () => {
    if (files.length === 0) return
    setLoading(true)
    try {
      const zip = await batchRenameImages(files, { baseName, startNum, addDate })
      setZipBlob(zip)
      toast.success(`Renamed ${files.length} images into ZIP!`)
    } catch (err) {
      toast.error('Rename error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <FileArchive size={20} className={styles.toolIcon} />
        <div>
          <h3>Batch Image Renamer & Sequencer</h3>
          <p>Sequentially rename dozens of photos with clean prefixes, numbers, and dates into a ZIP package.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        <div className={styles.controlsCol}>
          <div className={styles.settingsRow}>
            <label className={styles.secondaryBtn} style={{ cursor: 'pointer' }}>
              <Upload size={15} /> Select Photos ({files.length})
              <input type="file" accept="image/*" multiple onChange={handleFiles} hidden />
            </label>

            <div className={styles.inputGroup}>
              <label>Base Filename:</label>
              <input type="text" value={baseName} onChange={(e) => setBaseName(e.target.value)} />
            </div>

            <div className={styles.inputGroup}>
              <label>Start #:</label>
              <input type="number" value={startNum} onChange={(e) => setStartNum(Number(e.target.value))} style={{ width: 70 }} />
            </div>

            <div className={styles.inputGroup}>
              <label>Include Date:</label>
              <input type="checkbox" checked={addDate} onChange={(e) => setAddDate(e.target.checked)} />
            </div>

            <button className={styles.primaryBtn} onClick={handleRename} disabled={loading || files.length === 0}>
              <FileArchive size={16} />
              {loading ? 'Packing...' : 'Rename & Download ZIP'}
            </button>
          </div>

          {zipBlob && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <a href={URL.createObjectURL(zipBlob)} download="renamed-images.zip" className={styles.downloadBtn}>
                <Download size={16} /> Download Renamed Images (ZIP)
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   5. Spotify Duotone Color Filter
───────────────────────────────────────────────────────────── */
export function DuotoneTool() {
  const [file, setFile] = useState(null)
  const [darkHex, setDarkHex] = useState('#0f172a')
  const [lightHex, setLightHex] = useState('#ec4899')
  const [resultUrl, setResultUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleApply = async () => {
    if (!file) return
    setLoading(true)
    try {
      const blob = await applyDuotoneFilter(file, darkHex, lightHex)
      setResultUrl(URL.createObjectURL(blob))
      toast.success('Duotone filter applied!')
    } catch (err) {
      toast.error('Duotone error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Sparkles size={20} className={styles.toolIcon} />
        <div>
          <h3>Spotify-Style Duotone Color Filter</h3>
          <p>Transform photos into trendy 2-color poster artwork with custom dark and light tones.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop photo for Duotone filter</span>
            <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0]); setResultUrl(null); }} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <div className={styles.inputGroup}>
                <label>Shadow Color:</label>
                <input type="color" value={darkHex} onChange={(e) => setDarkHex(e.target.value)} style={{ width: 44, height: 36 }} />
              </div>

              <div className={styles.inputGroup}>
                <label>Highlight Color:</label>
                <input type="color" value={lightHex} onChange={(e) => setLightHex(e.target.value)} style={{ width: 44, height: 36 }} />
              </div>

              <button className={styles.primaryBtn} onClick={handleApply} disabled={loading}>
                <Sparkles size={16} />
                {loading ? 'Styling...' : 'Apply Duotone'}
              </button>
            </div>

            {resultUrl && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <img src={resultUrl} alt="Duotone" style={{ maxHeight: 320, maxWidth: '100%', borderRadius: 8 }} />
                <div style={{ marginTop: 12 }}>
                  <a href={resultUrl} download="duotone-artwork.jpg" className={styles.downloadBtn}>
                    <Download size={16} /> Download Duotone Artwork
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
   6. 8-Bit Pixel Art Converter
───────────────────────────────────────────────────────────── */
export function PixelArtTool() {
  const [file, setFile] = useState(null)
  const [pixelSize, setPixelSize] = useState(12)
  const [resultUrl, setResultUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleConvert = async () => {
    if (!file) return
    setLoading(true)
    try {
      const blob = await convertToPixelArt(file, pixelSize)
      setResultUrl(URL.createObjectURL(blob))
      toast.success('Converted to 8-Bit Pixel Art!')
    } catch (err) {
      toast.error('Pixel art error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Grid size={20} className={styles.toolIcon} />
        <div>
          <h3>8-Bit Pixel Art Video Game Converter</h3>
          <p>Transform photos into retro video game pixel art with customizable block size.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop photo to convert to 8-bit pixel art</span>
            <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0]); setResultUrl(null); }} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <div className={styles.inputGroup}>
                <label>Pixel Block Size ({pixelSize}px):</label>
                <input
                  type="range"
                  min="4"
                  max="30"
                  value={pixelSize}
                  onChange={(e) => setPixelSize(Number(e.target.value))}
                />
              </div>

              <button className={styles.primaryBtn} onClick={handleConvert} disabled={loading}>
                <Grid size={16} />
                {loading ? 'Pixelating...' : 'Render Pixel Art'}
              </button>
            </div>

            {resultUrl && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <img src={resultUrl} alt="Pixel Art" style={{ maxHeight: 320, maxWidth: '100%', imageRendering: 'pixelated', borderRadius: 8 }} />
                <div style={{ marginTop: 12 }}>
                  <a href={resultUrl} download="pixel-art.png" className={styles.downloadBtn}>
                    <Download size={16} /> Download 8-Bit Pixel Art PNG
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
   7. Alternate & Mix (Double-Sided Scanner Interleaver)
───────────────────────────────────────────────────────────── */
export function PdfInterleaveTool() {
  const [oddFile, setOddFile] = useState(null)
  const [evenFile, setEvenFile] = useState(null)
  const [reverseEven, setReverseEven] = useState(true)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleMerge = async () => {
    if (!oddFile || !evenFile) {
      toast('Please upload both Odd and Even scan PDF files', { icon: 'ℹ️' })
      return
    }
    setLoading(true)
    try {
      const oddBuf = await oddFile.arrayBuffer()
      const evenBuf = await evenFile.arrayBuffer()
      const outBytes = await interleavePdfs(oddBuf, evenBuf, reverseEven)
      const blob = new Blob([outBytes], { type: 'application/pdf' })
      setDownloadUrl(URL.createObjectURL(blob))
      toast.success('Scans interleaved into 1 sequential PDF!')
    } catch (err) {
      toast.error('Interleave error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Layers size={20} className={styles.toolIcon} />
        <div>
          <h3>Alternate & Mix (Double-Sided Scanner Interleaver)</h3>
          <p>Collate Odd-page scans (1, 3, 5) and Even-page scans (6, 4, 2) into 1 correctly sorted PDF.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        <div className={styles.controlsCol}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label className={styles.dropZone} style={{ minHeight: 120 }}>
              <Upload size={24} />
              <span>{oddFile ? `Odd: ${oddFile.name}` : 'Drop Odd Pages PDF (1, 3, 5)'}</span>
              <input type="file" accept="application/pdf" onChange={(e) => setOddFile(e.target.files?.[0])} hidden />
            </label>

            <label className={styles.dropZone} style={{ minHeight: 120 }}>
              <Upload size={24} />
              <span>{evenFile ? `Even: ${evenFile.name}` : 'Drop Even Pages PDF (6, 4, 2)'}</span>
              <input type="file" accept="application/pdf" onChange={(e) => setEvenFile(e.target.files?.[0])} hidden />
            </label>
          </div>

          <div className={styles.settingsRow} style={{ marginTop: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={reverseEven}
                onChange={(e) => setReverseEven(e.target.checked)}
              />
              Reverse Even Pages (Normal for feeder scanners)
            </label>

            <button
              className={styles.primaryBtn}
              onClick={handleMerge}
              disabled={loading || !oddFile || !evenFile}
            >
              <Layers size={16} />
              {loading ? 'Collation in progress...' : 'Interleave & Merge Scans'}
            </button>
          </div>

          {downloadUrl && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <a href={downloadUrl} download="collated-document.pdf" className={styles.downloadBtn}>
                <Download size={16} /> Download Collated PDF
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   8. Bulk Certificate & Award Generator
───────────────────────────────────────────────────────────── */
export function CertificateGeneratorTool() {
  const [templateFile, setTemplateFile] = useState(null)
  const [namesText, setNamesText] = useState('John Doe\nJane Smith\nKhushal Yadav\nAarav Sharma\nPriya Patel')
  const [fontSize, setFontSize] = useState(32)
  const [posY, setPosY] = useState(280)
  const [progress, setProgress] = useState('')
  const [zipBlob, setZipBlob] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    if (!templateFile) {
      toast('Please upload a PDF certificate template', { icon: 'ℹ️' })
      return
    }
    const names = namesText.split('\n').map((n) => n.trim()).filter(Boolean)
    if (names.length === 0) {
      toast('Please enter at least one recipient name', { icon: 'ℹ️' })
      return
    }

    setLoading(true)
    try {
      const templateBuf = await templateFile.arrayBuffer()
      const zip = await generateBulkCertificates(templateBuf, names, {
        fontSize,
        posY,
        onProgress: (curr, total) => setProgress(`Generating ${curr} of ${total}...`)
      })
      setZipBlob(zip)
      toast.success(`Generated ${names.length} certificates!`)
    } catch (err) {
      toast.error('Certificate generation error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Award size={20} className={styles.toolIcon} />
        <div>
          <h3>Bulk Certificate & Award Generator</h3>
          <p>Upload 1 certificate template + paste names list → generate personalized certificates for everyone as a ZIP.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        <div className={styles.controlsCol}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className={styles.dropZone} style={{ minHeight: 140 }}>
                <Upload size={24} />
                <span>{templateFile ? templateFile.name : 'Drop 1-Page PDF Certificate Template'}</span>
                <input type="file" accept="application/pdf" onChange={(e) => setTemplateFile(e.target.files?.[0])} hidden />
              </label>

              <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label>Font Size ({fontSize}pt):</label>
                  <input type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
                </div>
                <div className={styles.inputGroup} style={{ flex: 1 }}>
                  <label>Vertical Position Y ({posY}pt):</label>
                  <input type="number" value={posY} onChange={(e) => setPosY(Number(e.target.value))} />
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                Recipient Names (1 name per line):
              </label>
              <textarea
                value={namesText}
                onChange={(e) => setNamesText(e.target.value)}
                rows={6}
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: 8,
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontFamily: 'inherit',
                  fontSize: 13
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button
              className={styles.primaryBtn}
              onClick={handleGenerate}
              disabled={loading || !templateFile}
            >
              <Award size={16} />
              {loading ? progress : 'Generate All Certificates (ZIP)'}
            </button>
          </div>

          {zipBlob && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <a href={URL.createObjectURL(zipBlob)} download="certificates.zip" className={styles.downloadBtn}>
                <Download size={16} /> Download All Certificates (ZIP)
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   9. Bulk PDF Page Counter & Print Cost Estimator
───────────────────────────────────────────────────────────── */
export function PdfCostCalculatorTool() {
  const [files, setFiles] = useState([])
  const [rate, setRate] = useState(2) // 2 Rs per page
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFiles = async (e) => {
    const list = Array.from(e.target.files || [])
    if (list.length === 0) return
    setFiles(list)
    setLoading(true)
    try {
      const res = await calculatePdfPagesAndCost(list, rate)
      setStats(res)
    } catch (err) {
      toast.error('Calculation error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRateChange = (newRate) => {
    setRate(newRate)
    if (stats) {
      setStats({
        ...stats,
        ratePerPage: newRate,
        totalCost: stats.totalPages * newRate,
        files: stats.files.map((f) => ({ ...f, cost: f.pages * newRate }))
      })
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Calculator size={20} className={styles.toolIcon} />
        <div>
          <h3>Bulk PDF Page Counter & Print Cost Estimator</h3>
          <p>Inspect multiple PDFs to count total pages and calculate total printing expenses.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        <div className={styles.controlsCol}>
          <div className={styles.settingsRow}>
            <label className={styles.secondaryBtn} style={{ cursor: 'pointer' }}>
              <Upload size={15} /> Select PDF Documents
              <input type="file" accept="application/pdf" multiple onChange={handleFiles} hidden />
            </label>

            <div className={styles.inputGroup}>
              <label>Rate per Page (₹ / $):</label>
              <input
                type="number"
                value={rate}
                onChange={(e) => handleRateChange(Number(e.target.value))}
                style={{ width: 80 }}
              />
            </div>
          </div>

          {loading && <p style={{ marginTop: 12 }}>Inspecting PDF pages...</p>}

          {stats && (
            <div style={{ marginTop: 16 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 12,
                background: '#f8fafc',
                padding: 16,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                textAlign: 'center'
              }}>
                <div>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Total Documents</span>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>{stats.totalFiles}</div>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Grand Total Pages</span>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#3b82f6' }}>{stats.totalPages}</div>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Estimated Total Cost</span>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981' }}>₹{stats.totalCost.toFixed(2)}</div>
                </div>
              </div>

              <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Document Name</th>
                    <th style={{ padding: '8px 12px' }}>Pages</th>
                    <th style={{ padding: '8px 12px' }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.files.map((f, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 12px' }}>{f.name}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{f.pages}</td>
                      <td style={{ padding: '8px 12px', color: '#10b981', fontWeight: 600 }}>₹{f.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   10. PDF Page Duplicator / Multiple Copy Repeater
───────────────────────────────────────────────────────────── */
export function PdfDuplicateTool() {
  const [file, setFile] = useState(null)
  const [copies, setCopies] = useState(5)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleDuplicate = async () => {
    if (!file) return
    setLoading(true)
    try {
      const buf = await file.arrayBuffer()
      const outBytes = await duplicatePdfPages(buf, copies)
      const blob = new Blob([outBytes], { type: 'application/pdf' })
      setDownloadUrl(URL.createObjectURL(blob))
      toast.success(`Created ${copies} copies in 1 PDF!`)
    } catch (err) {
      toast.error('Duplicate error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.studioCard}>
      <div className={styles.toolHeader}>
        <Copy size={20} className={styles.toolIcon} />
        <div>
          <h3>PDF Page Duplicator / Print Multi-Copy Repeater</h3>
          <p>Repeat a form, ticket, receipt, or flyer 5x, 10x, or 50x in a single PDF for mass printing.</p>
        </div>
      </div>

      <div className={styles.toolBody}>
        {!file ? (
          <label className={styles.dropZone}>
            <Upload size={32} />
            <span>Drop single-page or multi-page PDF to duplicate</span>
            <input type="file" accept="application/pdf" onChange={(e) => { setFile(e.target.files?.[0]); setDownloadUrl(null); }} hidden />
          </label>
        ) : (
          <div className={styles.controlsCol}>
            <div className={styles.settingsRow}>
              <div className={styles.inputGroup}>
                <label>Number of Copies:</label>
                <select value={copies} onChange={(e) => setCopies(Number(e.target.value))}>
                  <option value={2}>2 Copies</option>
                  <option value={5}>5 Copies</option>
                  <option value={10}>10 Copies</option>
                  <option value={20}>20 Copies</option>
                  <option value={50}>50 Copies</option>
                </select>
              </div>

              <button className={styles.primaryBtn} onClick={handleDuplicate} disabled={loading}>
                <Copy size={16} />
                {loading ? 'Duplicating...' : `Generate ${copies}x PDF`}
              </button>
            </div>

            {downloadUrl && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <a href={downloadUrl} download={`replicated-${copies}x-${file.name}`} className={styles.downloadBtn}>
                  <Download size={16} /> Download {copies}-Copy PDF
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
