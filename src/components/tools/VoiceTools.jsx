import React, { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  Volume2, Mic, MicOff, Play, Pause, Square, Sliders,
  CloudRain, Wind, Sparkles, Copy, Check, Download, RefreshCw
} from 'lucide-react'
import {
  getAvailableVoices, TextToSpeechPlayer, SpeechToTextTranscriber
} from '../../lib/speechEngine.js'
import { NoiseGenerator } from '../../lib/audioAcousticsEngine.js'
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

/* ─── 1. TEXT-TO-SPEECH (TTS) TOOL ─── */
export function TextToSpeechTool() {
  const [text, setText] = useState('Welcome to PDFZero. This is 100% native in-browser voice synthesis with zero latency.')
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [rate, setRate] = useState(1.0)
  const [pitch, setPitch] = useState(1.0)
  const [volume, setVolume] = useState(1.0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const playerRef = useRef(null)

  useEffect(() => {
    playerRef.current = new TextToSpeechPlayer()
    getAvailableVoices().then(v => {
      setVoices(v)
      if (v.length > 0) {
        setSelectedVoice(v[0].name)
      }
    })
    return () => {
      if (playerRef.current) playerRef.current.stop()
    }
  }, [])

  const handlePlay = () => {
    if (!text.trim()) return
    const voiceObj = voices.find(v => v.name === selectedVoice) || null
    try {
      playerRef.current.speak({
        text,
        voice: voiceObj,
        rate,
        pitch,
        volume,
        onEnd: () => {
          setIsPlaying(false)
          setIsPaused(false)
        },
        onError: () => {
          setIsPlaying(false)
          setIsPaused(false)
        }
      })
      setIsPlaying(true)
      setIsPaused(false)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handlePause = () => {
    if (playerRef.current) {
      if (isPaused) {
        playerRef.current.resume()
        setIsPaused(false)
      } else {
        playerRef.current.pause()
        setIsPaused(true)
      }
    }
  }

  const handleStop = () => {
    if (playerRef.current) {
      playerRef.current.stop()
      setIsPlaying(false)
      setIsPaused(false)
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Volume2 size={16} /> Text-to-Speech (TTS) Natural Voice Reader</span>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Text to Read Aloud</label>
          <textarea
            className={styles.textarea}
            style={{ minHeight: '160px' }}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type or paste any text to read aloud..."
          />
        </div>

        <div className={styles.twoCol}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Voice Selection ({voices.length} voices available)</label>
            <select
              className={styles.select}
              value={selectedVoice}
              onChange={e => setSelectedVoice(e.target.value)}
            >
              {voices.map((v, i) => (
                <option key={i} value={v.name}>{v.name} ({v.lang})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            {!isPlaying ? (
              <button className={styles.btnPrimary} style={{ flex: 1 }} onClick={handlePlay}>
                <Play size={15} /> Read Aloud
              </button>
            ) : (
              <>
                <button className={styles.btnSecondary} style={{ flex: 1 }} onClick={handlePause}>
                  <Pause size={14} /> {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button className={styles.btnDanger} style={{ flex: 1 }} onClick={handleStop}>
                  <Square size={14} /> Stop
                </button>
              </>
            )}
          </div>
        </div>

        <div className={styles.twoCol}>
          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}><span>Speech Rate (Speed)</span><span className={styles.sliderValue}>{rate}x</span></div>
            <input type="range" min="0.5" max="2.0" step="0.1" value={rate} className={styles.slider} onChange={e => setRate(Number(e.target.value))} />
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}><span>Voice Pitch</span><span className={styles.sliderValue}>{pitch}</span></div>
            <input type="range" min="0.5" max="1.5" step="0.1" value={pitch} className={styles.slider} onChange={e => setPitch(Number(e.target.value))} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 2. SPEECH-TO-TEXT (DICTATION) TOOL ─── */
export function SpeechToTextTool() {
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [lang, setLang] = useState('en-US')
  const transcriberRef = useRef(null)

  useEffect(() => {
    transcriberRef.current = new SpeechToTextTranscriber(
      ({ final, interim: inter }) => {
        if (final) {
          setTranscript(prev => prev + (prev ? ' ' : '') + final)
        }
        setInterim(inter)
      },
      (err) => {
        toast.error('Voice error: ' + err.error)
        setIsListening(false)
      }
    )
    return () => {
      if (transcriberRef.current) transcriberRef.current.stop()
    }
  }, [])

  const toggleListen = () => {
    if (!transcriberRef.current.isSupported) {
      toast.error('Speech recognition is supported in Chrome, Edge, and Safari.')
      return
    }

    if (isListening) {
      transcriberRef.current.stop()
      setIsListening(false)
      setInterim('')
      toast.success('Voice dictation paused')
    } else {
      try {
        transcriberRef.current.start(lang)
        setIsListening(true)
        toast.success('Listening... Speak into your microphone')
      } catch (err) {
        toast.error(err.message)
      }
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Mic size={16} /> Speech-to-Text Voice Dictation & Transcription</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select className={styles.select} style={{ width: 'auto', padding: '4px 8px' }} value={lang} onChange={e => setLang(e.target.value)}>
              <option value="en-US">English (US)</option>
              <option value="en-IN">English (India)</option>
              <option value="hi-IN">Hindi (हिन्दी)</option>
              <option value="es-ES">Spanish</option>
              <option value="fr-FR">French</option>
              <option value="de-DE">German</option>
            </select>
            {transcript && <CopyButton text={transcript} label="Copy Text" />}
            {transcript && <button className={styles.btnSecondary} onClick={() => { setTranscript(''); setInterim(''); }}>Clear</button>}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
          <button
            className={isListening ? styles.btnDanger : styles.btnPrimary}
            style={{ minWidth: '220px', padding: '12px 24px', fontSize: '15px' }}
            onClick={toggleListen}
          >
            {isListening ? (
              <>
                <div className={styles.recordingPulse} />
                Stop Listening
              </>
            ) : (
              <>
                <Mic size={16} />
                Start Voice Dictation
              </>
            )}
          </button>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Transcribed Text</label>
          <div style={{ position: 'relative' }}>
            <textarea
              className={styles.textarea}
              style={{ minHeight: '220px', fontSize: '14px', lineHeight: '1.6' }}
              value={transcript + (interim ? ' ' + interim : '')}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Speak into your microphone or start dictating notes..."
            />
            {interim && (
              <span style={{ position: 'absolute', bottom: '12px', right: '14px', fontSize: '11px', color: '#10b981', fontStyle: 'italic' }}>
                Transcribing live...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── 3. AMBIENT WHITE / PINK / BROWN NOISE TOOL ─── */
export function WhiteNoiseTool() {
  const [type, setType] = useState('pink')
  const [volume, setVolume] = useState(30)
  const [isPlaying, setIsPlaying] = useState(false)
  const generatorRef = useRef(null)

  useEffect(() => {
    generatorRef.current = new NoiseGenerator()
    return () => {
      if (generatorRef.current) generatorRef.current.stop()
    }
  }, [])

  const togglePlay = () => {
    if (isPlaying) {
      generatorRef.current.stop()
      setIsPlaying(false)
    } else {
      generatorRef.current.start(type, volume / 100)
      setIsPlaying(true)
    }
  }

  const changeType = (newType) => {
    setType(newType)
    if (isPlaying) {
      generatorRef.current.start(newType, volume / 100)
    }
  }

  const changeVolume = (val) => {
    setVolume(val)
    if (generatorRef.current) {
      generatorRef.current.setVolume(val / 100)
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Wind size={16} /> Ambient Focus & Relaxation Sound Machine</span>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          Synthesize pure acoustic white, pink, and brown noise in real time using the Web Audio API to block background distractions, improve deep focus, or sleep.
        </p>

        <div className={styles.pillTabs} style={{ maxWidth: '420px', margin: '10px auto' }}>
          <button className={`${styles.pillBtn} ${type === 'pink' ? styles.pillBtnActive : ''}`} onClick={() => changeType('pink')}>Pink Noise (Balanced)</button>
          <button className={`${styles.pillBtn} ${type === 'brown' ? styles.pillBtnActive : ''}`} onClick={() => changeType('brown')}>Brown Noise (Deep Bass)</button>
          <button className={`${styles.pillBtn} ${type === 'white' ? styles.pillBtnActive : ''}`} onClick={() => changeType('white')}>White Noise (Crisp)</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '16px 0' }}>
          <button
            className={isPlaying ? styles.btnDanger : styles.btnPrimary}
            style={{ width: '180px', height: '50px', fontSize: '15px' }}
            onClick={togglePlay}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            {isPlaying ? 'Mute Sound' : 'Play Ambient Sound'}
          </button>

          <div style={{ width: '100%', maxWidth: '320px' }}>
            <div className={styles.fieldLabel}><span>Volume</span><span className={styles.sliderValue}>{volume}%</span></div>
            <input type="range" min="0" max="100" value={volume} className={styles.slider} onChange={e => changeVolume(Number(e.target.value))} />
          </div>
        </div>
      </div>
    </div>
  )
}
