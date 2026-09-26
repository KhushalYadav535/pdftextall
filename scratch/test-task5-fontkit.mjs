import 'regenerator-runtime/runtime.js'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument } from 'pdf-lib'
import fs from 'fs'

async function testFontkit() {
  console.log('Testing @pdf-lib/fontkit embedding...')
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  // Test downloading or loading a TTF font
  const fontUrl = 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf'
  console.log('Fetching Noto Sans Devanagari font...')
  
  let fontBytes
  const localFontPath = 'scratch/NotoSansDevanagari-Regular.ttf'
  if (fs.existsSync(localFontPath)) {
    fontBytes = fs.readFileSync(localFontPath)
    console.log('Loaded from local scratch cache.')
  } else {
    const res = await fetch(fontUrl)
    if (!res.ok) throw new Error(`Failed to fetch font: ${res.statusText}`)
    fontBytes = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(localFontPath, fontBytes)
    console.log(`Downloaded font (${fontBytes.length} bytes) and cached.`)
  }

  const customFont = await pdfDoc.embedFont(fontBytes, { subset: false })
  console.log('✓ Successfully embedded custom font via fontkit (subset: false)!')

  const page = pdfDoc.addPage([595.28, 841.89])
  const hindiText = 'नमस्ते दुनिया - यह एक उच्च-गुणवत्ता परीक्षण दस्तावेज़ है।'
  page.drawText(hindiText, {
    x: 50,
    y: 750,
    size: 16,
    font: customFont
  })

  const pdfBytes = await pdfDoc.save()
  fs.writeFileSync('scratch/test-hindi-fontkit.pdf', pdfBytes)
  console.log(`✓ Saved scratch/test-hindi-fontkit.pdf (${pdfBytes.length} bytes). Hindi text is vector and selectable!`)
}

testFontkit().catch(console.error)
