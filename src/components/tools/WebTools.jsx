import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  Globe, Code, Laptop, Copy, Check, Download,
  RefreshCw, Plus, Trash2, Shield, Wifi, Battery, Monitor
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

/* ─── 1. URL PARSER & QUERY PARAMS EDITOR ─── */
export function UrlParserTool() {
  const [rawUrl, setRawUrl] = useState('https://api.example.com:8080/v1/users/search?query=developer&status=active&limit=50#results')
  const [parsed, setParsed] = useState(null)
  const [params, setParams] = useState([])

  useEffect(() => {
    try {
      const u = new URL(rawUrl)
      setParsed({
        protocol: u.protocol,
        host: u.host,
        hostname: u.hostname,
        port: u.port || '(default)',
        pathname: u.pathname,
        hash: u.hash
      })
      const p = []
      u.searchParams.forEach((val, key) => {
        p.push({ key, val })
      })
      setParams(p)
    } catch {
      setParsed(null)
    }
  }, [rawUrl])

  const updateParam = (index, newKey, newVal) => {
    const updated = [...params]
    updated[index] = { key: newKey, val: newVal }
    setParams(updated)
    rebuildUrl(updated)
  }

  const addParam = () => {
    const updated = [...params, { key: 'new_param', val: 'value' }]
    setParams(updated)
    rebuildUrl(updated)
  }

  const removeParam = (index) => {
    const updated = params.filter((_, i) => i !== index)
    setParams(updated)
    rebuildUrl(updated)
  }

  const rebuildUrl = (newParams) => {
    try {
      const u = new URL(rawUrl)
      u.search = ''
      newParams.forEach(p => {
        if (p.key) u.searchParams.append(p.key, p.val)
      })
      setRawUrl(u.toString())
    } catch {}
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Globe size={16} /> URL Inspector & Query Parameters Editor</span>
          <CopyButton text={rawUrl} label="Copy Clean URL" />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>URL Input</label>
          <input
            type="text"
            className={styles.input}
            style={{ fontFamily: 'monospace' }}
            value={rawUrl}
            onChange={e => setRawUrl(e.target.value)}
          />
        </div>

        {parsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
              {[
                { label: 'Protocol', val: parsed.protocol },
                { label: 'Host', val: parsed.host },
                { label: 'Port', val: parsed.port },
                { label: 'Path', val: parsed.pathname },
                { label: 'Hash Tag', val: parsed.hash || '(none)' },
              ].map(item => (
                <div key={item.label} style={{ background: '#f8fafc', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>{item.label}</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>{item.val}</div>
                </div>
              ))}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className={styles.fieldLabel}>Query Parameters ({params.length})</span>
                <button className={styles.btnSecondary} style={{ padding: '4px 8px', fontSize: '11px' }} onClick={addParam}>
                  <Plus size={12} /> Add Parameter
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {params.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className={styles.input}
                      style={{ flex: 1, fontFamily: 'monospace' }}
                      value={p.key}
                      onChange={e => updateParam(idx, e.target.value, p.val)}
                      placeholder="key"
                    />
                    <span style={{ color: '#94a3b8' }}>=</span>
                    <input
                      type="text"
                      className={styles.input}
                      style={{ flex: 1.5, fontFamily: 'monospace' }}
                      value={p.val}
                      onChange={e => updateParam(idx, p.key, e.target.value)}
                      placeholder="value"
                    />
                    <button className={styles.btnSecondary} style={{ padding: '8px', color: '#ef4444' }} onClick={() => removeParam(idx)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 2. HTML / CSS / JS CODE FORMATTER ─── */
export function CodeFormatterTool() {
  const [lang, setLang] = useState('html') // 'html', 'css', 'js'
  const [code, setCode] = useState('<div class="header"><h1>Hello PDFZero</h1><p>Client-side formatting</p></div>')
  const [output, setOutput] = useState('')

  const formatCode = () => {
    let formatted = code
    if (lang === 'html') {
      let indent = 0
      formatted = code
        .replace(/>\s*</g, '>\n<')
        .split('\n')
        .map(line => {
          if (line.match(/^<\//)) indent = Math.max(0, indent - 1)
          const pad = '  '.repeat(indent)
          if (line.match(/^<[^\/]/) && !line.match(/\/>$/) && !line.match(/<(img|hr|br|input)/i)) indent++
          return pad + line.trim()
        })
        .join('\n')
    } else if (lang === 'css') {
      formatted = code
        .replace(/\s*{\s*/g, ' {\n  ')
        .replace(/;\s*/g, ';\n  ')
        .replace(/\s*}\s*/g, '\n}\n')
        .trim()
    } else {
      // JS simple formatting
      formatted = code
        .replace(/([{};])/g, '$1\n')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .join('\n')
    }
    setOutput(formatted)
    toast.success('Code formatted!')
  }

  const minifyCode = () => {
    const min = code.replace(/\s+/g, ' ').replace(/\s*([{};:,>])\s*/g, '$1').trim()
    setOutput(min)
    toast.success('Code minified!')
  }

  useEffect(() => {
    formatCode()
  }, [code, lang])

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Code size={16} /> Code Formatter & Minifier (HTML / CSS / JS)</span>
          <div className={styles.pillTabs}>
            <button className={`${styles.pillBtn} ${lang === 'html' ? styles.pillBtnActive : ''}`} onClick={() => setLang('html')}>HTML</button>
            <button className={`${styles.pillBtn} ${lang === 'css' ? styles.pillBtnActive : ''}`} onClick={() => setLang('css')}>CSS</button>
            <button className={`${styles.pillBtn} ${lang === 'js' ? styles.pillBtnActive : ''}`} onClick={() => setLang('js')}>JavaScript</button>
          </div>
        </div>

        <div className={styles.twoCol}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Raw Code Input</label>
            <textarea
              className={styles.textarea}
              style={{ minHeight: '300px' }}
              value={code}
              onChange={e => setCode(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button className={styles.btnPrimary} style={{ flex: 1 }} onClick={formatCode}>Beautify Code</button>
              <button className={styles.btnSecondary} style={{ flex: 1 }} onClick={minifyCode}>Minify Code</button>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}>
              <span>Formatted Result</span>
              {output && <CopyButton text={output} />}
            </div>
            <textarea
              className={styles.textarea}
              style={{ minHeight: '300px', background: '#0f172a', color: '#38bdf8' }}
              value={output}
              readOnly
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 3. DEVICE & BROWSER DIAGNOSTICS ─── */
export function DeviceDiagnosticsTool() {
  const [info, setInfo] = useState({})

  useEffect(() => {
    // Collect device metrics
    const gl = document.createElement('canvas').getContext('webgl')
    let gpu = 'Standard Renderer'
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      if (dbg) gpu = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
    }

    const details = {
      screenResolution: `${window.screen.width} x ${window.screen.height}`,
      colorDepth: `${window.screen.colorDepth}-bit`,
      devicePixelRatio: `${window.devicePixelRatio}x`,
      userAgent: navigator.userAgent,
      platform: navigator.platform || 'Unknown',
      language: navigator.language,
      logicalProcessors: `${navigator.hardwareConcurrency || 4} CPU Cores`,
      deviceMemory: navigator.deviceMemory ? `~${navigator.deviceMemory} GB RAM` : 'Supported (Desktop)',
      online: navigator.onLine ? 'Connected (Online)' : 'Offline',
      gpuRenderer: gpu,
      cookiesEnabled: navigator.cookieEnabled ? 'Yes' : 'No',
    }

    if ('getBattery' in navigator) {
      navigator.getBattery().then(bat => {
        setInfo(prev => ({
          ...prev,
          battery: `${Math.round(bat.level * 100)}% (${bat.charging ? 'Charging' : 'On Battery'})`
        }))
      })
    }

    setInfo(details)
  }, [])

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Laptop size={16} /> Device, Screen & Browser Diagnostics</span>
          <CopyButton text={JSON.stringify(info, null, 2)} label="Copy System Report" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Display Resolution', val: info.screenResolution, icon: Monitor },
            { label: 'Pixel Ratio (DPI Scale)', val: info.devicePixelRatio, icon: Monitor },
            { label: 'Color Depth', val: info.colorDepth, icon: Monitor },
            { label: 'CPU Cores', val: info.logicalProcessors, icon: Laptop },
            { label: 'System Memory', val: info.deviceMemory, icon: Laptop },
            { label: 'Network State', val: info.online, icon: Wifi },
            { label: 'Language & Locale', val: info.language, icon: Globe },
            { label: 'Battery Status', val: info.battery || 'Desktop / Unmetered', icon: Battery },
          ].map(item => {
            const Icon = item.icon
            return (
              <div key={item.label} style={{ background: '#f8fafc', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Icon size={20} color="#10b981" />
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{item.label}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{item.val}</div>
                </div>
              </div>
            )
          })}
        </div>

        <div className={styles.fieldGroup} style={{ marginTop: '10px' }}>
          <label className={styles.fieldLabel}>Graphics Hardware (GPU)</label>
          <div style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace' }}>
            {info.gpuRenderer}
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Client User Agent</label>
          <div style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace', color: '#475569', wordBreak: 'break-all' }}>
            {info.userAgent}
          </div>
        </div>
      </div>
    </div>
  )
}
