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

type WhatsappOtpResponse = {
  sent: boolean
  message: string
}

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpStep, setOtpStep] = useState<'input' | 'verify'>('input')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [fullName, setFullName] = useState('')
  const [otp, setOtp] = useState('')
  const [otpHint, setOtpHint] = useState<string | null>(null)
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
      hardRedirectAfterLogin(redirectTo)
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

  const requestWhatsappOtp = async () => {
    setError(null)
    setOtpLoading(true)
    try {
      const result = await apiFetch<WhatsappOtpResponse>('/api/auth/whatsapp/request-otp', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber,
          fullName,
        }),
      })
      setOtpStep('verify')
      setOtpHint(result.message)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Request OTP failed.')
      } else {
        setError('Request OTP failed.')
      }
    } finally {
      setOtpLoading(false)
    }
  }

  const verifyWhatsappOtp = async () => {
    setError(null)
    setOtpLoading(true)
    try {
      const data = await apiFetch<AuthResponse>('/api/auth/whatsapp/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber,
          fullName,
          otp,
        }),
      })
      login(data)
      hardRedirectAfterLogin(redirectTo)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Verify OTP failed.')
      } else {
        setError('Verify OTP failed.')
      }
    } finally {
      setOtpLoading(false)
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

          <div style={{ marginTop: '16px', display: 'grid', gap: '10px' }}>
            <div className="field-label">WhatsApp OTP</div>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
            />
            <input
              className="input"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+84901234567"
            />
            {otpStep === 'verify' ? (
              <input
                className="input"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit OTP"
              />
            ) : null}
            {otpHint ? <div className="muted" style={{ fontSize: 12 }}>{otpHint}</div> : null}
            <button
              type="button"
              className="btn"
              onClick={() => void (otpStep === 'input' ? requestWhatsappOtp() : verifyWhatsappOtp())}
              disabled={otpLoading}
              style={{ width: '100%' }}
            >
              {otpLoading ? 'Processing...' : otpStep === 'input' ? 'Send OTP on WhatsApp' : 'Verify OTP & Login'}
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
