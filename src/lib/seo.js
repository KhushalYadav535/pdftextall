/**
 * Tiny SEO helper — no dependency.
 * Updates <title>, meta description, OG/Twitter tags and canonical link
 * so every tool page gets its own share card + Google snippet.
 */
const SITE = 'https://pdfzero-editor.vercel.app'

function upsertMeta(selector, create) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  return el
}

export function setPageSeo({ title, description, path = '/' }) {
  const url = SITE + path
  document.title = title

  upsertMeta('meta[name="description"]', () => {
    const m = document.createElement('meta')
    m.setAttribute('name', 'description')
    return m
  }).setAttribute('content', description)

  upsertMeta('meta[property="og:title"]', () => {
    const m = document.createElement('meta')
    m.setAttribute('property', 'og:title')
    return m
  }).setAttribute('content', title)

  upsertMeta('meta[property="og:description"]', () => {
    const m = document.createElement('meta')
    m.setAttribute('property', 'og:description')
    return m
  }).setAttribute('content', description)

  upsertMeta('meta[property="og:url"]', () => {
    const m = document.createElement('meta')
    m.setAttribute('property', 'og:url')
    return m
  }).setAttribute('content', url)

  upsertMeta('meta[name="twitter:title"]', () => {
    const m = document.createElement('meta')
    m.setAttribute('name', 'twitter:title')
    return m
  }).setAttribute('content', title)

  upsertMeta('meta[name="twitter:description"]', () => {
    const m = document.createElement('meta')
    m.setAttribute('name', 'twitter:description')
    return m
  }).setAttribute('content', description)

  upsertMeta('link[rel="canonical"]', () => {
    const l = document.createElement('link')
    l.setAttribute('rel', 'canonical')
    return l
  }).setAttribute('href', url)
}

export function toolSeo(label, desc, id) {
  return {
    title: `${label} — Free, No Signup | PDFZero`,
    description: `${desc} 100% free, unlimited use, files never leave your device. No signup, no paywall.`,
    path: `/tools/${id}`,
  }
}

export const HOME_SEO = {
  title: 'PDFZero — 105+ Free PDF, Image & Dev Tools, No Signup',
  description:
    'Merge, compress, OCR, e-sign, redact, convert PDF to Word/Excel and 100+ more tools. 100% free forever, unlimited use, files never leave your device.',
  path: '/',
}

export const EDITOR_SEO = {
  title: 'Free PDF Editor — Edit Text, Sign, Redact | PDFZero',
  description:
    'Edit any PDF in your browser: fix text in-place, sign, fill forms, redact, annotate. Free, private, no uploads.',
  path: '/editor',
}

export const TOOLS_SEO = {
  title: 'All 105+ Free Tools — PDF, Image, Audio, Dev | PDFZero',
  description:
    'Browse every free tool: PDF, image, audio, barcode, developer, text, security and productivity utilities. No limits, no login.',
  path: '/tools',
}
