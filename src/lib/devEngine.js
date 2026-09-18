/**
 * Client-Side Developer & Text Processing Engine
 * Zero server dependencies.
 */

/* ─── JSON UTILITIES ─── */

export function formatJson(jsonString, indent = 2) {
  try {
    const parsed = JSON.parse(jsonString)
    return {
      success: true,
      result: JSON.stringify(parsed, null, indent),
      stats: {
        keys: countKeys(parsed),
        type: Array.isArray(parsed) ? 'Array' : typeof parsed
      }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

export function minifyJson(jsonString) {
  try {
    const parsed = JSON.parse(jsonString)
    return { success: true, result: JSON.stringify(parsed) }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

function countKeys(obj) {
  if (typeof obj !== 'object' || obj === null) return 1
  return Object.keys(obj).reduce((acc, k) => acc + countKeys(obj[k]), Object.keys(obj).length)
}

/* ─── JSON <-> CSV CONVERTER ─── */

export function jsonToCsv(jsonInput) {
  try {
    let arr = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput
    if (!Array.isArray(arr)) {
      if (typeof arr === 'object' && arr !== null) {
        arr = [arr]
      } else {
        throw new Error('JSON must be an array of objects or an object')
      }
    }

    if (arr.length === 0) return { success: true, result: '' }

    const headers = Array.from(
      new Set(arr.flatMap(item => Object.keys(item || {})))
    )

    const csvRows = []
    csvRows.push(headers.map(h => escapeCsvCell(h)).join(','))

    for (const row of arr) {
      const values = headers.map(header => {
        const val = row[header]
        return escapeCsvCell(val === undefined || val === null ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val))
      })
      csvRows.push(values.join(','))
    }

    return { success: true, result: csvRows.join('\n'), count: arr.length }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

function escapeCsvCell(val) {
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function csvToJson(csvString) {
  try {
    const lines = csvString.trim().split(/\r?\n/)
    if (lines.length === 0 || !lines[0].trim()) return { success: true, result: '[]' }

    const headers = parseCsvLine(lines[0])
    const result = []

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue
      const values = parseCsvLine(lines[i])
      const row = {}
      headers.forEach((h, index) => {
        const rawVal = values[index] !== undefined ? values[index] : ''
        // Attempt number/boolean parse
        if (rawVal.toLowerCase() === 'true') row[h] = true
        else if (rawVal.toLowerCase() === 'false') row[h] = false
        else if (!isNaN(Number(rawVal)) && rawVal.trim() !== '') row[h] = Number(rawVal)
        else row[h] = rawVal
      })
      result.push(row)
    }

    return { success: true, result: JSON.stringify(result, null, 2), count: result.length }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

function parseCsvLine(line) {
  const values = []
  let insideQuote = false
  let currentVal = ''

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (insideQuote && line[i + 1] === '"') {
        currentVal += '"'
        i++
      } else {
        insideQuote = !insideQuote
      }
    } else if (char === ',' && !insideQuote) {
      values.push(currentVal)
      currentVal = ''
    } else {
      currentVal += char
    }
  }
  values.push(currentVal)
  return values
}

/* ─── BASE64 UTILITIES ─── */

export function encodeBase64Text(text) {
  try {
    const bytes = new TextEncoder().encode(text)
    const binString = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
    return { success: true, result: btoa(binString) }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

export function decodeBase64Text(base64) {
  try {
    const clean = base64.replace(/\s/g, '')
    const binString = atob(clean)
    const bytes = Uint8Array.from(binString, (m) => m.charCodeAt(0))
    return { success: true, result: new TextDecoder().decode(bytes) }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/* ─── JWT INSPECTOR ─── */

export function decodeJwt(token) {
  try {
    const parts = token.trim().split('.')
    if (parts.length !== 3) {
      return { success: false, error: 'Invalid JWT format: must contain header, payload, and signature separated by dots' }
    }

    const decodePart = (str) => {
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
      while (base64.length % 4) base64 += '='
      const json = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      return JSON.parse(json)
    }

    const header = decodePart(parts[0])
    const payload = decodePart(parts[1])

    let isExpired = false
    let expiresAt = null
    let issuedAt = null

    if (payload.exp) {
      expiresAt = new Date(payload.exp * 1000).toLocaleString()
      isExpired = Date.now() >= payload.exp * 1000
    }
    if (payload.iat) {
      issuedAt = new Date(payload.iat * 1000).toLocaleString()
    }

    return {
      success: true,
      header,
      payload,
      signature: parts[2],
      isExpired,
      expiresAt,
      issuedAt
    }
  } catch (err) {
    return { success: false, error: 'Failed to decode JWT: ' + err.message }
  }
}

/* ─── REGEX TESTER ─── */

export function testRegex(pattern, flags, text) {
  try {
    if (!pattern) return { success: true, matches: [], count: 0 }
    const regex = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g')
    const matches = []
    let match

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        match: match[0],
        index: match.index,
        endIndex: match.index + match[0].length,
        groups: match.slice(1),
        namedGroups: match.groups || {}
      })
      if (match[0].length === 0) {
        regex.lastIndex++
      }
    }

    return { success: true, matches, count: matches.length }
  } catch (err) {
    return { success: false, error: err.message, matches: [], count: 0 }
  }
}

/* ─── UUID & NANOID GENERATOR ─── */

export function generateUuids(count = 5, { uppercase = false, hyphens = true, type = 'uuid' } = {}) {
  const results = []
  for (let i = 0; i < count; i++) {
    if (type === 'nanoid') {
      results.push(generateNanoId(21))
    } else {
      let id = crypto.randomUUID ? crypto.randomUUID() : rfc4122v4()
      if (!hyphens) id = id.replace(/-/g, '')
      if (uppercase) id = id.toUpperCase()
      results.push(id)
    }
  }
  return results
}

function rfc4122v4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

function generateNanoId(size = 21) {
  const urlAlphabet = 'useandom-26T1983_40STNWZFGhjkpqrvzxyBCDEFGHJKLMOPQRSTUVXYZ_abcdefghijklmnopqrstuvwxyz'
  let id = ''
  const bytes = crypto.getRandomValues(new Uint8Array(size))
  for (let i = 0; i < size; i++) {
    id += urlAlphabet[bytes[i] & 63]
  }
  return id
}

/* ─── TEXT UTILITIES & CASE CONVERTER ─── */

export function convertCase(text, style) {
  if (!text) return ''

  // Split into words by spaces, underscores, hyphens, and camelCase
  const words = text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  switch (style) {
    case 'camelCase':
      return words
        .map((w, idx) => idx === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('')
    case 'PascalCase':
      return words
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('')
    case 'snake_case':
      return words.map(w => w.toLowerCase()).join('_')
    case 'kebab-case':
    case 'slug':
      return words.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean).join('-')
    case 'CONSTANT_CASE':
      return words.map(w => w.toUpperCase()).join('_')
    case 'Title Case':
      return words
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
    case 'lowercase':
      return text.toLowerCase()
    case 'UPPERCASE':
      return text.toUpperCase()
    case 'Sentence case':
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
    default:
      return text
  }
}

/* ─── TEXT ANALYZER ─── */

export function analyzeText(text) {
  if (!text) {
    return {
      words: 0,
      characters: 0,
      charactersNoSpaces: 0,
      lines: 0,
      paragraphs: 0,
      readingTimeMin: 0,
      speakingTimeMin: 0,
      topWords: []
    }
  }

  const characters = text.length
  const charactersNoSpaces = text.replace(/\s/g, '').length
  const lines = text.split(/\r\n|\r|\n/).length
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length

  const wordsArray = text
    .toLowerCase()
    .replace(/[^\w\s\d]/g, '')
    .split(/\s+/)
    .filter(Boolean)

  const words = wordsArray.length
  const readingTimeMin = Math.ceil(words / 200) // ~200 wpm
  const speakingTimeMin = Math.ceil(words / 130) // ~130 wpm

  // Word frequency
  const frequency = {}
  const stopWords = new Set(['the', 'and', 'a', 'to', 'of', 'in', 'i', 'is', 'that', 'it', 'on', 'you', 'this', 'for', 'with', 'was'])
  for (const w of wordsArray) {
    if (w.length > 2 && !stopWords.has(w)) {
      frequency[w] = (frequency[w] || 0) + 1
    }
  }

  const topWords = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({ word, count, percentage: Math.round((count / words) * 100) }))

  return {
    words,
    characters,
    charactersNoSpaces,
    lines,
    paragraphs: Math.max(1, paragraphs),
    readingTimeMin,
    speakingTimeMin,
    topWords
  }
}

/* ─── LOREM IPSUM GENERATOR ─── */

const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'curabitur', 'vel', 'hendrerit', 'libero', 'eleifend', 'blandit', 'nunc',
  'ornare', 'odio', 'ut', 'orci', 'gravida', 'imperdiet', 'nullam', 'purus',
  'lacinia', 'a', 'pretium', 'quis', 'congue', 'praesent', 'sagittis', 'laoreet',
  'auctor', 'mauris', 'non', 'velit', 'eros', 'dictum', 'proin', 'accumsan',
  'sapien', 'nec', 'massa', 'volutpat', 'venenatis', 'sed', 'eu', 'molestie',
  'lacus', 'quisque', 'porttitor', 'ligula', 'dapibus', 'facilisis', 'tempor',
  'phasellus', 'viverra', 'faucibus', 'pellentesque', 'vivamus', 'aliquam'
]

export function generateLorem(count = 3, type = 'paragraphs') {
  if (type === 'words') {
    const list = []
    for (let i = 0; i < count; i++) {
      list.push(LOREM_WORDS[i % LOREM_WORDS.length])
    }
    return list.join(' ')
  }

  if (type === 'sentences') {
    const sentences = []
    for (let i = 0; i < count; i++) {
      sentences.push(generateSentence())
    }
    return sentences.join(' ')
  }

  // Paragraphs
  const paragraphs = []
  for (let i = 0; i < count; i++) {
    const sentenceCount = 4 + (i % 3)
    const p = []
    for (let s = 0; s < sentenceCount; s++) {
      p.push(generateSentence())
    }
    paragraphs.push(p.join(' '))
  }
  return paragraphs.join('\n\n')
}

function generateSentence() {
  const len = 7 + Math.floor(Math.random() * 8)
  const words = []
  for (let i = 0; i < len; i++) {
    words.push(LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)])
  }
  const sentence = words.join(' ')
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.'
}

/* ─── TEXT DIFF UTILITY ─── */

export function computeTextDiff(text1, text2) {
  const lines1 = text1.split(/\r?\n/)
  const lines2 = text2.split(/\r?\n/)
  const maxLines = Math.max(lines1.length, lines2.length)
  const diff = []

  let i = 0, j = 0
  while (i < lines1.length || j < lines2.length) {
    if (i < lines1.length && j < lines2.length && lines1[i] === lines2[j]) {
      diff.push({ type: 'unchanged', text: lines1[i], line1: i + 1, line2: j + 1 })
      i++
      j++
    } else if (j < lines2.length && (!lines1.includes(lines2[j]) || lines1.indexOf(lines2[j]) < i)) {
      diff.push({ type: 'added', text: lines2[j], line1: null, line2: j + 1 })
      j++
    } else if (i < lines1.length) {
      diff.push({ type: 'removed', text: lines1[i], line1: i + 1, line2: null })
      i++
    } else {
      diff.push({ type: 'added', text: lines2[j], line1: null, line2: j + 1 })
      j++
    }
  }

  const additions = diff.filter(d => d.type === 'added').length
  const deletions = diff.filter(d => d.type === 'removed').length
  const unchanged = diff.filter(d => d.type === 'unchanged').length

  return { diff, stats: { additions, deletions, unchanged } }
}
