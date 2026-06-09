import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Verify from './pages/Verify'
import Dashboard from './pages/Dashboard'
import UpdateBalances from './pages/UpdateBalances'
import Income from './pages/Income'
import Accounts from './pages/Accounts'

function Guard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/verify" element={<Verify />} />
          <Route path="/" element={<Guard><Layout /></Guard>}>
            <Route index element={<Dashboard />} />
            <Route path="update" element={<UpdateBalances />} />
            <Route path="income" element={<Income />} />
            <Route path="accounts" element={<Accounts />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
