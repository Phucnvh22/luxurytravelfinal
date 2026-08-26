import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { AuthResponse } from '../types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

function resolveBackendBaseUrl() {
  if (API_BASE) return API_BASE
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `${window.location.protocol}//${window.location.hostname}:8080`
  }
  return window.location.origin
}

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const redirectTo = searchParams.get('redirect') || '/'

  const hardRedirectAfterLogin = (path: string) => {
    window.location.replace(path)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const data = await apiFetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      login(data)
      const nextPath = data.role === 'CLEANER' ? '/cleaner' : data.role === 'MAINTENANCE' ? '/maintenance' : redirectTo
      hardRedirectAfterLogin(nextPath)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Login failed. Please check your username and password.')
      } else {
        setError('Login failed. Please check your username and password.')
      }
    } finally {
      setLoading(false)
    }
  }

  const redirectOAuth = (provider: 'google') => {
    sessionStorage.setItem('postLoginRedirect', redirectTo)
    window.location.href = `${resolveBackendBaseUrl()}/oauth2/authorization/${provider}`
  }

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: '400px' }}>
        <div className="card" style={{ padding: '32px' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Log in</h2>
          
          {error && <div className="card error" style={{ marginBottom: '16px' }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label className="field">
              <div className="field-label">Username</div>
              <input
                type="text"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>

            <label className="field">
              <div className="field-label">Password</div>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            <button type="submit" className="btn primary" disabled={loading} style={{ width: '100%', marginTop: '8px' }}>
              {loading ? 'Processing...' : 'Log in'}
            </button>
          </form>

          <div style={{ marginTop: '16px', display: 'grid', gap: '10px' }}>
            <button
              type="button"
              className="btn"
              onClick={() => redirectOAuth('google')}
              style={{ width: '100%' }}
            >
              Continue with Google
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px' }}>
            Don't have an account? <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign up</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
