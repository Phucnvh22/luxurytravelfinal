import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { Room, User } from '../types'
import './pages.css'
import './admin-cleaner-assignments.css'

type CleanerOption = User & { role: 'CLEANER' }

export default function AdminCleanerAssignmentsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [cleaners, setCleaners] = useState<CleanerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingRoomId, setSavingRoomId] = useState<number | null>(null)
  const [filterCleanerId, setFilterCleanerId] = useState<string>('ALL')
  const loadingRef = useRef(false)

  async function load(opts?: { silent?: boolean }) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const [roomsData, cleanersData] = await Promise.all([
        apiFetch<Room[]>('/api/admin/rooms'),
        apiFetch<CleanerOption[]>('/api/admin/users/cleaners'),
      ])
      setRooms(roomsData)
      setCleaners(cleanersData)
      setError(null)
    } catch (e: unknown) {
      if (!opts?.silent) {
        setError(e instanceof HttpError ? e.message : 'Could not load cleaner assignments')
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
      if (savingRoomId) return
      void load({ silent: true })
    }
    const intervalId = window.setInterval(tick, 5000)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', tick)
    }
  }, [savingRoomId])

  const cleanerMap = useMemo(() => new Map(cleaners.map((cleaner) => [cleaner.id, cleaner])), [cleaners])

  const assignmentCards = useMemo(() => {
    const counts = new Map<number, number>()
    for (const room of rooms) {
      if (!room.assignedCleanerId) continue
      counts.set(room.assignedCleanerId, (counts.get(room.assignedCleanerId) ?? 0) + 1)
    }
    return cleaners.map((cleaner) => ({
      cleaner,
      count: counts.get(cleaner.id) ?? 0,
    }))
  }, [cleaners, rooms])

  const visibleRooms = useMemo(() => {
    if (filterCleanerId === 'ALL') return rooms
    if (filterCleanerId === 'UNASSIGNED') {
      return rooms.filter((room) => !room.assignedCleanerId)
    }
    const cleanerId = Number(filterCleanerId)
    return rooms.filter((room) => room.assignedCleanerId === cleanerId)
  }, [filterCleanerId, rooms])

  async function assignCleaner(roomId: number, cleanerIdValue: string) {
    setSavingRoomId(roomId)
    try {
      const payload = {
        cleanerId: cleanerIdValue ? Number(cleanerIdValue) : null,
      }
      await apiFetch<Room>(`/api/admin/rooms/${roomId}/assign-cleaner`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      await load({ silent: true })
    } catch (e: unknown) {
      alert(e instanceof HttpError ? e.message : 'Could not update cleaner assignment')
    } finally {
      setSavingRoomId(null)
    }
  }

  return (
    <section className="section">
      <div className="container">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <Link to="/" className="btn">← Home</Link>
            <Link to="/admin/rooms" className="btn">Rooms</Link>
            <Link to="/admin/users" className="btn">Users</Link>
          </div>
          <button className="btn" onClick={() => void load()} disabled={loading}>
            Reload
          </button>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>Admin • Cleaner Assignments</h2>
            <div className="muted">Assign each villa to the cleaner who is responsible for checkout cleaning.</div>
          </div>
        </div>

        <div className="cleaner-assignment-summary">
          <article className="card cleaner-assignment-stat">
            <div className="cleaner-assignment-stat-label">Total villas</div>
            <div className="cleaner-assignment-stat-value">{rooms.length}</div>
          </article>
          <article className="card cleaner-assignment-stat">
            <div className="cleaner-assignment-stat-label">Cleaners</div>
            <div className="cleaner-assignment-stat-value">{cleaners.length}</div>
          </article>
          <article className="card cleaner-assignment-stat">
            <div className="cleaner-assignment-stat-label">Unassigned villas</div>
            <div className="cleaner-assignment-stat-value">{rooms.filter((room) => !room.assignedCleanerId).length}</div>
          </article>
        </div>

        <div className="cleaner-assignment-cards">
          {assignmentCards.map(({ cleaner, count }) => (
            <button
              key={cleaner.id}
              type="button"
              className={`card cleaner-assignment-card ${filterCleanerId === String(cleaner.id) ? 'active' : ''}`}
              onClick={() => setFilterCleanerId((current) => current === String(cleaner.id) ? 'ALL' : String(cleaner.id))}
            >
              <div className="cleaner-assignment-card-name">{cleaner.fullName}</div>
              <div className="cleaner-assignment-card-username">@{cleaner.username}</div>
              <div className="cleaner-assignment-card-count">{count} villas assigned</div>
            </button>
          ))}
          <button
            type="button"
            className={`card cleaner-assignment-card ghost ${filterCleanerId === 'UNASSIGNED' ? 'active' : ''}`}
            onClick={() => setFilterCleanerId((current) => current === 'UNASSIGNED' ? 'ALL' : 'UNASSIGNED')}
          >
            <div className="cleaner-assignment-card-name">Unassigned</div>
            <div className="cleaner-assignment-card-username">Villa not linked yet</div>
            <div className="cleaner-assignment-card-count">{rooms.filter((room) => !room.assignedCleanerId).length} villas</div>
          </button>
        </div>

        <div className="row" style={{ justifyContent: 'space-between', margin: '10px 0 14px' }}>
          <label className="field" style={{ marginTop: 0, minWidth: 260 }}>
            <div className="field-label">Filter</div>
            <select className="select" value={filterCleanerId} onChange={(e) => setFilterCleanerId(e.target.value)}>
              <option value="ALL">All villas</option>
              <option value="UNASSIGNED">Unassigned villas</option>
              {cleaners.map((cleaner) => (
                <option key={cleaner.id} value={String(cleaner.id)}>
                  {cleaner.fullName} (@{cleaner.username})
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="card detail-card muted">Loading cleaner assignments...</div>
        ) : error ? (
          <div className="card error">
            <div className="error-title">Something went wrong</div>
            <div className="muted">{error}</div>
          </div>
        ) : cleaners.length === 0 ? (
          <div className="card detail-card muted">No cleaner account yet. Create a user with role CLEANER first.</div>
        ) : visibleRooms.length === 0 ? (
          <div className="card detail-card muted">No villas match this filter.</div>
        ) : (
          <div className="card detail-card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Code</th>
                    <th>Villa</th>
                    <th>Location</th>
                    <th style={{ width: 140 }}>Status</th>
                    <th style={{ width: 280 }}>Assigned cleaner</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRooms.map((room) => {
                    const assignedCleaner = room.assignedCleanerId ? cleanerMap.get(room.assignedCleanerId) : null
                    return (
                      <tr key={room.id}>
                        <td>{room.code}</td>
                        <td>
                          <div className="cleaner-assignment-villa-name">{room.name}</div>
                          <div className="muted">{room.type}</div>
                        </td>
                        <td>{room.location || '-'}</td>
                        <td>{room.operationalStatus || 'READY'}</td>
                        <td>
                          <label className="field" style={{ marginTop: 0 }}>
                            <select
                              className="select"
                              value={room.assignedCleanerId ?? ''}
                              onChange={(e) => void assignCleaner(room.id, e.target.value)}
                              disabled={savingRoomId === room.id}
                            >
                              <option value="">Unassigned</option>
                              {cleaners.map((cleaner) => (
                                <option key={cleaner.id} value={cleaner.id}>
                                  {cleaner.fullName} (@{cleaner.username})
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="muted cleaner-assignment-inline-note">
                            {assignedCleaner ? `Current: ${assignedCleaner.fullName}` : 'No cleaner assigned'}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
