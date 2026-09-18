import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, Edit3, Scissors, Merge, ScanLine, Zap,
  Lock, Globe, ChevronRight, Check, X, Shield,
  Image, PenTool, RotateCcw, FileDown, Layers,
  Eye, Droplets, Trash2, Hash, Moon, CheckSquare, FileCode,
  GitCompare, Crop, FolderArchive, LayoutGrid, BookOpen, Maximize2, ShieldAlert, QrCode,
  Video, Mic, Music, Code, FileJson, Table, Binary, KeyRound, Cpu, FileDiff, Type, AlignLeft,
  ShieldCheck, Key, Sparkles, Palette, RefreshCw, Stamp, Grid,
  Sliders, Volume2, Wind, Barcode, Camera, Wifi, Contact, Pipette, Laptop,
  Timer, Clock, Scale, Monitor, Dices, Activity, EyeOff
} from 'lucide-react'
import Navbar from '../components/layout/Navbar.jsx'
import styles from './Landing.module.css'

const STUDIOS = [
  { id: 'all', label: 'All 95+ Tools' },
  { id: 'pdf', label: 'PDF Studio (36)' },
  { id: 'image', label: 'Image Studio (15)' },
  { id: 'media', label: 'Media & Sound (7)' },
  { id: 'voice', label: 'Voice & Speech (3)' },
  { id: 'barcode', label: 'Barcodes & QR (4)' },
  { id: 'design', label: 'Design & Graphics (5)' },
  { id: 'dev', label: 'Developer & Web (11)' },
  { id: 'text', label: 'Text & Docs (5)' },
  { id: 'security', label: 'Security & Privacy (4)' },
  { id: 'productivity', label: 'Productivity & Calc (5)' },
]

const ALL_STUDIO_FEATURES = [
  // PDF
  { studio: 'pdf', icon: Edit3, label: 'Edit Existing Text', desc: 'Click any text on the PDF to edit directly in-place with auto-matching fonts and sizes.', tag: 'Sejda-Class', path: '/editor' },
  { studio: 'pdf', icon: GitCompare, label: 'Compare PDFs', desc: 'Inspect differences between two document versions with heatmap diff and side-by-side views.', tag: 'Acrobat Pro', path: '/tools/compare' },
  { studio: 'pdf', icon: ScanLine, label: 'OCR Scanned PDFs', desc: 'Convert scanned images and non-selectable documents into editable text with in-browser AI.', tag: 'AI-Powered', path: '/tools/ocr' },
  { studio: 'pdf', icon: PenTool, label: 'Fill & e-Sign', desc: 'Draw your signature, type with elegant cursive fonts, or upload signature image.', tag: 'Popular', path: '/tools/sign' },
  { studio: 'pdf', icon: ShieldAlert, label: 'Blackout Redactor', desc: 'Bake opaque blackout boxes over sensitive account numbers, passwords, and private data.', tag: 'Permanent', path: '/tools/pdf-redact-pro' },
  { studio: 'pdf', icon: Scissors, label: 'Blank Page Auto-Cleaner', desc: 'Scan scanned PDFs to detect and auto-delete completely empty scanner pages.', tag: 'Auto-Clean', path: '/tools/pdf-clean-blank' },
  { studio: 'pdf', icon: Layers, label: 'Visual Page Arranger', desc: 'Interactive drag-and-drop thumbnail grid to reorder, rotate, or delete pages visually.', tag: 'Must Have', path: '/tools/pdf-organize' },
  { studio: 'pdf', icon: Hash, label: 'Bates Stamping & Headers', desc: 'Stamp legal Bates numbering, confidential headers, dates, and dynamic page counts.', tag: 'Legal Grade', path: '/tools/pdf-bates' },
  { studio: 'pdf', icon: FileText, label: 'Ink Saver B&W Dither', desc: 'Convert heavy colored PDFs into high-contrast monochrome pages to save 80% printer toner.', tag: 'Toner Saver', path: '/tools/pdf-ink-saver' },
  { studio: 'pdf', icon: CheckSquare, label: 'Interactive Form Builder', desc: 'Add fillable text fields, checkboxes, and AcroForm inputs onto any PDF page.', tag: 'New', path: '/tools/pdf-form-builder' },
  { studio: 'pdf', icon: FileDown, label: 'Multi-Image to PDF Pro', desc: 'Batch convert 50+ photos with standard A4/Letter sizing, orientation, and margin presets.', path: '/tools/images-to-pdf-pro' },
  { studio: 'pdf', icon: Crop, label: 'Crop PDF', desc: 'Trim empty margins, headers, or footers losslessly without any pixel degradation.', path: '/tools/crop' },
  { studio: 'pdf', icon: Merge, label: 'Merge PDFs', desc: 'Combine multiple PDF files into one clean document with instant visual reordering.', path: '/tools/merge' },
  { studio: 'pdf', icon: Scissors, label: 'Split PDF', desc: 'Split documents by custom page ranges or separate every N pages into distinct files.', path: '/tools/split' },
  { studio: 'pdf', icon: LayoutGrid, label: 'N-Up Handouts (2/4 in 1)', desc: 'Combine 2 or 4 slides onto a single sheet to save 50% to 75% on printing paper and toner.', path: '/tools/n-up' },
  { studio: 'pdf', icon: BookOpen, label: 'Booklet Creator', desc: 'Automatic saddle-stitch booklet imposition layout for double-sided folding printouts.', path: '/tools/booklet' },
  { studio: 'pdf', icon: FolderArchive, label: 'Extract Images', desc: 'Pull all embedded photos and bitmap graphics from any PDF into a single ZIP archive.', path: '/tools/extract-images' },
  { studio: 'pdf', icon: Maximize2, label: 'Resize Dimensions', desc: 'Standardize any document to A4, US Letter, Legal, or A3 dimensions with auto-centering.', path: '/tools/resize' },
  { studio: 'pdf', icon: ShieldAlert, label: 'Metadata & Sanitize', desc: 'Inspect and edit document properties, or 1-click wipe all hidden author and tracking info.', path: '/tools/metadata' },
  { studio: 'pdf', icon: QrCode, label: 'Stamp QR Code', desc: 'Generate and embed dynamic verification QR codes or payment links directly onto pages.', path: '/tools/qr-code' },
  { studio: 'pdf', icon: Image, label: 'PDF to JPG / PNG', desc: 'Extract all pages as high-resolution images or ZIP package in seconds.', path: '/tools/pdf-to-images' },
  { studio: 'pdf', icon: FileDown, label: 'Images to PDF', desc: 'Combine JPG, PNG, and WebP photos into a clean, uniform A4 or custom PDF.', path: '/tools/images-to-pdf' },
  { studio: 'pdf', icon: FileDown, label: 'Smart Compression', desc: 'Compress PDF size down by up to 80% while preserving crisp typography and visuals.', path: '/tools/compress' },
  { studio: 'pdf', icon: Lock, label: 'Protect & Unlock', desc: 'Secure your files with AES-256 password encryption or remove copy restrictions.', path: '/tools/protect' },

  // Image Studio
  { studio: 'image', icon: Scissors, label: 'Magic Background Eraser', desc: 'Click any background color to instantly erase it to transparent PNG with chroma keying.', tag: 'Remove.bg Alternative', path: '/tools/remove-bg' },
  { studio: 'image', icon: Stamp, label: 'Passport Photo Sheet Maker', desc: 'Crop 2x2" and 35x45mm photos and generate 4x6 / A4 printable multi-photo sheets with cut marks.', tag: 'High Demand', path: '/tools/passport-photo' },
  { studio: 'image', icon: ShieldAlert, label: 'Privacy Face Blur & Censor', desc: 'Draw censor boxes over faces, license plates, Aadhaar, or credit cards to pixelate/blur.', tag: 'Privacy', path: '/tools/image-blur' },
  { studio: 'image', icon: Stamp, label: 'Photo Watermark Pro', desc: 'Apply repeating tile pattern or single stamp text/logo watermark to protect copyright.', path: '/tools/image-watermark' },
  { studio: 'image', icon: Grid, label: 'Instagram Grid Splitter', desc: 'Slice any image into 3x1, 3x2, or 3x3 square tiles and download as a ZIP file.', tag: 'Social Media', path: '/tools/grid-splitter' },
  { studio: 'image', icon: Maximize2, label: 'Exact Dimension & DPI Resizer', desc: 'Resize by px, mm, cm, or inches with 72, 150, or 300 print DPI for official forms.', path: '/tools/exact-resizer' },
  { studio: 'image', icon: Sparkles, label: 'ASCII Art Generator', desc: 'Transform any photo into retro text ASCII characters with 1-click clipboard copy.', path: '/tools/ascii-art' },
  { studio: 'image', icon: Image, label: 'Vintage Polaroid Maker', desc: 'Wrap photos in classic Polaroid white borders with handwritten captions and soft shadows.', path: '/tools/polaroid-maker' },
  { studio: 'image', icon: Sliders, label: 'Compress Image', desc: 'Compress JPEG, PNG, and WebP with real-time quality slider and size savings.', tag: 'TinyPNG Alternative', path: '/tools/compress-image' },
  { studio: 'image', icon: RefreshCw, label: 'Convert Image Format', desc: 'Convert effortlessly between WebP, PNG, and JPEG formats in your browser.', path: '/tools/convert-image' },
  { studio: 'image', icon: FolderArchive, label: 'Favicon & App Icon Pack', desc: 'Generate complete 16px to 512px icon suites with manifest and HTML code in a ZIP.', tag: 'Developer Favorite', path: '/tools/favicon-generator' },
  { studio: 'image', icon: Sparkles, label: 'Photo Filters & FX', desc: 'Tune brightness, contrast, saturation, blur, sepia, invert, and hue rotation.', path: '/tools/photo-filters' },
  { studio: 'image', icon: Image, label: 'Meme Generator', desc: 'Create viral memes with custom classic Impact captions and instant download.', path: '/tools/meme-generator' },
  { studio: 'image', icon: Palette, label: 'Color Palette Extractor', desc: 'Extract dominant color palettes and 1-click copy hex codes from any photo.', path: '/tools/palette-extractor' },
  { studio: 'image', icon: Layers, label: 'SVG to High-Res PNG', desc: 'Rasterize vector SVG files to ultra-crisp 2x, 4K, or 8K PNG images.', path: '/tools/svg-to-png' },

  // Media & Sound
  { studio: 'media', icon: Video, label: 'Screen & Audio Recorder', desc: 'Record browser tabs, windows, or full display with internal audio & mic. No software.', tag: 'Loom Alternative', path: '/tools/screen-recorder' },
  { studio: 'media', icon: Music, label: 'Video to Audio Extractor', desc: 'Extract uncompressed master WAV audio directly from MP4, WebM, and MOV videos.', path: '/tools/video-to-audio' },
  { studio: 'media', icon: Scissors, label: 'Audio Trimmer & Cutter', desc: 'Trim and slice audio recordings precisely with waveform timeline preview.', path: '/tools/audio-trimmer' },
  { studio: 'media', icon: Mic, label: 'Voice Recorder & Speed', desc: 'Record high-clarity voice notes with 0.5x to 2x speed adjustment controls.', path: '/tools/voice-recorder' },
  { studio: 'media', icon: Activity, label: 'Tone & Frequency Generator', desc: 'Generate precision 20Hz-20kHz sound waves (Sine, Square, Triangle, 440Hz).', path: '/tools/tone-generator' },
  { studio: 'media', icon: Music, label: 'BPM Metronome & Tap Tempo', desc: 'Audible tempo metronome with visual beats and tap-tempo BPM counter.', path: '/tools/metronome' },
  { studio: 'media', icon: RotateCcw, label: 'Audio & Voice Reverser', desc: 'Play any audio track backward and export reversed WAV sound files.', path: '/tools/audio-reverser' },

  // Voice & Speech
  { studio: 'voice', icon: Volume2, label: 'Text-to-Speech (TTS)', desc: 'Natural voice reader with customizable accents, pitch, and speed controls.', tag: 'Free TTS', path: '/tools/text-to-speech' },
  { studio: 'voice', icon: Mic, label: 'Speech-to-Text Dictation', desc: 'Speak into your microphone to transcribe spoken voice into editable text live.', tag: 'Voice Typing', path: '/tools/speech-to-text' },
  { studio: 'voice', icon: Wind, label: 'Ambient Noise Generator', desc: 'Acoustic White, Pink, and Brown noise synthesizer for deep focus and sleep.', path: '/tools/white-noise' },

  // Barcodes & QR
  { studio: 'barcode', icon: Barcode, label: '1D Barcode Generator', desc: 'Generate standard Code 128 and Code 39 barcodes with human-readable labels.', path: '/tools/barcode-generator' },
  { studio: 'barcode', icon: Camera, label: 'Camera & Image QR Scan', desc: 'Scan and decode QR codes live with your webcam or by dropping an image.', path: '/tools/qr-scanner' },
  { studio: 'barcode', icon: Wifi, label: 'WiFi Instant Connect QR', desc: 'Generate one-scan WiFi auto-connection QR codes for homes, offices, and cafés.', tag: 'Most Popular', path: '/tools/wifi-qr' },
  { studio: 'barcode', icon: Contact, label: 'vCard Contact Card QR', desc: 'Digital business card QR code that saves full contact info directly to phones.', path: '/tools/vcard-qr' },

  // Design & Graphics
  { studio: 'design', icon: Pipette, label: 'Screen Eyedropper', desc: 'Pick any color pixel directly from your desktop or browser window into HEX/RGB.', path: '/tools/color-picker' },
  { studio: 'design', icon: Palette, label: 'CSS Gradient Generator', desc: 'Interactive linear and radial CSS gradient designer with 1-click code copy.', path: '/tools/gradient-generator' },
  { studio: 'design', icon: Crop, label: 'Aspect Ratio Cropper', desc: 'Crop photos precisely for 1:1 Instagram, 16:9 YouTube, and 9:16 Reels/Stories.', path: '/tools/aspect-cropper' },
  { studio: 'design', icon: LayoutGrid, label: 'Photo Grid Collage', desc: 'Combine 2 to 4 photos into clean, modern grid collages with custom borders.', path: '/tools/photo-collage' },
  { studio: 'design', icon: PenTool, label: 'Quick Whiteboard & Doodle', desc: 'Freehand sketching scratchpad with pencils, erasers, and PNG export.', path: '/tools/whiteboard' },

  // Developer & Web
  { studio: 'dev', icon: FileJson, label: 'JSON Formatter & Minifier', desc: 'Validate, format, indent, and compress JSON data with instant error markers.', path: '/tools/json-formatter' },
  { studio: 'dev', icon: Table, label: 'JSON ⇄ CSV Converter', desc: 'Bidirectional converter between JSON arrays and CSV tables with 1-click download.', path: '/tools/json-to-csv' },
  { studio: 'dev', icon: Binary, label: 'Base64 Tool', desc: 'Encode and decode text strings or upload files to base64 Data URLs.', path: '/tools/base64' },
  { studio: 'dev', icon: KeyRound, label: 'JWT Debugger & Inspector', desc: 'Decode header and payload claims with live expiration status and signature check.', tag: 'JWT.io Alternative', path: '/tools/jwt-debugger' },
  { studio: 'dev', icon: Code, label: 'Regex Tester', desc: 'Test regular expressions against strings with real-time match groups detection.', path: '/tools/regex-tester' },
  { studio: 'dev', icon: Hash, label: 'Hash & Checksum Generator', desc: 'Calculate SHA-256, MD5, SHA-1, and SHA-512 hashes for any text or file.', path: '/tools/hash-generator' },
  { studio: 'dev', icon: Cpu, label: 'UUID & NanoID Generator', desc: 'Generate batches of RFC-4122 v4 UUIDs and URL-friendly compact NanoIDs.', path: '/tools/uuid-generator' },
  { studio: 'dev', icon: Sparkles, label: 'CSS Box Shadow Generator', desc: 'Interactive box-shadow designer with elevation preview and 1-click CSS copy.', path: '/tools/css-shadow' },
  { studio: 'dev', icon: Globe, label: 'URL & Query Params Editor', desc: 'Inspect URL components and dynamically edit query parameters with live rebuild.', path: '/tools/url-parser' },
  { studio: 'dev', icon: Code, label: 'HTML/CSS/JS Formatter', desc: 'Beautify or minify HTML, CSS, and JavaScript source code cleanly.', path: '/tools/code-formatter' },
  { studio: 'dev', icon: Laptop, label: 'Device & Hardware Diagnostics', desc: 'Comprehensive screen DPI, GPU renderer, battery, and CPU core diagnostics.', path: '/tools/device-diagnostics' },

  // Text Studio
  { studio: 'text', icon: FileDiff, label: 'Text Diff Checker', desc: 'Side-by-side and line-by-line visual difference comparison between text versions.', tag: 'Diff Checker', path: '/tools/text-diff' },
  { studio: 'text', icon: BookOpen, label: 'Markdown Live Editor', desc: 'Live split-screen Markdown writing with instant rendered HTML preview & export.', path: '/tools/markdown-live' },
  { studio: 'text', icon: Type, label: 'Case Converter & Slugs', desc: 'Convert text to camelCase, snake_case, kebab-case, Title Case, UPPERCASE, etc.', path: '/tools/case-converter' },
  { studio: 'text', icon: AlignLeft, label: 'Word & Density Counter', desc: 'Real-time word, character, sentence count, reading time, and keyword density.', path: '/tools/text-counter' },
  { studio: 'text', icon: FileText, label: 'Lorem Ipsum Generator', desc: 'Generate customized dummy placeholder paragraphs, sentences, and words.', path: '/tools/lorem-generator' },

  // Security Studio
  { studio: 'security', icon: Lock, label: 'AES-256 File Encryptor', desc: 'Zero-knowledge military-grade AES-256 file encryption with password. 100% private.', tag: 'Ultra Secure', path: '/tools/aes-encrypt' },
  { studio: 'security', icon: EyeOff, label: 'Steganography Tool', desc: 'Invisibly hide secret confidential text messages inside image pixels.', tag: 'Spy Grade', path: '/tools/steganography' },
  { studio: 'security', icon: Key, label: 'Password & Entropy Meter', desc: 'Generate cryptographically random passwords with real-time entropy security score.', path: '/tools/password-generator' },
  { studio: 'security', icon: ShieldCheck, label: 'EXIF Metadata Stripper', desc: 'Wipe GPS coordinates, camera models, and device timestamps from photos.', path: '/tools/strip-exif' },

  // Productivity & Calculators
  { studio: 'productivity', icon: Timer, label: 'Pomodoro Focus Timer', desc: '25-minute focus intervals and breaks with audio chime alerts.', path: '/tools/pomodoro-timer' },
  { studio: 'productivity', icon: Clock, label: 'UNIX Timestamp Converter', desc: 'Convert timestamps to human dates and human dates to epoch.', path: '/tools/epoch-converter' },
  { studio: 'productivity', icon: Scale, label: 'Universal Unit Converter', desc: 'Convert length, weight, temperature, data storage, and speed.', path: '/tools/unit-converter' },
  { studio: 'productivity', icon: Monitor, label: 'Screen PPI Calculator', desc: 'Calculate reduced aspect ratios and screen pixel density (PPI).', path: '/tools/screen-calculator' },
  { studio: 'productivity', icon: Dices, label: 'Decision Maker & Dice', desc: 'Fair random choice wheel spinner, coin flipper, and dice roller.', path: '/tools/decision-maker' },
]

const COMPARE = [
  { feature: '95+ Client-Side Digital Utilities', df: true, others: 'Fragmented across 15+ paid sites' },
  { feature: 'Edit existing PDF text directly', df: true, others: 'Paid subscription required ($15-$25/mo)' },
  { feature: 'Scanned PDF OCR (in-browser)', df: true, others: 'Paid add-on ($5-$15/mo)' },
  { feature: 'Screen & Audio Recording (No Watermark)', df: true, others: '5-minute limit on free plans' },
  { feature: 'Passport Photo & A4/4x6 Print Sheets', df: true, others: 'Paid photo studio software' },
  { feature: 'Permanent Blackout Redactor & Blank Cleaner', df: true, others: 'Acrobat Pro subscription required' },
  { feature: 'Text-to-Speech & Speech-to-Text', df: true, others: 'API costs & token paywalls' },
  { feature: 'Military AES-256 File Encryption', df: true, others: 'Paid enterprise software' },
  { feature: 'Unlimited daily tasks & zero caps', df: true, others: 'Usually capped at 2-3 free tasks/day' },
  { feature: '100% Client-Side Privacy (Files never uploaded)', df: true, others: 'Uploaded to cloud servers' },
  { feature: 'No sign-up or login required', df: true, others: 'Mandatory email capture & credit card' },
  { feature: '100% Free Forever with Zero Costs', df: true, others: 'Aggressive paywalls & trial traps' },
]

function Cell({ val }) {
  if (val === true) return <span className={styles.yes}><Check size={14} /></span>
  if (val === false) return <span className={styles.no}><X size={14} /></span>
  return <span className={styles.partial}>{val}</span>
}

export default function Landing() {
  const [activeStudio, setActiveStudio] = useState('all')

  const visibleFeatures = activeStudio === 'all'
    ? ALL_STUDIO_FEATURES
    : ALL_STUDIO_FEATURES.filter(f => f.studio === activeStudio)

  return (
    <div className={styles.page}>
      <Navbar variant="landing" />

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroEyebrow}>
            <Shield size={12} /> 100% Free Client-Side Super-Suite • Zero Servers • 95+ Tools
          </div>
          <h1 className={styles.heroTitle}>
            The World's #1 Free<br />
            <span className={styles.heroAccent}>Omni-Utility Super-Suite</span>
          </h1>
          <p className={styles.heroSub}>
            95+ professional tools across <strong>PDF, Image, Audio, Voice, Barcodes, Design, Developer, Text, Security, and Productivity</strong>.
            Edit PDFs, crop passport photos, erase backgrounds, record screens, synthesize voices, generate barcodes, and encrypt files.
            Zero login, zero subscriptions, and your files never touch any server.
          </p>
          <div className={styles.heroActions}>
            <Link to="/tools" className={styles.primaryBtn}>
              <Zap size={16} />
              Explore All 95+ Free Tools
              <ChevronRight size={14} />
            </Link>
            <Link to="/editor" className={styles.ghostBtn}>
              Open PDF Editor
              <ChevronRight size={14} />
            </Link>
          </div>
          <div className={styles.heroPills}>
            <span className={styles.pill}><Check size={11} /> 95+ Free Utilities</span>
            <span className={styles.pill}><Check size={11} /> 100% Free Forever</span>
            <span className={styles.pill}><Check size={11} /> Zero Login Required</span>
            <span className={styles.pill}><Check size={11} /> Unlimited Daily Use</span>
            <span className={styles.pillAccent}><Lock size={11} /> Files Never Leave Device</span>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.editorPreview}>
            <div className={styles.previewBar}>
              <div className={styles.previewDots}>
                <span /><span /><span />
              </div>
              <span className={styles.previewTitle}>annual-report.pdf - PDF Studio</span>
            </div>
            <div className={styles.previewContent}>
              <div className={styles.previewToolbar}>
                {['Text', 'Sign', 'Forms', 'Whiteout', '|', 'OCR', '|', '12pt', 'Arial'].map((t, i) => (
                  <span key={i} className={t === '|' ? styles.sep : styles.tbItem}>{t}</span>
                ))}
              </div>
              <div className={styles.previewPage}>
                <div className={styles.previewSelectedBlock}>
                  Executive Summary 2026
                  <div className={styles.selHandle} />
                </div>
                <div className={styles.previewTextLine} style={{ width: '92%', marginTop: 28 }} />
                <div className={styles.previewTextLine} style={{ width: '78%', marginTop: 8 }} />
                <div className={styles.previewTextLine} style={{ width: '84%', marginTop: 8 }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                  <div className={styles.previewCard} style={{ background: 'rgba(16,185,129,0.12)' }}>
                    <span style={{ fontSize: 10, color: '#10b981' }}>Monthly Growth</span>
                    <span style={{ fontSize: 18, fontWeight: 600, color: '#047857' }}>+34.8%</span>
                  </div>
                  <div className={styles.previewCard} style={{ background: 'rgba(59,130,246,0.12)' }}>
                    <span style={{ fontSize: 10, color: '#3b82f6' }}>Active Users</span>
                    <span style={{ fontSize: 18, fontWeight: 600, color: '#1d4ed8' }}>128,400</span>
                  </div>
                </div>
                <div className={styles.previewCtx}>
                  <span>Edit</span><span>Style</span><span>Duplicate</span><span style={{ color: '#ef4444' }}>Delete</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>Comprehensive Omni-Suite</div>
          <h2 className={styles.sectionTitle}>95+ Powerful Tools. 10 Dedicated Studios.</h2>
          <p className={styles.sectionSub}>Everything you usually pay multiple monthly subscriptions for, now unified in one lightning-fast client-side application.</p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '28px' }}>
            {STUDIOS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveStudio(s.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '99px',
                  border: activeStudio === s.id ? '1px solid #10b981' : '1px solid var(--brd)',
                  background: activeStudio === s.id ? '#10b981' : 'var(--bg-card)',
                  color: activeStudio === s.id ? '#ffffff' : 'var(--tx-2)',
                  fontSize: '13px',
                  fontWeight: activeStudio === s.id ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: activeStudio === s.id ? '0 2px 8px rgba(16,185,129,0.25)' : 'none'
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className={styles.featureGrid}>
            {visibleFeatures.map((f) => {
              const Icon = f.icon
              return (
                <Link key={f.label} to={f.path || '/tools'} className={styles.featureCard}>
                  <div className={styles.featureIconWrap}>
                    <Icon size={20} />
                  </div>
                  <div className={styles.featureLabel}>
                    {f.label}
                    {f.tag && <span className={styles.featureTag}>{f.tag}</span>}
                  </div>
                  <div className={styles.featureDesc}>{f.desc}</div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <section className={styles.section} style={{ background: 'var(--bg-nav)' }}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>Feature Comparison</div>
          <h2 className={styles.sectionTitle}>Why We Outperform Online Converters</h2>
          <div className={styles.tableWrap}>
            <table className={styles.compareTable}>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className={styles.thDocforge}>
                    <div className={styles.thBadge}>Omni-Suite</div>
                    <div className={styles.thPrice}>100% Free Forever</div>
                  </th>
                  <th>
                    <div>Other Services</div>
                    <div className={styles.thPrice}>$6 - $18 / month</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row.feature}>
                    <td>{row.feature}</td>
                    <td className={styles.tdDocforge}><Cell val={row.df} /></td>
                    <td><Cell val={row.others} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionLabel}>Maximum Privacy & Security</div>
          <h2 className={styles.sectionTitle}>Your confidential files stay on your machine</h2>
          <div className={styles.howGrid}>
            <div className={styles.howCard}>
              <div className={styles.howNum}>01</div>
              <div className={styles.howTitle}>Open Instantly</div>
              <div className={styles.howDesc}>Files load directly into local browser memory. No upload queue, no wait times, and no network transmission.</div>
            </div>
            <div className={styles.howCard}>
              <div className={styles.howNum}>02</div>
              <div className={styles.howTitle}>Process Locally</div>
              <div className={styles.howDesc}>All rendering, text recognition, compression, and encryption happen directly on your CPU using WebAssembly.</div>
            </div>
            <div className={styles.howCard}>
              <div className={styles.howNum}>03</div>
              <div className={styles.howTitle}>Instant Save</div>
              <div className={styles.howDesc}>Export modified PDFs directly to your downloads folder without cloud storage or third-party tracking.</div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Ready to experience the ultimate PDF suite?</h2>
          <p className={styles.ctaSub}>No sign-up. No credit card. No paywall traps. Start editing your PDFs right now.</p>
          <div className={styles.ctaActions}>
            <Link to="/editor" className={styles.primaryBtn} style={{ fontSize: 15, padding: '12px 28px' }}>
              <Zap size={16} />
              Open the PDF Editor
            </Link>
            <Link to="/tools" className={styles.ghostBtn}>
              Browse All 29+ Tools
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLogo}>
            <div className={styles.footerLogoMark}><FileText size={14} /></div>
            <span>PDF Studio</span>
          </div>
          <div className={styles.footerLinks}>
            <Link to="/editor">PDF Editor</Link>
            <Link to="/tools">All Tools</Link>
            <Link to="/">Home</Link>
          </div>
          <div className={styles.footerNote}>
            Powered by WebAssembly, pdf-lib, PDF.js & Tesseract OCR • 100% Client-Side Privacy
          </div>
        </div>
      </footer>
    </div>
  )
}
