import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  Code, FileJson, Table, Binary, KeyRound, Hash, Cpu,
  Copy, Check, Download, RefreshCw, AlertCircle, CheckCircle2,
  Sliders, Shield, Sparkles
} from 'lucide-react'
import {
  formatJson, minifyJson, jsonToCsv, csvToJson,
  encodeBase64Text, decodeBase64Text, fileToBase64,
  decodeJwt, testRegex, generateUuids
} from '../../lib/devEngine.js'
import { calculateHashes } from '../../lib/cryptoEngine.js'
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

function triggerDownload(text, filename, type = 'text/plain') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ─── 1. JSON FORMATTER & VALIDATOR ─── */
export function JsonFormatterTool() {
  const [input, setInput] = useState('{"name":"PDFZero","tools":57,"free":true,"tags":["pdf","image","media","dev"]}')
  const [indent, setIndent] = useState(2)
  const [output, setOutput] = useState('')
  const [error, setError] = useState(null)

  const handleFormat = () => {
    const res = formatJson(input, indent)
    if (res.success) {
      setOutput(res.result)
      setError(null)
      toast.success('JSON Formatted!')
    } else {
      setError(res.error)
      toast.error('Invalid JSON')
    }
  }

  const handleMinify = () => {
    const res = minifyJson(input)
    if (res.success) {
      setOutput(res.result)
      setError(null)
      toast.success('JSON Minified!')
    } else {
      setError(res.error)
      toast.error('Invalid JSON')
    }
  }

  useEffect(() => {
    handleFormat()
  }, [])

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><FileJson size={16} /> JSON Formatter & Validator</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select className={styles.select} style={{ width: 'auto', padding: '4px 8px' }} value={indent} onChange={e => setIndent(Number(e.target.value))}>
              <option value="2">2 Spaces</option>
              <option value="4">4 Spaces</option>
              <option value="1">Tabs</option>
            </select>
            <button className={styles.btnSecondary} onClick={handleMinify}>Minify</button>
            <button className={styles.btnPrimary} onClick={handleFormat}>Format</button>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className={styles.twoCol}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Raw JSON Input</label>
            <textarea
              className={styles.textarea}
              style={{ minHeight: '340px' }}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Paste JSON here..."
            />
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}>
              <span>Formatted Output</span>
              {output && <CopyButton text={output} />}
            </div>
            <textarea
              className={styles.textarea}
              style={{ minHeight: '340px', background: '#0f172a', color: '#38bdf8' }}
              value={output}
              readOnly
              placeholder="Formatted result..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 2. JSON <-> CSV CONVERTER ─── */
export function JsonCsvTool() {
  const [mode, setMode] = useState('json2csv') // 'json2csv' | 'csv2json'
  const [input, setInput] = useState('[{"id":1,"name":"Alice","role":"Developer"},{"id":2,"name":"Bob","role":"Designer"}]')
  const [output, setOutput] = useState('')
  const [error, setError] = useState(null)

  const handleConvert = () => {
    if (mode === 'json2csv') {
      const res = jsonToCsv(input)
      if (res.success) {
        setOutput(res.result)
        setError(null)
        toast.success(`Converted ${res.count} records to CSV!`)
      } else {
        setError(res.error)
        toast.error('JSON parse error')
      }
    } else {
      const res = csvToJson(input)
      if (res.success) {
        setOutput(res.result)
        setError(null)
        toast.success(`Converted ${res.count} rows to JSON!`)
      } else {
        setError(res.error)
        toast.error('CSV parse error')
      }
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Table size={16} /> JSON ⇄ CSV Bidirectional Converter</span>
          <div className={styles.pillTabs}>
            <button className={`${styles.pillBtn} ${mode === 'json2csv' ? styles.pillBtnActive : ''}`} onClick={() => { setMode('json2csv'); setOutput(''); }}>JSON to CSV</button>
            <button className={`${styles.pillBtn} ${mode === 'csv2json' ? styles.pillBtnActive : ''}`} onClick={() => { setMode('csv2json'); setOutput(''); }}>CSV to JSON</button>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <div className={styles.twoCol}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>{mode === 'json2csv' ? 'JSON Input (Array of Objects)' : 'CSV Text Input'}</label>
            <textarea
              className={styles.textarea}
              style={{ minHeight: '300px' }}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={mode === 'json2csv' ? '[{"col1": "val1"}]' : 'col1,col2\nval1,val2'}
            />
            <button className={styles.btnPrimary} style={{ marginTop: '10px' }} onClick={handleConvert}>
              Convert to {mode === 'json2csv' ? 'CSV' : 'JSON'}
            </button>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}>
              <span>{mode === 'json2csv' ? 'CSV Output' : 'JSON Output'}</span>
              {output && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <CopyButton text={output} />
                  <button
                    className={styles.btnSecondary}
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                    onClick={() => triggerDownload(output, mode === 'json2csv' ? 'data.csv' : 'data.json', mode === 'json2csv' ? 'text/csv' : 'application/json')}
                  >
                    <Download size={12} /> Download
                  </button>
                </div>
              )}
            </div>
            <textarea
              className={styles.textarea}
              style={{ minHeight: '300px' }}
              value={output}
              readOnly
              placeholder="Converted output will appear here..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 3. BASE64 ENCODER & DECODER ─── */
export function Base64Tool() {
  const [mode, setMode] = useState('encode')
  const [textInput, setTextInput] = useState('Hello, PDFZero World!')
  const [result, setResult] = useState('')

  const handleProcess = () => {
    if (mode === 'encode') {
      const res = encodeBase64Text(textInput)
      if (res.success) setResult(res.result)
      else toast.error(res.error)
    } else {
      const res = decodeBase64Text(textInput)
      if (res.success) setResult(res.result)
      else toast.error('Invalid Base64 string')
    }
  }

  const handleFileUpload = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const b64 = await fileToBase64(f)
      setResult(b64)
      toast.success('File encoded to Base64 Data URL!')
    } catch {
      toast.error('File encoding failed')
    }
  }

  useEffect(() => {
    handleProcess()
  }, [mode, textInput])

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Binary size={16} /> Base64 Encoder / Decoder</span>
          <div className={styles.pillTabs}>
            <button className={`${styles.pillBtn} ${mode === 'encode' ? styles.pillBtnActive : ''}`} onClick={() => setMode('encode')}>Encode</button>
            <button className={`${styles.pillBtn} ${mode === 'decode' ? styles.pillBtnActive : ''}`} onClick={() => setMode('decode')}>Decode</button>
          </div>
        </div>

        <div className={styles.twoCol}>
          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}>
              <span>{mode === 'encode' ? 'Plain Text to Encode' : 'Base64 to Decode'}</span>
              {mode === 'encode' && (
                <label style={{ fontSize: '11px', color: '#10b981', cursor: 'pointer', fontWeight: 600 }}>
                  Upload File to Base64
                  <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
                </label>
              )}
            </div>
            <textarea
              className={styles.textarea}
              style={{ minHeight: '260px' }}
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder={mode === 'encode' ? 'Type text here...' : 'Paste base64 here...'}
            />
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}>
              <span>Result</span>
              {result && <CopyButton text={result} />}
            </div>
            <textarea
              className={styles.textarea}
              style={{ minHeight: '260px', background: '#0f172a', color: '#a7f3d0' }}
              value={result}
              readOnly
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 4. JWT DEBUGGER & TOKEN INSPECTOR ─── */
export function JwtDebuggerTool() {
  const [token, setToken] = useState('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE5MTYyMzkwMjJ9.4pz-e_yZ3bT_4vXw7sYvA2fVf5sV9k')
  const [decoded, setDecoded] = useState(null)

  useEffect(() => {
    if (!token.trim()) {
      setDecoded(null)
      return
    }
    const res = decodeJwt(token)
    if (res.success) {
      setDecoded(res)
    } else {
      setDecoded({ error: res.error })
    }
  }, [token])

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><KeyRound size={16} /> JWT Debugger & Inspector</span>
          {decoded && !decoded.error && (
            <span className={styles.statBadge} style={{ background: decoded.isExpired ? '#fef2f2' : '#ecfdf5', color: decoded.isExpired ? '#ef4444' : '#10b981' }}>
              {decoded.isExpired ? 'Token Expired' : 'Token Active'}
            </span>
          )}
        </div>

        <div className={styles.twoCol}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Encoded JWT Token</label>
            <textarea
              className={styles.textarea}
              style={{ minHeight: '320px', color: '#ef4444' }}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Paste encoded JWT here..."
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {decoded?.error ? (
              <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
                {decoded.error}
              </div>
            ) : decoded ? (
              <>
                <div className={styles.fieldGroup}>
                  <div className={styles.fieldLabel}>
                    <span style={{ color: '#ef4444', fontWeight: 700 }}>HEADER: Algorithm & Type</span>
                    <CopyButton text={JSON.stringify(decoded.header, null, 2)} />
                  </div>
                  <div className={styles.codeBox} style={{ color: '#f87171' }}>
                    {JSON.stringify(decoded.header, null, 2)}
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <div className={styles.fieldLabel}>
                    <span style={{ color: '#a855f7', fontWeight: 700 }}>PAYLOAD: Data Claims</span>
                    <CopyButton text={JSON.stringify(decoded.payload, null, 2)} />
                  </div>
                  <div className={styles.codeBox} style={{ color: '#c084fc' }}>
                    {JSON.stringify(decoded.payload, null, 2)}
                  </div>
                </div>

                {decoded.expiresAt && (
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    <strong>Expiration:</strong> {decoded.expiresAt}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 5. REGEX TESTER & MATCH HIGHLIGHTER ─── */
export function RegexTesterTool() {
  const [pattern, setPattern] = useState('([A-Z0-9._%+-]+)@([A-Z0-9.-]+\\.[A-Z]{2,})')
  const [flags, setFlags] = useState('gi')
  const [testText, setTestText] = useState('Contact us at support@pdfzero.org or hello@example.com for inquiries.')
  const [result, setResult] = useState(null)

  useEffect(() => {
    const res = testRegex(pattern, flags, testText)
    setResult(res)
  }, [pattern, flags, testText])

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Code size={16} /> Regular Expression (Regex) Tester</span>
          {result && (
            <span className={styles.statBadge}>
              {result.count} {result.count === 1 ? 'Match' : 'Matches'} Found
            </span>
          )}
        </div>

        <div className={styles.twoCol}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Expression Pattern</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className={styles.input}
                style={{ fontFamily: 'monospace', fontWeight: 600 }}
                value={pattern}
                onChange={e => setPattern(e.target.value)}
                placeholder="e.g. \w+@\w+\.\w+"
              />
              <input
                type="text"
                className={styles.input}
                style={{ width: '80px', fontFamily: 'monospace' }}
                value={flags}
                onChange={e => setFlags(e.target.value)}
                placeholder="flags"
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', fontSize: '12px', color: '#64748b' }}>
            <span>Common Flags: <strong>g</strong> (global), <strong>i</strong> (case insensitive), <strong>m</strong> (multiline)</span>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Test String</label>
          <textarea
            className={styles.textarea}
            style={{ minHeight: '140px' }}
            value={testText}
            onChange={e => setTestText(e.target.value)}
          />
        </div>

        {result?.matches && result.matches.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            <span className={styles.fieldLabel}>Extracted Matches & Capture Groups</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {result.matches.map((m, idx) => (
                <div key={idx} style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Match {idx + 1}:</strong> <code style={{ color: '#10b981', fontWeight: 700 }}>"{m.match}"</code> (pos: {m.index}-{m.endIndex})
                    {m.groups.length > 0 && (
                      <span style={{ marginLeft: '12px', color: '#64748b' }}>
                        Groups: {m.groups.map((g, i) => `$${i + 1}: "${g}"`).join(', ')}
                      </span>
                    )}
                  </div>
                  <CopyButton text={m.match} label="Copy Match" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 6. HASH GENERATOR (SHA-256, MD5, SHA-512) ─── */
export function HashGeneratorTool() {
  const [input, setInput] = useState('PDFZero Security')
  const [hashes, setHashes] = useState(null)
  const [loading, setLoading] = useState(false)

  const compute = async (val) => {
    if (!val) {
      setHashes(null)
      return
    }
    setLoading(true)
    const res = await calculateHashes(val)
    setHashes(res)
    setLoading(false)
  }

  useEffect(() => {
    compute(input)
  }, [input])

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    const res = await calculateHashes(file)
    setHashes(res)
    setLoading(false)
    toast.success(`Calculated checksums for ${file.name}`)
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Hash size={16} /> Cryptographic Hash & Checksum Generator</span>
          <label className={styles.btnSecondary} style={{ cursor: 'pointer' }}>
            Hash Any File
            <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Text Input</label>
          <textarea
            className={styles.textarea}
            rows={3}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type text to calculate hashes in real time..."
          />
        </div>

        {hashes && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
            {[
              { label: 'SHA-256 (Standard)', value: hashes.sha256, color: '#10b981' },
              { label: 'MD5 (Legacy Checksum)', value: hashes.md5, color: '#f59e0b' },
              { label: 'SHA-1 (Git/Legacy)', value: hashes.sha1, color: '#6366f1' },
              { label: 'SHA-512 (High Security)', value: hashes.sha512, color: '#3b82f6' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: item.color }}>{item.label}</span>
                  <CopyButton text={item.value} />
                </div>
                <code style={{ fontSize: '12px', wordBreak: 'break-all', color: '#1e293b' }}>{item.value}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 7. UUID & NANOID GENERATOR ─── */
export function UuidGeneratorTool() {
  const [count, setCount] = useState(5)
  const [type, setType] = useState('uuid')
  const [uppercase, setUppercase] = useState(false)
  const [hyphens, setHyphens] = useState(true)
  const [uuids, setUuids] = useState([])

  const generate = () => {
    const list = generateUuids(count, { uppercase, hyphens, type })
    setUuids(list)
  }

  useEffect(() => {
    generate()
  }, [count, type, uppercase, hyphens])

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Cpu size={16} /> UUID & NanoID Generator</span>
          <button className={styles.btnPrimary} onClick={generate}>
            <RefreshCw size={13} /> Regenerate
          </button>
        </div>

        <div className={styles.twoCol}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div className={styles.fieldGroup} style={{ flex: 1 }}>
              <label className={styles.fieldLabel}>Type</label>
              <select className={styles.select} value={type} onChange={e => setType(e.target.value)}>
                <option value="uuid">UUID v4 (Standard 128-bit)</option>
                <option value="nanoid">NanoID (Compact URL-friendly)</option>
              </select>
            </div>
            <div className={styles.fieldGroup} style={{ width: '100px' }}>
              <label className={styles.fieldLabel}>Quantity</label>
              <input type="number" min="1" max="50" className={styles.input} value={count} onChange={e => setCount(Math.min(50, Math.max(1, Number(e.target.value))))} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingTop: '20px' }}>
            {type === 'uuid' && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={uppercase} onChange={e => setUppercase(e.target.checked)} />
                  Uppercase
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={hyphens} onChange={e => setHyphens(e.target.checked)} />
                  Hyphens
                </label>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className={styles.fieldLabel}>Generated Identifiers ({uuids.length})</span>
            <CopyButton text={uuids.join('\n')} label="Copy All" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {uuids.map((id, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontFamily: 'monospace', fontSize: '13px' }}>
                <span>{id}</span>
                <CopyButton text={id} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 8. CSS BOX SHADOW & GLASSMORPHISM GENERATOR ─── */
export function CssShadowTool() {
  const [xOffset, setXOffset] = useState(0)
  const [yOffset, setYOffset] = useState(12)
  const [blur, setBlur] = useState(32)
  const [spread, setSpread] = useState(-4)
  const [color, setColor] = useState('#0f172a')
  const [opacity, setOpacity] = useState(20)
  const [inset, setInset] = useState(false)

  // Convert hex color + opacity to rgba
  const r = parseInt(color.slice(1, 3), 16) || 0
  const g = parseInt(color.slice(3, 5), 16) || 0
  const b = parseInt(color.slice(5, 7), 16) || 0
  const rgba = `rgba(${r}, ${g}, ${b}, ${opacity / 100})`
  const shadowCss = `${inset ? 'inset ' : ''}${xOffset}px ${yOffset}px ${blur}px ${spread}px ${rgba}`

  const fullCss = `box-shadow: ${shadowCss};
-webkit-box-shadow: ${shadowCss};`

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Sparkles size={16} /> CSS Box Shadow & Elevation Generator</span>
          <CopyButton text={fullCss} label="Copy CSS" />
        </div>

        <div className={styles.twoCol}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}><span>Horizontal Offset (X)</span><span className={styles.sliderValue}>{xOffset}px</span></div>
              <input type="range" min="-50" max="50" value={xOffset} className={styles.slider} onChange={e => setXOffset(Number(e.target.value))} />
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}><span>Vertical Offset (Y)</span><span className={styles.sliderValue}>{yOffset}px</span></div>
              <input type="range" min="-50" max="50" value={yOffset} className={styles.slider} onChange={e => setYOffset(Number(e.target.value))} />
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}><span>Blur Radius</span><span className={styles.sliderValue}>{blur}px</span></div>
              <input type="range" min="0" max="100" value={blur} className={styles.slider} onChange={e => setBlur(Number(e.target.value))} />
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}><span>Spread Radius</span><span className={styles.sliderValue}>{spread}px</span></div>
              <input type="range" min="-50" max="50" value={spread} className={styles.slider} onChange={e => setSpread(Number(e.target.value))} />
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}><span>Shadow Opacity</span><span className={styles.sliderValue}>{opacity}%</span></div>
              <input type="range" min="0" max="100" value={opacity} className={styles.slider} onChange={e => setOpacity(Number(e.target.value))} />
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input type="checkbox" checked={inset} onChange={e => setInset(e.target.checked)} />
                Inset Shadow
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <span>Shadow Color:</span>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '32px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <div className={styles.previewBox} style={{ width: '100%', minHeight: '260px', background: '#f8fafc' }}>
              <div
                style={{
                  width: '180px',
                  height: '140px',
                  background: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: shadowCss,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  color: '#334155'
                }}
              >
                Preview Card
              </div>
            </div>

            <div className={styles.codeBox} style={{ width: '100%' }}>
              {fullCss}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
