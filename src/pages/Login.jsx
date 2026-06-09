import { useState } from 'react'
import api from '../api'
import s from './Login.module.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/request', { email })
      setSent(true)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <div className={s.logo}>money</div>
        {sent ? (
          <div className={s.sent}>
            <div className={s.sentIcon}>✉</div>
            <p>Check your email</p>
            <p className={s.sub}>Magic link sent to <strong>{email}</strong>.<br />Expires in 15 minutes.</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className={s.sub}>Enter your email to sign in</p>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className={s.input}
            />
            {error && <p className={s.error}>{error}</p>}
            <button type="submit" className={s.btn} disabled={loading}>
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
