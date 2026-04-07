import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import TopNav from './TopNav'
import BottomNav from './BottomNav'
import { useAuth } from '../contexts/AuthContext'
import { useI18n, type Lang } from '../contexts/I18nContext'
import { apiFetch } from '../lib/api'
import type { AdminRequestSummary } from '../types'
import './layout.css'

export default function Layout() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth()
  const { t, language, setLanguage } = useI18n()
  const location = useLocation()
  const isSeller = user?.role === 'SELLER'
  const isAdminRoute = location.pathname.startsWith('/admin')
  const accommodationIconUrl = encodeURI('/—Pngtree—warm family cartoon house_6261753.png')
  const experienceIconUrl = encodeURI('/—Pngtree—a colorful hot air balloon_16332123.png')
  const serviceIconUrl = encodeURI('/—Pngtree—classic metallic desk bell with_21118389.png')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [copyOpen, setCopyOpen] = useState(false)
  const [copyValue, setCopyValue] = useState('')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copyInputRef = useRef<HTMLInputElement | null>(null)

  const [requestSummary, setRequestSummary] = useState<AdminRequestSummary | null>(null)
  const [notificationFlash, setNotificationFlash] = useState<{ count: number } | null>(null)

  const toggleMenu = () => setMobileMenuOpen(!mobileMenuOpen)
  const closeMenu = () => setMobileMenuOpen(false)

  const copyText = async (text: string) => {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)

    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)

    if (!ok) throw new Error('Copy failed')
  }

  const openReferralDialog = () => {
    const id = user?.id
    if (!id) {
      setCopyValue('')
      setCopyStatus('failed')
      setCopyOpen(true)
      return
    }
    const link = `${window.location.origin}/?ref=${id}`
    setCopyValue(link)
    setCopyStatus('idle')
    setCopyOpen(true)
  }

  useEffect(() => {
    if (!copyOpen) return
    const el = copyInputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [copyOpen])

  useEffect(() => {
    if (!isAdmin || !isAuthenticated) return
    let cancelled = false

    const poll = async () => {
      try {
        const data = await apiFetch<AdminRequestSummary>('/api/admin/requests/summary')
        if (cancelled) return
        setRequestSummary(data)

        const latestServiceId = data.latestServiceRequestId ?? 0
        const latestExperienceId = data.latestExperienceRequestId ?? 0
        const fingerprint = `${latestServiceId}:${latestExperienceId}`
        const storedFingerprint = localStorage.getItem('adminLatestRequestFingerprint')

        if (!storedFingerprint) {
          localStorage.setItem('adminLatestRequestFingerprint', fingerprint)
          return
        }

        if (fingerprint !== storedFingerprint && data.totalPendingRequests > 0) {
          setNotificationFlash({ count: data.totalPendingRequests })
          localStorage.setItem('adminLatestRequestFingerprint', fingerprint)
        }
      } catch {
        return
      }
    }

    void poll()
    const intervalId = window.setInterval(() => void poll(), 5000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [isAdmin, isAuthenticated])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const showHeaderOnMobile = true
  const headerClass = `app-header ${!showHeaderOnMobile ? 'hide-on-mobile' : ''} ${isAdminRoute ? 'app-header-admin' : ''} ${!isAdminRoute ? 'with-topnav' : ''}`

  return (
    <div className="app-shell">
      <header className={headerClass}>
        <div className="container header-inner">
          <Link to="/" className="brand" onClick={closeMenu}>
            {t('brand', 'Luxury Travel')}
          </Link>

          <div className="header-actions">
            {!isAdminRoute && (
              <nav className="nav nav-main">
                <NavLink
                  to="/"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                  end
                >
                  <img className="nav-main-icon" src={accommodationIconUrl} alt="" aria-hidden="true" />
                  <span>{t('nav_accommodations', 'Accommodations')}</span>
                </NavLink>
                <NavLink
                  to="/experiences"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <img className="nav-main-icon" src={experienceIconUrl} alt="" aria-hidden="true" />
                  <span>{t('nav_experiences', 'Experiences')}</span>
                </NavLink>
                <NavLink
                  to="/services"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                >
                  <img className="nav-main-icon" src={serviceIconUrl} alt="" aria-hidden="true" />
                  <span>{t('nav_services', 'Services')}</span>
                </NavLink>
              </nav>
            )}

            <select
              className="lang-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Lang)}
              aria-label="Language"
            >
              <option value="en">{t('lang_en', 'English')}</option>
              <option value="vi">{t('lang_vi', 'Tiếng Việt')}</option>
              <option value="fr">{t('lang_fr', 'Français')}</option>
              <option value="ko">{t('lang_ko', '한국어')}</option>
              <option value="zh">{t('lang_zh', '中文')}</option>
              <option value="es">{t('lang_es', 'Español')}</option>
            </select>

            <button className="hamburger-btn" type="button" onClick={toggleMenu} aria-label="Open menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
              {isAdmin && (requestSummary?.totalPendingRequests ?? 0) > 0 ? (
                <span className="notif-badge">{requestSummary?.totalPendingRequests}</span>
              ) : null}
            </button>

            {mobileMenuOpen ? <button className="menu-overlay" type="button" aria-label="Close menu" onClick={closeMenu} /> : null}
            <div className={`menu ${mobileMenuOpen ? 'open' : ''}`}>
              {isAdmin && (
                <>
                  <div className="menu-title">{t('menu_admin', 'Admin')}</div>
                  <NavLink
                    to="/admin/destinations"
                    className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    {t('menu_destinations', 'Destinations')}
                  </NavLink>
                  <NavLink
                    to="/admin/services"
                    className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    {t('menu_services', 'Services')}
                  </NavLink>
                  <NavLink
                    to="/admin/experiences"
                    className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    {t('menu_experiences', 'Experiences')}
                  </NavLink>
                  <NavLink
                    to="/admin/sellers"
                    className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    {t('menu_sellers', 'Sellers')}
                  </NavLink>
                  <NavLink
                    to="/admin/bookings"
                    className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    {t('menu_bookings', 'Bookings')}
                  </NavLink>
                  <NavLink
                    to="/admin/service-requests"
                    className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    <span>{t('menu_service_requests', 'Service Requests')}</span>
                    {(requestSummary?.pendingServiceRequests ?? 0) > 0 ? (
                      <span className="menu-item-badge">{requestSummary?.pendingServiceRequests}</span>
                    ) : null}
                  </NavLink>
                  <NavLink
                    to="/admin/experience-requests"
                    className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    <span>{t('menu_experience_requests', 'Experience Requests')}</span>
                    {(requestSummary?.pendingExperienceRequests ?? 0) > 0 ? (
                      <span className="menu-item-badge">{requestSummary?.pendingExperienceRequests}</span>
                    ) : null}
                  </NavLink>
                  <div className="menu-sep" />
                </>
              )}

              {isSeller && (
                <>
                  <div className="menu-title">{t('menu_seller', 'Seller')}</div>
                  <NavLink
                    to="/seller/bookings"
                    className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    {t('menu_my_bookings', 'My bookings')}
                  </NavLink>
                  <NavLink
                    to="/seller/service-requests"
                    className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    {t('menu_my_service_requests', 'My service requests')}
                  </NavLink>
                  <NavLink
                    to="/seller/experience-requests"
                    className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    {t('menu_my_experience_requests', 'My experience requests')}
                  </NavLink>
                  <NavLink
                    to="/seller/experiences"
                    className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    {t('menu_manage_experiences', 'Manage experiences')}
                  </NavLink>
                  <button
                    className="menu-item"
                    type="button"
                    onClick={() => {
                      openReferralDialog()
                      closeMenu()
                    }}
                  >
                    {t('menu_copy_referral', 'Copy referral link')}
                  </button>
                  <div className="menu-sep" />
                </>
              )}

              <div className="menu-title">{t('menu_account', 'Account')}</div>
              {isAuthenticated ? (
                <>
                  <div className="menu-meta">Hi, {user?.fullName}</div>
                  <button
                    className="menu-item"
                    type="button"
                    onClick={() => {
                      logout()
                      closeMenu()
                    }}
                  >
                    {t('menu_logout', 'Log out')}
                  </button>
                </>
              ) : (
                <NavLink
                  to="/login"
                  className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  {t('menu_login', 'Log in')}
                </NavLink>
              )}
            </div>
          </div>
        </div>
      </header>
      {!isAdminRoute && <TopNav />}

      <main className="app-main">
        {isAdminRoute && isAdmin && notificationFlash && location.pathname !== '/admin/bookings' ? (
          <div style={{ background: 'var(--color-primary)', color: '#fff' }}>
            <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0' }}>
              <div style={{ fontWeight: 700 }}>
                {notificationFlash.count === 1 ? 'Có 1 request mới' : `Có ${notificationFlash.count} request mới`}
              </div>
              <div className="row" style={{ gap: 10 }}>
                <Link
                  to="/admin/service-requests"
                  className="btn"
                  style={{ padding: '6px 10px', fontSize: 13, borderColor: '#fff', backgroundColor: '#fff', color: 'var(--color-primary)' }}
                  onClick={() => {
                    setNotificationFlash(null)
                    closeMenu()
                  }}
                >
                  Xem ngay
                </Link>
                <button className="btn" type="button" style={{ padding: '6px 10px', fontSize: 13, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'transparent', color: '#fff' }} onClick={() => setNotificationFlash(null)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <Outlet />
      </main>

      {!isAdminRoute && (
        <footer className="app-footer">
          <div className="container footer-inner">
            <div>© {new Date().getFullYear()} Luxury Travel</div>
            <div className="muted">Built with Spring Boot + React</div>
          </div>
        </footer>
      )}

      {copyOpen
        ? createPortal(
            <div
              className="copy-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Copy referral link"
              onClick={() => setCopyOpen(false)}
            >
              <div className="copy-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="copy-title">Referral link</div>
                <div className="copy-sub muted">
                  {copyValue
                    ? 'Scan the QR code or copy the link below.'
                    : 'Your seller profile is missing an ID. Please log in again.'}
                </div>
                
                {copyValue && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(copyValue)}`} 
                      alt="Referral QR Code" 
                      style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '8px', background: '#fff' }}
                    />
                  </div>
                )}

                <input
                  ref={copyInputRef}
                  className="input"
                  value={copyValue}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                />
                <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {copyStatus === 'copied'
                      ? 'Copied to clipboard.'
                      : copyStatus === 'failed'
                        ? 'Copy blocked. Please copy manually.'
                        : ''}
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={async () => {
                        try {
                          await copyText(copyValue)
                          setCopyStatus('copied')
                        } catch {
                          setCopyStatus('failed')
                          const el = copyInputRef.current
                          if (el) {
                            el.focus()
                            el.select()
                          }
                        }
                      }}
                      disabled={!copyValue}
                    >
                      Copy
                    </button>
                    <button className="btn primary" type="button" onClick={() => setCopyOpen(false)}>
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
      {!isAdminRoute && <BottomNav />}
    </div>
  )
}
