import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { User, UserCreateRequest } from '../types'
import './pages.css'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)

  const [roleFilter, setRoleFilter] = useState<'ALL' | User['role']>('ALL')
  const filteredUsers = useMemo(() => {
    if (roleFilter === 'ALL') return users
    return users.filter((u) => u.role === roleFilter)
  }, [roleFilter, users])

  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<UserCreateRequest>({
    fullName: '',
    username: '',
    email: '',
    password: '',
    role: 'USER',
    commissionRate: 0,
  })

  async function load(opts?: { silent?: boolean }) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await apiFetch<User[]>('/api/admin/users')
      setUsers(data)
      setError(null)
    } catch (e: unknown) {
      if (!opts?.silent) {
        setError(e instanceof HttpError ? e.message : 'Could not load users')
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
      if (isCreating || editingId) return
      void load({ silent: true })
    }
    const intervalId = window.setInterval(tick, 5000)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', tick)
    }
  }, [isCreating, editingId])

  const resetForm = () => {
    setForm({
      fullName: '',
      username: '',
      email: '',
      password: '',
      role: 'USER',
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
    if (!confirm('Delete this user?')) return
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      await load()
    } catch (e: unknown) {
      alert(e instanceof HttpError ? e.message : 'Could not delete user')
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

  const showCommission = form.role === 'SELLER'

  return (
    <section className="section">
      <div className="container">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <Link to="/" className="btn">← Home</Link>
            <Link to="/admin/destinations" className="btn">Destinations</Link>
            <Link to="/admin/bookings" className="btn">Bookings</Link>
            <Link to="/admin/sellers" className="btn">Sellers</Link>
          </div>
          <button className="btn" onClick={() => void load()} disabled={loading}>
            Reload
          </button>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>Admin • Users</h2>
            <div className="muted">Manage users and roles. Google logins will show email if available.</div>
          </div>
          <button className="btn primary" onClick={handleCreateNew}>+ Add user</button>
        </div>

        <div className="row" style={{ justifyContent: 'space-between', margin: '10px 0 14px' }}>
          <label className="field" style={{ marginTop: 0, minWidth: 220 }}>
            <div className="field-label">Filter by role</div>
            <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}>
              <option value="ALL">All</option>
              <option value="USER">User</option>
              <option value="SELLER">Seller</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
        </div>

        {(isCreating || editingId) && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="panel-title">{isCreating ? 'Add new user' : `Update user #${editingId}`}</h3>
            <form onSubmit={handleSave}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label className="field">
                  <div className="field-label">Full name</div>
                  <input
                    className="input"
                    value={form.fullName}
                    onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                    required
                  />
                </label>
                <label className="field">
                  <div className="field-label">Username</div>
                  <input
                    className="input"
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    required
                  />
                </label>
                <label className="field">
                  <div className="field-label">Email (Optional)</div>
                  <input
                    className="input"
                    type="email"
                    value={form.email || ''}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </label>
                {isCreating && (
                  <label className="field">
                    <div className="field-label">Password</div>
                    <input
                      className="input"
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      required={isCreating}
                      minLength={6}
                    />
                  </label>
                )}
                <label className="field">
                  <div className="field-label">Role</div>
                  <select
                    className="select"
                    value={form.role}
                    onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as User['role'] }))}
                  >
                    <option value="USER">USER</option>
                    <option value="SELLER">SELLER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </label>
                {showCommission ? (
                  <label className="field">
                    <div className="field-label">Commission rate (%)</div>
                    <input
                      className="input"
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      value={form.commissionRate}
                      onChange={(e) => setForm((p) => ({ ...p, commissionRate: Number(e.target.value) }))}
                      required={showCommission}
                    />
                  </label>
                ) : (
                  <div />
                )}
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
        ) : filteredUsers.length === 0 ? (
          <div className="card detail-card muted">No users.</div>
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
                    <th style={{ width: 110 }}>Role</th>
                    <th style={{ width: 170 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.fullName}</td>
                      <td>{u.username}</td>
                      <td>{u.email || '-'}</td>
                      <td>{u.role}</td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <button className="btn" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => handleEdit(u)}>
                            Edit
                          </button>
                          <button className="btn" style={{ padding: '4px 8px', fontSize: 12, color: 'var(--color-danger)' }} onClick={() => handleDelete(u.id)}>
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

