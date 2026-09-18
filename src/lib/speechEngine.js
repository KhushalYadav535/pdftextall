/**
 * Web Speech API Engine (SpeechSynthesis + SpeechRecognition)
 * 100% native in-browser. Zero servers.
 */

export function getAvailableVoices() {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      return resolve([])
    }
    let voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      return resolve(voices)
    }
    window.speechSynthesis.onvoiceschanged = () => {
      voices = window.speechSynthesis.getVoices()
      resolve(voices)
    }
  })
}

export class TextToSpeechPlayer {
  constructor() {
    this.utterance = null
    this.isPlaying = false
    this.isPaused = false
  }

  speak({
    text,
    voice = null,
    rate = 1,
    pitch = 1,
    volume = 1,
    onBoundary = () => {},
    onEnd = () => {},
    onError = () => {}
  }) {
    if (!('speechSynthesis' in window)) {
      throw new Error('Text-to-Speech is not supported in this browser.')
    }

    this.stop()

    this.utterance = new SpeechSynthesisUtterance(text)
    if (voice) this.utterance.voice = voice
    this.utterance.rate = rate
    this.utterance.pitch = pitch
    this.utterance.volume = volume

    this.utterance.onboundary = (e) => onBoundary(e)
    this.utterance.onend = () => {
      this.isPlaying = false
      this.isPaused = false
      onEnd()
    }
    this.utterance.onerror = (err) => {
      this.isPlaying = false
      this.isPaused = false
      onError(err)
    }

    window.speechSynthesis.speak(this.utterance)
    this.isPlaying = true
    this.isPaused = false
  }

  pause() {
    if (this.isPlaying && !this.isPaused) {
      window.speechSynthesis.pause()
      this.isPaused = true
    }
  }

  resume() {
    if (this.isPaused) {
      window.speechSynthesis.resume()
      this.isPaused = false
    }
  }

  stop() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    this.isPlaying = false
    this.isPaused = false
  }
}

export class SpeechToTextTranscriber {
  constructor(onResult = () => {}, onError = () => {}) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    this.isSupported = !!SpeechRecognition
    this.recognition = SpeechRecognition ? new SpeechRecognition() : null
    this.isListening = false
    this.onResult = onResult
    this.onError = onError

    if (this.recognition) {
      this.recognition.continuous = true
      this.recognition.interimResults = true

      this.recognition.onresult = (event) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript
          } else {
            interimTranscript += event.results[i][0].transcript
          }
        }
        this.onResult({ final: finalTranscript, interim: interimTranscript })
      }

      this.recognition.onerror = (err) => {
        this.onError(err)
      }

      this.recognition.onend = () => {
        this.isListening = false
      }
    }
  }

  start(lang = 'en-US') {
    if (!this.isSupported) {
      throw new Error('Speech-to-Text is not supported in this browser. Please use Chrome or Edge.')
    }
    if (this.isListening) return
    this.recognition.lang = lang
    this.recognition.start()
    this.isListening = true
  }

  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
      this.isListening = false
    }
  }
}
