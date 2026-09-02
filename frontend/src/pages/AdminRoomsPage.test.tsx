import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import AdminRoomsPage from './AdminRoomsPage'
import type { Room, RoomArea, VillaSettingsResponse } from '../types'
import { apiFetch } from '../lib/api'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    apiFetch: vi.fn(),
  }
})

const mockedApiFetch = vi.mocked(apiFetch)

const baseAreas: RoomArea[] = [
  { id: 1, code: 'PREMIER', name: 'Premier', sortOrder: 1, active: true },
]

const baseRooms: Room[] = [
  {
    id: 1,
    code: 'V107',
    areaId: 1,
    areaCode: 'PREMIER',
    areaName: 'Premier',
    name: 'Villa V107',
    host: 'Host A',
    type: '4BR',
    airbnbUrl: '',
    floorNumber: 107,
    maxAdults: 8,
    maxChildren: 4,
    active: true,
    bedroomLayout: '4BR',
    location: 'Beach Front',
    wifiName: '',
    wifiPassword: '',
    doorPassword: '',
    notes: '',
    repairNeeded: false,
  },
]

function createSettingsResponse(overrides?: Partial<VillaSettingsResponse>): VillaSettingsResponse {
  return {
    roomTypes: [
      { id: 11, category: 'ROOM_TYPE', label: '4BR', sortOrder: 1, active: true },
      { id: 12, category: 'ROOM_TYPE', label: '5BR', sortOrder: 2, active: true },
    ],
    hosts: [
      { id: 21, category: 'HOST', label: 'Host A', sortOrder: 1, active: true },
      { id: 22, category: 'HOST', label: 'Host B', sortOrder: 2, active: true },
    ],
    bookingSources: [
      { id: 31, category: 'BOOKING_SOURCE', label: 'Direct', sortOrder: 1, active: true },
      { id: 32, category: 'BOOKING_SOURCE', label: 'Airbnb', sortOrder: 2, active: true },
    ],
    ...overrides,
  }
}

function setupStatefulApi(settingsState: { current: VillaSettingsResponse }) {
  mockedApiFetch.mockImplementation(async (endpoint: string, options?: RequestInit) => {
    if (endpoint === '/api/admin/rooms' && !options?.method) return baseRooms
    if (endpoint === '/api/admin/room-areas' && !options?.method) return baseAreas
    if (endpoint === '/api/admin/villa-settings' && !options?.method) return settingsState.current
    if (endpoint === '/api/admin/rooms/1' && options?.method === 'PUT') {
      return {
        ...baseRooms[0],
        ...JSON.parse(String(options.body)),
      }
    }
    throw new Error(`Unexpected request: ${options?.method || 'GET'} ${endpoint}`)
  })
}

describe('AdminRoomsPage', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset()
  })

  it('shows villa settings entrypoint and dropdown options in edit form', async () => {
    const settingsState = { current: createSettingsResponse() }
    setupStatefulApi(settingsState)

    render(
      <MemoryRouter>
        <AdminRoomsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('link', { name: 'Villa settings' })).toBeInTheDocument()

    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0])

    const typeSelect = screen.getByLabelText('Villa type') as HTMLSelectElement
    const hostSelect = screen.getByLabelText('Host') as HTMLSelectElement

    expect(within(typeSelect).getByRole('option', { name: '4BR' })).toBeInTheDocument()
    expect(within(typeSelect).getByRole('option', { name: '5BR' })).toBeInTheDocument()
    expect(within(hostSelect).getByRole('option', { name: 'Host A' })).toBeInTheDocument()
    expect(within(hostSelect).getByRole('option', { name: 'Host B' })).toBeInTheDocument()
  })

  it('saves selected host and room type from dropdowns', async () => {
    const settingsState = { current: createSettingsResponse() }
    setupStatefulApi(settingsState)

    render(
      <MemoryRouter>
        <AdminRoomsPage />
      </MemoryRouter>,
    )

    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0])

    await userEvent.selectOptions(screen.getByLabelText('Villa type'), '5BR')
    await userEvent.selectOptions(screen.getByLabelText('Host'), 'Host B')
    await userEvent.click(screen.getByRole('button', { name: 'Update villa' }))

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith(
        '/api/admin/rooms/1',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"type":"5BR"'),
        }),
      )
    })

    const updateCall = mockedApiFetch.mock.calls.find(
      ([endpoint, options]) => endpoint === '/api/admin/rooms/1' && options?.method === 'PUT',
    )
    expect(updateCall).toBeTruthy()
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
      type: '5BR',
      host: 'Host B',
    })
  })

  it('refreshes dropdown options after villa settings change', async () => {
    const settingsState = { current: createSettingsResponse() }
    setupStatefulApi(settingsState)

    render(
      <MemoryRouter>
        <AdminRoomsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Villa list')).toBeInTheDocument()

    settingsState.current = createSettingsResponse({
      roomTypes: [
        { id: 11, category: 'ROOM_TYPE', label: '4BR', sortOrder: 1, active: true },
        { id: 13, category: 'ROOM_TYPE', label: '6BR', sortOrder: 3, active: true },
      ],
      hosts: [
        { id: 21, category: 'HOST', label: 'Host A', sortOrder: 1, active: true },
        { id: 23, category: 'HOST', label: 'Host C', sortOrder: 3, active: true },
      ],
    })

    window.dispatchEvent(new Event('focus'))
    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith('/api/admin/villa-settings')
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Add villa' }))

    const typeSelect = screen.getByLabelText('Villa type')
    const hostSelect = screen.getByLabelText('Host')

    expect(Array.from((typeSelect as HTMLSelectElement).options).map((option) => option.text)).toEqual(['4BR', '6BR'])
    expect(Array.from((hostSelect as HTMLSelectElement).options).map((option) => option.text)).toEqual(['Host A', 'Host C'])
    expect(within(typeSelect).getByRole('option', { name: '6BR' })).toBeInTheDocument()
    expect(within(hostSelect).getByRole('option', { name: 'Host C' })).toBeInTheDocument()
  })
})
