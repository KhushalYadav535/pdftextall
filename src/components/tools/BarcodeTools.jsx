import React, { useState, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import {
  Barcode, QrCode, Wifi, Contact, Download, Copy,
  Check, Camera, Upload, Eye, EyeOff, RefreshCw
} from 'lucide-react'
import {
  drawCode128Barcode, createWifiQrString, createVCardString, generateQrCode
} from '../../lib/barcodeEngine.js'
import styles from './StudioTools.module.css'

function triggerDownload(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

/* ─── 1. BARCODE GENERATOR TOOL ─── */
export function BarcodeGeneratorTool() {
  const [text, setText] = useState('PDFZERO-2026')
  const [barHeight, setBarHeight] = useState(80)
  const [barWidth, setBarWidth] = useState(2)
  const [showText, setShowText] = useState(true)
  const [barcodeImg, setBarcodeImg] = useState(null)

  useEffect(() => {
    if (!text.trim()) {
      setBarcodeImg(null)
      return
    }
    try {
      const res = drawCode128Barcode(text, { barWidth, barHeight, showText })
      setBarcodeImg(res.dataUrl)
    } catch {
      // invalid chars
    }
  }, [text, barHeight, barWidth, showText])

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Barcode size={16} /> 1D Barcode Generator (Code 128)</span>
          {barcodeImg && (
            <button className={styles.btnPrimary} onClick={() => triggerDownload(barcodeImg, `barcode-${text}.png`)}>
              <Download size={14} /> Download Barcode (.PNG)
            </button>
          )}
        </div>

        <div className={styles.twoCol}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Barcode Content / SKU</label>
              <input
                type="text"
                className={styles.input}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="e.g. ITEM-998234"
              />
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}><span>Bar Height</span><span className={styles.sliderValue}>{barHeight}px</span></div>
              <input type="range" min="40" max="150" value={barHeight} className={styles.slider} onChange={e => setBarHeight(Number(e.target.value))} />
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}><span>Bar Width Scale</span><span className={styles.sliderValue}>{barWidth}x</span></div>
              <input type="range" min="1" max="4" value={barWidth} className={styles.slider} onChange={e => setBarWidth(Number(e.target.value))} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showText} onChange={e => setShowText(e.target.checked)} />
              Show human-readable text under barcode
            </label>
          </div>

          <div className={styles.previewBox}>
            {barcodeImg ? (
              <img src={barcodeImg} alt="Generated Barcode" style={{ maxWidth: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>Type text to generate barcode</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 2. QR CODE SCANNER (CAMERA & IMAGE) ─── */
export function QrScannerTool() {
  const [scanning, setScanning] = useState(false)
  const [scannedResult, setScannedResult] = useState(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const animFrameRef = useRef(null)

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    setScanning(false)
  }

  useEffect(() => {
    return () => stopCamera()
  }, [])

  const startCamera = async () => {
    try {
      setScannedResult(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setScanning(true)
      scanLoop()
      toast.success('Camera active. Point at any QR code!')
    } catch (err) {
      toast.error('Unable to access camera: ' + err.message)
    }
  }

  const scanLoop = () => {
    if (!videoRef.current || !streamRef.current) return
    // If browser supports native BarcodeDetector
    if ('BarcodeDetector' in window) {
      const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] })
      detector.detect(videoRef.current)
        .then(codes => {
          if (codes && codes.length > 0) {
            setScannedResult(codes[0].rawValue)
            stopCamera()
            toast.success('QR Code detected!')
          } else {
            animFrameRef.current = requestAnimationFrame(scanLoop)
          }
        })
        .catch(() => {
          animFrameRef.current = requestAnimationFrame(scanLoop)
        })
    } else {
      animFrameRef.current = requestAnimationFrame(scanLoop)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
    onDrop: async ([file]) => {
      if (!file) return
      try {
        const img = new Image()
        img.src = URL.createObjectURL(file)
        await img.decode()

        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] })
          const codes = await detector.detect(img)
          if (codes && codes.length > 0) {
            setScannedResult(codes[0].rawValue)
            toast.success('QR Code successfully decoded from image!')
          } else {
            toast.error('No QR code detected in this image')
          }
        } else {
          toast.error('Native BarcodeDetector is not supported in this browser version. Please test camera scan or use Chrome.')
        }
      } catch (err) {
        toast.error('Scan error: ' + err.message)
      }
    }
  })

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Camera size={16} /> Camera & Image QR Code Scanner</span>
        </div>

        <div className={styles.twoCol}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {!scanning ? (
                <button className={styles.btnPrimary} style={{ flex: 1 }} onClick={startCamera}>
                  <Camera size={15} /> Scan with Camera
                </button>
              ) : (
                <button className={styles.btnDanger} style={{ flex: 1 }} onClick={stopCamera}>
                  Stop Camera
                </button>
              )}
            </div>

            <div {...getRootProps()} style={{ border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '24px 16px', textAlign: 'center', cursor: 'pointer', background: isDragActive ? '#f0fdf4' : '#f8fafc' }}>
              <input {...getInputProps()} />
              <Upload size={24} color="#10b981" style={{ margin: '0 auto 6px', display: 'block' }} />
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>Or drop image with QR code here</span>
            </div>
          </div>

          <div className={styles.previewBox} style={{ position: 'relative' }}>
            {scanning ? (
              <video ref={videoRef} style={{ width: '100%', maxHeight: '240px', borderRadius: '8px', objectFit: 'cover' }} />
            ) : scannedResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                <span className={styles.statBadge}>Decoded QR Content</span>
                <div className={styles.codeBox} style={{ color: '#38bdf8' }}>{scannedResult}</div>
                <button className={styles.btnSecondary} onClick={() => { navigator.clipboard.writeText(scannedResult); toast.success('Copied!'); }}>
                  <Copy size={13} /> Copy Scanned Content
                </button>
              </div>
            ) : (
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>Start camera or drop an image to scan</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 3. WIFI QR CODE GENERATOR ─── */
export function WifiQrTool() {
  const [ssid, setSsid] = useState('Home_WiFi_5G')
  const [password, setPassword] = useState('SuperSecretKey2026')
  const [encryption, setEncryption] = useState('WPA')
  const [hidden, setHidden] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [qrUrl, setQrUrl] = useState(null)

  useEffect(() => {
    if (!ssid.trim()) return
    const wifiString = createWifiQrString({ ssid, password, encryption, hidden })
    generateQrCode(wifiString, { width: 300 }).then(setQrUrl)
  }, [ssid, password, encryption, hidden])

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Wifi size={16} /> WiFi Instant-Connect QR Code</span>
          {qrUrl && (
            <button className={styles.btnPrimary} onClick={() => triggerDownload(qrUrl, `wifi-${ssid}-qr.png`)}>
              <Download size={14} /> Download QR (.PNG)
            </button>
          )}
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          Create a scannable WiFi QR code for your home, café, or office. Guests can simply point their smartphone camera at the code to connect instantly without typing any password.
        </p>

        <div className={styles.twoCol}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Network Name (SSID)</label>
              <input type="text" className={styles.input} value={ssid} onChange={e => setSsid(e.target.value)} placeholder="e.g. MyWiFi" />
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>
                <span>WiFi Password</span>
                <button className={styles.btnSecondary} style={{ padding: '2px 8px', fontSize: '10px' }} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={11} /> : <Eye size={11} />} {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input type={showPassword ? 'text' : 'password'} className={styles.input} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password..." />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Security Type</label>
              <select className={styles.select} value={encryption} onChange={e => setEncryption(e.target.value)}>
                <option value="WPA">WPA / WPA2 / WPA3 (Standard)</option>
                <option value="WEP">WEP (Legacy)</option>
                <option value="none">None (Open Network)</option>
              </select>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)} />
              Hidden Network (SSID is not broadcasting)
            </label>
          </div>

          <div className={styles.previewBox}>
            {qrUrl && <img src={qrUrl} alt="WiFi QR Code" style={{ width: '220px', height: '220px', borderRadius: '8px' }} />}
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginTop: '10px' }}>Scan with Camera to Connect</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 4. VCARD DIGITAL BUSINESS CARD QR ─── */
export function VCardQrTool() {
  const [firstName, setFirstName] = useState('Alex')
  const [lastName, setLastName] = useState('Morgan')
  const [phone, setPhone] = useState('+1 (555) 234-5678')
  const [email, setEmail] = useState('alex@example.com')
  const [org, setOrg] = useState('Tech Solutions Inc.')
  const [title, setTitle] = useState('Product Director')
  const [url, setUrl] = useState('https://pdfzero.org')
  const [qrUrl, setQrUrl] = useState(null)

  useEffect(() => {
    const vcard = createVCardString({ firstName, lastName, phone, email, org, title, url })
    generateQrCode(vcard, { width: 300 }).then(setQrUrl)
  }, [firstName, lastName, phone, email, org, title, url])

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Contact size={16} /> vCard Digital Business Card QR</span>
          {qrUrl && (
            <button className={styles.btnPrimary} onClick={() => triggerDownload(qrUrl, `contact-${firstName}-${lastName}.png`)}>
              <Download size={14} /> Download Contact QR (.PNG)
            </button>
          )}
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          Generate a digital business card. When someone scans this QR code with their phone, it prompts them to save your contact information directly into their phone address book.
        </p>

        <div className={styles.twoCol}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div className={styles.fieldGroup} style={{ flex: 1 }}>
                <label className={styles.fieldLabel}>First Name</label>
                <input type="text" className={styles.input} value={firstName} onChange={e => setFirstName(e.target.value)} />
              </div>
              <div className={styles.fieldGroup} style={{ flex: 1 }}>
                <label className={styles.fieldLabel}>Last Name</label>
                <input type="text" className={styles.input} value={lastName} onChange={e => setLastName(e.target.value)} />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Phone Number</label>
              <input type="text" className={styles.input} value={phone} onChange={e => setPhone(e.target.value)} />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Email Address</label>
              <input type="email" className={styles.input} value={email} onChange={e => setEmail(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div className={styles.fieldGroup} style={{ flex: 1 }}>
                <label className={styles.fieldLabel}>Organization</label>
                <input type="text" className={styles.input} value={org} onChange={e => setOrg(e.target.value)} />
              </div>
              <div className={styles.fieldGroup} style={{ flex: 1 }}>
                <label className={styles.fieldLabel}>Job Title</label>
                <input type="text" className={styles.input} value={title} onChange={e => setTitle(e.target.value)} />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Website URL</label>
              <input type="text" className={styles.input} value={url} onChange={e => setUrl(e.target.value)} />
            </div>
          </div>

          <div className={styles.previewBox}>
            {qrUrl && <img src={qrUrl} alt="Contact QR Code" style={{ width: '220px', height: '220px', borderRadius: '8px' }} />}
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginTop: '10px' }}>
              Scan to Save Contact to Phone
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
