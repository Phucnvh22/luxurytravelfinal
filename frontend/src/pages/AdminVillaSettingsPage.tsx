import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch, HttpError } from '../lib/api'
import type { VillaSettingCategory, VillaSettingOption, VillaSettingUpsertRequest, VillaSettingsResponse } from '../types'
import './pages.css'
import './admin-villa-settings.css'

const INITIAL_FORM: VillaSettingUpsertRequest = {
  category: 'ROOM_TYPE',
  label: '',
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    if (error.body?.fields) return Object.values(error.body.fields).join(', ')
    return error.message
  }
  return fallback
}

function getCategoryLabel(category: VillaSettingCategory) {
  if (category === 'ROOM_TYPE') return 'Villa type'
  if (category === 'HOST') return 'Host'
  return 'Booking source'
}

export default function AdminVillaSettingsPage() {
  const [settings, setSettings] = useState<VillaSettingsResponse>({ roomTypes: [], hosts: [], bookingSources: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState<VillaSettingUpsertRequest>(INITIAL_FORM)
  const loadingRef = useRef(false)

  const sections = useMemo(
    () => [
      { category: 'ROOM_TYPE' as const, title: 'Villa types', addLabel: 'Add villa type', items: settings.roomTypes },
      { category: 'HOST' as const, title: 'Hosts', addLabel: 'Add host', items: settings.hosts },
      { category: 'BOOKING_SOURCE' as const, title: 'Booking sources', addLabel: 'Add booking source', items: settings.bookingSources },
    ],
    [settings],
  )

  async function load(opts?: { silent?: boolean }) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await apiFetch<VillaSettingsResponse>('/api/admin/villa-settings')
      setSettings(data)
      setError(null)
    } catch (e: unknown) {
      if (!opts?.silent) setError(getErrorMessage(e, 'Could not load villa settings'))
    } finally {
      if (!opts?.silent) setLoading(false)
      loadingRef.current = false
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function resetForm(category: VillaSettingCategory = form.category) {
    setEditingId(null)
    setForm({
      ...INITIAL_FORM,
      category,
    })
    setSaveError(null)
  }

  function handleEdit(item: VillaSettingOption) {
    setEditingId(item.id)
    setForm({
      category: item.category,
      label: item.label,
    })
    setSaveError(null)
  }

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      const payload: VillaSettingUpsertRequest = {
        category: form.category,
        label: form.label.trim(),
      }

      if (editingId) {
        await apiFetch<VillaSettingOption>(`/api/admin/villa-settings/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch<VillaSettingOption>('/api/admin/villa-settings', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }

      resetForm(form.category)
      await load({ silent: true })
    } catch (e: unknown) {
      setSaveError(getErrorMessage(e, 'Could not save villa settings'))
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: VillaSettingOption) {
    if (!window.confirm(`Delete ${item.label}?`)) return
    setBusyId(item.id)
    try {
      await apiFetch<void>(`/api/admin/villa-settings/${item.id}`, { method: 'DELETE' })
      await load({ silent: true })
      if (editingId === item.id) resetForm(item.category)
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Could not delete villa settings'))
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
            <h2>Admin • Villa Settings</h2>
            <div className="muted">Manage reusable villa types, hosts, and booking sources for admin forms.</div>
          </div>
        </div>

        <div className="admin-villa-settings-layout">
          <div className="card detail-card">
            <div style={{ fontWeight: 800, marginBottom: 12 }}>{editingId ? 'Update setting' : 'Add setting'}</div>
            <div className="admin-villa-settings-form-grid">
              <label className="field">
                <div className="field-label">Category</div>
                <select
                  className="select"
                  value={form.category}
                  onChange={(e) => setForm((current) => ({ ...current, category: e.target.value as VillaSettingCategory }))}
                >
                  <option value="ROOM_TYPE">Villa type</option>
                  <option value="HOST">Host</option>
                  <option value="BOOKING_SOURCE">Booking source</option>
                </select>
              </label>

              <label className="field">
                <div className="field-label">{getCategoryLabel(form.category)}</div>
                <input
                  className="input"
                  value={form.label}
                  onChange={(e) => setForm((current) => ({ ...current, label: e.target.value }))}
                  placeholder={
                    form.category === 'ROOM_TYPE'
                      ? 'Garden View-Villa'
                      : form.category === 'HOST'
                        ? 'Premier Village Danang Resort'
                        : 'Direct'
                  }
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
                {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
              </button>
              <button className="btn" type="button" onClick={() => resetForm()}>
                Reset
              </button>
            </div>
          </div>

          <div className="admin-villa-settings-panels">
            {loading ? (
              <div className="card detail-card muted">Loading villa settings...</div>
            ) : error ? (
              <div className="card error">
                <div className="error-title">Could not load data</div>
                <div className="muted">{error}</div>
              </div>
            ) : (
              sections.map((section) => (
                <div key={section.category} className="card detail-card">
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontWeight: 800 }}>{section.title}</div>
                    <button className="btn" type="button" onClick={() => resetForm(section.category)}>
                      {section.addLabel}
                    </button>
                  </div>

                  {section.items.length === 0 ? (
                    <div className="muted">No data available in this section.</div>
                  ) : (
                    <div className="table-wrap admin-villa-settings-table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>{section.title}</th>
                            <th style={{ width: 220 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.items.map((item) => (
                            <tr key={item.id}>
                              <td style={{ fontWeight: 700 }}>{item.label}</td>
                              <td>
                                <div className="row" style={{ gap: 8 }}>
                                  <button className="btn" type="button" onClick={() => handleEdit(item)}>
                                    Edit
                                  </button>
                                  <button className="btn danger" type="button" onClick={() => void remove(item)} disabled={busyId === item.id}>
                                    {busyId === item.id ? '...' : 'Delete'}
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
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
