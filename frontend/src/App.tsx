import { BrowserRouter, Route, Routes, Navigate, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import AdminBookingsPage from './pages/AdminBookingsPage'
import AdminDestinationsPage from './pages/AdminDestinationsPage'
import AdminSellersPage from './pages/AdminSellersPage'
import DestinationPage from './pages/DestinationPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import NotFoundPage from './pages/NotFoundPage'
import ServicesPage from './pages/ServicesPage'
import { useAuth } from './contexts/AuthContext'

function RefHandler() {
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const getCaseInsensitive = (params: URLSearchParams, key: string) => {
      const target = key.toLowerCase()
      for (const [k, v] of params.entries()) {
        if (k.toLowerCase() === target) return v
      }
      return null
    }

    const parseFromHash = () => {
      const hash = window.location.hash || ''
      const idx = hash.indexOf('?')
      if (idx === -1) return null
      const query = hash.slice(idx + 1)
      if (!query) return null
      const params = new URLSearchParams(query)
      return getCaseInsensitive(params, 'ref') ?? getCaseInsensitive(params, 'sellerId') ?? getCaseInsensitive(params, 'refId')
    }

    const raw =
      getCaseInsensitive(searchParams, 'ref') ??
      getCaseInsensitive(searchParams, 'sellerId') ??
      getCaseInsensitive(searchParams, 'refId') ??
      parseFromHash()

    const normalized = raw?.trim()
    if (!normalized) return

    const asNumber = Number(normalized)
    if (!Number.isFinite(asNumber) || !Number.isInteger(asNumber) || asNumber <= 0) return

    try {
      localStorage.setItem('refId', String(asNumber))
    } catch {
      try {
        sessionStorage.setItem('refId', String(asNumber))
      } catch {
        return
      }
    }
  }, [searchParams])
  return null
}

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode, requiredRole?: string }) {
  const { isAuthenticated, user } = useAuth()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <RefHandler />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/destinations/:id" element={<DestinationPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Admin routes */}
          <Route path="/admin/destinations" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminDestinationsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/sellers" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminSellersPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/bookings" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminBookingsPage />
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
