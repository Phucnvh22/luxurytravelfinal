import type { Room, RoomBookingResponse } from '../types'

export type GroupedScheduleRow =
  | { type: 'location'; location: string; count: number }
  | { type: 'villa'; roomCode: string; location: string }

export type QuickBookingSelection = {
  roomCode: string
  dates: string[]
}

const DAY_DURATION_MS = 24 * 60 * 60 * 1000

function normalizeLocation(location?: string) {
  return location?.trim() || 'Unassigned location'
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

export function compareRoomsByLocation(a?: Room, b?: Room, fallbackA = '', fallbackB = '') {
  if (a && b) {
    return (
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

export function buildGroupedScheduleRows(roomCodes: string[], roomByCode: Record<string, Room | undefined>) {
  const groups: GroupedScheduleRow[] = []
  const locationCounts = roomCodes.reduce<Record<string, number>>((acc, roomCode) => {
    const location = normalizeLocation(roomByCode[roomCode]?.location)
    acc[location] = (acc[location] ?? 0) + 1
    return acc
  }, {})

  let currentLocation = ''
  roomCodes.forEach((roomCode) => {
    const location = normalizeLocation(roomByCode[roomCode]?.location)
    if (location !== currentLocation) {
      currentLocation = location
      groups.push({ type: 'location', location, count: locationCounts[location] ?? 0 })
    }
    groups.push({ type: 'villa', roomCode, location })
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
