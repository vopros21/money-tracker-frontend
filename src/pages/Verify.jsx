import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'

export default function Verify() {
  const [status, setStatus] = useState('Verifying…')
  const navigate = useNavigate()
  const { setUser } = useAuth()

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) { setStatus('Invalid link.'); return }

    api.post('/auth/verify', { token })
      .then(r => {
        localStorage.setItem('session_token', r.data.session_token)
        setUser({ email: r.data.email })
        navigate('/', { replace: true })
      })
      .catch(() => setStatus('Link expired or already used. Request a new one.'))
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text2)', fontSize: 14 }}>{status}</p>
    </div>
  )
}
