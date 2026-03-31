import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { AuthResponse } from '../types'

export default function RegisterPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const data = await apiFetch<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, fullName, email }),
      })
      login(data)
      navigate('/')
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Registration failed. Username might already exist or data is invalid.')
      } else {
        setError('Registration failed. Username might already exist or data is invalid.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: '400px' }}>
        <div className="card" style={{ padding: '32px' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Sign up</h2>
          
          {error && <div className="card error" style={{ marginBottom: '16px' }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label className="field">
              <div className="field-label">Full Name</div>
              <input
                type="text"
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="John Doe"
              />
            </label>

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
              <div className="field-label">Email</div>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
              />
            </label>

            <label className="field">
              <div className="field-label">Password (at least 6 characters)</div>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>

            <button type="submit" className="btn primary" disabled={loading} style={{ width: '100%', marginTop: '8px' }}>
              {loading ? 'Processing...' : 'Sign up'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px' }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Log in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}