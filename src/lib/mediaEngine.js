/**
 * Client-Side Media & Audio Processing Engine
 * 100% in-browser using Web Audio API and MediaRecorder API. Zero servers.
 */

/**
 * Encode an AudioBuffer into a standards-compliant 16-bit PCM WAV Blob
 */
export function encodeWAV(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16

  let result
  if (numChannels === 2) {
    result = interleave(audioBuffer.getChannelData(0), audioBuffer.getChannelData(1))
  } else {
    result = audioBuffer.getChannelData(0)
  }

  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const buffer = new ArrayBuffer(44 + result.length * bytesPerSample)
  const view = new DataView(buffer)

  /* RIFF identifier */
  writeString(view, 0, 'RIFF')
  /* file length minus RIFF identifier and length */
  view.setUint32(4, 36 + result.length * bytesPerSample, true)
  /* RIFF type & format chunk identifier */
  writeString(view, 8, 'WAVEfmt ')
  /* format chunk length */
  view.setUint32(16, 16, true)
  /* sample format (raw) */
  view.setUint16(20, format, true)
  /* channel count */
  view.setUint16(22, numChannels, true)
  /* sample rate */
  view.setUint32(24, sampleRate, true)
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true)
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true)
  /* bits per sample */
  view.setUint16(34, bitDepth, true)
  /* data chunk identifier */
  writeString(view, 36, 'data')
  /* data chunk length */
  view.setUint32(40, result.length * bytesPerSample, true)

  // Write PCM samples
  floatTo16BitPCM(view, 44, result)

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

function interleave(inputL, inputR) {
  const length = inputL.length + inputR.length
  const result = new Float32Array(length)
  let index = 0
  let inputIndex = 0

  while (index < length) {
    result[index++] = inputL[inputIndex]
    result[index++] = inputR[inputIndex]
    inputIndex++
  }
  return result
}

function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]))
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }
}

/**
 * Extract audio track from any video file (MP4, WebM, MKV, MOV) and return WAV blob
 */
export async function extractAudioFromVideo(videoFile, onProgress = () => {}) {
  onProgress(15)
  const arrayBuffer = await videoFile.arrayBuffer()
  onProgress(45)

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  onProgress(80)

  const wavBlob = encodeWAV(audioBuffer)
  onProgress(100)
  return {
    blob: wavBlob,
    duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
    channels: audioBuffer.numberOfChannels
  }
}

/**
 * Trim an audio file or AudioBuffer between startSec and endSec
 */
export async function trimAudio(audioFile, startSec, endSec) {
  const arrayBuffer = await audioFile.arrayBuffer()
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const decoded = await audioCtx.decodeAudioData(arrayBuffer)

  const sampleRate = decoded.sampleRate
  const startOffset = Math.max(0, Math.floor(startSec * sampleRate))
  const endOffset = Math.min(decoded.length, Math.floor(endSec * sampleRate))
  const frameCount = Math.max(1, endOffset - startOffset)

  const trimmedBuffer = audioCtx.createBuffer(
    decoded.numberOfChannels,
    frameCount,
    sampleRate
  )

  for (let i = 0; i < decoded.numberOfChannels; i++) {
    const src = decoded.getChannelData(i)
    const dest = trimmedBuffer.getChannelData(i)
    dest.set(src.subarray(startOffset, endOffset))
  }

  const wavBlob = encodeWAV(trimmedBuffer)
  return {
    blob: wavBlob,
    duration: trimmedBuffer.duration
  }
}

/**
 * Change Audio Playback Speed (0.5x to 2.0x) and export new WAV
 */
export async function changeAudioSpeed(audioFile, speedRatio = 1.25) {
  const arrayBuffer = await audioFile.arrayBuffer()
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const decoded = await audioCtx.decodeAudioData(arrayBuffer)

  const newLength = Math.round(decoded.length / speedRatio)
  const offlineCtx = new OfflineAudioContext(
    decoded.numberOfChannels,
    newLength,
    decoded.sampleRate
  )

  const source = offlineCtx.createBufferSource()
  source.buffer = decoded
  source.playbackRate.value = speedRatio
  source.connect(offlineCtx.destination)
  source.start(0)

  const renderedBuffer = await offlineCtx.startRendering()
  const wavBlob = encodeWAV(renderedBuffer)
  return {
    blob: wavBlob,
    duration: renderedBuffer.duration
  }
}

/**
 * Screen & Mic Recorder using MediaRecorder API
 */
export class ScreenRecorder {
  constructor() {
    this.stream = null
    this.mediaRecorder = null
    this.recordedChunks = []
  }

  async start({ withMic = false, videoBitsPerSecond = 2500000 } = {}) {
    this.recordedChunks = []

    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always', frameRate: { ideal: 30 } },
      audio: true
    })

    if (withMic) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // Mix display audio + mic audio if available
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
        const destination = audioCtx.createMediaStreamDestination()

        if (displayStream.getAudioTracks().length > 0) {
          const displayAudioSource = audioCtx.createMediaStreamSource(displayStream)
          displayAudioSource.connect(destination)
        }

        const micAudioSource = audioCtx.createMediaStreamSource(micStream)
        micAudioSource.connect(destination)

        const mixedTracks = [
          ...displayStream.getVideoTracks(),
          ...destination.stream.getAudioTracks()
        ]
        this.stream = new MediaStream(mixedTracks)
      } catch {
        this.stream = displayStream
      }
    } else {
      this.stream = displayStream
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : 'video/mp4'

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType,
      videoBitsPerSecond
    })

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data)
      }
    }

    this.mediaRecorder.start(250) // collect chunks every 250ms
    return { mimeType }
  }

  stop() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) return reject(new Error('Recorder not started'))

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder.mimeType || 'video/webm'
        const blob = new Blob(this.recordedChunks, { type: mimeType })
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop())
        }
        resolve({ blob, mimeType })
      }

      this.mediaRecorder.stop()
    })
  }
}

/**
 * Microphone Voice Recorder
 */
export class VoiceRecorder {
  constructor() {
    this.stream = null
    this.mediaRecorder = null
    this.recordedChunks = []
  }

  async start() {
    this.recordedChunks = []
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType })

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.recordedChunks.push(e.data)
      }
    }

    this.mediaRecorder.start(250)
  }

  stop() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) return reject(new Error('Recorder not started'))

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder.mimeType || 'audio/webm'
        const blob = new Blob(this.recordedChunks, { type: mimeType })
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop())
        }
        resolve({ blob, mimeType })
      }

      this.mediaRecorder.stop()
    })
  }
}
