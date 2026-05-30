import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'
import { NAV_ITEMS, type NavKey } from '../constants/navigation'
import { getFeaturedNavKeys, toggleFeaturedNavKey } from '../lib/featuredItems'
import { useState } from 'react'
import './topnav.css'

export default function TopNav() {
  const { t } = useI18n()
  const { isAdmin } = useAuth()
  const [featuredKeys, setFeaturedKeys] = useState<NavKey[]>(() => getFeaturedNavKeys())

  const handleToggleFeatured = (key: NavKey, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const updated = toggleFeaturedNavKey(key)
    setFeaturedKeys(updated)
  }

  const navLabelByKey: Record<NavKey, string> = {
    accommodation: t('mobile_accommodation', 'Accommodation'),
    experience: t('nav_experiences', 'Experiences'),
    service: t('nav_services', 'Services'),
  }

  return (
    <div className="top-nav-mobile">
      <div className="top-nav-categories">
        {NAV_ITEMS.map((c) => {
          const isFeatured = featuredKeys.includes(c.key)
          return (
            <NavLink
              key={c.id}
              to={c.to}
              className={({ isActive }) => `category-item ${isActive ? 'active' : ''}`}
              aria-label={navLabelByKey[c.key]}
              end={c.to === '/'}
            >
              <div className="category-icon-wrapper">
                <img
                  src={c.iconUrl}
                  alt={navLabelByKey[c.key]}
                  className={`category-icon ${c.key === 'accommodation' ? 'category-icon--accommodation' : ''} ${c.key === 'experience' ? 'category-icon--experience' : ''} ${c.key === 'service' ? 'category-icon--service' : ''}`}
                />
                {isAdmin && (
                  <button
                    type="button"
                    className={`heart-btn ${isFeatured ? 'heart-btn--active' : ''}`}
                    onClick={(e) => handleToggleFeatured(c.key, e)}
                    aria-label={isFeatured ? 'Remove from featured' : 'Add to featured'}
                    title={isFeatured ? 'Remove from featured' : 'Add to featured'}
                  >
                    <svg viewBox="0 0 24 24" fill={isFeatured ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                )}
              </div>
              <span className="category-name">{navLabelByKey[c.key]}</span>
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}
