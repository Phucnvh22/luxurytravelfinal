import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { Destination } from '../types'
import './pages.css'

type DestinationUpsertRequest = {
  name: string
  location: string
  description: string
  priceFrom: number
  durationDays: number
  imageUrl: string
  videoUrls?: string[]
}

function toTime(value?: string) {
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

export default function AdminDestinationsPage() {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [form, setForm] = useState<DestinationUpsertRequest>({
    name: '',
    location: '',
    description: '',
    priceFrom: 999,
    durationDays: 5,
    imageUrl:
      'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1400&q=80',
    videoUrls: [],
  })
  const [videoUrlsInput, setVideoUrlsInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const sorted = useMemo(() => {
    return [...destinations].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt) || b.id - a.id)
  }, [destinations])

  async function load(opts?: { silent?: boolean }) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await apiFetch<Destination[]>('/api/destinations')
      setDestinations(data)
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
      if (creating || editingId || busyId) return
      void load({ silent: true })
    }
    const intervalId = window.setInterval(tick, 8000)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', tick)
    }
  }, [creating, editingId, busyId])

  async function create() {
    setCreating(true)
    setCreateError(null)
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        location: form.location.trim(),
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim(),
        videoUrls: videoUrlsInput.split('\n').map(s => s.trim()).filter(Boolean),
        priceFrom: String(form.priceFrom),
      }
      
      if (editingId) {
        await apiFetch<Destination>(`/api/admin/destinations/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch<Destination>('/api/admin/destinations', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }
      
      setForm((p) => ({ ...p, name: '', location: '', description: '', videoUrls: [] }))
      setVideoUrlsInput('')
      setEditingId(null)
      await load()
    } catch (e: unknown) {
      const message =
        e instanceof HttpError
          ? e.body?.fields
            ? Object.values(e.body.fields).join(', ')
            : e.message
          : 'Could not save destination'
      setCreateError(message)
    } finally {
      setCreating(false)
    }
  }

  const handleEdit = (d: Destination) => {
    setForm({
      name: d.name,
      location: d.location,
      description: d.description,
      priceFrom: d.priceFrom,
      durationDays: d.durationDays,
      imageUrl: d.imageUrl,
      videoUrls: d.videoUrls || [],
    })
    setVideoUrlsInput(d.videoUrls?.join('\n') || '')
    setEditingId(d.id)
  }

  async function remove(id: number) {
    setBusyId(id)
    try {
      await apiFetch<void>(`/api/admin/destinations/${id}`, { method: 'DELETE' })
      setDestinations((p) => p.filter((d) => d.id !== id))
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
          </div>
          <a className="btn" href="/h2-console" target="_blank" rel="noreferrer">
            H2 Console
          </a>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>Admin • Destinations</h2>
            <div className="muted">Create, update, and remove destinations.</div>
          </div>
          <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
            Reload
          </button>
        </div>

        <div className="card detail-card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>{editingId ? 'Edit destination' : 'Create destination'}</div>
          <div className="row">
            <label className="field" style={{ flex: 1, minWidth: 220 }}>
              <div className="field-label">Name</div>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Santorini Escape"
              />
            </label>
            <label className="field" style={{ width: 200 }}>
              <div className="field-label">Location</div>
              <input
                className="input"
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="Santorini, Greece"
              />
            </label>
          </div>

          <div className="row">
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
            <label className="field" style={{ width: 200 }}>
              <div className="field-label">Duration (days)</div>
              <input
                className="input"
                type="number"
                min={1}
                value={form.durationDays}
                onChange={(e) => setForm((p) => ({ ...p, durationDays: Number(e.target.value) }))}
              />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 240 }}>
              <div className="field-label">Cover image (URL)</div>
              <input
                className="input"
                value={form.imageUrl}
                onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
                placeholder="https://..."
              />
            </label>
          </div>

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
              placeholder="Trip details..."
            />
          </label>

          {createError ? (
            <div className="card error" style={{ marginTop: 12 }}>
              <div className="error-title">Could not save</div>
              <div className="muted">{createError}</div>
            </div>
          ) : null}

          <div className="row" style={{ marginTop: 12 }}>
            <button
              className="btn primary"
              type="button"
              onClick={() => void create()}
              disabled={creating}
            >
              {creating ? 'Saving...' : (editingId ? 'Update' : 'Create')}
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
                    location: '',
                    description: '',
                    priceFrom: 999,
                    durationDays: 5,
                    imageUrl:
                      'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1400&q=80',
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
                    <th style={{ width: 160 }}>Location</th>
                    <th style={{ width: 120 }}>Days</th>
                    <th>Videos</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((d) => (
                    <tr key={d.id}>
                      <td>{d.id}</td>
                      <td>
                        <Link to={`/destinations/${d.id}`} style={{ color: 'inherit' }}>
                          {d.name}
                        </Link>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {d.priceFrom}+
                        </div>
                      </td>
                      <td>{d.location}</td>
                      <td>{d.durationDays}</td>
                      <td>
                        <div style={{ fontSize: 12, wordBreak: 'break-all', maxWidth: 200 }}>
                          {d.videoUrls?.map((url, i) => (
                            <div key={i}><a href={url} target="_blank" rel="noreferrer">Video {i+1}</a></div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn"
                          style={{ padding: '4px 8px', fontSize: 12, marginRight: 8 }}
                          onClick={() => handleEdit(d)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn danger"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          onClick={() => {
                            if (confirm('Delete this destination?')) remove(d.id)
                          }}
                          disabled={busyId === d.id}
                        >
                          {busyId === d.id ? '...' : 'Delete'}
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
