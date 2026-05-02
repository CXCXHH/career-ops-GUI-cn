import { useState, useEffect, Suspense, lazy } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Toast from './components/Toast'
import Dashboard from './pages/Dashboard'
import Companies from './pages/Companies'
import Jobs from './pages/Jobs'
import ResumeBuilder from './pages/ResumeBuilder'
import Tracker from './pages/Tracker'
import InterviewPrep from './pages/InterviewPrep'
import Settings from './pages/Settings'
import './styles/liquid-hero.css'

// Lazy load LiquidMetalHero to avoid SSR issues with Paper.js
const LiquidMetalHero = lazy(() => import('./components/LiquidMetalHero'))

export default function App() {
  const location = useLocation()
  const [toast, setToast] = useState(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setIsReady(true)
  }, [])

  const showToast = (message, type = 'info') => {
    setToast({ message, type })
  }

  const closeToast = () => {
    setToast(null)
  }

  if (!isReady) {
    return <div>Loading...</div>
  }

  const isHomePage = location.pathname === '/'

  return (
    <>
      <Sidebar />
      <main className="main-content">
        {isHomePage && (
          <Suspense fallback={<div style={{ minHeight: '100dvh' }} />}>
            <LiquidMetalHero />
          </Suspense>
        )}
        <Routes>
          <Route path="/" element={<Dashboard onToast={showToast} />} />
          <Route path="/companies" element={<Companies onToast={showToast} />} />
          <Route path="/jobs" element={<Jobs onToast={showToast} />} />
          <Route path="/resume" element={<ResumeBuilder onToast={showToast} />} />
          <Route path="/tracker" element={<Tracker onToast={showToast} />} />
          <Route path="/interview" element={<InterviewPrep onToast={showToast} />} />
          <Route path="/interview-prep" element={<InterviewPrep onToast={showToast} />} />
          <Route path="/settings" element={<Settings onToast={showToast} />} />
        </Routes>
      </main>
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
    </>
  )
}
