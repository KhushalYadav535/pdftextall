import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, Zap, LayoutGrid } from 'lucide-react'
import styles from './CommandPalette.module.css'

// Lightweight static index (no heavy imports) — top destinations + popular tools
const ITEMS = [
  { label: 'Home', hint: 'Landing page', path: '/', keys: 'home start landing' },
  { label: 'PDF Editor', hint: 'Edit text, sign, redact', path: '/editor', keys: 'edit editor pdf annotate' },
  { label: 'All Tools', hint: 'Browse 105+ tools', path: '/tools', keys: 'all tools browse list' },
  { label: 'Merge PDFs', hint: 'Combine PDFs', path: '/tools/merge', keys: 'merge combine join' },
  { label: 'Split PDF', hint: 'Split by range', path: '/tools/split', keys: 'split divide pages' },
  { label: 'Compress PDF', hint: 'Target-size smart compress', path: '/tools/compress', keys: 'compress shrink size reduce' },
  { label: 'OCR Scanner', hint: 'Searchable PDF, EN+HI', path: '/tools/ocr', keys: 'ocr scan searchable hindi text' },
  { label: 'Sign PDF', hint: 'Draw / type signature', path: '/tools/sign', keys: 'sign signature esign' },
  { label: 'Protect PDF', hint: 'AES-256 password', path: '/tools/protect', keys: 'protect password encrypt lock' },
  { label: 'Unlock PDF', hint: 'Remove restrictions', path: '/tools/unlock', keys: 'unlock remove password' },
  { label: 'PDF to Word', hint: '.docx with tables', path: '/tools/pdf-to-word', keys: 'word docx convert' },
  { label: 'Word to PDF', hint: 'DOCX to A4 PDF', path: '/tools/word-to-pdf', keys: 'word docx pdf' },
  { label: 'PDF to Excel / CSV', hint: 'Tables to spreadsheet', path: '/tools/pdf-to-excel', keys: 'excel csv table bank statement' },
  { label: 'PDF to Images', hint: 'Pages to JPG/PNG', path: '/tools/pdf-to-images', keys: 'jpg png image export' },
  { label: 'Images to PDF', hint: 'Photos to PDF', path: '/tools/images-to-pdf', keys: 'photo jpg pdf' },
  { label: 'Watermark', hint: 'Text / image stamp', path: '/tools/watermark', keys: 'watermark stamp confidential' },
  { label: 'Redact PDF', hint: 'True burned-in redaction', path: '/tools/pdf-redact-pro', keys: 'redact blackout censor' },
  { label: 'Rotate PDF', hint: '90 / 180 / 270', path: '/tools/rotate', keys: 'rotate' },
  { label: 'Reorder Pages', hint: 'Drag and drop', path: '/tools/reorder', keys: 'reorder arrange' },
  { label: 'Extract Pages', hint: 'Pull pages out', path: '/tools/extract', keys: 'extract pages' },
  { label: 'Delete Pages', hint: 'Remove pages', path: '/tools/delete-pages', keys: 'delete remove pages' },
  { label: 'Page Numbers', hint: 'Headers, Bates', path: '/tools/page-numbers', keys: 'page numbers bates header footer' },
  { label: 'Crop PDF', hint: 'Trim margins', path: '/tools/crop', keys: 'crop trim margins' },
  { label: 'Grayscale PDF', hint: 'Ink saver B&W', path: '/tools/grayscale', keys: 'grayscale black white ink' },
  { label: 'Compare PDFs', hint: 'Visual diff', path: '/tools/compare', keys: 'compare diff' },
  { label: 'Metadata & Clean', hint: 'Wipe tracking info', path: '/tools/metadata', keys: 'metadata exif clean privacy' },
  { label: 'AI PDF Summarizer', hint: 'TL;DR + key points', path: '/tools/pdf-summarize', keys: 'summarize summary tldr ai' },
  { label: 'PDF Translator', hint: '50+ languages', path: '/tools/pdf-translate', keys: 'translate hindi' },
  { label: 'Repair PDF', hint: 'Fix corrupt files', path: '/tools/repair-pdf', keys: 'repair corrupt fix' },
  { label: 'PDF to PDF/A', hint: 'Archival ISO', path: '/tools/pdf-to-pdfa', keys: 'archive pdfa iso' },
  { label: 'Scan to PDF', hint: 'Camera scanner', path: '/tools/scan-to-pdf', keys: 'scan camera' },
  { label: 'Bulk Certificates', hint: 'Names to ZIP', path: '/tools/certificate-generator', keys: 'certificate bulk' },
  { label: 'Passport Photo', hint: 'Print sheets', path: '/tools/passport-photo', keys: 'passport photo visa' },
  { label: 'Background Remover', hint: 'Smart + AI', path: '/tools/remove-bg', keys: 'background remove transparent' },
  { label: 'Signature Extractor', hint: 'Paper to PNG', path: '/tools/signature-extractor', keys: 'signature extract' },
  { label: 'Compress Image', hint: 'JPG/PNG/WebP', path: '/tools/compress-image', keys: 'compress image tiny' },
  { label: 'Favicon Generator', hint: 'Icon pack ZIP', path: '/tools/favicon-generator', keys: 'favicon icon' },
  { label: 'Screen Recorder', hint: 'No watermark', path: '/tools/screen-recorder', keys: 'screen record video loom' },
  { label: 'Text to Speech', hint: 'Natural reader', path: '/tools/text-to-speech', keys: 'tts speech voice read' },
  { label: 'Speech to Text', hint: 'Dictation', path: '/tools/speech-to-text', keys: 'stt dictation mic' },
  { label: 'WiFi QR', hint: 'Instant connect', path: '/tools/wifi-qr', keys: 'wifi qr' },
  { label: 'JSON Formatter', hint: 'Validate + minify', path: '/tools/json-formatter', keys: 'json format' },
  { label: 'Base64 Tool', hint: 'Encode / decode', path: '/tools/base64', keys: 'base64 encode decode' },
  { label: 'JWT Debugger', hint: 'Decode claims', path: '/tools/jwt-debugger', keys: 'jwt token decode' },
  { label: 'Password Generator', hint: 'Entropy meter', path: '/tools/password-generator', keys: 'password generator secure' },
  { label: 'AES-256 Encryptor', hint: 'File encryption', path: '/tools/aes-encrypt', keys: 'aes encrypt file' },
  { label: 'Unit Converter', hint: 'Length, weight, temp', path: '/tools/unit-converter', keys: 'unit convert' },
  { label: 'Pomodoro Timer', hint: 'Focus intervals', path: '/tools/pomodoro-timer', keys: 'pomodoro focus timer' },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
        setQuery('')
        setCursor(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30)
  }, [open ])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ITEMS.slice(0, 9)
    return ITEMS.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        it.hint.toLowerCase().includes(q) ||
        it.keys.includes(q)
    ).slice(0, 12)
  }, [query])

  useEffect(() => setCursor(0), [results.length])

  const go = (path) => {
    setOpen(false)
    setQuery('')
    navigate(path)
  }

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Search tools">
        <div className={styles.inputRow}>
          <Search size={16} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Search tools… (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
              if (e.key === 'Enter' && results[cursor]) go(results[cursor].path)
            }}
          />
          <kbd className={styles.kbd}>Ctrl K</kbd>
        </div>
        <div className={styles.list}>
          {results.length === 0 && <div className={styles.empty}>No tool found — try “compress”, “ocr”, “word”…</div>}
          {results.map((it, i) => (
            <button
              key={it.path}
              className={`${styles.item} ${i === cursor ? styles.itemActive : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(it.path)}
            >
              <span className={styles.itemIcon}>
                {it.path === '/' ? <LayoutGrid size={14} /> : it.path === '/editor' ? <FileText size={14} /> : <Zap size={14} />}
              </span>
              <span className={styles.itemText}>
                <span className={styles.itemLabel}>{it.label}</span>
                <span className={styles.itemHint}>{it.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <div className={styles.footer}>↑↓ navigate • Enter open • 105 tools total — full list on /tools</div>
      </div>
    </div>
  )
}
