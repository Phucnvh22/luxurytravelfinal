import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { Room, RoomArea, RoomUpsertRequest, VillaSettingOption, VillaSettingsResponse } from '../types'
import './pages.css'
import './admin-rooms.css'

function deriveSortOrderFromCode(code: string) {
  const numeric = Number(code.replace(/\D/g, ''))
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1
}

const INITIAL_FORM: RoomUpsertRequest = {
  code: 'V107',
  areaId: 0,
  name: '',
  host: '',
  type: '4BR',
  airbnbUrl: '',
  floorNumber: 107,
  maxAdults: 8,
  maxChildren: 0,
  active: true,
  bedroomLayout: '',
  location: '',
  wifiName: '',
  wifiPassword: '',
  doorPassword: '',
  notes: '',
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    if (error.body?.fields) return Object.values(error.body.fields).join(', ')
    return error.message
  }
  return fallback
}

function formatGuestCapacity(maxAdults?: number, maxChildren?: number) {
  const adults = maxAdults ?? 0
  const children = maxChildren ?? 0
  return children > 0 ? `${adults} / ${children}` : `${adults}`
}

function buildDropdownOptions(managedOptions: VillaSettingOption[], roomValues: string[], currentValue: string) {
  const normalized = new Map<string, string>()

  for (const option of managedOptions) {
    const value = option.label.trim()
    if (!value) continue
    normalized.set(value.toLocaleLowerCase('vi-VN'), value)
  }

  for (const value of roomValues) {
    const trimmed = value.trim()
    if (!trimmed) continue
    normalized.set(trimmed.toLocaleLowerCase('vi-VN'), trimmed)
  }

  const currentTrimmed = currentValue.trim()
  if (currentTrimmed) {
    normalized.set(currentTrimmed.toLocaleLowerCase('vi-VN'), currentTrimmed)
  }

  return Array.from(normalized.values())
}

function getOperationalStatusLabel(status?: Room['operationalStatus']) {
  if (status === 'CHECKED_IN') return 'Checked in'
  if (status === 'NEEDS_CLEANING') return 'Needs cleaning'
  if (status === 'OOI') return 'OOI'
  return 'Ready'
}

async function copyText(text: string) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)

  textarea.focus()
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!ok) throw new Error('Copy failed')
}

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [areas, setAreas] = useState<RoomArea[]>([])
  const [villaSettings, setVillaSettings] = useState<VillaSettingsResponse>({ roomTypes: [], hosts: [], bookingSources: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState<RoomUpsertRequest>(INITIAL_FORM)
  const [selectedRoomCodes, setSelectedRoomCodes] = useState<string[]>([])
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [repairRoom, setRepairRoom] = useState<Room | null>(null)
  const [repairDetails, setRepairDetails] = useState('')
  const [repairSaving, setRepairSaving] = useState(false)
  const [repairError, setRepairError] = useState<string | null>(null)
  const [ooiRoom, setOoiRoom] = useState<Room | null>(null)
  const [ooiDetails, setOoiDetails] = useState('')
  const [ooiSaving, setOoiSaving] = useState(false)
  const [ooiError, setOoiError] = useState<string | null>(null)
  const loadingRef = useRef(false)

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      return (
        (a.areaName || '').localeCompare(b.areaName || '', 'vi-VN', { sensitivity: 'base' }) ||
        a.location.localeCompare(b.location, 'vi-VN', { sensitivity: 'base' }) ||
        a.floorNumber - b.floorNumber ||
        a.code.localeCompare(b.code, 'vi-VN', { numeric: true })
      )
    })
  }, [rooms])
  const roomTypeOptions = useMemo(
    () => buildDropdownOptions(villaSettings.roomTypes, rooms.map((room) => room.type), form.type),
    [form.type, rooms, villaSettings.roomTypes],
  )
  const hostOptions = useMemo(
    () => buildDropdownOptions(villaSettings.hosts, rooms.map((room) => room.host), form.host),
    [form.host, rooms, villaSettings.hosts],
  )

  async function load(opts?: { silent?: boolean }) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const [roomsData, areasData, villaSettingsData] = await Promise.all([
        apiFetch<Room[]>('/api/admin/rooms'),
        apiFetch<RoomArea[]>('/api/admin/room-areas'),
        apiFetch<VillaSettingsResponse>('/api/admin/villa-settings'),
      ])
      setRooms(roomsData)
      setAreas(areasData)
      setVillaSettings(villaSettingsData)
      setError(null)
    } catch (e: unknown) {
      if (!opts?.silent) {
        setError(getErrorMessage(e, 'Could not load villas'))
      }
    } finally {
      if (!opts?.silent) setLoading(false)
      loadingRef.current = false
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (areas.length === 0) return
    setForm((current) => (current.areaId ? current : { ...current, areaId: areas[0].id }))
  }, [areas])

  useEffect(() => {
    if (!modalMode) return
    setForm((current) => {
      const nextType = current.type || roomTypeOptions[0] || ''
      const nextHost = current.host || hostOptions[0] || ''
      if (nextType === current.type && nextHost === current.host) return current
      return { ...current, type: nextType, host: nextHost }
    })
  }, [hostOptions, modalMode, roomTypeOptions])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      if (saving || modalMode || busyId) return
      void load({ silent: true })
    }
    const intervalId = window.setInterval(tick, 8000)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', tick)
    }
  }, [saving, modalMode, busyId])

  function resetForm() {
    setEditingId(null)
    setModalMode(null)
    setForm(INITIAL_FORM)
    setSaveError(null)
  }

  function openCreateModal() {
    setEditingId(null)
    setModalMode('create')
    setForm({
      ...INITIAL_FORM,
      areaId: areas[0]?.id ?? 0,
      host: hostOptions[0] ?? '',
      type: roomTypeOptions[0] ?? '',
    })
    setSaveError(null)
  }

  function closeModal() {
    resetForm()
  }

  function buildCalendarLink(roomCodes: string[]) {
    const normalized = Array.from(new Set(roomCodes.map((value) => value.trim().toUpperCase()).filter(Boolean)))
    return `${window.location.origin}/calendar/${normalized.join('&')}`
  }

  async function copySelectedCalendarLink() {
    if (selectedRoomCodes.length === 0) return
    try {
      await copyText(buildCalendarLink(selectedRoomCodes))
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  async function copySingleCalendarLink(roomCode: string) {
    try {
      await copyText(buildCalendarLink([roomCode]))
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  function handleEdit(room: Room) {
    setEditingId(room.id)
    setModalMode('edit')
    setForm({
      code: room.code,
      areaId: room.areaId ?? areas[0]?.id ?? 0,
      name: room.name,
      host: room.host,
      type: room.type,
      airbnbUrl: room.airbnbUrl || '',
      floorNumber: room.floorNumber,
      maxAdults: room.maxAdults,
      maxChildren: room.maxChildren,
      active: room.active,
      bedroomLayout: room.bedroomLayout,
      location: room.location,
      wifiName: room.wifiName,
      wifiPassword: room.wifiPassword,
      doorPassword: room.doorPassword,
      notes: room.notes,
    })
    setSaveError(null)
  }

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      const payload: RoomUpsertRequest = {
        code: form.code.trim(),
        areaId: Number(form.areaId),
        name: form.name.trim(),
        host: form.host.trim(),
        type: form.type.trim(),
        airbnbUrl: form.airbnbUrl?.trim() || '',
        floorNumber: deriveSortOrderFromCode(form.code.trim()),
        maxAdults: Number(form.maxAdults),
        maxChildren: Number(form.maxChildren),
        active: Boolean(form.active),
        bedroomLayout: form.bedroomLayout?.trim() || '',
        location: form.location?.trim() || '',
        wifiName: form.wifiName?.trim() || '',
        wifiPassword: form.wifiPassword?.trim() || '',
        doorPassword: form.doorPassword?.trim() || '',
        notes: form.notes?.trim() || '',
      }

      if (editingId) {
        await apiFetch<Room>(`/api/admin/rooms/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch<Room>('/api/admin/rooms', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }

      resetForm()
      await load()
    } catch (e: unknown) {
      setSaveError(getErrorMessage(e, 'Could not save villa'))
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!window.confirm('Delete this villa?')) return
    setBusyId(id)
    try {
      await apiFetch<void>(`/api/admin/rooms/${id}`, { method: 'DELETE' })
      setRooms((current) => current.filter((room) => room.id !== id))
      if (editingId === id) resetForm()
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Could not delete villa'))
    } finally {
      setBusyId(null)
    }
  }

  function openRepairModal(room: Room) {
    setRepairRoom(room)
    setRepairDetails(room.repairNeeded ? room.repairDetails || '' : '')
    setRepairError(null)
  }

  function closeRepairModal() {
    setRepairRoom(null)
    setRepairDetails('')
    setRepairError(null)
  }

  function openOOIModal(room: Room) {
    setOoiRoom(room)
    setOoiDetails(room.ooiDetails || '')
    setOoiError(null)
  }

  function closeOOIModal() {
    setOoiRoom(null)
    setOoiDetails('')
    setOoiError(null)
  }

  async function saveRepair() {
    if (!repairRoom) return
    setRepairSaving(true)
    setRepairError(null)
    try {
      await apiFetch<Room>(`/api/admin/rooms/${repairRoom.id}/report-repair`, {
        method: 'POST',
        body: JSON.stringify({ details: repairDetails }),
      })
      closeRepairModal()
      await load()
    } catch (e: unknown) {
      setRepairError(getErrorMessage(e, 'Could not report repair'))
    } finally {
      setRepairSaving(false)
    }
  }

  async function resolveRepair(room: Room) {
    if (!window.confirm(`Mark repair as done for ${room.code}?`)) return
    setBusyId(room.id)
    try {
      await apiFetch<Room>(`/api/admin/rooms/${room.id}/resolve-repair`, { method: 'POST' })
      await load({ silent: true })
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Could not resolve repair'))
    } finally {
      setBusyId(null)
    }
  }

  async function toggleOOI(room: Room) {
    const isOOI = room.operationalStatus === 'OOI'
    if (!isOOI) {
      openOOIModal(room)
      return
    }
    const confirmed = window.confirm(`Clear OOI for ${room.code}?`)
    if (!confirmed) return
    setBusyId(room.id)
    try {
      await apiFetch<Room>(`/api/admin/rooms/${room.id}/clear-ooi`, { method: 'POST' })
      await load({ silent: true })
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Could not update OOI status'))
    } finally {
      setBusyId(null)
    }
  }

  async function saveOOI() {
    if (!ooiRoom) return
    setOoiSaving(true)
    setOoiError(null)
    try {
      await apiFetch<Room>(`/api/admin/rooms/${ooiRoom.id}/mark-ooi`, {
        method: 'POST',
        body: JSON.stringify({ details: ooiDetails }),
      })
      closeOOIModal()
      await load({ silent: true })
    } catch (e: unknown) {
      setOoiError(getErrorMessage(e, 'Could not mark OOI'))
    } finally {
      setOoiSaving(false)
    }
  }

  return (
    <section className="section">
      <div className="container">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <Link to="/admin/room-areas" className="btn">
              Villa areas
            </Link>
            <Link to="/admin/villa-settings" className="btn">
              Villa settings
            </Link>
          </div>
          <div className="row">
            <button className="btn" type="button" onClick={() => void copySelectedCalendarLink()} disabled={selectedRoomCodes.length === 0}>
              Copy calendar link{selectedRoomCodes.length > 0 ? ` (${selectedRoomCodes.length})` : ''}
            </button>
            <button className="btn primary" type="button" onClick={openCreateModal}>
              Add villa
            </button>
          </div>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>Admin • Villa Directory</h2>
            <div className="muted">Manage villa details, location groups, Airbnb links, capacity, access info, and operating status.</div>
          </div>
          <div className="muted">
            {copyStatus === 'copied'
              ? 'Calendar link copied.'
              : copyStatus === 'failed'
                ? 'Could not copy calendar link.'
                : selectedRoomCodes.length > 0
                  ? buildCalendarLink(selectedRoomCodes)
                  : 'Select one or more villas to generate a shared calendar link.'}
          </div>
        </div>

        {loading ? (
          <div className="card detail-card muted">Loading villa list...</div>
        ) : error ? (
          <div className="card error">
            <div className="error-title">Could not load data</div>
            <div className="muted">{error}</div>
          </div>
        ) : (
          <div className="card detail-card">
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Villa list</div>
            <div className="admin-room-mobile-grid">
              {sortedRooms.map((room) => (
                <article key={`mobile-${room.id}`} className="admin-room-mobile-card">
                  <div className="admin-room-mobile-card-head">
                    <label className="admin-room-mobile-check">
                      <input
                        type="checkbox"
                        checked={selectedRoomCodes.includes(room.code)}
                        onChange={(e) =>
                          setSelectedRoomCodes((current) =>
                            e.target.checked ? [...current, room.code] : current.filter((code) => code !== room.code),
                          )
                        }
                        aria-label={`Select ${room.code}`}
                      />
                      <span className="admin-room-mobile-code">{room.code}</span>
                    </label>
                      <span className="admin-room-mobile-type">{room.areaName || room.type}</span>
                  </div>

                  <div className="admin-room-mobile-meta">
                    <div className="admin-room-mobile-meta-row">
                      <span>Area</span>
                      <strong>{room.areaName || '-'}</strong>
                    </div>
                    <div className="admin-room-mobile-meta-row">
                      <span>Guests</span>
                      <strong>{formatGuestCapacity(room.maxAdults, room.maxChildren)}</strong>
                    </div>
                    <div className="admin-room-mobile-meta-row">
                      <span>Status</span>
                      <div className="admin-room-status-stack">
                        <span className={`admin-room-status-badge ${room.active ? 'operating' : 'paused'}`}>
                          {room.active ? 'Operating' : 'Paused'}
                        </span>
                        <span className={`admin-room-status-badge ${room.operationalStatus === 'OOI' ? 'ooi' : 'operational'}`}>
                          {getOperationalStatusLabel(room.operationalStatus)}
                        </span>
                        {room.repairNeeded ? (
                          <span className="admin-room-status-badge needs-repair">Needs repair</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="admin-room-actions">
                    <button
                      className="btn admin-room-action-btn admin-room-action-btn--ghost"
                      type="button"
                      onClick={() => void copySingleCalendarLink(room.code)}
                    >
                      Copy link
                    </button>
                    <button
                      className="btn admin-room-action-btn admin-room-action-btn--primary"
                      type="button"
                      onClick={() => handleEdit(room)}
                    >
                      Edit
                    </button>
                    <button
                      className={`btn admin-room-action-btn ${room.operationalStatus === 'OOI' ? 'admin-room-action-btn--warning' : 'admin-room-action-btn--ghost'}`}
                      type="button"
                      onClick={() => void toggleOOI(room)}
                      disabled={busyId === room.id}
                    >
                      {busyId === room.id ? '...' : room.operationalStatus === 'OOI' ? 'Clear OOI' : 'Mark OOI'}
                    </button>
                    <button
                      className={`btn admin-room-action-btn ${room.repairNeeded ? 'admin-room-action-btn--success' : 'admin-room-action-btn--ghost'}`}
                      type="button"
                      onClick={() => (room.repairNeeded ? void resolveRepair(room) : openRepairModal(room))}
                      disabled={busyId === room.id}
                    >
                      {room.repairNeeded ? 'Done repair' : 'Report repair'}
                    </button>
                    <button
                      className="btn admin-room-action-btn admin-room-action-btn--danger"
                      type="button"
                      onClick={() => void remove(room.id)}
                      disabled={busyId === room.id}
                    >
                      {busyId === room.id ? '...' : 'Delete'}
                    </button>
                  </div>

                  {room.repairNeeded ? (
                    <div className="admin-room-repair-note">
                      Repair: {room.repairDetails || 'Pending detail'}
                    </div>
                  ) : null}
                  {room.operationalStatus === 'OOI' && room.ooiDetails ? (
                    <div className="admin-room-repair-note">
                      OOI: {room.ooiDetails}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 48 }}>
                      <input
                        type="checkbox"
                        checked={sortedRooms.length > 0 && selectedRoomCodes.length === sortedRooms.length}
                        onChange={(e) =>
                          setSelectedRoomCodes(e.target.checked ? sortedRooms.map((room) => room.code) : [])
                        }
                        aria-label="Select all villas"
                      />
                    </th>
                    <th style={{ width: 150 }}>Code</th>
                    <th style={{ width: 120 }}>Area</th>
                    <th style={{ width: 120 }}>Type</th>
                    <th style={{ width: 90 }}>Guests</th>
                    <th style={{ width: 120 }}>Status</th>
                    <th style={{ width: 280 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRooms.map((room) => (
                    <tr key={room.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedRoomCodes.includes(room.code)}
                          onChange={(e) =>
                            setSelectedRoomCodes((current) =>
                              e.target.checked ? [...current, room.code] : current.filter((code) => code !== room.code),
                            )
                          }
                          aria-label={`Select ${room.code}`}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{room.code}</div>
                        {room.airbnbUrl ? (
                          <a href={room.airbnbUrl} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: 12 }}>
                            Airbnb link
                          </a>
                        ) : (
                          <div className="muted" style={{ fontSize: 12 }}>
                            Airbnb link pending
                          </div>
                        )}
                      </td>
                      <td>{room.areaName || '-'}</td>
                      <td>{room.type}</td>
                      <td>{formatGuestCapacity(room.maxAdults, room.maxChildren)}</td>
                      <td>
                        <div className="admin-room-status-stack">
                          <span className={`admin-room-status-badge ${room.active ? 'operating' : 'paused'}`}>
                            {room.active ? 'Operating' : 'Paused'}
                          </span>
                          <span className={`admin-room-status-badge ${room.operationalStatus === 'OOI' ? 'ooi' : 'operational'}`}>
                            {getOperationalStatusLabel(room.operationalStatus)}
                          </span>
                          {room.repairNeeded ? (
                            <span className="admin-room-status-badge needs-repair">Needs repair</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="admin-room-actions-cell">
                        <div className="admin-room-actions">
                          <button
                            className="btn admin-room-action-btn admin-room-action-btn--ghost"
                            type="button"
                            onClick={() => void copySingleCalendarLink(room.code)}
                          >
                            Copy link
                          </button>
                          <button
                            className="btn admin-room-action-btn admin-room-action-btn--primary"
                            type="button"
                            onClick={() => handleEdit(room)}
                          >
                            Edit
                          </button>
                          <button
                            className={`btn admin-room-action-btn ${room.operationalStatus === 'OOI' ? 'admin-room-action-btn--warning' : 'admin-room-action-btn--ghost'}`}
                            type="button"
                            onClick={() => void toggleOOI(room)}
                            disabled={busyId === room.id}
                          >
                            {busyId === room.id ? '...' : room.operationalStatus === 'OOI' ? 'Clear OOI' : 'Mark OOI'}
                          </button>
                          <button
                            className={`btn admin-room-action-btn ${room.repairNeeded ? 'admin-room-action-btn--success' : 'admin-room-action-btn--ghost'}`}
                            type="button"
                            onClick={() => (room.repairNeeded ? void resolveRepair(room) : openRepairModal(room))}
                            disabled={busyId === room.id}
                          >
                            {room.repairNeeded ? 'Done repair' : 'Report repair'}
                          </button>
                          <button
                            className="btn admin-room-action-btn admin-room-action-btn--danger"
                            type="button"
                            onClick={() => void remove(room.id)}
                            disabled={busyId === room.id}
                          >
                            {busyId === room.id ? '...' : 'Delete'}
                          </button>
                        </div>
                        {room.repairNeeded ? (
                          <div className="admin-room-repair-note">
                            Repair: {room.repairDetails || 'Pending detail'}
                          </div>
                        ) : null}
                        {room.operationalStatus === 'OOI' && room.ooiDetails ? (
                          <div className="admin-room-repair-note">
                            OOI: {room.ooiDetails}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {modalMode ? (
          <div className="admin-rooms-modal-overlay" role="dialog" aria-modal="true" onClick={closeModal}>
            <div className="admin-rooms-modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-rooms-modal-head">
                <div>
                  <div className="admin-rooms-modal-title">{modalMode === 'edit' ? 'Update villa' : 'Create villa'}</div>
                  <div className="muted">Manage villa details, Airbnb link, capacity, access info, and operating status.</div>
                </div>
                <button className="btn" type="button" onClick={closeModal}>
                  Close
                </button>
              </div>

              <div className="admin-rooms-modal-body">
                <div className="row">
                  <label className="field" style={{ width: 180 }}>
                    <div className="field-label">Villa code</div>
                    <input
                      className="input"
                      value={form.code}
                      onChange={(e) =>
                        setForm((current) => {
                          const nextCode = e.target.value.toUpperCase()
                          const nextOrder = deriveSortOrderFromCode(nextCode)
                          return { ...current, code: nextCode, floorNumber: nextOrder, name: current.name || `Villa ${nextCode}` }
                        })
                      }
                      placeholder="V107"
                    />
                  </label>
                  <label className="field" style={{ width: 180 }}>
                    <div className="field-label">Area</div>
                    <select
                      className="select"
                      value={form.areaId}
                      onChange={(e) => setForm((current) => ({ ...current, areaId: Number(e.target.value) }))}
                    >
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field" style={{ flex: 1, minWidth: 220 }}>
                    <div className="field-label">Villa name</div>
                    <input
                      className="input"
                      value={form.name}
                      onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                      placeholder="Villa V107"
                    />
                  </label>
                  <label className="field" style={{ width: 180 }}>
                    <div className="field-label">Villa type</div>
                    <select
                      className="select"
                      value={form.type}
                      onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))}
                    >
                      {roomTypeOptions.length > 0 ? (
                        roomTypeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))
                      ) : (
                        <option value="">No villa types available</option>
                      )}
                    </select>
                  </label>
                  <label className="field" style={{ flex: 1, minWidth: 240 }}>
                    <div className="field-label">Airbnb URL</div>
                    <input
                      className="input"
                      value={form.airbnbUrl}
                      onChange={(e) => setForm((current) => ({ ...current, airbnbUrl: e.target.value }))}
                      placeholder="https://www.airbnb.com/rooms/..."
                    />
                  </label>
                </div>

                <div className="row">
                  <label className="field" style={{ flex: 1, minWidth: 220 }}>
                    <div className="field-label">Host</div>
                    <select
                      className="select"
                      value={form.host}
                      onChange={(e) => setForm((current) => ({ ...current, host: e.target.value }))}
                    >
                      {hostOptions.length > 0 ? (
                        hostOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))
                      ) : (
                        <option value="">No hosts available</option>
                      )}
                    </select>
                  </label>
                  <label className="field" style={{ width: 200 }}>
                    <div className="field-label">Location</div>
                    <input
                      className="input"
                      value={form.location}
                      onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))}
                      placeholder="Beach Front"
                    />
                  </label>
                  <label className="field" style={{ width: 160 }}>
                    <div className="field-label">Guests</div>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={form.maxAdults}
                      onChange={(e) => setForm((current) => ({ ...current, maxAdults: Number(e.target.value) }))}
                    />
                  </label>
                  <label className="field" style={{ width: 160 }}>
                    <div className="field-label">Children</div>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={form.maxChildren}
                      onChange={(e) => setForm((current) => ({ ...current, maxChildren: Number(e.target.value) }))}
                    />
                  </label>
                </div>

                {roomTypeOptions.length === 0 || hostOptions.length === 0 ? (
                  <div className="card detail-card" style={{ padding: 14 }}>
                    <div style={{ fontWeight: 800, marginBottom: 4 }}>Missing dropdown data</div>
                    <div className="muted">
                      Update the villa types or host list in{' '}
                      <Link to="/admin/villa-settings">Villa settings</Link> to use this form.
                    </div>
                  </div>
                ) : null}

                <div className="row">
                  <label className="field" style={{ flex: 1, minWidth: 260 }}>
                    <div className="field-label">Bedroom layout</div>
                    <input
                      className="input"
                      value={form.bedroomLayout}
                      onChange={(e) => setForm((current) => ({ ...current, bedroomLayout: e.target.value }))}
                      placeholder="5BR | 2 Master + 2 DBL + 1 TWN"
                    />
                  </label>
                  <label className="field" style={{ width: 180 }}>
                    <div className="field-label">Active</div>
                    <select
                      className="select"
                      value={String(form.active)}
                      onChange={(e) => setForm((current) => ({ ...current, active: e.target.value === 'true' }))}
                    >
                      <option value="true">Operating</option>
                      <option value="false">Paused</option>
                    </select>
                  </label>
                </div>

                <div className="row">
                  <label className="field" style={{ flex: 1, minWidth: 220 }}>
                    <div className="field-label">Wi-Fi name</div>
                    <input
                      className="input"
                      value={form.wifiName}
                      onChange={(e) => setForm((current) => ({ ...current, wifiName: e.target.value }))}
                      placeholder="JOYINTRIP"
                    />
                  </label>
                  <label className="field" style={{ flex: 1, minWidth: 220 }}>
                    <div className="field-label">Wi-Fi password</div>
                    <input
                      className="input"
                      value={form.wifiPassword}
                      onChange={(e) => setForm((current) => ({ ...current, wifiPassword: e.target.value }))}
                      placeholder="********"
                    />
                  </label>
                  <label className="field" style={{ width: 160 }}>
                    <div className="field-label">Door password</div>
                    <input
                      className="input"
                      value={form.doorPassword}
                      onChange={(e) => setForm((current) => ({ ...current, doorPassword: e.target.value }))}
                      placeholder="360360#"
                    />
                  </label>
                </div>

                <label className="field">
                  <div className="field-label">Operational notes</div>
                  <textarea
                    className="textarea"
                    value={form.notes}
                    onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                    placeholder="Housekeeping notes, bedding detail, special instructions..."
                  />
                </label>

                {saveError ? (
                  <div className="card error">
                    <div className="error-title">Could not save</div>
                    <div className="muted">{saveError}</div>
                  </div>
                ) : null}

                <div className="admin-rooms-modal-actions">
                  <button className="btn primary" type="button" onClick={() => void save()} disabled={saving}>
                    {saving ? 'Saving...' : modalMode === 'edit' ? 'Update villa' : 'Create villa'}
                  </button>
                  <button className="btn" type="button" onClick={closeModal}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {repairRoom ? (
          <div className="admin-rooms-modal-overlay" role="dialog" aria-modal="true" onClick={closeRepairModal}>
            <div className="admin-rooms-modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-rooms-modal-head">
                <div>
                  <div className="admin-rooms-modal-title">Report room repair</div>
                  <div className="muted">{repairRoom.code} • {repairRoom.name}</div>
                </div>
                <button className="btn" type="button" onClick={closeRepairModal}>
                  Close
                </button>
              </div>

              <div className="admin-rooms-modal-body">
                <label className="field">
                  <div className="field-label">Repair detail</div>
                  <textarea
                    className="textarea"
                    value={repairDetails}
                    onChange={(e) => setRepairDetails(e.target.value)}
                    placeholder="Ví dụ: cửa toilet kẹt, máy lạnh phòng master không lạnh, vòi lavabo rò nước..."
                  />
                </label>

                {repairError ? (
                  <div className="card error">
                    <div className="error-title">Could not save</div>
                    <div className="muted">{repairError}</div>
                  </div>
                ) : null}

                <div className="admin-rooms-modal-actions">
                  <button className="btn primary" type="button" onClick={() => void saveRepair()} disabled={repairSaving}>
                    {repairSaving ? 'Saving...' : 'Report repair'}
                  </button>
                  <button className="btn" type="button" onClick={closeRepairModal}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {ooiRoom ? (
          <div className="admin-rooms-modal-overlay" role="dialog" aria-modal="true" onClick={closeOOIModal}>
            <div className="admin-rooms-modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-rooms-modal-head">
                <div>
                  <div className="admin-rooms-modal-title">Mark villa as OOI</div>
                  <div className="muted">{ooiRoom.code} • {ooiRoom.name}</div>
                </div>
                <button className="btn" type="button" onClick={closeOOIModal}>
                  Close
                </button>
              </div>

              <div className="admin-rooms-modal-body">
                <label className="field">
                  <div className="field-label">OOI detail</div>
                  <textarea
                    className="textarea"
                    value={ooiDetails}
                    onChange={(e) => setOoiDetails(e.target.value)}
                    placeholder="Ví dụ: hồ bơi đang chống thấm, máy lạnh phòng master hỏng nặng, villa đang sửa hệ điện..."
                  />
                </label>

                {ooiError ? (
                  <div className="card error">
                    <div className="error-title">Could not save</div>
                    <div className="muted">{ooiError}</div>
                  </div>
                ) : null}

                <div className="admin-rooms-modal-actions">
                  <button className="btn primary" type="button" onClick={() => void saveOOI()} disabled={ooiSaving}>
                    {ooiSaving ? 'Saving...' : 'Mark OOI'}
                  </button>
                  <button className="btn" type="button" onClick={closeOOIModal}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

      </div>
    </section>
  )
}
