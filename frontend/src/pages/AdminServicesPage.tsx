import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { TravelService, TravelServiceUpsertRequest } from '../types'
import './pages.css'

export default function AdminServicesPage() {
  const [services, setServices] = useState<TravelService[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [form, setForm] = useState<TravelServiceUpsertRequest>({
    name: '',
    description: '',
    priceFrom: 49,
    imageUrl: 'https://images.unsplash.com/photo-1550353127-b0da3aeaa0ca?auto=format&fit=crop&w=1400&q=80',
    videoUrls: [],
  })
  const [videoUrlsInput, setVideoUrlsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const sorted = useMemo(() => {
    return [...services].sort((a, b) => b.id - a.id)
  }, [services])

  async function load(opts?: { silent?: boolean }) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await apiFetch<TravelService[]>('/api/services')
      setServices(data)
      setError(null)
    } catch (e: unknown) {
      if (!opts?.silent) {
        setError(e instanceof HttpError ? e.message : 'Could not load data')
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

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim(),
        videoUrls: videoUrlsInput.split('\n').map((s) => s.trim()).filter(Boolean),
        priceFrom: String(form.priceFrom),
      }

      if (editingId) {
        await apiFetch<TravelService>(`/api/admin/services/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch<TravelService>('/api/admin/services', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }

      setForm((p) => ({ ...p, name: '', description: '', videoUrls: [] }))
      setVideoUrlsInput('')
      setEditingId(null)
      await load()
    } catch (e: unknown) {
      const message =
        e instanceof HttpError
          ? e.body?.fields
            ? Object.values(e.body.fields).join(', ')
            : e.message
          : 'Could not save service'
      setSaveError(message)
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(s: TravelService) {
    setForm({
      name: s.name,
      description: s.description,
      priceFrom: Number(s.priceFrom),
      imageUrl: s.imageUrl,
      videoUrls: s.videoUrls || [],
    })
    setVideoUrlsInput(s.videoUrls?.join('\n') || '')
    setEditingId(s.id)
  }

  async function remove(id: number) {
    setBusyId(id)
    try {
      await apiFetch<void>(`/api/admin/services/${id}`, { method: 'DELETE' })
      setServices((p) => p.filter((s) => s.id !== id))
    } catch (e: unknown) {
      setError(e instanceof HttpError ? e.message : 'Delete failed')
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
            <Link to="/admin/bookings" className="btn">
              Bookings
            </Link>
            <Link to="/admin/service-requests" className="btn">
              Service requests
            </Link>
          </div>
          <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
            Reload
          </button>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>Admin • Services</h2>
            <div className="muted">Create, update, and remove services.</div>
          </div>
        </div>

        <div className="card detail-card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>{editingId ? 'Edit service' : 'Create service'}</div>

          <div className="row">
            <label className="field" style={{ flex: 1, minWidth: 220 }}>
              <div className="field-label">Name</div>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Private Car"
              />
            </label>
            <label className="field" style={{ width: 200 }}>
              <div className="field-label">Starting price (USD)</div>
              <input
                className="input"
                type="number"
                min={0}
                value={form.priceFrom}
                onChange={(e) => setForm((p) => ({ ...p, priceFrom: Number(e.target.value) }))}
              />
            </label>
          </div>

          <label className="field">
            <div className="field-label">Cover image (URL)</div>
            <input
              className="input"
              value={form.imageUrl}
              onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
              placeholder="https://..."
            />
          </label>

          <label className="field">
            <div className="field-label">YouTube videos (one URL per line)</div>
            <textarea
              className="textarea"
              value={videoUrlsInput}
              onChange={(e) => setVideoUrlsInput(e.target.value)}
              placeholder="https://youtube.com/...&#10;https://youtube.com/..."
            />
          </label>

          <label className="field">
            <div className="field-label">Description</div>
            <textarea
              className="textarea"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Service details..."
            />
          </label>

          {saveError ? (
            <div className="card error" style={{ marginTop: 12 }}>
              <div className="error-title">Could not save</div>
              <div className="muted">{saveError}</div>
            </div>
          ) : null}

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" type="button" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            {editingId && (
              <button
                className="btn"
                style={{ marginLeft: 10 }}
                type="button"
                onClick={() => {
                  setEditingId(null)
                  setForm({
                    name: '',
                    description: '',
                    priceFrom: 49,
                    imageUrl:
                      'https://images.unsplash.com/photo-1550353127-b0da3aeaa0ca?auto=format&fit=crop&w=1400&q=80',
                    videoUrls: [],
                  })
                  setVideoUrlsInput('')
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="card detail-card muted">Loading...</div>
        ) : error ? (
          <div className="card error">
            <div className="error-title">Something went wrong</div>
            <div className="muted">{error}</div>
          </div>
        ) : (
          <div className="card detail-card">
            <div style={{ fontWeight: 800, marginBottom: 10 }}>List</div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>ID</th>
                    <th>Name</th>
                    <th style={{ width: 140 }}>Price from</th>
                    <th>Videos</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td>
                        <Link to={`/services/${s.id}`} style={{ color: 'inherit' }}>
                          {s.name}
                        </Link>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {s.description.slice(0, 120)}
                          {s.description.length > 120 ? '…' : ''}
                        </div>
                      </td>
                      <td>{Number(s.priceFrom)}+</td>
                      <td>
                        <div style={{ fontSize: 12, wordBreak: 'break-all', maxWidth: 200 }}>
                          {s.videoUrls?.map((url, i) => (
                            <div key={i}>
                              <a href={url} target="_blank" rel="noreferrer">
                                Video {i + 1}
                              </a>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn"
                          style={{ padding: '4px 8px', fontSize: 12, marginRight: 8 }}
                          onClick={() => handleEdit(s)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn danger"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          onClick={() => {
                            if (confirm('Delete this service?')) void remove(s.id)
                          }}
                          disabled={busyId === s.id}
                        >
                          {busyId === s.id ? '...' : 'Delete'}
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
