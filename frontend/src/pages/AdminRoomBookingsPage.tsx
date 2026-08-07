import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { Room, RoomBookingRequest, RoomBookingResponse, RoomBookingStatus } from '../types'
import './pages.css'
import './admin-room-bookings.css'

type StatusMeta = {
  label: string
  toneClass: string
}

const STATUS_META: Record<RoomBookingStatus, StatusMeta> = {
  PENDING: { label: 'Cho xac nhan', toneClass: 'pending' },
  CONFIRMED: { label: 'Da xac nhan', toneClass: 'confirmed' },
  CHECKED_IN: { label: 'Dang su dung', toneClass: 'checked-in' },
  CHECKED_OUT: { label: 'Da tra phong', toneClass: 'checked-out' },
  CANCELLED: { label: 'Da huy', toneClass: 'cancelled' },
}

const ALL_STATUSES = Object.keys(STATUS_META) as RoomBookingStatus[]
const FALLBACK_ROOM_CODE = 'P.101'
const TRACK_DURATION_MS = 7 * 24 * 60 * 60 * 1000

function startOfWeek(base: Date) {
  const value = new Date(base)
  const day = value.getDay()
  const delta = day === 0 ? -6 : 1 - day
  value.setDate(value.getDate() + delta)
  value.setHours(0, 0, 0, 0)
  return value
}

function addDays(base: Date, days: number) {
  const value = new Date(base)
  value.setDate(value.getDate() + days)
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

function buildDefaultForm(weekStart: Date, roomCode = FALLBACK_ROOM_CODE): RoomBookingRequest {
  const checkInAt = new Date(weekStart)
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
    status: 'PENDING',
    notes: '',
  }
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
    status: booking.status,
    notes: booking.notes,
  }
}

function formatDayLabel(value: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    if (error.body?.fields) return Object.values(error.body.fields).join(', ')
    return error.message
  }
  return fallback
}

export default function AdminRoomBookingsPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [roomsCatalog, setRoomsCatalog] = useState<Room[]>([])
  const [bookings, setBookings] = useState<RoomBookingResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeStatuses, setActiveStatuses] = useState<RoomBookingStatus[]>(ALL_STATUSES)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<RoomBookingRequest>(() => buildDefaultForm(startOfWeek(new Date())))
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const loadingRef = useRef(false)

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  const weekEnd = weekDays[weekDays.length - 1]
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
        apiFetch<RoomBookingResponse[]>(`/api/admin/room-bookings?from=${toIsoDate(weekStart)}&to=${toIsoDate(weekEnd)}`),
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
  }, [weekStart])

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
    return bookings.reduce<Record<RoomBookingStatus, number>>((acc, booking) => {
      acc[booking.status] = (acc[booking.status] ?? 0) + 1
      return acc
    }, { PENDING: 0, CONFIRMED: 0, CHECKED_IN: 0, CHECKED_OUT: 0, CANCELLED: 0 })
  }, [bookings])

  const filteredBookings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return bookings.filter((booking) => {
      const matchesStatus = activeStatuses.includes(booking.status)
      if (!matchesStatus) return false
      if (!normalizedSearch) return true
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
      return haystack.includes(normalizedSearch)
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

  const trackStartMs = weekStart.getTime()
  const today = new Date()
  const isTodayInsideWeek = today >= weekStart && today < addDays(weekStart, 7)
  const todayMarkerLeft = isTodayInsideWeek ? ((today.getTime() - trackStartMs) / TRACK_DURATION_MS) * 100 : null

  const resetForm = () => {
    setEditingId(null)
    setForm(buildDefaultForm(weekStart, roomsCatalog[0]?.code ?? FALLBACK_ROOM_CODE))
    setFormError(null)
  }

  const editBooking = (booking: RoomBookingResponse) => {
    setEditingId(booking.id)
    setForm(mapBookingToForm(booking))
    setFormError(null)
  }

  const toggleStatus = (status: RoomBookingStatus) => {
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
            <button className="btn" type="button" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              Tuan hien tai
            </button>
            <button className="btn primary" type="button" onClick={resetForm}>
              Them dat phong
            </button>
          </div>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>Admin • Lich dat phong</h2>
            <div className="muted">Quan ly lich check-in / check-out theo tuan, co the tao sua xoa truc tiep.</div>
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
              <button className="btn" type="button" onClick={() => setWeekStart((current) => addDays(current, -7))}>
                ←
              </button>
              <div className="room-bookings-week-label">
                <div className="room-bookings-week-title">Khung tuan</div>
                <div className="room-bookings-week-range">{formatDateRange(weekStart, weekEnd)}</div>
              </div>
              <button className="btn" type="button" onClick={() => setWeekStart((current) => addDays(current, 7))}>
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
            <div className="room-schedule-header">
              <div className="room-schedule-room-head">Phong</div>
              <div className="room-schedule-days">
                {weekDays.map((day) => {
                  const isToday = toIsoDate(day) === toIsoDate(today)
                  return (
                    <div key={day.toISOString()} className={`room-schedule-day-head ${isToday ? 'is-today' : ''}`}>
                      <div>{formatDayLabel(day)}</div>
                    </div>
                  )
                })}
              </div>
            </div>

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
              <div className="room-schedule-body">
                {rooms.map((roomCode) => {
                  const roomBookings = filteredBookings.filter((booking) => booking.roomCode === roomCode)
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
                          {weekDays.map((day) => (
                            <div key={`${roomCode}-${day.toISOString()}`} className="room-schedule-grid-cell" />
                          ))}
                        </div>

                        {todayMarkerLeft !== null ? (
                          <div className="room-schedule-today-marker" style={{ left: `${todayMarkerLeft}%` }} />
                        ) : null}

                        {roomBookings.map((booking) => {
                          const bookingStart = new Date(booking.checkInAt).getTime()
                          const bookingEnd = new Date(booking.checkOutAt).getTime()
                          const clampedStart = Math.max(bookingStart, trackStartMs)
                          const clampedEnd = Math.min(bookingEnd, trackStartMs + TRACK_DURATION_MS)
                          const left = ((clampedStart - trackStartMs) / TRACK_DURATION_MS) * 100
                          const width = Math.max(((clampedEnd - clampedStart) / TRACK_DURATION_MS) * 100, 4)
                          const meta = STATUS_META[booking.status]

                          return (
                            <button
                              key={booking.id}
                              type="button"
                              className={`room-booking-bar ${meta.toneClass} ${editingId === booking.id ? 'selected' : ''}`}
                              style={{ left: `${left}%`, width: `${width}%` }}
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
                      </div>
                    </div>
                  )
                })}
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
                    onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as RoomBookingStatus }))}
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
              <div className="room-booking-editor-title">Danh sach trong tuan</div>
              <div className="muted" style={{ marginBottom: 12 }}>
                {filteredBookings.length} lich hien thi theo bo loc hien tai.
              </div>

              {filteredBookings.length === 0 ? (
                <div className="muted">Khong co dat phong nao khop bo loc.</div>
              ) : (
                <div className="room-bookings-list-items">
                  {[...filteredBookings]
                    .sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime() || a.id - b.id)
                    .map((booking) => {
                      const meta = STATUS_META[booking.status]
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
