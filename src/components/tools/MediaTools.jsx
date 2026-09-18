import React, { useState, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import {
  Video, Mic, Music, Scissors, Download, Play, Square,
  FastForward, Volume2, Film, Check, RefreshCw
} from 'lucide-react'
import {
  ScreenRecorder, VoiceRecorder, extractAudioFromVideo,
  trimAudio, changeAudioSpeed
} from '../../lib/mediaEngine.js'
import styles from './StudioTools.module.css'

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function MediaDropper({ onFile, file, accept, label }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    maxFiles: 1,
    onDrop: ([f]) => f && onFile(f)
  })

  if (file) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Film size={18} color="#10b981" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{file.name}</span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
        </div>
        <button className={styles.btnSecondary} onClick={() => onFile(null)}>Change File</button>
      </div>
    )
  }

  return (
    <div {...getRootProps()} style={{ border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: isDragActive ? '#f0fdf4' : '#f8fafc', transition: 'all 0.2s' }}>
      <input {...getInputProps()} />
      <Film size={32} color="#10b981" style={{ margin: '0 auto 8px', display: 'block' }} />
      <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#334155' }}>{isDragActive ? 'Drop file here...' : label}</p>
    </div>
  )
}

/* ─── 1. SCREEN & AUDIO RECORDER TOOL ─── */
export function ScreenRecorderTool() {
  const [recording, setRecording] = useState(false)
  const [withMic, setWithMic] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [recordedVideo, setRecordedVideo] = useState(null)
  const recorderRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startRecord = async () => {
    try {
      const recorder = new ScreenRecorder()
      recorderRef.current = recorder
      await recorder.start({ withMic })
      setRecording(true)
      setSeconds(0)
      setRecordedVideo(null)

      timerRef.current = setInterval(() => {
        setSeconds(s => s + 1)
      }, 1000)
      toast.success('Screen recording started!')
    } catch (err) {
      toast.error('Unable to start recording: ' + err.message)
    }
  }

  const stopRecord = async () => {
    if (!recorderRef.current) return
    try {
      if (timerRef.current) clearInterval(timerRef.current)
      const res = await recorderRef.current.stop()
      setRecording(false)
      const url = URL.createObjectURL(res.blob)
      setRecordedVideo({ blob: res.blob, url, mimeType: res.mimeType })
      toast.success('Recording finished!')
    } catch (err) {
      toast.error('Failed to stop recording: ' + err.message)
    }
  }

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Video size={16} /> Screen & Audio Recorder</span>
          {recording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className={styles.recordingPulse} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>REC {formatTime(seconds)}</span>
            </div>
          )}
        </div>

        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          Record your screen, browser tab, or entire display with internal system audio and optional microphone input. 100% private, never uploaded anywhere.
        </p>

        {!recording && !recordedVideo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '24px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={withMic}
                onChange={(e) => setWithMic(e.target.checked)}
              />
              Include Microphone Audio (Narrate over video)
            </label>

            <button className={styles.btnPrimary} onClick={startRecord} style={{ minWidth: '220px' }}>
              <Video size={16} /> Start Screen Recording
            </button>
          </div>
        )}

        {recording && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Recording in progress: {formatTime(seconds)}</div>
            <button className={styles.btnDanger} onClick={stopRecord} style={{ minWidth: '220px' }}>
              <Square size={16} /> Stop Recording
            </button>
          </div>
        )}

        {recordedVideo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <video
              src={recordedVideo.url}
              controls
              autoPlay
              style={{ maxWidth: '100%', maxHeight: '360px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className={styles.btnPrimary}
                onClick={() => triggerDownload(recordedVideo.blob, `screen-recording-${Date.now()}.webm`)}
              >
                <Download size={15} /> Download Recording (.webm)
              </button>
              <button className={styles.btnSecondary} onClick={() => setRecordedVideo(null)}>
                Record Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 2. VIDEO TO AUDIO EXTRACTOR TOOL ─── */
export function VideoToAudioTool() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)

  const handleExtract = async () => {
    if (!file) return
    try {
      setLoading(true)
      const res = await extractAudioFromVideo(file, p => setProgress(p))
      const url = URL.createObjectURL(res.blob)
      setResult({ ...res, url })
      toast.success('Audio extracted successfully!')
    } catch (err) {
      toast.error('Extraction failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Music size={16} /> Video to Audio Extractor</span>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          Extract high-fidelity uncompressed WAV audio soundtrack directly from any MP4, WebM, MOV, or MKV video file.
        </p>

        <MediaDropper
          file={file}
          onFile={(f) => { setFile(f); setResult(null); }}
          accept={{ 'video/*': ['.mp4', '.webm', '.mov', '.mkv', '.avi'] }}
          label="Drop video file to extract audio"
        />

        {file && !result && (
          <button className={styles.btnPrimary} onClick={handleExtract} disabled={loading} style={{ alignSelf: 'center' }}>
            <Music size={15} /> {loading ? `Extracting Sound (${progress}%)...` : 'Extract Audio Soundtrack'}
          </button>
        )}

        {result && (
          <div className={styles.previewBox} style={{ width: '100%', boxSizing: 'border-box' }}>
            <audio src={result.url} controls style={{ width: '100%', marginBottom: '14px' }} />
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span className={styles.statBadge}>Duration: {result.duration.toFixed(1)}s</span>
              <button
                className={styles.btnPrimary}
                onClick={() => {
                  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
                  triggerDownload(result.blob, `${baseName}-audio.wav`)
                }}
              >
                <Download size={15} /> Download Audio (.WAV)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 3. AUDIO TRIMMER & CUTTER TOOL ─── */
export function AudioTrimmerTool() {
  const [file, setFile] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [duration, setDuration] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(10)
  const [loading, setLoading] = useState(false)
  const [trimmed, setTrimmed] = useState(null)
  const audioRef = useRef(null)

  const handleFile = (f) => {
    setFile(f)
    setTrimmed(null)
    if (f) {
      const url = URL.createObjectURL(f)
      setAudioUrl(url)
    }
  }

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration
      setDuration(d)
      setStartTime(0)
      setEndTime(Math.min(d, 30))
    }
  }

  const handleTrim = async () => {
    if (!file) return
    if (startTime >= endTime) {
      toast.error('Start time must be less than end time')
      return
    }
    try {
      setLoading(true)
      const res = await trimAudio(file, startTime, endTime)
      const url = URL.createObjectURL(res.blob)
      setTrimmed({ ...res, url })
      toast.success('Audio trimmed successfully!')
    } catch (err) {
      toast.error('Trimming failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Scissors size={16} /> Audio Trimmer & Cutter</span>
        </div>

        <MediaDropper
          file={file}
          onFile={handleFile}
          accept={{ 'audio/*': ['.mp3', '.wav', '.ogg', '.m4a', '.aac'] }}
          label="Drop audio file to cut / trim"
        />

        {audioUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
            <audio
              ref={audioRef}
              src={audioUrl}
              controls
              onLoadedMetadata={onLoadedMetadata}
              style={{ width: '100%' }}
            />

            <div className={styles.twoCol}>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>
                  <span>Start Time (seconds)</span>
                  <span className={styles.sliderValue}>{startTime.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={startTime}
                  className={styles.slider}
                  onChange={(e) => setStartTime(Number(e.target.value))}
                />
              </div>

              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>
                  <span>End Time (seconds)</span>
                  <span className={styles.sliderValue}>{endTime.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={endTime}
                  className={styles.slider}
                  onChange={(e) => setEndTime(Number(e.target.value))}
                />
              </div>
            </div>

            <button className={styles.btnPrimary} onClick={handleTrim} disabled={loading} style={{ alignSelf: 'center' }}>
              <Scissors size={15} /> {loading ? 'Trimming...' : `Trim Segment (${(endTime - startTime).toFixed(1)}s)`}
            </button>
          </div>
        )}

        {trimmed && (
          <div className={styles.previewBox} style={{ width: '100%', boxSizing: 'border-box', marginTop: '12px' }}>
            <span className={styles.statBadge} style={{ marginBottom: '10px' }}>
              Trimmed Clip: {trimmed.duration.toFixed(1)} seconds
            </span>
            <audio src={trimmed.url} controls style={{ width: '100%', marginBottom: '12px' }} />
            <button
              className={styles.btnPrimary}
              onClick={() => triggerDownload(trimmed.blob, `trimmed-${file.name.replace(/\.[^/.]+$/, '')}.wav`)}
            >
              <Download size={15} /> Download Trimmed Audio (.WAV)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── 4. VOICE RECORDER & SPEED CHANGER TOOL ─── */
export function VoiceRecorderTool() {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [recordedAudio, setRecordedAudio] = useState(null)
  const [speed, setSpeed] = useState(1.0)
  const [processedAudio, setProcessedAudio] = useState(null)
  const [loading, setLoading] = useState(false)
  const recorderRef = useRef(null)
  const timerRef = useRef(null)

  const startVoiceRecord = async () => {
    try {
      const rec = new VoiceRecorder()
      recorderRef.current = rec
      await rec.start()
      setRecording(true)
      setSeconds(0)
      setRecordedAudio(null)
      setProcessedAudio(null)

      timerRef.current = setInterval(() => {
        setSeconds(s => s + 1)
      }, 1000)
      toast.success('Voice recording started!')
    } catch (err) {
      toast.error('Microphone access denied: ' + err.message)
    }
  }

  const stopVoiceRecord = async () => {
    if (!recorderRef.current) return
    try {
      if (timerRef.current) clearInterval(timerRef.current)
      const res = await recorderRef.current.stop()
      setRecording(false)
      const url = URL.createObjectURL(res.blob)
      setRecordedAudio({ blob: res.blob, url })
      toast.success('Voice note saved!')
    } catch (err) {
      toast.error('Failed to stop recording: ' + err.message)
    }
  }

  const applySpeed = async () => {
    if (!recordedAudio) return
    try {
      setLoading(true)
      const res = await changeAudioSpeed(recordedAudio.blob, speed)
      const url = URL.createObjectURL(res.blob)
      setProcessedAudio({ ...res, url })
      toast.success(`Speed adjusted to ${speed}x!`)
    } catch (err) {
      toast.error('Speed change failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div className={styles.toolBox}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}><Mic size={16} /> Voice Recorder & Speed Changer</span>
          {recording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className={styles.recordingPulse} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>{formatTime(seconds)}</span>
            </div>
          )}
        </div>

        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          Record high-quality audio notes directly from your microphone with real-time speed adjustments (0.5x to 2x).
        </p>

        {!recording && !recordedAudio && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <button className={styles.btnPrimary} onClick={startVoiceRecord} style={{ minWidth: '200px' }}>
              <Mic size={16} /> Start Voice Recording
            </button>
          </div>
        )}

        {recording && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Recording: {formatTime(seconds)}</div>
            <button className={styles.btnDanger} onClick={stopVoiceRecord} style={{ minWidth: '200px' }}>
              <Square size={16} /> Finish Recording
            </button>
          </div>
        )}

        {recordedAudio && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <audio src={recordedAudio.url} controls style={{ width: '100%' }} />

            <div className={styles.twoCol}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Playback Speed Multiplier</label>
                <select className={styles.select} value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                  <option value="0.5">0.5x (Slow Motion)</option>
                  <option value="0.75">0.75x</option>
                  <option value="1.0">1.0x (Normal)</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x (Fast Listen)</option>
                  <option value="2.0">2.0x (Double Speed)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <button className={styles.btnSecondary} onClick={applySpeed} disabled={loading} style={{ flex: 1 }}>
                  <FastForward size={14} /> Apply Speed
                </button>
                <button
                  className={styles.btnPrimary}
                  onClick={() => triggerDownload(processedAudio ? processedAudio.blob : recordedAudio.blob, 'voice-recording.wav')}
                >
                  <Download size={14} /> Download WAV
                </button>
              </div>
            </div>

            {processedAudio && (
              <div className={styles.previewBox}>
                <span className={styles.statBadge} style={{ marginBottom: '8px' }}>Rendered at {speed}x speed</span>
                <audio src={processedAudio.url} controls style={{ width: '100%' }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
