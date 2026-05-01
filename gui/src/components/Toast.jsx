import { useEffect } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'

export default function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`toast toast-${type}`}>
      {type === 'success' ? <CheckCircle style={{ marginRight: '8px', display: 'inline' }} /> : <XCircle style={{ marginRight: '8px', display: 'inline' }} />}
      {message}
    </div>
  )
}