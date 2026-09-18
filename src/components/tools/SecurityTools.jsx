import React, { useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import {
  ShieldCheck, Lock, Unlock, EyeOff, Key, ShieldAlert,
  Download, Copy, Check, RefreshCw, Sparkles, FileText, Image as ImageIcon
} from 'lucide-react'
import {
  encryptFile, decryptFile, hideTextInImage, revealTextFromImage,
  generatePassword, stripExifFromImage
} from '../../lib/cryptoEngine.js'
import styles from './StudioTools.module.css'

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

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

function GenericDropper({ onFile, file, label, accept }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxFiles: 1,
    onDrop: ([f]) => f && onFile(f)
  })

  if (file) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={18} color="#10b981" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{file.name}</span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>({(file.size / 1024).toFixed(1)} KB)</span>
        </div>
        <button className={styles.btnSecondary} onClick={() => onFile(null)}>Change File</button>
      </div>
    )
  }

  return (
    <div {...getRootProps()} style={{ border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '30px 20px', textAlign: 'center', cursor: 'pointer', background: isDragActive ? '#f0fdf4' : '#f8fafc', transition: 'all 0.2s' }}>
      <input {...getInputProps()} />
      <FileText size={30} color="#10b981" style={{ margin: '0 auto 8px', display: 'block' }} />
      <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#334155' }}>{isDragActive ? 'Drop file here...' : label}</p>
    </div>
  )
}

/* ─── 1. AES-256 FILE & NOTE ENCRYPTOR ─── */
export function AesEncryptTool() {
  const [mode, setMode] = useState('encrypt') // 'encrypt' | 'decrypt'
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultBlob, setResultBlob] = useState(null)

  const handleAction = async () => {
    if (!file) {
      toast.error('Please select a file first')
      return
    }
    if (!password) {
      toast.error('Password is required')
      return
    }
    if (mode === 'encrypt' && password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    try {
      setLoading(true)
      if (mode === 'encrypt') {
        const encrypted = await encryptFile(file, password)
        setResultBlob(encrypted)
        triggerDownload(encrypted, `${file.name}.locked`)
        toast.success('File encrypted with military-grade AES-256!')
      } else {
        const decrypted = await decryptFile(file, password)
        setResultBlob(decrypted)
        const cleanName = file.name.endsWith('.locked') ? file.name.replace(/\.locked$/, '') : `decrypted-${file.name}`
        triggerDownload(decrypted, cleanName)
        toast.success('File decrypted successfully!')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>
            {mode === 'encrypt' ? <Lock size={16} /> : <Unlock size={16} />}
            AES-256 Zero-Knowledge File Encryptor & Decryptor
          </span>
          <div className={styles.pillTabs}>
            <button className={`${styles.pillBtn} ${mode === 'encrypt' ? styles.pillBtnActive : ''}`} onClick={() => { setMode('encrypt'); setResultBlob(null); }}>Encrypt</button>
            <button className={`${styles.pillBtn} ${mode === 'decrypt' ? styles.pillBtnActive : ''}`} onClick={() => { setMode('decrypt'); setResultBlob(null); }}>Decrypt</button>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          {mode === 'encrypt'
            ? 'Encrypt any document, photo, video, or archive with standard AES-256-GCM using 100,000 PBKDF2 iterations. Only your password can unlock it.'
            : 'Select an encrypted (.locked) file and type your secret password to restore the original unencrypted file.'}
        </p>

        <GenericDropper
          file={file}
          onFile={(f) => { setFile(f); setResultBlob(null); }}
          label={mode === 'encrypt' ? 'Drop any file to encrypt with AES-256' : 'Drop .locked encrypted file to decrypt'}
        />

        {file && (
          <div className={styles.twoCol} style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Secret Password</label>
                <input
                  type="password"
                  className={styles.input}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter strong encryption key..."
                />
              </div>

              {mode === 'encrypt' && (
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Confirm Password</label>
                  <input
                    type="password"
                    className={styles.input}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password..."
                  />
                </div>
              )}

              <button className={styles.btnPrimary} onClick={handleAction} disabled={loading}>
                {loading ? 'Processing...' : mode === 'encrypt' ? 'Encrypt & Download (.locked)' : 'Decrypt File'}
              </button>
            </div>

            <div className={styles.previewBox}>
              <ShieldCheck size={42} color="#10b981" style={{ marginBottom: '10px' }} />
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                {mode === 'encrypt' ? 'End-to-End Client Encryption' : 'Authenticated Decryption'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', marginTop: '4px' }}>
                Processed entirely on your device via Web Crypto API. Zero server storage.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 2. STEGANOGRAPHY (HIDE TEXT IN IMAGE) ─── */
export function SteganographyTool() {
  const [mode, setMode] = useState('hide') // 'hide' | 'reveal'
  const [file, setFile] = useState(null)
  const [secretText, setSecretText] = useState('')
  const [revealedText, setRevealedText] = useState('')
  const [loading, setLoading] = useState(false)

  const handleProcess = async () => {
    if (!file) {
      toast.error('Please upload an image')
      return
    }

    try {
      setLoading(true)
      if (mode === 'hide') {
        if (!secretText.trim()) {
          toast.error('Please enter secret text to hide')
          return
        }
        const stegoBlob = await hideTextInImage(file, secretText)
        triggerDownload(stegoBlob, `secret-${file.name.replace(/\.[^/.]+$/, '')}.png`)
        toast.success('Secret message invisibly embedded in image!')
      } else {
        const text = await revealTextFromImage(file)
        setRevealedText(text)
        toast.success('Secret message revealed!')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><EyeOff size={16} /> Steganography: Hide Secret Text in Images</span>
          <div className={styles.pillTabs}>
            <button className={`${styles.pillBtn} ${mode === 'hide' ? styles.pillBtnActive : ''}`} onClick={() => { setMode('hide'); setRevealedText(''); }}>Hide Message</button>
            <button className={`${styles.pillBtn} ${mode === 'reveal' ? styles.pillBtnActive : ''}`} onClick={() => { setMode('reveal'); setRevealedText(''); }}>Reveal Message</button>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          {mode === 'hide'
            ? 'Embed secret confidential text into the invisible least-significant bits (LSB) of an image. The exported image looks 100% normal to the human eye.'
            : 'Upload an image containing a hidden message to extract and decode the original secret text.'}
        </p>

        <GenericDropper
          file={file}
          onFile={(f) => { setFile(f); setRevealedText(''); }}
          accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }}
          label="Drop carrier image (PNG recommended)"
        />

        {mode === 'hide' ? (
          <div className={styles.fieldGroup} style={{ marginTop: '10px' }}>
            <label className={styles.fieldLabel}>Secret Message to Hide</label>
            <textarea
              className={styles.textarea}
              rows={4}
              value={secretText}
              onChange={e => setSecretText(e.target.value)}
              placeholder="Type top-secret message, passwords, or recovery seeds here..."
            />
            <button className={styles.btnPrimary} style={{ marginTop: '10px', alignSelf: 'flex-start' }} onClick={handleProcess} disabled={loading || !file}>
              <Download size={14} /> {loading ? 'Encoding...' : 'Embed Secret & Download Stego Image (.png)'}
            </button>
          </div>
        ) : (
          <div style={{ marginTop: '10px' }}>
            <button className={styles.btnPrimary} onClick={handleProcess} disabled={loading || !file} style={{ marginBottom: '14px' }}>
              <EyeOff size={14} /> {loading ? 'Scanning Pixels...' : 'Extract & Reveal Hidden Secret'}
            </button>

            {revealedText && (
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>Decoded Secret Message</span>
                  <CopyButton text={revealedText} />
                </div>
                <textarea
                  className={styles.textarea}
                  rows={4}
                  value={revealedText}
                  readOnly
                  style={{ background: '#f8fafc', fontWeight: 600, color: '#0f172a' }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 3. PASSWORD GENERATOR & ENTROPY METER ─── */
export function PasswordGeneratorTool() {
  const [length, setLength] = useState(20)
  const [uppercase, setUppercase] = useState(true)
  const [lowercase, setLowercase] = useState(true)
  const [numbers, setNumbers] = useState(true)
  const [symbols, setSymbols] = useState(true)
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(true)
  const [passData, setPassData] = useState(null)

  const regenerate = () => {
    const res = generatePassword({ length, uppercase, lowercase, numbers, symbols, avoidAmbiguous })
    setPassData(res)
  }

  useEffect(() => {
    regenerate()
  }, [length, uppercase, lowercase, numbers, symbols, avoidAmbiguous])

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Key size={16} /> Cryptographically Secure Password Generator</span>
          <button className={styles.btnPrimary} onClick={regenerate}>
            <RefreshCw size={13} /> Regenerate
          </button>
        </div>

        {passData && (
          <div style={{ background: '#0f172a', borderRadius: '10px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: '#38bdf8', letterSpacing: '1px', wordBreak: 'break-all' }}>
              {passData.password}
            </span>
            <CopyButton text={passData.password} label="Copy" />
          </div>
        )}

        {passData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Strength:</span>
            <span className={styles.statBadge} style={{ color: passData.color, borderColor: passData.color }}>
              {passData.strength} ({passData.entropy} bits entropy)
            </span>
          </div>
        )}

        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabel}>
            <span>Password Length</span>
            <span className={styles.sliderValue}>{length} characters</span>
          </div>
          <input
            type="range"
            min="8"
            max="64"
            value={length}
            className={styles.slider}
            onChange={e => setLength(Number(e.target.value))}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginTop: '6px' }}>
          {[
            { label: 'Uppercase (A-Z)', val: uppercase, set: setUppercase },
            { label: 'Lowercase (a-z)', val: lowercase, set: setLowercase },
            { label: 'Numbers (0-9)', val: numbers, set: setNumbers },
            { label: 'Symbols (!@#$%)', val: symbols, set: setSymbols },
            { label: 'Avoid Ambiguous (O, 0, l, 1)', val: avoidAmbiguous, set: setAvoidAmbiguous },
          ].map(opt => (
            <label key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input type="checkbox" checked={opt.val} onChange={e => opt.set(e.target.checked)} />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── 4. EXIF METADATA STRIPPER FOR PHOTOS ─── */
export function ExifStripperTool() {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleClean = async (f) => {
    setFile(f)
    if (!f) {
      setResult(null)
      return
    }
    try {
      setLoading(true)
      const res = await stripExifFromImage(f)
      setResult(res)
      toast.success('All EXIF and GPS metadata permanently wiped!')
    } catch (err) {
      toast.error('Failed to clean metadata: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><ShieldAlert size={16} /> Photo EXIF & Privacy Metadata Stripper</span>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          Wipe sensitive GPS coordinates, camera serial numbers, exposure metadata, and phone timestamps from your photos before sharing on the web or social media.
        </p>

        <GenericDropper
          file={file}
          onFile={handleClean}
          accept={{ 'image/*': ['.jpg', '.jpeg', '.png'] }}
          label="Drop JPEG or PNG photo to wipe metadata"
        />

        {result && (
          <div className={styles.previewBox} style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <span className={styles.statBadge}>Original: {(result.originalSize / 1024).toFixed(1)} KB</span>
              <span className={styles.statBadge} style={{ background: '#ecfdf5', color: '#047857' }}>
                Cleaned Photo: {(result.cleanSize / 1024).toFixed(1)} KB
              </span>
            </div>
            <button
              className={styles.btnPrimary}
              onClick={() => triggerDownload(result.blob, `clean-${file.name}`)}
            >
              <Download size={14} /> Download Sanitized Photo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
