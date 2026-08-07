import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { Room, RoomUpsertRequest } from '../types'
import './pages.css'

const ROOM_TYPES = ['Standard', 'Deluxe', 'Premium', 'Suite', 'Family']

const INITIAL_FORM: RoomUpsertRequest = {
  code: 'P.101',
  name: '',
  type: ROOM_TYPES[0],
  floorNumber: 1,
  maxAdults: 2,
  maxChildren: 0,
  active: true,
  notes: '',
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    if (error.body?.fields) return Object.values(error.body.fields).join(', ')
    return error.message
  }
  return fallback
}

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState<RoomUpsertRequest>(INITIAL_FORM)
  const loadingRef = useRef(false)

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => a.floorNumber - b.floorNumber || a.code.localeCompare(b.code, 'vi-VN', { numeric: true }))
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
      if (saving || editingId || busyId) return
      void load({ silent: true })
    }
    const intervalId = window.setInterval(tick, 8000)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', tick)
    }
  }, [saving, editingId, busyId])

  function resetForm() {
    setEditingId(null)
    setForm(INITIAL_FORM)
    setSaveError(null)
  }

  function handleEdit(room: Room) {
    setEditingId(room.id)
    setForm({
      code: room.code,
      name: room.name,
      type: room.type,
      floorNumber: room.floorNumber,
      maxAdults: room.maxAdults,
      maxChildren: room.maxChildren,
      active: room.active,
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
        type: form.type.trim(),
        floorNumber: Number(form.floorNumber),
        maxAdults: Number(form.maxAdults),
        maxChildren: Number(form.maxChildren),
        active: Boolean(form.active),
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
      setSaveError(getErrorMessage(e, 'Khong the luu phong'))
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!window.confirm('Xoa phong nay?')) return
    setBusyId(id)
    try {
      await apiFetch<void>(`/api/admin/rooms/${id}`, { method: 'DELETE' })
      setRooms((current) => current.filter((room) => room.id !== id))
      if (editingId === id) resetForm()
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Khong the xoa phong'))
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
              Lich dat phong
            </Link>
          </div>
          <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
            Tai lai
          </button>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>Admin • Danh muc phong</h2>
            <div className="muted">Quan ly ma phong, loai phong, suc chua va tinh trang khai thac.</div>
          </div>
        </div>

        <div className="card detail-card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>{editingId ? 'Cap nhat phong' : 'Tao phong moi'}</div>

          <div className="row">
            <label className="field" style={{ width: 180 }}>
              <div className="field-label">Ma phong</div>
              <input
                className="input"
                value={form.code}
                onChange={(e) => setForm((current) => ({ ...current, code: e.target.value.toUpperCase() }))}
                placeholder="P.101"
              />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 220 }}>
              <div className="field-label">Ten phong</div>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                placeholder="Deluxe City View"
              />
            </label>
            <label className="field" style={{ width: 180 }}>
              <div className="field-label">Loai phong</div>
              <select
                className="select"
                value={form.type}
                onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))}
              >
                {ROOM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="row">
            <label className="field" style={{ width: 160 }}>
              <div className="field-label">Tang</div>
              <input
                className="input"
                type="number"
                min={1}
                value={form.floorNumber}
                onChange={(e) => setForm((current) => ({ ...current, floorNumber: Number(e.target.value) }))}
              />
            </label>
            <label className="field" style={{ width: 160 }}>
              <div className="field-label">Nguoi lon toi da</div>
              <input
                className="input"
                type="number"
                min={1}
                value={form.maxAdults}
                onChange={(e) => setForm((current) => ({ ...current, maxAdults: Number(e.target.value) }))}
              />
            </label>
            <label className="field" style={{ width: 160 }}>
              <div className="field-label">Tre em toi da</div>
              <input
                className="input"
                type="number"
                min={0}
                value={form.maxChildren}
                onChange={(e) => setForm((current) => ({ ...current, maxChildren: Number(e.target.value) }))}
              />
            </label>
            <label className="field" style={{ width: 180 }}>
              <div className="field-label">Khai thac</div>
              <select
                className="select"
                value={String(form.active)}
                onChange={(e) => setForm((current) => ({ ...current, active: e.target.value === 'true' }))}
              >
                <option value="true">Dang khai thac</option>
                <option value="false">Tam dung</option>
              </select>
            </label>
          </div>

          <label className="field">
            <div className="field-label">Ghi chu</div>
            <textarea
              className="textarea"
              value={form.notes}
              onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
              placeholder="Ghi chu van hanh, view, huong phong..."
            />
          </label>

          {saveError ? (
            <div className="card error" style={{ marginTop: 12 }}>
              <div className="error-title">Khong the luu</div>
              <div className="muted">{saveError}</div>
            </div>
          ) : null}

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" type="button" onClick={() => void save()} disabled={saving}>
              {saving ? 'Dang luu...' : editingId ? 'Cap nhat' : 'Tao phong'}
            </button>
            {editingId ? (
              <button className="btn" type="button" onClick={resetForm}>
                Tao moi
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="card detail-card muted">Dang tai danh sach phong...</div>
        ) : error ? (
          <div className="card error">
            <div className="error-title">Khong the tai du lieu</div>
            <div className="muted">{error}</div>
          </div>
        ) : (
          <div className="card detail-card">
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Danh sach phong</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Ma</th>
                    <th>Ten phong</th>
                    <th style={{ width: 120 }}>Loai</th>
                    <th style={{ width: 80 }}>Tang</th>
                    <th style={{ width: 130 }}>Suc chua</th>
                    <th style={{ width: 120 }}>Trang thai</th>
                    <th>Ghi chu</th>
                    <th style={{ width: 150 }}>Thao tac</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRooms.map((room) => (
                    <tr key={room.id}>
                      <td>{room.code}</td>
                      <td>{room.name}</td>
                      <td>{room.type}</td>
                      <td>{room.floorNumber}</td>
                      <td>
                        {room.maxAdults} NL / {room.maxChildren} TE
                      </td>
                      <td>{room.active ? 'Dang khai thac' : 'Tam dung'}</td>
                      <td>{room.notes || '-'}</td>
                      <td>
                        <button
                          className="btn"
                          style={{ padding: '4px 8px', fontSize: 12, marginRight: 8 }}
                          type="button"
                          onClick={() => handleEdit(room)}
                        >
                          Sua
                        </button>
                        <button
                          className="btn danger"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          type="button"
                          onClick={() => void remove(room.id)}
                          disabled={busyId === room.id}
                        >
                          {busyId === room.id ? '...' : 'Xoa'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
