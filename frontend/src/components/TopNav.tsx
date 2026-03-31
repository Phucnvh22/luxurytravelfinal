import './topnav.css'

export default function TopNav() {
  const staticCategories = [
    {
      id: 1,
      name: 'Accommodation',
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/25/25694.png',
      newFeature: false,
      href: '#accommodations',
    },
    {
      id: 2,
      name: 'Experiences',
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/3173/3173067.png',
      newFeature: true,
      href: '#',
    },
    {
      id: 3,
      name: 'Services',
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/6735/6735023.png',
      newFeature: true,
      href: '#',
    },
  ]

  return (
    <div className="top-nav-mobile">
      <div className="top-nav-categories">
        {staticCategories.map((c) => (
          <a key={c.id} className="category-item" href={c.href} aria-label={c.name}>
            <div className="category-icon-wrapper">
              <img src={c.iconUrl} alt={c.name} className="category-icon" />
              {c.newFeature && <span className="badge-new">NEW</span>}
            </div>
            <span className="category-name">{c.name}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
