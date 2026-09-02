import { describe, expect, it } from 'vitest'
import type { Room, RoomBookingResponse } from '../types'
import {
  buildGroupedScheduleRows,
  buildQuickBookingDateRange,
  compareRoomsByLocation,
  getBookedDateKeysForRoom,
  toggleQuickBookingDate,
  validateQuickBookingSelection,
} from './AdminRoomBookingsPage.utils'

function createRoom(overrides: Partial<Room>): Room {
  return {
    id: 1,
    code: 'V101',
    name: 'Villa V101',
    host: '',
    type: '4BR',
    floorNumber: 101,
    maxAdults: 8,
    maxChildren: 0,
    active: true,
    bedroomLayout: '',
    location: '',
    wifiName: '',
    wifiPassword: '',
    doorPassword: '',
    notes: '',
    airbnbUrl: '',
    operationalStatus: 'READY',
    ...overrides,
  }
}

function createBooking(overrides: Partial<RoomBookingResponse>): RoomBookingResponse {
  return {
    id: 1,
    roomCode: 'V101',
    guestName: 'Test Guest',
    source: 'Direct',
    phone: '',
    adults: 2,
    children: 0,
    checkInAt: '2026-08-10T15:00:00',
    checkOutAt: '2026-08-12T11:00:00',
    status: 'CONFIRMED',
    notes: '',
    createdAt: '2026-08-01T00:00:00',
    updatedAt: '2026-08-01T00:00:00',
    ...overrides,
  }
}

describe('AdminRoomBookingsPage utils', () => {
  it('sorts rooms by location before code', () => {
    const alpha = createRoom({ code: 'V201', location: 'Beach Front', floorNumber: 201 })
    const beta = createRoom({ code: 'V101', location: 'City Center', floorNumber: 101 })

    expect(compareRoomsByLocation(alpha, beta)).toBeLessThan(0)
    expect(compareRoomsByLocation(beta, alpha)).toBeGreaterThan(0)
  })

  it('groups schedule rows by area and villa tier', () => {
    const roomByCode = {
      V107: createRoom({ code: 'V107', areaCode: 'PREMIER', areaName: 'Premier', location: 'Beach Front', floorNumber: 107 }),
      V208: createRoom({ code: 'V208', areaCode: 'PREMIER', areaName: 'Premier', location: 'Beach Access', floorNumber: 208 }),
      V331: createRoom({ code: 'V331', areaCode: 'OCEAN', areaName: 'Ocean', location: 'Garden', floorNumber: 331 }),
    }

    expect(buildGroupedScheduleRows(['V107', 'V208', 'V331'], roomByCode)).toEqual([
      { type: 'area', areaKey: 'OCEAN', label: 'Ocean' },
      { type: 'villa-tier', tierKey: 'garden-view-villa', label: 'Garden View-Villa', count: 1, toneClass: 'garden-view-villa', emoji: '🟢' },
      { type: 'villa', roomCode: 'V331', tierKey: 'garden-view-villa' },
      { type: 'area', areaKey: 'PREMIER', label: 'Premier' },
      { type: 'villa-tier', tierKey: 'beach-access-villa', label: 'Beach Access-Villa', count: 1, toneClass: 'beach-access-villa', emoji: '📙' },
      { type: 'villa', roomCode: 'V208', tierKey: 'beach-access-villa' },
      { type: 'villa-tier', tierKey: 'beach-front-luxury-villa', label: 'Beach Front-Luxury Villa', count: 1, toneClass: 'beach-front-luxury-villa', emoji: '🟡' },
      { type: 'villa', roomCode: 'V107', tierKey: 'beach-front-luxury-villa' },
    ])
  })

  it('builds disabled day keys from existing bookings', () => {
    const bookedDates = getBookedDateKeysForRoom(
      [
        createBooking({
          roomCode: 'V101',
          checkInAt: '2026-08-10T15:00:00',
          checkOutAt: '2026-08-13T11:00:00',
        }),
      ],
      'V101',
    )

    expect([...bookedDates]).toEqual(['2026-08-10', '2026-08-11', '2026-08-12'])
  })

  it('builds the full date range from the first and last selected days', () => {
    const disabledDates = new Set<string>()
    const first = toggleQuickBookingDate(null, 'V101', '2026-08-14', disabledDates)
    const second = toggleQuickBookingDate(first, 'V101', '2026-08-18', disabledDates)
    const reset = toggleQuickBookingDate(second, 'V101', '2026-08-20', disabledDates)

    expect(first).toEqual({ roomCode: 'V101', dates: ['2026-08-14'] })
    expect(second).toEqual({
      roomCode: 'V101',
      dates: ['2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18'],
    })
    expect(reset).toEqual({ roomCode: 'V101', dates: ['2026-08-20'] })
  })

  it('resets the anchor if the chosen range crosses booked dates', () => {
    const disabledDates = new Set<string>(['2026-08-16'])
    const first = toggleQuickBookingDate(null, 'V101', '2026-08-14', disabledDates)
    const blockedRange = toggleQuickBookingDate(first, 'V101', '2026-08-18', disabledDates)

    expect(blockedRange).toEqual({ roomCode: 'V101', dates: ['2026-08-18'] })
  })

  it('validates selected dates are consecutive', () => {
    expect(
      validateQuickBookingSelection({
        roomCode: 'V101',
        dates: ['2026-08-14', '2026-08-16'],
      }),
    ).toBe('Selected dates must be consecutive.')
  })

  it('creates a booking range from selected days', () => {
    expect(
      buildQuickBookingDateRange(
        {
          roomCode: 'V101',
          dates: ['2026-08-14', '2026-08-15', '2026-08-16'],
        },
        15,
        11,
      ),
    ).toEqual({
      checkInAt: '2026-08-14T15:00',
      checkOutAt: '2026-08-17T11:00',
    })
  })
})
