import { NavLink } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'
import './topnav.css'

export default function TopNav() {
  const { t } = useI18n()
  const accommodationIconUrl = encodeURI('/—Pngtree—warm family cartoon house_6261753.png')
  const serviceIconUrl = encodeURI('/—Pngtree—classic metallic desk bell with_21118389.png')
  const experienceIconUrl = encodeURI('/—Pngtree—a colorful hot air balloon_16332123.png')
  const staticCategories = [
    {
      id: 1,
      name: t('mobile_accommodation', 'Accommodation'),
      iconUrl: accommodationIconUrl,
      newFeature: false,
      to: '/',
    },
    {
      id: 2,
      name: t('nav_experiences', 'Experiences'),
      iconUrl: experienceIconUrl,
      newFeature: true,
      to: '/experiences',
    },
    {
      id: 3,
      name: t('nav_services', 'Services'),
      iconUrl: serviceIconUrl,
      newFeature: true,
      to: '/services',
    },
  ]

  return (
    <div className="top-nav-mobile">
      <div className="top-nav-categories">
        {staticCategories.map((c) => {
          return (
            <NavLink
              key={c.id}
              to={c.to}
              className={({ isActive }) => `category-item ${isActive ? 'active' : ''}`}
              aria-label={c.name}
              end={c.to === '/'}
            >
              <div className="category-icon-wrapper">
                <img
                  src={c.iconUrl}
                  alt={c.name}
                  className={`category-icon ${c.id === 1 ? 'category-icon--accommodation' : ''} ${c.id === 2 ? 'category-icon--experience' : ''} ${c.id === 3 ? 'category-icon--service' : ''}`}
                />
              </div>
              <span className="category-name">{c.name}</span>
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}
