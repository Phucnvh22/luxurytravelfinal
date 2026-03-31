import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthResponse } from '../types'

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

  const login = (data: AuthResponse) => {
    setUser(data)
    // Save user data and token
    localStorage.setItem('user', JSON.stringify(data))
    localStorage.setItem('token', data.token)
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }

  const value = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
  }

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