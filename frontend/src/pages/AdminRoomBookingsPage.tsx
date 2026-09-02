import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type {
  AirbnbSyncRunResponse,
  KayStaySyncRunResponse,
  Room,
  RoomBookingRequest,
  RoomBookingResponse,
  RoomBookingStatus,
  VillaServiceBookingOrderResponse,
  VillaServiceCatalog,
  VillaServiceOrder,
  VillaServiceOrderUpsertRequest,
  SophiaSyncRunResponse,
  VillaSettingsResponse,
} from '../types'
import {
  buildGroupedScheduleRows,
  buildQuickBookingDateRange,
  compareRoomsByLocation,
  getVillaTierDefinition,
  getBookedDateKeysForRoom,
  sortRoomCodesByVillaTier,
  toggleQuickBookingDate,
  validateQuickBookingSelection,
  VILLA_TIER_DEFINITIONS,
  type QuickBookingSelection,
  type VillaTierKey,
} from './AdminRoomBookingsPage.utils'
import { calculateVillaServiceTotal, calculateVillaServiceVendorCostTotal } from './villa-service-utils'
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
type ConfirmationTemplate = {
  includedServices: string
  importantNotes: string
  guestSupport: string
}
type VillaMonthCalendarCell = {
  date: Date
  dateKey: string
  inMonth: boolean
  isToday: boolean
  activeBooking: ScheduleBooking | null
  checkInBookings: ScheduleBooking[]
  checkOutBookings: ScheduleBooking[]
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
const RESERVED_FILTER_STATUSES: VisibleRoomBookingStatus[] = ['CONFIRMED', 'AIRBNB_BLOCK', 'KAYSTAY_BLOCK', 'SOPHIA_BLOCK']

const ALL_STATUSES = Object.keys(STATUS_META) as VisibleRoomBookingStatus[]
const STATUS_FILTER_PILLS: VisibleRoomBookingStatus[] = ['CONFIRMED', 'TEMP_BLOCK', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED']
const FALLBACK_ROOM_CODE = 'V107'
const DAY_DURATION_MS = 24 * 60 * 60 * 1000
const STANDARD_CHECK_IN_HOUR = 15
const STANDARD_CHECK_OUT_HOUR = 11
const MONTH_CALENDAR_WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

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

function renderOperationalStatusBadge(
  status: RoomOperationalStatus,
  options?: {
    button?: boolean
    onClick?: () => void
  },
) {
  const meta = ROOM_OPERATIONAL_STATUS_META[status]
  const className = `room-bookings-list-badge ${meta.toneClass}${status === 'NEEDS_CLEANING' ? ' room-bookings-list-badge-icon-only' : ''}${options?.button ? ' room-bookings-badge-button' : ''}`
  const content = status === 'NEEDS_CLEANING' ? (
    <span aria-hidden="true" className="room-bookings-badge-icon-glyph">🧹</span>
  ) : (
    meta.label
  )
  const accessibilityLabel = status === 'NEEDS_CLEANING' ? meta.label : undefined

  if (options?.button) {
    return (
      <button
        className={className}
        type="button"
        onClick={options.onClick}
        aria-label={accessibilityLabel}
        title={accessibilityLabel}
      >
        {content}
      </button>
    )
  }

  return (
    <span className={className} aria-label={accessibilityLabel} title={accessibilityLabel}>
      {content}
    </span>
  )
}

function renderRepairBadge(onClick: () => void) {
  return (
    <button
      className="room-bookings-list-badge needs-repair room-bookings-badge-button"
      type="button"
      onClick={onClick}
      aria-label="Needs repair"
      title="Needs repair"
    >
      <span aria-hidden="true" className="room-bookings-badge-icon-inline">🔧</span>
      <span>Needs repair</span>
    </button>
  )
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

function buildDefaultConfirmationTemplate(): ConfirmationTemplate {
  return {
    includedServices: 'Welcome fruit and drinks, internet, private pool, daily housekeeping, buggy 08:00 - 22:00.',
    importantNotes: 'Check-in after 15:00, check-out before 11:00, no smoking, quiet hours 22:00 - 06:00.',
    guestSupport: '24/7 support via WhatsApp.',
  }
}

function buildDefaultForm(monthStart: Date, roomCode = FALLBACK_ROOM_CODE, source = 'Direct'): RoomBookingRequest {
  const today = startOfDay(new Date())
  const safeStart = monthStart.getTime() < today.getTime() ? today : monthStart
  const checkInAt = new Date(safeStart)
  checkInAt.setHours(STANDARD_CHECK_IN_HOUR, 0, 0, 0)
  const checkOutAt = addDays(checkInAt, 1)
  checkOutAt.setHours(STANDARD_CHECK_OUT_HOUR, 0, 0, 0)

  return {
    roomCode,
    guestName: '',
    source,
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

function calculateBookingTotalAmount(villaRate?: number, serviceTotal?: number) {
  const total = (villaRate ?? 0) + (serviceTotal ?? 0)
  return total > 0 ? total : undefined
}

function buildDefaultServiceOrderForm(booking?: RoomBookingResponse): VillaServiceOrderUpsertRequest {
  return {
    customerName: booking?.guestName ?? '',
    customerPhone: booking?.phone ?? '',
    serviceDate: toDateInputValue(booking?.checkInAt),
    depositAmount: undefined,
    status: 'OPEN',
    notes: '',
    items: [{ serviceId: 0, quantity: 1, unitPrice: undefined, vendorId: undefined, vendorCost: undefined }],
  }
}

function mapServiceOrderToForm(order: VillaServiceOrder): VillaServiceOrderUpsertRequest {
  return {
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    serviceDate: order.serviceDate ?? '',
    depositAmount: order.depositAmount ?? undefined,
    status: order.status,
    notes: order.notes,
    items: order.items.length > 0
      ? order.items.map((item) => ({
          serviceId: item.serviceId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vendorId: item.vendorId ?? undefined,
          vendorCost: item.vendorCost ?? undefined,
        }))
      : [{ serviceId: 0, quantity: 1, unitPrice: undefined, vendorId: undefined, vendorCost: undefined }],
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

function formatMonthYear(value: Date) {
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

function getMonthCalendarGridDates(monthStart: Date) {
  const firstDayOffset = monthStart.getDay()
  const gridStart = addDays(monthStart, -firstDayOffset)
  return Array.from({ length: 35 }, (_, index) => addDays(gridStart, index))
}

function isDateInsideBooking(dateKey: string, booking: RoomBookingResponse) {
  const checkInDateKey = toDateInputValue(booking.checkInAt)
  const checkOutDateKey = toDateInputValue(booking.checkOutAt)
  if (!checkInDateKey || !checkOutDateKey) return false
  return dateKey >= checkInDateKey && dateKey < checkOutDateKey
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
  const [bookingSources, setBookingSources] = useState<string[]>(['Direct'])
  const [serviceCatalog, setServiceCatalog] = useState<VillaServiceCatalog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [selectedVillaType, setSelectedVillaType] = useState<VillaTierKey | ''>('')
  const [selectedHost, setSelectedHost] = useState('')
  const [selectedBedroomLayout, setSelectedBedroomLayout] = useState('')
  const [activeStatuses, setActiveStatuses] = useState<VisibleRoomBookingStatus[]>(ALL_STATUSES)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null)
  const [bookingModalMode, setBookingModalMode] = useState<BookingModalMode | null>(null)
  const [showConfirmInformation, setShowConfirmInformation] = useState(false)
  const [showServiceOrderModal, setShowServiceOrderModal] = useState(false)
  const confirmationLanguage: ConfirmationLanguage = 'en'
  const [confirmationTemplate, setConfirmationTemplate] = useState<ConfirmationTemplate>(() => buildDefaultConfirmationTemplate())
  const [confirmationDetailsNotes, setConfirmationDetailsNotes] = useState('')
  const [isConfirmationEditing, setIsConfirmationEditing] = useState(false)
  const [quickSelection, setQuickSelection] = useState<QuickBookingSelection | null>(null)
  const [form, setForm] = useState<RoomBookingRequest>(() => buildDefaultForm(startOfMonth(new Date())))
  const [formError, setFormError] = useState<string | null>(null)
  const [calendarFeedback, setCalendarFeedback] = useState<CalendarFeedback | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [checkoutCollectedAmount, setCheckoutCollectedAmount] = useState<string>('')
  const [serviceOrderForm, setServiceOrderForm] = useState<VillaServiceOrderUpsertRequest>(() => buildDefaultServiceOrderForm())
  const [serviceOrderLoading, setServiceOrderLoading] = useState(false)
  const [serviceOrderSaving, setServiceOrderSaving] = useState(false)
  const [serviceOrderError, setServiceOrderError] = useState<string | null>(null)
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
  const [villaCalendarRoomCode, setVillaCalendarRoomCode] = useState<string | null>(null)
  const [touchDrag, setTouchDrag] = useState<TouchDragState | null>(null)
  const loadingRef = useRef(false)
  const scheduleScrollRef = useRef<HTMLDivElement | null>(null)
  const touchDragRef = useRef<TouchDragState | null>(null)
  const draggedBookingRef = useRef<RoomBookingResponse | null>(null)
  const dropTargetRoomCodeRef = useRef<string | null>(null)
  const dropTargetDateKeyRef = useRef<string | null>(null)
  const monthDaysRef = useRef<Date[]>([])
  const pendingScrollToTodayRef = useRef(false)
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
  const villaTypeOptions = useMemo(
    () =>
      VILLA_TIER_DEFINITIONS.filter((tier) => roomsCatalog.some((room) => getVillaTierDefinition(room.code).key === tier.key)),
    [roomsCatalog],
  )
  const areaOptions = useMemo(
    () =>
      Array.from(
        new Map(
          roomsCatalog
            .filter((room) => room.areaId && room.areaName)
            .map((room) => [String(room.areaId), { id: String(room.areaId), name: room.areaName }]),
        ).values(),
      ).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'vi')),
    [roomsCatalog],
  )
  const hostOptions = useMemo(
    () =>
      Array.from(new Set(roomsCatalog.map((room) => room.host?.trim()).filter((value): value is string => Boolean(value))))
        .sort((a, b) => a.localeCompare(b, 'vi')),
    [roomsCatalog],
  )
  const bedroomLayoutOptions = useMemo(
    () =>
      Array.from(new Set(roomsCatalog.map((room) => room.bedroomLayout?.trim()).filter((value): value is string => Boolean(value))))
        .sort((a, b) => a.localeCompare(b, 'vi')),
    [roomsCatalog],
  )
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
  const villaCalendarRoom = useMemo(
    () => (villaCalendarRoomCode ? roomByCode[villaCalendarRoomCode] ?? null : null),
    [roomByCode, villaCalendarRoomCode],
  )
  const draggedBooking = useMemo(
    () => bookings.find((booking) => booking.id === draggingBookingId) ?? null,
    [bookings, draggingBookingId],
  )
  const bookingSourceOptions = useMemo(() => {
    const normalized = bookingSources
      .map((value) => value.trim())
      .filter(Boolean)
    const currentValue = form.source?.trim()
    if (currentValue && !normalized.includes(currentValue)) {
      normalized.push(currentValue)
    }
    if (normalized.length === 0) normalized.push('Direct')
    return normalized
  }, [bookingSources, form.source])
  const bookingServiceOptions = useMemo(
    () =>
      serviceCatalog.filter(
        (service) => service.active || serviceOrderForm.items.some((item) => item.serviceId === service.id),
      ),
    [serviceCatalog, serviceOrderForm.items],
  )
  const serviceOrderDraftTotal = useMemo(
    () => calculateVillaServiceTotal(serviceOrderForm.items.filter((item) => item.serviceId > 0), serviceCatalog),
    [serviceCatalog, serviceOrderForm.items],
  )
  const serviceOrderDraftVendorCost = useMemo(
    () => calculateVillaServiceVendorCostTotal(serviceOrderForm.items.filter((item) => item.serviceId > 0)),
    [serviceOrderForm.items],
  )
  const selectedBookingGrandTotal = useMemo(
    () => calculateBookingTotalAmount(selectedBooking?.villaRate, selectedBooking?.serviceTotal),
    [selectedBooking],
  )
  const serviceOrderDraftGrandTotal = useMemo(
    () => calculateBookingTotalAmount(selectedBooking?.villaRate, serviceOrderDraftTotal),
    [selectedBooking, serviceOrderDraftTotal],
  )
  const serviceOrderDraftRemaining = useMemo(
    () => calculateRemainingAmount(
      serviceOrderDraftGrandTotal,
      (selectedBooking?.depositAmount ?? 0) + (serviceOrderForm.depositAmount ?? 0),
      selectedBooking?.remainingAmount,
    ),
    [selectedBooking, serviceOrderDraftGrandTotal, serviceOrderForm.depositAmount],
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

  const scrollToToday = () => {
    const container = scheduleScrollRef.current
    if (!container) return false
    const todayKey = toIsoDate(startOfDay(new Date()))
    const target = container.querySelector<HTMLElement>(`.room-schedule-day-head[data-day-key="${todayKey}"]`)
    if (!target) return false
    target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    return true
  }

  const handleGoToToday = () => {
    const today = new Date()
    const todayMonthStart = startOfMonth(today)
    const isCurrentMonth =
      monthCursor.getFullYear() === todayMonthStart.getFullYear() &&
      monthCursor.getMonth() === todayMonthStart.getMonth()

    if (isCurrentMonth) {
      requestAnimationFrame(() => {
        scrollToToday()
      })
      return
    }

    pendingScrollToTodayRef.current = true
    setMonthCursor(todayMonthStart)
  }

  useEffect(() => {
    if (!pendingScrollToTodayRef.current || loading) return

    const frameId = window.requestAnimationFrame(() => {
      if (scrollToToday()) {
        pendingScrollToTodayRef.current = false
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [loading, monthCursor, monthDays])

  const updateMonthCursor = (nextMonth: number, nextYear: number) => {
    setMonthCursor(new Date(nextYear, nextMonth, 1))
  }

  useEffect(() => {
    if (bookingModalMode === 'details' && selectedBooking) {
      setConfirmationDetailsNotes(selectedBooking.notes ?? '')
      return
    }
    setConfirmationDetailsNotes('')
  }, [bookingModalMode, selectedBooking])

  async function load(opts?: { silent?: boolean }) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const [bookingsData, roomsData, settingsData, servicesData] = await Promise.all([
        apiFetch<RoomBookingResponse[]>(`/api/admin/room-bookings?from=${toIsoDate(monthStart)}&to=${toIsoDate(monthEnd)}`),
        apiFetch<Room[]>('/api/admin/rooms'),
        apiFetch<VillaSettingsResponse>('/api/admin/villa-settings'),
        apiFetch<VillaServiceCatalog[]>('/api/admin/villa-services'),
      ])
      setBookings(bookingsData)
      setRoomsCatalog(roomsData)
      setServiceCatalog(servicesData)
      setBookingSources(
        settingsData.bookingSources
          .map((item) => item.label.trim())
          .filter(Boolean),
      )
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
    if (editingId || bookingModalMode !== 'create') return
    const defaultSource = bookingSourceOptions[0] || 'Direct'
    setForm((current) => {
      if (current.source === defaultSource) return current
      return { ...current, source: defaultSource, status: 'CONFIRMED' }
    })
  }, [bookingModalMode, bookingSourceOptions, editingId])

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
    const counts = bookings.reduce<Record<VisibleRoomBookingStatus, number>>((acc, booking) => {
      const visibleStatus = normalizeDisplayStatus(booking.status)
      if (!visibleStatus) return acc
      acc[visibleStatus] = (acc[visibleStatus] ?? 0) + 1
      return acc
    }, { CONFIRMED: 0, TEMP_BLOCK: 0, AIRBNB_BLOCK: 0, KAYSTAY_BLOCK: 0, SOPHIA_BLOCK: 0, CHECKED_IN: 0, CHECKED_OUT: 0, CANCELLED: 0 })
    counts.CONFIRMED += counts.AIRBNB_BLOCK + counts.KAYSTAY_BLOCK + counts.SOPHIA_BLOCK
    return counts
  }, [bookings])
  const villaCalendarBookings = useMemo(() => {
    if (!villaCalendarRoomCode) return []

    return sortBookingsByTime(
      bookings.flatMap<ScheduleBooking>((booking) => {
        if (booking.roomCode !== villaCalendarRoomCode) return []
        const visibleStatus = normalizeDisplayStatus(booking.status)
        if (!visibleStatus) return []
        return [{ ...booking, displayStatus: visibleStatus }]
      }),
    )
  }, [bookings, villaCalendarRoomCode])
  const villaCalendarGridCells = useMemo<VillaMonthCalendarCell[]>(() => {
    const currentTodayDateKey = toIsoDate(startOfDay(new Date()))
    return getMonthCalendarGridDates(monthStart).map((date) => {
      const dateKey = toIsoDate(date)
      const activeBooking = villaCalendarBookings.find((booking) => isDateInsideBooking(dateKey, booking)) ?? null
      const checkInBookings = villaCalendarBookings.filter((booking) => toDateInputValue(booking.checkInAt) === dateKey)
      const checkOutBookings = villaCalendarBookings.filter((booking) => toDateInputValue(booking.checkOutAt) === dateKey)

      return {
        date,
        dateKey,
        inMonth: date >= monthStart && date <= monthEnd,
        isToday: dateKey === currentTodayDateKey,
        activeBooking,
        checkInBookings,
        checkOutBookings,
      }
    })
  }, [monthEnd, monthStart, villaCalendarBookings])
  const matchesRoomFilters = (room?: Room | null) => {
    if (!room) {
      return !selectedAreaId && !selectedVillaType && !selectedHost && !selectedBedroomLayout
    }
    const roomTierKey = getVillaTierDefinition(room.code).key
    const roomHost = room.host?.trim() ?? ''
    const roomBedroomLayout = room.bedroomLayout?.trim() ?? ''
    if (selectedAreaId && String(room.areaId) !== selectedAreaId) return false
    if (selectedVillaType && roomTierKey !== selectedVillaType) return false
    if (selectedHost && roomHost !== selectedHost) return false
    if (selectedBedroomLayout && roomBedroomLayout !== selectedBedroomLayout) return false
    return true
  }

  const filteredBookings = useMemo(() => {
    return bookings.flatMap<ScheduleBooking>((booking) => {
      const visibleStatus = normalizeDisplayStatus(booking.status)
      if (!visibleStatus) return []

      const matchesStatus = activeStatuses.includes(visibleStatus)
      if (!matchesStatus) return []
      if (!matchesRoomFilters(roomByCode[booking.roomCode])) return []
      return [{ ...booking, displayStatus: visibleStatus }]
    })
  }, [activeStatuses, bookings, roomByCode, selectedAreaId, selectedBedroomLayout, selectedHost, selectedVillaType])

  const rooms = useMemo(() => {
    const catalogCodes = roomsCatalog
      .filter((room) => matchesRoomFilters(room))
      .map((room) => room.code)
    const bookingCodes = filteredBookings.map((booking) => booking.roomCode)
    const uniqueRooms = Array.from(new Set([...catalogCodes, ...bookingCodes].filter(Boolean)))

    return sortRoomCodesByVillaTier(uniqueRooms, roomByCode)
  }, [filteredBookings, roomByCode, roomsCatalog, selectedAreaId, selectedBedroomLayout, selectedHost, selectedVillaType])

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
      const remaining = calculateRemainingAmount(booking.totalAmount ?? booking.villaRate, booking.depositAmount, booking.remainingAmount) ?? 0
      const deposit = booking.depositAmount ?? 0
      const bookingTotal = booking.totalAmount ?? booking.villaRate ?? 0
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
      if (isFinancialBooking && bookingTotal > 0 && remaining <= 0.001) {
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
    setForm(buildDefaultForm(monthStart, roomsCatalog[0]?.code ?? FALLBACK_ROOM_CODE, bookingSources[0] ?? 'Direct'))
    setConfirmationTemplate(buildDefaultConfirmationTemplate())
    setConfirmationDetailsNotes('')
    setIsConfirmationEditing(false)
    setServiceOrderForm(buildDefaultServiceOrderForm())
    setServiceOrderError(null)
    setShowServiceOrderModal(false)
    setFormError(null)
  }

  const closeBookingModal = () => {
    setBookingModalMode(null)
    setSelectedBookingId(null)
    setShowConfirmInformation(false)
    setConfirmationTemplate(buildDefaultConfirmationTemplate())
    setConfirmationDetailsNotes('')
    setIsConfirmationEditing(false)
    setServiceOrderForm(buildDefaultServiceOrderForm())
    setServiceOrderError(null)
    setShowServiceOrderModal(false)
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
      ...buildDefaultForm(monthStart, quickSelection.roomCode, bookingSources[0] ?? 'Direct'),
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
    setConfirmationTemplate(buildDefaultConfirmationTemplate())
    setConfirmationDetailsNotes(booking.notes ?? '')
    setIsConfirmationEditing(false)
    setFormError(null)
    setEditingId(null)
  }

  const openVillaMonthCalendar = (roomCode: string) => {
    setVillaCalendarRoomCode(roomCode)
  }

  const handleVillaCellDoubleClick = (roomCode: string, event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('a, button')) return
    openVillaMonthCalendar(roomCode)
  }

  const editBooking = (booking: RoomBookingResponse) => {
    setEditingId(booking.id)
    setSelectedBookingId(booking.id)
    setForm(mapBookingToForm(booking))
    setBookingModalMode('edit')
    setShowConfirmInformation(false)
    setConfirmationTemplate(buildDefaultConfirmationTemplate())
    setConfirmationDetailsNotes('')
    setIsConfirmationEditing(false)
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
      const groupedStatuses = status === 'CONFIRMED' ? RESERVED_FILTER_STATUSES : [status]
      const isActive = groupedStatuses.every((value) => current.includes(value))

      if (isActive) {
        if (current.length === groupedStatuses.length) return ALL_STATUSES
        return current.filter((value) => !groupedStatuses.includes(value))
      }

      const next = [...current]
      groupedStatuses.forEach((value) => {
        if (!next.includes(value)) next.push(value)
      })
      return next
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
      source: form.source?.trim() || bookingSourceOptions[0] || 'Direct',
      phone: form.phone?.trim() || '',
      adults: Number(form.adults),
      children: Number(form.children),
      checkInAt: form.checkInAt,
      checkOutAt: form.checkOutAt,
      status: editingId ? form.status : 'CONFIRMED',
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
      calculateRemainingAmount(selectedBooking.totalAmount ?? selectedBooking.villaRate, selectedBooking.depositAmount, selectedBooking.remainingAmount) ?? 0
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

  const openServiceOrderModal = async () => {
    if (!selectedBooking) return
    setShowServiceOrderModal(true)
    setServiceOrderLoading(true)
    setServiceOrderError(null)
    try {
      const response = await apiFetch<VillaServiceBookingOrderResponse>(`/api/admin/room-bookings/${selectedBooking.id}/service-order`)
      setServiceOrderForm(mapServiceOrderToForm(response.order))
      setBookings((current) => current.map((booking) => (booking.id === response.booking.id ? response.booking : booking)))
    } catch (e: unknown) {
      setServiceOrderError(getErrorMessage(e, 'Could not load service order'))
      setServiceOrderForm(buildDefaultServiceOrderForm(selectedBooking))
    } finally {
      setServiceOrderLoading(false)
    }
  }

  const handleSaveServiceOrder = async () => {
    if (!selectedBooking) return
    setServiceOrderSaving(true)
    setServiceOrderError(null)
    try {
      const payload: VillaServiceOrderUpsertRequest = {
        customerName: serviceOrderForm.customerName?.trim() || selectedBooking.guestName,
        customerPhone: serviceOrderForm.customerPhone?.trim() || selectedBooking.phone,
        serviceDate: serviceOrderForm.serviceDate || toDateInputValue(selectedBooking.checkInAt),
        depositAmount: serviceOrderForm.depositAmount,
        status: 'OPEN',
        notes: serviceOrderForm.notes?.trim() || '',
        items: serviceOrderForm.items.filter((item) => item.serviceId > 0 && item.quantity > 0),
      }
      const response = await apiFetch<VillaServiceBookingOrderResponse>(`/api/admin/room-bookings/${selectedBooking.id}/service-order`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setServiceOrderForm(mapServiceOrderToForm(response.order))
      setBookings((current) => current.map((booking) => (booking.id === response.booking.id ? response.booking : booking)))
      setSelectedBookingId(response.booking.id)
      setCalendarFeedback({
        tone: 'success',
        title: 'Service order saved',
        message: `Updated service total for ${response.booking.roomCode}.`,
      })
    } catch (e: unknown) {
      setServiceOrderError(getErrorMessage(e, 'Could not save service order'))
    } finally {
      setServiceOrderSaving(false)
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
          totalAmount: selectedBooking.totalAmount,
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
  const confirmationRoomName = roomByCode[confirmationSource.roomCode]?.name || 'Luxury Villa'
  const confirmationCheckInMs = new Date(confirmationSource.checkInAt).getTime()
  const confirmationCheckOutMs = new Date(confirmationSource.checkOutAt).getTime()
  const confirmationNights =
    Number.isNaN(confirmationCheckInMs) || Number.isNaN(confirmationCheckOutMs)
      ? 0
      : Math.max(1, Math.round((confirmationCheckOutMs - confirmationCheckInMs) / DAY_DURATION_MS))
  const confirmationRoom = roomByCode[confirmationSource.roomCode]
  const confirmationStatusLabel =
    CONFIRMATION_STATUS_LABELS[confirmationLanguage][normalizeEditableStatus(confirmationSource.status)]
  const confirmationBookingId = selectedBooking?.id ? `#${selectedBooking.id}` : 'TBA'
  const confirmationVillaType = confirmationRoom?.type?.trim() || 'TBA'
  const confirmationVillaRateValue = parseMoneyInput(confirmationSource.villaRate)
  const confirmationTotalAmountSource = parseMoneyInput(
    'totalAmount' in confirmationSource ? confirmationSource.totalAmount : undefined,
  )
  const confirmationDepositAmountValue = parseMoneyInput(confirmationSource.depositAmount)
  const confirmationRemainingAmountValue = calculateRemainingAmount(
    confirmationTotalAmountSource ?? confirmationVillaRateValue,
    confirmationDepositAmountValue,
    parseMoneyInput(confirmationSource.remainingAmount),
  )
  const confirmationTotalAmountValue = confirmationTotalAmountSource ?? confirmationVillaRateValue
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
  const isConfirmationEditable = isConfirmationEditing
  const defaultConfirmationTemplate = buildDefaultConfirmationTemplate()
  const confirmationSupportText = isConfirmationEditable ? confirmationTemplate.guestSupport : defaultConfirmationTemplate.guestSupport
  const confirmationIncludedText = isConfirmationEditable ? confirmationTemplate.includedServices : defaultConfirmationTemplate.includedServices
  const confirmationImportantText = isConfirmationEditable ? confirmationTemplate.importantNotes : defaultConfirmationTemplate.importantNotes
  const confirmationAdditionalNotes = bookingModalMode === 'details'
    ? confirmationDetailsNotes.trim()
    : (form.notes?.trim() || '')
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
        <div className="row room-bookings-page-topbar" style={{ justifyContent: 'space-between' }}>
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
              Grouped by villa tier. Double click one available day to start a booking range, then double click a later day on the
              same villa row to extend the stay. Double click the villa cell to open a monthly desktop calendar popup for that villa.
            </div>
          </div>
          <div className="row room-bookings-sync-actions" style={{ gap: 10 }}>
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

        <div className="room-bookings-workspace">
          <div className="room-bookings-toolbar card detail-card">
            <div className="row room-bookings-toolbar-top">
              <div className="room-bookings-filter-group">
                <label className="field room-bookings-filter-field">
                  <div className="field-label">Khu</div>
                  <select
                    className="select"
                    value={selectedAreaId}
                    onChange={(e) => setSelectedAreaId(e.target.value)}
                  >
                    <option value="">Tất cả</option>
                    {areaOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field room-bookings-filter-field">
                  <div className="field-label">Hạng villa</div>
                  <select
                    className="select"
                    value={selectedVillaType}
                    onChange={(e) => setSelectedVillaType(e.target.value as VillaTierKey | '')}
                  >
                    <option value="">Tất cả</option>
                    {villaTypeOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field room-bookings-filter-field">
                  <div className="field-label">Host</div>
                  <select
                    className="select"
                    value={selectedHost}
                    onChange={(e) => setSelectedHost(e.target.value)}
                  >
                    <option value="">Tất cả</option>
                    {hostOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field room-bookings-filter-field">
                  <div className="field-label">Kết cấu giường</div>
                  <select
                    className="select"
                    value={selectedBedroomLayout}
                    onChange={(e) => setSelectedBedroomLayout(e.target.value)}
                  >
                    <option value="">Tất cả</option>
                    {bedroomLayoutOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
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
                  <label className="field room-bookings-month-field room-bookings-nav-month-field">
                    <div className="field-label">Tháng</div>
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
                  <button
                    className="btn room-bookings-nav-btn"
                    type="button"
                    onClick={() => setMonthCursor((current) => addMonths(current, 1))}
                  >
                    →
                  </button>
                </div>
                <div className="room-bookings-picker-group">
                  <label className="field room-bookings-month-field room-bookings-year-field">
                    <div className="field-label">Năm</div>
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
                  <button
                    className="btn room-bookings-today-btn"
                    type="button"
                    onClick={handleGoToToday}
                  >
                    Hôm nay
                  </button>
                </div>
              </div>
            </div>

            <div className="room-bookings-status-row">
              {STATUS_FILTER_PILLS.map((status) => {
                const meta = STATUS_META[status]
                const active =
                  status === 'CONFIRMED'
                    ? RESERVED_FILTER_STATUSES.every((value) => activeStatuses.includes(value))
                    : activeStatuses.includes(status)
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
                          <div
                            key={day.toISOString()}
                            className={`room-schedule-day-head ${isToday ? 'is-today' : ''} ${isPast ? 'is-past' : ''}`}
                            data-day-key={toIsoDate(day)}
                          >
                            <span className="room-schedule-day-weekday">{formatDayLabel(day)}</span>
                            <strong className="room-schedule-day-number">{formatDayNumber(day)}</strong>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {groupedScheduleRows.map((row) => {
                    if (row.type === 'area') {
                      return (
                        <div key={`area-${row.areaKey}`} className="room-schedule-area-row">
                          <div className="room-schedule-area-cell">
                            <strong>{row.label}</strong>
                          </div>
                          <div className="room-schedule-area-track" />
                        </div>
                      )
                    }

                    if (row.type === 'villa-tier') {
                      return (
                        <div key={`tier-${row.tierKey}`} className={`room-schedule-host-row room-schedule-host-row-${row.toneClass}`}>
                          <div className={`room-schedule-host-cell room-schedule-host-cell-${row.toneClass}`}>
                            <span className="room-schedule-host-emoji" aria-hidden="true">{row.emoji}</span>
                            <strong>{row.label}</strong>
                          </div>
                          <div className={`room-schedule-host-track room-schedule-host-track-${row.toneClass}`} />
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
                        <div
                          className="room-schedule-room-cell room-schedule-room-cell-interactive"
                          onDoubleClick={(event) => handleVillaCellDoubleClick(roomCode, event)}
                          title={`Double click to open ${roomCode} monthly calendar`}
                        >
                          <div className="room-schedule-room-cell-content">
                            <div>{roomCode}</div>
                            {room?.airbnbUrl ? (
                              <a href={room.airbnbUrl} target="_blank" rel="noreferrer" className="room-schedule-room-link">
                                Link
                              </a>
                            ) : (
                              <div className="room-schedule-room-link muted">Pending</div>
                            )}
                            {operationalStatus !== 'READY'
                              ? operationalStatus === 'OOI'
                                ? renderOperationalStatusBadge(operationalStatus, {
                                    button: true,
                                    onClick: () => setOoiInsightRoomCode(roomCode),
                                  })
                                : renderOperationalStatusBadge(operationalStatus)
                              : null}
                            {room?.repairNeeded ? (
                              renderRepairBadge(() => setRepairInsightRoomCode(roomCode))
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
                    <button className="btn" type="button" onClick={() => void openServiceOrderModal()}>
                      Services
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
                        {selectedRoomStatus === 'OOI' && selectedRoom
                          ? renderOperationalStatusBadge(selectedRoomStatus, {
                              button: true,
                              onClick: () => setOoiInsightRoomCode(selectedRoom.code),
                            })
                          : renderOperationalStatusBadge(selectedRoomStatus)}
                        {selectedRoom?.repairNeeded ? (
                          renderRepairBadge(() => setRepairInsightRoomCode(selectedRoom.code))
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
                      {renderOperationalStatusBadge(selectedRoomStatus)}
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
                      <span>Service total</span>
                      <strong>{formatMoney(selectedBooking.serviceTotal, 'vi')}</strong>
                    </div>
                    <div className="room-booking-detail-row">
                      <span>Grand total</span>
                      <strong>{formatMoney(selectedBookingGrandTotal, 'vi')}</strong>
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
                            selectedBooking.totalAmount ?? selectedBooking.villaRate,
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
                    {editingId ? (
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
                    ) : null}
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
                      <select
                        className="select"
                        value={form.source}
                        onChange={(e) => setForm((current) => ({ ...current, source: e.target.value }))}
                      >
                        {bookingSourceOptions.map((source) => (
                          <option key={source} value={source}>
                            {source}
                          </option>
                        ))}
                      </select>
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
                      <div className="field-label">Service total</div>
                      <input
                        className="input"
                        type="text"
                        inputMode="numeric"
                        value={toMoneyInputValue(selectedBooking?.serviceTotal)}
                        readOnly
                      />
                    </label>
                    <label className="field" style={{ flex: 1, minWidth: 160 }}>
                      <div className="field-label">Grand total</div>
                      <input
                        className="input"
                        type="text"
                        inputMode="numeric"
                        value={toMoneyInputValue(calculateBookingTotalAmount(parseMoneyInput(form.villaRate), selectedBooking?.serviceTotal))}
                        readOnly
                      />
                    </label>
                  </div>

                  <div className="row">
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
                            calculateBookingTotalAmount(parseMoneyInput(form.villaRate), selectedBooking?.serviceTotal),
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

        {bookingModalMode === 'details' && showServiceOrderModal && selectedBooking ? (
          <div className="room-booking-modal-overlay" role="dialog" aria-modal="true" onClick={() => setShowServiceOrderModal(false)}>
            <div className="room-booking-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
              <div className="room-booking-modal-head">
                <div>
                  <div className="room-booking-editor-title">Booking services</div>
                  <div className="muted">
                    {selectedBooking.roomCode} • {selectedBooking.guestName}
                  </div>
                </div>
                <div className="room-booking-modal-actions">
                  <button className="btn primary" type="button" onClick={() => void handleSaveServiceOrder()} disabled={serviceOrderSaving || serviceOrderLoading}>
                    {serviceOrderSaving ? 'Saving...' : 'Save services'}
                  </button>
                  <button className="btn" type="button" onClick={() => setShowServiceOrderModal(false)}>
                    Close
                  </button>
                </div>
              </div>

              <div className="room-booking-modal-body">
                {serviceOrderLoading ? (
                  <div className="card">Loading services...</div>
                ) : (
                  <>
                    <div className="room-booking-details-grid">
                      <div className="room-booking-detail-card">
                        <div className="room-booking-detail-label">Customer</div>
                        <input
                          className="input"
                          value={serviceOrderForm.customerName ?? ''}
                          onChange={(e) => setServiceOrderForm((current) => ({ ...current, customerName: e.target.value }))}
                        />
                      </div>
                      <div className="room-booking-detail-card">
                        <div className="room-booking-detail-label">Phone</div>
                        <input
                          className="input"
                          value={serviceOrderForm.customerPhone ?? ''}
                          onChange={(e) => setServiceOrderForm((current) => ({ ...current, customerPhone: e.target.value }))}
                        />
                      </div>
                      <div className="room-booking-detail-card">
                        <div className="room-booking-detail-label">Service date</div>
                        <input
                          className="input"
                          type="date"
                          value={serviceOrderForm.serviceDate ?? ''}
                          onChange={(e) => setServiceOrderForm((current) => ({ ...current, serviceDate: e.target.value }))}
                        />
                      </div>
                      <div className="room-booking-detail-card">
                        <div className="room-booking-detail-label">Villa rate</div>
                        <strong>{formatMoney(selectedBooking.villaRate, 'vi')}</strong>
                        <div className="muted">Base booking price</div>
                      </div>
                      <div className="room-booking-detail-card">
                        <div className="room-booking-detail-label">Service total</div>
                        <strong>{formatMoney(serviceOrderDraftTotal, 'vi')}</strong>
                        <div className="muted">Updates live while editing</div>
                      </div>
                      <div className="room-booking-detail-card">
                        <div className="room-booking-detail-label">Service deposit</div>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          value={serviceOrderForm.depositAmount ?? ''}
                          onChange={(e) =>
                            setServiceOrderForm((current) => ({
                              ...current,
                              depositAmount: e.target.value === '' ? undefined : Number(e.target.value),
                            }))
                          }
                        />
                      </div>
                    </div>

                    <label className="field">
                      <div className="field-label">Service order notes</div>
                      <textarea
                        className="textarea"
                        value={serviceOrderForm.notes ?? ''}
                        onChange={(e) => setServiceOrderForm((current) => ({ ...current, notes: e.target.value }))}
                      />
                    </label>

                    <div className="room-booking-detail-panel">
                      {serviceOrderForm.items.map((item, index) => {
                        const vendorOptions = bookingServiceOptions.find((service) => service.id === item.serviceId)?.vendors ?? []
                        const lineTotal = (item.unitPrice ?? 0) * Math.max(item.quantity ?? 0, 0)

                        return (
                          <div key={`${item.serviceId}-${index}`} className="room-booking-detail-row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <select
                              className="select"
                              value={item.serviceId}
                              onChange={(e) => {
                                const nextServiceId = Number(e.target.value)
                                const selectedService = bookingServiceOptions.find((service) => service.id === nextServiceId)
                                setServiceOrderForm((current) => ({
                                  ...current,
                                  items: current.items.map((currentItem, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...currentItem,
                                          serviceId: nextServiceId,
                                          vendorId: selectedService?.vendors.some((vendor) => vendor.id === currentItem.vendorId)
                                            ? currentItem.vendorId
                                            : undefined,
                                          unitPrice: currentItem.unitPrice ?? selectedService?.unitPrice ?? undefined,
                                        }
                                      : currentItem,
                                  ),
                                }))
                              }}
                              style={{ flex: 1, minWidth: 180 }}
                            >
                              <option value={0}>Select service</option>
                              {bookingServiceOptions.map((service) => (
                                <option key={service.id} value={service.id}>
                                  {service.name}{service.unitPrice ? ` - ${formatMoney(service.unitPrice ?? undefined, 'vi')}` : ''}
                                </option>
                              ))}
                            </select>
                            <select
                              className="select"
                              value={item.vendorId ?? 0}
                              onChange={(e) =>
                                setServiceOrderForm((current) => ({
                                  ...current,
                                  items: current.items.map((currentItem, itemIndex) =>
                                    itemIndex === index
                                      ? { ...currentItem, vendorId: Number(e.target.value) > 0 ? Number(e.target.value) : undefined }
                                      : currentItem,
                                  ),
                                }))
                              }
                              style={{ minWidth: 150 }}
                            >
                              <option value={0}>Vendor</option>
                              {vendorOptions.map((vendor) => (
                                <option key={vendor.id} value={vendor.id}>
                                  {vendor.name}
                                </option>
                              ))}
                            </select>
                            <input
                              className="input"
                              type="number"
                              min={0}
                              value={item.unitPrice ?? ''}
                              onChange={(e) =>
                                setServiceOrderForm((current) => ({
                                  ...current,
                                  items: current.items.map((currentItem, itemIndex) =>
                                    itemIndex === index
                                      ? { ...currentItem, unitPrice: e.target.value === '' ? undefined : Number(e.target.value) }
                                      : currentItem,
                                  ),
                                }))
                              }
                              placeholder="Guest price"
                              style={{ width: 120 }}
                            />
                            <input
                              className="input"
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) =>
                                setServiceOrderForm((current) => ({
                                  ...current,
                                  items: current.items.map((currentItem, itemIndex) =>
                                    itemIndex === index ? { ...currentItem, quantity: Number(e.target.value) } : currentItem,
                                  ),
                                }))
                              }
                              style={{ width: 96 }}
                            />
                            <input
                              className="input"
                              type="number"
                              min={0}
                              value={item.vendorCost ?? ''}
                              onChange={(e) =>
                                setServiceOrderForm((current) => ({
                                  ...current,
                                  items: current.items.map((currentItem, itemIndex) =>
                                    itemIndex === index
                                      ? { ...currentItem, vendorCost: e.target.value === '' ? undefined : Number(e.target.value) }
                                      : currentItem,
                                  ),
                                }))
                              }
                              placeholder="Vendor cost"
                              style={{ width: 120 }}
                            />
                            <div className="muted" style={{ minWidth: 120 }}>
                              {formatMoney(lineTotal, 'vi')}
                            </div>
                            <button
                              className="btn"
                              type="button"
                              onClick={() =>
                                setServiceOrderForm((current) => ({
                                  ...current,
                                  items: current.items.length > 1
                                    ? current.items.filter((_, itemIndex) => itemIndex !== index)
                                    : [{ serviceId: 0, quantity: 1, unitPrice: undefined, vendorId: undefined, vendorCost: undefined }],
                                }))
                              }
                            >
                              Remove
                            </button>
                          </div>
                        )
                      })}

                      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
                        <button
                          className="btn"
                          type="button"
                          onClick={() =>
                            setServiceOrderForm((current) => ({
                              ...current,
                              items: [...current.items, { serviceId: 0, quantity: 1, unitPrice: undefined, vendorId: undefined, vendorCost: undefined }],
                            }))
                          }
                        >
                          Add service
                        </button>
                        <div className="muted">Choose the exact day the guest needs this service.</div>
                      </div>
                    </div>

                    <div className="room-booking-details-grid" style={{ marginTop: 12 }}>
                      <div className="room-booking-detail-card">
                        <div className="room-booking-detail-label">Grand total</div>
                        <strong>{formatMoney(serviceOrderDraftGrandTotal, 'vi')}</strong>
                      </div>
                      <div className="room-booking-detail-card">
                        <div className="room-booking-detail-label">Deposit</div>
                        <strong>{formatMoney(serviceOrderForm.depositAmount, 'vi')}</strong>
                      </div>
                      <div className="room-booking-detail-card">
                        <div className="room-booking-detail-label">Remaining</div>
                        <strong>{formatMoney(serviceOrderDraftRemaining, 'vi')}</strong>
                      </div>
                      <div className="room-booking-detail-card">
                        <div className="room-booking-detail-label">Vendor cost</div>
                        <strong>{formatMoney(serviceOrderDraftVendorCost, 'vi')}</strong>
                      </div>
                    </div>

                    {serviceOrderError ? (
                      <div className="card error" style={{ marginTop: 12 }}>
                        <div className="error-title">Could not save services</div>
                        <div className="muted">{serviceOrderError}</div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {bookingModalMode && showConfirmInformation ? (
          <div
            className="room-booking-confirm-overlay"
            role="dialog"
            aria-modal="true"
            onClick={() => {
              setShowConfirmInformation(false)
              setIsConfirmationEditing(false)
            }}
          >
            <div className="room-booking-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="room-booking-confirm-actions">
                <button
                  className="btn"
                  type="button"
                  onClick={() => setIsConfirmationEditing((current) => !current)}
                >
                  {isConfirmationEditing ? 'Done' : 'Edit'}
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setShowConfirmInformation(false)
                    setIsConfirmationEditing(false)
                  }}
                >
                  Close
                </button>
              </div>

              <div className="room-booking-confirm-sheet">
                <div className="room-booking-confirm-brand">
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
                      {isConfirmationEditable ? (
                        <textarea
                          className="room-booking-confirm-side-textarea"
                          value={confirmationIncludedText}
                          onChange={(e) =>
                            setConfirmationTemplate((current) => ({ ...current, includedServices: e.target.value }))
                          }
                          rows={2}
                        />
                      ) : (
                        <div className="room-booking-confirm-side-text">{confirmationIncludedText}</div>
                      )}
                    </div>

                    <div className="room-booking-confirm-side-card">
                      <div className="room-booking-confirm-side-title">
                        Important notes
                      </div>
                      {isConfirmationEditable ? (
                        <textarea
                          className="room-booking-confirm-side-textarea"
                          value={confirmationImportantText}
                          onChange={(e) =>
                            setConfirmationTemplate((current) => ({ ...current, importantNotes: e.target.value }))
                          }
                          rows={3}
                        />
                      ) : (
                        <div className="room-booking-confirm-side-text">{confirmationImportantText}</div>
                      )}
                    </div>

                    <div className="room-booking-confirm-side-card">
                      <div className="room-booking-confirm-side-title">
                        Guest support via WhatsApp
                      </div>
                      {isConfirmationEditable ? (
                        <textarea
                          className="room-booking-confirm-side-textarea"
                          value={confirmationSupportText}
                          onChange={(e) =>
                            setConfirmationTemplate((current) => ({ ...current, guestSupport: e.target.value }))
                          }
                          rows={2}
                        />
                      ) : (
                        <div className="room-booking-confirm-side-text">{confirmationSupportText}</div>
                      )}
                    </div>

                    {isConfirmationEditable ? (
                      <div className="room-booking-confirm-side-card">
                        <div className="room-booking-confirm-side-title">
                          Additional notes
                        </div>
                        <textarea
                          className="room-booking-confirm-side-textarea"
                          value={confirmationAdditionalNotes}
                          onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                          rows={2}
                          placeholder="Add extra notes for this booking confirmation"
                        />
                      </div>
                    ) : confirmationAdditionalNotes ? (
                      <div className="room-booking-confirm-side-card">
                        <div className="room-booking-confirm-side-title">
                          Additional notes
                        </div>
                        <div className="room-booking-confirm-side-text">{confirmationAdditionalNotes}</div>
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
        </div>

        {villaCalendarRoom ? (
          <div
            className="room-booking-modal-overlay"
            role="dialog"
            aria-modal="true"
            onClick={() => setVillaCalendarRoomCode(null)}
          >
            <div className="room-booking-modal villa-month-calendar-modal" onClick={(e) => e.stopPropagation()}>
              <div className="villa-month-calendar-simple-head">
                <div className="villa-month-calendar-simple-title">{formatMonthYear(monthStart)}</div>
                <button
                  className="villa-month-calendar-close"
                  type="button"
                  onClick={() => setVillaCalendarRoomCode(null)}
                  aria-label="Close villa calendar"
                >
                  ›
                </button>
              </div>
              <div className="villa-month-calendar-simple-subtitle">
                {villaCalendarRoom.code} • {villaCalendarRoom.name || 'Villa'}
              </div>
              <div className="room-booking-modal-body villa-month-calendar-body villa-month-calendar-body-simple">
                <div className="villa-month-calendar-panel villa-month-calendar-panel-simple">
                  <div className="villa-month-calendar-weekdays villa-month-calendar-weekdays-simple">
                    {MONTH_CALENDAR_WEEKDAYS.map((weekday) => (
                      <div key={weekday} className="villa-month-calendar-weekday villa-month-calendar-weekday-simple">
                        {weekday}
                      </div>
                    ))}
                  </div>

                  <div className="villa-month-calendar-grid villa-month-calendar-grid-simple">
                    {villaCalendarGridCells.map((cell) => {
                      const activeBooking = cell.activeBooking
                      const title = activeBooking
                        ? `${STATUS_META[activeBooking.displayStatus].label} • ${activeBooking.guestName || 'Guest'} • ${formatDateOnly(activeBooking.checkInAt)} → ${formatDateOnly(activeBooking.checkOutAt)}`
                        : cell.inMonth
                          ? `${formatDateOnly(`${cell.dateKey}T00:00:00`)}`
                          : ''

                      return (
                        <div
                          key={cell.dateKey}
                          className={`villa-month-calendar-cell villa-month-calendar-cell-simple ${cell.inMonth ? '' : 'is-outside'} ${cell.isToday ? 'is-today' : ''} ${activeBooking ? 'is-booked' : ''}`}
                          title={title}
                        >
                          <span className="villa-month-calendar-cell-day">{cell.inMonth ? formatDayNumber(cell.date) : ''}</span>
                        </div>
                      )
                    })}
                  </div>
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
                    {renderOperationalStatusBadge(normalizeRoomOperationalStatus(repairInsightRoom.operationalStatus))}
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
                    {renderOperationalStatusBadge(normalizeRoomOperationalStatus(ooiInsightRoom.operationalStatus))}
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
