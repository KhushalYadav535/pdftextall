import React, { useState, useRef, useEffect } from 'react'
import { Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'
import styles from './PasswordModal.module.css'

export default function PasswordModal({
  isOpen,
  fileName,
  error,
  loading = false,
  onSubmit,
  onCancel,
}) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setShowPassword(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    if (error && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [error])

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!password || loading) return
    onSubmit(password)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && !loading) {
      onCancel()
    }
  }

  return (
    <div className={styles.overlay} onKeyDown={handleKeyDown}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <Lock size={22} />
          </div>
          <div className={styles.headerText}>
            <h3 className={styles.title}>Password Required</h3>
            {fileName && <p className={styles.fileName}>{fileName}</p>}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.body}>
            <p className={styles.description}>
              This document is password-protected. Please enter the password to open and edit it.
            </p>

            {error && (
              <div className={styles.errorBanner}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className={styles.inputGroup}>
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter document password"
                className={`${styles.input} ${error ? styles.inputError : ''}`}
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.toggleBtn}
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={!password || loading}
            >
              {loading && <Loader2 size={16} className={styles.spin} />}
              <span>{loading ? 'Unlocking…' : 'Unlock PDF'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
