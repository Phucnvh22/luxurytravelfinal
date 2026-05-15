import { NavLink } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'
import { NAV_ITEMS, type NavKey } from '../constants/navigation'
import './topnav.css'

export default function TopNav() {
  const { t } = useI18n()
  const navLabelByKey: Record<NavKey, string> = {
    accommodation: t('mobile_accommodation', 'Accommodation'),
    experience: t('nav_experiences', 'Experiences'),
    service: t('nav_services', 'Services'),
  }

  return (
    <div className="top-nav-mobile">
      <div className="top-nav-categories">
        {NAV_ITEMS.map((c) => {
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
              </div>
              <span className="category-name">{navLabelByKey[c.key]}</span>
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}
