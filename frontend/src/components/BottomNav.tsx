import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'
import './bottomnav.css'

export default function BottomNav() {
  const { isAuthenticated, logout, user, isAdmin } = useAuth()
  const { t } = useI18n()
  const isSeller = user?.role === 'SELLER'

  return (
    <div className="bottom-nav-mobile">
      <NavLink
        to="/"
        end
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="bottom-nav-icon">
          <g fill="none">
            <path d="m13 24c6.0751322 0 11-4.9248678 11-11 0-6.07513225-4.9248678-11-11-11-6.07513225 0-11 4.92486775-11 11 0 6.0751322 4.92486775 11 11 11zm8-3 9 9" stroke="currentcolor" strokeWidth="4"></path>
          </g>
        </svg>
        <span>{t('mobile_accommodation', 'Accommodation')}</span>
      </NavLink>

      {(isAdmin || isSeller) && (
        <NavLink
          to={isAdmin ? '/admin/destinations' : '/seller/bookings'}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="bottom-nav-icon">
            <path d="M6 4h20a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 6h16M10 2v4m12-4v4" fill="none" stroke="currentcolor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
            <path d="M10 15h12M10 20h10" fill="none" stroke="currentcolor" strokeWidth="2" strokeLinecap="round"></path>
          </svg>
          <span>{isAdmin ? t('mobile_admin', 'Admin') : t('mobile_requests', 'Requests')}</span>
        </NavLink>
      )}

      {isAuthenticated ? (
        <div className="bottom-nav-item" onClick={logout} style={{ cursor: 'pointer' }}>
          <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="bottom-nav-icon">
            <path d="M16 2a14 14 0 1 0 14 14A14.016 14.016 0 0 0 16 2Zm0 26a12 12 0 1 1 12-12 12.014 12.014 0 0 1-12 12Z" fill="currentcolor"></path>
            <path d="M21.707 15.293a1 1 0 0 0-1.414 0L17 18.586V8a1 1 0 0 0-2 0v10.586l-3.293-3.293a1 1 0 0 0-1.414 1.414l5 5a1 1 0 0 0 1.414 0l5-5a1 1 0 0 0 0-1.414Z" fill="currentcolor"></path>
          </svg>
          <span>{t('menu_logout', 'Log out')}</span>
        </div>
      ) : (
        <NavLink to="/login" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}` }>
          <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="bottom-nav-icon">
            <path d="m16 .7c-8.437 0-15.3 6.863-15.3 15.3s6.863 15.3 15.3 15.3 15.3-6.863 15.3-15.3-6.863-15.3-15.3-15.3zm0 28c-4.021 0-7.605-1.884-9.833-4.81l2.454-2.455c1.47-1.47 3.525-2.335 5.603-2.335h3.552c2.078 0 4.133.865 5.603 2.335l2.454 2.455c-2.228 2.926-5.812 4.81-9.833 4.81zm11.83-6.791-2.348-2.348c-1.996-1.996-4.786-3.161-7.608-3.161h-3.552c-2.822 0-5.612 1.165-7.608 3.161l-2.348 2.348c-2.502-3.109-3.954-7.01-3.954-11.209 0-7.335 5.965-13.3 13.3-13.3s13.3 5.965 13.3 13.3c0 4.199-1.452 8.1-3.954 11.209zm-11.83-20.009c-3.584 0-6.5 2.916-6.5 6.5s2.916 6.5 6.5 6.5 6.5-2.916 6.5-6.5-2.916-6.5-6.5-6.5zm0 11c-2.481 0-4.5-2.019-4.5-4.5s2.019-4.5 4.5-4.5 4.5 2.019 4.5 4.5-2.019 4.5-4.5 4.5z" fill="currentcolor"></path>
          </svg>
          <span>{t('menu_login', 'Log in')}</span>
        </NavLink>
      )}
    </div>
  )
}
