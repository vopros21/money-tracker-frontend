import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// GitHub Pages SPA redirect handler
const redirect = sessionStorage.getItem('gh-pages-redirect')
if (redirect) {
  sessionStorage.removeItem('gh-pages-redirect')
  window.history.replaceState(null, '', redirect)
}
