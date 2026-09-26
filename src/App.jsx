import React, { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Landing from './pages/Landing.jsx'
import Editor from './pages/Editor.jsx'
import Tools from './pages/Tools.jsx'
import CommandPalette from './components/ui/CommandPalette.jsx'
import { usePdfStore } from './store/pdfStore.js'

export default function App() {
  // Apply persisted theme before first paint + Ctrl+J quick toggle
  useEffect(() => {
    const theme = usePdfStore.getState().theme
    document.documentElement.dataset.theme = theme
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        usePdfStore.getState().toggleTheme()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/tools/:toolId" element={<Tools />} />
      </Routes>
      <CommandPalette />
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#1e1e22',
            color: '#f0f0f4',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            borderRadius: '8px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#1e1e22' } },
          error:   { iconTheme: { primary: '#e84545', secondary: '#1e1e22' } },
        }}
      />
    </>
  )
}
