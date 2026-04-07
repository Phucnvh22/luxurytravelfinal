import { BrowserRouter, Route, Routes, Navigate, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import AdminBookingsPage from './pages/AdminBookingsPage'
import AdminDestinationsPage from './pages/AdminDestinationsPage'
import AdminExperienceRequestsPage from './pages/AdminExperienceRequestsPage'
import AdminServiceRequestsPage from './pages/AdminServiceRequestsPage'
import AdminServicesPage from './pages/AdminServicesPage'
import AdminSellersPage from './pages/AdminSellersPage'
import DestinationPage from './pages/DestinationPage'
import ExperienceCrudPage from './pages/ExperienceCrudPage'
import ExperienceDetailPage from './pages/ExperienceDetailPage'
import ExperiencesPage from './pages/ExperiencesPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import NotFoundPage from './pages/NotFoundPage'
import SellerBookingsPage from './pages/SellerBookingsPage'
import SellerExperienceRequestsPage from './pages/SellerExperienceRequestsPage'
import SellerServiceRequestsPage from './pages/SellerServiceRequestsPage'
import ServiceDetailPage from './pages/ServiceDetailPage'
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

function ProtectedRoute({
  children,
  requiredRole,
  requiredRoles,
}: {
  children: React.ReactNode
  requiredRole?: string
  requiredRoles?: string[]
}) {
  const { isAuthenticated, user } = useAuth()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const roles = requiredRoles ?? (requiredRole ? [requiredRole] : undefined)
  if (roles && !roles.includes(user?.role ?? '')) {
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
          <Route path="/experiences" element={<ExperiencesPage />} />
          <Route path="/experiences/:id" element={<ExperienceDetailPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/services/:id" element={<ServiceDetailPage />} />
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
          <Route path="/admin/services" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminServicesPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/experiences" element={
            <ProtectedRoute requiredRole="ADMIN">
              <ExperienceCrudPage scope="admin" />
            </ProtectedRoute>
          } />
          <Route path="/admin/service-requests" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminServiceRequestsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/experience-requests" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminExperienceRequestsPage />
            </ProtectedRoute>
          } />

          {/* Seller routes */}
          <Route path="/seller/bookings" element={
            <ProtectedRoute requiredRoles={['ADMIN', 'SELLER']}>
              <SellerBookingsPage />
            </ProtectedRoute>
          } />
          <Route path="/seller/service-requests" element={
            <ProtectedRoute requiredRoles={['ADMIN', 'SELLER']}>
              <SellerServiceRequestsPage />
            </ProtectedRoute>
          } />
          <Route path="/seller/experience-requests" element={
            <ProtectedRoute requiredRoles={['ADMIN', 'SELLER']}>
              <SellerExperienceRequestsPage />
            </ProtectedRoute>
          } />
          <Route path="/seller/experiences" element={
            <ProtectedRoute requiredRoles={['ADMIN', 'SELLER']}>
              <ExperienceCrudPage scope="seller" />
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
