import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  FileDiff, BookOpen, Type, AlignLeft, FileText,
  Copy, Check, Download, RefreshCw, BarChart2, Clock
} from 'lucide-react'
import {
  computeTextDiff, convertCase, analyzeText, generateLorem
} from '../../lib/devEngine.js'
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

/* ─── 1. TEXT DIFF CHECKER ─── */
export function TextDiffTool() {
  const [text1, setText1] = useState('PDFZero is an open source tool.\nIt runs in the cloud.\nFree forever.')
  const [text2, setText2] = useState('PDFZero is an open source super-suite.\nIt runs 100% locally in your browser.\nCompletely free forever.')
  const [diffResult, setDiffResult] = useState(null)

  useEffect(() => {
    const res = computeTextDiff(text1, text2)
    setDiffResult(res)
  }, [text1, text2])

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><FileDiff size={16} /> Text Diff & Comparison</span>
          {diffResult && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <span className={styles.statBadge} style={{ background: '#ecfdf5', color: '#047857' }}>+{diffResult.stats.additions} Added</span>
              <span className={styles.statBadge} style={{ background: '#fef2f2', color: '#b91c1c' }}>-{diffResult.stats.deletions} Removed</span>
            </div>
          )}
        </div>

        <div className={styles.twoCol}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Original Text</label>
            <textarea
              className={styles.textarea}
              style={{ minHeight: '180px' }}
              value={text1}
              onChange={e => setText1(e.target.value)}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Modified Text</label>
            <textarea
              className={styles.textarea}
              style={{ minHeight: '180px' }}
              value={text2}
              onChange={e => setText2(e.target.value)}
            />
          </div>
        </div>

        {diffResult && (
          <div style={{ marginTop: '12px' }}>
            <span className={styles.fieldLabel} style={{ marginBottom: '8px' }}>Line-by-Line Visual Diff</span>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {diffResult.diff.map((line, idx) => {
                let cls = styles.diffUnchanged
                let symbol = '  '
                if (line.type === 'added') {
                  cls = styles.diffAdded
                  symbol = '+ '
                } else if (line.type === 'removed') {
                  cls = styles.diffRemoved
                  symbol = '- '
                }
                return (
                  <div key={idx} className={`${styles.diffLine} ${cls}`}>
                    <span style={{ width: '20px', userSelect: 'none', opacity: 0.6 }}>{symbol}</span>
                    <span style={{ whiteSpace: 'pre-wrap' }}>{line.text || ' '}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 2. MARKDOWN LIVE EDITOR & PREVIEW ─── */
export function MarkdownLiveTool() {
  const [markdown, setMarkdown] = useState(`# Welcome to PDFZero Markdown
Enjoy live typing with instant HTML formatting.

## Features:
- **100% Client-Side**: No servers involved
- *Fast & responsive*: Real-time updates
- \`Code highlights\` and tables supported

> "Simplicity is the soul of efficiency." - Austin Freeman

1. First item
2. Second item
3. Third item
`)

  // Simple clean markdown parser to HTML
  const parseMarkdown = (md) => {
    let html = md
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
      .replace(/\n\n/gim, '<p></p>')

    return html
  }

  const handleDownloadHtml = () => {
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Exported Document</title><style>body{font-family:sans-serif;line-height:1.6;max-width:800px;margin:40px auto;padding:0 20px;}code{background:#f1f5f9;padding:2px 6px;border-radius:4px;}blockquote{border-left:4px solid #10b981;margin:0;padding-left:16px;color:#475569;}</style></head><body>${parseMarkdown(markdown)}</body></html>`
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'document.html'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('Exported HTML!')
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><BookOpen size={16} /> Markdown Live Editor</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <CopyButton text={markdown} label="Copy Markdown" />
            <button className={styles.btnPrimary} onClick={handleDownloadHtml}>
              <Download size={13} /> Export HTML
            </button>
          </div>
        </div>

        <div className={styles.twoCol}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Markdown Source</label>
            <textarea
              className={styles.textarea}
              style={{ minHeight: '380px' }}
              value={markdown}
              onChange={e => setMarkdown(e.target.value)}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Live Rendered HTML Preview</label>
            <div
              style={{
                minHeight: '380px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '16px 20px',
                overflowY: 'auto',
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#1e293b'
              }}
              dangerouslySetInnerHTML={{ __html: parseMarkdown(markdown) }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 3. CASE CONVERTER & SLUGGIFIER ─── */
export function CaseConverterTool() {
  const [text, setText] = useState('pdf zero ultimate developer tools')
  const [converted, setConverted] = useState('')

  const stylesList = [
    { id: 'camelCase', label: 'camelCase' },
    { id: 'PascalCase', label: 'PascalCase' },
    { id: 'snake_case', label: 'snake_case' },
    { id: 'kebab-case', label: 'kebab-case (Slug)' },
    { id: 'CONSTANT_CASE', label: 'CONSTANT_CASE' },
    { id: 'Title Case', label: 'Title Case' },
    { id: 'Sentence case', label: 'Sentence case' },
    { id: 'UPPERCASE', label: 'UPPERCASE' },
    { id: 'lowercase', label: 'lowercase' },
  ]

  const applyStyle = (styleId) => {
    const res = convertCase(text, styleId)
    setConverted(res)
    toast.success(`Converted to ${styleId}!`)
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Type size={16} /> Case Converter & URL Sluggifier</span>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Input Text</label>
          <textarea
            className={styles.textarea}
            rows={4}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type or paste any text..."
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '4px 0' }}>
          {stylesList.map(s => (
            <button
              key={s.id}
              className={styles.btnSecondary}
              onClick={() => applyStyle(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {converted && (
          <div className={styles.fieldGroup} style={{ marginTop: '12px' }}>
            <div className={styles.fieldLabel}>
              <span>Converted Output</span>
              <CopyButton text={converted} />
            </div>
            <textarea
              className={styles.textarea}
              rows={3}
              value={converted}
              readOnly
              style={{ background: '#f8fafc', fontWeight: 600, color: '#0f172a' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 4. TEXT COUNTER & DENSITY ANALYZER ─── */
export function TextCounterTool() {
  const [text, setText] = useState('PDFZero is an all-in-one suite designed to bring professional utilities directly into the browser without fees or logins.')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const res = analyzeText(text)
    setStats(res)
  }, [text])

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><AlignLeft size={16} /> Word & Character Density Counter</span>
          {stats && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span className={styles.statBadge}><Clock size={12} /> ~{stats.readingTimeMin} min read</span>
              <span className={styles.statBadge}><Clock size={12} /> ~{stats.speakingTimeMin} min speak</span>
            </div>
          )}
        </div>

        <div className={styles.fieldGroup}>
          <textarea
            className={styles.textarea}
            style={{ minHeight: '180px' }}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Start typing or paste document to analyze..."
          />
        </div>

        {stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
              {[
                { label: 'Words', val: stats.words },
                { label: 'Characters', val: stats.characters },
                { label: 'No Spaces', val: stats.charactersNoSpaces },
                { label: 'Paragraphs', val: stats.paragraphs },
                { label: 'Lines', val: stats.lines },
              ].map(item => (
                <div key={item.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{item.val}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{item.label}</div>
                </div>
              ))}
            </div>

            {stats.topWords.length > 0 && (
              <div>
                <span className={styles.fieldLabel} style={{ marginBottom: '8px' }}>Top Keyword Density</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                  {stats.topWords.map(w => (
                    <div key={w.word} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}>
                      <strong>{w.word}</strong>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>{w.count}x ({w.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 5. LOREM IPSUM GENERATOR ─── */
export function LoremGeneratorTool() {
  const [count, setCount] = useState(3)
  const [type, setType] = useState('paragraphs')
  const [output, setOutput] = useState('')

  const handleGenerate = () => {
    const text = generateLorem(count, type)
    setOutput(text)
  }

  useEffect(() => {
    handleGenerate()
  }, [count, type])

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><FileText size={16} /> Lorem Ipsum Dummy Data Generator</span>
          {output && <CopyButton text={output} label="Copy Text" />}
        </div>

        <div className={styles.twoCol}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Type</label>
            <select className={styles.select} value={type} onChange={e => setType(e.target.value)}>
              <option value="paragraphs">Paragraphs</option>
              <option value="sentences">Sentences</option>
              <option value="words">Words</option>
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Quantity ({count})</label>
            <div className={styles.sliderRow}>
              <input
                type="range"
                min="1"
                max="20"
                value={count}
                className={styles.slider}
                onChange={e => setCount(Number(e.target.value))}
              />
              <span className={styles.sliderValue}>{count}</span>
            </div>
          </div>
        </div>

        <div className={styles.fieldGroup} style={{ marginTop: '10px' }}>
          <textarea
            className={styles.textarea}
            style={{ minHeight: '260px' }}
            value={output}
            readOnly
          />
        </div>
      </div>
    </div>
  )
}
