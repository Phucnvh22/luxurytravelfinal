import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { Room, RoomBookingRequest, RoomBookingResponse, RoomBookingStatus } from '../types'
import './pages.css'
import './admin-room-bookings.css'

type StatusMeta = {
  label: string
  toneClass: string
}

type VisibleRoomBookingStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT'
type ScheduleBooking = RoomBookingResponse & {
  displayStatus: VisibleRoomBookingStatus
}

const STATUS_META: Record<VisibleRoomBookingStatus, StatusMeta> = {
  CONFIRMED: { label: 'Reserved', toneClass: 'reserved' },
  CHECKED_IN: { label: 'Check-in', toneClass: 'checked-in' },
  CHECKED_OUT: { label: 'Check-out', toneClass: 'checked-out' },
}

const ALL_STATUSES = Object.keys(STATUS_META) as VisibleRoomBookingStatus[]
const FALLBACK_ROOM_CODE = 'P.101'
const DAY_DURATION_MS = 24 * 60 * 60 * 1000

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

function toDateTimeLocalValue(value: Date) {
  return `${toIsoDate(value)}T${pad(value.getHours())}:${pad(value.getMinutes())}`
}

function toInputValue(value?: string) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return toDateTimeLocalValue(parsed)
}

function buildDefaultForm(monthStart: Date, roomCode = FALLBACK_ROOM_CODE): RoomBookingRequest {
  const checkInAt = new Date(monthStart)
  checkInAt.setHours(14, 0, 0, 0)
  const checkOutAt = addDays(checkInAt, 1)
  checkOutAt.setHours(12, 0, 0, 0)

  return {
    roomCode,
    guestName: '',
    source: 'Direct',
    phone: '',
    adults: 2,
    children: 0,
    checkInAt: toDateTimeLocalValue(checkInAt),
    checkOutAt: toDateTimeLocalValue(checkOutAt),
    status: 'CONFIRMED',
    notes: '',
  }
}

function normalizeDisplayStatus(status: RoomBookingStatus): VisibleRoomBookingStatus | null {
  if (status === 'CHECKED_IN' || status === 'CHECKED_OUT' || status === 'CONFIRMED') {
    return status
  }
  if (status === 'PENDING') {
    return 'CONFIRMED'
  }
  return null
}

function normalizeEditableStatus(status: RoomBookingStatus): VisibleRoomBookingStatus {
  return normalizeDisplayStatus(status) ?? 'CONFIRMED'
}

function mapBookingToForm(booking: RoomBookingResponse): RoomBookingRequest {
  return {
    roomCode: booking.roomCode,
    guestName: booking.guestName,
    source: booking.source,
    phone: booking.phone,
    adults: booking.adults,
    children: booking.children,
    checkInAt: toInputValue(booking.checkInAt),
    checkOutAt: toInputValue(booking.checkOutAt),
    status: normalizeEditableStatus(booking.status),
    notes: booking.notes,
  }
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

function toMonthInputValue(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}`
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(parsed)
}

function formatTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

function countGuests(booking: RoomBookingResponse) {
  const total = booking.adults + booking.children
  return `${total} khach`
}

function sortBookingsByTime<T extends RoomBookingResponse>(items: T[]) {
  return [...items].sort(
    (a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime() || a.id - b.id,
  )
}

function getBookingBarLayout(booking: RoomBookingResponse, trackStartMs: number, trackDurationMs: number) {
  const start = startOfDay(new Date(booking.checkInAt)).getTime()
  const endCandidate = startOfDay(new Date(booking.checkOutAt)).getTime()
  const end = endCandidate > start ? endCandidate : start + DAY_DURATION_MS
  const trackEndMs = trackStartMs + trackDurationMs
  const clampedStart = Math.max(start, trackStartMs)
  const clampedEnd = Math.min(end, trackEndMs)

  if (clampedEnd <= clampedStart) return null

  return {
    left: ((clampedStart - trackStartMs) / trackDurationMs) * 100,
    width: Math.max(((clampedEnd - clampedStart) / trackDurationMs) * 100, 4),
  }
}

function getCleaningGapLayout(
  currentBooking: RoomBookingResponse,
  nextBooking: RoomBookingResponse,
  trackStartMs: number,
  trackDurationMs: number,
) {
  const gapStart = new Date(currentBooking.checkOutAt).getTime()
  const gapEnd = new Date(nextBooking.checkInAt).getTime()
  const trackEndMs = trackStartMs + trackDurationMs

  if (gapEnd <= gapStart) return null

  const clampedStart = Math.max(gapStart, trackStartMs)
  const clampedEnd = Math.min(gapEnd, trackEndMs)
  if (clampedEnd <= clampedStart) return null

  return {
    left: (((clampedStart + clampedEnd) / 2 - trackStartMs) / trackDurationMs) * 100,
    compact: clampedEnd - clampedStart < DAY_DURATION_MS / 3,
    title: `Don phong: ${formatDateTime(currentBooking.checkOutAt)} → ${formatDateTime(nextBooking.checkInAt)}`,
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    if (error.body?.fields) return Object.values(error.body.fields).join(', ')
    return error.message
  }
  return fallback
}

export default function AdminRoomBookingsPage() {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [roomsCatalog, setRoomsCatalog] = useState<Room[]>([])
  const [bookings, setBookings] = useState<RoomBookingResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeStatuses, setActiveStatuses] = useState<VisibleRoomBookingStatus[]>(ALL_STATUSES)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<RoomBookingRequest>(() => buildDefaultForm(startOfMonth(new Date())))
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const loadingRef = useRef(false)

  const monthStart = useMemo(() => startOfMonth(monthCursor), [monthCursor])
  const monthEnd = useMemo(() => endOfMonth(monthCursor), [monthCursor])
  const monthDays = useMemo(() => {
    const totalDays = monthEnd.getDate()
    return Array.from({ length: totalDays }, (_, index) => addDays(monthStart, index))
  }, [monthEnd, monthStart])
  const roomByCode = useMemo(() => {
    const entries = roomsCatalog.map((room) => [room.code, room] as const)
    return Object.fromEntries(entries) as Record<string, Room>
  }, [roomsCatalog])

  async function load(opts?: { silent?: boolean }) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const [bookingsData, roomsData] = await Promise.all([
        apiFetch<RoomBookingResponse[]>(`/api/admin/room-bookings?from=${toIsoDate(monthStart)}&to=${toIsoDate(monthEnd)}`),
        apiFetch<Room[]>('/api/admin/rooms'),
      ])
      setBookings(bookingsData)
      setRoomsCatalog(roomsData)
      setError(null)
    } catch (e: unknown) {
      if (!opts?.silent) {
        setError(getErrorMessage(e, 'Khong the tai lich dat phong'))
      }
    } finally {
      if (!opts?.silent) setLoading(false)
      loadingRef.current = false
    }
  }

  useEffect(() => {
    void load()
  }, [monthStart, monthEnd])

  useEffect(() => {
    if (editingId) return
    if (roomsCatalog.length === 0) return
    setForm((current) => {
      if (current.roomCode && roomsCatalog.some((room) => room.code === current.roomCode)) {
        return current
      }
      return { ...current, roomCode: roomsCatalog[0].code }
    })
  }, [editingId, roomsCatalog])

  const statusCounts = useMemo(() => {
    return bookings.reduce<Record<VisibleRoomBookingStatus, number>>((acc, booking) => {
      const visibleStatus = normalizeDisplayStatus(booking.status)
      if (!visibleStatus) return acc
      acc[visibleStatus] = (acc[visibleStatus] ?? 0) + 1
      return acc
    }, { CONFIRMED: 0, CHECKED_IN: 0, CHECKED_OUT: 0 })
  }, [bookings])

  const filteredBookings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return bookings.flatMap<ScheduleBooking>((booking) => {
      const visibleStatus = normalizeDisplayStatus(booking.status)
      if (!visibleStatus) return []

      const matchesStatus = activeStatuses.includes(visibleStatus)
      if (!matchesStatus) return []
      if (!normalizedSearch) return [{ ...booking, displayStatus: visibleStatus }]
      const haystack = [
        booking.roomCode,
        roomByCode[booking.roomCode]?.name ?? '',
        roomByCode[booking.roomCode]?.type ?? '',
        booking.guestName,
        booking.source,
        booking.phone,
        booking.notes,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(normalizedSearch)) return []
      return [{ ...booking, displayStatus: visibleStatus }]
    })
  }, [activeStatuses, bookings, roomByCode, searchTerm])

  const rooms = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const catalogCodes = roomsCatalog
      .filter((room) => {
        if (!normalizedSearch) return true
        const haystack = [room.code, room.name, room.type, room.notes].join(' ').toLowerCase()
        return haystack.includes(normalizedSearch)
      })
      .map((room) => room.code)
    const bookingCodes = filteredBookings.map((booking) => booking.roomCode)
    const uniqueRooms = Array.from(new Set([...catalogCodes, ...bookingCodes].filter(Boolean)))

    return uniqueRooms.sort((a, b) => {
      const roomA = roomByCode[a]
      const roomB = roomByCode[b]
      if (roomA && roomB) {
        return roomA.floorNumber - roomB.floorNumber || roomA.code.localeCompare(roomB.code, 'vi-VN', { numeric: true })
      }
      if (roomA) return -1
      if (roomB) return 1
      return a.localeCompare(b, 'vi-VN', { numeric: true })
    })
  }, [filteredBookings, roomByCode, roomsCatalog, searchTerm])

  const roomOptions = useMemo(() => {
    return Array.from(new Set([...roomsCatalog.map((room) => room.code), ...bookings.map((booking) => booking.roomCode)]))
      .sort((a, b) => {
        const roomA = roomByCode[a]
        const roomB = roomByCode[b]
        if (roomA && roomB) {
          return roomA.floorNumber - roomB.floorNumber || roomA.code.localeCompare(roomB.code, 'vi-VN', { numeric: true })
        }
        if (roomA) return -1
        if (roomB) return 1
        return a.localeCompare(b, 'vi-VN', { numeric: true })
      })
  }, [bookings, roomByCode, roomsCatalog])

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

  const resetForm = () => {
    setEditingId(null)
    setForm(buildDefaultForm(monthStart, roomsCatalog[0]?.code ?? FALLBACK_ROOM_CODE))
    setFormError(null)
  }

  const editBooking = (booking: RoomBookingResponse) => {
    setEditingId(booking.id)
    setForm(mapBookingToForm(booking))
    setFormError(null)
  }

  const toggleStatus = (status: VisibleRoomBookingStatus) => {
    setActiveStatuses((current) => {
      if (current.includes(status)) {
        if (current.length === 1) return ALL_STATUSES
        return current.filter((value) => value !== status)
      }
      return [...current, status]
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setFormError(null)

    const payload: RoomBookingRequest = {
      roomCode: form.roomCode.trim(),
      guestName: form.guestName.trim(),
      source: form.source?.trim() || 'Direct',
      phone: form.phone?.trim() || '',
      adults: Number(form.adults),
      children: Number(form.children),
      checkInAt: form.checkInAt,
      checkOutAt: form.checkOutAt,
      status: form.status,
      notes: form.notes?.trim() || '',
    }

    try {
      const endpoint = editingId ? `/api/admin/room-bookings/${editingId}` : '/api/admin/room-bookings'
      const method = editingId ? 'PUT' : 'POST'
      const saved = await apiFetch<RoomBookingResponse>(endpoint, {
        method,
        body: JSON.stringify(payload),
      })
      setEditingId(saved.id)
      setForm(mapBookingToForm(saved))
      await load()
    } catch (e: unknown) {
      setFormError(getErrorMessage(e, 'Khong the luu dat phong'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingId) return
    if (!window.confirm('Xoa lich dat phong nay?')) return

    setDeleting(true)
    setFormError(null)
    try {
      await apiFetch<void>(`/api/admin/room-bookings/${editingId}`, { method: 'DELETE' })
      resetForm()
      await load()
    } catch (e: unknown) {
      setFormError(getErrorMessage(e, 'Khong the xoa dat phong'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="section">
      <div className="container">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <Link to="/" className="btn">
              ← Home
            </Link>
            <Link to="/admin/bookings" className="btn">
              Bookings
            </Link>
            <Link to="/admin/rooms" className="btn">
              Danh muc phong
            </Link>
          </div>
          <div className="row">
            <button className="btn" type="button" onClick={() => setMonthCursor(startOfMonth(new Date()))}>
              Thang hien tai
            </button>
            <button className="btn primary" type="button" onClick={resetForm}>
              Them dat phong
            </button>
          </div>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>Admin • Lich dat phong</h2>
            <div className="muted">Quan ly lich check-in / check-out theo thang, co cuon ngang va cap nhat truc tiep.</div>
          </div>
          <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
            Tai lai
          </button>
        </div>

        <div className="room-bookings-toolbar card detail-card">
          <div className="row room-bookings-toolbar-top">
            <div className="search-inline room-bookings-search">
              <input
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tim khach hang, phong, nguon dat..."
              />
            </div>

            <div className="room-bookings-week-nav">
              <button className="btn" type="button" onClick={() => setMonthCursor((current) => addMonths(current, -1))}>
                ←
              </button>
              <div className="room-bookings-week-label">
                <div className="room-bookings-week-title">Chon thang</div>
                <div className="room-bookings-week-range">{formatMonthLabel(monthCursor)}</div>
              </div>
              <label className="field room-bookings-month-field">
                <input
                  className="input"
                  type="month"
                  value={toMonthInputValue(monthCursor)}
                  onChange={(e) => {
                    const [year, month] = e.target.value.split('-').map(Number)
                    if (!year || !month) return
                    setMonthCursor(new Date(year, month - 1, 1))
                  }}
                />
              </label>
              <div className="room-bookings-week-label room-bookings-range-pill">
                <div className="room-bookings-week-title">Pham vi</div>
                <div className="room-bookings-week-range">{formatDateRange(monthStart, monthEnd)}</div>
              </div>
              <button className="btn" type="button" onClick={() => setMonthCursor((current) => addMonths(current, 1))}>
                →
              </button>
            </div>
          </div>

          <div className="room-bookings-status-row">
            {ALL_STATUSES.map((status) => {
              const meta = STATUS_META[status]
              const active = activeStatuses.includes(status)
              return (
                <button
                  key={status}
                  type="button"
                  className={`room-bookings-status-pill ${meta.toneClass} ${active ? 'active' : ''}`}
                  onClick={() => toggleStatus(status)}
                >
                  <span className="room-bookings-status-dot" />
                  <span>{meta.label}</span>
                  <strong>{statusCounts[status] ?? 0}</strong>
                </button>
              )
            })}
          </div>
        </div>

        <div className="room-bookings-layout">
          <div className="card detail-card room-schedule-card">
            {loading ? (
              <div className="card detail-card muted">Dang tai lich dat phong...</div>
            ) : error ? (
              <div className="card error">
                <div className="error-title">Khong the tai du lieu</div>
                <div className="muted">{error}</div>
              </div>
            ) : rooms.length === 0 ? (
              <div className="card detail-card muted">Chua co phong nao trong bo loc hien tai.</div>
            ) : (
              <div className="room-schedule-body room-schedule-scroll">
                <div className="room-schedule-table" style={scheduleGridStyle}>
                  <div className="room-schedule-header">
                    <div className="room-schedule-room-head">Phong</div>
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

                  {rooms.map((roomCode) => {
                    const roomBookings = sortBookingsByTime(filteredBookings.filter((booking) => booking.roomCode === roomCode))
                    return (
                      <div key={roomCode} className="room-schedule-row">
                        <div className="room-schedule-room-cell">
                          <div>
                            <div>{roomCode}</div>
                            {roomByCode[roomCode]?.name ? (
                              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                {roomByCode[roomCode].name}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="room-schedule-track">
                          <div className="room-schedule-grid">
                            {monthDays.map((day) => (
                              <div key={`${roomCode}-${day.toISOString()}`} className="room-schedule-grid-cell" />
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
                                className={`room-booking-bar ${meta.toneClass} ${editingId === booking.id ? 'selected' : ''}`}
                                style={{ left: `${layout.left}%`, width: `${layout.width}%` }}
                                onClick={() => editBooking(booking)}
                              >
                                <div className="room-booking-bar-title">{booking.guestName}</div>
                                <div className="room-booking-bar-meta">
                                  <span>{booking.source}</span>
                                  <span>
                                    {formatTime(booking.checkInAt)} - {formatTime(booking.checkOutAt)}
                                  </span>
                                </div>
                              </button>
                            )
                          })}

                          {roomBookings.slice(0, -1).map((booking, index) => {
                            const nextBooking = roomBookings[index + 1]
                            const gapLayout = getCleaningGapLayout(booking, nextBooking, trackStartMs, trackDurationMs)
                            if (!gapLayout) return null

                            return (
                              <div
                                key={`cleaning-${booking.id}-${nextBooking.id}`}
                                className={`room-cleaning-gap ${gapLayout.compact ? 'compact' : ''}`}
                                style={{ left: `${gapLayout.left}%` }}
                                title={gapLayout.title}
                                aria-label={gapLayout.title}
                              />
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

          <div className="room-bookings-side">
            <div className="card detail-card room-booking-editor">
              <div className="room-booking-editor-head">
                <div>
                  <div className="room-booking-editor-title">{editingId ? 'Cap nhat dat phong' : 'Tao dat phong moi'}</div>
                  <div className="muted">
                    {editingId ? `Ma lich #${editingId}` : 'Nhap thong tin de them mot block vao lich theo phong.'}
                  </div>
                </div>
                {editingId ? (
                  <button className="btn" type="button" onClick={resetForm}>
                    Tao moi
                  </button>
                ) : null}
              </div>

              <div className="row">
                <label className="field" style={{ flex: 1, minWidth: 160 }}>
                  <div className="field-label">Phong</div>
                  <select
                    className="select"
                    value={form.roomCode}
                    onChange={(e) => setForm((current) => ({ ...current, roomCode: e.target.value }))}
                  >
                    {roomOptions.map((roomCode) => {
                      const room = roomByCode[roomCode]
                      const suffix = room ? ` - ${room.name}` : ''
                      return (
                        <option key={roomCode} value={roomCode}>
                          {roomCode}{suffix}
                        </option>
                      )
                    })}
                  </select>
                </label>
                <label className="field" style={{ flex: 1, minWidth: 180 }}>
                  <div className="field-label">Trang thai</div>
                  <select
                    className="select"
                    value={form.status}
                    onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as VisibleRoomBookingStatus }))}
                  >
                    {ALL_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_META[status].label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field">
                <div className="field-label">Ten khach</div>
                <input
                  className="input"
                  value={form.guestName}
                  onChange={(e) => setForm((current) => ({ ...current, guestName: e.target.value }))}
                  placeholder="Nguyen Van A"
                />
              </label>

              <div className="row">
                <label className="field" style={{ flex: 1, minWidth: 160 }}>
                  <div className="field-label">Nguon dat</div>
                  <input
                    className="input"
                    value={form.source}
                    onChange={(e) => setForm((current) => ({ ...current, source: e.target.value }))}
                    placeholder="Booking.com / Zalo / Direct"
                  />
                </label>
                <label className="field" style={{ flex: 1, minWidth: 160 }}>
                  <div className="field-label">So dien thoai</div>
                  <input
                    className="input"
                    value={form.phone}
                    onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                    placeholder="090..."
                  />
                </label>
              </div>

              <div className="row">
                <label className="field" style={{ flex: 1, minWidth: 160 }}>
                  <div className="field-label">Check-in</div>
                  <input
                    className="input"
                    type="datetime-local"
                    value={form.checkInAt}
                    onChange={(e) => setForm((current) => ({ ...current, checkInAt: e.target.value }))}
                  />
                </label>
                <label className="field" style={{ flex: 1, minWidth: 160 }}>
                  <div className="field-label">Check-out</div>
                  <input
                    className="input"
                    type="datetime-local"
                    value={form.checkOutAt}
                    onChange={(e) => setForm((current) => ({ ...current, checkOutAt: e.target.value }))}
                  />
                </label>
              </div>

              <div className="row">
                <label className="field" style={{ flex: 1, minWidth: 120 }}>
                  <div className="field-label">Nguoi lon</div>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={form.adults}
                    onChange={(e) => setForm((current) => ({ ...current, adults: Number(e.target.value) }))}
                  />
                </label>
                <label className="field" style={{ flex: 1, minWidth: 120 }}>
                  <div className="field-label">Tre em</div>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={form.children}
                    onChange={(e) => setForm((current) => ({ ...current, children: Number(e.target.value) }))}
                  />
                </label>
              </div>

              <label className="field">
                <div className="field-label">Ghi chu</div>
                <textarea
                  className="textarea"
                  value={form.notes}
                  onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                  placeholder="Ghi chu noi bo, tinh trang coc, yeu cau khach..."
                />
              </label>

              {formError ? (
                <div className="card error" style={{ marginTop: 12 }}>
                  <div className="error-title">Khong the luu</div>
                  <div className="muted">{formError}</div>
                </div>
              ) : null}

              <div className="row room-booking-editor-actions">
                <button className="btn primary" type="button" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? 'Dang luu...' : editingId ? 'Cap nhat' : 'Tao dat phong'}
                </button>
                {editingId ? (
                  <button className="btn danger" type="button" onClick={() => void handleDelete()} disabled={deleting}>
                    {deleting ? 'Dang xoa...' : 'Xoa'}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="card detail-card room-bookings-list">
              <div className="room-booking-editor-title">Danh sach trong thang</div>
              <div className="muted" style={{ marginBottom: 12 }}>
                {filteredBookings.length} lich hien thi theo bo loc hien tai.
              </div>

              {filteredBookings.length === 0 ? (
                <div className="muted">Khong co dat phong nao khop bo loc.</div>
              ) : (
                <div className="room-bookings-list-items">
                  {sortBookingsByTime(filteredBookings)
                    .map((booking) => {
                      const meta = STATUS_META[booking.displayStatus]
                      return (
                        <button
                          key={booking.id}
                          type="button"
                          className={`room-bookings-list-item ${editingId === booking.id ? 'active' : ''}`}
                          onClick={() => editBooking(booking)}
                        >
                          <div className="room-bookings-list-top">
                            <strong>{booking.roomCode}</strong>
                            <span className={`room-bookings-list-badge ${meta.toneClass}`}>{meta.label}</span>
                          </div>
                          <div>{booking.guestName}</div>
                          <div className="muted">{formatDateTime(booking.checkInAt)} → {formatDateTime(booking.checkOutAt)}</div>
                          <div className="muted">{booking.source} • {countGuests(booking)}</div>
                        </button>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
