import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'https://money-tracker-api-k0cm.onrender.com',
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('session_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('session_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
