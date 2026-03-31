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
import { useAuth } from './contexts/AuthContext'

function RefHandler() {
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      localStorage.setItem('refId', ref)
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
            <ProtectedRoute>
              <AdminBookingsPage />
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
