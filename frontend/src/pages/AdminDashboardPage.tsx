import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type {
  AdminRequestSummary,
  BookingResponse,
  ExperienceRequestResponse,
  Room,
  RoomBookingResponse,
  RoomBookingStatus,
  ServiceRequestResponse,
  VillaServiceOrder,
} from '../types'
import './pages.css'
import './admin-dashboard.css'

type DashboardData = {
  rooms: Room[]
  roomBookings: RoomBookingResponse[]
  bookings: BookingResponse[]
  serviceRequests: ServiceRequestResponse[]
  experienceRequests: ExperienceRequestResponse[]
  serviceOrders: VillaServiceOrder[]
  requestSummary: AdminRequestSummary | null
}

type StayRow = {
  id: number
  guestName: string
  roomCode: string
  source: string
  checkInAt: string
  checkOutAt: string
  status: RoomBookingStatus
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toTime(value?: string | null) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value ?? 0)
}

function formatShortDate(value?: string | null) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function normalizeBookingSource(source?: string | null) {
  const value = source?.trim()
  return value || 'Direct'
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    return error.message
  }
  return fallback
}

function isLiveStay(booking: RoomBookingResponse, now: number) {
  if (booking.status === 'CANCELLED' || booking.status === 'CHECKED_OUT') return false
  const checkIn = toTime(booking.checkInAt)
  const checkOut = toTime(booking.checkOutAt)
  return checkIn <= now && checkOut > now
}

function isUpcomingCheckIn(booking: RoomBookingResponse, now: number) {
  if (booking.status === 'CANCELLED' || booking.status === 'CHECKED_OUT') return false
  const checkIn = toTime(booking.checkInAt)
  return checkIn > now
}

function isRecentCheckOut(booking: RoomBookingResponse, now: number) {
  if (booking.status !== 'CHECKED_OUT') return false
  const checkOut = toTime(booking.checkOutAt)
  return checkOut <= now
}

function toStayRow(booking: RoomBookingResponse): StayRow {
  return {
    id: booking.id,
    guestName: booking.guestName || 'Guest',
    roomCode: booking.roomCode,
    source: normalizeBookingSource(booking.source),
    checkInAt: booking.checkInAt,
    checkOutAt: booking.checkOutAt,
    status: booking.status,
  }
}

function buildSourceSummary(roomBookings: RoomBookingResponse[]) {
  const counts = new Map<string, number>()
  roomBookings.forEach((booking) => {
    if (booking.status === 'CANCELLED') return
    const source = normalizeBookingSource(booking.source)
    counts.set(source, (counts.get(source) ?? 0) + 1)
  })
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, 6)
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData>({
    rooms: [],
    roomBookings: [],
    bookings: [],
    serviceRequests: [],
    experienceRequests: [],
    serviceOrders: [],
    requestSummary: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)

    const now = new Date()
    const rangeStart = addDays(startOfDay(now), -7)
    const rangeEnd = addDays(endOfDay(now), 30)

    const requests = await Promise.allSettled([
      apiFetch<Room[]>('/api/admin/rooms'),
      apiFetch<RoomBookingResponse[]>(`/api/admin/room-bookings?from=${toIsoDate(rangeStart)}&to=${toIsoDate(rangeEnd)}`),
      apiFetch<BookingResponse[]>('/api/bookings'),
      apiFetch<ServiceRequestResponse[]>('/api/service-requests'),
      apiFetch<ExperienceRequestResponse[]>('/api/experience-requests'),
      apiFetch<VillaServiceOrder[]>('/api/admin/villa-service-orders'),
      apiFetch<AdminRequestSummary>('/api/admin/requests/summary'),
    ])

    const [rooms, roomBookings, bookings, serviceRequests, experienceRequests, serviceOrders, requestSummary] = requests

    const firstFailure = requests.find((item) => item.status === 'rejected')
    if (firstFailure) {
      setError(getErrorMessage(firstFailure.reason, 'Could not load the dashboard overview.'))
    }

    setData({
      rooms: rooms.status === 'fulfilled' ? rooms.value : [],
      roomBookings: roomBookings.status === 'fulfilled' ? roomBookings.value : [],
      bookings: bookings.status === 'fulfilled' ? bookings.value : [],
      serviceRequests: serviceRequests.status === 'fulfilled' ? serviceRequests.value : [],
      experienceRequests: experienceRequests.status === 'fulfilled' ? experienceRequests.value : [],
      serviceOrders: serviceOrders.status === 'fulfilled' ? serviceOrders.value : [],
      requestSummary: requestSummary.status === 'fulfilled' ? requestSummary.value : null,
    })
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const now = Date.now()
  const todayStart = startOfDay(new Date()).getTime()
  const todayEnd = endOfDay(new Date()).getTime()
  const tomorrowEnd = endOfDay(addDays(new Date(), 1)).getTime()

  const liveStays = useMemo(
    () => data.roomBookings.filter((booking) => isLiveStay(booking, now)).sort((left, right) => toTime(left.checkOutAt) - toTime(right.checkOutAt)).map(toStayRow),
    [data.roomBookings, now],
  )

  const upcomingCheckIns = useMemo(
    () =>
      data.roomBookings
        .filter((booking) => {
          if (!isUpcomingCheckIn(booking, now)) return false
          const checkIn = toTime(booking.checkInAt)
          return checkIn >= todayStart && checkIn <= tomorrowEnd
        })
        .sort((left, right) => toTime(left.checkInAt) - toTime(right.checkInAt))
        .slice(0, 8)
        .map(toStayRow),
    [data.roomBookings, now, todayStart, tomorrowEnd],
  )

  const recentCheckIns = useMemo(
    () =>
      data.roomBookings
        .filter((booking) => {
          if (booking.status === 'CANCELLED') return false
          const checkIn = toTime(booking.checkInAt)
          return checkIn <= now
        })
        .sort((left, right) => toTime(right.checkInAt) - toTime(left.checkInAt))
        .slice(0, 8)
        .map(toStayRow),
    [data.roomBookings, now],
  )

  const recentCheckOuts = useMemo(
    () =>
      data.roomBookings
        .filter((booking) => isRecentCheckOut(booking, now))
        .sort((left, right) => toTime(right.checkOutAt) - toTime(left.checkOutAt))
        .slice(0, 8)
        .map(toStayRow),
    [data.roomBookings, now],
  )

  const todayCheckIns = useMemo(
    () => data.roomBookings.filter((booking) => {
      const checkIn = toTime(booking.checkInAt)
      return booking.status !== 'CANCELLED' && checkIn >= todayStart && checkIn <= todayEnd
    }),
    [data.roomBookings, todayStart, todayEnd],
  )

  const todayCheckOuts = useMemo(
    () => data.roomBookings.filter((booking) => {
      const checkOut = toTime(booking.checkOutAt)
      return booking.status !== 'CANCELLED' && checkOut >= todayStart && checkOut <= todayEnd
    }),
    [data.roomBookings, todayStart, todayEnd],
  )

  const occupiedCount = liveStays.length
  const availableCount = Math.max(data.rooms.length - occupiedCount, 0)
  const occupancyRate = data.rooms.length > 0 ? Math.round((occupiedCount / data.rooms.length) * 100) : 0

  const pendingApprovals = data.requestSummary?.totalPendingRequests ?? 0
  const pendingDirectBookings = data.bookings.filter((item) => item.status === 'PENDING').length

  const openServiceOrders = useMemo(
    () =>
      data.serviceOrders
        .filter((order) => order.status !== 'CANCELLED')
        .sort((left, right) => {
          const leftTime = toTime(left.serviceDate ?? left.updatedAt ?? left.createdAt)
          const rightTime = toTime(right.serviceDate ?? right.updatedAt ?? right.createdAt)
          return rightTime - leftTime
        })
        .slice(0, 6),
    [data.serviceOrders],
  )

  const sourceSummary = useMemo(() => buildSourceSummary(data.roomBookings), [data.roomBookings])

  const serviceRevenue = useMemo(
    () => data.serviceOrders.reduce((sum, order) => sum + (order.serviceTotal ?? 0), 0),
    [data.serviceOrders],
  )

  const serviceOutstanding = useMemo(
    () => data.serviceOrders.reduce((sum, order) => sum + Math.max((order.serviceTotal ?? 0) - (order.depositAmount ?? 0), 0), 0),
    [data.serviceOrders],
  )

  const quickActions = [
    { label: 'Villa schedule', value: `${todayCheckIns.length} arrivals today`, to: '/admin/room-bookings' },
    { label: 'Villa services', value: `${openServiceOrders.length} recent service orders`, to: '/admin/villa-services' },
    { label: 'Direct bookings', value: `${pendingDirectBookings} pending requests`, to: '/admin/bookings' },
    { label: 'Experience requests', value: `${data.requestSummary?.pendingExperienceRequests ?? 0} waiting review`, to: '/admin/experience-requests' },
  ]

  return (
    <section className="section admin-dashboard-section">
      <div className="container admin-dashboard-shell">
        <div className="admin-dashboard-header">
          <div>
            <div className="admin-dashboard-kicker">Villa Operations</div>
            <h1 className="admin-dashboard-title">Overview Dashboard</h1>
            <p className="admin-dashboard-subtitle">
              A live operations board for bookings, arrivals, departures, service orders, and pending approvals.
            </p>
          </div>
          <div className="admin-dashboard-header-actions">
            <Link to="/admin/room-bookings" className="btn">Open schedule</Link>
            <button className="btn primary" type="button" onClick={() => void load()} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh dashboard'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="card error">
            <div className="error-title">Some dashboard data could not be loaded</div>
            <div className="muted">{error}</div>
          </div>
        ) : null}

        {loading ? <div className="card detail-card muted">Loading dashboard...</div> : null}

        <div className="admin-dashboard-top-metrics">
          <article className="admin-dashboard-metric-card is-emerald">
            <span>Check-in today</span>
            <strong>{todayCheckIns.length}</strong>
            <small>{todayCheckIns.filter((booking) => booking.status === 'CHECKED_IN').length} already checked in</small>
          </article>
          <article className="admin-dashboard-metric-card is-cyan">
            <span>Check-out today</span>
            <strong>{todayCheckOuts.length}</strong>
            <small>{todayCheckOuts.filter((booking) => booking.status === 'CHECKED_OUT').length} already checked out</small>
          </article>
          <article className="admin-dashboard-metric-card is-violet">
            <span>Occupied now</span>
            <strong>{occupiedCount}</strong>
            <small>{occupancyRate}% of {data.rooms.length} villas</small>
          </article>
          <article className="admin-dashboard-metric-card is-amber">
            <span>Pending approvals</span>
            <strong>{pendingApprovals}</strong>
            <small>{pendingDirectBookings} direct bookings need review</small>
          </article>
        </div>

        <div className="admin-dashboard-main-grid">
          <section className="admin-dashboard-panel admin-dashboard-panel--wide">
            <div className="admin-dashboard-panel-head">
              <div>
                <h3>Today summary</h3>
                <p>Track room flow and service cash collection at a glance.</p>
              </div>
              <Link to="/admin/room-bookings" className="admin-dashboard-link">Open calendar</Link>
            </div>

            <div className="admin-dashboard-summary-grid">
              <div className="admin-dashboard-summary-card">
                <span>Available villas</span>
                <strong>{availableCount}</strong>
                <small>{data.rooms.length} total inventory</small>
              </div>
              <div className="admin-dashboard-summary-card">
                <span>Service revenue</span>
                <strong>{formatMoney(serviceRevenue)}</strong>
                <small>Only service booking amount</small>
              </div>
              <div className="admin-dashboard-summary-card">
                <span>Service outstanding</span>
                <strong>{formatMoney(serviceOutstanding)}</strong>
                <small>Remaining service balance</small>
              </div>
              <div className="admin-dashboard-summary-card">
                <span>Booking sources</span>
                <strong>{sourceSummary.length}</strong>
                <small>Channels active this month</small>
              </div>
            </div>

            <div className="admin-dashboard-source-list">
              {sourceSummary.length === 0 ? (
                <div className="muted">No booking source data yet.</div>
              ) : (
                sourceSummary.map((source) => (
                  <div key={source.name} className="admin-dashboard-source-item">
                    <span>{source.name}</span>
                    <strong>{source.count}</strong>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="admin-dashboard-panel">
            <div className="admin-dashboard-panel-head">
              <div>
                <h3>Quick access</h3>
                <p>Jump straight into the busiest modules.</p>
              </div>
            </div>
            <div className="admin-dashboard-action-list">
              {quickActions.map((action) => (
                <Link key={action.to} to={action.to} className="admin-dashboard-action-card">
                  <strong>{action.label}</strong>
                  <span>{action.value}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="admin-dashboard-lists-grid">
          <section className="admin-dashboard-panel">
            <div className="admin-dashboard-panel-head">
              <div>
                <h3>Guests in house</h3>
                <p>{liveStays.length} current stays</p>
              </div>
            </div>
            <div className="admin-dashboard-booking-list">
              {liveStays.length === 0 ? (
                <div className="muted">No guests currently staying.</div>
              ) : (
                liveStays.map((booking) => (
                  <div key={booking.id} className="admin-dashboard-booking-item">
                    <div>
                      <strong>{booking.guestName}</strong>
                      <span>{booking.roomCode} • {booking.source}</span>
                    </div>
                    <div className="admin-dashboard-booking-meta">
                      <span>Out</span>
                      <strong>{formatDateTime(booking.checkOutAt)}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="admin-dashboard-panel">
            <div className="admin-dashboard-panel-head">
              <div>
                <h3>Upcoming check-ins</h3>
                <p>Today and tomorrow</p>
              </div>
            </div>
            <div className="admin-dashboard-booking-list">
              {upcomingCheckIns.length === 0 ? (
                <div className="muted">No upcoming check-ins in the next two days.</div>
              ) : (
                upcomingCheckIns.map((booking) => (
                  <div key={booking.id} className="admin-dashboard-booking-item">
                    <div>
                      <strong>{booking.guestName}</strong>
                      <span>{booking.roomCode} • {booking.source}</span>
                    </div>
                    <div className="admin-dashboard-booking-meta">
                      <span>In</span>
                      <strong>{formatDateTime(booking.checkInAt)}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="admin-dashboard-panel">
            <div className="admin-dashboard-panel-head">
              <div>
                <h3>Recent check-ins</h3>
                <p>Latest arrivals</p>
              </div>
            </div>
            <div className="admin-dashboard-booking-list">
              {recentCheckIns.length === 0 ? (
                <div className="muted">No recent check-ins yet.</div>
              ) : (
                recentCheckIns.map((booking) => (
                  <div key={booking.id} className="admin-dashboard-booking-item">
                    <div>
                      <strong>{booking.guestName}</strong>
                      <span>{booking.roomCode} • {booking.source}</span>
                    </div>
                    <div className="admin-dashboard-booking-meta">
                      <span>In</span>
                      <strong>{formatDateTime(booking.checkInAt)}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="admin-dashboard-panel">
            <div className="admin-dashboard-panel-head">
              <div>
                <h3>Recent check-outs</h3>
                <p>Latest departures</p>
              </div>
            </div>
            <div className="admin-dashboard-booking-list">
              {recentCheckOuts.length === 0 ? (
                <div className="muted">No recent check-outs yet.</div>
              ) : (
                recentCheckOuts.map((booking) => (
                  <div key={booking.id} className="admin-dashboard-booking-item">
                    <div>
                      <strong>{booking.guestName}</strong>
                      <span>{booking.roomCode} • {booking.source}</span>
                    </div>
                    <div className="admin-dashboard-booking-meta">
                      <span>Out</span>
                      <strong>{formatDateTime(booking.checkOutAt)}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="admin-dashboard-bottom-grid">
          <section className="admin-dashboard-panel">
            <div className="admin-dashboard-panel-head">
              <div>
                <h3>Service booking activity</h3>
                <p>Latest active service orders</p>
              </div>
              <Link to="/admin/villa-services" className="admin-dashboard-link">Open service management</Link>
            </div>
            <div className="admin-dashboard-service-list">
              {openServiceOrders.length === 0 ? (
                <div className="muted">No active service orders yet.</div>
              ) : (
                openServiceOrders.map((order) => (
                  <div key={`${order.orderType}-${order.id}`} className="admin-dashboard-service-item">
                    <div>
                      <strong>{order.bookingGuestName || order.customerName}</strong>
                      <span>{order.bookingRoomCode || 'Standalone'} • {formatShortDate(order.serviceDate)}</span>
                    </div>
                    <div className="admin-dashboard-booking-meta">
                      <span>{order.orderType}</span>
                      <strong>{formatMoney(order.serviceTotal)}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="admin-dashboard-panel">
            <div className="admin-dashboard-panel-head">
              <div>
                <h3>Approvals inbox</h3>
                <p>Requests waiting for action</p>
              </div>
            </div>
            <div className="admin-dashboard-approval-grid">
              <Link to="/admin/bookings" className="admin-dashboard-approval-card">
                <span>Direct bookings</span>
                <strong>{pendingDirectBookings}</strong>
              </Link>
              <Link to="/admin/service-requests" className="admin-dashboard-approval-card">
                <span>Service requests</span>
                <strong>{data.requestSummary?.pendingServiceRequests ?? 0}</strong>
              </Link>
              <Link to="/admin/experience-requests" className="admin-dashboard-approval-card">
                <span>Experience requests</span>
                <strong>{data.requestSummary?.pendingExperienceRequests ?? 0}</strong>
              </Link>
              <Link to="/admin/users" className="admin-dashboard-approval-card">
                <span>Open service orders</span>
                <strong>{openServiceOrders.length}</strong>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
