import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { AirbnbSyncRunResponse, KayStaySyncRunResponse, Room, RoomBookingRequest, RoomBookingResponse, RoomBookingStatus, SophiaSyncRunResponse } from '../types'
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

type RoomOperationalStatus = 'READY' | 'CHECKED_IN' | 'NEEDS_CLEANING' | 'OOI'

type VisibleRoomBookingStatus =
  | 'CONFIRMED'
  | 'TEMP_BLOCK'
  | 'AIRBNB_BLOCK'
  | 'KAYSTAY_BLOCK'
  | 'SOPHIA_BLOCK'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
type BookingModalMode = 'create' | 'details' | 'edit'
type ConfirmationLanguage = 'en' | 'vi'
type ScheduleBooking = RoomBookingResponse & {
  displayStatus: VisibleRoomBookingStatus
}
type CalendarFeedback = {
  tone: 'success' | 'error'
  title: string
  message: string
}
type TouchDragState = {
  bookingId: number
  pointerId: number
  startX: number
  startY: number
  clientX: number
  clientY: number
  hasMoved: boolean
}
type PendingMoveConfirmation = {
  booking: RoomBookingResponse
  targetRoomCode: string
  targetDateKey: string
}

const STATUS_META: Record<VisibleRoomBookingStatus, StatusMeta> = {
  CONFIRMED: { label: 'Reserved', toneClass: 'reserved' },
  TEMP_BLOCK: { label: 'Temp lock', toneClass: 'temp-block' },
  AIRBNB_BLOCK: { label: 'AirBnbBlock', toneClass: 'airbnb-block' },
  KAYSTAY_BLOCK: { label: 'KayStay', toneClass: 'kaystay-block' },
  SOPHIA_BLOCK: { label: 'Sophia', toneClass: 'sophia-block' },
  CHECKED_IN: { label: 'Check-in', toneClass: 'checked-in' },
  CHECKED_OUT: { label: 'Check-out', toneClass: 'checked-out' },
  CANCELLED: { label: 'Cancelled', toneClass: 'cancelled' },
}
const MOVABLE_BOOKING_STATUSES = new Set<VisibleRoomBookingStatus>(['CONFIRMED', 'TEMP_BLOCK', 'CHECKED_IN'])

const ALL_STATUSES = Object.keys(STATUS_META) as VisibleRoomBookingStatus[]
const FALLBACK_ROOM_CODE = 'V107'
const DAY_DURATION_MS = 24 * 60 * 60 * 1000
const STANDARD_CHECK_IN_HOUR = 15
const STANDARD_CHECK_OUT_HOUR = 11

const CONFIRMATION_STATUS_LABELS: Record<ConfirmationLanguage, Record<VisibleRoomBookingStatus, string>> = {
  en: {
    CONFIRMED: 'Reserved',
    TEMP_BLOCK: 'Temp lock',
    AIRBNB_BLOCK: 'AirBnbBlock',
    KAYSTAY_BLOCK: 'KayStay',
    SOPHIA_BLOCK: 'Sophia',
    CHECKED_IN: 'Checked in',
    CHECKED_OUT: 'Checked out',
    CANCELLED: 'Cancelled',
  },
  vi: {
    CONFIRMED: 'Reserved',
    TEMP_BLOCK: 'Tạm khóa',
    AIRBNB_BLOCK: 'AirBnbBlock',
    KAYSTAY_BLOCK: 'KayStay',
    SOPHIA_BLOCK: 'Sophia',
    CHECKED_IN: 'Checked in',
    CHECKED_OUT: 'Checked out',
    CANCELLED: 'Cancelled',
  },
}

const ROOM_OPERATIONAL_STATUS_META: Record<RoomOperationalStatus, StatusMeta> = {
  READY: { label: 'Ready', toneClass: 'ready' },
  CHECKED_IN: { label: 'Checked-in', toneClass: 'occupied' },
  NEEDS_CLEANING: { label: 'Needs cleaning', toneClass: 'needs-cleaning' },
  OOI: { label: 'OOI', toneClass: 'ooi' },
}

function normalizeRoomOperationalStatus(status?: Room['operationalStatus']): RoomOperationalStatus {
  if (status === 'CHECKED_IN' || status === 'NEEDS_CLEANING' || status === 'OOI') return status
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

function getLaterDateKey(a: string, b: string) {
  return a > b ? a : b
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
  const today = startOfDay(new Date())
  const safeStart = monthStart.getTime() < today.getTime() ? today : monthStart
  const checkInAt = new Date(safeStart)
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
  if (
    status === 'CHECKED_IN' ||
    status === 'CHECKED_OUT' ||
    status === 'CONFIRMED' ||
    status === 'TEMP_BLOCK' ||
    status === 'AIRBNB_BLOCK' ||
    status === 'KAYSTAY_BLOCK' ||
    status === 'SOPHIA_BLOCK'
  ) {
    return status
  }
  if (status === 'PENDING') {
    return 'CONFIRMED'
  }
  return null
}

function normalizeEditableStatus(status: RoomBookingStatus): VisibleRoomBookingStatus {
  if (status === 'CANCELLED') return 'CANCELLED'
  return normalizeDisplayStatus(status) ?? 'CONFIRMED'
}

function canMoveBookingStatus(status: RoomBookingStatus): boolean {
  const visibleStatus = normalizeDisplayStatus(status)
  return visibleStatus ? MOVABLE_BOOKING_STATUSES.has(visibleStatus) : false
}

function canMoveVisibleBookingStatus(status: VisibleRoomBookingStatus): boolean {
  return MOVABLE_BOOKING_STATUSES.has(status)
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
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
  }).format(value)
}

function formatDayNumber(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
  }).format(value)
}

function formatDateRange(start: Date, end: Date) {
  return `${new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(start)} - ${new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(end)}`
}

function formatMonthLabel(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(value)
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(parsed)
}

function formatDateOnly(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
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

function getBookingBarStyle(layout: { left: number; width: number }): CSSProperties {
  const insetPercent = layout.width * 0.025

  return {
    left: `${layout.left + insetPercent}%`,
    width: `${Math.max(layout.width * 0.95, 0.75)}%`,
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

function getQuickActionStyle(layout: { left: number; width: number; center: number }): CSSProperties {
  if (layout.center <= 18) {
    return {
      left: `max(calc(${layout.left}% + 8px), 8px)`,
      transform: 'translateX(0)',
    }
  }

  if (layout.center >= 82) {
    return {
      left: `min(calc(${layout.left + layout.width}% - 8px), calc(100% - 8px))`,
      transform: 'translateX(-100%)',
    }
  }

  return {
    left: `${layout.center}%`,
    transform: 'translateX(-50%)',
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    if (error.body?.fields) return Object.values(error.body.fields).join(', ')
    return error.message
  }
  return fallback
}

function mapBookingToPayload(booking: RoomBookingResponse, roomCode = booking.roomCode): RoomBookingRequest {
  return {
    roomCode,
    guestName: booking.guestName,
    source: booking.source,
    phone: booking.phone,
    adults: booking.adults,
    children: booking.children,
    checkInAt: toInputValue(booking.checkInAt),
    checkOutAt: toInputValue(booking.checkOutAt),
    status: booking.status,
    villaRate: booking.villaRate,
    depositAmount: booking.depositAmount,
    remainingAmount: booking.remainingAmount,
    notes: booking.notes,
  }
}

function getBookingDurationDays(booking: RoomBookingResponse) {
  const checkInStart = startOfDay(new Date(booking.checkInAt)).getTime()
  const checkOutStart = startOfDay(new Date(booking.checkOutAt)).getTime()
  if (Number.isNaN(checkInStart) || Number.isNaN(checkOutStart)) return 1
  return Math.max(1, Math.round((checkOutStart - checkInStart) / DAY_DURATION_MS))
}

function buildMovedBookingPayload(booking: RoomBookingResponse, roomCode: string, checkInDateKey: string): RoomBookingRequest {
  const nextCheckIn = new Date(`${checkInDateKey}T00:00:00`)
  const originalCheckIn = new Date(booking.checkInAt)
  const originalCheckOut = new Date(booking.checkOutAt)
  const durationDays = getBookingDurationDays(booking)

  nextCheckIn.setHours(originalCheckIn.getHours(), originalCheckIn.getMinutes(), 0, 0)

  const nextCheckOut = new Date(`${checkInDateKey}T00:00:00`)
  nextCheckOut.setDate(nextCheckOut.getDate() + durationDays)
  nextCheckOut.setHours(originalCheckOut.getHours(), originalCheckOut.getMinutes(), 0, 0)

  return {
    ...mapBookingToPayload(booking, roomCode),
    checkInAt: toDateTimeLocalValue(nextCheckIn),
    checkOutAt: toDateTimeLocalValue(nextCheckOut),
  }
}

function getDateKeyFromTrackPointer(
  clientX: number,
  trackElement: HTMLDivElement,
  monthDays: Date[],
) {
  if (monthDays.length === 0) return null

  const rect = trackElement.getBoundingClientRect()
  const relativeX = Math.min(Math.max(clientX - rect.left, 0), rect.width)
  const dayWidth = rect.width / monthDays.length || rect.width
  const dayIndex = Math.min(monthDays.length - 1, Math.max(0, Math.floor(relativeX / Math.max(dayWidth, 1))))

  return toIsoDate(monthDays[dayIndex])
}

function findScheduleDropTarget(clientX: number, clientY: number, monthDays: Date[]) {
  const hit = document.elementFromPoint(clientX, clientY) as HTMLElement | null
  if (!hit) return { roomCode: null, dateKey: null }

  const trackElement = hit.closest('[data-schedule-track="true"]') as HTMLDivElement | null
  if (!trackElement) return { roomCode: null, dateKey: null }

  const roomCode = trackElement.dataset.roomCode ?? null
  const dateKeyFromCell = hit.closest('[data-day-key]')?.getAttribute('data-day-key') ?? null
  const dateKey = dateKeyFromCell ?? getDateKeyFromTrackPointer(clientX, trackElement, monthDays)

  return { roomCode, dateKey }
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
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null)
  const [bookingModalMode, setBookingModalMode] = useState<BookingModalMode | null>(null)
  const [showConfirmInformation, setShowConfirmInformation] = useState(false)
  const confirmationLanguage: ConfirmationLanguage = 'en'
  const [quickSelection, setQuickSelection] = useState<QuickBookingSelection | null>(null)
  const [form, setForm] = useState<RoomBookingRequest>(() => buildDefaultForm(startOfMonth(new Date())))
  const [formError, setFormError] = useState<string | null>(null)
  const [calendarFeedback, setCalendarFeedback] = useState<CalendarFeedback | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [checkoutCollectedAmount, setCheckoutCollectedAmount] = useState<string>('')
  const [syncingAirbnb, setSyncingAirbnb] = useState(false)
  const [syncingKaystay, setSyncingKaystay] = useState(false)
  const [syncingSophia, setSyncingSophia] = useState(false)
  const [draggingBookingId, setDraggingBookingId] = useState<number | null>(null)
  const [dropTargetRoomCode, setDropTargetRoomCode] = useState<string | null>(null)
  const [dropTargetDateKey, setDropTargetDateKey] = useState<string | null>(null)
  const [movingBookingId, setMovingBookingId] = useState<number | null>(null)
  const [pendingMoveConfirmation, setPendingMoveConfirmation] = useState<PendingMoveConfirmation | null>(null)
  const [repairInsightRoomCode, setRepairInsightRoomCode] = useState<string | null>(null)
  const [ooiInsightRoomCode, setOoiInsightRoomCode] = useState<string | null>(null)
  const [touchDrag, setTouchDrag] = useState<TouchDragState | null>(null)
  const loadingRef = useRef(false)
  const scheduleScrollRef = useRef<HTMLDivElement | null>(null)
  const touchDragRef = useRef<TouchDragState | null>(null)
  const draggedBookingRef = useRef<RoomBookingResponse | null>(null)
  const dropTargetRoomCodeRef = useRef<string | null>(null)
  const dropTargetDateKeyRef = useRef<string | null>(null)
  const monthDaysRef = useRef<Date[]>([])
  const ignoreNextClickBookingIdRef = useRef<number | null>(null)

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
        label: new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(new Date(2026, monthIndex, 1)),
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
  const repairInsightRoom = useMemo(
    () => (repairInsightRoomCode ? roomByCode[repairInsightRoomCode] ?? null : null),
    [repairInsightRoomCode, roomByCode],
  )
  const ooiInsightRoom = useMemo(
    () => (ooiInsightRoomCode ? roomByCode[ooiInsightRoomCode] ?? null : null),
    [ooiInsightRoomCode, roomByCode],
  )
  const draggedBooking = useMemo(
    () => bookings.find((booking) => booking.id === draggingBookingId) ?? null,
    [bookings, draggingBookingId],
  )

  useEffect(() => {
    touchDragRef.current = touchDrag
  }, [touchDrag])

  useEffect(() => {
    draggedBookingRef.current = draggedBooking
  }, [draggedBooking])

  useEffect(() => {
    dropTargetRoomCodeRef.current = dropTargetRoomCode
  }, [dropTargetRoomCode])

  useEffect(() => {
    dropTargetDateKeyRef.current = dropTargetDateKey
  }, [dropTargetDateKey])

  useEffect(() => {
    monthDaysRef.current = monthDays
  }, [monthDays])

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
        setError(getErrorMessage(e, 'Could not load booking calendar'))
      }
    } finally {
      if (!opts?.silent) setLoading(false)
      loadingRef.current = false
    }
  }

  const handleAirbnbSync = async () => {
    setSyncingAirbnb(true)
    setCalendarFeedback(null)
    try {
      const params = new URLSearchParams({
        from: toIsoDate(monthStart),
        to: toIsoDate(monthEnd),
      })
      const result = await apiFetch<AirbnbSyncRunResponse>(`/api/admin/integrations/airbnb-sync/sync-now?${params.toString()}`, {
        method: 'POST',
      })
      await load({ silent: true })
      setCalendarFeedback({
        tone: result.success ? 'success' : 'error',
        title: result.success ? 'Airbnb sync completed' : 'Airbnb sync reported issues',
        message: result.message,
      })
    } catch (e: unknown) {
      setCalendarFeedback({
        tone: 'error',
        title: 'Airbnb sync failed',
        message: getErrorMessage(e, 'Could not run Airbnb sync'),
      })
    } finally {
      setSyncingAirbnb(false)
    }
  }

  const handleKayStaySync = async () => {
    setSyncingKaystay(true)
    setCalendarFeedback(null)
    try {
      const params = new URLSearchParams({
        from: toIsoDate(monthStart),
        to: toIsoDate(monthEnd),
      })
      const result = await apiFetch<KayStaySyncRunResponse>(
        `/api/admin/integrations/kaystay-sync/sync-now?${params.toString()}`,
        { method: 'POST' },
      )
      await load({ silent: true })
      setCalendarFeedback({
        tone: result.success ? 'success' : 'error',
        title: result.success ? 'KayStay sync completed' : 'KayStay sync reported issues',
        message: result.message,
      })
    } catch (e: unknown) {
      setCalendarFeedback({
        tone: 'error',
        title: 'KayStay sync failed',
        message: getErrorMessage(e, 'Could not run KayStay sync'),
      })
    } finally {
      setSyncingKaystay(false)
    }
  }

  const handleSophiaSync = async () => {
    setSyncingSophia(true)
    setCalendarFeedback(null)
    try {
      const params = new URLSearchParams({
        from: toIsoDate(monthStart),
        to: toIsoDate(monthEnd),
      })
      const result = await apiFetch<SophiaSyncRunResponse>(
        `/api/admin/integrations/sophia-sync/sync-now?${params.toString()}`,
        { method: 'POST' },
      )
      await load({ silent: true })
      setCalendarFeedback({
        tone: result.success ? 'success' : 'error',
        title: result.success ? 'Sophia sync completed' : 'Sophia sync reported issues',
        message: result.message,
      })
    } catch (e: unknown) {
      setCalendarFeedback({
        tone: 'error',
        title: 'Sophia sync failed',
        message: getErrorMessage(e, 'Could not run Sophia sync'),
      })
    } finally {
      setSyncingSophia(false)
    }
  }

  useEffect(() => {
    void load()
  }, [monthStart, monthEnd])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      if (editingId || actionLoading) return
      void load({ silent: true })
    }
    const intervalId = window.setInterval(tick, 10000)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', tick)
    }
  }, [actionLoading, editingId, monthEnd, monthStart])

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
    setQuickSelection(null)
  }, [monthStart, monthEnd])



  const statusCounts = useMemo(() => {
    return bookings.reduce<Record<VisibleRoomBookingStatus, number>>((acc, booking) => {
      const visibleStatus = normalizeDisplayStatus(booking.status)
      if (!visibleStatus) return acc
      acc[visibleStatus] = (acc[visibleStatus] ?? 0) + 1
      return acc
    }, { CONFIRMED: 0, TEMP_BLOCK: 0, AIRBNB_BLOCK: 0, KAYSTAY_BLOCK: 0, SOPHIA_BLOCK: 0, CHECKED_IN: 0, CHECKED_OUT: 0, CANCELLED: 0 })
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
        ['--day-column-width' as string]: 'clamp(38px, 8vw, 48px)',
      }) as CSSProperties,
    [monthDays.length],
  )
  const today = new Date()
  const todayDateKey = toIsoDate(startOfDay(today))
  const isTodayInsideMonth = today >= monthStart && today < addDays(monthEnd, 1)
  const todayMarkerLeft = isTodayInsideMonth ? ((today.getTime() - trackStartMs) / trackDurationMs) * 100 : null
  const realtimeSummaryItems = useMemo(() => {
    const items = {
      inHouse: 0,
      awaitingCheckout: 0,
      upcoming: 0,
      unpaid: 0,
      paid: 0,
      depositPaid: 0,
      tempLock: 0,
    }

    bookings.forEach((booking) => {
      const visibleStatus = normalizeDisplayStatus(booking.status)
      if (!visibleStatus) return

      const checkInDateKey = toDateInputValue(booking.checkInAt)
      const checkOutDateKey = toDateInputValue(booking.checkOutAt)
      const remaining = calculateRemainingAmount(booking.villaRate, booking.depositAmount, booking.remainingAmount) ?? 0
      const deposit = booking.depositAmount ?? 0
      const isFinancialBooking =
        visibleStatus !== 'TEMP_BLOCK' &&
        visibleStatus !== 'AIRBNB_BLOCK' &&
        visibleStatus !== 'KAYSTAY_BLOCK' &&
        visibleStatus !== 'SOPHIA_BLOCK' &&
        visibleStatus !== 'CANCELLED'

      if (visibleStatus === 'CHECKED_IN') {
        items.inHouse += 1
      }
      if (
        checkOutDateKey === todayDateKey &&
        visibleStatus !== 'TEMP_BLOCK' &&
        visibleStatus !== 'AIRBNB_BLOCK' &&
        visibleStatus !== 'KAYSTAY_BLOCK' &&
        visibleStatus !== 'SOPHIA_BLOCK' &&
        visibleStatus !== 'CANCELLED'
      ) {
        items.awaitingCheckout += 1
      }
      if (visibleStatus === 'CONFIRMED' && checkInDateKey >= todayDateKey) {
        items.upcoming += 1
      }
      if (isFinancialBooking && remaining > 0.001) {
        items.unpaid += 1
      }
      if (isFinancialBooking && (booking.villaRate ?? 0) > 0 && remaining <= 0.001) {
        items.paid += 1
      }
      if (isFinancialBooking && deposit > 0.001) {
        items.depositPaid += 1
      }
      if (visibleStatus === 'TEMP_BLOCK') {
        items.tempLock += 1
      }
    })

    return [
      { key: 'in-house', label: 'Đang ở', value: items.inHouse, toneClass: 'in-house' },
      { key: 'awaiting-checkout', label: 'Chờ checkout', value: items.awaitingCheckout, toneClass: 'awaiting-checkout' },
      { key: 'upcoming', label: 'Sắp tới', value: items.upcoming, toneClass: 'upcoming' },
      { key: 'unpaid', label: 'Chưa thanh toán', value: items.unpaid, toneClass: 'unpaid' },
      { key: 'paid', label: 'Đã thanh toán', value: items.paid, toneClass: 'paid' },
      { key: 'deposit-paid', label: 'Đã thu cọc', value: items.depositPaid, toneClass: 'deposit-paid' },
      { key: 'temp-lock', label: 'Tạm khóa', value: items.tempLock, toneClass: 'temp-lock' },
    ] as const
  }, [bookings, todayDateKey])

  useEffect(() => {
    if (loading || rooms.length === 0 || !isTodayInsideMonth) return

    const scrollElement = scheduleScrollRef.current
    if (!scrollElement) return

    const frameId = window.requestAnimationFrame(() => {
      const roomHead = scrollElement.querySelector('.room-schedule-room-head') as HTMLElement | null
      const dayHead = scrollElement.querySelector('.room-schedule-day-head') as HTMLElement | null
      if (!roomHead || !dayHead) return

      const todayIndex = monthDays.findIndex((day) => toIsoDate(day) === todayDateKey)
      if (todayIndex < 0) return

      const roomColumnWidth = roomHead.getBoundingClientRect().width
      const dayColumnWidth = dayHead.getBoundingClientRect().width
      const targetScrollLeft = Math.max(
        roomColumnWidth + todayIndex * dayColumnWidth - (scrollElement.clientWidth - dayColumnWidth) / 2,
        0,
      )

      scrollElement.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth',
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isTodayInsideMonth, loading, monthDays, rooms.length, todayDateKey])

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
    if (dateKey < todayDateKey) {
      setCalendarFeedback({
        tone: 'error',
        title: 'Past date disabled',
        message: 'You cannot create a booking on a date that has already passed.',
      })
      return
    }

    setQuickSelection((current) => {
      const currentDates =
        current && current.roomCode === roomCode
          ? [...current.dates].sort((a, b) => a.localeCompare(b))
          : []

      if (currentDates.length === 1 && dateKey < currentDates[0]) {
        setCalendarFeedback({
          tone: 'error',
          title: 'Invalid date order',
          message: 'Please choose the start date first, then double click a later end date.',
        })
        return current
      }

      return toggleQuickBookingDate(current, roomCode, dateKey, bookedDateKeysByRoom[roomCode] ?? new Set())
    })
  }

  const handleBookingDragStart = (booking: RoomBookingResponse) => {
    if (!canMoveBookingStatus(booking.status)) return
    setCalendarFeedback(null)
    setQuickSelection(null)
    setDraggingBookingId(booking.id)
    setDropTargetRoomCode(booking.roomCode)
    setDropTargetDateKey(toDateInputValue(booking.checkInAt))
  }

  const handleBookingDragEnd = () => {
    setDraggingBookingId(null)
    setDropTargetRoomCode(null)
    setDropTargetDateKey(null)
    setTouchDrag(null)
  }

  const handleBookingPointerDown = (booking: RoomBookingResponse, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' || movingBookingId === booking.id || !canMoveBookingStatus(booking.status)) return

    event.preventDefault()
    ignoreNextClickBookingIdRef.current = booking.id
    handleBookingDragStart(booking)
    const nextDrag = {
      bookingId: booking.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      hasMoved: false,
    }
    touchDragRef.current = nextDrag
    setTouchDrag(nextDrag)
  }

  const handleBookingDrop = async (targetRoomCode: string, targetDateKey: string | null) => {
    if (!draggedBooking || movingBookingId) return

    setDropTargetRoomCode(null)
    setDropTargetDateKey(null)
    const nextDateKey = targetDateKey ?? toDateInputValue(draggedBooking.checkInAt)
    const currentDateKey = toDateInputValue(draggedBooking.checkInAt)

    if (draggedBooking.roomCode === targetRoomCode && currentDateKey === nextDateKey) {
      setDraggingBookingId(null)
      return
    }

    if (nextDateKey < todayDateKey) {
      setDraggingBookingId(null)
      setCalendarFeedback({
        tone: 'error',
        title: 'Past date disabled',
        message: 'You cannot move a booking to a date that has already passed.',
      })
      return
    }

    setDraggingBookingId(null)
    setPendingMoveConfirmation({
      booking: draggedBooking,
      targetRoomCode,
      targetDateKey: nextDateKey,
    })
  }

  const confirmMoveBooking = async () => {
    if (!pendingMoveConfirmation || movingBookingId) return

    const { booking, targetRoomCode, targetDateKey } = pendingMoveConfirmation

    setMovingBookingId(booking.id)
    setCalendarFeedback(null)
    try {
      const saved = await apiFetch<RoomBookingResponse>(`/api/admin/room-bookings/${booking.id}`, {
        method: 'PUT',
        body: JSON.stringify(buildMovedBookingPayload(booking, targetRoomCode, targetDateKey)),
      })
      setSelectedBookingId(saved.id)
      if (editingId === saved.id) {
        setForm(mapBookingToForm(saved))
      }
      await load({ silent: true })
      setCalendarFeedback({
        tone: 'success',
        title: 'Booking updated',
        message: `${saved.guestName} moved to ${roomByCode[saved.roomCode]?.name || saved.roomCode} from ${formatDateOnly(saved.checkInAt)} to ${formatDateOnly(saved.checkOutAt)}.`,
      })
    } catch (e: unknown) {
      setCalendarFeedback({
        tone: 'error',
        title: 'Could not move booking',
        message: getErrorMessage(e, 'Could not move booking to another villa'),
      })
    } finally {
      setPendingMoveConfirmation(null)
      setMovingBookingId(null)
    }
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

  const handleQuickLockBooking = async () => {
    const validationError = validateQuickBookingSelection(quickSelection)
    if (validationError) {
      setCalendarFeedback({
        tone: 'error',
        title: 'Could not lock villa',
        message: validationError,
      })
      return
    }
    if (!quickSelection) return

    const range = buildQuickBookingDateRange(quickSelection, STANDARD_CHECK_IN_HOUR, STANDARD_CHECK_OUT_HOUR)
    if (!range) {
      return
    }

    setActionLoading('lock')
    setCalendarFeedback(null)
    try {
      const saved = await apiFetch<RoomBookingResponse>('/api/admin/room-bookings', {
        method: 'POST',
        body: JSON.stringify({
          roomCode: quickSelection.roomCode,
          guestName: 'Temporary lock',
          source: 'Lock',
          phone: '',
          adults: 1,
          children: 0,
          checkInAt: range.checkInAt,
          checkOutAt: range.checkOutAt,
          status: 'TEMP_BLOCK',
          notes: 'Locked directly from villa calendar.',
        } satisfies RoomBookingRequest),
      })
      setQuickSelection(null)
      setSelectedBookingId(saved.id)
      setBookingModalMode(null)
      await load({ silent: true })
      setCalendarFeedback({
        tone: 'success',
        title: 'Villa locked',
        message: `${roomByCode[saved.roomCode]?.name || saved.roomCode} is temporarily locked from ${formatDateOnly(saved.checkInAt)} to ${formatDateOnly(saved.checkOutAt)}.`,
      })
    } catch (e: unknown) {
      setCalendarFeedback({
        tone: 'error',
        title: 'Could not lock villa',
        message: getErrorMessage(e, 'Could not create temporary lock'),
      })
    } finally {
      setActionLoading(null)
    }
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

  useEffect(() => {
    if (!touchDrag) return

    const handlePointerMove = (event: PointerEvent) => {
      const currentDrag = touchDragRef.current
      if (!currentDrag || event.pointerId !== currentDrag.pointerId) return

      const movedEnough =
        currentDrag.hasMoved ||
        Math.hypot(event.clientX - currentDrag.startX, event.clientY - currentDrag.startY) >= 8

      if (movedEnough) {
        event.preventDefault()
      }

      const scrollElement = scheduleScrollRef.current
      if (scrollElement) {
        const rect = scrollElement.getBoundingClientRect()
        const edgeThreshold = 40
        if (event.clientX > rect.right - edgeThreshold) {
          scrollElement.scrollLeft += 18
        } else if (event.clientX < rect.left + edgeThreshold) {
          scrollElement.scrollLeft -= 18
        }
      }

      const nextDrag = {
        ...currentDrag,
        clientX: event.clientX,
        clientY: event.clientY,
        hasMoved: movedEnough,
      }
      touchDragRef.current = nextDrag
      setTouchDrag(nextDrag)

      const target = findScheduleDropTarget(event.clientX, event.clientY, monthDaysRef.current)
      if (target.roomCode !== dropTargetRoomCodeRef.current) {
        setDropTargetRoomCode(target.roomCode)
      }
      if (target.dateKey !== dropTargetDateKeyRef.current) {
        setDropTargetDateKey(target.dateKey)
      }
    }

    const finishTouchDrag = (event: PointerEvent) => {
      const currentDrag = touchDragRef.current
      if (!currentDrag || event.pointerId !== currentDrag.pointerId) return

      const activeBooking = draggedBookingRef.current
      const targetRoomCode = dropTargetRoomCodeRef.current
      const targetDateKey = dropTargetDateKeyRef.current
      const shouldMove = currentDrag.hasMoved && Boolean(activeBooking) && Boolean(targetRoomCode)

      touchDragRef.current = null
      setTouchDrag(null)

      if (shouldMove && targetRoomCode) {
        ignoreNextClickBookingIdRef.current = null
        void handleBookingDrop(targetRoomCode, targetDateKey)
        return
      }

      handleBookingDragEnd()
      if (activeBooking) {
        openBookingDetails(activeBooking)
      }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', finishTouchDrag)
    window.addEventListener('pointercancel', finishTouchDrag)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishTouchDrag)
      window.removeEventListener('pointercancel', finishTouchDrag)
    }
  }, [touchDrag, handleBookingDrop, openBookingDetails])

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
    if (editingId && selectedBooking?.status === 'TEMP_BLOCK' && payload.status === 'TEMP_BLOCK') {
      payload.status = 'CONFIRMED'
    }
    const checkInDateKey = toDateInputValue(payload.checkInAt)
    const checkOutDateKey = toDateInputValue(payload.checkOutAt)
    const currentSelectedCheckInDateKey = selectedBooking ? toDateInputValue(selectedBooking.checkInAt) : ''
    const isChangingToPastCheckIn = !editingId || checkInDateKey !== currentSelectedCheckInDateKey

    if (checkInDateKey < todayDateKey && isChangingToPastCheckIn) {
      setFormError('Past dates are disabled. Please choose today or a future date.')
      setSaving(false)
      return
    }

    if (checkOutDateKey <= checkInDateKey) {
      setFormError('Please choose a check-out date after the check-in date.')
      setSaving(false)
      return
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
      setFormError(getErrorMessage(e, 'Could not save booking'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingId) return
    if (!window.confirm('Delete this booking?')) return

    setDeleting(true)
    setFormError(null)
    try {
      await apiFetch<void>(`/api/admin/room-bookings/${editingId}`, { method: 'DELETE' })
      resetForm()
      setSelectedBookingId(null)
      closeBookingModal()
      await load({ silent: true })
    } catch (e: unknown) {
      setFormError(getErrorMessage(e, 'Could not delete booking'))
    } finally {
      setDeleting(false)
    }
  }

  const handleCheckIn = async () => {
    if (!selectedBooking) return
    setActionLoading('check-in')
    setFormError(null)
    try {
      await apiFetch<RoomBookingResponse>(`/api/admin/room-bookings/${selectedBooking.id}/check-in`, {
        method: 'POST',
      })
      await load({ silent: true })
      setCalendarFeedback({
        tone: 'success',
        title: 'Check-in successful',
        message: `Guest ${selectedBooking.guestName || '—'} checked in successfully at ${selectedBooking.roomCode}.`,
      })
    } catch (e: unknown) {
      setFormError(getErrorMessage(e, 'Could not check in booking'))
    } finally {
      setActionLoading(null)
    }
  }

  const initiateCheckOut = async () => {
    if (!selectedBooking) return
    const currentRemaining =
      calculateRemainingAmount(selectedBooking.villaRate, selectedBooking.depositAmount, selectedBooking.remainingAmount) ?? 0
    if (currentRemaining > 0) {
      setCheckoutCollectedAmount(toMoneyInputValue(currentRemaining))
      setShowCheckoutModal(true)
      return
    }
    await confirmCheckOut(null)
  }

  const confirmCheckOut = async (collectedRaw: number | null | undefined) => {
    if (!selectedBooking) return
    setActionLoading('check-out')
    setFormError(null)
    try {
      const body = collectedRaw != null && !Number.isNaN(collectedRaw) ? { collectedAmount: collectedRaw } : null
      const saved = await apiFetch<RoomBookingResponse>(`/api/admin/room-bookings/${selectedBooking.id}/check-out`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      })
      setShowCheckoutModal(false)
      setCheckoutCollectedAmount('')
      await load({ silent: true })
      setCalendarFeedback({
        tone: 'success',
        title: 'Check-out successful',
        message: `Guest ${saved.guestName || '—'} checked out successfully at ${saved.roomCode}.`,
      })
    } catch (e: unknown) {
      setFormError(getErrorMessage(e, 'Could not check out booking'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelBooking = async () => {
    if (!selectedBooking) return
    const isTempLock = selectedBooking.status === 'TEMP_BLOCK'
    const ok = window.confirm(
      isTempLock
        ? `Unlock temporary lock #${selectedBooking.id}?\nThis villa will be available for sale again immediately.`
        : `Cancel booking #${selectedBooking.id} - ${selectedBooking.guestName || 'Guest'}?\nThis villa will be available for sale again immediately.`,
    )
    if (!ok) return
    setActionLoading('cancel')
    setFormError(null)
    try {
      const saved = await apiFetch<RoomBookingResponse>(`/api/admin/room-bookings/${selectedBooking.id}/cancel`, {
        method: 'POST',
      })
      await load({ silent: true })
      setCalendarFeedback({
        tone: 'success',
        title: isTempLock ? 'Villa unlocked' : 'Booking cancelled',
        message: isTempLock
          ? `${saved.roomCode} is available again.`
          : `Cancelled ${saved.guestName || '—'} at ${saved.roomCode}. The villa is now available again.`,
      })
    } catch (e: unknown) {
      setFormError(getErrorMessage(e, 'Could not cancel booking'))
    } finally {
      setActionLoading(null)
    }
  }

  const checkInDateValue = toDateInputValue(form.checkInAt)
  const checkOutDateValue = toDateInputValue(form.checkOutAt)
  const minCheckOutDateValue = nextCheckoutDateValue(form.checkInAt)
  const minCheckInDateValue = checkInDateValue && checkInDateValue < todayDateKey ? checkInDateValue : todayDateKey
  const minAllowedCheckOutDateValue = getLaterDateKey(
    checkOutDateValue && checkOutDateValue < todayDateKey ? checkOutDateValue : todayDateKey,
    minCheckOutDateValue || todayDateKey,
  )
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
  const confirmationBookingId = selectedBooking?.id ? `#${selectedBooking.id}` : 'TBA'
  const confirmationVillaType = [confirmationRoom?.location, confirmationRoom?.type].filter(Boolean).join(' • ') ||
    'TBA'
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
      ? 'Paid in full'
      : confirmationDepositAmountValue !== undefined && confirmationDepositAmountValue > 0
        ? 'Deposit paid'
        : 'Pending update'
  const confirmationSupportText =
    '24/7 support via WhatsApp.'
  const confirmationIncludedText =
    'Welcome fruit and drinks, internet, private pool, daily housekeeping, buggy 08:00 - 22:00.'
  const confirmationImportantText =
    'Check-in after 15:00, check-out before 11:00, no smoking, quiet hours 22:00 - 06:00.'
  const confirmationPrimaryRows =
    [
      ['Accommodation', confirmationRoomName],
      ['Confirmation No.', confirmationBookingId],
      ['Guest', confirmationSource.guestName || 'TBA'],
      ['Check-in date', confirmationSource.checkInAt ? formatDateOnly(confirmationSource.checkInAt) : 'TBA'],
      ['Check-out date', confirmationSource.checkOutAt ? formatDateOnly(confirmationSource.checkOutAt) : 'TBA'],
      ['Length of stay', `${confirmationNights || 0}`],
      ['Number of villas', '1'],
    ]
  const confirmationSecondaryRows =
    [
      ['Villa code', confirmationSource.roomCode || 'TBA'],
      ['Villa type', confirmationVillaType],
      ['Villa rate', confirmationVillaRate],
      ['Total amount', confirmationTotalAmount],
      ['Deposit paid', confirmationDepositAmount],
      ['Remaining balance', confirmationRemainingAmount],
      ['Payment status', confirmationPaymentStatus],
    ]
  const pendingMoveRoom = pendingMoveConfirmation ? roomByCode[pendingMoveConfirmation.targetRoomCode] : null
  const pendingMoveCheckOutAt = pendingMoveConfirmation
    ? buildMovedBookingPayload(
        pendingMoveConfirmation.booking,
        pendingMoveConfirmation.targetRoomCode,
        pendingMoveConfirmation.targetDateKey,
      ).checkOutAt
    : ''

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
            <div className="muted">
              Grouped by location. Double click one available day to start a booking range, then double click a later day on the
              same villa row to extend the stay.
            </div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn" type="button" onClick={() => void handleAirbnbSync()} disabled={syncingAirbnb}>
              {syncingAirbnb ? 'Syncing Airbnb...' : 'Sync Airbnb'}
            </button>
            <button className="btn" type="button" onClick={() => void handleKayStaySync()} disabled={syncingKaystay}>
              {syncingKaystay ? 'Syncing KayStay...' : 'Sync KayStay'}
            </button>
            <button className="btn" type="button" onClick={() => void handleSophiaSync()} disabled={syncingSophia}>
              {syncingSophia ? 'Syncing Sophia...' : 'Sync Sophia'}
            </button>
            <button className="btn" type="button" onClick={() => void load()} disabled={loading || syncingAirbnb || syncingKaystay || syncingSophia}>
              Reload
            </button>
          </div>
        </div>

        <div className="room-bookings-toolbar card detail-card">
          <div className="row room-bookings-toolbar-top">
            <div className="search-inline room-bookings-search">
              <input
                className="input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search guest, villa, type, Airbnb link, KayStay, Sophia..."
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



        {touchDrag?.hasMoved && draggedBooking ? (
          <div
            className="room-booking-touch-ghost"
            style={{
              left: touchDrag.clientX,
              top: touchDrag.clientY,
            }}
          >
            <strong>{roomByCode[draggedBooking.roomCode]?.name || draggedBooking.roomCode}</strong>
            <span>
              {formatDateOnly(draggedBooking.checkInAt)} → {formatDateOnly(draggedBooking.checkOutAt)}
            </span>
          </div>
        ) : null}

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
              <div ref={scheduleScrollRef} className="room-schedule-body room-schedule-scroll">
                <div className="room-schedule-table" style={scheduleGridStyle}>
                  <div className="room-schedule-header">
                    <div className="room-schedule-room-head" aria-label="Villa column" />
                    <div className="room-schedule-days">
                      {monthDays.map((day) => {
                        const isToday = toIsoDate(day) === toIsoDate(today)
                        const isPast = toIsoDate(day) < todayDateKey
                        return (
                          <div key={day.toISOString()} className={`room-schedule-day-head ${isToday ? 'is-today' : ''} ${isPast ? 'is-past' : ''}`}>
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
                            <strong>{row.location}</strong>
                          </div>
                          <div className="room-schedule-host-track" />
                        </div>
                      )
                    }

                    const roomCode = row.roomCode
                    const room = roomByCode[roomCode]
                    const roomBookings = sortBookingsByTime(filteredBookings.filter((booking) => booking.roomCode === roomCode))
                    const disabledDateKeys = bookedDateKeysByRoom[roomCode] ?? new Set<string>()
                    const selectedDateKeys =
                      quickSelection?.roomCode === roomCode ? new Set(quickSelection.dates) : new Set<string>()
                    const operationalStatus = normalizeRoomOperationalStatus(room?.operationalStatus)
                    const operationalStatusMeta = ROOM_OPERATIONAL_STATUS_META[operationalStatus]
                    const hasQuickAction =
                      quickSelection?.roomCode === roomCode &&
                      (quickSelection?.dates.length ?? 0) > 0 &&
                      Boolean(quickSelectionRange) &&
                      Boolean(quickSelectionLayout)
                    const selectionRangeForRow = hasQuickAction ? quickSelectionRange : null
                    const selectionLayoutForRow = hasQuickAction ? quickSelectionLayout : null
                    const quickActionStyleForRow = selectionLayoutForRow ? getQuickActionStyle(selectionLayoutForRow) : undefined

                    const isDropTarget = dropTargetRoomCode === roomCode && draggingBookingId !== null

                    return (
                      <div
                        key={roomCode}
                        className={`room-schedule-row ${hasQuickAction ? 'has-quick-action' : ''} ${isDropTarget ? 'is-drop-target' : ''}`}
                      >
                        <div className="room-schedule-room-cell">
                          <div className="room-schedule-room-cell-content">
                            <div>{roomCode}</div>
                            {room?.airbnbUrl ? (
                              <a href={room.airbnbUrl} target="_blank" rel="noreferrer" className="room-schedule-room-link">
                                Link
                              </a>
                            ) : (
                              <div className="room-schedule-room-link muted">Pending</div>
                            )}
                            {operationalStatus !== 'READY' ? (
                              operationalStatus === 'OOI' ? (
                                <button
                                  className={`room-bookings-list-badge ${operationalStatusMeta.toneClass} room-bookings-badge-button`}
                                  type="button"
                                  onClick={() => setOoiInsightRoomCode(roomCode)}
                                >
                                  {operationalStatusMeta.label}
                                </button>
                              ) : (
                                <span className={`room-bookings-list-badge ${operationalStatusMeta.toneClass}`}>
                                  {operationalStatusMeta.label}
                                </span>
                              )
                            ) : null}
                            {room?.repairNeeded ? (
                              <button
                                className="room-bookings-list-badge needs-repair room-bookings-badge-button"
                                type="button"
                                onClick={() => setRepairInsightRoomCode(roomCode)}
                              >
                                Needs repair
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div
                          className={`room-schedule-track ${isDropTarget ? 'is-drop-target' : ''}`}
                          data-schedule-track="true"
                          data-room-code={roomCode}
                          onDragOver={(e) => {
                            if (!draggedBooking || movingBookingId) return
                            e.preventDefault()
                            e.dataTransfer.dropEffect = 'move'
                            const nextDateKey = getDateKeyFromTrackPointer(e.clientX, e.currentTarget, monthDays)
                            if (nextDateKey && nextDateKey < todayDateKey) {
                              if (dropTargetRoomCode !== null) {
                                setDropTargetRoomCode(null)
                              }
                              if (dropTargetDateKey !== null) {
                                setDropTargetDateKey(null)
                              }
                              return
                            }
                            if (dropTargetRoomCode !== roomCode) {
                              setDropTargetRoomCode(roomCode)
                            }
                            if (dropTargetDateKey !== nextDateKey) {
                              setDropTargetDateKey(nextDateKey)
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            const nextDateKey = getDateKeyFromTrackPointer(e.clientX, e.currentTarget, monthDays)
                            void handleBookingDrop(roomCode, nextDateKey)
                          }}
                        >
                          <div className="room-schedule-grid">
                            {monthDays.map((day) => {
                              const dayKey = toIsoDate(day)
                              const isPastDate = dayKey < todayDateKey
                              const isDisabled = disabledDateKeys.has(dayKey) || isPastDate
                              const isSelected = selectedDateKeys.has(dayKey)
                              const isDragTargetDay = isDropTarget && dropTargetDateKey === dayKey
                              return (
                                <button
                                  key={`${roomCode}-${day.toISOString()}`}
                                  type="button"
                                  data-day-key={dayKey}
                                  className={`room-schedule-grid-cell room-schedule-select-cell ${isSelected ? 'is-selected' : ''} ${
                                    isDragTargetDay ? 'is-drop-target' : ''
                                  } ${isPastDate ? 'is-past' : ''}`}
                                  disabled={isDisabled}
                                  onDoubleClick={() => handleQuickDateSelect(roomCode, dayKey)}
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
                              style={quickActionStyleForRow}
                            >
                              <div className="room-schedule-quick-action-meta">
                                <strong>{quickSelectionRoom?.name || quickSelection.roomCode}</strong>
                                <span>
                                  {formatDateOnly(selectionRangeForRow!.checkInAt)} → {formatDateOnly(selectionRangeForRow!.checkOutAt)} ·{' '}
                                  {quickSelectionDates.length} night(s)
                                </span>
                              </div>
                              <button className="btn" type="button" onClick={() => void handleQuickLockBooking()} disabled={actionLoading === 'lock'}>
                                {actionLoading === 'lock' ? 'Locking...' : 'Lock'}
                              </button>
                              <button className="btn primary" type="button" onClick={openQuickCreateBookingModal}>
                                Create booking
                              </button>
                              <button className="btn" type="button" onClick={() => setQuickSelection(null)} disabled={actionLoading === 'lock'}>
                                Clear
                              </button>
                            </div>
                          ) : null}

                          {roomBookings.map((booking) => {
                            const layout = getBookingBarLayout(booking, trackStartMs, trackDurationMs)
                            if (!layout) return null
                            const meta = STATUS_META[booking.displayStatus]
                            const canMoveBooking = canMoveVisibleBookingStatus(booking.displayStatus) && movingBookingId !== booking.id

                            return (
                              <button
                                key={booking.id}
                                type="button"
                                className={`room-booking-bar ${meta.toneClass} ${selectedBookingId === booking.id ? 'selected' : ''} ${
                                  draggingBookingId === booking.id ? 'is-dragging' : ''
                                } ${movingBookingId === booking.id ? 'is-moving' : ''} ${canMoveBooking ? 'is-movable' : 'is-static'}`}
                                style={getBookingBarStyle(layout)}
                                onClick={() => {
                                  if (ignoreNextClickBookingIdRef.current === booking.id) {
                                    ignoreNextClickBookingIdRef.current = null
                                    return
                                  }
                                  openBookingDetails(booking)
                                }}
                                onPointerDown={(e) => handleBookingPointerDown(booking, e)}
                                draggable={canMoveBooking}
                                onDragStart={(e) => {
                                  if (!canMoveBooking) {
                                    e.preventDefault()
                                    return
                                  }
                                  e.dataTransfer.effectAllowed = 'move'
                                  e.dataTransfer.setData('text/plain', String(booking.id))
                                  handleBookingDragStart(booking)
                                }}
                                onDragEnd={handleBookingDragEnd}
                                title={canMoveBooking ? 'Drag to move this booking to another villa' : 'Only Reserved, Temp lock and Check-in bookings can be moved'}
                              >
                                <div className="room-booking-bar-title">{booking.source || 'Direct'}</div>
                                <div className="room-booking-bar-meta">
                                  <span>{booking.guestName || '—'}</span>
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

          {!loading && !error && bookings.length > 0 ? (
            <div className="room-bookings-summary-bar" aria-label="Calendar summary">
              <div className="room-bookings-summary-scroll">
                {realtimeSummaryItems.map((item) => (
                  <div
                    key={item.key}
                    className={`room-bookings-summary-pill ${item.toneClass}`}
                  >
                    <span className="room-bookings-summary-dot" />
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

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
                      onClick={() => void handleCheckIn()}
                      disabled={
                        actionLoading !== null ||
                        selectedBooking.status === 'TEMP_BLOCK' ||
                        selectedBooking.status === 'AIRBNB_BLOCK' ||
                        selectedBooking.status === 'KAYSTAY_BLOCK' ||
                        selectedBooking.status === 'SOPHIA_BLOCK' ||
                        selectedBooking.status === 'CHECKED_IN' ||
                        selectedBooking.status === 'CHECKED_OUT' ||
                        selectedBooking.status === 'CANCELLED'
                      }
                    >
                      {actionLoading === 'check-in' ? 'Checking in...' : 'Check-in'}
                    </button>
                  ) : null}
                  {bookingModalMode === 'details' && selectedBooking ? (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void initiateCheckOut()}
                      disabled={actionLoading !== null || selectedBooking.status !== 'CHECKED_IN'}
                    >
                      {actionLoading === 'check-out' ? 'Checking out...' : 'Check-out'}
                    </button>
                  ) : null}
                  {bookingModalMode === 'details' &&
                  selectedBooking &&
                  selectedBooking.status !== 'AIRBNB_BLOCK' &&
                  selectedBooking.status !== 'KAYSTAY_BLOCK' &&
                  selectedBooking.status !== 'SOPHIA_BLOCK' &&
                  selectedBooking.status !== 'CHECKED_OUT' &&
                  selectedBooking.status !== 'CANCELLED' ? (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void handleCancelBooking()}
                      disabled={actionLoading !== null}
                      style={{ color: '#991b1b' }}
                    >
                      {actionLoading === 'cancel'
                        ? selectedBooking.status === 'TEMP_BLOCK'
                          ? 'Unlocking...'
                          : 'Cancelling...'
                        : selectedBooking.status === 'TEMP_BLOCK'
                          ? 'Unlock'
                          : 'Cancel booking'}
                    </button>
                  ) : null}
                  {bookingModalMode === 'details' &&
                  selectedBooking &&
                  selectedBooking.status !== 'AIRBNB_BLOCK' &&
                  selectedBooking.status !== 'KAYSTAY_BLOCK' &&
                  selectedBooking.status !== 'SOPHIA_BLOCK' &&
                  selectedBooking.status !== 'CANCELLED' ? (
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
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {selectedRoomStatus === 'OOI' && selectedRoom ? (
                          <button
                            className={`room-bookings-list-badge ${selectedRoomStatusMeta.toneClass} room-bookings-badge-button`}
                            type="button"
                            onClick={() => setOoiInsightRoomCode(selectedRoom.code)}
                          >
                            {selectedRoomStatusMeta.label}
                          </button>
                        ) : (
                          <span className={`room-bookings-list-badge ${selectedRoomStatusMeta.toneClass}`}>
                            {selectedRoomStatusMeta.label}
                          </span>
                        )}
                        {selectedRoom?.repairNeeded ? (
                          <button
                            className="room-bookings-list-badge needs-repair room-bookings-badge-button"
                            type="button"
                            onClick={() => setRepairInsightRoomCode(selectedRoom.code)}
                          >
                            Needs repair
                          </button>
                        ) : null}
                      </div>
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
                      <span>Cleaned at</span>
                      <strong>{selectedRoom?.cleanedAt ? formatDateTime(selectedRoom.cleanedAt) : 'Not yet'}</strong>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Cleaned by</span>
                      <strong>{selectedRoom?.cleanedByName || selectedRoom?.cleanedByUsername || 'Not yet'}</strong>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Repair status</span>
                      <strong>{selectedRoom?.repairNeeded ? 'Needs repair' : 'No open repair'}</strong>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Repair reported at</span>
                      <strong>{selectedRoom?.repairReportedAt ? formatDateTime(selectedRoom.repairReportedAt) : 'Not yet'}</strong>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Repair reported by</span>
                      <strong>{selectedRoom?.repairReportedByName || selectedRoom?.repairReportedByUsername || 'Not yet'}</strong>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Repair detail</span>
                      <strong>{selectedRoom?.repairDetails || 'Not yet'}</strong>
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
                        min={minCheckInDateValue}
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
                        min={minAllowedCheckOutDateValue}
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
                <button className="btn" type="button" onClick={() => setShowConfirmInformation(false)}>
                  Close
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
                    Booking confirmation
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
                        Included services
                      </div>
                      <div className="room-booking-confirm-side-text">{confirmationIncludedText}</div>
                    </div>

                    <div className="room-booking-confirm-side-card">
                      <div className="room-booking-confirm-side-title">
                        Important notes
                      </div>
                      <div className="room-booking-confirm-side-text">{confirmationImportantText}</div>
                    </div>

                    <div className="room-booking-confirm-side-card">
                      <div className="room-booking-confirm-side-title">
                        Guest support via WhatsApp
                      </div>
                      <div className="room-booking-confirm-side-text">{confirmationSupportText}</div>
                    </div>

                    {confirmationNotes ? (
                      <div className="room-booking-confirm-side-card">
                        <div className="room-booking-confirm-side-title">
                          Additional notes
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

        {showCheckoutModal && selectedBooking ? (
          <div
            className="room-booking-modal-overlay"
            role="dialog"
            aria-modal="true"
            onClick={() => {
              if (actionLoading === 'check-out') return
              setShowCheckoutModal(false)
              setCheckoutCollectedAmount('')
            }}
          >
            <div className="room-booking-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
              <div className="room-booking-modal-head">
                <div>
                  <div className="room-bookings-feedback-popup-title error">
                    ⚠ Payment required before check-out
                  </div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    Booking #{selectedBooking.id} • {selectedBooking.guestName || 'Guest'} • {selectedBooking.roomCode}
                  </div>
                </div>
                <div className="room-booking-modal-actions">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setShowCheckoutModal(false)
                      setCheckoutCollectedAmount('')
                    }}
                    disabled={actionLoading === 'check-out'}
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="room-booking-modal-body">
                <div className="row" style={{ gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div className="field-label" style={{ fontSize: 13, marginBottom: 6 }}>Total villa rate</div>
                    <strong style={{ fontSize: 18 }}>
                      {formatMoney(selectedBooking.villaRate, 'vi')}
                    </strong>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="field-label" style={{ fontSize: 13, marginBottom: 6 }}>Deposit paid</div>
                    <strong style={{ fontSize: 18 }}>
                      {formatMoney(selectedBooking.depositAmount, 'vi')}
                    </strong>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="field-label" style={{ fontSize: 13, marginBottom: 6, color: '#991b1b' }}>
                      Remaining balance
                    </div>
                    <strong style={{ fontSize: 20, color: '#991b1b' }}>
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
                </div>

                <label className="field">
                  <div className="field-label">Amount received at check-out (VND)</div>
                  <input
                    className="input"
                    style={{ fontSize: 20, fontWeight: 700, height: 52 }}
                    value={checkoutCollectedAmount}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, '')
                      const formatted = digits ? toMoneyInputValue(Number(digits)) : ''
                      setCheckoutCollectedAmount(formatted)
                    }}
                    placeholder="Enter amount received (e.g. 2.000.000)"
                  />
                  <div className="muted" style={{ marginTop: 6 }}>
                    Check-out is allowed only when the remaining balance becomes 0.
                  </div>
                </label>

                {formError ? (
                  <div className="card error" style={{ marginTop: 16 }}>
                    <div className="error-title">Error</div>
                    <div className="muted">{formError}</div>
                  </div>
                ) : null}

                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20, gap: 10 }}>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      setShowCheckoutModal(false)
                      setCheckoutCollectedAmount('')
                    }}
                    disabled={actionLoading === 'check-out'}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn primary"
                    type="button"
                    onClick={() => {
                      setFormError(null)
                      const parsed = parseMoneyInput(checkoutCollectedAmount)
                      if (parsed === undefined || Number.isNaN(parsed) || parsed <= 0) {
                        setFormError('Please enter a valid amount.')
                        return
                      }
                      void confirmCheckOut(parsed)
                    }}
                    disabled={actionLoading === 'check-out'}
                  >
                    {actionLoading === 'check-out' ? 'Processing...' : 'Confirm & Check-out'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {pendingMoveConfirmation ? (
          <div
            className="room-booking-modal-overlay"
            role="dialog"
            aria-modal="true"
            onClick={() => {
              if (movingBookingId) return
              setPendingMoveConfirmation(null)
            }}
          >
            <div className="room-booking-modal room-booking-move-modal" onClick={(e) => e.stopPropagation()}>
              <div className="room-booking-modal-head">
                <div>
                  <div className="room-bookings-feedback-popup-title">
                    Confirm villa move
                  </div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    Please review the new villa and stay dates before completing this move.
                  </div>
                </div>
                <div className="room-booking-modal-actions">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setPendingMoveConfirmation(null)}
                    disabled={movingBookingId !== null}
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="room-booking-modal-body">
                <div className="room-booking-move-grid">
                  <div className="room-booking-detail-card">
                    <div className="room-booking-detail-label">Guest</div>
                    <strong>{pendingMoveConfirmation.booking.guestName || 'Guest'}</strong>
                    <div className="muted">{pendingMoveConfirmation.booking.source || 'Direct'}</div>
                  </div>
                  <div className="room-booking-detail-card">
                    <div className="room-booking-detail-label">Current villa</div>
                    <strong>{pendingMoveConfirmation.booking.roomCode}</strong>
                    <div className="muted">{roomByCode[pendingMoveConfirmation.booking.roomCode]?.name || 'Current villa'}</div>
                  </div>
                  <div className="room-booking-detail-card">
                    <div className="room-booking-detail-label">Move to</div>
                    <strong>{pendingMoveConfirmation.targetRoomCode}</strong>
                    <div className="muted">{pendingMoveRoom?.name || 'Selected villa'}</div>
                  </div>
                  <div className="room-booking-detail-card">
                    <div className="room-booking-detail-label">New stay</div>
                    <strong>{formatDateOnly(`${pendingMoveConfirmation.targetDateKey}T00:00`)}</strong>
                    <div className="muted">→ {formatDateOnly(pendingMoveCheckOutAt)}</div>
                  </div>
                </div>

                <div className="room-booking-detail-panel">
                  <div className="room-booking-detail-row">
                    <span>Current stay</span>
                    <strong>{formatDateOnly(pendingMoveConfirmation.booking.checkInAt)} → {formatDateOnly(pendingMoveConfirmation.booking.checkOutAt)}</strong>
                  </div>
                  <div className="room-booking-detail-row">
                    <span>New stay</span>
                    <strong>{formatDateOnly(`${pendingMoveConfirmation.targetDateKey}T00:00`)} → {formatDateOnly(pendingMoveCheckOutAt)}</strong>
                  </div>
                </div>

                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8, gap: 10 }}>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setPendingMoveConfirmation(null)}
                    disabled={movingBookingId !== null}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn primary"
                    type="button"
                    onClick={() => void confirmMoveBooking()}
                    disabled={movingBookingId !== null}
                  >
                    {movingBookingId !== null ? 'Moving...' : 'Confirm move'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {calendarFeedback ? (
          <div
            className="room-booking-modal-overlay"
            role="dialog"
            aria-modal="true"
            onClick={() => setCalendarFeedback(null)}
          >
            <div className="room-booking-modal" onClick={(e) => e.stopPropagation()}>
              <div className="room-booking-modal-head">
                <div>
                  <div className={`room-bookings-feedback-popup-title ${calendarFeedback.tone}`}>
                    {calendarFeedback.tone === 'success' ? '✓ ' : '✕ '}
                    {calendarFeedback.title}
                  </div>
                </div>
                <div className="room-booking-modal-actions">
                  <button className="btn primary" type="button" onClick={() => setCalendarFeedback(null)}>
                    OK
                  </button>
                </div>
              </div>
              <div className="room-booking-modal-body">
                <div className={`room-bookings-feedback-popup-message ${calendarFeedback.tone}`}>
                  {calendarFeedback.message}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {repairInsightRoom ? (
          <div
            className="room-booking-modal-overlay"
            role="dialog"
            aria-modal="true"
            onClick={() => setRepairInsightRoomCode(null)}
          >
            <div className="room-booking-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
              <div className="room-booking-modal-head">
                <div>
                  <div className="room-bookings-feedback-popup-title">Repair detail</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {repairInsightRoom.code} • {repairInsightRoom.name || 'Villa'}
                  </div>
                </div>
                <div className="room-booking-modal-actions">
                  <button className="btn" type="button" onClick={() => setRepairInsightRoomCode(null)}>
                    Close
                  </button>
                </div>
              </div>
              <div className="room-booking-modal-body">
                <div className="room-booking-detail-panel">
                  <div className="room-booking-detail-row">
                    <span>Operational status</span>
                    <span className={`room-bookings-list-badge ${ROOM_OPERATIONAL_STATUS_META[normalizeRoomOperationalStatus(repairInsightRoom.operationalStatus)].toneClass}`}>
                      {ROOM_OPERATIONAL_STATUS_META[normalizeRoomOperationalStatus(repairInsightRoom.operationalStatus)].label}
                    </span>
                  </div>
                  <div className="room-booking-detail-row">
                    <span>Repair status</span>
                    <strong>{repairInsightRoom.repairNeeded ? 'Needs repair' : 'No open repair'}</strong>
                  </div>
                  <div className="room-booking-detail-row">
                    <span>Reported at</span>
                    <strong>{repairInsightRoom.repairReportedAt ? formatDateTime(repairInsightRoom.repairReportedAt) : 'Not yet'}</strong>
                  </div>
                  <div className="room-booking-detail-row">
                    <span>Reported by</span>
                    <strong>{repairInsightRoom.repairReportedByName || repairInsightRoom.repairReportedByUsername || 'Not yet'}</strong>
                  </div>
                  <div className="room-booking-detail-row">
                    <span>Detail</span>
                    <strong>{repairInsightRoom.repairDetails || 'Not yet'}</strong>
                  </div>
                  <div className="room-booking-detail-row">
                    <span>Location</span>
                    <strong>{repairInsightRoom.location || 'Not set'}</strong>
                  </div>
                  <div className="room-booking-detail-row">
                    <span>Host</span>
                    <strong>{repairInsightRoom.host || 'Unassigned host'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {ooiInsightRoom ? (
          <div
            className="room-booking-modal-overlay"
            role="dialog"
            aria-modal="true"
            onClick={() => setOoiInsightRoomCode(null)}
          >
            <div className="room-booking-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
              <div className="room-booking-modal-head">
                <div>
                  <div className="room-bookings-feedback-popup-title">OOI detail</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {ooiInsightRoom.code} • {ooiInsightRoom.name || 'Villa'}
                  </div>
                </div>
                <div className="room-booking-modal-actions">
                  <button className="btn" type="button" onClick={() => setOoiInsightRoomCode(null)}>
                    Close
                  </button>
                </div>
              </div>
              <div className="room-booking-modal-body">
                <div className="room-booking-detail-panel">
                  <div className="room-booking-detail-row">
                    <span>Operational status</span>
                    <span className={`room-bookings-list-badge ${ROOM_OPERATIONAL_STATUS_META[normalizeRoomOperationalStatus(ooiInsightRoom.operationalStatus)].toneClass}`}>
                      {ROOM_OPERATIONAL_STATUS_META[normalizeRoomOperationalStatus(ooiInsightRoom.operationalStatus)].label}
                    </span>
                  </div>
                  <div className="room-booking-detail-row">
                    <span>OOI detail</span>
                    <strong>{ooiInsightRoom.ooiDetails || 'Not yet'}</strong>
                  </div>
                  <div className="room-booking-detail-row">
                    <span>Marked at</span>
                    <strong>{ooiInsightRoom.ooiMarkedAt ? formatDateTime(ooiInsightRoom.ooiMarkedAt) : 'Not yet'}</strong>
                  </div>
                  <div className="room-booking-detail-row">
                    <span>Marked by</span>
                    <strong>{ooiInsightRoom.ooiMarkedByName || ooiInsightRoom.ooiMarkedByUsername || 'Not yet'}</strong>
                  </div>
                  <div className="room-booking-detail-row">
                    <span>Cleared at</span>
                    <strong>{ooiInsightRoom.ooiClearedAt ? formatDateTime(ooiInsightRoom.ooiClearedAt) : 'Not yet'}</strong>
                  </div>
                  <div className="room-booking-detail-row">
                    <span>Cleared by</span>
                    <strong>{ooiInsightRoom.ooiClearedByName || ooiInsightRoom.ooiClearedByUsername || 'Not yet'}</strong>
                  </div>
                  <div className="room-booking-detail-row">
                    <span>Location</span>
                    <strong>{ooiInsightRoom.location || 'Not set'}</strong>
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
