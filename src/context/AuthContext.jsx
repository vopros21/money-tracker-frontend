import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('session_token')
    if (!token) { setLoading(false); return }
    api.get('/auth/me')
      .then(r => setUser(r.data.user))
      .catch(() => localStorage.removeItem('session_token'))
      .finally(() => setLoading(false))
  }, [])

  const logout = async () => {
    try { await api.post('/auth/logout') } catch {}
    localStorage.removeItem('session_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
