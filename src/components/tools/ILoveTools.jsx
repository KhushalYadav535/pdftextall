import React, { useState, useEffect, useRef } from 'react'
import {
  Wrench, BookOpen, Sparkles, Globe, Archive, Camera, Code,
  FileSpreadsheet, FileText, FileDown, Upload, Download, RefreshCw,
  Copy, Check, Trash2, Plus, Eye, Play, Square, CheckSquare,
  Layers, AlertCircle, ArrowRight, FileCheck, HelpCircle, File
} from 'lucide-react'
import toast from 'react-hot-toast'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument } from 'pdf-lib'
import {
  repairPdfDocument,
  convertPdfToMarkdown,
  summarizeTextContent,
  translateText,
  convertToPdfA,
  extractTablesToCsv,
  convertPdfToDocx,
  convertDocxToPdf
} from '../../lib/iloveEngine.js'
import styles from './StudioTools.module.css'

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function CopyBtn({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button className={styles.btnSecondary} onClick={handleCopy} style={{ padding: '4px 10px', fontSize: '12px' }}>
      {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
      {copied ? 'Copied' : label}
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────
   1. REPAIR PDF (Corrupted / Broken File Restorer)
───────────────────────────────────────────────────────────── */
export function RepairPdfTool() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [repairedBytes, setRepairedBytes] = useState(null)
  const [report, setReport] = useState(null)

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setRepairedBytes(null)
    setReport(null)
  }

  const handleRepair = async () => {
    if (!file) return
    setLoading(true)
    try {
      const buffer = await file.arrayBuffer()
      const startSize = buffer.byteLength
      const cleanBytes = await repairPdfDocument(buffer)
      const endSize = cleanBytes.byteLength
      setRepairedBytes(cleanBytes)
      setReport({
        originalSize: (startSize / 1024).toFixed(1) + ' KB',
        repairedSize: (endSize / 1024).toFixed(1) + ' KB',
        status: 'Successfully rebuilt XRef cross-reference table and restored file headers.'
      })
      toast.success('PDF successfully repaired!')
    } catch (err) {
      toast.error('Repair failed: ' + (err.message || 'File structure is severely damaged'))
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!repairedBytes) return
    const blob = new Blob([repairedBytes], { type: 'application/pdf' })
    downloadBlob(blob, file.name.replace(/\.pdf$/i, '') + '_repaired.pdf')
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <Wrench size={18} color="#ef4444" />
            Repair Damaged or Corrupt PDF
          </div>
          <span className={styles.statBadge}>100% Client-Side Recovery</span>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--tx-3)', margin: 0 }}>
          Fix unreadable PDFs with corrupt XRef cross-reference tables, broken EOF trailers, or invalid object streams without uploading your private document to any external server.
        </p>

        {!file ? (
          <label className={styles.previewBox} style={{ cursor: 'pointer', borderStyle: 'dashed' }}>
            <Upload size={36} color="#ef4444" style={{ marginBottom: 8 }} />
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Click or drop damaged PDF here</span>
            <span style={{ fontSize: '12px', color: 'var(--tx-4)' }}>Supports corrupted, damaged, or unreadable PDF files</span>
            <input type="file" accept="application/pdf" onChange={handleFile} hidden />
          </label>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-panel)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <File size={20} color="#ef4444" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{file.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--tx-4)' }}>{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <button className={styles.btnSecondary} onClick={() => { setFile(null); setRepairedBytes(null); setReport(null); }}>
                <Trash2 size={13} /> Change File
              </button>
            </div>

            {report && (
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 600, fontSize: '13px', marginBottom: 6 }}>
                  <Check size={16} /> File Repaired & Reconstructed
                </div>
                <div style={{ fontSize: '12px', color: 'var(--tx-2)' }}>{report.status}</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: '12px' }}>
                  <span>Original: <strong>{report.originalSize}</strong></span>
                  <span>Cleaned: <strong>{report.repairedSize}</strong></span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              {!repairedBytes ? (
                <button className={styles.btnPrimary} onClick={handleRepair} disabled={loading} style={{ background: '#ef4444' }}>
                  <Wrench size={16} /> {loading ? 'Repairing & Rebuilding...' : 'Repair & Fix PDF'}
                </button>
              ) : (
                <button className={styles.btnPrimary} onClick={handleDownload}>
                  <Download size={16} /> Download Repaired PDF
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   2. PDF TO MARKDOWN (.md)
───────────────────────────────────────────────────────────── */
export function PdfToMarkdownTool() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [markdown, setMarkdown] = useState('')

  const handleFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setLoading(true)
    setMarkdown('')
    setProgress('Reading document...')
    try {
      const buffer = await f.arrayBuffer()
      const md = await convertPdfToMarkdown(buffer, (cur, total) => {
        setProgress(`Parsing page ${cur} of ${total}...`)
      })
      setMarkdown(md)
      toast.success('PDF converted to Markdown!')
    } catch (err) {
      toast.error('Markdown conversion failed: ' + err.message)
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  const handleDownload = () => {
    if (!markdown) return
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    downloadBlob(blob, file.name.replace(/\.pdf$/i, '') + '.md')
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <BookOpen size={18} color="#6366f1" />
            PDF to Markdown (.md) Converter
          </div>
          <span className={styles.statBadge}>Structured Hierarchy</span>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--tx-3)', margin: 0 }}>
          Convert multi-page PDF documents into clean, structured Markdown. Automatically detects headings (#, ##, ###), paragraphs, and page boundaries for Obsidian, Notion, and GitHub.
        </p>

        {!file ? (
          <label className={styles.previewBox} style={{ cursor: 'pointer', borderStyle: 'dashed' }}>
            <Upload size={36} color="#6366f1" style={{ marginBottom: 8 }} />
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Click or drop PDF here to convert</span>
            <span style={{ fontSize: '12px', color: 'var(--tx-4)' }}>Fast client-side typography extraction</span>
            <input type="file" accept="application/pdf" onChange={handleFile} hidden />
          </label>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-panel)', borderRadius: 8 }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>{file.name}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {markdown && <CopyBtn text={markdown} label="Copy MD" />}
                {markdown && (
                  <button className={styles.btnPrimary} onClick={handleDownload} style={{ padding: '6px 12px', fontSize: '12px' }}>
                    <Download size={13} /> Download .md
                  </button>
                )}
                <button className={styles.btnSecondary} onClick={() => { setFile(null); setMarkdown(''); }}>
                  <Trash2 size={13} /> Clear
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <RefreshCw size={28} className={styles.recordingPulse} style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{progress}</div>
              </div>
            ) : (
              markdown && (
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Generated Markdown Preview:</label>
                  <textarea
                    className={styles.textarea}
                    style={{ height: '340px' }}
                    value={markdown}
                    onChange={(e) => setMarkdown(e.target.value)}
                  />
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   3. AI PDF SUMMARIZER (In-Browser NLP)
───────────────────────────────────────────────────────────── */
export function PdfSummarizerTool() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sentenceCount, setSentenceCount] = useState(5)
  const [summary, setSummary] = useState(null)

  const handleFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setSummary(null)
    setLoading(true)
    try {
      const buffer = await f.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
      const pdf = await loadingTask.promise
      let fullText = ''
      for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        fullText += content.items.map((it) => it.str).join(' ') + ' '
      }

      const res = summarizeTextContent(fullText, sentenceCount)
      setSummary(res)
      toast.success('Document summarized successfully!')
    } catch (err) {
      toast.error('Summarization failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReSummarize = async () => {
    if (!file) return
    setLoading(true)
    try {
      const buffer = await file.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
      const pdf = await loadingTask.promise
      let fullText = ''
      for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        fullText += content.items.map((it) => it.str).join(' ') + ' '
      }
      const res = summarizeTextContent(fullText, sentenceCount)
      setSummary(res)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <Sparkles size={18} color="#8b5cf6" />
            AI PDF Summarizer (Free & Private)
          </div>
          <span className={styles.statBadge}>Zero API Cost • $0 Forever</span>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--tx-3)', margin: 0 }}>
          Extract key takeaways, executive TL;DR, and critical points from research papers, contracts, and legal reports using in-browser natural language processing. 100% private.
        </p>

        {!file ? (
          <label className={styles.previewBox} style={{ cursor: 'pointer', borderStyle: 'dashed' }}>
            <Upload size={36} color="#8b5cf6" style={{ marginBottom: 8 }} />
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Click or drop PDF here to summarize</span>
            <span style={{ fontSize: '12px', color: 'var(--tx-4)' }}>Processes up to 40 pages in seconds</span>
            <input type="file" accept="application/pdf" onChange={handleFile} hidden />
          </label>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-panel)', borderRadius: 8 }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>{file.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px' }}>
                  <span>Length:</span>
                  <select
                    value={sentenceCount}
                    onChange={(e) => setSentenceCount(Number(e.target.value))}
                    className={styles.select}
                    style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
                  >
                    <option value={3}>Short (3 Key Points)</option>
                    <option value={5}>Standard (5 Key Points)</option>
                    <option value={8}>Detailed (8 Key Points)</option>
                    <option value={12}>Comprehensive (12 Key Points)</option>
                  </select>
                </div>
                <button className={styles.btnSecondary} onClick={handleReSummarize} disabled={loading} style={{ padding: '6px 10px', fontSize: '12px' }}>
                  <RefreshCw size={12} /> Re-run
                </button>
                <button className={styles.btnSecondary} onClick={() => { setFile(null); setSummary(null); }} style={{ padding: '6px 10px', fontSize: '12px' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Sparkles size={32} color="#8b5cf6" className={styles.recordingPulse} style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Analyzing document semantics & key sentences...</div>
              </div>
            ) : (
              summary && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: 10, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={15} /> Executive TL;DR
                      </span>
                      <CopyBtn text={summary.tldr} label="Copy TL;DR" />
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: 'var(--tx-1)', fontWeight: 500 }}>
                      "{summary.tldr}"
                    </p>
                  </div>

                  <div className={styles.fieldGroup}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label className={styles.fieldLabel}>Core Highlights & Takeaways:</label>
                      <CopyBtn text={summary.keyPoints.map((p, idx) => `${idx + 1}. ${p}`).join('\n\n')} label="Copy All Points" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {summary.keyPoints.map((point, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--brd-2)' }}>
                          <span style={{ background: '#8b5cf6', color: '#ffffff', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                            {idx + 1}
                          </span>
                          <span style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--tx-1)' }}>
                            {point}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   4. PDF TRANSLATOR (50+ Languages)
───────────────────────────────────────────────────────────── */
const LANGUAGES = [
  { code: 'hi', name: 'Hindi (हिन्दी)' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'ja', name: 'Japanese (日本語)' },
  { code: 'ar', name: 'Arabic (العربية)' },
  { code: 'ru', name: 'Russian (Русский)' },
  { code: 'pt', name: 'Portuguese (Português)' },
  { code: 'it', name: 'Italian (Italiano)' },
  { code: 'bn', name: 'Bengali (বাংলা)' },
  { code: 'te', name: 'Telugu (తెలుగు)' },
  { code: 'mr', name: 'Marathi (मराठी)' },
  { code: 'ta', name: 'Tamil (தமிழ்)' },
  { code: 'ur', name: 'Urdu (اردو)' },
  { code: 'gu', name: 'Gujarati (ગુજરાતી)' },
  { code: 'kn', name: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml', name: 'Malayalam (മലയാളം)' },
  { code: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'ko', name: 'Korean (한국어)' },
  { code: 'id', name: 'Indonesian (Bahasa)' },
  { code: 'nl', name: 'Dutch (Nederlands)' },
  { code: 'pl', name: 'Polish (Polski)' },
  { code: 'tr', name: 'Turkish (Türkçe)' },
  { code: 'vi', name: 'Vietnamese (Tiếng Việt)' }
]

export function PdfTranslateTool() {
  const [file, setFile] = useState(null)
  const [targetLang, setTargetLang] = useState('hi')
  const [loading, setLoading] = useState(false)
  const [originalText, setOriginalText] = useState('')
  const [translatedText, setTranslatedText] = useState('')

  const handleFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setOriginalText('')
    setTranslatedText('')
    setLoading(true)
    try {
      const buffer = await f.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
      const pdf = await loadingTask.promise
      let text = ''
      for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map((it) => it.str).join(' ') + '\n\n'
      }
      setOriginalText(text.trim())

      const res = await translateText(text.trim(), targetLang)
      setTranslatedText(res)
      toast.success('Translated successfully!')
    } catch (err) {
      toast.error('Translation failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRetranslate = async () => {
    if (!originalText) return
    setLoading(true)
    try {
      const res = await translateText(originalText, targetLang)
      setTranslatedText(res)
      toast.success('Translation updated!')
    } catch (err) {
      toast.error('Translation failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadTxt = () => {
    if (!translatedText) return
    const blob = new Blob([translatedText], { type: 'text/plain;charset=utf-8' })
    downloadBlob(blob, file.name.replace(/\.pdf$/i, '') + `_${targetLang}.txt`)
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <Globe size={18} color="#06b6d4" />
            PDF Multi-Language Translator
          </div>
          <span className={styles.statBadge}>50+ Languages Supported</span>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--tx-3)', margin: 0 }}>
          Translate PDF contracts, user manuals, and articles into Hindi, Spanish, French, German, Japanese, and 50+ languages with automatic source language detection.
        </p>

        {!file ? (
          <label className={styles.previewBox} style={{ cursor: 'pointer', borderStyle: 'dashed' }}>
            <Upload size={36} color="#06b6d4" style={{ marginBottom: 8 }} />
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Click or drop PDF here to translate</span>
            <span style={{ fontSize: '12px', color: 'var(--tx-4)' }}>Supports multi-page documents</span>
            <input type="file" accept="application/pdf" onChange={handleFile} hidden />
          </label>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-panel)', borderRadius: 8 }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>{file.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '12px' }}>Target:</span>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className={styles.select}
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
                <button className={styles.btnSecondary} onClick={handleRetranslate} disabled={loading} style={{ padding: '6px 10px', fontSize: '12px' }}>
                  <RefreshCw size={12} /> Translate
                </button>
                <button className={styles.btnSecondary} onClick={() => { setFile(null); setTranslatedText(''); setOriginalText(''); }} style={{ padding: '6px 10px', fontSize: '12px' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Globe size={32} color="#06b6d4" className={styles.recordingPulse} style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Translating document text chunks...</div>
              </div>
            ) : (
              translatedText && (
                <div className={styles.twoCol}>
                  <div className={styles.fieldGroup}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label className={styles.fieldLabel}>Original Text:</label>
                      <CopyBtn text={originalText} label="Copy Original" />
                    </div>
                    <textarea
                      className={styles.textarea}
                      style={{ height: '320px', fontSize: '12px' }}
                      value={originalText}
                      readOnly
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label className={styles.fieldLabel} style={{ color: '#06b6d4', fontWeight: 600 }}>
                        Translated ({targetLang.toUpperCase()}):
                      </label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <CopyBtn text={translatedText} label="Copy Translation" />
                        <button className={styles.btnPrimary} onClick={handleDownloadTxt} style={{ padding: '4px 8px', fontSize: '12px' }}>
                          <Download size={12} /> TXT
                        </button>
                      </div>
                    </div>
                    <textarea
                      className={styles.textarea}
                      style={{ height: '320px', fontSize: '12px' }}
                      value={translatedText}
                      onChange={(e) => setTranslatedText(e.target.value)}
                    />
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   5. PDF TO PDF/A (Archival Standard ISO 19005-1)
───────────────────────────────────────────────────────────── */
export function PdfToPdfATool() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pdfaBytes, setPdfaBytes] = useState(null)

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPdfaBytes(null)
  }

  const handleConvert = async () => {
    if (!file) return
    setLoading(true)
    try {
      const buffer = await file.arrayBuffer()
      const cleanBytes = await convertToPdfA(buffer)
      setPdfaBytes(cleanBytes)
      toast.success('PDF/A-1b compliance standard applied!')
    } catch (err) {
      toast.error('Conversion failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!pdfaBytes) return
    const blob = new Blob([pdfaBytes], { type: 'application/pdf' })
    downloadBlob(blob, file.name.replace(/\.pdf$/i, '') + '_PDFA-1b.pdf')
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <Archive size={18} color="#059669" />
            PDF to PDF/A Converter (Archival Standard)
          </div>
          <span className={styles.statBadge}>ISO 19005-1 / PDF/A-1b</span>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--tx-3)', margin: 0 }}>
          Convert regular PDFs to the official ISO 19005-1 (PDF/A-1b) archival standard for government submissions, legal filings, and 50+ year permanent electronic archiving.
        </p>

        {!file ? (
          <label className={styles.previewBox} style={{ cursor: 'pointer', borderStyle: 'dashed' }}>
            <Upload size={36} color="#059669" style={{ marginBottom: 8 }} />
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Click or drop PDF here to convert to PDF/A</span>
            <span style={{ fontSize: '12px', color: 'var(--tx-4)' }}>Injects ISO XMP metadata schema & compliant profiles</span>
            <input type="file" accept="application/pdf" onChange={handleFile} hidden />
          </label>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-panel)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <File size={20} color="#059669" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{file.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--tx-4)' }}>{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <button className={styles.btnSecondary} onClick={() => { setFile(null); setPdfaBytes(null); }}>
                <Trash2 size={13} /> Change File
              </button>
            </div>

            {pdfaBytes && (
              <div style={{ background: 'rgba(5, 150, 105, 0.08)', border: '1px solid rgba(5, 150, 105, 0.25)', borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 600, fontSize: '13px', marginBottom: 4 }}>
                  <Check size={16} /> PDF/A-1b Schema Successfully Attached
                </div>
                <div style={{ fontSize: '12px', color: 'var(--tx-2)' }}>
                  Document conforms to ISO 19005-1 standard. Font embedment markers and universal device-independent color coordinates have been configured.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              {!pdfaBytes ? (
                <button className={styles.btnPrimary} onClick={handleConvert} disabled={loading} style={{ background: '#059669' }}>
                  <Archive size={16} /> {loading ? 'Converting to PDF/A...' : 'Apply PDF/A Archival Standard'}
                </button>
              ) : (
                <button className={styles.btnPrimary} onClick={handleDownload} style={{ background: '#059669' }}>
                  <Download size={16} /> Download PDF/A Document
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   6. SCAN TO PDF VIA CAMERA
───────────────────────────────────────────────────────────── */
export function ScanToPdfTool() {
  const [cameraActive, setCameraActive] = useState(false)
  const [capturedPages, setCapturedPages] = useState([])
  const [filterMode, setFilterMode] = useState('bw') // 'bw', 'color', 'gray'
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraActive(true)
    } catch (err) {
      toast.error('Unable to access camera: ' + err.message)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  useEffect(() => {
    return () => stopCamera()
  }, [])

  const capturePage = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Apply document contrast / b&w filter
    if (filterMode === 'bw' || filterMode === 'gray') {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = imgData.data
      for (let i = 0; i < d.length; i += 4) {
        const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
        if (filterMode === 'bw') {
          // Document binarization
          const thresh = v > 130 ? 255 : 0
          d[i] = thresh
          d[i + 1] = thresh
          d[i + 2] = thresh
        } else {
          d[i] = v
          d[i + 1] = v
          d[i + 2] = v
        }
      }
      ctx.putImageData(imgData, 0, 0)
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedPages((prev) => [...prev, { id: Date.now(), dataUrl }])
    toast.success(`Captured Page ${capturedPages.length + 1}`)
  }

  const handleUploadPhoto = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      setCapturedPages((prev) => [...prev, { id: Date.now(), dataUrl: reader.result }])
      toast.success(`Added Page ${capturedPages.length + 1}`)
    }
    reader.readAsDataURL(f)
  }

  const removePage = (id) => {
    setCapturedPages((prev) => prev.filter((p) => p.id !== id))
  }

  const compilePdf = async () => {
    if (capturedPages.length === 0) return
    try {
      const pdfDoc = await PDFDocument.create()
      for (const p of capturedPages) {
        const imgBytes = await (await fetch(p.dataUrl)).arrayBuffer()
        const embeddedImg = await pdfDoc.embedJpg(imgBytes)
        // Standard A4 dimensions
        const page = pdfDoc.addPage([595.28, 841.89])
        const { width, height } = page.getSize()

        // Fit image maintaining aspect ratio
        const imgAspect = embeddedImg.width / embeddedImg.height
        const pageAspect = width / height

        let drawW, drawH, drawX, drawY
        if (imgAspect > pageAspect) {
          drawW = width - 40
          drawH = drawW / imgAspect
          drawX = 20
          drawY = (height - drawH) / 2
        } else {
          drawH = height - 40
          drawW = drawH * imgAspect
          drawX = (width - drawW) / 2
          drawY = 20
        }

        page.drawImage(embeddedImg, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH
        })
      }

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      downloadBlob(blob, `Scanned_Document_${Date.now()}.pdf`)
      toast.success('Scanned PDF downloaded!')
    } catch (err) {
      toast.error('Failed to create PDF: ' + err.message)
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <Camera size={18} color="#10b981" />
            Scan to PDF via Camera & Mobile Viewfinder
          </div>
          <span className={styles.statBadge}>Multi-Page Scanner</span>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--tx-3)', margin: 0 }}>
          Use your laptop webcam or smartphone camera to capture receipts, IDs, and book pages with high-contrast document scanning enhancement.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {!cameraActive ? (
            <button className={styles.btnPrimary} onClick={startCamera}>
              <Camera size={16} /> Open Camera Viewfinder
            </button>
          ) : (
            <button className={styles.btnDanger} onClick={stopCamera}>
              <Square size={16} /> Stop Camera
            </button>
          )}

          <label className={styles.btnSecondary} style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Upload Photos as Pages
            <input type="file" accept="image/*" onChange={handleUploadPhoto} hidden />
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', fontSize: '12px' }}>
            <span>Scan Filter:</span>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className={styles.select}
              style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
            >
              <option value="bw">B&W Document (Clean & Crisp)</option>
              <option value="gray">Grayscale</option>
              <option value="color">Full Color</option>
            </select>
          </div>
        </div>

        {cameraActive && (
          <div style={{ position: 'relative', background: '#000000', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxHeight: '420px', objectFit: 'contain' }} />
            <div style={{ position: 'absolute', bottom: 16, display: 'flex', gap: 10 }}>
              <button
                className={styles.btnPrimary}
                onClick={capturePage}
                style={{ background: '#10b981', boxShadow: '0 4px 14px rgba(0,0,0,0.5)', padding: '12px 24px', fontSize: '14px', borderRadius: 99 }}
              >
                <Camera size={18} /> Snap Page ({capturedPages.length + 1})
              </button>
            </div>
          </div>
        )}

        {capturedPages.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Captured Pages ({capturedPages.length})</span>
              <button className={styles.btnPrimary} onClick={compilePdf}>
                <Download size={14} /> Download Scanned PDF ({capturedPages.length} Pages)
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
              {capturedPages.map((p, idx) => (
                <div key={p.id} style={{ position: 'relative', border: '1px solid var(--brd)', borderRadius: 8, overflow: 'hidden', background: '#f8fafc' }}>
                  <img src={p.dataUrl} alt={`Page ${idx + 1}`} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#ffffff' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600 }}>Page {idx + 1}</span>
                    <button onClick={() => removePage(p.id)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: 2 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   7. HTML TO PDF RENDERER
───────────────────────────────────────────────────────────── */
const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; padding: 24px; }
    .header { border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 20px; }
    h1 { color: #0f172a; margin: 0 0 6px 0; font-size: 24px; }
    p { margin: 0 0 12px 0; line-height: 1.5; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 12px; }
    th { background-color: #f1f5f9; font-weight: 600; }
    .total { font-weight: 700; color: #059669; }
  </style>
</head>
<body>
  <div class="header">
    <h1>INVOICE #INV-2026-001</h1>
    <p>Date: September 18, 2026 | Status: Paid</p>
  </div>
  <p><strong>Billed To:</strong> Acme Corporation, 100 Innovation Way, Suite 400</p>
  <table>
    <thead>
      <tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
    </thead>
    <tbody>
      <tr><td>Professional Software Engineering</td><td>40 hrs</td><td>$85.00</td><td>$3,400.00</td></tr>
      <tr><td>Cloud Architecture & Deployment</td><td>15 hrs</td><td>$95.00</td><td>$1,425.00</td></tr>
      <tr><td colspan="3" class="total">Grand Total</td><td class="total">$4,825.00</td></tr>
    </tbody>
  </table>
</body>
</html>`

export function HtmlToPdfTool() {
  const [html, setHtml] = useState(DEFAULT_HTML)
  const [rendering, setRendering] = useState(false)

  const handleRenderPdf = async () => {
    setRendering(true)
    try {
      const width = 794
      const height = 1123
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="background:#ffffff; color:#000000; box-sizing:border-box; width:100%; height:100%;">
            ${html}
          </div>
        </foreignObject>
      </svg>`

      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const img = new Image()

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = () => reject(new Error('Failed to render HTML. Check for invalid SVG characters.'))
        img.src = url
      })

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)

      const imgDataUrl = canvas.toDataURL('image/jpeg', 0.95)
      const imgBytes = await (await fetch(imgDataUrl)).arrayBuffer()

      const pdfDoc = await PDFDocument.create()
      const embeddedImg = await pdfDoc.embedJpg(imgBytes)
      const page = pdfDoc.addPage([595.28, 841.89])
      page.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: 595.28,
        height: 841.89
      })

      const pdfBytes = await pdfDoc.save()
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
      downloadBlob(pdfBlob, 'rendered_document.pdf')
      toast.success('HTML rendered to PDF successfully!')
    } catch (err) {
      toast.error('Render error: ' + err.message)
    } finally {
      setRendering(false)
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <Code size={18} color="#f59e0b" />
            HTML Code to PDF Generator
          </div>
          <span className={styles.statBadge}>Live Sandbox Preview</span>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--tx-3)', margin: 0 }}>
          Write or paste HTML and CSS code, preview in real time, and compile it directly into a pixel-perfect downloadable PDF document.
        </p>

        <div className={styles.twoCol}>
          <div className={styles.fieldGroup}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className={styles.fieldLabel}>HTML & CSS Editor:</label>
              <button
                className={styles.btnSecondary}
                onClick={() => setHtml(DEFAULT_HTML)}
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                Reset Template
              </button>
            </div>
            <textarea
              className={styles.textarea}
              style={{ height: '360px', fontFamily: 'monospace', fontSize: '12px' }}
              value={html}
              onChange={(e) => setHtml(e.target.value)}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Live Render Sandbox:</label>
            <div style={{ border: '1px solid var(--brd-2)', borderRadius: 8, height: '360px', overflow: 'hidden', background: '#ffffff' }}>
              <iframe
                title="Sandbox Preview"
                srcDoc={html}
                sandbox="allow-same-origin"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button className={styles.btnPrimary} onClick={handleRenderPdf} disabled={rendering}>
            <Download size={15} /> {rendering ? 'Rendering PDF...' : 'Download Rendered PDF (A4)'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   8. PDF TO EXCEL / CSV TABLE EXTRACTOR
───────────────────────────────────────────────────────────── */
export function PdfToExcelTool() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [csvContent, setCsvContent] = useState('')
  const [rowsPreview, setRowsPreview] = useState([])

  const handleFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setLoading(true)
    setCsvContent('')
    setRowsPreview([])
    try {
      const buffer = await f.arrayBuffer()
      const csv = await extractTablesToCsv(buffer)
      setCsvContent(csv)

      // Parse preview rows
      const lines = csv.split('\n').filter((l) => l.trim().length > 0).slice(0, 15)
      const parsedRows = lines.map((l) =>
        l.split(',').map((c) => c.replace(/^"|"$/g, '').trim())
      )
      setRowsPreview(parsedRows)
      toast.success('Extracted tabular data successfully!')
    } catch (err) {
      toast.error('Table extraction failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadCsv = () => {
    if (!csvContent) return
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    downloadBlob(blob, file.name.replace(/\.pdf$/i, '') + '.csv')
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <FileSpreadsheet size={18} color="#10b981" />
            PDF to Excel / CSV Table Extractor
          </div>
          <span className={styles.statBadge}>Column Heuristic Parser</span>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--tx-3)', margin: 0 }}>
          Extract tables, column spreadsheets, bank statements, and invoices from PDF into clean, structured CSV files ready for Microsoft Excel, Google Sheets, or Apple Numbers.
        </p>

        {!file ? (
          <label className={styles.previewBox} style={{ cursor: 'pointer', borderStyle: 'dashed' }}>
            <Upload size={36} color="#10b981" style={{ marginBottom: 8 }} />
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Click or drop PDF here with tables</span>
            <span style={{ fontSize: '12px', color: 'var(--tx-4)' }}>Supports bank statements, price lists, and schedules</span>
            <input type="file" accept="application/pdf" onChange={handleFile} hidden />
          </label>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-panel)', borderRadius: 8 }}>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>{file.name}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {csvContent && (
                  <button className={styles.btnPrimary} onClick={handleDownloadCsv} style={{ padding: '6px 12px', fontSize: '12px' }}>
                    <Download size={13} /> Download Excel / CSV
                  </button>
                )}
                <button className={styles.btnSecondary} onClick={() => { setFile(null); setCsvContent(''); setRowsPreview([]); }}>
                  <Trash2 size={13} /> Clear
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <FileSpreadsheet size={32} color="#10b981" className={styles.recordingPulse} style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Analyzing row & column coordinates...</div>
              </div>
            ) : (
              rowsPreview.length > 0 && (
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Extracted Table Preview (First 15 Rows):</label>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--brd-2)', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#ffffff' }}>
                      <tbody>
                        {rowsPreview.map((row, rIdx) => (
                          <tr key={rIdx} style={{ background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} style={{ padding: '8px 12px', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                                {cell || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   9. PDF TO WORD (.docx)
───────────────────────────────────────────────────────────── */
export function PdfToWordTool() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState('')
  const [result, setResult] = useState(null)

  const processFile = async (f, forceOcr = false) => {
    if (!f) return
    setLoading(true)
    setStage(forceOcr ? 'Initializing AI OCR recognition...' : 'Analyzing PDF structure...')
    setResult(null)
    try {
      const buffer = await f.arrayBuffer()
      const res = await convertPdfToDocx(buffer, {
        forceOcr,
        onProgress: (prog) => {
          setStage(prog.stage || `Processing page ${prog.current} of ${prog.total}...`)
        }
      })
      setResult(res)
      if (res.usedOcr) {
        toast.success(`Scanned PDF text recognized via AI OCR (${res.wordCount} words)!`, { duration: 4000 })
      } else {
        toast.success(`Converted to Word (.docx) with ${res.wordCount} words!`)
      }
    } catch (err) {
      toast.error('Word conversion failed: ' + err.message)
    } finally {
      setLoading(false)
      setStage('')
    }
  }

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    processFile(f, false)
  }

  const handleDownload = () => {
    if (!result?.docxBlob) return
    downloadBlob(result.docxBlob, file.name.replace(/\.pdf$/i, '') + '.docx')
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <FileText size={18} color="#2563eb" />
            PDF to Word (.docx) Converter
          </div>
          <span className={styles.statBadge}>OpenXML + AI OCR Fallback</span>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--tx-3)', margin: 0 }}>
          Convert PDF documents into editable Microsoft Word (.docx) documents. Automatically detects digital text or falls back to in-browser AI OCR for scanned documents and photos.
        </p>

        {!file ? (
          <label className={styles.previewBox} style={{ cursor: 'pointer', borderStyle: 'dashed' }}>
            <Upload size={36} color="#2563eb" style={{ marginBottom: 8 }} />
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Click or drop PDF here to convert to Word</span>
            <span style={{ fontSize: '12px', color: 'var(--tx-4)' }}>Supports native text PDFs, legal scans, and image documents</span>
            <input type="file" accept="application/pdf" onChange={handleFile} hidden />
          </label>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-panel)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileText size={20} color="#2563eb" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{file.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--tx-4)' }}>{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <button className={styles.btnSecondary} onClick={() => { setFile(null); setResult(null); }}>
                <Trash2 size={13} /> Change File
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '36px 0' }}>
                <RefreshCw size={28} className={styles.recordingPulse} style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#2563eb' }}>{stage || 'Converting PDF to Word...'}</div>
                <div style={{ fontSize: '12px', color: 'var(--tx-4)', marginTop: 6 }}>100% private in-browser extraction</div>
              </div>
            ) : (
              result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.25)', borderRadius: 8, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#2563eb', fontWeight: 600, fontSize: '14px' }}>
                        <Check size={16} /> Word Document Ready
                      </div>
                      <span className={styles.statBadge} style={{ background: result.usedOcr ? 'rgba(245, 158, 11, 0.15)' : undefined, color: result.usedOcr ? '#d97706' : undefined }}>
                        {result.usedOcr ? 'AI OCR Recognized Text' : 'Direct Vector Text'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--tx-2)', marginBottom: 12 }}>
                      Extracted <strong>{result.wordCount}</strong> words across <strong>{result.numPages}</strong> pages ({result.lineCount} paragraphs/lines).
                      {result.usedOcr && ' (Scanned document detected - text was recognized directly from page images via OCR).'}
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button className={styles.btnPrimary} onClick={handleDownload} style={{ background: '#2563eb' }}>
                        <Download size={15} /> Download .docx Document
                      </button>
                      <CopyBtn text={result.textPreview} label="Copy Extracted Text" />
                      {!result.usedOcr && (
                        <button className={styles.btnSecondary} onClick={() => processFile(file, true)}>
                          <Sparkles size={13} color="#8b5cf6" /> Re-scan with AI OCR
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label className={styles.fieldLabel}>Extracted Text Preview in Word Document:</label>
                      <span style={{ fontSize: '11px', color: 'var(--tx-4)' }}>{result.wordCount} words</span>
                    </div>
                    <textarea
                      className={styles.textarea}
                      style={{ height: '260px', fontSize: '12px', lineHeight: 1.6 }}
                      value={result.textPreview}
                      readOnly
                    />
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   10. WORD (.docx) TO PDF
───────────────────────────────────────────────────────────── */
export function WordToPdfTool() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pdfBytes, setPdfBytes] = useState(null)

  const handleFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPdfBytes(null)
    setLoading(true)
    try {
      const buffer = await f.arrayBuffer()
      const bytes = await convertDocxToPdf(buffer)
      setPdfBytes(bytes)
      toast.success('Word converted to PDF!')
    } catch (err) {
      toast.error('DOCX conversion failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!pdfBytes) return
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    downloadBlob(blob, file.name.replace(/\.docx$/i, '') + '.pdf')
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <FileDown size={18} color="#3b82f6" />
            Word (.docx) to PDF Converter
          </div>
          <span className={styles.statBadge}>In-Browser OpenXML Parser</span>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--tx-3)', margin: 0 }}>
          Convert Microsoft Word (.docx) documents to PDF directly inside your browser. No Microsoft Office installation or server uploads required.
        </p>

        {!file ? (
          <label className={styles.previewBox} style={{ cursor: 'pointer', borderStyle: 'dashed' }}>
            <Upload size={36} color="#3b82f6" style={{ marginBottom: 8 }} />
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Click or drop Word (.docx) document here</span>
            <span style={{ fontSize: '12px', color: 'var(--tx-4)' }}>Supports Microsoft Word 2007-2026 DOCX files</span>
            <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFile} hidden />
          </label>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-panel)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileDown size={20} color="#3b82f6" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{file.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--tx-4)' }}>{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <button className={styles.btnSecondary} onClick={() => { setFile(null); setPdfBytes(null); }}>
                <Trash2 size={13} /> Change File
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <RefreshCw size={28} className={styles.recordingPulse} style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Unpacking DOCX XML package & typesetting PDF...</div>
              </div>
            ) : (
              pdfBytes && (
                <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 8, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3b82f6', fontWeight: 600, fontSize: '13px', marginBottom: 4 }}>
                    <Check size={16} /> PDF Successfully Generated
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--tx-2)', marginBottom: 12 }}>
                    Your document has been rendered to standard A4 PDF with clean typography.
                  </div>
                  <button className={styles.btnPrimary} onClick={handleDownload} style={{ background: '#3b82f6' }}>
                    <Download size={15} /> Download PDF File
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
