import QRCode from 'qrcode'

/**
 * Standard Code 128-B character patterns (11 bits per character)
 */
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
]

/**
 * Render 1D Code 128 barcode onto an HTML5 Canvas
 */
export function drawCode128Barcode(text, {
  barWidth = 2,
  barHeight = 70,
  showText = true,
  bgColor = '#ffffff',
  barColor = '#000000'
} = {}) {
  // Validate ASCII characters (32 to 126)
  const clean = text.replace(/[^\x20-\x7E]/g, '')
  if (!clean) throw new Error('Barcode text must contain printable ASCII characters')

  // Calculate Code 128B checksum
  const startCodeB = 104
  let checksum = startCodeB
  const codes = [startCodeB]

  for (let i = 0; i < clean.length; i++) {
    const val = clean.charCodeAt(i) - 32
    codes.push(val)
    checksum += val * (i + 1)
  }

  const checkDigit = checksum % 103
  codes.push(checkDigit)
  codes.push(106) // Stop code

  // Convert code indices to bar pattern widths
  let patternString = ''
  for (const c of codes) {
    patternString += CODE128_PATTERNS[c] || ''
  }

  // Calculate total module width
  let totalModules = 0
  for (let i = 0; i < patternString.length; i++) {
    totalModules += parseInt(patternString[i], 10)
  }

  const quietZone = 20
  const canvasWidth = totalModules * barWidth + quietZone * 2
  const textHeight = showText ? 24 : 0
  const canvasHeight = barHeight + textHeight + 20

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // Draw Bars
  ctx.fillStyle = barColor
  let curX = quietZone

  for (let i = 0; i < patternString.length; i++) {
    const width = parseInt(patternString[i], 10) * barWidth
    const isBar = i % 2 === 0
    if (isBar) {
      ctx.fillRect(curX, 10, width, barHeight)
    }
    curX += width
  }

  // Draw Text label
  if (showText) {
    ctx.fillStyle = barColor
    ctx.font = '14px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(clean, canvasWidth / 2, barHeight + 24)
  }

  return {
    canvas,
    dataUrl: canvas.toDataURL('image/png')
  }
}

/**
 * Generate WiFi QR payload string
 */
export function createWifiQrString({ ssid, password, encryption = 'WPA', hidden = false }) {
  const enc = encryption === 'none' ? 'nopass' : encryption
  return `WIFI:S:${escapeWifi(ssid)};T:${enc};P:${escapeWifi(password)};H:${hidden ? 'true' : 'false'};;`
}

function escapeWifi(str) {
  return (str || '').replace(/([\\;,:"])/g, '\\$1')
}

/**
 * Generate vCard 3.0 payload string
 */
export function createVCardString({
  firstName = '',
  lastName = '',
  org = '',
  title = '',
  phone = '',
  email = '',
  url = '',
  address = ''
}) {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${lastName};${firstName};;;`,
    `FN:${firstName} ${lastName}`.trim(),
    org ? `ORG:${org}` : '',
    title ? `TITLE:${title}` : '',
    phone ? `TEL;TYPE=CELL:${phone}` : '',
    email ? `EMAIL;TYPE=INTERNET:${email}` : '',
    url ? `URL:${url}` : '',
    address ? `ADR;TYPE=WORK:;;${address};;;;` : '',
    'END:VCARD'
  ].filter(Boolean).join('\n')
}

/**
 * Generate QR code Data URL
 */
export async function generateQrCode(text, { width = 280, darkColor = '#000000', lightColor = '#ffffff' } = {}) {
  return await QRCode.toDataURL(text, {
    width,
    margin: 2,
    color: {
      dark: darkColor,
      light: lightColor
    }
  })
}
