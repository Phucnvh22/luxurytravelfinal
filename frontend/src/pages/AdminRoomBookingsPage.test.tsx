import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminRoomBookingsPage from './AdminRoomBookingsPage'
import type { Room, RoomArea, RoomBookingResponse, VillaSettingsResponse, VillaServiceCatalog } from '../types'
import { apiFetch } from '../lib/api'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    apiFetch: vi.fn(),
  }
})

const mockedApiFetch = vi.mocked(apiFetch)

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
})

Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
  value: vi.fn(),
  writable: true,
})

const baseRooms: Room[] = [
  {
    id: 1,
    code: 'V327',
    areaId: 1,
    areaCode: 'PREMIER',
    areaName: 'Premier',
    name: 'Villa V327',
    host: 'Host A',
    type: 'Garden View Villa',
    airbnbUrl: '',
    floorNumber: 327,
    maxAdults: 8,
    maxChildren: 4,
    active: true,
    bedroomLayout: '4BR',
    location: 'Da Nang',
    wifiName: '',
    wifiPassword: '',
    doorPassword: '',
    notes: '',
    operationalStatus: 'READY',
    repairNeeded: false,
  },
]

const baseAreas: RoomArea[] = [
  { id: 1, code: 'PREMIER', name: 'Premier', sortOrder: 1, active: true },
]

const baseSettings: VillaSettingsResponse = {
  roomTypes: [{ id: 1, category: 'ROOM_TYPE', label: 'Garden View Villa', sortOrder: 1, active: true }],
  bedroomLayouts: [{ id: 2, category: 'BEDROOM_LAYOUT', label: '1 DBL + 3 TWN', sortOrder: 1, active: true }],
  hosts: [{ id: 2, category: 'HOST', label: 'Host A', sortOrder: 1, active: true }],
  bookingSources: [{ id: 3, category: 'BOOKING_SOURCE', label: 'Direct', sortOrder: 1, active: true }],
  supportLinks: [],
}

const baseServices: VillaServiceCatalog[] = []

const baseBookings: RoomBookingResponse[] = [
  {
    id: 1,
    bookingCode: 'BK-S000001',
    createdByUsername: 'system',
    roomCode: 'V327',
    guestName: 'Phuc',
    source: 'Direct',
    phone: '0900000000',
    adults: 2,
    children: 0,
    checkInAt: '2026-09-05T15:00:00',
    checkOutAt: '2026-09-07T11:00:00',
    status: 'CONFIRMED',
    villaRate: 10000000,
    depositAmount: 5000000,
    remainingAmount: 5000000,
    notes: '',
    createdAt: '2026-09-01T00:00:00',
    updatedAt: '2026-09-01T00:00:00',
  },
]

function setupApi() {
  mockedApiFetch.mockImplementation(async (endpoint: string) => {
    if (endpoint.startsWith('/api/admin/room-bookings?')) return baseBookings
    if (endpoint === '/api/admin/rooms') return baseRooms
    if (endpoint === '/api/admin/room-areas') return baseAreas
    if (endpoint === '/api/admin/villa-settings') return baseSettings
    if (endpoint === '/api/admin/villa-services') return baseServices
    throw new Error(`Unexpected request: ${endpoint}`)
  })
}

describe('AdminRoomBookingsPage date range', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset()
    setupApi()
  })

  it('shows an error when end date is earlier than start date', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <AdminRoomBookingsPage />
      </MemoryRouter>,
    )

    await screen.findByText('Admin • Villa booking calendar')

    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-09-10' } })
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-09-05' } })
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ngày kết thúc không được nhỏ hơn ngày bắt đầu.')
  })

  it('reloads bookings with the selected valid date range', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <AdminRoomBookingsPage />
      </MemoryRouter>,
    )

    await screen.findByText('Admin • Villa booking calendar')

    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-09-10' } })
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-09-14' } })
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }))

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith('/api/admin/room-bookings?from=2026-09-10&to=2026-09-14')
    })
  })
})
