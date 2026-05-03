import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Toast from './components/Toast'
import Dashboard from './pages/Dashboard'
import Companies from './pages/Companies'
import Jobs from './pages/Jobs'
import ResumeBuilder from './pages/ResumeBuilder'
import Tracker from './pages/Tracker'
import InterviewPrep from './pages/InterviewPrep'
import Settings from './pages/Settings'

export default function App() {
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

  return (
    <>
      <Sidebar />
      <main className="main-content">
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
