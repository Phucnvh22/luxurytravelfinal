import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { createPortal } from 'react-dom'
import TopNav from './TopNav'
import BottomNav from './BottomNav'
import { useAuth } from '../contexts/AuthContext'
import './layout.css'

export default function Layout() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth()
  const isSeller = user?.role === 'SELLER'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [copyOpen, setCopyOpen] = useState(false)
  const [copyValue, setCopyValue] = useState('')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copyInputRef = useRef<HTMLInputElement | null>(null)

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

  // Only show header on mobile if user is admin or seller
  const showHeaderOnMobile = isAdmin || isSeller
  const headerClass = `app-header ${!showHeaderOnMobile ? 'hide-on-mobile' : ''}`

  return (
    <div className="app-shell">
      <TopNav />
      <header className={headerClass}>
        <div className="container header-inner">
          <Link to="/" className="brand" onClick={closeMenu}>
            Luxury Travel
          </Link>
          
          {showHeaderOnMobile && (
            <button className="hamburger-btn" onClick={toggleMenu}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          )}

          <nav className={`nav ${mobileMenuOpen ? 'mobile-open' : ''}`}>
            <NavLink
              to="/"
              className={({ isActive }) => `nav-main-link ${isActive ? 'active' : ''}`}
              end
              onClick={closeMenu}
            >
              Accommodations
            </NavLink>
            {isAdmin && (
              <>
                <NavLink
                  to="/admin/destinations"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                  onClick={closeMenu}
                >
                  Admin Destinations
                </NavLink>
                <NavLink
                  to="/admin/sellers"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                  onClick={closeMenu}
                >
                  Sellers
                </NavLink>
              </>
            )}
            {isAuthenticated && (
              <NavLink
                to="/admin/bookings"
                className={({ isActive }) => (isActive ? 'active' : undefined)}
                onClick={closeMenu}
              >
                Requests
              </NavLink>
            )}
            <div className="auth-section">
              {isAuthenticated ? (
                <div className="user-menu" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isSeller && (
                    <button 
                      className="btn" 
                      style={{ padding: '6px 12px', fontSize: '13px', borderColor: 'var(--primary-dark)', color: 'var(--primary-dark)' }}
                      onClick={() => {
                        openReferralDialog()
                        closeMenu()
                      }}
                    >
                      Copy referral link
                    </button>
                  )}
                  <span className="user-name" style={{ fontSize: '14px' }}>Hi, {user?.fullName}</span>
                  <button onClick={() => { logout(); closeMenu(); }} className="btn" style={{ padding: '6px 12px', fontSize: '13px' }}>
                    Log out
                  </button>
                </div>
              ) : (
                <NavLink
                  to="/login"
                  className={({ isActive }) => (isActive ? 'active' : undefined)}
                  onClick={closeMenu}
                >
                  Log in
                </NavLink>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <div className="container footer-inner">
          <div>© {new Date().getFullYear()} Luxury Travel</div>
          <div className="muted">Built with Spring Boot + React</div>
        </div>
      </footer>

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
      <BottomNav />
    </div>
  )
}
