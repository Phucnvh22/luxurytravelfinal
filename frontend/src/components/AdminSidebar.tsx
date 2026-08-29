import { Link, NavLink } from 'react-router-dom'
import type { AdminRequestSummary } from '../types'
import { buildAdminModules } from './adminModules'
import './admin-sidebar.css'

type Props = {
  requestSummary: AdminRequestSummary | null
  collapsed: boolean
  onToggle: () => void
}

function renderLabel(label: string, collapsed: boolean) {
  if (!collapsed) return label
  return label
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function AdminSidebar({ requestSummary, collapsed, onToggle }: Props) {
  const modules = buildAdminModules(requestSummary)
  const screenModules = modules.slice(0, 5)
  const bookingModules = modules.slice(5, 8)
  const contentModules = modules.slice(8, 14)
  const previewModule = modules[14]

  if (collapsed) {
    return (
      <aside className="admin-global-sidebar admin-global-sidebar-collapsed-button">
        <button
          className="admin-global-sidebar-dashboard-button"
          type="button"
          onClick={onToggle}
          aria-label="Show admin menu"
          title="Show admin menu"
        >
          <span className="admin-global-sidebar-dashboard-icon">DLT</span>
          <span>Dashboard</span>
        </button>
      </aside>
    )
  }

  return (
    <aside className="admin-global-sidebar">
      <button
        className="admin-global-sidebar-toggle"
        type="button"
        onClick={onToggle}
        aria-label="Hide admin menu"
        title="Hide admin menu"
      >
        ‹
      </button>

      <div className="admin-global-sidebar-scroll">
        <div className="admin-global-sidebar-brand">
          <div className="admin-global-sidebar-brand-mark">DLT</div>
          {!collapsed ? (
            <div>
              <div className="admin-global-sidebar-brand-label">Da Nang Luxury Travel</div>
              <div className="admin-global-sidebar-brand-sub">Admin command center</div>
            </div>
          ) : null}
        </div>

        <div className="admin-global-sidebar-group">
          {!collapsed ? <div className="admin-global-sidebar-title">Screens</div> : null}
          {screenModules.map((module) => (
            <NavLink
              key={module.to}
              to={module.to}
              end={module.to === '/admin'}
              className={({ isActive }) => `admin-global-sidebar-link ${isActive ? 'active' : ''}`}
              title={module.label}
            >
              <span>{renderLabel(module.label, false)}</span>
              {module.badge ? <span className="admin-global-sidebar-badge">{module.badge}</span> : null}
            </NavLink>
          ))}
        </div>

        <div className="admin-global-sidebar-group">
          {!collapsed ? <div className="admin-global-sidebar-title">Booking</div> : null}
          {bookingModules.map((module) => (
            <NavLink
              key={module.to}
              to={module.to}
              className={({ isActive }) => `admin-global-sidebar-link ${isActive ? 'active' : ''}`}
              title={module.label}
            >
              <span>{renderLabel(module.label, false)}</span>
              {module.badge ? <span className="admin-global-sidebar-badge">{module.badge}</span> : null}
            </NavLink>
          ))}
        </div>

        <div className="admin-global-sidebar-group">
          {!collapsed ? <div className="admin-global-sidebar-title">Content</div> : null}
          {contentModules.map((module) => (
            <NavLink
              key={module.to}
              to={module.to}
              className={({ isActive }) => `admin-global-sidebar-link ${isActive ? 'active' : ''}`}
              title={module.label}
            >
              <span>{renderLabel(module.label, false)}</span>
            </NavLink>
          ))}
        </div>

        <Link to={previewModule.to} className="admin-global-sidebar-preview-link" title={previewModule.label}>
          {collapsed ? 'Web' : 'Open customer website'}
        </Link>
      </div>
    </aside>
  )
}
