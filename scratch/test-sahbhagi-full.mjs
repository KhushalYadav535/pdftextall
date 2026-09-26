import fs from 'fs';
import JSZip from 'jszip';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

function isColorDark(hex) {
  if (!hex || typeof hex !== 'string') return false;
  const clean = hex.replace(/^#/, '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum < 0.5;
  }
  return false;
}

function hexToRgb(hex, defaultColor = rgb(0.12, 0.15, 0.2)) {
  if (!hex || typeof hex !== 'string') return defaultColor;
  const clean = hex.replace(/^#/, '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return rgb(r, g, b);
  }
  return defaultColor;
}

function unescapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

console.log('isColorDark 1F3864 (navy):', isColorDark('1F3864'));
console.log('isColorDark F5F5F5 (light gray):', isColorDark('F5F5F5'));
console.log('isColorDark E2E8F0 (light slate):', isColorDark('E2E8F0'));
