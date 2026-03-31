import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { AuthResponse } from '../types'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

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
      navigate('/')
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

          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px' }}>
            Don't have an account? <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign up</Link>
          </div>
        </div>
      </div>
    </div>
  )
}