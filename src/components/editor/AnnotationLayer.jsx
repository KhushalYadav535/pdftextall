import React, { useRef, useState, useEffect } from 'react'
import { Trash2, Check, X, Move } from 'lucide-react'
import { usePdfStore } from '../../store/pdfStore.js'
import styles from './AnnotationLayer.module.css'

export default function AnnotationLayer({ pageNum, pageSize, activeTool, pageBg = '#ffffff' }) {
  const {
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    editLayers,
    zoom,
    selectedElement,
    setSelectedElement,
  } = usePdfStore()

  const svgRef = useRef(null)
  const [drawing, setDrawing] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  const isDrawable = ['highlight', 'redact', 'whiteout', 'shape', 'rect', 'ellipse', 'draw'].includes(activeTool)
  const isClickStamp = ['check', 'cross'].includes(activeTool)

  const getPos = (e) => {
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    }
  }

  const handleMouseDown = (e) => {
    // If clicking on an existing interactive element handle, let that handle it
    if (e.target.closest('[data-interactive="true"]')) return

    const pos = getPos(e)

    if (isClickStamp) {
      // Stamp checkmark or crossmark
      addAnnotation(pageNum, {
        id: `ann-${Date.now()}`,
        type: activeTool,
        x: Math.round(pos.x - 12),
        y: Math.round(pos.y - 12),
        width: 26,
        height: 26,
        color: activeTool === 'check' ? '#10b981' : '#ef4444',
      })
      return
    }

    if (!isDrawable) return
    setDrawing({ startX: pos.x, startY: pos.y, x: pos.x, y: pos.y, w: 0, h: 0 })
  }

  const handleMouseMove = (e) => {
    if (!drawing) return
    const pos = getPos(e)
    setDrawing((d) => ({
      ...d,
      x: Math.min(pos.x, d.startX),
      y: Math.min(pos.y, d.startY),
      w: Math.abs(pos.x - d.startX),
      h: Math.abs(pos.y - d.startY),
    }))
  }

  const handleMouseUp = () => {
    if (!drawing || drawing.w < 3 || drawing.h < 3) {
      setDrawing(null)
      return
    }

    let type = activeTool
    if (type === 'shape') type = 'rect'
    if (type === 'draw') type = 'rect'

    addAnnotation(pageNum, {
      id: `ann-${Date.now()}`,
      type,
      x: Math.round(drawing.x),
      y: Math.round(drawing.y),
      width: Math.round(drawing.w),
      height: Math.round(drawing.h),
      color:
        type === 'highlight'
          ? '#fbbf24'
          : type === 'whiteout'
          ? pageBg || '#ffffff'
          : type === 'redact'
          ? '#000000'
          : '#10b981',
    })
    setDrawing(null)
  }

  // Dragging interactive annotations (Images, Signs, Stamps)
  const startDrag = (e, ann) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedElement(ann, pageNum)
    setDraggingId(ann.id)
    dragOffsetRef.current = {
      x: e.clientX / zoom - ann.x,
      y: e.clientY / zoom - ann.y,
    }
  }

  useEffect(() => {
    if (!draggingId) return
    const onMove = (e) => {
      const newX = e.clientX / zoom - dragOffsetRef.current.x
      const newY = e.clientY / zoom - dragOffsetRef.current.y
      updateAnnotation(pageNum, draggingId, { x: Math.round(newX), y: Math.round(newY) })
    }
    const onUp = () => setDraggingId(null)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draggingId, zoom, pageNum, updateAnnotation])

  const annotations = editLayers[pageNum]?.annotations || []

  const fillMap = {
    highlight: 'rgba(251, 191, 36, 0.35)',
    redact: '#000000',
    whiteout: pageBg || '#ffffff',
    rect: 'rgba(16, 185, 129, 0.08)',
    ellipse: 'rgba(16, 185, 129, 0.08)',
  }

  const strokeMap = {
    highlight: 'rgba(251, 191, 36, 0.6)',
    redact: 'transparent',
    whiteout: 'transparent',
    rect: '#10b981',
    ellipse: '#10b981',
  }

  return (
    <div
      className={styles.layerContainer}
      style={{ width: pageSize.width, height: pageSize.height }}
    >
      {/* SVG for vector shapes and drawings */}
      <svg
        ref={svgRef}
        className={`${styles.svg} ${isDrawable || isClickStamp ? styles.drawable : ''}`}
        width={pageSize.width}
        height={pageSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {annotations
          .filter(a => ['highlight', 'redact', 'whiteout', 'rect', 'ellipse'].includes(a.type))
          .map((ann) => {
            if (ann.type === 'ellipse') {
              return (
                <ellipse
                  key={ann.id}
                  cx={ann.x + ann.width / 2}
                  cy={ann.y + ann.height / 2}
                  rx={ann.width / 2}
                  ry={ann.height / 2}
                  fill={fillMap.ellipse}
                  stroke={ann.color || strokeMap.ellipse}
                  strokeWidth={2}
                />
              )
            }
            return (
              <rect
                key={ann.id}
                x={ann.x}
                y={ann.y}
                width={ann.width}
                height={ann.height}
                fill={fillMap[ann.type] || 'rgba(16,185,129,0.1)'}
                stroke={ann.type === 'whiteout' || ann.type === 'redact' ? 'transparent' : strokeMap[ann.type] || '#10b981'}
                strokeWidth={ann.type === 'redact' || ann.type === 'whiteout' ? 0 : 2}
                rx={ann.type === 'rect' ? 2 : 0}
              />
            )
          })}

        {/* Live drawing preview */}
        {drawing && (
          <rect
            x={drawing.x}
            y={drawing.y}
            width={drawing.w}
            height={drawing.h}
            fill={
              activeTool === 'highlight'
                ? 'rgba(251,191,36,0.3)'
                : activeTool === 'whiteout'
                ? pageBg || '#ffffff'
                : activeTool === 'redact'
                ? 'rgba(0,0,0,0.85)'
                : 'rgba(16,185,129,0.1)'
            }
            stroke={
              activeTool === 'highlight'
                ? '#fbbf24'
                : activeTool === 'whiteout'
                ? '#cbd5e1'
                : activeTool === 'redact'
                ? '#000000'
                : '#10b981'
            }
            strokeWidth={1.5}
            strokeDasharray={activeTool === 'shape' || activeTool === 'rect' ? '4 2' : 'none'}
            rx={2}
          />
        )}
      </svg>

      {/* HTML overlay elements: Signatures, Images, Checkmarks, Crosses */}
      {annotations.map((ann) => {
        const isSelected = selectedElement?.id === ann.id

        if (ann.type === 'sign' || ann.type === 'image') {
          return (
            <div
              key={ann.id}
              data-interactive="true"
              className={`${styles.interactiveItem} ${isSelected ? styles.selected : ''}`}
              style={{
                left: ann.x,
                top: ann.y,
                width: ann.width,
                height: ann.height,
              }}
              onMouseDown={(e) => startDrag(e, ann)}
            >
              <img
                src={ann.dataUrl}
                alt={ann.type}
                style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
              />
              {isSelected && (
                <div className={styles.itemControls}>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAnnotation(pageNum, ann.id)
                    }}
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          )
        }

        if (ann.type === 'check' || ann.type === 'cross') {
          return (
            <div
              key={ann.id}
              data-interactive="true"
              className={`${styles.stampItem} ${isSelected ? styles.selected : ''}`}
              style={{
                left: ann.x,
                top: ann.y,
                width: ann.width,
                height: ann.height,
              }}
              onMouseDown={(e) => startDrag(e, ann)}
            >
              {ann.type === 'check' ? (
                <Check size={24} color={ann.color || '#10b981'} strokeWidth={3} />
              ) : (
                <X size={24} color={ann.color || '#ef4444'} strokeWidth={3} />
              )}
              {isSelected && (
                <button
                  className={styles.deleteStampBtn}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeAnnotation(pageNum, ann.id)
                  }}
                  title="Delete"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          )
        }

        return null
      })}
    </div>
  )
}
