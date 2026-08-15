import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'
import { apiFetch, HttpError } from '../lib/api'
import type { Room, RoomBookingRequest, RoomBookingResponse, RoomBookingStatus } from '../types'
import {
  buildGroupedScheduleRows,
  buildQuickBookingDateRange,
  compareRoomsByLocation,
  getBookedDateKeysForRoom,
  sortRoomCodesByLocation,
  toggleQuickBookingDate,
  validateQuickBookingSelection,
  type QuickBookingSelection,
} from './AdminRoomBookingsPage.utils'
import './pages.css'
import './admin-room-bookings.css'

type StatusMeta = {
  label: string
  toneClass: string
}

type RoomOperationalStatus = 'READY' | 'CHECKED_IN' | 'NEEDS_CLEANING'

type VisibleRoomBookingStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT'
type BookingModalMode = 'create' | 'details' | 'edit'
type ConfirmationLanguage = 'en' | 'vi'
type ScheduleBooking = RoomBookingResponse & {
  displayStatus: VisibleRoomBookingStatus
}

const STATUS_META: Record<VisibleRoomBookingStatus, StatusMeta> = {
  CONFIRMED: { label: 'Reserved', toneClass: 'reserved' },
  CHECKED_IN: { label: 'Check-in', toneClass: 'checked-in' },
  CHECKED_OUT: { label: 'Check-out', toneClass: 'checked-out' },
}

const ALL_STATUSES = Object.keys(STATUS_META) as VisibleRoomBookingStatus[]
const FALLBACK_ROOM_CODE = 'V107'
const DAY_DURATION_MS = 24 * 60 * 60 * 1000
const STANDARD_CHECK_IN_HOUR = 15
const STANDARD_CHECK_OUT_HOUR = 11

const CONFIRMATION_STATUS_LABELS: Record<ConfirmationLanguage, Record<VisibleRoomBookingStatus, string>> = {
  en: {
    CONFIRMED: 'Reserved',
    CHECKED_IN: 'Checked in',
    CHECKED_OUT: 'Checked out',
  },
  vi: {
    CONFIRMED: 'Đã đặt',
    CHECKED_IN: 'Đã nhận phòng',
    CHECKED_OUT: 'Đã trả phòng',
  },
}

const ROOM_OPERATIONAL_STATUS_META: Record<RoomOperationalStatus, StatusMeta> = {
  READY: { label: 'Ready', toneClass: 'ready' },
  CHECKED_IN: { label: 'Checked-in', toneClass: 'occupied' },
  NEEDS_CLEANING: { label: 'Needs cleaning', toneClass: 'needs-cleaning' },
}

function normalizeRoomOperationalStatus(status?: Room['operationalStatus']): RoomOperationalStatus {
  if (status === 'CHECKED_IN' || status === 'NEEDS_CLEANING') return status
  return 'READY'
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

function toDateTimeLocalValue(value: Date) {
  return `${toIsoDate(value)}T${pad(value.getHours())}:${pad(value.getMinutes())}`
}

function toDateInputValue(value?: string) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return toIsoDate(parsed)
}

function toInputValue(value?: string) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return toDateTimeLocalValue(parsed)
}

function toDateTimeValueForHour(dateValue: string, hour: number) {
  if (!dateValue) return ''
  return `${dateValue}T${pad(hour)}:00`
}

function nextCheckoutDateValue(checkInAt?: string) {
  if (!checkInAt) return ''
  const parsed = new Date(checkInAt)
  if (Number.isNaN(parsed.getTime())) return ''
  return toIsoDate(addDays(parsed, 1))
}

function toMoneyInputValue(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return ''
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
  }).format(value)
}

function parseMoneyInput(value?: number | string) {
  if (value === undefined || value === null || value === '') return undefined
  const parsed =
    typeof value === 'number'
      ? value
      : Number(
          value
            .replace(/[^\d]/g, '')
            .trim(),
        )
  return Number.isFinite(parsed) ? parsed : undefined
}

function calculateRemainingAmount(totalAmount?: number, depositAmount?: number, fallbackAmount?: number) {
  if (totalAmount === undefined || totalAmount === null || Number.isNaN(totalAmount)) {
    return fallbackAmount
  }
  return Math.max(totalAmount - (depositAmount ?? 0), 0)
}

function formatMoney(value?: number, language: ConfirmationLanguage = 'vi') {
  if (value === undefined || value === null || Number.isNaN(value)) return language === 'vi' ? 'TBA' : 'TBA'
  return new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}

function buildDefaultForm(monthStart: Date, roomCode = FALLBACK_ROOM_CODE): RoomBookingRequest {
  const checkInAt = new Date(monthStart)
  checkInAt.setHours(STANDARD_CHECK_IN_HOUR, 0, 0, 0)
  const checkOutAt = addDays(checkInAt, 1)
  checkOutAt.setHours(STANDARD_CHECK_OUT_HOUR, 0, 0, 0)

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
    villaRate: undefined,
    depositAmount: undefined,
    remainingAmount: undefined,
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
    villaRate: booking.villaRate,
    depositAmount: booking.depositAmount,
    remainingAmount: booking.remainingAmount,
    notes: booking.notes,
  }
}

function applyCheckInDateToForm(current: RoomBookingRequest, dateValue: string): RoomBookingRequest {
  const nextCheckInAt = toDateTimeValueForHour(dateValue, STANDARD_CHECK_IN_HOUR)
  const minCheckOutDate = nextCheckoutDateValue(nextCheckInAt)
  const currentCheckOutDate = toDateInputValue(current.checkOutAt)
  const nextCheckOutAt =
    !currentCheckOutDate || !minCheckOutDate || currentCheckOutDate < minCheckOutDate
      ? toDateTimeValueForHour(minCheckOutDate, STANDARD_CHECK_OUT_HOUR)
      : toDateTimeValueForHour(currentCheckOutDate, STANDARD_CHECK_OUT_HOUR)

  return {
    ...current,
    checkInAt: nextCheckInAt,
    checkOutAt: nextCheckOutAt,
  }
}

function applyCheckOutDateToForm(current: RoomBookingRequest, dateValue: string): RoomBookingRequest {
  return {
    ...current,
    checkOutAt: toDateTimeValueForHour(dateValue, STANDARD_CHECK_OUT_HOUR),
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

function formatDayMonth(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(parsed)
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

function formatDateOnly(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function countGuests(booking: RoomBookingResponse) {
  const total = booking.adults + booking.children
  return `${total} guests`
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
    width: ((clampedEnd - clampedStart) / trackDurationMs) * 100,
  }
}

function getDateRangeLayout(checkInAt: string, checkOutAt: string, trackStartMs: number, trackDurationMs: number) {
  const start = startOfDay(new Date(checkInAt)).getTime()
  const endCandidate = startOfDay(new Date(checkOutAt)).getTime()
  const end = endCandidate > start ? endCandidate : start + DAY_DURATION_MS
  const trackEndMs = trackStartMs + trackDurationMs
  const clampedStart = Math.max(start, trackStartMs)
  const clampedEnd = Math.min(end, trackEndMs)

  if (clampedEnd <= clampedStart) return null

  return {
    left: ((clampedStart - trackStartMs) / trackDurationMs) * 100,
    width: ((clampedEnd - clampedStart) / trackDurationMs) * 100,
    center: ((clampedStart + clampedEnd) / 2 - trackStartMs) / trackDurationMs * 100,
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
  const { language } = useI18n()
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [roomsCatalog, setRoomsCatalog] = useState<Room[]>([])
  const [bookings, setBookings] = useState<RoomBookingResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeStatuses, setActiveStatuses] = useState<VisibleRoomBookingStatus[]>(ALL_STATUSES)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null)
  const [bookingModalMode, setBookingModalMode] = useState<BookingModalMode | null>(null)
  const [showConfirmInformation, setShowConfirmInformation] = useState(false)
  const [confirmationLanguage, setConfirmationLanguage] = useState<ConfirmationLanguage>(() =>
    language === 'vi' ? 'vi' : 'en',
  )
  const [quickSelection, setQuickSelection] = useState<QuickBookingSelection | null>(null)
  const [form, setForm] = useState<RoomBookingRequest>(() => buildDefaultForm(startOfMonth(new Date())))
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const loadingRef = useRef(false)

  const monthStart = useMemo(() => startOfMonth(monthCursor), [monthCursor])
  const monthEnd = useMemo(() => endOfMonth(monthCursor), [monthCursor])
  const monthValue = monthCursor.getMonth()
  const yearValue = monthCursor.getFullYear()
  const monthDays = useMemo(() => {
    const totalDays = monthEnd.getDate()
    return Array.from({ length: totalDays }, (_, index) => addDays(monthStart, index))
  }, [monthEnd, monthStart])
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) => ({
        value: monthIndex,
        label: new Intl.DateTimeFormat('vi-VN', { month: 'long' }).format(new Date(2026, monthIndex, 1)),
      })),
    [],
  )
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 7 }, (_, index) => currentYear - 3 + index)
  }, [])
  const roomByCode = useMemo(() => {
    const entries = roomsCatalog.map((room) => [room.code, room] as const)
    return Object.fromEntries(entries) as Record<string, Room>
  }, [roomsCatalog])
  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking.id === selectedBookingId) ?? null,
    [bookings, selectedBookingId],
  )
  const selectedRoom = useMemo(
    () => (selectedBooking ? roomByCode[selectedBooking.roomCode] ?? null : null),
    [roomByCode, selectedBooking],
  )

  const updateMonthCursor = (nextMonth: number, nextYear: number) => {
    setMonthCursor(new Date(nextYear, nextMonth, 1))
  }

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

  useEffect(() => {
    if (!selectedBookingId) return
    if (bookings.some((booking) => booking.id === selectedBookingId)) return
    setSelectedBookingId(null)
    setBookingModalMode(null)
    setEditingId(null)
    setShowConfirmInformation(false)
  }, [bookings, selectedBookingId])

  useEffect(() => {
    if (showConfirmInformation) return
    setConfirmationLanguage(language === 'vi' ? 'vi' : 'en')
  }, [language, showConfirmInformation])

  useEffect(() => {
    setQuickSelection(null)
  }, [monthStart, monthEnd])

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
        roomByCode[booking.roomCode]?.host ?? '',
        roomByCode[booking.roomCode]?.location ?? '',
        roomByCode[booking.roomCode]?.bedroomLayout ?? '',
        roomByCode[booking.roomCode]?.airbnbUrl ?? '',
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
        const haystack = [room.code, room.name, room.type, room.host, room.location, room.bedroomLayout, room.notes, room.airbnbUrl]
          .join(' ')
          .toLowerCase()
        return haystack.includes(normalizedSearch)
      })
      .map((room) => room.code)
    const bookingCodes = filteredBookings.map((booking) => booking.roomCode)
    const uniqueRooms = Array.from(new Set([...catalogCodes, ...bookingCodes].filter(Boolean)))

    return sortRoomCodesByLocation(uniqueRooms, roomByCode)
  }, [filteredBookings, roomByCode, roomsCatalog, searchTerm])

  const roomOptions = useMemo(() => {
    return Array.from(new Set([...roomsCatalog.map((room) => room.code), ...bookings.map((booking) => booking.roomCode)]))
      .sort((a, b) => compareRoomsByLocation(roomByCode[a], roomByCode[b], a, b))
  }, [bookings, roomByCode, roomsCatalog])

  const groupedScheduleRows = useMemo(() => {
    return buildGroupedScheduleRows(rooms, roomByCode)
  }, [roomByCode, rooms])

  const bookedDateKeysByRoom = useMemo(() => {
    return Object.fromEntries(rooms.map((roomCode) => [roomCode, getBookedDateKeysForRoom(bookings, roomCode)])) as Record<
      string,
      Set<string>
    >
  }, [bookings, rooms])

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

  const closeBookingModal = () => {
    setBookingModalMode(null)
    setSelectedBookingId(null)
    setShowConfirmInformation(false)
    setFormError(null)
    setEditingId(null)
  }

  const openCreateBookingModal = () => {
    resetForm()
    setSelectedBookingId(null)
    setBookingModalMode('create')
    setShowConfirmInformation(false)
  }

  const handleQuickDateSelect = (roomCode: string, dateKey: string) => {
    setQuickSelection((current) => toggleQuickBookingDate(current, roomCode, dateKey, bookedDateKeysByRoom[roomCode] ?? new Set()))
  }

  const openQuickCreateBookingModal = () => {
    const validationError = validateQuickBookingSelection(quickSelection)
    if (validationError) {
      return
    }
    if (!quickSelection) return

    const range = buildQuickBookingDateRange(quickSelection, STANDARD_CHECK_IN_HOUR, STANDARD_CHECK_OUT_HOUR)
    if (!range) {
      return
    }

    setForm({
      ...buildDefaultForm(monthStart, quickSelection.roomCode),
      roomCode: quickSelection.roomCode,
      checkInAt: range.checkInAt,
      checkOutAt: range.checkOutAt,
    })
    setFormError(null)
    setSelectedBookingId(null)
    setBookingModalMode('create')
    setShowConfirmInformation(false)
  }

  const openBookingDetails = (booking: RoomBookingResponse) => {
    setSelectedBookingId(booking.id)
    setBookingModalMode('details')
    setShowConfirmInformation(false)
    setFormError(null)
    setEditingId(null)
  }

  const editBooking = (booking: RoomBookingResponse) => {
    setEditingId(booking.id)
    setSelectedBookingId(booking.id)
    setForm(mapBookingToForm(booking))
    setBookingModalMode('edit')
    setShowConfirmInformation(false)
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
    const villaRate = parseMoneyInput(form.villaRate)
    const depositAmount = parseMoneyInput(form.depositAmount)
    const remainingAmount = calculateRemainingAmount(villaRate, depositAmount, parseMoneyInput(form.remainingAmount))

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
      villaRate,
      depositAmount,
      remainingAmount,
      notes: form.notes?.trim() || '',
    }

    try {
      const endpoint = editingId ? `/api/admin/room-bookings/${editingId}` : '/api/admin/room-bookings'
      const method = editingId ? 'PUT' : 'POST'
      const saved = await apiFetch<RoomBookingResponse>(endpoint, {
        method,
        body: JSON.stringify(payload),
      })
      setQuickSelection(null)
      setEditingId(saved.id)
      setSelectedBookingId(saved.id)
      setForm(mapBookingToForm(saved))
      setBookingModalMode('details')
      setShowConfirmInformation(false)
      await load({ silent: true })
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
      setSelectedBookingId(null)
      closeBookingModal()
      await load({ silent: true })
    } catch (e: unknown) {
      setFormError(getErrorMessage(e, 'Khong the xoa dat phong'))
    } finally {
      setDeleting(false)
    }
  }

  const runBookingAction = async (action: 'check-in' | 'check-out') => {
    if (!selectedBooking) return
    setActionLoading(action)
    setFormError(null)
    try {
      await apiFetch<RoomBookingResponse>(`/api/admin/room-bookings/${selectedBooking.id}/${action}`, {
        method: 'POST',
      })
      await load({ silent: true })
    } catch (e: unknown) {
      setFormError(getErrorMessage(e, `Khong the ${action} booking`))
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkReady = async () => {
    if (!selectedRoom) return
    setActionLoading('mark-ready')
    setFormError(null)
    try {
      await apiFetch<Room>(`/api/admin/rooms/${selectedRoom.id}/mark-ready`, {
        method: 'POST',
      })
      await load({ silent: true })
    } catch (e: unknown) {
      setFormError(getErrorMessage(e, 'Khong the cap nhat trang thai san sang'))
    } finally {
      setActionLoading(null)
    }
  }

  const checkInDateValue = toDateInputValue(form.checkInAt)
  const checkOutDateValue = toDateInputValue(form.checkOutAt)
  const minCheckOutDateValue = nextCheckoutDateValue(form.checkInAt)
  const quickSelectionDates = quickSelection?.dates ?? []
  const quickSelectionRoom = quickSelection ? roomByCode[quickSelection.roomCode] : null
  const quickSelectionRange = quickSelection
    ? buildQuickBookingDateRange(quickSelection, STANDARD_CHECK_IN_HOUR, STANDARD_CHECK_OUT_HOUR)
    : null
  const quickSelectionLayout = quickSelectionRange
    ? getDateRangeLayout(quickSelectionRange.checkInAt, quickSelectionRange.checkOutAt, trackStartMs, trackDurationMs)
    : null

  const confirmationSource =
    bookingModalMode === 'details' && selectedBooking
      ? {
          roomCode: selectedBooking.roomCode,
          guestName: selectedBooking.guestName,
          source: selectedBooking.source,
          phone: selectedBooking.phone,
          adults: selectedBooking.adults,
          children: selectedBooking.children,
          villaRate: selectedBooking.villaRate,
          depositAmount: selectedBooking.depositAmount,
          remainingAmount: selectedBooking.remainingAmount,
          checkInAt: selectedBooking.checkInAt,
          checkOutAt: selectedBooking.checkOutAt,
          status: normalizeEditableStatus(selectedBooking.status),
          notes: selectedBooking.notes,
        }
      : form

  const selectedStatusMeta =
    selectedBooking && bookingModalMode === 'details'
      ? STATUS_META[normalizeEditableStatus(selectedBooking.status)]
      : STATUS_META[normalizeEditableStatus(confirmationSource.status)]
  const selectedRoomStatus = normalizeRoomOperationalStatus(selectedRoom?.operationalStatus)
  const selectedRoomStatusMeta = ROOM_OPERATIONAL_STATUS_META[selectedRoomStatus]
  const confirmationRoomName = roomByCode[confirmationSource.roomCode]?.name || 'Luxury Villa'
  const confirmationCheckInMs = new Date(confirmationSource.checkInAt).getTime()
  const confirmationCheckOutMs = new Date(confirmationSource.checkOutAt).getTime()
  const confirmationNights =
    Number.isNaN(confirmationCheckInMs) || Number.isNaN(confirmationCheckOutMs)
      ? 0
      : Math.max(1, Math.round((confirmationCheckOutMs - confirmationCheckInMs) / DAY_DURATION_MS))
  const confirmationNotes = confirmationSource.notes?.trim() || ''
  const confirmationRoom = roomByCode[confirmationSource.roomCode]
  const confirmationStatusLabel =
    CONFIRMATION_STATUS_LABELS[confirmationLanguage][normalizeEditableStatus(confirmationSource.status)]
  const confirmationBookingId = selectedBooking?.id ? `#${selectedBooking.id}` : confirmationLanguage === 'vi' ? 'TBA' : 'TBA'
  const confirmationVillaType = [confirmationRoom?.location, confirmationRoom?.type].filter(Boolean).join(' • ') ||
    (confirmationLanguage === 'vi' ? 'Chưa cập nhật' : 'TBA')
  const confirmationVillaRateValue = parseMoneyInput(confirmationSource.villaRate)
  const confirmationDepositAmountValue = parseMoneyInput(confirmationSource.depositAmount)
  const confirmationRemainingAmountValue = calculateRemainingAmount(
    confirmationVillaRateValue,
    confirmationDepositAmountValue,
    parseMoneyInput(confirmationSource.remainingAmount),
  )
  const confirmationTotalAmountValue = confirmationVillaRateValue
  const confirmationVillaRate = formatMoney(confirmationVillaRateValue, confirmationLanguage)
  const confirmationTotalAmount = formatMoney(confirmationTotalAmountValue, confirmationLanguage)
  const confirmationDepositAmount = formatMoney(confirmationDepositAmountValue, confirmationLanguage)
  const confirmationRemainingAmount = formatMoney(confirmationRemainingAmountValue, confirmationLanguage)
  const confirmationPaymentStatus =
    confirmationRemainingAmountValue !== undefined && confirmationRemainingAmountValue <= 0
      ? confirmationLanguage === 'vi'
        ? 'Đã thanh toán đủ'
        : 'Paid in full'
      : confirmationDepositAmountValue !== undefined && confirmationDepositAmountValue > 0
        ? confirmationLanguage === 'vi'
          ? 'Đã cọc'
          : 'Deposit paid'
        : confirmationLanguage === 'vi'
          ? 'Chưa cập nhật'
          : 'Pending update'
  const confirmationSupportText =
    confirmationLanguage === 'vi'
      ? 'Hỗ trợ 24/7 qua WhatsApp.'
      : '24/7 support via WhatsApp.'
  const confirmationIncludedText =
    confirmationLanguage === 'vi'
      ? 'Trái cây và nước uống ngày nhận phòng, internet, hồ bơi riêng, dọn phòng hằng ngày, buggy 08:00 - 22:00.'
      : 'Welcome fruit and drinks, internet, private pool, daily housekeeping, buggy 08:00 - 22:00.'
  const confirmationImportantText =
    confirmationLanguage === 'vi'
      ? 'Nhận phòng sau 15:00, trả phòng trước 11:00, không hút thuốc, giữ yên lặng 22:00 - 06:00.'
      : 'Check-in after 15:00, check-out before 11:00, no smoking, quiet hours 22:00 - 06:00.'
  const confirmationPrimaryRows =
    confirmationLanguage === 'vi'
      ? [
          ['Nơi lưu trú', confirmationRoomName],
          ['Mã xác nhận', confirmationBookingId],
          ['Tên khách', confirmationSource.guestName || 'TBA'],
          ['Ngày nhận phòng', confirmationSource.checkInAt ? formatDateOnly(confirmationSource.checkInAt) : 'TBA'],
          ['Ngày trả phòng', confirmationSource.checkOutAt ? formatDateOnly(confirmationSource.checkOutAt) : 'TBA'],
          ['Số đêm lưu trú', `${confirmationNights || 0}`],
          ['Số lượng biệt thự', '1'],
        ]
      : [
          ['Accommodation', confirmationRoomName],
          ['Confirmation No.', confirmationBookingId],
          ['Guest', confirmationSource.guestName || 'TBA'],
          ['Check-in date', confirmationSource.checkInAt ? formatDateOnly(confirmationSource.checkInAt) : 'TBA'],
          ['Check-out date', confirmationSource.checkOutAt ? formatDateOnly(confirmationSource.checkOutAt) : 'TBA'],
          ['Length of stay', `${confirmationNights || 0}`],
          ['Number of villas', '1'],
        ]
  const confirmationSecondaryRows =
    confirmationLanguage === 'vi'
      ? [
          ['Mã biệt thự', confirmationSource.roomCode || 'TBA'],
          ['Loại biệt thự', confirmationVillaType],
          ['Giá biệt thự', confirmationVillaRate],
          ['Tổng tiền', confirmationTotalAmount],
          ['Đã cọc', confirmationDepositAmount],
          ['Còn lại', confirmationRemainingAmount],
          ['Tình trạng thanh toán', confirmationPaymentStatus],
        ]
      : [
          ['Villa code', confirmationSource.roomCode || 'TBA'],
          ['Villa type', confirmationVillaType],
          ['Villa rate', confirmationVillaRate],
          ['Total amount', confirmationTotalAmount],
          ['Deposit paid', confirmationDepositAmount],
          ['Remaining balance', confirmationRemainingAmount],
          ['Payment status', confirmationPaymentStatus],
        ]

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
              Villa list
            </Link>
          </div>
          <div className="row">
            <button className="btn" type="button" onClick={() => setMonthCursor(startOfMonth(new Date()))}>
              Current month
            </button>
            <button className="btn primary" type="button" onClick={openCreateBookingModal}>
              Add booking
            </button>
          </div>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>Admin • Villa booking calendar</h2>
            <div className="muted">Grouped by location. For quick booking, click the first available day and then the last day on the same villa row.</div>
          </div>
          <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
            Reload
          </button>
        </div>

        <div className="room-bookings-toolbar card detail-card">
          <div className="row room-bookings-toolbar-top">
            <div className="search-inline room-bookings-search">
              <input
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search guest, villa, type, Airbnb link..."
              />
            </div>

            <div className="room-bookings-week-nav">
              <div className="room-bookings-nav-strip">
                <button
                  className="btn room-bookings-nav-btn"
                  type="button"
                  onClick={() => setMonthCursor((current) => addMonths(current, -1))}
                >
                  ←
                </button>
                <div className="room-bookings-week-label room-bookings-current-month">
                  <div className="room-bookings-week-title">Month</div>
                  <div className="room-bookings-week-range">{formatMonthLabel(monthCursor)}</div>
                </div>
                <button
                  className="btn room-bookings-nav-btn"
                  type="button"
                  onClick={() => setMonthCursor((current) => addMonths(current, 1))}
                >
                  →
                </button>
              </div>
              <div className="room-bookings-picker-group">
                <label className="field room-bookings-month-field">
                  <div className="field-label">Month</div>
                  <select
                    className="select"
                    value={monthValue}
                    onChange={(e) => updateMonthCursor(Number(e.target.value), yearValue)}
                  >
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field room-bookings-month-field room-bookings-year-field">
                  <div className="field-label">Year</div>
                  <select
                    className="select"
                    value={yearValue}
                    onChange={(e) => updateMonthCursor(monthValue, Number(e.target.value))}
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="room-bookings-week-label room-bookings-range-pill">
                <div className="room-bookings-week-title">Range</div>
                <div className="room-bookings-week-range">{formatDateRange(monthStart, monthEnd)}</div>
              </div>
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

        <div className="room-bookings-stack">
          <div className="card detail-card room-schedule-card">
            {loading ? (
              <div className="card detail-card muted">Loading villa calendar...</div>
            ) : error ? (
              <div className="card error">
                <div className="error-title">Could not load data</div>
                <div className="muted">{error}</div>
              </div>
            ) : rooms.length === 0 ? (
              <div className="card detail-card muted">No villas match the current filters.</div>
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

                  {groupedScheduleRows.map((row) => {
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

                    const roomCode = row.roomCode
                    const room = roomByCode[roomCode]
                    const roomBookings = sortBookingsByTime(filteredBookings.filter((booking) => booking.roomCode === roomCode))
                    const disabledDateKeys = bookedDateKeysByRoom[roomCode] ?? new Set<string>()
                    const selectedDateKeys =
                      quickSelection?.roomCode === roomCode ? new Set(quickSelection.dates) : new Set<string>()
                    const needsCleaning = normalizeRoomOperationalStatus(room?.operationalStatus) === 'NEEDS_CLEANING'
                    const hasQuickAction =
                      quickSelection?.roomCode === roomCode &&
                      (quickSelection?.dates.length ?? 0) > 1 &&
                      Boolean(quickSelectionRange) &&
                      Boolean(quickSelectionLayout)
                    const selectionRangeForRow = hasQuickAction ? quickSelectionRange : null
                    const selectionLayoutForRow = hasQuickAction ? quickSelectionLayout : null

                    return (
                      <div key={roomCode} className={`room-schedule-row ${hasQuickAction ? 'has-quick-action' : ''}`}>
                        <div className="room-schedule-room-cell">
                          <div className="room-schedule-room-cell-content">
                            <div>{room?.name || roomCode}</div>
                            {room?.airbnbUrl ? (
                              <a href={room.airbnbUrl} target="_blank" rel="noreferrer" className="room-schedule-room-link">
                                Airbnb link
                              </a>
                            ) : (
                              <div className="room-schedule-room-link muted">Airbnb link pending</div>
                            )}
                            {needsCleaning ? (
                              <span className={`room-bookings-list-badge ${ROOM_OPERATIONAL_STATUS_META.NEEDS_CLEANING.toneClass}`}>
                                {ROOM_OPERATIONAL_STATUS_META.NEEDS_CLEANING.label}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="room-schedule-track">
                          <div className="room-schedule-grid">
                            {monthDays.map((day) => {
                              const dayKey = toIsoDate(day)
                              const isDisabled = disabledDateKeys.has(dayKey)
                              const isSelected = selectedDateKeys.has(dayKey)
                              return (
                                <button
                                  key={`${roomCode}-${day.toISOString()}`}
                                  type="button"
                                  className={`room-schedule-grid-cell room-schedule-select-cell ${isSelected ? 'is-selected' : ''}`}
                                  disabled={isDisabled}
                                  onClick={() => handleQuickDateSelect(roomCode, dayKey)}
                                  aria-label={`Select ${dayKey} for ${roomCode}`}
                                />
                              )
                            })}
                          </div>

                          {todayMarkerLeft !== null ? (
                            <div className="room-schedule-today-marker" style={{ left: `${todayMarkerLeft}%` }} />
                          ) : null}

                          {hasQuickAction ? (
                            <div
                              className="room-schedule-quick-action"
                              style={{ left: `${Math.min(Math.max(selectionLayoutForRow!.center, 10), 90)}%` }}
                            >
                              <div className="room-schedule-quick-action-meta">
                                <strong>{quickSelectionRoom?.name || quickSelection.roomCode}</strong>
                                <span>
                                  {formatDateOnly(selectionRangeForRow!.checkInAt)} → {formatDateOnly(selectionRangeForRow!.checkOutAt)} ·{' '}
                                  {quickSelectionDates.length} night(s)
                                </span>
                              </div>
                              <button className="btn primary" type="button" onClick={openQuickCreateBookingModal}>
                                Tạo booking
                              </button>
                              <button className="btn" type="button" onClick={() => setQuickSelection(null)}>
                                Bỏ chọn
                              </button>
                            </div>
                          ) : null}

                          {roomBookings.map((booking) => {
                            const layout = getBookingBarLayout(booking, trackStartMs, trackDurationMs)
                            if (!layout) return null
                            const meta = STATUS_META[booking.displayStatus]

                            return (
                              <button
                                key={booking.id}
                                type="button"
                                className={`room-booking-bar ${meta.toneClass} ${selectedBookingId === booking.id ? 'selected' : ''}`}
                                style={{ left: `${layout.left}%`, width: `${layout.width}%` }}
                                onClick={() => openBookingDetails(booking)}
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

        </div>

        {bookingModalMode ? (
          <div className="room-booking-modal-overlay" role="dialog" aria-modal="true" onClick={closeBookingModal}>
            <div className="room-booking-modal" onClick={(e) => e.stopPropagation()}>
              <div className="room-booking-modal-head">
                <div>
                  <div className="room-booking-editor-title">
                    {bookingModalMode === 'create'
                      ? 'Create booking'
                      : bookingModalMode === 'edit'
                        ? 'Update booking'
                        : 'Booking details'}
                  </div>
                  <div className="muted">
                    {bookingModalMode === 'details' && selectedBooking
                      ? `Booking #${selectedBooking.id} • ${selectedStatusMeta.label}`
                      : 'Manage the selected villa booking in this popup.'}
                  </div>
                </div>
                <div className="room-booking-modal-actions">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setShowConfirmInformation((current) => !current)}
                  >
                    {showConfirmInformation ? 'Hide Confirmation' : 'Confirmation'}
                  </button>
                  {bookingModalMode === 'details' && selectedBooking ? (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void runBookingAction('check-in')}
                      disabled={actionLoading !== null || selectedBooking.status === 'CHECKED_IN' || selectedBooking.status === 'CHECKED_OUT'}
                    >
                      {actionLoading === 'check-in' ? 'Checking in...' : 'Check-in'}
                    </button>
                  ) : null}
                  {bookingModalMode === 'details' && selectedBooking ? (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void runBookingAction('check-out')}
                      disabled={actionLoading !== null || selectedBooking.status !== 'CHECKED_IN'}
                    >
                      {actionLoading === 'check-out' ? 'Checking out...' : 'Check-out'}
                    </button>
                  ) : null}
                  {bookingModalMode === 'details' && selectedBooking && selectedRoom ? (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void handleMarkReady()}
                      disabled={actionLoading !== null || selectedRoomStatus !== 'NEEDS_CLEANING'}
                    >
                      {actionLoading === 'mark-ready' ? 'Updating...' : 'Done cleaning'}
                    </button>
                  ) : null}
                  {bookingModalMode === 'details' && selectedBooking ? (
                    <button className="btn" type="button" onClick={() => editBooking(selectedBooking)}>
                      Edit
                    </button>
                  ) : null}
                  <button className="btn" type="button" onClick={closeBookingModal}>
                    Close
                  </button>
                </div>
              </div>

              {bookingModalMode === 'details' && selectedBooking ? (
                <div className="room-booking-modal-body">
                  <div className="room-booking-details-grid">
                    <div className="room-booking-detail-card">
                      <div className="room-booking-detail-label">Guest</div>
                      <strong>{selectedBooking.guestName}</strong>
                      <div className="muted">{countGuests(selectedBooking)}</div>
                    </div>
                    <div className="room-booking-detail-card">
                      <div className="room-booking-detail-label">Villa</div>
                      <strong>{selectedBooking.roomCode}</strong>
                      <div className="muted">{selectedRoom?.name ?? 'No villa name yet'}</div>
                      {selectedRoom?.host ? (
                        <div className="muted">{selectedRoom.host}</div>
                      ) : null}
                      <span className={`room-bookings-list-badge ${selectedRoomStatusMeta.toneClass}`}>
                        {selectedRoomStatusMeta.label}
                      </span>
                    </div>
                    <div className="room-booking-detail-card">
                      <div className="room-booking-detail-label">Check-in</div>
                      <strong>{formatDateTime(selectedBooking.checkInAt)}</strong>
                      <div className="muted">{selectedStatusMeta.label}</div>
                    </div>
                    <div className="room-booking-detail-card">
                      <div className="room-booking-detail-label">Check-out</div>
                      <strong>{formatDateTime(selectedBooking.checkOutAt)}</strong>
                      <div className="muted">{selectedBooking.source}</div>
                    </div>
                  </div>

                  <div className="room-booking-detail-panel">
                    <div className="room-booking-detail-row">
                      <span>Source</span>
                      <strong>{selectedBooking.source || 'Direct'}</strong>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Phone</span>
                      <strong>{selectedBooking.phone || 'Pending update'}</strong>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Host</span>
                      <strong>{selectedRoom?.host || 'Unassigned host'}</strong>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Villa status</span>
                      <span className={`room-bookings-list-badge ${selectedRoomStatusMeta.toneClass}`}>{selectedRoomStatusMeta.label}</span>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Status</span>
                      <span className={`room-bookings-list-badge ${selectedStatusMeta.toneClass}`}>{selectedStatusMeta.label}</span>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Checked-in at</span>
                      <strong>{selectedBooking.checkedInMarkedAt ? formatDateTime(selectedBooking.checkedInMarkedAt) : 'Not yet'}</strong>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Checked-out at</span>
                      <strong>{selectedBooking.checkedOutMarkedAt ? formatDateTime(selectedBooking.checkedOutMarkedAt) : 'Not yet'}</strong>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Cleaning requested</span>
                      <strong>{selectedRoom?.cleaningRequestedAt ? formatDateTime(selectedRoom.cleaningRequestedAt) : 'Not yet'}</strong>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Ready again</span>
                      <strong>{selectedRoom?.lastReadyAt ? formatDateTime(selectedRoom.lastReadyAt) : 'Not yet'}</strong>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Villa rate</span>
                      <strong>{formatMoney(selectedBooking.villaRate, 'vi')}</strong>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Deposit</span>
                      <strong>{formatMoney(selectedBooking.depositAmount, 'vi')}</strong>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Remaining</span>
                      <strong>
                        {formatMoney(
                          calculateRemainingAmount(
                            selectedBooking.villaRate,
                            selectedBooking.depositAmount,
                            selectedBooking.remainingAmount,
                          ),
                          'vi',
                        )}
                      </strong>
                    </div>
                    <div className="room-booking-detail-row room-booking-detail-notes">
                      <span>Notes</span>
                      <strong>{selectedBooking.notes || 'No notes.'}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="room-booking-modal-body">
                  <div className="row">
                    <label className="field" style={{ flex: 1, minWidth: 160 }}>
                      <div className="field-label">Villa</div>
                      <select
                        className="select"
                        value={form.roomCode}
                        onChange={(e) => setForm((current) => ({ ...current, roomCode: e.target.value }))}
                      >
                        {roomOptions.map((roomCode) => {
                          const room = roomByCode[roomCode]
                          const suffix = room ? ` - ${room.name}${room.location ? ` (${room.location})` : ''}` : ''
                          return (
                            <option key={roomCode} value={roomCode}>
                              {roomCode}{suffix}
                            </option>
                          )
                        })}
                      </select>
                    </label>
                    <label className="field" style={{ flex: 1, minWidth: 180 }}>
                      <div className="field-label">Status</div>
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
                    <div className="field-label">Guest name</div>
                    <input
                      className="input"
                      value={form.guestName}
                      onChange={(e) => setForm((current) => ({ ...current, guestName: e.target.value }))}
                    />
                  </label>

                  <div className="row">
                    <label className="field" style={{ flex: 1, minWidth: 160 }}>
                      <div className="field-label">Source</div>
                      <input
                        className="input"
                        value={form.source}
                        onChange={(e) => setForm((current) => ({ ...current, source: e.target.value }))}
                      />
                    </label>
                    <label className="field" style={{ flex: 1, minWidth: 160 }}>
                      <div className="field-label">Phone</div>
                      <input
                        className="input"
                        value={form.phone}
                        onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                      />
                    </label>
                  </div>

                  <div className="row">
                    <label className="field" style={{ flex: 1, minWidth: 160 }}>
                      <div className="field-label">Check-in</div>
                      <input
                        className="input"
                        type="date"
                        value={checkInDateValue}
                        onChange={(e) => setForm((current) => applyCheckInDateToForm(current, e.target.value))}
                      />
                      <div className="muted">Check-in time: 15:00</div>
                    </label>
                    <label className="field" style={{ flex: 1, minWidth: 160 }}>
                      <div className="field-label">Check-out</div>
                      <input
                        className="input"
                        type="date"
                        value={checkOutDateValue}
                        min={minCheckOutDateValue}
                        onChange={(e) => setForm((current) => applyCheckOutDateToForm(current, e.target.value))}
                      />
                      <div className="muted">Check-out time: 11:00</div>
                    </label>
                  </div>

                  <div className="row">
                    <label className="field" style={{ flex: 1, minWidth: 120 }}>
                      <div className="field-label">Adults</div>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={form.adults}
                        onChange={(e) => setForm((current) => ({ ...current, adults: Number(e.target.value) }))}
                      />
                    </label>
                    <label className="field" style={{ flex: 1, minWidth: 120 }}>
                      <div className="field-label">Children</div>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={form.children}
                        onChange={(e) => setForm((current) => ({ ...current, children: Number(e.target.value) }))}
                      />
                    </label>
                  </div>

                  <div className="row">
                    <label className="field" style={{ flex: 1, minWidth: 160 }}>
                      <div className="field-label">Villa rate</div>
                      <input
                        className="input"
                        type="text"
                        inputMode="numeric"
                        value={toMoneyInputValue(form.villaRate)}
                        onChange={(e) =>
                          setForm((current) => ({ ...current, villaRate: parseMoneyInput(e.target.value) }))
                        }
                      />
                    </label>
                    <label className="field" style={{ flex: 1, minWidth: 160 }}>
                      <div className="field-label">Deposit paid</div>
                      <input
                        className="input"
                        type="text"
                        inputMode="numeric"
                        value={toMoneyInputValue(form.depositAmount)}
                        onChange={(e) =>
                          setForm((current) => ({ ...current, depositAmount: parseMoneyInput(e.target.value) }))
                        }
                      />
                    </label>
                    <label className="field" style={{ flex: 1, minWidth: 160 }}>
                      <div className="field-label">Remaining</div>
                      <input
                        className="input"
                        type="text"
                        inputMode="numeric"
                        value={toMoneyInputValue(
                          calculateRemainingAmount(
                            parseMoneyInput(form.villaRate),
                            parseMoneyInput(form.depositAmount),
                            parseMoneyInput(form.remainingAmount),
                          ),
                        )}
                        readOnly
                      />
                    </label>
                  </div>

                  <label className="field">
                    <div className="field-label">Notes</div>
                    <textarea
                      className="textarea"
                      value={form.notes}
                      onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                    />
                  </label>

                  {formError ? (
                    <div className="card error" style={{ marginTop: 12 }}>
                      <div className="error-title">Could not save</div>
                      <div className="muted">{formError}</div>
                    </div>
                  ) : null}

                  <div className="row room-booking-editor-actions">
                    <button className="btn primary" type="button" onClick={() => void handleSave()} disabled={saving}>
                      {saving ? 'Saving...' : editingId ? 'Update booking' : 'Create booking'}
                    </button>
                    {editingId ? (
                      <button className="btn danger" type="button" onClick={() => void handleDelete()} disabled={deleting}>
                        {deleting ? 'Deleting...' : 'Delete'}
                      </button>
                    ) : null}
                  </div>
                </div>
              )}

            </div>
          </div>
        ) : null}

        {bookingModalMode && showConfirmInformation ? (
          <div
            className="room-booking-confirm-overlay"
            role="dialog"
            aria-modal="true"
            onClick={() => setShowConfirmInformation(false)}
          >
            <div className="room-booking-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="room-booking-confirm-actions">
                <div className="room-booking-confirm-language-switch" role="tablist" aria-label="Confirmation language">
                  <button
                    className={`btn ${confirmationLanguage === 'vi' ? 'primary' : ''}`}
                    type="button"
                    onClick={() => setConfirmationLanguage('vi')}
                  >
                    VI
                  </button>
                  <button
                    className={`btn ${confirmationLanguage === 'en' ? 'primary' : ''}`}
                    type="button"
                    onClick={() => setConfirmationLanguage('en')}
                  >
                    EN
                  </button>
                </div>
                <button className="btn" type="button" onClick={() => setShowConfirmInformation(false)}>
                  {confirmationLanguage === 'vi' ? 'Đóng' : 'Close'}
                </button>
              </div>

              <div className="room-booking-confirm-sheet">
                <div className="room-booking-confirm-brand">
                  <img
                    src="/logo.png"
                    alt="Da Nang Luxury Travel"
                    className="room-booking-confirm-logo"
                  />
                  <div className="room-booking-confirm-brand-main">
                    {confirmationLanguage === 'vi' ? 'Xác nhận đặt phòng' : 'Booking confirmation'}
                  </div>
                  <div className="room-booking-confirm-brand-sub">
                    {`${confirmationStatusLabel} • DaNang Luxury Travel`}
                  </div>
                </div>

                <div className="room-booking-confirm-content">
                  <div className="room-booking-confirm-top-grid">
                    <div className="room-booking-confirm-top-card">
                      {confirmationPrimaryRows.map(([label, value]) => (
                        <div key={label} className="room-booking-confirm-top-row">
                          <div className="room-booking-confirm-fact-label">{label}</div>
                          <div className="room-booking-confirm-fact-value">{value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="room-booking-confirm-top-card">
                      {confirmationSecondaryRows.map(([label, value]) => (
                        <div key={label} className="room-booking-confirm-top-row">
                          <div className="room-booking-confirm-fact-label">{label}</div>
                          <div className="room-booking-confirm-fact-value">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="room-booking-confirm-side">
                    <div className="room-booking-confirm-side-card">
                      <div className="room-booking-confirm-side-title">
                        {confirmationLanguage === 'vi' ? 'Dịch vụ bao gồm' : 'Included services'}
                      </div>
                      <div className="room-booking-confirm-side-text">{confirmationIncludedText}</div>
                    </div>

                    <div className="room-booking-confirm-side-card">
                      <div className="room-booking-confirm-side-title">
                        {confirmationLanguage === 'vi' ? 'Lưu ý quan trọng' : 'Important notes'}
                      </div>
                      <div className="room-booking-confirm-side-text">{confirmationImportantText}</div>
                    </div>

                    <div className="room-booking-confirm-side-card">
                      <div className="room-booking-confirm-side-title">
                        {confirmationLanguage === 'vi'
                          ? 'Hỗ trợ khách hàng qua WhatsApp'
                          : 'Guest support via WhatsApp'}
                      </div>
                      <div className="room-booking-confirm-side-text">{confirmationSupportText}</div>
                    </div>

                    {confirmationNotes ? (
                      <div className="room-booking-confirm-side-card">
                        <div className="room-booking-confirm-side-title">
                          {confirmationLanguage === 'vi' ? 'Ghi chú thêm' : 'Additional notes'}
                        </div>
                        <div className="room-booking-confirm-side-text">{confirmationNotes}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
