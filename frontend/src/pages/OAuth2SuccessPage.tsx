import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { AuthResponse } from '../types'

export default function OAuth2SuccessPage() {
  const [params] = useSearchParams()
  const { login } = useAuth()
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const token = params.get('token')
    const id = Number(params.get('id'))
    const username = params.get('username') || ''
    const email = params.get('email') || ''
    const fullName = params.get('fullName') || username
    const role = params.get('role') as 'ADMIN' | 'CLEANER' | 'MAINTENANCE' | 'SELLER' | 'USER' | null
    if (!token || !Number.isFinite(id) || !username || !role) {
      window.location.replace('/login')
      return
    }

    const auth: AuthResponse = {
      token,
      id,
      username,
      email,
      fullName,
      role,
    }
    login(auth)
    const redirectTo =
      role === 'CLEANER'
        ? '/cleaner'
        : role === 'ADMIN'
            ? (sessionStorage.getItem('postLoginRedirect') || '/') === '/'
              ? '/admin'
              : (sessionStorage.getItem('postLoginRedirect') || '/')
            : sessionStorage.getItem('postLoginRedirect') || '/'
    sessionStorage.removeItem('postLoginRedirect')
    // Force a full reload so auth-dependent data refetches reliably after OAuth callback.
    window.location.replace(redirectTo)
  }, [login, params])

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 420 }}>
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          Logging in...
        </div>
      </div>
    </div>
  )
}
