import { Link, NavLink } from 'react-router-dom'
import type { AdminRequestSummary } from '../types'
import { buildAdminModules } from './adminModules'
import './admin-sidebar.css'

type Props = {
  requestSummary: AdminRequestSummary | null
  collapsed: boolean
  onToggle: () => void
  mobileOpen?: boolean
  onNavigate?: () => void
  onCloseMobile?: () => void
}

function SidebarIcon({ label }: { label: string }) {
  const sharedProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (label) {
    case 'Overview':
      return (
        <svg {...sharedProps}>
          <path d="M4 19h16" />
          <path d="M6 16V9" />
          <path d="M12 16V5" />
          <path d="M18 16v-3" />
        </svg>
      )
    case 'Villa schedule':
      return (
        <svg {...sharedProps}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      )
    case 'Cleaning history':
      return (
        <svg {...sharedProps}>
          <path d="M6 20h8" />
          <path d="M9 20V8l5-4 1 2-2 2v12" />
          <path d="M7 8h8" />
        </svg>
      )
    case 'Repair history':
      return (
        <svg {...sharedProps}>
          <path d="M14 6a4 4 0 0 0 4 4l-6 6a2 2 0 1 1-3-3l6-6a4 4 0 0 0 4-4" />
        </svg>
      )
    case 'Villas':
      return (
        <svg {...sharedProps}>
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </svg>
      )
    case 'Villa areas':
      return (
        <svg {...sharedProps}>
          <path d="M4 18h16" />
          <path d="M7 18v-6l5-3 5 3v6" />
          <path d="M12 9V5" />
        </svg>
      )
    case 'Villa settings':
      return (
        <svg {...sharedProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" />
        </svg>
      )
    case 'Villa services':
      return (
        <svg {...sharedProps}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="M8 10h8M8 14h4" />
          <path d="M17 4v4M15 6h4" />
        </svg>
      )
    case 'Direct bookings':
      return (
        <svg {...sharedProps}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="M8 10h8M8 14h5" />
        </svg>
      )
    case 'Service requests':
      return (
        <svg {...sharedProps}>
          <path d="M5 12h14" />
          <path d="M7 8h10" />
          <path d="M9 16h6" />
        </svg>
      )
    case 'Experience requests':
      return (
        <svg {...sharedProps}>
          <circle cx="12" cy="12" r="7" />
          <path d="M12 9v3l2 2" />
        </svg>
      )
    case 'Destinations':
      return (
        <svg {...sharedProps}>
          <path d="M12 20s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      )
    case 'Services':
      return (
        <svg {...sharedProps}>
          <path d="M8 7h8l2 3-2 7H8l-2-7 2-3Z" />
          <path d="M10 7V5h4v2" />
        </svg>
      )
    case 'Experiences':
      return (
        <svg {...sharedProps}>
          <path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.5L12 16.8 7.2 19l.9-5.5-3.9-3.8 5.4-.8L12 4Z" />
        </svg>
      )
    case 'Users':
      return (
        <svg {...sharedProps}>
          <circle cx="12" cy="8" r="3" />
          <path d="M6 19a6 6 0 0 1 12 0" />
        </svg>
      )
    case 'Cleaner assignments':
      return (
        <svg {...sharedProps}>
          <path d="M6 20h8" />
          <path d="M9 20V8l5-4 1 2-2 2v12" />
        </svg>
      )
    case 'Sellers':
      return (
        <svg {...sharedProps}>
          <path d="M5 8h14v10H5z" />
          <path d="M8 8V6h8v2" />
          <path d="M12 12h.01" />
        </svg>
      )
    default:
      return (
        <svg {...sharedProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2 2" />
        </svg>
      )
  }
}

export default function AdminSidebar({
  requestSummary,
  collapsed,
  onToggle,
  mobileOpen = false,
  onNavigate,
  onCloseMobile,
}: Props) {
  const modules = buildAdminModules(requestSummary)
  const screenModules = modules.filter((module) => module.group === 'screens')
  const bookingModules = modules.filter((module) => module.group === 'booking')
  const contentModules = modules.filter((module) => module.group === 'content')
  const previewModule = modules.find((module) => module.group === 'preview')
  const effectiveCollapsed = mobileOpen ? false : collapsed

  return (
    <aside className={`admin-global-sidebar ${effectiveCollapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
      <button
        className="admin-global-sidebar-toggle"
        type="button"
        onClick={mobileOpen ? onCloseMobile : onToggle}
        aria-label={mobileOpen ? 'Close admin menu' : effectiveCollapsed ? 'Show admin menu' : 'Hide admin menu'}
        title={mobileOpen ? 'Close admin menu' : effectiveCollapsed ? 'Show admin menu' : 'Hide admin menu'}
      >
        {mobileOpen ? '×' : effectiveCollapsed ? '›' : '‹'}
      </button>

      <div className="admin-global-sidebar-scroll">
        <div className="admin-global-sidebar-brand">
          <div className="admin-global-sidebar-brand-mark">DLT</div>
          {!effectiveCollapsed ? (
            <div>
              <div className="admin-global-sidebar-brand-label">Da Nang Luxury Travel</div>
              <div className="admin-global-sidebar-brand-sub">Admin command center</div>
            </div>
          ) : null}
        </div>

        <div className="admin-global-sidebar-group">
          {!effectiveCollapsed ? <div className="admin-global-sidebar-title">Screens</div> : null}
          {screenModules.map((module) => (
            <NavLink
              key={module.to}
              to={module.to}
              end={module.to === '/admin'}
              className={({ isActive }) => `admin-global-sidebar-link ${isActive ? 'active' : ''}`}
              title={module.label}
              onClick={onNavigate}
            >
              <span className="admin-global-sidebar-link-icon">
                <SidebarIcon label={module.label} />
              </span>
              {!effectiveCollapsed ? <span className="admin-global-sidebar-link-label">{module.label}</span> : null}
              {module.badge ? <span className="admin-global-sidebar-badge">{module.badge}</span> : null}
            </NavLink>
          ))}
        </div>

        <div className="admin-global-sidebar-group">
          {!effectiveCollapsed ? <div className="admin-global-sidebar-title">Booking</div> : null}
          {bookingModules.map((module) => (
            <NavLink
              key={module.to}
              to={module.to}
              className={({ isActive }) => `admin-global-sidebar-link ${isActive ? 'active' : ''}`}
              title={module.label}
              onClick={onNavigate}
            >
              <span className="admin-global-sidebar-link-icon">
                <SidebarIcon label={module.label} />
              </span>
              {!effectiveCollapsed ? <span className="admin-global-sidebar-link-label">{module.label}</span> : null}
              {module.badge ? <span className="admin-global-sidebar-badge">{module.badge}</span> : null}
            </NavLink>
          ))}
        </div>

        <div className="admin-global-sidebar-group">
          {!effectiveCollapsed ? <div className="admin-global-sidebar-title">Content</div> : null}
          {contentModules.map((module) => (
            <NavLink
              key={module.to}
              to={module.to}
              className={({ isActive }) => `admin-global-sidebar-link ${isActive ? 'active' : ''}`}
              title={module.label}
              onClick={onNavigate}
            >
              <span className="admin-global-sidebar-link-icon">
                <SidebarIcon label={module.label} />
              </span>
              {!effectiveCollapsed ? <span className="admin-global-sidebar-link-label">{module.label}</span> : null}
            </NavLink>
          ))}
        </div>

        {previewModule ? (
          <Link to={previewModule.to} className="admin-global-sidebar-preview-link" title={previewModule.label} onClick={onNavigate}>
            <span className="admin-global-sidebar-link-icon">
              <SidebarIcon label={previewModule.label} />
            </span>
            {!effectiveCollapsed ? <span className="admin-global-sidebar-link-label">Open customer website</span> : null}
          </Link>
        ) : null}
      </div>
    </aside>
  )
}
