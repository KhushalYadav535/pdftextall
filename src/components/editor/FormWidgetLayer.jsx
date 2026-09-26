import React, { useEffect, useState } from 'react'
import { usePdfStore } from '../../store/pdfStore.js'
import { getPdfDocument, BASE_SCALE } from '../../lib/pdfRenderer.js'
import styles from './FormWidgetLayer.module.css'

export default function FormWidgetLayer({ pageNum }) {
  const { formFields, setFormFieldValue, editorMode, file } = usePdfStore()
  const [widgets, setWidgets] = useState([])

  useEffect(() => {
    let active = true
    const doc = getPdfDocument()
    if (!doc || !pageNum) {
      setWidgets([])
      return
    }

    doc.getPage(pageNum).then(async (page) => {
      try {
        const annots = await page.getAnnotations({ intent: 'display' })
        if (!active) return
        const vp = page.getViewport({ scale: BASE_SCALE })
        const widgetAnnots = (annots || [])
          .filter(a => a.subtype === 'Widget' && a.rect)
          .map((a, idx) => {
            const vr = vp.convertToViewportRectangle(a.rect)
            const x = Math.min(vr[0], vr[2])
            const y = Math.min(vr[1], vr[3])
            const width = Math.max(Math.abs(vr[2] - vr[0]), 12)
            const height = Math.max(Math.abs(vr[3] - vr[1]), 12)
            return {
              id: a.id || `widget-${pageNum}-${idx}`,
              fieldName: a.fieldName || `field-${pageNum}-${idx}`,
              fieldType: a.fieldType,
              fieldValue: a.fieldValue,
              checkBox: a.checkBox,
              radioButton: a.radioButton,
              buttonValue: a.buttonValue !== undefined ? a.buttonValue : a.exportValue,
              options: a.options || [],
              multiline: Boolean(a.multiline),
              readOnly: Boolean(a.readOnly),
              rect: { x, y, width, height },
            }
          })
        setWidgets(widgetAnnots)
      } catch (err) {
        console.warn('Failed to load page widget annotations:', err)
        if (active) setWidgets([])
      }
    })

    return () => {
      active = false
    }
  }, [pageNum, file])

  if (!widgets.length) return null

  const handleStopPropagation = (e) => {
    e.stopPropagation()
  }

  return (
    <div className={`${styles.container} ${editorMode === 'form' ? styles.formMode : ''}`}>
      {widgets.map((widget) => {
        const { x, y, width, height } = widget.rect
        const currentVal = formFields[widget.fieldName]

        // 1. Text Field
        if (widget.fieldType === 'Tx') {
          const value = currentVal !== undefined ? String(currentVal) : String(widget.fieldValue || '')
          return (
            <div
              key={widget.id}
              style={{ left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` }}
              className={styles.widget}
              onClick={handleStopPropagation}
            >
              {widget.multiline ? (
                <textarea
                  className={styles.textareaInput}
                  value={value}
                  disabled={widget.readOnly}
                  onChange={(e) => setFormFieldValue(widget.fieldName, e.target.value)}
                  onKeyDown={handleStopPropagation}
                  title={widget.fieldName}
                />
              ) : (
                <input
                  type="text"
                  className={styles.textInput}
                  value={value}
                  disabled={widget.readOnly}
                  onChange={(e) => setFormFieldValue(widget.fieldName, e.target.value)}
                  onKeyDown={handleStopPropagation}
                  title={widget.fieldName}
                />
              )}
            </div>
          )
        }

        // 2. Checkbox
        if (widget.fieldType === 'Btn' && widget.checkBox) {
          const isChecked = currentVal !== undefined
            ? Boolean(currentVal)
            : (widget.fieldValue === 'Yes' || widget.fieldValue === 'On' || widget.fieldValue === true)
          return (
            <div
              key={widget.id}
              style={{ left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` }}
              className={styles.widget}
              onClick={handleStopPropagation}
            >
              <input
                type="checkbox"
                className={styles.checkboxInput}
                checked={isChecked}
                disabled={widget.readOnly}
                onChange={(e) => setFormFieldValue(widget.fieldName, e.target.checked)}
                title={widget.fieldName}
              />
            </div>
          )
        }

        // 3. Radio Button
        if (widget.fieldType === 'Btn' && widget.radioButton) {
          const valStr = String(widget.buttonValue ?? '')
          const selectedVal = currentVal !== undefined ? String(currentVal) : String(widget.fieldValue ?? '')
          const isChecked = selectedVal === valStr || (valStr !== '' && selectedVal.toLowerCase() === valStr.toLowerCase())
          return (
            <div
              key={widget.id}
              style={{ left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` }}
              className={styles.widget}
              onClick={handleStopPropagation}
            >
              <input
                type="radio"
                name={widget.fieldName}
                className={styles.radioInput}
                checked={isChecked}
                disabled={widget.readOnly}
                onChange={() => setFormFieldValue(widget.fieldName, widget.buttonValue)}
                title={`${widget.fieldName}: ${valStr}`}
              />
            </div>
          )
        }

        // 4. Dropdown / Choice
        if (widget.fieldType === 'Ch') {
          const selectedVal = currentVal !== undefined
            ? String(currentVal)
            : (Array.isArray(widget.fieldValue) ? String(widget.fieldValue[0] || '') : String(widget.fieldValue || ''))
          return (
            <div
              key={widget.id}
              style={{ left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` }}
              className={styles.widget}
              onClick={handleStopPropagation}
            >
              <select
                className={styles.selectInput}
                value={selectedVal}
                disabled={widget.readOnly}
                onChange={(e) => setFormFieldValue(widget.fieldName, e.target.value)}
                onKeyDown={handleStopPropagation}
                title={widget.fieldName}
              >
                {widget.options.map((opt, i) => (
                  <option key={opt.exportValue || i} value={opt.exportValue}>
                    {opt.displayValue || opt.exportValue}
                  </option>
                ))}
              </select>
            </div>
          )
        }

        return null
      })}
    </div>
  )
}
