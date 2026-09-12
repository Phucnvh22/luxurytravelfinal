import type { Room, RoomBookingResponse } from '../types'

export type GroupedScheduleRow =
  | { type: 'area'; areaKey: string; label: string }
  | { type: 'villa-type'; typeKey: string; label: string; count: number }
  | { type: 'villa'; roomCode: string; typeKey: string }

export type QuickBookingSelection = {
  roomCode: string
  dates: string[]
}

export type BookingDateRange = {
  from: string
  to: string
}

export type DateRangePreset = 'custom' | '7days' | '14days' | '30days' | 'month'

const DAY_DURATION_MS = 24 * 60 * 60 * 1000

function normalizeLocation(location?: string) {
  return location?.trim() || 'Unassigned location'
}

export function normalizeVillaTypeLabel(roomType?: string) {
  const trimmed = roomType?.trim() ?? ''
  if (!trimmed) return 'Unassigned type'
  return trimmed
    .replace(/_/g, '-')
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeVillaTypeKey(roomType?: string) {
  return normalizeVillaTypeLabel(roomType)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
}

const VILLA_TYPE_DISPLAY_ORDER = [
  'Garden View_Superior',
  'Garden View_Deluxe',
  'Beach Access_Standard',
  'Beach Access_Superior',
  'Beach Access_Deluxe',
  'Beach Front_Deluxe',
]
const VILLA_TYPE_ORDER_INDEX = new Map<string, number>(
  VILLA_TYPE_DISPLAY_ORDER.map((label, index) => [normalizeVillaTypeKey(label), index] as const),
)

export function getVillaTypeSortIndex(roomType?: string) {
  const key = normalizeVillaTypeKey(roomType)
  const index = VILLA_TYPE_ORDER_INDEX.get(key)
  return index === undefined ? Number.MAX_SAFE_INTEGER : index
}

function normalizeAreaName(areaName?: string) {
  return areaName?.trim() || 'Premier'
}

function normalizeAreaKey(room?: Room) {
  return room?.areaCode?.trim() || normalizeAreaName(room?.areaName).toUpperCase()
}

function parseDateKey(dateKey: string) {
  const parsed = new Date(`${dateKey}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toDateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfDay(value: Date) {
  const next = new Date(value)
  next.setHours(0, 0, 0, 0)
  return next
}

function startOfMonth(value: Date) {
  const next = startOfDay(value)
  next.setDate(1)
  return next
}

function endOfMonth(value: Date) {
  const next = startOfMonth(value)
  next.setMonth(next.getMonth() + 1)
  next.setDate(0)
  return next
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function addMonths(value: Date, months: number) {
  const next = startOfMonth(value)
  next.setMonth(next.getMonth() + months)
  return next
}

function sortDateKeys(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

function buildDateKeysBetween(startKey: string, endKey: string) {
  const start = parseDateKey(startKey)
  const end = parseDateKey(endKey)
  if (!start || !end) return []

  const [from, to] = start.getTime() <= end.getTime() ? [start, end] : [end, start]
  const values: string[] = []

  for (let cursor = new Date(from); cursor.getTime() <= to.getTime(); cursor = new Date(cursor.getTime() + DAY_DURATION_MS)) {
    values.push(toDateKey(cursor))
  }

  return values
}

export function buildDateRangeFromPreset(preset: Exclude<DateRangePreset, 'custom'>, baseDate = new Date()): BookingDateRange {
  const anchor = startOfDay(baseDate)

  if (preset === 'month') {
    return {
      from: toDateKey(startOfMonth(anchor)),
      to: toDateKey(endOfMonth(anchor)),
    }
  }

  const spanDays = preset === '7days'
    ? 6
    : preset === '14days'
      ? 13
      : 29
  return {
    from: toDateKey(anchor),
    to: toDateKey(addDays(anchor, spanDays)),
  }
}

export function validateBookingDateRange(range: BookingDateRange) {
  if (!range.from || !range.to) {
    return null
  }

  const from = parseDateKey(range.from)
  const to = parseDateKey(range.to)
  if (!from || !to) {
    return 'Khoảng ngày không hợp lệ.'
  }
  if (to.getTime() < from.getTime()) {
    return 'Ngày kết thúc không được nhỏ hơn ngày bắt đầu.'
  }
  return null
}

export function shiftBookingDateRange(range: BookingDateRange, preset: DateRangePreset, direction: -1 | 1) {
  const from = parseDateKey(range.from)
  const to = parseDateKey(range.to)
  if (!from || !to) {
    return range
  }

  if (preset === 'month') {
    const nextMonth = addMonths(from, direction)
    return {
      from: toDateKey(startOfMonth(nextMonth)),
      to: toDateKey(endOfMonth(nextMonth)),
    }
  }

  const inclusiveSpanDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_DURATION_MS) + 1)
  const stepDays =
    preset === '7days'
      ? 7
      : preset === '14days'
        ? 14
        : preset === '30days'
          ? 30
          : inclusiveSpanDays

  const nextFrom = addDays(from, stepDays * direction)
  const nextTo = addDays(to, stepDays * direction)
  return {
    from: toDateKey(nextFrom),
    to: toDateKey(nextTo),
  }
}

export function formatBookingDateRange(range: BookingDateRange, locale = 'vi-VN') {
  const from = parseDateKey(range.from)
  const to = parseDateKey(range.to)
  if (!from || !to) {
    return 'Chưa chọn khoảng ngày'
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const fromText = formatter.format(from)
  const toText = formatter.format(to)
  return fromText === toText ? fromText : `${fromText} → ${toText}`
}

export function compareRoomsByLocation(a?: Room, b?: Room, fallbackA = '', fallbackB = '') {
  if (a && b) {
    return (
      normalizeAreaName(a.areaName).localeCompare(normalizeAreaName(b.areaName), 'vi-VN', { sensitivity: 'base' }) ||
      normalizeLocation(a.location).localeCompare(normalizeLocation(b.location), 'vi-VN', { sensitivity: 'base' }) ||
      a.floorNumber - b.floorNumber ||
      a.code.localeCompare(b.code, 'vi-VN', { numeric: true })
    )
  }
  if (a && fallbackA) return -1
  if (b && fallbackB) return 1
  return fallbackA.localeCompare(fallbackB, 'vi-VN', { numeric: true })
}

export function sortRoomCodesByLocation(roomCodes: string[], roomByCode: Record<string, Room | undefined>) {
  return [...roomCodes].sort((a, b) => compareRoomsByLocation(roomByCode[a], roomByCode[b], a, b))
}

export function compareRoomsByVillaType(a?: Room, b?: Room, fallbackA = '', fallbackB = '') {
  if (a && b) {
    return (
      normalizeAreaName(a.areaName).localeCompare(normalizeAreaName(b.areaName), 'vi-VN', { sensitivity: 'base' }) ||
      getVillaTypeSortIndex(a.type) - getVillaTypeSortIndex(b.type) ||
      normalizeVillaTypeLabel(a.type).localeCompare(normalizeVillaTypeLabel(b.type), 'vi-VN', { sensitivity: 'base' }) ||
      normalizeLocation(a.location).localeCompare(normalizeLocation(b.location), 'vi-VN', { sensitivity: 'base' }) ||
      a.floorNumber - b.floorNumber ||
      a.code.localeCompare(b.code, 'vi-VN', { numeric: true })
    )
  }
  if (a && fallbackA) return -1
  if (b && fallbackB) return 1
  return fallbackA.localeCompare(fallbackB, 'vi-VN', { numeric: true })
}

export function sortRoomCodesByVillaType(roomCodes: string[], roomByCode: Record<string, Room | undefined>) {
  return [...roomCodes].sort((a, b) => {
    return compareRoomsByVillaType(roomByCode[a], roomByCode[b], a, b)
  })
}

export function buildGroupedScheduleRows(roomCodes: string[], roomByCode: Record<string, Room | undefined>) {
  const orderedRoomCodes = sortRoomCodesByVillaType(roomCodes, roomByCode)
  const groups: GroupedScheduleRow[] = []
  const typeCounts = orderedRoomCodes.reduce<Record<string, number>>((acc, roomCode) => {
    const room = roomByCode[roomCode]
    const typeKey = normalizeVillaTypeKey(room?.type)
    acc[typeKey] = (acc[typeKey] ?? 0) + 1
    return acc
  }, {})

  let currentAreaKey = ''
  let currentTypeKey = ''
  orderedRoomCodes.forEach((roomCode) => {
    const room = roomByCode[roomCode]
    const areaKey = normalizeAreaKey(room)
    if (areaKey !== currentAreaKey) {
      currentAreaKey = areaKey
      currentTypeKey = ''
      groups.push({
        type: 'area',
        areaKey,
        label: normalizeAreaName(room?.areaName),
      })
    }

    const typeLabel = normalizeVillaTypeLabel(room?.type)
    const typeKey = normalizeVillaTypeKey(room?.type)
    if (typeKey !== currentTypeKey) {
      currentTypeKey = typeKey
      groups.push({
        type: 'villa-type',
        typeKey,
        label: typeLabel,
        count: typeCounts[typeKey] ?? 0,
      })
    }
    groups.push({ type: 'villa', roomCode, typeKey })
  })

  return groups
}

export function getBookedDateKeysForRoom(bookings: RoomBookingResponse[], roomCode: string) {
  const bookedDates = new Set<string>()

  bookings.forEach((booking) => {
    if (booking.roomCode !== roomCode || booking.status === 'CANCELLED') return

    const start = parseDateKey(booking.checkInAt.slice(0, 10))
    const end = parseDateKey(booking.checkOutAt.slice(0, 10))
    if (!start || !end) return

    const exclusiveEnd = end.getTime() > start.getTime() ? end : new Date(start.getTime() + DAY_DURATION_MS)
    for (let cursor = new Date(start); cursor.getTime() < exclusiveEnd.getTime(); cursor = new Date(cursor.getTime() + DAY_DURATION_MS)) {
      bookedDates.add(toDateKey(cursor))
    }
  })

  return bookedDates
}

export function toggleQuickBookingDate(
  current: QuickBookingSelection | null,
  roomCode: string,
  dateKey: string,
  disabledDateKeys: Set<string>,
) {
  if (disabledDateKeys.has(dateKey)) {
    return current
  }

  if (!current || current.roomCode !== roomCode) {
    return { roomCode, dates: [dateKey] }
  }

  const dates = sortDateKeys(current.dates)
  const anchorDate = dates[0]

  if (dates.length === 1 && anchorDate === dateKey) {
    return null
  }

  if (dates.length > 1) {
    return { roomCode, dates: [dateKey] }
  }

  if (dateKey < anchorDate) {
    return current
  }

  const nextRange = buildDateKeysBetween(anchorDate, dateKey)
  if (nextRange.length === 0) {
    return { roomCode, dates: [dateKey] }
  }

  const hasDisabledDateInsideRange = nextRange.some((key) => disabledDateKeys.has(key))
  if (hasDisabledDateInsideRange) {
    return { roomCode, dates: [dateKey] }
  }

  return { roomCode, dates: nextRange }
}

export function validateQuickBookingSelection(selection: QuickBookingSelection | null) {
  if (!selection?.roomCode) {
    return 'Please choose one villa before creating a booking.'
  }

  const dates = sortDateKeys(selection.dates)
  if (dates.length === 0) {
    return 'Please choose at least one available date.'
  }

  for (let index = 1; index < dates.length; index += 1) {
    const previous = parseDateKey(dates[index - 1])
    const current = parseDateKey(dates[index])
    if (!previous || !current) {
      return 'One or more selected dates are invalid.'
    }
    if (current.getTime() - previous.getTime() !== DAY_DURATION_MS) {
      return 'Selected dates must be consecutive.'
    }
  }

  return null
}

export function buildQuickBookingDateRange(
  selection: QuickBookingSelection,
  checkInHour: number,
  checkOutHour: number,
) {
  const dates = sortDateKeys(selection.dates)
  const firstDate = dates[0]
  const lastDate = dates[dates.length - 1]
  const last = parseDateKey(lastDate)
  if (!firstDate || !lastDate || !last) return null

  const checkOutDate = new Date(last.getTime() + DAY_DURATION_MS)
  const checkInAt = `${firstDate}T${String(checkInHour).padStart(2, '0')}:00`
  const checkOutAt = `${toDateKey(checkOutDate)}T${String(checkOutHour).padStart(2, '0')}:00`

  return { checkInAt, checkOutAt }
}
