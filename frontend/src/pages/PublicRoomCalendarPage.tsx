import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { PublicRoomCalendarBooking, PublicRoomCalendarResponse, PublicRoomCalendarRoom, RoomBookingStatus } from '../types'
import './pages.css'
import './admin-room-bookings.css'

type VisibleRoomBookingStatus = 'CONFIRMED' | 'AIRBNB_BLOCK' | 'CHECKED_IN' | 'CHECKED_OUT'

type StatusMeta = {
  label: string
  toneClass: string
}

const DAY_DURATION_MS = 24 * 60 * 60 * 1000

const STATUS_META: Record<VisibleRoomBookingStatus, StatusMeta> = {
  CONFIRMED: { label: 'Reserved', toneClass: 'reserved' },
  AIRBNB_BLOCK: { label: 'AirBnbBlock', toneClass: 'airbnb-block' },
  CHECKED_IN: { label: 'Check-in', toneClass: 'checked-in' },
  CHECKED_OUT: { label: 'Check-out', toneClass: 'checked-out' },
}

function startOfMonth(base: Date) {
  const value = new Date(base)
  value.setDate(1)
  value.setHours(0, 0, 0, 0)
  return value
}

function endOfMonth(base: Date) {
  const value = startOfMonth(base)
  value.setMonth(value.getMonth() + 1)
  value.setDate(0)
  value.setHours(0, 0, 0, 0)
  return value
}

function addDays(base: Date, days: number) {
  const value = new Date(base)
  value.setDate(value.getDate() + days)
  return value
}

function addMonths(base: Date, months: number) {
  const value = startOfMonth(base)
  value.setMonth(value.getMonth() + months)
  return value
}

function startOfDay(base: Date) {
  const value = new Date(base)
  value.setHours(0, 0, 0, 0)
  return value
}

function pad(input: number) {
  return String(input).padStart(2, '0')
}

function toIsoDate(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

function formatDateRange(start: Date, end: Date) {
  return `${new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(start)} - ${new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(end)}`
}

function formatMonthLabel(value: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    month: 'long',
    year: 'numeric',
  }).format(value)
}

function formatDayLabel(value: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
  }).format(value)
}

function formatDayNumber(value: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
  }).format(value)
}

function formatDayMonth(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(parsed)
}

function normalizeDisplayStatus(status: RoomBookingStatus): VisibleRoomBookingStatus | null {
  if (status === 'CHECKED_IN' || status === 'CHECKED_OUT' || status === 'CONFIRMED' || status === 'AIRBNB_BLOCK') return status
  if (status === 'PENDING') return 'CONFIRMED'
  return null
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof HttpError) return error.message
  return fallback
}

function normalizeLocation(location?: string) {
  return location?.trim() || 'Unassigned location'
}

function compareRoomsByLocation(a: PublicRoomCalendarRoom, b: PublicRoomCalendarRoom) {
  return (
    normalizeLocation(a.location).localeCompare(normalizeLocation(b.location), 'vi-VN', { sensitivity: 'base' }) ||
    a.code.localeCompare(b.code, 'vi-VN', { numeric: true })
  )
}

function buildGroupedRows(rooms: PublicRoomCalendarRoom[]) {
  const sorted = [...rooms].sort(compareRoomsByLocation)
  const counts = sorted.reduce<Record<string, number>>((acc, room) => {
    const location = normalizeLocation(room.location)
    acc[location] = (acc[location] ?? 0) + 1
    return acc
  }, {})

  const rows: Array<{ type: 'location'; location: string; count: number } | { type: 'villa'; room: PublicRoomCalendarRoom }> = []
  let currentLocation = ''
  sorted.forEach((room) => {
    const location = normalizeLocation(room.location)
    if (location !== currentLocation) {
      currentLocation = location
      rows.push({ type: 'location', location, count: counts[location] ?? 0 })
    }
    rows.push({ type: 'villa', room })
  })
  return rows
}

function sortBookingsByTime<T extends PublicRoomCalendarBooking>(items: T[]) {
  return [...items].sort(
    (a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime() || a.id - b.id,
  )
}

function getBookingBarLayout(booking: PublicRoomCalendarBooking, trackStartMs: number, trackDurationMs: number) {
  const start = startOfDay(new Date(booking.checkInAt)).getTime()
  const endCandidate = startOfDay(new Date(booking.checkOutAt)).getTime()
  const end = endCandidate > start ? endCandidate : start + DAY_DURATION_MS
  const trackEndMs = trackStartMs + trackDurationMs
  const clampedStart = Math.max(start, trackStartMs)
  const clampedEnd = Math.min(end, trackEndMs)

  if (clampedEnd <= clampedStart) return null

  return {
    left: ((clampedStart - trackStartMs) / trackDurationMs) * 100,
    width: ((clampedEnd - clampedStart) / trackDurationMs) * 100,
  }
}

export default function PublicRoomCalendarPage() {
  const { roomCodes = '' } = useParams()
  const decodedCodes = decodeURIComponent(roomCodes)
  const normalizedRoomCodes = useMemo(
    () =>
      Array.from(
        new Set(
          decodedCodes
            .split('&')
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean),
        ),
      ),
    [decodedCodes],
  )

  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [calendar, setCalendar] = useState<PublicRoomCalendarResponse>({ rooms: [], bookings: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [blockedBookingId, setBlockedBookingId] = useState<number | null>(null)

  const monthStart = useMemo(() => startOfMonth(monthCursor), [monthCursor])
  const monthEnd = useMemo(() => endOfMonth(monthCursor), [monthCursor])
  const monthDays = useMemo(() => {
    const totalDays = monthEnd.getDate()
    return Array.from({ length: totalDays }, (_, index) => addDays(monthStart, index))
  }, [monthEnd, monthStart])

  useEffect(() => {
    async function load() {
      if (normalizedRoomCodes.length === 0) {
        setLoading(false)
        setError('Calendar link is invalid.')
        return
      }
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        normalizedRoomCodes.forEach((code) => params.append('roomCodes', code))
        params.set('from', toIsoDate(monthStart))
        params.set('to', toIsoDate(monthEnd))
        const data = await apiFetch<PublicRoomCalendarResponse>(`/api/public/room-calendar?${params.toString()}`)
        setCalendar(data)
      } catch (e: unknown) {
        setError(getErrorMessage(e, 'Could not load villa calendar'))
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [monthEnd, monthStart, normalizedRoomCodes])

  const groupedRows = useMemo(() => buildGroupedRows(calendar.rooms), [calendar.rooms])
  const visibleBookings = useMemo(
    () =>
      calendar.bookings.flatMap((booking) => {
        const displayStatus = normalizeDisplayStatus(booking.status)
        return displayStatus ? [{ ...booking, displayStatus }] : []
      }),
    [calendar.bookings],
  )

  const trackStartMs = monthStart.getTime()
  const trackDurationMs = monthDays.length * DAY_DURATION_MS
  const scheduleGridStyle = useMemo(
    () =>
      ({
        ['--day-count' as string]: monthDays.length,
        ['--day-column-width' as string]: '56px',
      }) as CSSProperties,
    [monthDays.length],
  )

  const today = new Date()
  const isTodayInsideMonth = today >= monthStart && today < addDays(monthEnd, 1)
  const todayMarkerLeft = isTodayInsideMonth ? ((today.getTime() - trackStartMs) / trackDurationMs) * 100 : null

  return (
    <section className="section">
      <div className="container">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <Link to="/" className="btn">
              ← Home
            </Link>
          </div>
          <div className="room-bookings-week-nav">
            <div className="room-bookings-nav-strip">
              <button className="btn room-bookings-nav-btn" type="button" onClick={() => setMonthCursor((current) => addMonths(current, -1))}>
                ←
              </button>
              <div className="room-bookings-week-label room-bookings-current-month">
                <div className="room-bookings-week-title">Month</div>
                <div className="room-bookings-week-range">{formatMonthLabel(monthCursor)}</div>
              </div>
              <button className="btn room-bookings-nav-btn" type="button" onClick={() => setMonthCursor((current) => addMonths(current, 1))}>
                →
              </button>
            </div>
            <div className="room-bookings-week-label room-bookings-range-pill">
              <div className="room-bookings-week-title">Range</div>
              <div className="room-bookings-week-range">{formatDateRange(monthStart, monthEnd)}</div>
            </div>
          </div>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>Villa Calendar</h2>
            <div className="muted">Read-only calendar for selected villas: {normalizedRoomCodes.join(', ')}</div>
          </div>
        </div>

        <div className="card detail-card room-schedule-card">
          {loading ? (
            <div className="card detail-card muted">Loading villa calendar...</div>
          ) : error ? (
            <div className="card error">
              <div className="error-title">Could not load data</div>
              <div className="muted">{error}</div>
            </div>
          ) : groupedRows.length === 0 ? (
            <div className="card detail-card muted">No villas found for this shared calendar.</div>
          ) : (
            <div className="room-schedule-body room-schedule-scroll">
              <div className="room-schedule-table" style={scheduleGridStyle}>
                <div className="room-schedule-header">
                  <div className="room-schedule-room-head">Villa</div>
                  <div className="room-schedule-days">
                    {monthDays.map((day) => {
                      const isToday = toIsoDate(day) === toIsoDate(today)
                      return (
                        <div key={day.toISOString()} className={`room-schedule-day-head ${isToday ? 'is-today' : ''}`}>
                          <span className="room-schedule-day-weekday">{formatDayLabel(day)}</span>
                          <strong className="room-schedule-day-number">{formatDayNumber(day)}</strong>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {groupedRows.map((row) => {
                  if (row.type === 'location') {
                    return (
                      <div key={`location-${row.location}`} className="room-schedule-host-row">
                        <div className="room-schedule-host-cell">
                          <span className="room-schedule-host-label">Location</span>
                          <strong>{row.location}</strong>
                        </div>
                        <div className="room-schedule-host-track">{row.count} villas</div>
                      </div>
                    )
                  }

                  const room = row.room
                  const roomBookings = sortBookingsByTime(visibleBookings.filter((booking) => booking.roomCode === room.code))

                  return (
                    <div key={room.code} className="room-schedule-row">
                      <div className="room-schedule-room-cell">
                        <div className="room-schedule-room-cell-content">
                          <div>{room.name || room.code}</div>
                          {room.airbnbUrl ? (
                            <a href={room.airbnbUrl} target="_blank" rel="noreferrer" className="room-schedule-room-link">
                              Airbnb link
                            </a>
                          ) : (
                            <div className="room-schedule-room-link muted">Airbnb link pending</div>
                          )}
                        </div>
                      </div>
                      <div className="room-schedule-track">
                        <div className="room-schedule-grid">
                          {monthDays.map((day) => (
                            <div key={`${room.code}-${day.toISOString()}`} className="room-schedule-grid-cell" />
                          ))}
                        </div>

                        {todayMarkerLeft !== null ? (
                          <div className="room-schedule-today-marker" style={{ left: `${todayMarkerLeft}%` }} />
                        ) : null}

                        {roomBookings.map((booking) => {
                          const layout = getBookingBarLayout(booking, trackStartMs, trackDurationMs)
                          if (!layout) return null
                          const meta = STATUS_META[booking.displayStatus]

                          return (
                            <button
                              key={booking.id}
                              type="button"
                              className={`room-booking-bar ${meta.toneClass}`}
                              style={{ left: `${layout.left}%`, width: `${layout.width}%` }}
                              onClick={() => setBlockedBookingId(booking.id)}
                            >
                              <div className="room-booking-bar-title">{meta.label}</div>
                              <div className="room-booking-bar-meta">
                                <span>CI {formatDayMonth(booking.checkInAt)}</span>
                                <span>CO {formatDayMonth(booking.checkOutAt)}</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {blockedBookingId ? (
          <div className="room-booking-modal-overlay" role="dialog" aria-modal="true" onClick={() => setBlockedBookingId(null)}>
            <div className="room-booking-modal" onClick={(e) => e.stopPropagation()}>
              <div className="room-booking-modal-head">
                <div>
                  <div className="room-booking-editor-title">No permission</div>
                  <div className="muted">This shared calendar is read-only.</div>
                </div>
                <button className="btn" type="button" onClick={() => setBlockedBookingId(null)}>
                  Close
                </button>
              </div>
              <div className="room-booking-modal-body">
                <div className="card detail-card">
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Booking details are restricted</div>
                  <div className="muted">You can view the villa schedule here, but you do not have permission to open booking details.</div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
