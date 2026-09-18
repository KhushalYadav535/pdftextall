import { encodeWAV } from './mediaEngine.js'

/**
 * Tone and Frequency Sound Generator using Web Audio API
 */
export class ToneGenerator {
  constructor() {
    this.ctx = null
    this.osc = null
    this.gain = null
    this.isPlaying = false
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    }
  }

  start({ frequency = 440, type = 'sine', volume = 0.2 } = {}) {
    this.init()
    if (this.isPlaying) this.stop()

    this.osc = this.ctx.createOscillator()
    this.gain = this.ctx.createGain()

    this.osc.type = type
    this.osc.frequency.setValueAtTime(frequency, this.ctx.currentTime)

    this.gain.gain.setValueAtTime(volume, this.ctx.currentTime)

    this.osc.connect(this.gain)
    this.gain.connect(this.ctx.destination)

    this.osc.start()
    this.isPlaying = true
  }

  setFrequency(freq) {
    if (this.osc && this.isPlaying) {
      this.osc.frequency.setValueAtTime(freq, this.ctx.currentTime)
    }
  }

  setVolume(vol) {
    if (this.gain && this.isPlaying) {
      this.gain.gain.setValueAtTime(vol, this.ctx.currentTime)
    }
  }

  setType(type) {
    if (this.osc && this.isPlaying) {
      this.osc.type = type
    }
  }

  stop() {
    if (this.osc && this.isPlaying) {
      try {
        this.osc.stop()
        this.osc.disconnect()
      } catch {}
      this.isPlaying = false
    }
  }
}

/**
 * High-Precision Metronome using Web Audio Scheduler
 */
export class Metronome {
  constructor(onTick = () => {}) {
    this.ctx = null
    this.bpm = 120
    this.beatsPerBar = 4
    this.currentBeat = 0
    this.isPlaying = false
    this.timerId = null
    this.nextNoteTime = 0
    this.onTick = onTick
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    }
  }

  start(bpm = 120, beatsPerBar = 4) {
    this.init()
    this.bpm = bpm
    this.beatsPerBar = beatsPerBar
    this.currentBeat = 0
    this.isPlaying = true
    this.nextNoteTime = this.ctx.currentTime + 0.05
    this.scheduler()
  }

  scheduler() {
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.scheduleNote(this.currentBeat, this.nextNoteTime)
      this.nextNote()
    }
    if (this.isPlaying) {
      this.timerId = setTimeout(() => this.scheduler(), 25)
    }
  }

  scheduleNote(beatNumber, time) {
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    // Accented high pitch on first beat of bar
    const isAccented = beatNumber === 0
    osc.frequency.value = isAccented ? 1000 : 750

    gain.gain.setValueAtTime(0.6, time)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05)

    osc.connect(gain)
    gain.connect(this.ctx.destination)

    osc.start(time)
    osc.stop(time + 0.06)

    // Notify visual tick
    setTimeout(() => {
      if (this.isPlaying) this.onTick(beatNumber, isAccented)
    }, Math.max(0, (time - this.ctx.currentTime) * 1000))
  }

  nextNote() {
    const secondsPerBeat = 60.0 / this.bpm
    this.nextNoteTime += secondsPerBeat
    this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar
  }

  setBpm(bpm) {
    this.bpm = bpm
  }

  stop() {
    this.isPlaying = false
    if (this.timerId) clearTimeout(this.timerId)
  }
}

/**
 * Reverse Audio Track
 */
export async function reverseAudio(file) {
  const arrayBuffer = await file.arrayBuffer()
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const decoded = await audioCtx.decodeAudioData(arrayBuffer)

  const reversed = audioCtx.createBuffer(
    decoded.numberOfChannels,
    decoded.length,
    decoded.sampleRate
  )

  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const src = decoded.getChannelData(c)
    const dest = reversed.getChannelData(c)
    for (let i = 0, j = decoded.length - 1; i < decoded.length; i++, j--) {
      dest[i] = src[j]
    }
  }

  const wavBlob = encodeWAV(reversed)
  return {
    blob: wavBlob,
    duration: reversed.duration
  }
}

/**
 * Ambient Noise Generator (White, Pink, Brown noise)
 */
export class NoiseGenerator {
  constructor() {
    this.ctx = null
    this.source = null
    this.gain = null
    this.isPlaying = false
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    }
  }

  start(type = 'pink', volume = 0.2) {
    this.init()
    if (this.isPlaying) this.stop()

    const bufferSize = this.ctx.sampleRate * 2
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    let lastOut = 0.0

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1

      if (type === 'white') {
        data[i] = white * 0.5
      } else if (type === 'pink') {
        // Paul Kellet's filtered pink noise algorithm
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        b3 = 0.86650 * b3 + white * 0.3104856
        b4 = 0.55000 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.0168980
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
        b6 = white * 0.115926
      } else if (type === 'brown') {
        // Brown / Brownian noise integration
        lastOut = (lastOut + (0.02 * white)) / 1.02
        data[i] = lastOut * 3.5
      }
    }

    this.source = this.ctx.createBufferSource()
    this.source.buffer = buffer
    this.source.loop = true

    this.gain = this.ctx.createGain()
    this.gain.gain.setValueAtTime(volume, this.ctx.currentTime)

    this.source.connect(this.gain)
    this.gain.connect(this.ctx.destination)

    this.source.start()
    this.isPlaying = true
  }

  setVolume(vol) {
    if (this.gain && this.isPlaying) {
      this.gain.gain.setValueAtTime(vol, this.ctx.currentTime)
    }
  }

  stop() {
    if (this.source && this.isPlaying) {
      try {
        this.source.stop()
        this.source.disconnect()
      } catch {}
      this.isPlaying = false
    }
  }
}
