import type { Room, RoomBookingResponse } from '../types'

export type VillaTierKey =
  | 'garden-view-villa'
  | 'garden-view-deluxe-villa'
  | 'beach-access-villa'
  | 'beach-access-deluxe-villa'
  | 'beach-front-luxury-villa'
  | 'other'

export type VillaTierDefinition = {
  key: VillaTierKey
  label: string
  shortLabel: string
  emoji: string
  toneClass: string
  roomCodes: string[]
}

export type GroupedScheduleRow =
  | { type: 'area'; areaKey: string; label: string }
  | { type: 'villa-tier'; tierKey: VillaTierKey; label: string; count: number; toneClass: string; emoji: string }
  | { type: 'villa'; roomCode: string; tierKey: VillaTierKey }

export type QuickBookingSelection = {
  roomCode: string
  dates: string[]
}

export type BookingDateRange = {
  from: string
  to: string
}

export type DateRangePreset = 'custom' | 'day' | '7days' | '14days' | 'month'

const DAY_DURATION_MS = 24 * 60 * 60 * 1000
const FALLBACK_TIER: VillaTierDefinition = {
  key: 'other',
  label: 'Khac',
  shortLabel: 'Khac',
  emoji: '•',
  toneClass: 'other',
  roomCodes: [],
}

export const VILLA_TIER_DEFINITIONS: VillaTierDefinition[] = [
  {
    key: 'garden-view-villa',
    label: 'Garden View-Villa',
    shortLabel: 'Garden View',
    emoji: '🟢',
    toneClass: 'garden-view-villa',
    roomCodes: ['V327', 'V331', 'V332', 'V333', 'V336', 'V338', 'V340'],
  },
  {
    key: 'garden-view-deluxe-villa',
    label: 'Garden View-Deluxe Villa',
    shortLabel: 'Garden Deluxe',
    emoji: '🔷',
    toneClass: 'garden-view-deluxe-villa',
    roomCodes: ['V303', 'V308', 'V309', 'V312', 'V317', 'V318', 'V319', 'V321', 'V323', 'V324', 'V346', 'V355', 'V360', 'V365', 'V366'],
  },
  {
    key: 'beach-access-villa',
    label: 'Beach Access-Villa',
    shortLabel: 'Beach Access',
    emoji: '📙',
    toneClass: 'beach-access-villa',
    roomCodes: ['V208', 'V217', 'V225', 'V361'],
  },
  {
    key: 'beach-access-deluxe-villa',
    label: 'Beach Access-Deluxe Villa',
    shortLabel: 'Beach Deluxe',
    emoji: '🔮',
    toneClass: 'beach-access-deluxe-villa',
    roomCodes: ['V203', 'V209', 'V210', 'V227'],
  },
  {
    key: 'beach-front-luxury-villa',
    label: 'Beach Front-Luxury Villa',
    shortLabel: 'Beach Front',
    emoji: '🟡',
    toneClass: 'beach-front-luxury-villa',
    roomCodes: ['V107'],
  },
]

const TIER_BY_ROOM_CODE = VILLA_TIER_DEFINITIONS.reduce<Record<string, VillaTierDefinition>>((acc, tier) => {
  tier.roomCodes.forEach((roomCode) => {
    acc[roomCode] = tier
  })
  return acc
}, {})

const ROOM_ORDER_BY_CODE = VILLA_TIER_DEFINITIONS.reduce<Record<string, number>>((acc, tier) => {
  tier.roomCodes.forEach((roomCode, index) => {
    acc[roomCode] = index
  })
  return acc
}, {})

function normalizeLocation(location?: string) {
  return location?.trim() || 'Unassigned location'
}

function normalizeAreaName(areaName?: string) {
  return areaName?.trim() || 'Premier'
}

function normalizeAreaKey(room?: Room) {
  return room?.areaCode?.trim() || normalizeAreaName(room?.areaName).toUpperCase()
}

function normalizeRoomCode(roomCode?: string) {
  return roomCode?.trim().toUpperCase() || ''
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

  if (preset === 'day') {
    const dateKey = toDateKey(anchor)
    return { from: dateKey, to: dateKey }
  }

  const spanDays = preset === '7days' ? 6 : 13
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
    preset === 'day'
      ? 1
      : preset === '7days'
        ? 7
        : preset === '14days'
          ? 14
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

export function getVillaTierDefinition(roomCode?: string): VillaTierDefinition {
  return TIER_BY_ROOM_CODE[normalizeRoomCode(roomCode)] ?? FALLBACK_TIER
}

export function sortRoomCodesByVillaTier(roomCodes: string[], roomByCode: Record<string, Room | undefined>) {
  return [...roomCodes].sort((a, b) => {
    const tierA = getVillaTierDefinition(a)
    const tierB = getVillaTierDefinition(b)
    const tierIndexA = VILLA_TIER_DEFINITIONS.findIndex((tier) => tier.key === tierA.key)
    const tierIndexB = VILLA_TIER_DEFINITIONS.findIndex((tier) => tier.key === tierB.key)

    if (tierIndexA !== tierIndexB) {
      const safeIndexA = tierIndexA === -1 ? Number.MAX_SAFE_INTEGER : tierIndexA
      const safeIndexB = tierIndexB === -1 ? Number.MAX_SAFE_INTEGER : tierIndexB
      return safeIndexA - safeIndexB
    }

    const codeA = normalizeRoomCode(a)
    const codeB = normalizeRoomCode(b)
    const orderA = ROOM_ORDER_BY_CODE[codeA]
    const orderB = ROOM_ORDER_BY_CODE[codeB]
    if (orderA !== undefined || orderB !== undefined) {
      if (orderA === undefined) return 1
      if (orderB === undefined) return -1
      if (orderA !== orderB) return orderA - orderB
    }

    return compareRoomsByLocation(roomByCode[a], roomByCode[b], a, b)
  })
}

export function buildGroupedScheduleRows(roomCodes: string[], roomByCode: Record<string, Room | undefined>) {
  const orderedRoomCodes = sortRoomCodesByVillaTier(roomCodes, roomByCode)
  const groups: GroupedScheduleRow[] = []
  const tierCounts = orderedRoomCodes.reduce<Record<VillaTierKey, number>>((acc, roomCode) => {
    const tier = getVillaTierDefinition(roomCode)
    acc[tier.key] = (acc[tier.key] ?? 0) + 1
    return acc
  }, {
    'garden-view-villa': 0,
    'garden-view-deluxe-villa': 0,
    'beach-access-villa': 0,
    'beach-access-deluxe-villa': 0,
    'beach-front-luxury-villa': 0,
    other: 0,
  })

  let currentAreaKey = ''
  let currentTierKey = '' as VillaTierKey | ''
  orderedRoomCodes.forEach((roomCode) => {
    const room = roomByCode[roomCode]
    const areaKey = normalizeAreaKey(room)
    if (areaKey !== currentAreaKey) {
      currentAreaKey = areaKey
      currentTierKey = '' as VillaTierKey | ''
      groups.push({
        type: 'area',
        areaKey,
        label: normalizeAreaName(room?.areaName),
      })
    }

    const tier = getVillaTierDefinition(roomCode)
    if (tier.key !== currentTierKey) {
      currentTierKey = tier.key
      groups.push({
        type: 'villa-tier',
        tierKey: tier.key,
        label: tier.label,
        count: tierCounts[tier.key] ?? 0,
        toneClass: tier.toneClass,
        emoji: tier.emoji,
      })
    }
    groups.push({ type: 'villa', roomCode, tierKey: tier.key })
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
