import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { Experience, ExperienceUpsertRequest } from '../types'
import './pages.css'

type Scope = 'admin' | 'seller'

export default function ExperienceCrudPage({ scope }: { scope: Scope }) {
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [form, setForm] = useState<ExperienceUpsertRequest>({
    name: '',
    description: '',
    priceFrom: 99,
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Da_Nang_Dragon_Bridge_(I).jpg?width=1600',
    videoUrls: [],
  })
  const [videoUrlsInput, setVideoUrlsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const writeBasePath = scope === 'admin' ? '/api/admin/experiences' : '/api/seller/experiences'
  const pageTitle = scope === 'admin' ? 'Admin • Experiences' : 'Seller • Experiences'
  const pageSub = scope === 'admin' ? 'Create, update, and remove experiences.' : 'Manage experiences as seller.'

  const sorted = useMemo(() => [...experiences].sort((a, b) => b.id - a.id), [experiences])

  async function load(opts?: { silent?: boolean }) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await apiFetch<Experience[]>('/api/experiences')
      setExperiences(data)
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
      const trimmedName = form.name.trim()
      const trimmedDescription = form.description.trim()
      const trimmedImageUrl = form.imageUrl.trim()
      if (!trimmedName) throw new Error('Name is required')
      if (!trimmedDescription) throw new Error('Description is required')
      if (!trimmedImageUrl) throw new Error('Cover image is required')
      if (!Number.isFinite(Number(form.priceFrom)) || Number(form.priceFrom) < 0) throw new Error('Invalid starting price')

      const payload = {
        ...form,
        name: trimmedName,
        description: trimmedDescription,
        imageUrl: trimmedImageUrl,
        videoUrls: videoUrlsInput.split('\n').map((s) => s.trim()).filter(Boolean),
        priceFrom: Number(form.priceFrom),
      }

      if (editingId) {
        await apiFetch<Experience>(`${writeBasePath}/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch<Experience>(writeBasePath, {
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
          : e instanceof Error
            ? e.message
            : 'Could not save experience'
      setSaveError(message)
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(item: Experience) {
    setForm({
      name: item.name,
      description: item.description,
      priceFrom: Number(item.priceFrom),
      imageUrl: item.imageUrl,
      videoUrls: item.videoUrls || [],
    })
    setVideoUrlsInput(item.videoUrls?.join('\n') || '')
    setEditingId(item.id)
  }

  async function remove(id: number) {
    setBusyId(id)
    try {
      await apiFetch<void>(`${writeBasePath}/${id}`, { method: 'DELETE' })
      setExperiences((p) => p.filter((x) => x.id !== id))
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
            {scope === 'admin' ? (
              <>
                <Link to="/admin/destinations" className="btn">
                  Destinations
                </Link>
                <Link to="/admin/services" className="btn">
                  Services
                </Link>
                <Link to="/admin/experience-requests" className="btn">
                  Experience requests
                </Link>
              </>
            ) : (
              <>
                <Link to="/seller/bookings" className="btn">
                  My bookings
                </Link>
                <Link to="/seller/service-requests" className="btn">
                  My service requests
                </Link>
                <Link to="/seller/experience-requests" className="btn">
                  My experience requests
                </Link>
              </>
            )}
          </div>
          <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
            Reload
          </button>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>{pageTitle}</h2>
            <div className="muted">{pageSub}</div>
          </div>
        </div>

        <div className="card detail-card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>{editingId ? 'Edit experience' : 'Create experience'}</div>

          <div className="row">
            <label className="field" style={{ flex: 1, minWidth: 220 }}>
              <div className="field-label">Name</div>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Da Nang Night Lights"
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
              placeholder="Experience details..."
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
                    priceFrom: 99,
                    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Da_Nang_Dragon_Bridge_(I).jpg?width=1600',
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
                  {sorted.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>
                        <Link to={`/experiences/${item.id}`} style={{ color: 'inherit' }}>
                          {item.name}
                        </Link>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {item.description.slice(0, 120)}
                          {item.description.length > 120 ? '…' : ''}
                        </div>
                      </td>
                      <td>{Number(item.priceFrom)}+</td>
                      <td>
                        <div style={{ fontSize: 12, wordBreak: 'break-all', maxWidth: 200 }}>
                          {item.videoUrls?.map((url, i) => (
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
                          onClick={() => handleEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn danger"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          onClick={() => {
                            if (confirm('Delete this experience?')) void remove(item.id)
                          }}
                          disabled={busyId === item.id}
                        >
                          {busyId === item.id ? '...' : 'Delete'}
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
