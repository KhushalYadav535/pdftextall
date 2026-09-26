import fs from 'fs'
import path from 'path'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType
} from 'docx'

const outputDir = path.resolve('scratch/test-docs')
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// 1. Generate Complex Invoice / Payslip PDF
async function createTestPdf() {
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  // Page 1: Invoice Header, Metadata, and Multi-Column Table with borders
  const page1 = pdfDoc.addPage([595.28, 841.89]) // A4
  const { width, height } = page1.getSize()
  
  // Title
  page1.drawText('ACME CORPORATION - TAX INVOICE', {
    x: 50,
    y: height - 60,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.2, 0.5)
  })
  
  // Metadata 2-column key-values
  page1.drawText('Invoice Number: INV-2026-0891', { x: 50, y: height - 90, size: 10, font: fontRegular })
  page1.drawText('Invoice Date: 2026-09-20', { x: 50, y: height - 105, size: 10, font: fontRegular })
  page1.drawText('Payment Terms: Net 30', { x: 50, y: height - 120, size: 10, font: fontRegular })
  
  page1.drawText('Customer: Global Tech Enterprises', { x: 320, y: height - 90, size: 10, font: fontBold })
  page1.drawText('GSTIN / Tax ID: 27AABCG1234F1Z5', { x: 320, y: height - 105, size: 10, font: fontRegular })
  page1.drawText('Billing Address: 402 Silicon Heights', { x: 320, y: height - 120, size: 10, font: fontRegular })

  // Table geometry
  const startX = 50
  const tableW = width - 100 // 495.28
  const startY = height - 160
  const colWidths = [45, 180, 70, 90, 110.28] // Item, Description, Qty, Rate, Total
  const headers = ['#', 'Description', 'Qty', 'Unit Rate ($)', 'Total ($)']
  
  // Header Row background
  page1.drawRectangle({
    x: startX,
    y: startY - 24,
    width: tableW,
    height: 24,
    color: rgb(0.9, 0.93, 0.96)
  })
  
  // Header Text
  let curX = startX
  for (let c = 0; c < headers.length; c++) {
    page1.drawText(headers[c], {
      x: curX + 6,
      y: startY - 17,
      size: 9,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.3)
    })
    curX += colWidths[c]
  }

  // Draw Header Border
  page1.drawRectangle({
    x: startX,
    y: startY - 24,
    width: tableW,
    height: 24,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1
  })

  // Table Data Rows
  const items = [
    ['1', 'Cloud Infrastructure Consulting', '40 hrs', '150.00', '6,000.00'],
    ['2', 'Full-Stack Web App Migration', '80 hrs', '120.00', '9,600.00'],
    ['3', 'High-Fidelity PDF Engine Integration', '1 lic', '2,500.00', '2,500.00'],
    ['4', 'Database Performance Optimization', '25 hrs', '140.00', '3,500.00'],
    ['5', '24/7 Enterprise SLA Support', '3 mos', '800.00', '2,400.00']
  ]

  let curY = startY - 24
  for (const item of items) {
    curY -= 22
    // Row background (alternate)
    page1.drawRectangle({
      x: startX,
      y: curY,
      width: tableW,
      height: 22,
      borderColor: rgb(0.8, 0.85, 0.9),
      borderWidth: 0.5
    })
    
    let cellX = startX
    for (let c = 0; c < item.length; c++) {
      const isNum = c >= 2
      page1.drawText(item[c], {
        x: isNum ? cellX + colWidths[c] - fontRegular.widthOfTextAtSize(item[c], 9) - 8 : cellX + 6,
        y: curY + 6,
        size: 9,
        font: fontRegular,
        color: rgb(0.15, 0.2, 0.25)
      })
      // Vertical separator
      if (c > 0) {
        page1.drawLine({
          start: { x: cellX, y: curY },
          end: { x: cellX, y: curY + 22 },
          thickness: 0.5,
          color: rgb(0.8, 0.85, 0.9)
        })
      }
      cellX += colWidths[c]
    }
  }

  // Summary Table with Merged Cell (Subtotal, Tax, Grand Total)
  const summaries = [
    ['Subtotal', '24,000.00'],
    ['GST / VAT (18%)', '4,320.00'],
    ['Grand Total', '$28,320.00']
  ]

  for (const s of summaries) {
    curY -= 22
    const isGrand = s[0] === 'Grand Total'
    const labelW = colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]
    const valW = colWidths[4]

    if (isGrand) {
      page1.drawRectangle({
        x: startX,
        y: curY,
        width: tableW,
        height: 22,
        color: rgb(0.93, 0.96, 1.0)
      })
    }

    page1.drawRectangle({
      x: startX,
      y: curY,
      width: tableW,
      height: 22,
      borderColor: rgb(0.7, 0.75, 0.8),
      borderWidth: 0.75
    })

    // Label spanning 4 columns
    page1.drawText(s[0], {
      x: startX + labelW - fontBold.widthOfTextAtSize(s[0], 9.5) - 10,
      y: curY + 6,
      size: 9.5,
      font: fontBold,
      color: isGrand ? rgb(0.1, 0.2, 0.6) : rgb(0.2, 0.25, 0.3)
    })

    // Value
    page1.drawText(s[1], {
      x: startX + labelW + valW - fontBold.widthOfTextAtSize(s[1], 9.5) - 8,
      y: curY + 6,
      size: 9.5,
      font: fontBold,
      color: isGrand ? rgb(0.1, 0.2, 0.6) : rgb(0.2, 0.25, 0.3)
    })

    // Vertical line before total value
    page1.drawLine({
      start: { x: startX + labelW, y: curY },
      end: { x: startX + labelW, y: curY + 22 },
      thickness: 0.75,
      color: rgb(0.7, 0.75, 0.8)
    })
  }

  // Footer / Notes
  curY -= 40
  page1.drawText('Notes & Instructions:', { x: 50, y: curY, size: 10, font: fontBold, color: rgb(0.2, 0.25, 0.3) })
  curY -= 15
  page1.drawText('• Payment is due within 30 days of invoice date.', { x: 50, y: curY, size: 9, font: fontRegular })
  curY -= 14
  page1.drawText('• Wire transfers should reference invoice INV-2026-0891.', { x: 50, y: curY, size: 9, font: fontRegular })
  curY -= 14
  page1.drawText('• For billing queries, contact accounts@acme-corp.com.', { x: 50, y: curY, size: 9, font: fontRegular })

  const pdfBytes = await pdfDoc.save()
  const pdfPath = path.join(outputDir, 'test-invoice.pdf')
  fs.writeFileSync(pdfPath, pdfBytes)
  console.log('Created test PDF:', pdfPath)
}

// 2. Generate Complex Word (.docx) with Merged Cells, Shading, Lists, and Multi-Column Layout
async function createTestDocx() {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
          }
        },
        children: [
          // Title
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
            children: [
              new TextRun({
                text: 'QUARTERLY PERFORMANCE REPORT',
                bold: true,
                size: 32,
                color: '1E3A8A'
              })
            ]
          }),

          // Subtitle / Intro
          new Paragraph({
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: 'Executive Summary for Q3 FY2026. Review of operational KPIs, revenue targets, and delivery metrics.',
                italics: true,
                size: 22,
                color: '475569'
              })
            ]
          }),

          // Table with Colspan (merged header), Rowspan (vertical merge), and Shading
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            rows: [
              // Row 1: Merged Header spanning columns
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({
                    columnSpan: 2,
                    width: { size: 4500, type: WidthType.DXA },
                    shading: { fill: '1E3A8A', type: ShadingType.CLEAR },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 6, color: '1E3A8A' },
                      bottom: { style: BorderStyle.SINGLE, size: 6, color: '1E3A8A' },
                      left: { style: BorderStyle.SINGLE, size: 6, color: '1E3A8A' },
                      right: { style: BorderStyle.SINGLE, size: 6, color: '1E3A8A' }
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: 'Revenue Metrics (USD)', bold: true, color: 'FFFFFF', size: 20 })
                        ]
                      })
                    ]
                  }),
                  new TableCell({
                    columnSpan: 2,
                    width: { size: 4500, type: WidthType.DXA },
                    shading: { fill: '2563EB', type: ShadingType.CLEAR },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 6, color: '2563EB' },
                      bottom: { style: BorderStyle.SINGLE, size: 6, color: '2563EB' },
                      left: { style: BorderStyle.SINGLE, size: 6, color: '2563EB' },
                      right: { style: BorderStyle.SINGLE, size: 6, color: '2563EB' }
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: 'Operational KPIs', bold: true, color: 'FFFFFF', size: 20 })
                        ]
                      })
                    ]
                  })
                ]
              }),

              // Row 2: Sub-headers (4 columns)
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({
                    width: { size: 2250, type: WidthType.DXA },
                    shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Stream', bold: true, size: 18 })] })]
                  }),
                  new TableCell({
                    width: { size: 2250, type: WidthType.DXA },
                    shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Target ($M)', bold: true, size: 18 })] })]
                  }),
                  new TableCell({
                    width: { size: 2250, type: WidthType.DXA },
                    shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Metric', bold: true, size: 18 })] })]
                  }),
                  new TableCell({
                    width: { size: 2250, type: WidthType.DXA },
                    shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Actual', bold: true, size: 18 })] })]
                  })
                ]
              }),

              // Row 3: Data row 1
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2250, type: WidthType.DXA },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Enterprise SaaS', size: 18 })] })]
                  }),
                  new TableCell({
                    width: { size: 2250, type: WidthType.DXA },
                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: '$14.2M', size: 18 })] })]
                  }),
                  new TableCell({
                    width: { size: 2250, type: WidthType.DXA },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Uptime SLA', size: 18 })] })]
                  }),
                  new TableCell({
                    width: { size: 2250, type: WidthType.DXA },
                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: '99.98%', size: 18 })] })]
                  })
                ]
              }),

              // Row 4: Data row 2
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 2250, type: WidthType.DXA },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Consulting', size: 18 })] })]
                  }),
                  new TableCell({
                    width: { size: 2250, type: WidthType.DXA },
                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: '$8.5M', size: 18 })] })]
                  }),
                  new TableCell({
                    width: { size: 2250, type: WidthType.DXA },
                    children: [new Paragraph({ children: [new TextRun({ text: 'CSAT Score', size: 18 })] })]
                  }),
                  new TableCell({
                    width: { size: 2250, type: WidthType.DXA },
                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: '4.8 / 5.0', size: 18 })] })]
                  })
                ]
              }),

              // Row 5: Merged Summary Row (Colspan 3 + 1)
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 3,
                    width: { size: 6750, type: WidthType.DXA },
                    shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: 'Total Performance Score:', bold: true, size: 19 })]
                      })
                    ]
                  }),
                  new TableCell({
                    width: { size: 2250, type: WidthType.DXA },
                    shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: 'EXCEEDED (112%)', bold: true, color: '15803D', size: 19 })]
                      })
                    ]
                  })
                ]
              })
            ]
          }),

          // Spacing
          new Paragraph({ spacing: { before: 240, after: 120 }, text: '' }),

          // Headings and bulleted lists
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'Key Strategic Highlights', bold: true, color: '2563EB', size: 26 })]
          }),

          new Paragraph({
            spacing: { before: 80, after: 60 },
            children: [
              new TextRun({ text: '• ', bold: true }),
              new TextRun({ text: 'Expanded customer base by 34% across North America and APAC regions.' })
            ]
          }),
          new Paragraph({
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({ text: '• ', bold: true }),
              new TextRun({ text: 'Reduced customer onboarding latency from 14 days down to 3 business days.' })
            ]
          }),
          new Paragraph({
            spacing: { before: 60, after: 160 },
            children: [
              new TextRun({ text: '• ', bold: true }),
              new TextRun({ text: 'Achieved ISO 27001 and SOC 2 Type II compliance certifications.' })
            ]
          })
        ]
      }
    ]
  })

  const buffer = await Packer.toBuffer(doc)
  const docxPath = path.join(outputDir, 'test-report.docx')
  fs.writeFileSync(docxPath, buffer)
  console.log('Created test DOCX:', docxPath)
}

async function main() {
  await createTestPdf()
  await createTestDocx()
  console.log('Test documents ready!')
}

main().catch(console.error)
