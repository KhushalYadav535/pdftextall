import * as pdfjsLib from 'pdfjs-dist'
import fs from 'fs'

async function inspectImages() {
  console.log('Testing PDF.js image extraction...')
  // Let's create a PDF with an image or use an existing PDF
  // We can use scratch/sahbhagi-fixed.pdf or create a simple one
  const files = ['extracted-pages-merged.pdf', 'scratch/sahbhagi-fixed.pdf', 'scratch/test-docs/edge-cases-test.pdf']
  let targetFile = null
  for (const f of files) {
    if (fs.existsSync(f)) {
      targetFile = f
      break
    }
  }
  console.log('Target file:', targetFile)
  if (!targetFile) return

  const buf = fs.readFileSync(targetFile)
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise
  console.log('Num pages:', doc.numPages)
  const page = await doc.getPage(1)
  const opList = await page.getOperatorList()
  console.log('Operator count:', opList.fnArray.length)

  // Find image operators
  const imgOps = []
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i]
    if (
      fn === pdfjsLib.OPS.paintImageXObject ||
      fn === pdfjsLib.OPS.paintJpegXObject ||
      fn === pdfjsLib.OPS.paintInlineImageXObject
    ) {
      imgOps.push({ idx: i, fn, args: opList.argsArray[i] })
    }
  }
  console.log('Image operators found:', imgOps)

  for (const op of imgOps) {
    const objId = op.args[0]
    console.log('Looking up objId:', objId)
    // Test page.objs.get
    if (page.objs.has(objId)) {
      console.log('page.objs.has returned true!')
      const img = await new Promise((resolve) => page.objs.get(objId, resolve))
      console.log('Image retrieved from page.objs:', {
        width: img?.width,
        height: img?.height,
        hasData: !!img?.data,
        dataType: img?.data?.constructor?.name,
        dataLength: img?.data?.length,
        kind: img?.kind
      })
    } else {
      console.log('page.objs does not have', objId, 'yet. Trying callback or commonObjs...')
      if (page.commonObjs.has(objId)) {
        const img = await new Promise((resolve) => page.commonObjs.get(objId, resolve))
        console.log('Image retrieved from commonObjs:', img)
      } else {
        console.log('Neither has it synchronously. Calling page.objs.get with callback...')
        try {
          const img = await new Promise((resolve, reject) => {
            page.objs.get(objId, (res) => {
              if (res) resolve(res)
              else reject(new Error('null image'))
            })
            setTimeout(() => resolve(null), 1000)
          })
          console.log('Async objs.get result:', img ? { width: img.width, height: img.height } : null)
        } catch (e) {
          console.log('Async objs.get error:', e.message)
        }
      }
    }
  }
}

inspectImages().catch(console.error)
