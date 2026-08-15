import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { Room, RoomUpsertRequest } from '../types'
import './pages.css'
import './admin-rooms.css'

function deriveSortOrderFromCode(code: string) {
  const numeric = Number(code.replace(/\D/g, ''))
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1
}

const INITIAL_FORM: RoomUpsertRequest = {
  code: 'V107',
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
  const loadingRef = useRef(false)

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      return (
        a.location.localeCompare(b.location, 'vi-VN', { sensitivity: 'base' }) ||
        a.floorNumber - b.floorNumber ||
        a.code.localeCompare(b.code, 'vi-VN', { numeric: true })
      )
    })
  }, [rooms])

  async function load(opts?: { silent?: boolean }) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await apiFetch<Room[]>('/api/admin/rooms')
      setRooms(data)
      setError(null)
    } catch (e: unknown) {
      if (!opts?.silent) {
        setError(getErrorMessage(e, 'Khong the tai danh sach phong'))
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
    setForm(INITIAL_FORM)
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
      setSaveError(getErrorMessage(e, 'Khong the save villa'))
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
      setError(getErrorMessage(e, 'Khong the delete villa'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="section">
      <div className="container">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <Link to="/" className="btn">
              ← Home
            </Link>
            <Link to="/admin/room-bookings" className="btn">
              Villa calendar
            </Link>
          </div>
          <div className="row">
            <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
              Tai lai
            </button>
            <button className="btn" type="button" onClick={() => void copySelectedCalendarLink()} disabled={selectedRoomCodes.length === 0}>
              Copy calendar link{selectedRoomCodes.length > 0 ? ` (${selectedRoomCodes.length})` : ''}
            </button>
            <button className="btn primary" type="button" onClick={openCreateModal}>
              Tao villa moi
            </button>
          </div>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>Admin • Danh muc phong</h2>
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
                    <th style={{ width: 120 }}>Type</th>
                    <th style={{ width: 190 }}>Host</th>
                    <th>Villa</th>
                    <th style={{ width: 90 }}>Guests</th>
                    <th style={{ width: 160 }}>Location</th>
                    <th style={{ width: 120 }}>Status</th>
                    <th>Notes</th>
                    <th style={{ width: 150 }}>Actions</th>
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
                      <td>{room.type}</td>
                      <td>{room.host || '-'}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{room.name}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {room.bedroomLayout || '-'}
                        </div>
                      </td>
                      <td>{formatGuestCapacity(room.maxAdults, room.maxChildren)}</td>
                      <td>{room.location || '-'}</td>
                      <td>{room.active ? 'Operating' : 'Paused'}</td>
                      <td>{room.notes || '-'}</td>
                      <td>
                        <button
                          className="btn"
                          style={{ padding: '4px 8px', fontSize: 12, marginRight: 8 }}
                          type="button"
                          onClick={() => void copySingleCalendarLink(room.code)}
                        >
                          Copy link
                        </button>
                        <button
                          className="btn"
                          style={{ padding: '4px 8px', fontSize: 12, marginRight: 8 }}
                          type="button"
                          onClick={() => handleEdit(room)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn danger"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          type="button"
                          onClick={() => void remove(room.id)}
                          disabled={busyId === room.id}
                        >
                          {busyId === room.id ? '...' : 'Delete'}
                        </button>
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
                    <input
                      className="input"
                      value={form.type}
                      onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))}
                      placeholder="5BR"
                    />
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
                    <input
                      className="input"
                      value={form.host}
                      onChange={(e) => setForm((current) => ({ ...current, host: e.target.value }))}
                      placeholder="Mr Phuc - DN Luxury Travel"
                    />
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
      </div>
    </section>
  )
}
