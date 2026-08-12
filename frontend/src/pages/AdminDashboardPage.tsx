import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type {
  AdminRequestSummary,
  BookingResponse,
  Destination,
  Experience,
  ExperienceRequestResponse,
  Room,
  RoomBookingResponse,
  ServiceRequestResponse,
  TravelService,
  User,
} from '../types'
import './pages.css'
import './admin-dashboard.css'

type DashboardData = {
  destinations: Destination[]
  services: TravelService[]
  experiences: Experience[]
  users: User[]
  sellers: User[]
  bookings: BookingResponse[]
  serviceRequests: ServiceRequestResponse[]
  experienceRequests: ExperienceRequestResponse[]
  rooms: Room[]
  roomBookings: RoomBookingResponse[]
  requestSummary: AdminRequestSummary | null
}

type AdminModule = {
  label: string
  description: string
  to: string
  badge?: number
  tone: 'emerald' | 'violet' | 'cyan' | 'amber'
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toTime(value?: string) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatShortDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

function sumRevenue(items: Array<{ totalPrice?: number }>) {
  return items.reduce((sum, item) => sum + (item.totalPrice ?? 0), 0)
}

function getRoomAvailabilityToday(roomBookings: RoomBookingResponse[], rooms: Room[]) {
  const now = Date.now()
  const occupied = roomBookings.filter((booking) => {
    const checkIn = toTime(booking.checkInAt)
    const checkOut = toTime(booking.checkOutAt)
    return checkIn <= now && checkOut > now && booking.status !== 'CANCELLED'
  }).length

  const checkInsToday = roomBookings.filter((booking) => {
    const checkIn = new Date(booking.checkInAt)
    const today = new Date(now)
    return (
      !Number.isNaN(checkIn.getTime()) &&
      checkIn.getDate() === today.getDate() &&
      checkIn.getMonth() === today.getMonth() &&
      checkIn.getFullYear() === today.getFullYear()
    )
  }).length

  return {
    occupied,
    available: Math.max(rooms.length - occupied, 0),
    checkInsToday,
  }
}

function buildActivityFeed(
  bookings: BookingResponse[],
  serviceRequests: ServiceRequestResponse[],
  experienceRequests: ExperienceRequestResponse[],
) {
  const items = [
    ...bookings.map((item) => ({
      id: `booking-${item.id}`,
      title: item.customerName,
      subtitle: item.destinationName,
      type: 'Direct booking',
      createdAt: item.createdAt,
      status: item.status,
      to: '/admin/bookings',
    })),
    ...serviceRequests.map((item) => ({
      id: `service-${item.id}`,
      title: item.customerName,
      subtitle: item.serviceName,
      type: 'Service request',
      createdAt: item.createdAt,
      status: item.status,
      to: '/admin/service-requests',
    })),
    ...experienceRequests.map((item) => ({
      id: `experience-${item.id}`,
      title: item.customerName,
      subtitle: item.experienceName,
      type: 'Experience request',
      createdAt: item.createdAt,
      status: item.status,
      to: '/admin/experience-requests',
    })),
  ]

  return items.sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt)).slice(0, 6)
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData>({
    destinations: [],
    services: [],
    experiences: [],
    users: [],
    sellers: [],
    bookings: [],
    serviceRequests: [],
    experienceRequests: [],
    rooms: [],
    roomBookings: [],
    requestSummary: null,
  })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)

    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)

    const requests = await Promise.allSettled([
      apiFetch<Destination[]>('/api/destinations'),
      apiFetch<TravelService[]>('/api/services'),
      apiFetch<Experience[]>('/api/experiences'),
      apiFetch<User[]>('/api/admin/users'),
      apiFetch<User[]>('/api/admin/users/sellers'),
      apiFetch<BookingResponse[]>('/api/bookings'),
      apiFetch<ServiceRequestResponse[]>('/api/service-requests'),
      apiFetch<ExperienceRequestResponse[]>('/api/experience-requests'),
      apiFetch<Room[]>('/api/admin/rooms'),
      apiFetch<RoomBookingResponse[]>(`/api/admin/room-bookings?from=${toIsoDate(monthStart)}&to=${toIsoDate(monthEnd)}`),
      apiFetch<AdminRequestSummary>('/api/admin/requests/summary'),
    ])

    const [destinations, services, experiences, users, sellers, bookings, serviceRequests, experienceRequests, rooms, roomBookings, requestSummary] =
      requests

    const firstFailure = requests.find((item) => item.status === 'rejected')
    if (firstFailure && firstFailure.reason instanceof HttpError) {
      setError(firstFailure.reason.message)
    } else if (firstFailure) {
      setError('Could not load the admin dashboard.')
    }

    setData({
      destinations: destinations.status === 'fulfilled' ? destinations.value : [],
      services: services.status === 'fulfilled' ? services.value : [],
      experiences: experiences.status === 'fulfilled' ? experiences.value : [],
      users: users.status === 'fulfilled' ? users.value : [],
      sellers: sellers.status === 'fulfilled' ? sellers.value : [],
      bookings: bookings.status === 'fulfilled' ? bookings.value : [],
      serviceRequests: serviceRequests.status === 'fulfilled' ? serviceRequests.value : [],
      experienceRequests: experienceRequests.status === 'fulfilled' ? experienceRequests.value : [],
      rooms: rooms.status === 'fulfilled' ? rooms.value : [],
      roomBookings: roomBookings.status === 'fulfilled' ? roomBookings.value : [],
      requestSummary: requestSummary.status === 'fulfilled' ? requestSummary.value : null,
    })
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const modules = useMemo<AdminModule[]>(() => {
    const pendingRequests = data.requestSummary?.totalPendingRequests ?? 0

    return [
      {
        label: 'Overview',
        description: 'Admin summary and website preview',
        to: '/admin',
        tone: 'emerald',
      },
      {
        label: 'Room schedule',
        description: 'Monthly room calendar and guest flow',
        to: '/admin/room-bookings',
        tone: 'violet',
      },
      {
        label: 'Rooms',
        description: 'Manage room inventory and room metadata',
        to: '/admin/rooms',
        tone: 'cyan',
      },
      {
        label: 'Direct bookings',
        description: 'Review direct website booking requests',
        to: '/admin/bookings',
        tone: 'amber',
      },
      {
        label: 'Service requests',
        description: 'Approve transport and travel services',
        to: '/admin/service-requests',
        badge: data.requestSummary?.pendingServiceRequests,
        tone: 'emerald',
      },
      {
        label: 'Experience requests',
        description: 'Approve tours and experience requests',
        to: '/admin/experience-requests',
        badge: data.requestSummary?.pendingExperienceRequests,
        tone: 'violet',
      },
      {
        label: 'Destinations',
        description: 'Edit destination cards shown on the website',
        to: '/admin/destinations',
        tone: 'cyan',
      },
      {
        label: 'Services',
        description: 'Manage service products and media',
        to: '/admin/services',
        tone: 'amber',
      },
      {
        label: 'Experiences',
        description: 'Manage experience cards and details',
        to: '/admin/experiences',
        tone: 'emerald',
      },
      {
        label: 'Users',
        description: 'Control user accounts and permissions',
        to: '/admin/users',
        tone: 'cyan',
      },
      {
        label: 'Sellers',
        description: 'Track seller accounts and commission',
        to: '/admin/sellers',
        tone: 'violet',
      },
      {
        label: 'Customer website',
        description: pendingRequests > 0 ? `Preview live site with ${pendingRequests} pending requests in mind` : 'Preview the public website as a customer',
        to: '/?customerPreview=1',
        tone: 'amber',
      },
    ]
  }, [data.requestSummary])

  const filteredModules = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return modules
    return modules.filter((module) => `${module.label} ${module.description}`.toLowerCase().includes(keyword))
  }, [modules, search])

  const bookingValue = useMemo(
    () => sumRevenue(data.bookings) + sumRevenue(data.serviceRequests) + sumRevenue(data.experienceRequests),
    [data.bookings, data.serviceRequests, data.experienceRequests],
  )

  const pendingDirectBookings = useMemo(
    () => data.bookings.filter((item) => item.status === 'PENDING').length,
    [data.bookings],
  )

  const roomAvailability = useMemo(
    () => getRoomAvailabilityToday(data.roomBookings, data.rooms),
    [data.roomBookings, data.rooms],
  )

  const activityFeed = useMemo(
    () => buildActivityFeed(data.bookings, data.serviceRequests, data.experienceRequests),
    [data.bookings, data.serviceRequests, data.experienceRequests],
  )

  const totalProducts = data.destinations.length + data.services.length + data.experiences.length

  return (
    <section className="section admin-dashboard-section">
      <div className="container admin-dashboard-shell">
        <aside className="admin-dashboard-sidebar">
          <div className="admin-dashboard-brand">
            <div className="admin-dashboard-brand-mark">DLT</div>
            <div>
              <div className="admin-dashboard-brand-label">Da Nang Luxury Travel</div>
              <div className="admin-dashboard-brand-sub">Admin command center</div>
            </div>
          </div>

          <div className="admin-dashboard-side-group">
            <div className="admin-dashboard-side-title">Screens</div>
            {modules.slice(0, 3).map((module) => (
              <Link key={module.to} to={module.to} className="admin-dashboard-side-link">
                <span>{module.label}</span>
                {module.badge ? <span className="admin-dashboard-side-badge">{module.badge}</span> : null}
              </Link>
            ))}
          </div>

          <div className="admin-dashboard-side-group">
            <div className="admin-dashboard-side-title">Booking management</div>
            {modules.slice(3, 6).map((module) => (
              <Link key={module.to} to={module.to} className="admin-dashboard-side-link">
                <span>{module.label}</span>
                {module.badge ? <span className="admin-dashboard-side-badge">{module.badge}</span> : null}
              </Link>
            ))}
          </div>

          <div className="admin-dashboard-side-group">
            <div className="admin-dashboard-side-title">Content and people</div>
            {modules.slice(6, 11).map((module) => (
              <Link key={module.to} to={module.to} className="admin-dashboard-side-link">
                <span>{module.label}</span>
              </Link>
            ))}
          </div>

          <Link to="/?customerPreview=1" className="admin-dashboard-preview-link">
            Open customer website
          </Link>
        </aside>

        <div className="admin-dashboard-main">
          <div className="admin-dashboard-topbar">
            <div>
              <div className="admin-dashboard-eyebrow">Admin dashboard</div>
              <h1>Overview</h1>
            </div>

            <div className="admin-dashboard-actions">
              <label className="admin-dashboard-search">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pages, rooms, customers..."
                />
              </label>
              <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
                Reload
              </button>
              <Link to="/?customerPreview=1" className="btn primary">
                View website
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="card detail-card muted">Loading dashboard...</div>
          ) : (
            <>
              {error ? (
                <div className="card error">
                  <div className="error-title">Some dashboard data could not be loaded</div>
                  <div className="muted">{error}</div>
                </div>
              ) : null}

              <div className="admin-dashboard-hero-grid">
                <div className="admin-dashboard-panel admin-dashboard-panel-gradient">
                  <div className="admin-dashboard-alert-chip">
                    {pendingDirectBookings > 0
                      ? `${pendingDirectBookings} direct booking request${pendingDirectBookings === 1 ? '' : 's'} need review`
                      : 'All direct booking requests are up to date'}
                  </div>
                  <div className="admin-dashboard-hero-row">
                    <div className="admin-dashboard-property-card">
                      <div className="admin-dashboard-property-title">Customer website</div>
                      <div className="admin-dashboard-property-value">Live and synced with public view</div>
                      <div className="admin-dashboard-property-meta">
                        {totalProducts} products live
                        <span className="admin-dashboard-dot" />
                        {data.rooms.length} rooms managed
                      </div>
                    </div>
                    <div className="admin-dashboard-property-card">
                      <div className="admin-dashboard-property-title">Requests inbox</div>
                      <div className="admin-dashboard-property-value">
                        {data.requestSummary?.totalPendingRequests ?? 0} pending approvals
                      </div>
                      <div className="admin-dashboard-property-meta">
                        Service {data.requestSummary?.pendingServiceRequests ?? 0}
                        <span className="admin-dashboard-dot" />
                        Experience {data.requestSummary?.pendingExperienceRequests ?? 0}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="admin-dashboard-panel">
                  <div className="admin-dashboard-panel-head">
                    <h3>Website preview</h3>
                    <Link to="/?customerPreview=1" className="admin-dashboard-inline-link">
                      Open full page
                    </Link>
                  </div>
                  <div className="admin-dashboard-preview-frame">
                    <iframe src="/?customerPreview=1" title="Customer website preview" loading="lazy" />
                  </div>
                </div>
              </div>

              <div className="admin-dashboard-quick-grid">
                {filteredModules.map((module) => (
                  <Link key={module.to} to={module.to} className={`admin-dashboard-quick-card tone-${module.tone}`}>
                    <div className="admin-dashboard-quick-title-row">
                      <strong>{module.label}</strong>
                      {module.badge ? <span className="admin-dashboard-side-badge">{module.badge}</span> : null}
                    </div>
                    <span>{module.description}</span>
                  </Link>
                ))}
              </div>

              <div className="admin-dashboard-stats-grid">
                <div className="admin-dashboard-stat-card">
                  <div className="admin-dashboard-stat-label">Pipeline value</div>
                  <div className="admin-dashboard-stat-value">{formatMoney(bookingValue)}</div>
                  <div className="muted">Combined direct bookings, services and experiences</div>
                </div>
                <div className="admin-dashboard-stat-card">
                  <div className="admin-dashboard-stat-label">Products live</div>
                  <div className="admin-dashboard-stat-value">{totalProducts}</div>
                  <div className="muted">
                    {data.destinations.length} destinations, {data.services.length} services, {data.experiences.length} experiences
                  </div>
                </div>
                <div className="admin-dashboard-stat-card">
                  <div className="admin-dashboard-stat-label">People</div>
                  <div className="admin-dashboard-stat-value">{data.users.length}</div>
                  <div className="muted">{data.sellers.length} sellers with admin-tracked accounts</div>
                </div>
                <div className="admin-dashboard-stat-card">
                  <div className="admin-dashboard-stat-label">Room inventory today</div>
                  <div className="admin-dashboard-stat-value">
                    {roomAvailability.occupied}/{data.rooms.length}
                  </div>
                  <div className="muted">{roomAvailability.available} rooms currently available</div>
                </div>
              </div>

              <div className="admin-dashboard-detail-grid">
                <div className="admin-dashboard-panel">
                  <div className="admin-dashboard-panel-head">
                    <h3>Today at a glance</h3>
                  </div>
                  <div className="admin-dashboard-mini-metrics">
                    <div className="admin-dashboard-mini-metric">
                      <span>Check-ins today</span>
                      <strong>{roomAvailability.checkInsToday}</strong>
                    </div>
                    <div className="admin-dashboard-mini-metric">
                      <span>Pending direct bookings</span>
                      <strong>{pendingDirectBookings}</strong>
                    </div>
                    <div className="admin-dashboard-mini-metric">
                      <span>Pending approvals</span>
                      <strong>{data.requestSummary?.totalPendingRequests ?? 0}</strong>
                    </div>
                  </div>
                </div>

                <div className="admin-dashboard-panel">
                  <div className="admin-dashboard-panel-head">
                    <h3>Recent activity</h3>
                  </div>
                  <div className="admin-dashboard-activity-list">
                    {activityFeed.length === 0 ? (
                      <div className="muted">No recent activity yet.</div>
                    ) : (
                      activityFeed.map((item) => (
                        <Link key={item.id} to={item.to} className="admin-dashboard-activity-item">
                          <div>
                            <strong>{item.title}</strong>
                            <div className="muted">
                              {item.type} • {item.subtitle}
                            </div>
                          </div>
                          <div className="admin-dashboard-activity-meta">
                            <span>{item.status}</span>
                            <span>{formatShortDate(item.createdAt)}</span>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
