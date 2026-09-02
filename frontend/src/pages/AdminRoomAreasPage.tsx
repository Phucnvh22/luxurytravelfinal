import { useEffect, useRef, useState } from 'react'
import { apiFetch, HttpError } from '../lib/api'
import type { RoomArea, RoomAreaUpsertRequest } from '../types'
import './pages.css'
import './admin-room-areas.css'

const INITIAL_FORM: RoomAreaUpsertRequest = {
  name: 'Premier',
  sortOrder: 1,
  active: true,
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    if (error.body?.fields) return Object.values(error.body.fields).join(', ')
    return error.message
  }
  return fallback
}

export default function AdminRoomAreasPage() {
  const [areas, setAreas] = useState<RoomArea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [form, setForm] = useState<RoomAreaUpsertRequest>(INITIAL_FORM)
  const [saveError, setSaveError] = useState<string | null>(null)
  const loadingRef = useRef(false)

  async function load(opts?: { silent?: boolean }) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await apiFetch<RoomArea[]>('/api/admin/room-areas')
      setAreas(data)
      setError(null)
    } catch (e: unknown) {
      if (!opts?.silent) setError(getErrorMessage(e, 'Could not load villa areas'))
    } finally {
      if (!opts?.silent) setLoading(false)
      loadingRef.current = false
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function resetForm() {
    setEditingId(null)
    setForm(INITIAL_FORM)
    setSaveError(null)
  }

  function handleEdit(area: RoomArea) {
    setEditingId(area.id)
    setForm({
      name: area.name,
      sortOrder: area.sortOrder,
      active: area.active,
    })
    setSaveError(null)
  }

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      const payload: RoomAreaUpsertRequest = {
        name: form.name.trim(),
        sortOrder: Number(form.sortOrder),
        active: Boolean(form.active),
      }

      if (editingId) {
        await apiFetch<RoomArea>(`/api/admin/room-areas/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch<RoomArea>('/api/admin/room-areas', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }

      resetForm()
      await load()
    } catch (e: unknown) {
      setSaveError(getErrorMessage(e, 'Could not save villa area'))
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!window.confirm('Delete this area?')) return
    setBusyId(id)
    try {
      await apiFetch<void>(`/api/admin/room-areas/${id}`, { method: 'DELETE' })
      setAreas((current) => current.filter((item) => item.id !== id))
      if (editingId === id) resetForm()
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Could not delete villa area'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="section">
      <div className="container">
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
            Reload
          </button>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>Admin • Villa Areas</h2>
            <div className="muted">Create and manage villa areas to group villas by operating cluster.</div>
          </div>
        </div>

        <div className="admin-room-areas-layout">
          <div className="card detail-card">
            <div style={{ fontWeight: 800, marginBottom: 12 }}>{editingId ? 'Update area' : 'Add area'}</div>
            <div className="admin-room-areas-form-grid">
              <label className="field">
                <div className="field-label">Area name</div>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="Premier"
                />
              </label>
            </div>

            {saveError ? (
              <div className="card error" style={{ marginTop: 14 }}>
                <div className="error-title">Could not save</div>
                <div className="muted">{saveError}</div>
              </div>
            ) : null}

            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              <button className="btn primary" type="button" onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update area' : 'Add area'}
              </button>
              <button className="btn" type="button" onClick={resetForm}>
                Reset
              </button>
            </div>
          </div>

          <div className="card detail-card admin-room-areas-list-card">
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Area list</div>

            {loading ? (
              <div className="muted">Loading areas...</div>
            ) : error ? (
              <div className="card error">
                <div className="error-title">Could not load data</div>
                <div className="muted">{error}</div>
              </div>
            ) : (
              <div className="table-wrap admin-room-areas-table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th style={{ width: 220 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areas.map((area) => (
                      <tr key={area.id}>
                        <td>{area.name}</td>
                        <td>
                          <div className="row" style={{ gap: 8 }}>
                            <button className="btn" type="button" onClick={() => handleEdit(area)}>
                              Edit
                            </button>
                            <button className="btn danger" type="button" onClick={() => void remove(area.id)} disabled={busyId === area.id}>
                              {busyId === area.id ? '...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
