import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthResponse } from '../types'
import { apiFetch, HttpError } from '../lib/api'

interface AuthContextType {
  user: AuthResponse | null
  login: (data: AuthResponse) => void
  logout: () => void
  isAuthenticated: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthResponse | null>(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('customerPreview') === '1') {
      return null
    }

    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        return JSON.parse(storedUser)
      } catch (e) {
        console.error('Failed to parse user from local storage', e)
        localStorage.removeItem('user')
      }
    }
    return null
  })

  const login = useCallback((data: AuthResponse) => {
    setUser(data)
    localStorage.setItem('user', JSON.stringify(data))
    localStorage.setItem('token', data.token)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }, [])

  useEffect(() => {
    if (!user) {
      return
    }

    let active = true

    const redirectToLogin = () => {
      if (!active) return
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        sessionStorage.setItem('postLoginRedirect', currentPath)
        window.location.replace('/login')
      }
    }

    const handleSessionInvalid = () => {
      if (!active) return
      logout()
      redirectToLogin()
    }

    const verifySession = async () => {
      try {
        await apiFetch<void>('/api/auth/session')
      } catch (error) {
        if (error instanceof HttpError && error.status === 401) {
          handleSessionInvalid()
        }
      }
    }

    const handleAuthInvalid = () => {
      handleSessionInvalid()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void verifySession()
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'token' && !event.newValue) {
        handleSessionInvalid()
      }
    }

    window.addEventListener('luxurytravel:auth-invalid', handleAuthInvalid)
    window.addEventListener('focus', handleVisibilityChange)
    window.addEventListener('storage', handleStorage)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const intervalId = window.setInterval(() => {
      void verifySession()
    }, 15000)

    void verifySession()

    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('luxurytravel:auth-invalid', handleAuthInvalid)
      window.removeEventListener('focus', handleVisibilityChange)
      window.removeEventListener('storage', handleStorage)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [logout, user])

  const value = useMemo(() => ({
    user,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
  }), [login, logout, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
