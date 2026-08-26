import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { Room, RoomWorkLog } from '../types'
import '../pages/pages.css'
import '../pages/cleaner-dashboard.css'
import '../pages/admin-room-work-history.css'

type HistoryMode = 'cleaning' | 'repair'

type GroupedRoomHistory = {
  roomCode: string
  roomName: string
  latestActivityAt?: string
  latestCleaning?: RoomWorkLog
  latestRepairReported?: RoomWorkLog
  latestRepairResolved?: RoomWorkLog
  logs: RoomWorkLog[]
}

function formatDateTime(value?: string) {
  if (!value) return 'Not available'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
}

function toMillis(value?: string) {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function pickLatest(current: RoomWorkLog | undefined, next: RoomWorkLog) {
  if (!current) return next
  return toMillis(next.occurredAt) > toMillis(current.occurredAt) ? next : current
}

function matchesMode(log: RoomWorkLog, mode: HistoryMode) {
  if (mode === 'cleaning') return log.action === 'CLEANING_COMPLETED'
  return log.action === 'REPAIR_REPORTED' || log.action === 'REPAIR_RESOLVED'
}

function buildGroupedHistory(logs: RoomWorkLog[], mode: HistoryMode) {
  const grouped = new Map<string, GroupedRoomHistory>()

  for (const log of logs) {
    if (!matchesMode(log, mode)) continue

    const current = grouped.get(log.roomCode) ?? {
      roomCode: log.roomCode,
      roomName: log.roomName,
      logs: [],
    }

    current.roomName = log.roomName || current.roomName
    if (!current.latestActivityAt || toMillis(log.occurredAt) > toMillis(current.latestActivityAt)) {
      current.latestActivityAt = log.occurredAt
    }

    if (log.action === 'CLEANING_COMPLETED') {
      current.latestCleaning = pickLatest(current.latestCleaning, log)
    }
    if (log.action === 'REPAIR_REPORTED') {
      current.latestRepairReported = pickLatest(current.latestRepairReported, log)
    }
    if (log.action === 'REPAIR_RESOLVED') {
      current.latestRepairResolved = pickLatest(current.latestRepairResolved, log)
    }

    current.logs.push(log)
    grouped.set(log.roomCode, current)
  }

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      logs: [...item.logs].sort((a, b) => toMillis(b.occurredAt) - toMillis(a.occurredAt)),
    }))
    .sort((a, b) => toMillis(b.latestActivityAt) - toMillis(a.latestActivityAt))
}

function renderActor(log?: RoomWorkLog) {
  if (!log) return 'Not available'
  return `${log.actorName || log.actorUsername} (${log.actorRole})`
}

function getActionLabel(log: RoomWorkLog) {
  if (log.action === 'CLEANING_COMPLETED') return 'Cleaning done'
  if (log.action === 'REPAIR_REPORTED') return 'Repair reported'
  if (log.action === 'REPAIR_RESOLVED') return 'Repair done'
  return log.action
}

export default function AdminRoomWorkHistoryBoard({
  mode,
  title,
  description,
}: {
  mode: HistoryMode
  title: string
  description: string
}) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [logs, setLogs] = useState<RoomWorkLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [historyView, setHistoryView] = useState<'all' | 'mine'>('all')
  const [historyRoomCode, setHistoryRoomCode] = useState('')
  const [historyActorUsername, setHistoryActorUsername] = useState('')
  const loadingRef = useRef(false)

  async function load(opts?: { silent?: boolean }) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const logParams = new URLSearchParams()
      logParams.set('mineOnly', String(historyView === 'mine'))
      if (historyRoomCode) {
        logParams.set('roomCode', historyRoomCode)
      }
      if (historyView === 'all' && historyActorUsername.trim()) {
        logParams.set('actorUsername', historyActorUsername.trim())
      }

      const [roomsData, logsData] = await Promise.all([
        apiFetch<Room[]>('/api/admin/rooms'),
        apiFetch<RoomWorkLog[]>(`/api/admin/room-work-logs?${logParams.toString()}`),
      ])
      setRooms(roomsData)
      setLogs(logsData)
      setError(null)
    } catch (e: unknown) {
      if (!opts?.silent) {
        setError(e instanceof HttpError ? e.message : 'Could not load room work history')
      }
    } finally {
      if (!opts?.silent) setLoading(false)
      loadingRef.current = false
    }
  }

  useEffect(() => {
    void load()
  }, [historyActorUsername, historyRoomCode, historyView])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      void load({ silent: true })
    }
    const intervalId = window.setInterval(tick, 8000)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', tick)
    }
  }, [historyActorUsername, historyRoomCode, historyView])

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      return (
        a.location.localeCompare(b.location, 'vi-VN', { sensitivity: 'base' }) ||
        a.floorNumber - b.floorNumber ||
        a.code.localeCompare(b.code, 'vi-VN', { numeric: true })
      )
    })
  }, [rooms])

  const actorOptions = useMemo(() => {
    return [...new Set(logs.map((log) => log.actorUsername).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'vi-VN', { sensitivity: 'base' }),
    )
  }, [logs])

  const groupedHistory = useMemo(() => buildGroupedHistory(logs, mode), [logs, mode])

  return (
    <section className="section">
      <div className="container">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <Link to="/" className="btn">← Home</Link>
            <Link to="/admin/rooms" className="btn">Rooms</Link>
            <Link to="/admin/room-bookings" className="btn">Villa calendar</Link>
          </div>
          <button className="btn" onClick={() => void load()} disabled={loading}>
            Reload
          </button>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>{title}</h2>
            <div className="muted">{description}</div>
          </div>
        </div>

        <div className="admin-room-history-toolbar card">
          <div className="admin-room-history-head">
            <div className="admin-room-history-intro">
              <div className="admin-room-history-title">History scope</div>
              <div className="admin-room-history-subtitle muted">
                {historyView === 'all'
                  ? 'Xem toàn bộ lịch sử theo bộ lọc hiện tại.'
                  : 'Chỉ xem lịch sử do chính tài khoản admin này thực hiện.'}
              </div>
            </div>
            <div className="admin-room-history-switch">
              <button
                className={`btn admin-room-history-chip ${historyView === 'all' ? 'active' : ''}`}
                type="button"
                onClick={() => setHistoryView('all')}
              >
                All history
              </button>
              <button
                className={`btn admin-room-history-chip ${historyView === 'mine' ? 'active' : ''}`}
                type="button"
                onClick={() => setHistoryView('mine')}
              >
                My actions
              </button>
            </div>
          </div>

          <div className="work-history-filters">
            <label className="field admin-room-history-field">
              <div className="field-label">Villa</div>
              <select className="select" value={historyRoomCode} onChange={(e) => setHistoryRoomCode(e.target.value)}>
                <option value="">All villas</option>
                {sortedRooms.map((room) => (
                  <option key={room.id} value={room.code}>
                    {room.code} • {room.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field admin-room-history-field">
              <div className="field-label">Person</div>
              <input
                className="input"
                list={`admin-room-history-actors-${mode}`}
                value={historyActorUsername}
                onChange={(e) => setHistoryActorUsername(e.target.value)}
                placeholder="Username"
                disabled={historyView === 'mine'}
              />
              <datalist id={`admin-room-history-actors-${mode}`}>
                {actorOptions.map((username) => (
                  <option key={username} value={username} />
                ))}
              </datalist>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="card detail-card muted">Loading room work history...</div>
        ) : error ? (
          <div className="card error">
            <div className="error-title">Could not load room work history</div>
            <div className="muted">{error}</div>
          </div>
        ) : groupedHistory.length === 0 ? (
          <div className="cleaner-empty-state">
            <h2>Chưa có lịch sử công việc</h2>
            <p>Chưa có dữ liệu phù hợp với màn hình và bộ lọc hiện tại.</p>
          </div>
        ) : (
          <div className="admin-room-history-grid">
            {groupedHistory.map((item) => {
              const repairOpen =
                !!item.latestRepairReported &&
                (!item.latestRepairResolved ||
                  toMillis(item.latestRepairReported.occurredAt) > toMillis(item.latestRepairResolved.occurredAt))

              return (
                <article key={item.roomCode} className="work-history-card admin-room-history-card-grouped">
                  <div className="work-history-top">
                    <div>
                      <div className="cleaner-room-code">{item.roomCode}</div>
                      <h3>{item.roomName}</h3>
                    </div>
                    <div className="admin-room-history-badges">
                      {mode === 'cleaning' ? (
                        <span className="work-history-badge cleaning">Cleaning</span>
                      ) : item.latestRepairReported ? (
                        <span className={`work-history-badge ${repairOpen ? 'reported' : 'resolved'}`}>
                          {repairOpen ? 'Repair open' : 'Repair done'}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {mode === 'cleaning' ? (
                    <>
                      <div className="work-history-meta">
                        <div>
                          <span>Latest activity</span>
                          <strong>{formatDateTime(item.latestActivityAt)}</strong>
                        </div>
                        <div>
                          <span>Last cleaning</span>
                          <strong>{formatDateTime(item.latestCleaning?.occurredAt)}</strong>
                        </div>
                        <div>
                          <span>Cleaner</span>
                          <strong>{renderActor(item.latestCleaning)}</strong>
                        </div>
                        <div>
                          <span>Total logs</span>
                          <strong>{item.logs.length}</strong>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="work-history-meta">
                        <div>
                          <span>Latest activity</span>
                          <strong>{formatDateTime(item.latestActivityAt)}</strong>
                        </div>
                        <div>
                          <span>Repair reported</span>
                          <strong>{formatDateTime(item.latestRepairReported?.occurredAt)}</strong>
                        </div>
                        <div>
                          <span>Repair done</span>
                          <strong>{formatDateTime(item.latestRepairResolved?.occurredAt)}</strong>
                        </div>
                        <div>
                          <span>Status</span>
                          <strong>{repairOpen ? 'Open repair' : 'Resolved'}</strong>
                        </div>
                      </div>

                      <div className="admin-room-history-sections">
                        <div className="cleaner-repair-box">
                          <span>Repair reported by</span>
                          <strong>{renderActor(item.latestRepairReported)}</strong>
                        </div>
                        <div className="cleaner-repair-box">
                          <span>Repair done by</span>
                          <strong>{renderActor(item.latestRepairResolved)}</strong>
                        </div>
                        <div className="cleaner-repair-box admin-room-history-span-2">
                          <span>Repair detail</span>
                          <strong>{item.latestRepairReported?.details || 'No repair detail'}</strong>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="admin-room-history-timeline">
                    <div className="admin-room-history-timeline-title">Timeline</div>
                    <div className="admin-room-history-timeline-list">
                      {item.logs.map((log) => (
                        <div key={log.id} className="admin-room-history-timeline-item">
                          <div className="admin-room-history-timeline-top">
                            <strong>{getActionLabel(log)}</strong>
                            <span>{formatDateTime(log.occurredAt)}</span>
                          </div>
                          <div className="muted">
                            {log.actorName || log.actorUsername} ({log.actorRole})
                          </div>
                          {log.details ? <div className="muted">{log.details}</div> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
