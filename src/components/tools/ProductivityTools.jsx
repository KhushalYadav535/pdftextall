import React, { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  Timer, Clock, Scale, Monitor, Dices, Play, Pause,
  RotateCcw, Copy, Check, Sparkles, RefreshCw, Zap
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

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
  } catch {}
}

/* ─── 1. POMODORO FOCUS TIMER ─── */
export function PomodoroTimerTool() {
  const [mode, setMode] = useState('work') // 'work' (25m), 'shortBreak' (5m), 'longBreak' (15m)
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const timerRef = useRef(null)

  const switchMode = (newMode) => {
    setMode(newMode)
    setIsRunning(false)
    if (newMode === 'work') setTimeLeft(25 * 60)
    else if (newMode === 'shortBreak') setTimeLeft(5 * 60)
    else setTimeLeft(15 * 60)
  }

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            setIsRunning(false)
            playBeep()
            toast.success(mode === 'work' ? 'Pomodoro completed! Time for a break.' : 'Break ended! Ready to focus?')
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isRunning, mode])

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0')
  const secs = (timeLeft % 60).toString().padStart(2, '0')

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Timer size={16} /> Pomodoro Focus & Productivity Timer</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '16px 0' }}>
          <div className={styles.pillTabs}>
            <button className={`${styles.pillBtn} ${mode === 'work' ? styles.pillBtnActive : ''}`} onClick={() => switchMode('work')}>Pomodoro (25m)</button>
            <button className={`${styles.pillBtn} ${mode === 'shortBreak' ? styles.pillBtnActive : ''}`} onClick={() => switchMode('shortBreak')}>Short Break (5m)</button>
            <button className={`${styles.pillBtn} ${mode === 'longBreak' ? styles.pillBtnActive : ''}`} onClick={() => switchMode('longBreak')}>Long Break (15m)</button>
          </div>

          <div style={{ fontSize: '72px', fontWeight: 800, fontFamily: 'monospace', color: mode === 'work' ? '#10b981' : '#3b82f6' }}>
            {mins}:{secs}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className={isRunning ? styles.btnDanger : styles.btnPrimary}
              style={{ minWidth: '140px', height: '46px', fontSize: '15px' }}
              onClick={() => setIsRunning(!isRunning)}
            >
              {isRunning ? <Pause size={16} /> : <Play size={16} />}
              {isRunning ? 'Pause' : 'Start Focus'}
            </button>
            <button className={styles.btnSecondary} onClick={() => switchMode(mode)}>
              <RotateCcw size={15} /> Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 2. UNIX TIMESTAMP & EPOCH CONVERTER ─── */
export function EpochConverterTool() {
  const [currentEpoch, setCurrentEpoch] = useState(Math.floor(Date.now() / 1000))
  const [inputEpoch, setInputEpoch] = useState(String(Math.floor(Date.now() / 1000)))
  const [inputDate, setInputDate] = useState(new Date().toISOString().slice(0, 16))

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentEpoch(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Parse input epoch
  let humanDate = ''
  let isoDate = ''
  try {
    const ms = Number(inputEpoch) > 9999999999 ? Number(inputEpoch) : Number(inputEpoch) * 1000
    const d = new Date(ms)
    humanDate = d.toUTCString()
    isoDate = d.toLocaleString()
  } catch {
    humanDate = 'Invalid Timestamp'
  }

  // Parse input date to epoch
  let convertedEpoch = ''
  try {
    convertedEpoch = Math.floor(new Date(inputDate).getTime() / 1000)
  } catch {
    convertedEpoch = 'Invalid'
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Clock size={16} /> UNIX Epoch & Timestamp Converter</span>
          <span className={styles.statBadge}>Current Epoch: {currentEpoch}</span>
        </div>

        <div className={styles.twoCol}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span className={styles.fieldLabel}>Convert Epoch to Human Date</span>
            <div className={styles.fieldGroup}>
              <input
                type="text"
                className={styles.input}
                value={inputEpoch}
                onChange={e => setInputEpoch(e.target.value)}
                placeholder="UNIX timestamp in seconds..."
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div><strong>Local Time:</strong> {isoDate}</div>
              <div><strong>UTC / GMT:</strong> {humanDate}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span className={styles.fieldLabel}>Convert Human Date to Epoch</span>
            <div className={styles.fieldGroup}>
              <input
                type="datetime-local"
                className={styles.input}
                value={inputDate}
                onChange={e => setInputDate(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div><strong>UNIX Epoch:</strong> <code style={{ color: '#10b981', fontWeight: 700 }}>{convertedEpoch}</code></div>
              <CopyButton text={String(convertedEpoch)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 3. UNIVERSAL UNIT CONVERTER ─── */
export function UnitConverterTool() {
  const [category, setCategory] = useState('length')
  const [fromVal, setFromVal] = useState(10)
  const [fromUnit, setFromUnit] = useState('meter')
  const [toUnit, setToUnit] = useState('foot')

  const UNITS = {
    length: {
      meter: 1,
      kilometer: 1000,
      centimeter: 0.01,
      millimeter: 0.001,
      inch: 0.0254,
      foot: 0.3048,
      yard: 0.9144,
      mile: 1609.34
    },
    weight: {
      kilogram: 1,
      gram: 0.001,
      milligram: 0.000001,
      pound: 0.453592,
      ounce: 0.0283495
    },
    data: {
      byte: 1,
      kilobyte: 1024,
      megabyte: 1024 * 1024,
      gigabyte: 1024 * 1024 * 1024,
      terabyte: 1024 * 1024 * 1024 * 1024
    }
  }

  // Calculate conversion
  let result = 0
  if (category in UNITS) {
    const map = UNITS[category]
    const inBase = fromVal * (map[fromUnit] || 1)
    result = inBase / (map[toUnit] || 1)
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Scale size={16} /> Universal Unit Converter</span>
        </div>

        <div className={styles.pillTabs} style={{ maxWidth: '320px', margin: '0 auto' }}>
          <button className={`${styles.pillBtn} ${category === 'length' ? styles.pillBtnActive : ''}`} onClick={() => { setCategory('length'); setFromUnit('meter'); setToUnit('foot'); }}>Length</button>
          <button className={`${styles.pillBtn} ${category === 'weight' ? styles.pillBtnActive : ''}`} onClick={() => { setCategory('weight'); setFromUnit('kilogram'); setToUnit('pound'); }}>Weight</button>
          <button className={`${styles.pillBtn} ${category === 'data' ? styles.pillBtnActive : ''}`} onClick={() => { setCategory('data'); setFromUnit('gigabyte'); setToUnit('megabyte'); }}>Data Storage</button>
        </div>

        <div className={styles.twoCol} style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className={styles.fieldLabel}>From</label>
            <input
              type="number"
              className={styles.input}
              value={fromVal}
              onChange={e => setFromVal(Number(e.target.value))}
            />
            <select className={styles.select} value={fromUnit} onChange={e => setFromUnit(e.target.value)}>
              {Object.keys(UNITS[category] || {}).map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className={styles.fieldLabel}>To Result</label>
            <input
              type="text"
              className={styles.input}
              style={{ fontWeight: 700, color: '#10b981' }}
              value={result.toFixed(4).replace(/\.?0+$/, '')}
              readOnly
            />
            <select className={styles.select} value={toUnit} onChange={e => setToUnit(e.target.value)}>
              {Object.keys(UNITS[category] || {}).map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 4. SCREEN PPI & ASPECT RATIO CALCULATOR ─── */
export function ScreenCalculatorTool() {
  const [width, setWidth] = useState(1920)
  const [height, setHeight] = useState(1080)
  const [diagonal, setDiagonal] = useState(24)

  // Greatest Common Divisor for Aspect Ratio
  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b)
  const d = gcd(width, height)
  const aspectW = width / d
  const aspectH = height / d

  // Calculate PPI: sqrt(w^2 + h^2) / diagonal
  const ppi = diagonal > 0
    ? Math.round(Math.sqrt(width * width + height * height) / diagonal)
    : 0

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Monitor size={16} /> Screen Resolution, PPI & Aspect Ratio Calculator</span>
        </div>

        <div className={styles.twoCol}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Horizontal Pixels (Width)</label>
              <input type="number" className={styles.input} value={width} onChange={e => setWidth(Number(e.target.value))} />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Vertical Pixels (Height)</label>
              <input type="number" className={styles.input} value={height} onChange={e => setHeight(Number(e.target.value))} />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Screen Diagonal (Inches)</label>
              <input type="number" step="0.5" className={styles.input} value={diagonal} onChange={e => setDiagonal(Number(e.target.value))} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#f8fafc', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Reduced Aspect Ratio</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a' }}>{aspectW}:{aspectH}</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Pixel Density</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#10b981' }}>{ppi} <span style={{ fontSize: '16px', fontWeight: 500, color: '#64748b' }}>PPI</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 5. FAIR DECISION MAKER (WHEEL / COIN / DICE) ─── */
export function DecisionMakerTool() {
  const [tab, setTab] = useState('wheel') // 'wheel' | 'coin' | 'dice'
  const [options, setOptions] = useState('Pizza, Burgers, Sushi, Salad, Tacos')
  const [winner, setWinner] = useState(null)
  const [coinResult, setCoinResult] = useState(null)
  const [diceResults, setDiceResults] = useState([6])
  const canvasRef = useRef(null)

  const choices = options.split(',').map(s => s.trim()).filter(Boolean)

  const spinWheel = () => {
    if (choices.length < 2) return
    const randomIdx = Math.floor(Math.random() * choices.length)
    setWinner(choices[randomIdx])
    toast.success(`Winner: ${choices[randomIdx]}!`)
  }

  const flipCoin = () => {
    const isHeads = Math.random() >= 0.5
    setCoinResult(isHeads ? 'HEADS' : 'TAILS')
  }

  const rollDice = () => {
    const roll = Math.floor(Math.random() * 6) + 1
    setDiceResults([roll])
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Dices size={16} /> Fair Decision Maker, Coin Flipper & Dice Roller</span>
          <div className={styles.pillTabs}>
            <button className={`${styles.pillBtn} ${tab === 'wheel' ? styles.pillBtnActive : ''}`} onClick={() => setTab('wheel')}>Choice Picker</button>
            <button className={`${styles.pillBtn} ${tab === 'coin' ? styles.pillBtnActive : ''}`} onClick={() => setTab('coin')}>Coin Flip</button>
            <button className={`${styles.pillBtn} ${tab === 'dice' ? styles.pillBtnActive : ''}`} onClick={() => setTab('dice')}>Dice Roll</button>
          </div>
        </div>

        {tab === 'wheel' && (
          <div className={styles.twoCol}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label className={styles.fieldLabel}>Enter Options (comma-separated)</label>
              <textarea
                className={styles.textarea}
                rows={4}
                value={options}
                onChange={e => setOptions(e.target.value)}
              />
              <button className={styles.btnPrimary} style={{ height: '44px' }} onClick={spinWheel}>
                <Sparkles size={16} /> Randomly Choose For Me!
              </button>
            </div>

            <div className={styles.previewBox}>
              {winner ? (
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Decision Result</span>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: '#10b981', marginTop: '6px' }}>{winner}</div>
                </div>
              ) : (
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Click Choose to pick randomly</span>
              )}
            </div>
          </div>
        )}

        {tab === 'coin' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
            <div style={{
              width: '120px', height: '120px', borderRadius: '50%',
              background: '#f59e0b', color: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', fontWeight: 800, boxShadow: '0 8px 24px rgba(245,158,11,0.35)'
            }}>
              {coinResult || 'FLIP'}
            </div>
            <button className={styles.btnPrimary} onClick={flipCoin}>Flip Coin</button>
          </div>
        )}

        {tab === 'dice' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
            <div style={{
              width: '100px', height: '100px', borderRadius: '16px',
              background: '#0f172a', color: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '44px', fontWeight: 800, boxShadow: '0 8px 24px rgba(15,23,42,0.3)'
            }}>
              {diceResults[0]}
            </div>
            <button className={styles.btnPrimary} onClick={rollDice}>Roll 6-Sided Die</button>
          </div>
        )}
      </div>
    </div>
  )
}
