/**
 * PDF Zero - 3-Layer Enterprise Document Platform Architecture
 * 
 * 100% Free, Client-Side, In-Browser Document Processing.
 * No Logins. No Signups. No Cloud Uploads. Zero Operational Cost.
 */

// ── LAYER 1: PDF EDITOR CORE ──
// Canvas rendering, page reordering, annotation overlay, vector stamping, form filling
export {
  renderPdfPage,
  renderThumbnails,
  extractPageAsImage
} from './pdfRenderer.js'

export {
  exportPdfDocument,
  flattenPdfAnnotations
} from './pdfExporter.js'

export {
  mergePdfDocuments,
  splitPdfDocument,
  rotatePdfPages,
  reorderPdfPages
} from './pdfProEngine.js'

// ── LAYER 2: ENTERPRISE CONVERSION ENGINE ──
// High-fidelity format-preserving bidirectional converter
export {
  // Bi-directional Word ↔ PDF
  convertPdfToDocx,
  convertDocxToPdf,
  
  // Format Conversions
  convertPdfToExcel,
  convertPdfToPowerpoint,
  
  // Document Utilities
  repairPdfDocument,
  flattenPdfForm,
  comparePdfsVisual
} from './iloveEngine.js'

// ── LAYER 3: DOCUMENT AI & EXTRACTION ──
// In-browser WebAssembly AI OCR and intelligent extraction
export {
  initOcr,
  ocrCanvas,
  terminateOcr
} from './ocrEngine.js'
