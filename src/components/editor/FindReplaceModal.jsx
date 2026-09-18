import React, { useState } from 'react'
import { X, Search, Replace, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePdfStore } from '../../store/pdfStore.js'
import styles from './FindReplaceModal.module.css'

export default function FindReplaceModal({ isOpen, onClose, textItems = [] }) {
  const {
    currentPage,
    commitExtractedEdit,
    updateTextBlock,
    editLayers,
  } = usePdfStore()

  const [findStr, setFindStr] = useState('')
  const [replaceStr, setReplaceStr] = useState('')
  const [matchCase, setMatchCase] = useState(false)

  if (!isOpen) return null

  const handleReplaceAll = () => {
    if (!findStr.trim()) {
      toast.error('Enter text to find')
      return
    }

    const layer = editLayers[currentPage] || { texts: [] }
    let count = 0

    // 1. Check extracted text items on current page
    for (const item of textItems) {
      const source = item.str || ''
      const hasMatch = matchCase
        ? source.includes(findStr)
        : source.toLowerCase().includes(findStr.toLowerCase())

      if (hasMatch) {
        const regex = new RegExp(
          findStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          matchCase ? 'g' : 'gi'
        )
        const newStr = source.replace(regex, replaceStr)
        if (newStr !== source) {
          commitExtractedEdit(currentPage, item, newStr)
          count++
        }
      }
    }

    // 2. Check user-added / already edited blocks
    for (const block of layer.texts || []) {
      const source = block.str || ''
      const hasMatch = matchCase
        ? source.includes(findStr)
        : source.toLowerCase().includes(findStr.toLowerCase())

      if (hasMatch) {
        const regex = new RegExp(
          findStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          matchCase ? 'g' : 'gi'
        )
        const newStr = source.replace(regex, replaceStr)
        if (newStr !== source) {
          updateTextBlock(currentPage, block.id, { str: newStr })
          count++
        }
      }
    }

    if (count > 0) {
      toast.success(`Replaced ${count} occurrence${count > 1 ? 's' : ''}!`)
      onClose()
    } else {
      toast.error('No matching text found on this page')
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <Search size={18} className={styles.titleIcon} />
            <h3 className={styles.title}>Find & Replace</h3>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label}>Find:</label>
            <div className={styles.inputWrap}>
              <Search size={15} className={styles.fieldIcon} />
              <input
                type="text"
                placeholder="Text to find..."
                value={findStr}
                onChange={e => setFindStr(e.target.value)}
                className={styles.input}
                autoFocus
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Replace with:</label>
            <div className={styles.inputWrap}>
              <Replace size={15} className={styles.fieldIcon} />
              <input
                type="text"
                placeholder="Replacement text..."
                value={replaceStr}
                onChange={e => setReplaceStr(e.target.value)}
                className={styles.input}
              />
            </div>
          </div>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={matchCase}
              onChange={e => setMatchCase(e.target.checked)}
            />
            <span>Match Case (Exact capitalization)</span>
          </label>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.applyBtn} onClick={handleReplaceAll}>
            <Check size={16} /> Replace on Page
          </button>
        </div>
      </div>
    </div>
  )
}
