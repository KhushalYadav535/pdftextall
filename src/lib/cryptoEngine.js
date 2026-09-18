/**
 * Client-Side Cryptography, Privacy & Security Engine
 * Powered by Web Crypto API (SubtleCrypto) + LSB Canvas Steganography.
 * 100% offline, zero server communication.
 */

const MAGIC_HEADER = new Uint8Array([0x50, 0x5A, 0x45, 0x4E, 0x43, 0x01]) // 'PZENC' v1

/**
 * Encrypt any file or blob using AES-256-GCM + PBKDF2
 */
export async function encryptFile(fileOrBlob, password) {
  if (!password) throw new Error('Encryption password is required')

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Derive AES-GCM key using PBKDF2
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )

  const plaintextBuffer = await fileOrBlob.arrayBuffer()
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintextBuffer
  )

  // Package format: MAGIC (6 bytes) + salt (16 bytes) + iv (12 bytes) + ciphertext
  const totalLength = MAGIC_HEADER.length + salt.length + iv.length + ciphertextBuffer.byteLength
  const output = new Uint8Array(totalLength)

  output.set(MAGIC_HEADER, 0)
  output.set(salt, MAGIC_HEADER.length)
  output.set(iv, MAGIC_HEADER.length + salt.length)
  output.set(new Uint8Array(ciphertextBuffer), MAGIC_HEADER.length + salt.length + iv.length)

  return new Blob([output], { type: 'application/octet-stream' })
}

/**
 * Decrypt a .locked file using AES-256-GCM + PBKDF2
 */
export async function decryptFile(lockedBlob, password) {
  if (!password) throw new Error('Password is required for decryption')

  const arrayBuffer = await lockedBlob.arrayBuffer()
  const data = new Uint8Array(arrayBuffer)

  // Verify magic header
  for (let i = 0; i < MAGIC_HEADER.length; i++) {
    if (data[i] !== MAGIC_HEADER[i]) {
      throw new Error('Invalid file format. This is not a valid PDFZero encrypted file.')
    }
  }

  const saltOffset = MAGIC_HEADER.length
  const ivOffset = saltOffset + 16
  const cipherOffset = ivOffset + 12

  if (data.length < cipherOffset) {
    throw new Error('Corrupted encrypted file.')
  }

  const salt = data.subarray(saltOffset, ivOffset)
  const iv = data.subarray(ivOffset, cipherOffset)
  const ciphertext = data.subarray(cipherOffset)

  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      ciphertext
    )
    return new Blob([decryptedBuffer])
  } catch {
    throw new Error('Decryption failed. Incorrect password or modified ciphertext.')
  }
}

/**
 * LSB Steganography: Embed secret text inside an image's pixel RGBA channels
 */
export async function hideTextInImage(imageFile, secretText) {
  const img = await loadImage(imageFile)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imgData.data

  const textBytes = new TextEncoder().encode(secretText)
  const length = textBytes.length

  // Check capacity: each byte requires 8 bits (8 color channels). Max capacity: (pixels * 3) / 8
  const maxBytes = Math.floor((data.length * 3 / 4) / 8) - 4
  if (length > maxBytes) {
    throw new Error(`Text too long for this image. Maximum capacity: ${maxBytes} bytes (~${Math.floor(maxBytes/1024)} KB)`)
  }

  // Prepend 32-bit (4 bytes) length header
  const payload = new Uint8Array(4 + length)
  new DataView(payload.buffer).setUint32(0, length, false)
  payload.set(textBytes, 4)

  // Embed bits into LSB of R, G, B channels (skipping Alpha to prevent visible distortion)
  let payloadBitIndex = 0
  const totalBits = payload.length * 8

  for (let i = 0; i < data.length && payloadBitIndex < totalBits; i++) {
    if ((i + 1) % 4 === 0) continue // skip Alpha

    const byteIdx = Math.floor(payloadBitIndex / 8)
    const bitOffset = 7 - (payloadBitIndex % 8)
    const bit = (payload[byteIdx] >> bitOffset) & 1

    data[i] = (data[i] & ~1) | bit
    payloadBitIndex++
  }

  ctx.putImageData(imgData, 0, 0)
  return new Promise((resolve) => {
    canvas.toBlob(blob => resolve(blob), 'image/png')
  })
}

/**
 * LSB Steganography: Extract secret text from an image
 */
export async function revealTextFromImage(imageFile) {
  const img = await loadImage(imageFile)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data

  // Extract length (first 32 bits = 4 bytes)
  let bitCount = 0
  let lengthBytes = new Uint8Array(4)

  for (let i = 0; i < data.length && bitCount < 32; i++) {
    if ((i + 1) % 4 === 0) continue
    const bit = data[i] & 1
    const byteIdx = Math.floor(bitCount / 8)
    const bitOffset = 7 - (bitCount % 8)
    lengthBytes[byteIdx] |= (bit << bitOffset)
    bitCount++
  }

  const length = new DataView(lengthBytes.buffer).getUint32(0, false)
  if (length <= 0 || length > 1000000) {
    throw new Error('No hidden message found in this image.')
  }

  const payload = new Uint8Array(length)
  let textBitCount = 0
  const totalTextBits = length * 8

  let dataIndex = 0
  let channelCount = 0
  // Skip first 32 non-alpha channels
  while (channelCount < 32 && dataIndex < data.length) {
    if ((dataIndex + 1) % 4 !== 0) {
      channelCount++
    }
    dataIndex++
  }

  for (; dataIndex < data.length && textBitCount < totalTextBits; dataIndex++) {
    if ((dataIndex + 1) % 4 === 0) continue
    const bit = data[dataIndex] & 1
    const byteIdx = Math.floor(textBitCount / 8)
    const bitOffset = 7 - (textBitCount % 8)
    payload[byteIdx] |= (bit << bitOffset)
    textBitCount++
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(payload)
    return text
  } catch {
    throw new Error('Unable to decode secret text. The image may have been re-compressed or corrupted.')
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = reject
    img.src = url
  })
}

/**
 * Calculate Hashes: SHA-1, SHA-256, SHA-512, MD5
 */
export async function calculateHashes(input) {
  let buffer
  if (typeof input === 'string') {
    buffer = new TextEncoder().encode(input).buffer
  } else if (input instanceof Blob || input instanceof File) {
    buffer = await input.arrayBuffer()
  } else {
    buffer = input
  }

  const hexString = (arrBuffer) => {
    return Array.from(new Uint8Array(arrBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  const [sha1Buf, sha256Buf, sha512Buf] = await Promise.all([
    crypto.subtle.digest('SHA-1', buffer),
    crypto.subtle.digest('SHA-256', buffer),
    crypto.subtle.digest('SHA-512', buffer),
  ])

  const md5Hex = md5(new Uint8Array(buffer))

  return {
    md5: md5Hex,
    sha1: hexString(sha1Buf),
    sha256: hexString(sha256Buf),
    sha512: hexString(sha512Buf),
  }
}

/**
 * Pure JS MD5 implementation for client-side hashing
 */
function md5(bytes) {
  function md5cycle(x, k) {
    let a = x[0], b = x[1], c = x[2], d = x[3]
    a = ff(a, b, c, d, k[0], 7, -680876936)
    d = ff(d, a, b, c, k[1], 12, -389564586)
    c = ff(c, d, a, b, k[2], 17, 606105819)
    b = ff(b, c, d, a, k[3], 22, -1044525330)
    a = ff(a, b, c, d, k[4], 7, -176418897)
    d = ff(d, a, b, c, k[5], 12, 1200080426)
    c = ff(c, d, a, b, k[6], 17, -1473231341)
    b = ff(b, c, d, a, k[7], 22, -45705983)
    a = ff(a, b, c, d, k[8], 7, 1770035416)
    d = ff(d, a, b, c, k[9], 12, -1958414417)
    c = ff(c, d, a, b, k[10], 17, -42063)
    b = ff(b, c, d, a, k[11], 22, -1990404162)
    a = ff(a, b, c, d, k[12], 7, 1804603682)
    d = ff(d, a, b, c, k[13], 12, -40341101)
    c = ff(c, d, a, b, k[14], 17, -1502002290)
    b = ff(b, c, d, a, k[15], 22, 1236535329)
    a = gg(a, b, c, d, k[1], 5, -165796510)
    d = gg(d, a, b, c, k[6], 9, -1069501632)
    c = gg(c, d, a, b, k[11], 14, 643717713)
    b = gg(b, c, d, a, k[0], 20, -373897302)
    a = gg(a, b, c, d, k[5], 5, -701558691)
    d = gg(d, a, b, c, k[10], 9, 38016083)
    c = gg(c, d, a, b, k[15], 14, -660478335)
    b = gg(b, c, d, a, k[4], 20, -405537848)
    a = gg(a, b, c, d, k[9], 5, 568446438)
    d = gg(d, a, b, c, k[14], 9, -1019803690)
    c = gg(c, d, a, b, k[3], 14, -187363961)
    b = gg(b, c, d, a, k[8], 20, 1163531501)
    a = gg(a, b, c, d, k[13], 5, -1444681467)
    d = gg(d, a, b, c, k[2], 9, -51403784)
    c = gg(c, d, a, b, k[7], 14, 1735328473)
    b = gg(b, c, d, a, k[12], 20, -1926607734)
    a = hh(a, b, c, d, k[5], 4, -378558)
    d = hh(d, a, b, c, k[8], 11, -2022574463)
    c = hh(c, d, a, b, k[11], 16, 1839030562)
    b = hh(b, c, d, a, k[14], 23, -35309556)
    a = hh(a, b, c, d, k[1], 4, -1530992060)
    d = hh(d, a, b, c, k[4], 11, 1272893353)
    c = hh(c, d, a, b, k[7], 16, -155497632)
    b = hh(b, c, d, a, k[10], 23, -1094730640)
    a = hh(a, b, c, d, k[13], 4, 681279174)
    d = hh(d, a, b, c, k[0], 11, -358537222)
    c = hh(c, d, a, b, k[3], 16, -722521979)
    b = hh(b, c, d, a, k[6], 23, 76029189)
    a = hh(a, b, c, d, k[9], 4, -640364487)
    d = hh(d, a, b, c, k[12], 11, -421815835)
    c = hh(c, d, a, b, k[15], 16, 530742520)
    b = hh(b, c, d, a, k[2], 23, -995338651)
    a = ii(a, b, c, d, k[0], 6, -198630844)
    d = ii(d, a, b, c, k[7], 10, 1126891415)
    c = ii(c, d, a, b, k[14], 15, -1416354905)
    b = ii(b, c, d, a, k[5], 21, -57434055)
    a = ii(a, b, c, d, k[12], 6, 1700485571)
    d = ii(d, a, b, c, k[3], 10, -1894986606)
    c = ii(c, d, a, b, k[10], 15, -1051523)
    b = ii(b, c, d, a, k[1], 21, -2054922799)
    a = ii(a, b, c, d, k[8], 6, 1873313359)
    d = ii(d, a, b, c, k[15], 10, -30611744)
    c = ii(c, d, a, b, k[6], 15, -1560198380)
    b = ii(b, c, d, a, k[13], 21, 1309151649)
    a = ii(a, b, c, d, k[4], 6, -145523070)
    d = ii(d, a, b, c, k[11], 10, -1120210379)
    c = ii(c, d, a, b, k[2], 15, 718787259)
    b = ii(b, c, d, a, k[9], 21, -343485551)
    x[0] = add32(a, x[0])
    x[1] = add32(b, x[1])
    x[2] = add32(c, x[2])
    x[3] = add32(d, x[3])
  }

  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t))
    return add32((a << s) | (a >>> (32 - s)), b)
  }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t) }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t) }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t) }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t) }
  function add32(a, b) { return (a + b) & 0xFFFFFFFF }

  // Padding
  const n = bytes.length
  const state = [1732584193, -271733879, -1732584194, 271733878]
  let i
  for (i = 64; i <= bytes.length; i += 64) {
    md5cycle(state, md5blk(bytes.subarray(i - 64, i)))
  }
  const tail = bytes.subarray(i - 64)
  const pad = new Uint8Array(64)
  pad.set(tail)
  pad[tail.length] = 0x80
  if (tail.length > 55) {
    md5cycle(state, md5blk(pad))
    pad.fill(0)
  }
  // append length in bits
  const bits = n * 8
  const view = new DataView(pad.buffer)
  view.setUint32(56, bits, true)
  md5cycle(state, md5blk(pad))

  return state.map(val => {
    const hex = (val >>> 0).toString(16).padStart(8, '0')
    return hex.match(/../g).reverse().join('')
  }).join('')
}

function md5blk(bytes) {
  const blk = new Uint32Array(16)
  for (let i = 0; i < 16; i++) {
    blk[i] = bytes[i * 4] | (bytes[i * 4 + 1] << 8) | (bytes[i * 4 + 2] << 16) | (bytes[i * 4 + 3] << 24)
  }
  return blk
}

/**
 * Generate Secure Password with Entropy calculation
 */
export function generatePassword({
  length = 16,
  uppercase = true,
  lowercase = true,
  numbers = true,
  symbols = true,
  avoidAmbiguous = false
} = {}) {
  let chars = ''
  if (uppercase) chars += avoidAmbiguous ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (lowercase) chars += avoidAmbiguous ? 'abcdefghijkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz'
  if (numbers) chars += avoidAmbiguous ? '23456789' : '0123456789'
  if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?'

  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz'

  const randomValues = crypto.getRandomValues(new Uint32Array(length))
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars[randomValues[i] % chars.length]
  }

  // Calculate entropy: length * log2(poolSize)
  const poolSize = chars.length
  const entropy = Math.round(length * Math.log2(poolSize))
  let strength = 'Weak'
  let color = '#ef4444'

  if (entropy >= 80) {
    strength = 'Very Strong / Uncrackable'
    color = '#10b981'
  } else if (entropy >= 60) {
    strength = 'Strong'
    color = '#3b82f6'
  } else if (entropy >= 40) {
    strength = 'Moderate'
    color = '#f59e0b'
  }

  return { password, entropy, strength, color }
}

/**
 * Clean EXIF and Metadata from Photo
 */
export async function stripExifFromImage(imageFile) {
  const img = await loadImage(imageFile)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  const cleanBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95))
  return {
    blob: cleanBlob,
    originalSize: imageFile.size,
    cleanSize: cleanBlob.size,
    savings: Math.max(0, imageFile.size - cleanBlob.size)
  }
}
