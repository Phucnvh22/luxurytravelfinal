import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { User, UserCreateRequest } from '../types'
import './pages.css'

function formatMoney(val: number | undefined) {
  const n = val ?? 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function AdminSellersPage() {
  const [sellers, setSellers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<UserCreateRequest>({
    fullName: '',
    username: '',
    email: '',
    password: '',
    role: 'SELLER',
    commissionRate: 0,
  })

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<User[]>('/api/admin/users/sellers')
      setSellers(data)
    } catch (e: unknown) {
      setError(e instanceof HttpError ? e.message : 'Could not load sellers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const resetForm = () => {
    setForm({
      fullName: '',
      username: '',
      email: '',
      password: '',
      role: 'SELLER',
      commissionRate: 0,
    })
    setIsCreating(false)
    setEditingId(null)
  }

  const handleEdit = (user: User) => {
    setIsCreating(false)
    setEditingId(user.id)
    setForm({
      fullName: user.fullName,
      username: user.username,
      email: user.email || '',
      role: user.role,
      commissionRate: user.commissionRate || 0,
    })
  }

  const handleCreateNew = () => {
    resetForm()
    setIsCreating(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this seller?')) return
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      await load()
    } catch (e: unknown) {
      alert(e instanceof HttpError ? e.message : 'Could not delete seller')
    }
  }

  const handlePay = async (seller: User) => {
    const balance = seller.commissionBalance ?? 0
    if (balance <= 0) return
    if (!confirm(`Pay ${formatMoney(balance)} to ${seller.fullName}?`)) return
    try {
      await apiFetch(`/api/admin/users/sellers/${seller.id}/pay`, { method: 'POST' })
      await load()
    } catch (e: unknown) {
      alert(e instanceof HttpError ? e.message : 'Could not pay seller')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (isCreating) {
        if (!form.password) {
          alert('Please enter a password')
          return
        }
        await apiFetch('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify(form),
        })
      } else if (editingId) {
        const updateData: UserCreateRequest = { ...form }
        delete (updateData as { password?: string }).password
        await apiFetch(`/api/admin/users/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        })
      }
      resetForm()
      await load()
    } catch (e: unknown) {
      alert(e instanceof HttpError ? e.message : 'Could not save changes')
    }
  }

  return (
    <section className="section">
      <div className="container">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <Link to="/" className="btn">← Home</Link>
            <Link to="/admin/destinations" className="btn">Destinations</Link>
            <Link to="/admin/bookings" className="btn">Bookings</Link>
          </div>
          <button className="btn" onClick={() => void load()} disabled={loading}>
            Reload
          </button>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>Admin • Sellers</h2>
            <div className="muted">Manage sales partners and commission rates.</div>
          </div>
          <button className="btn primary" onClick={handleCreateNew}>+ Add seller</button>
        </div>

        {(isCreating || editingId) && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="panel-title">{isCreating ? 'Add new seller' : `Update seller #${editingId}`}</h3>
            <form onSubmit={handleSave}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label className="field">
                  <div className="field-label">Full name</div>
                  <input
                    className="input"
                    value={form.fullName}
                    onChange={(e) => setForm(p => ({ ...p, fullName: e.target.value }))}
                    required
                  />
                </label>
                <label className="field">
                  <div className="field-label">Username</div>
                  <input
                    className="input"
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))}
                    required
                  />
                </label>
                <label className="field">
                  <div className="field-label">Email (Optional)</div>
                  <input
                    className="input"
                    type="email"
                    value={form.email || ''}
                    onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                  />
                </label>
                {isCreating && (
                  <label className="field">
                    <div className="field-label">Password</div>
                    <input
                      className="input"
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                      required={isCreating}
                      minLength={6}
                    />
                  </label>
                )}
                <label className="field">
                  <div className="field-label">Commission rate (%)</div>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    min={0}
                    max={100}
                    value={form.commissionRate}
                    onChange={(e) => setForm(p => ({ ...p, commissionRate: Number(e.target.value) }))}
                    required
                  />
                </label>
              </div>
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn primary" type="submit">Save</button>
                <button className="btn" type="button" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="card detail-card muted">Loading...</div>
        ) : error ? (
          <div className="card error">
            <div className="error-title">Something went wrong</div>
            <div className="muted">{error}</div>
          </div>
        ) : sellers.length === 0 ? (
          <div className="card detail-card muted">No sellers yet.</div>
        ) : (
          <div className="card detail-card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>ID</th>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th style={{ width: 140 }}>Commission (%)</th>
                    <th style={{ width: 140 }}>Balance</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.map((s) => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td>{s.fullName}</td>
                      <td>{s.username}</td>
                      <td>{s.email || '-'}</td>
                      <td>{s.commissionRate || 0}%</td>
                      <td style={{ fontWeight: 600, color: (s.commissionBalance ?? 0) > 0 ? 'var(--color-primary)' : undefined }}>
                        {formatMoney(s.commissionBalance)}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <button
                            className="btn"
                            style={{ padding: '4px 8px', fontSize: 12, borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                            onClick={() => void handlePay(s)}
                            disabled={(s.commissionBalance ?? 0) <= 0}
                          >
                            Pay
                          </button>
                          <button className="btn" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => handleEdit(s)}>
                            Edit
                          </button>
                          <button className="btn" style={{ padding: '4px 8px', fontSize: 12, color: 'var(--color-danger)' }} onClick={() => handleDelete(s.id)}>
                            Delete
                          </button>
                        </div>
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
