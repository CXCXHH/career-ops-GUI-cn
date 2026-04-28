import { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Toast from './components/Toast'
import Dashboard from './pages/Dashboard'
import Companies from './pages/Companies'
import Discovery from './pages/Discovery'
import Jobs from './pages/Jobs'
import ResumeBuilder from './pages/ResumeBuilder'
import Tracker from './pages/Tracker'
import InterviewPrep from './pages/InterviewPrep'
import Followups from './pages/Followups'
import Candidates from './pages/Candidates'
import Settings from './pages/Settings'
import Onboarding from './pages/Onboarding'

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

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard onToast={showToast} />} />
          <Route path="/companies" element={<Companies onToast={showToast} />} />
          <Route path="/discovery" element={<Discovery onToast={showToast} />} />
          <Route path="/jobs" element={<Jobs onToast={showToast} />} />
          <Route path="/resume" element={<ResumeBuilder onToast={showToast} />} />
          <Route path="/tracker" element={<Tracker onToast={showToast} />} />
          <Route path="/interview" element={<InterviewPrep onToast={showToast} />} />
          <Route path="/interview-prep" element={<InterviewPrep onToast={showToast} />} />
          <Route path="/followups" element={<Followups onToast={showToast} />} />
          <Route path="/candidates" element={<Candidates onToast={showToast} />} />
          <Route path="/onboarding" element={<Onboarding onToast={showToast} />} />
          <Route path="/settings" element={<Settings onToast={showToast} />} />
        </Routes>
      </main>
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
    </>
  )
}
