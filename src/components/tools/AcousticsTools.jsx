import React, { useState, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import {
  Activity, Play, Pause, Square, Music, Sliders,
  Volume2, Download, FastForward, RotateCcw, Zap
} from 'lucide-react'
import { ToneGenerator, Metronome, reverseAudio } from '../../lib/audioAcousticsEngine.js'
import styles from './StudioTools.module.css'

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ─── 1. TONE & FREQUENCY GENERATOR ─── */
export function ToneGeneratorTool() {
  const [freq, setFreq] = useState(440)
  const [type, setType] = useState('sine')
  const [volume, setVolume] = useState(25)
  const [isPlaying, setIsPlaying] = useState(false)
  const toneRef = useRef(null)

  useEffect(() => {
    toneRef.current = new ToneGenerator()
    return () => {
      if (toneRef.current) toneRef.current.stop()
    }
  }, [])

  const toggleTone = () => {
    if (isPlaying) {
      toneRef.current.stop()
      setIsPlaying(false)
    } else {
      toneRef.current.start({ frequency: freq, type, volume: volume / 100 })
      setIsPlaying(true)
    }
  }

  const changeFreq = (f) => {
    const val = Number(f)
    setFreq(val)
    if (toneRef.current) toneRef.current.setFrequency(val)
  }

  const changeType = (t) => {
    setType(t)
    if (toneRef.current) toneRef.current.setType(t)
  }

  const changeVol = (v) => {
    const val = Number(v)
    setVolume(val)
    if (toneRef.current) toneRef.current.setVolume(val / 100)
  }

  const PRESETS = [
    { name: 'A4 (Concert Pitch)', freq: 440 },
    { name: 'Middle C (C4)', freq: 261.63 },
    { name: 'Sub-bass Test (60 Hz)', freq: 60 },
    { name: 'Bass Test (120 Hz)', freq: 120 },
    { name: 'Midrange (1 kHz)', freq: 1000 },
    { name: 'High Treble (10 kHz)', freq: 10000 },
  ]

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Activity size={16} /> Precision Tone & Frequency Generator</span>
        </div>

        <div className={styles.twoCol}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>
                <span>Sound Frequency</span>
                <span className={styles.sliderValue}>{freq} Hz</span>
              </div>
              <input
                type="range"
                min="20"
                max="12000"
                value={freq}
                className={styles.slider}
                onChange={e => changeFreq(e.target.value)}
              />
            </div>

            <div className={styles.pillTabs}>
              <button className={`${styles.pillBtn} ${type === 'sine' ? styles.pillBtnActive : ''}`} onClick={() => changeType('sine')}>Sine Wave (Smooth)</button>
              <button className={`${styles.pillBtn} ${type === 'square' ? styles.pillBtnActive : ''}`} onClick={() => changeType('square')}>Square (8-bit)</button>
              <button className={`${styles.pillBtn} ${type === 'triangle' ? styles.pillBtnActive : ''}`} onClick={() => changeType('triangle')}>Triangle</button>
              <button className={`${styles.pillBtn} ${type === 'sawtooth' ? styles.pillBtnActive : ''}`} onClick={() => changeType('sawtooth')}>Sawtooth</button>
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}><span>Volume</span><span className={styles.sliderValue}>{volume}%</span></div>
              <input type="range" min="0" max="100" value={volume} className={styles.slider} onChange={e => changeVol(e.target.value)} />
            </div>

            <button
              className={isPlaying ? styles.btnDanger : styles.btnPrimary}
              style={{ height: '46px', fontSize: '15px' }}
              onClick={toggleTone}
            >
              {isPlaying ? <Square size={16} /> : <Play size={16} />}
              {isPlaying ? 'Mute Frequency' : `Play ${freq} Hz Sound`}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span className={styles.fieldLabel}>Standard Musical & Acoustic Tuning Presets</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {PRESETS.map(p => (
                <button
                  key={p.name}
                  className={styles.btnSecondary}
                  style={{ justifyContent: 'space-between', padding: '10px 12px' }}
                  onClick={() => changeFreq(p.freq)}
                >
                  <span style={{ fontSize: '12px' }}>{p.name}</span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#10b981' }}>{p.freq}Hz</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 2. BPM METRONOME & TAP TEMPO ─── */
export function MetronomeTool() {
  const [bpm, setBpm] = useState(120)
  const [beatsPerBar, setBeatsPerBar] = useState(4)
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeBeat, setActiveBeat] = useState(-1)
  const [tapTimes, setTapTimes] = useState([])
  const metronomeRef = useRef(null)

  useEffect(() => {
    metronomeRef.current = new Metronome((beat) => {
      setActiveBeat(beat)
    })
    return () => {
      if (metronomeRef.current) metronomeRef.current.stop()
    }
  }, [])

  const toggleMetronome = () => {
    if (isPlaying) {
      metronomeRef.current.stop()
      setIsPlaying(false)
      setActiveBeat(-1)
    } else {
      metronomeRef.current.start(bpm, beatsPerBar)
      setIsPlaying(true)
    }
  }

  const changeBpm = (val) => {
    const b = Number(val)
    setBpm(b)
    if (metronomeRef.current) metronomeRef.current.setBpm(b)
  }

  const handleTap = () => {
    const now = performance.now()
    const newTaps = [...tapTimes.filter(t => now - t < 3000), now]
    setTapTimes(newTaps)

    if (newTaps.length >= 2) {
      const intervals = []
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1])
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const calculatedBpm = Math.round(60000 / avgInterval)
      if (calculatedBpm >= 30 && calculatedBpm <= 300) {
        changeBpm(calculatedBpm)
      }
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Music size={16} /> Precision BPM Metronome & Tap Tempo</span>
        </div>

        <div className={styles.twoCol}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '48px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
              {bpm} <span style={{ fontSize: '18px', fontWeight: 500, color: '#64748b' }}>BPM</span>
            </div>

            <div style={{ width: '100%' }}>
              <input
                type="range"
                min="40"
                max="240"
                value={bpm}
                className={styles.slider}
                onChange={e => changeBpm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <button
                className={isPlaying ? styles.btnDanger : styles.btnPrimary}
                style={{ flex: 1, height: '44px', fontSize: '15px' }}
                onClick={toggleMetronome}
              >
                {isPlaying ? <Square size={16} /> : <Play size={16} />}
                {isPlaying ? 'Stop' : 'Start Metronome'}
              </button>

              <button
                className={styles.btnSecondary}
                style={{ flex: 1, height: '44px', fontWeight: 600 }}
                onClick={handleTap}
              >
                Tap Tempo ({tapTimes.length} taps)
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', justifyContent: 'center' }}>
            <span className={styles.fieldLabel}>Time Signature</span>
            <div className={styles.pillTabs}>
              {[2, 3, 4, 6].map(b => (
                <button
                  key={b}
                  className={`${styles.pillBtn} ${beatsPerBar === b ? styles.pillBtnActive : ''}`}
                  onClick={() => setBeatsPerBar(b)}
                >
                  {b}/4 Time
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              {Array.from({ length: beatsPerBar }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: activeBeat === i ? (i === 0 ? '#ef4444' : '#10b981') : '#e2e8f0',
                    transition: 'background 0.1s',
                    boxShadow: activeBeat === i ? '0 0 12px rgba(16,185,129,0.5)' : 'none'
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 3. AUDIO REVERSER TOOL ─── */
export function AudioReverserTool() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [reversedUrl, setReversedUrl] = useState(null)
  const [reversedBlob, setReversedBlob] = useState(null)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'audio/*': ['.mp3', '.wav', '.ogg', '.m4a'] },
    maxFiles: 1,
    onDrop: async ([f]) => {
      if (!f) return
      setFile(f)
      setReversedUrl(null)
      try {
        setLoading(true)
        const res = await reverseAudio(f)
        const url = URL.createObjectURL(res.blob)
        setReversedUrl(url)
        setReversedBlob(res.blob)
        toast.success('Audio reversed backwards successfully!')
      } catch (err) {
        toast.error('Audio reverse failed: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
  })

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><RotateCcw size={16} /> Backward Audio & Voice Reverser</span>
          {reversedBlob && (
            <button className={styles.btnPrimary} onClick={() => triggerDownload(reversedBlob, `reversed-${file.name.replace(/\.[^/.]+$/, '')}.wav`)}>
              <Download size={14} /> Download Reversed Audio (.WAV)
            </button>
          )}
        </div>

        <div {...getRootProps()} style={{ border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '30px', textAlign: 'center', cursor: 'pointer', background: isDragActive ? '#f0fdf4' : '#f8fafc' }}>
          <input {...getInputProps()} />
          <Music size={30} color="#10b981" style={{ margin: '0 auto 8px', display: 'block' }} />
          <span>{loading ? 'Reversing audio samples backwards...' : file ? file.name : 'Drop audio file to play & export in reverse'}</span>
        </div>

        {reversedUrl && (
          <div className={styles.previewBox} style={{ marginTop: '12px' }}>
            <span className={styles.statBadge} style={{ marginBottom: '10px' }}>Backward Audio Player</span>
            <audio src={reversedUrl} controls style={{ width: '100%' }} />
          </div>
        )}
      </div>
    </div>
  )
}
