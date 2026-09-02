import { BrowserRouter, Route, Routes, Navigate, useSearchParams, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminBookingsPage from './pages/AdminBookingsPage'
import AdminCleanerAssignmentsPage from './pages/AdminCleanerAssignmentsPage'
import AdminDestinationsPage from './pages/AdminDestinationsPage'
import AdminExperienceRequestsPage from './pages/AdminExperienceRequestsPage'
import AdminRoomCleaningHistoryPage from './pages/AdminRoomCleaningHistoryPage'
import AdminRoomBookingsPage from './pages/AdminRoomBookingsPage'
import AdminRoomRepairHistoryPage from './pages/AdminRoomRepairHistoryPage'
import AdminRoomAreasPage from './pages/AdminRoomAreasPage'
import AdminVillaSettingsPage from './pages/AdminVillaSettingsPage'
import AdminVillaServicesPage from './pages/AdminVillaServicesPage'
import AdminRoomsPage from './pages/AdminRoomsPage'
import AdminServiceRequestsPage from './pages/AdminServiceRequestsPage'
import AdminServicesPage from './pages/AdminServicesPage'
import AdminSellersPage from './pages/AdminSellersPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AccountPage from './pages/AccountPage'
import CleanerDashboardPage from './pages/CleanerDashboardPage'
import DestinationPage from './pages/DestinationPage'
import ExperienceCrudPage from './pages/ExperienceCrudPage'
import ExperienceDetailPage from './pages/ExperienceDetailPage'
import ExperiencesPage from './pages/ExperiencesPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import OAuth2SuccessPage from './pages/OAuth2SuccessPage'
import RegisterPage from './pages/RegisterPage'
import NotFoundPage from './pages/NotFoundPage'
import PublicRoomCalendarPage from './pages/PublicRoomCalendarPage'
import SellerBookingsPage from './pages/SellerBookingsPage'
import SellerExperienceRequestsPage from './pages/SellerExperienceRequestsPage'
import SellerServiceRequestsPage from './pages/SellerServiceRequestsPage'
import ServiceDetailPage from './pages/ServiceDetailPage'
import ServicesPage from './pages/ServicesPage'
import MyRequestsPage from './pages/MyRequestsPage'
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
  const location = useLocation()
  
  if (!isAuthenticated) {
    const redirect = `${location.pathname}${location.search}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />
  }

  const roles = requiredRoles ?? (requiredRole ? [requiredRole] : undefined)
  if (roles && !roles.includes(user?.role ?? '')) {
    const fallbackPath = user?.role === 'CLEANER' ? '/cleaner' : '/'
    return <Navigate to={fallbackPath} replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <RefHandler />
      <Routes>
        <Route path="/cleaner" element={
          <ProtectedRoute requiredRole="CLEANER">
            <CleanerDashboardPage />
          </ProtectedRoute>
        } />
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/experiences" element={<ExperiencesPage />} />
          <Route path="/experiences/:id" element={<ExperienceDetailPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/services/:id" element={<ServiceDetailPage />} />
          <Route path="/destinations/:id" element={<DestinationPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/oauth2/success" element={<OAuth2SuccessPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/calendar/:roomCodes" element={<PublicRoomCalendarPage />} />
          <Route path="/me/requests" element={
            <ProtectedRoute>
              <MyRequestsPage />
            </ProtectedRoute>
          } />
          <Route path="/account" element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          } />
          
          {/* Admin routes */}
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminDashboardPage />
            </ProtectedRoute>
          } />
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
          <Route path="/admin/users" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminUsersPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/cleaners" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminCleanerAssignmentsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/bookings" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminBookingsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/room-bookings" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminRoomBookingsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/room-cleaning-history" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminRoomCleaningHistoryPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/room-repair-history" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminRoomRepairHistoryPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/rooms" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminRoomsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/room-areas" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminRoomAreasPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/villa-settings" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminVillaSettingsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/services" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminServicesPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/villa-services" element={
            <ProtectedRoute requiredRole="ADMIN">
              <AdminVillaServicesPage />
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
