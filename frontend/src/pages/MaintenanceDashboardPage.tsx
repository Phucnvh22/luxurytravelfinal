import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch, HttpError } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import RoomWorkHistoryList from '../components/RoomWorkHistoryList'
import type { Room, RoomWorkLog } from '../types'
import './cleaner-dashboard.css'

function formatDateTime(value?: string) {
  if (!value) return 'Not available'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
}

export default function MaintenanceDashboardPage() {
  const { user, logout } = useAuth()
  const [rooms, setRooms] = useState<Room[]>([])
  const [historyLogs, setHistoryLogs] = useState<RoomWorkLog[]>([])
  const [historyRoomCode, setHistoryRoomCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [finishingId, setFinishingId] = useState<number | null>(null)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [activeView, setActiveView] = useState<'tasks' | 'history'>('tasks')
  const loadRef = useRef(false)
  const previousCountRef = useRef<number | null>(null)

  async function load(opts?: { silent?: boolean }) {
    if (loadRef.current) return
    loadRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const logParams = new URLSearchParams()
      if (historyRoomCode) {
        logParams.set('roomCode', historyRoomCode)
      }
      const [roomsData, logsData] = await Promise.all([
        apiFetch<Room[]>('/api/maintenance/rooms'),
        apiFetch<RoomWorkLog[]>(`/api/maintenance/room-work-logs${logParams.size > 0 ? `?${logParams.toString()}` : ''}`),
      ])
      setRooms(roomsData)
      setHistoryLogs(logsData)
      setError(null)

      const currentCount = roomsData.length
      const previousCount = previousCountRef.current
      if (currentCount > 0 && (previousCount === null || currentCount > previousCount)) {
        setNotificationOpen(true)
      }
      previousCountRef.current = currentCount
    } catch (e: unknown) {
      if (!opts?.silent) {
        setError(e instanceof HttpError ? e.message : 'Could not load repair tasks')
      }
    } finally {
      if (!opts?.silent) setLoading(false)
      loadRef.current = false
    }
  }

  useEffect(() => {
    void load()
    const intervalId = window.setInterval(() => void load({ silent: true }), 10000)
    const onFocus = () => void load({ silent: true })
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
    }
  }, [historyRoomCode])

  const pendingCount = rooms.length
  const summaryText = useMemo(() => {
    if (pendingCount === 0) return 'Hiện chưa có phòng nào cần sửa chữa.'
    if (pendingCount === 1) return 'Có 1 phòng đang chờ sửa chữa.'
    return `Có ${pendingCount} phòng đang chờ sửa chữa.`
  }, [pendingCount])
  const historyRoomOptions = useMemo(() => {
    const roomMap = new Map(rooms.map((room) => [room.code, room]))
    return [...roomMap.values()].sort((a, b) => a.code.localeCompare(b.code, 'vi-VN', { numeric: true }))
  }, [rooms])

  const handleDone = async (room: Room) => {
    setFinishingId(room.id)
    setError(null)
    try {
      await apiFetch<Room>(`/api/maintenance/rooms/${room.id}/done`, {
        method: 'POST',
      })
      await load({ silent: true })
    } catch (e: unknown) {
      setError(e instanceof HttpError ? e.message : 'Could not mark repair as completed')
    } finally {
      setFinishingId(null)
    }
  }

  return (
    <main className="cleaner-shell">
      <section className="cleaner-panel">
        <div className="cleaner-header">
          <div>
            <div className="cleaner-kicker">Maintenance Workspace</div>
            <h1>Repair tasks</h1>
            <p>{summaryText}</p>
          </div>
          <div className="cleaner-header-actions">
            <div className="cleaner-user-chip">{user?.fullName || user?.username}</div>
            <button className="btn" type="button" onClick={() => void load()} disabled={loading || finishingId !== null}>
              Reload
            </button>
            <button className="btn" type="button" onClick={logout}>
              Log out
            </button>
          </div>
        </div>

        <div className="cleaner-view-switch">
          <button
            className={`btn cleaner-view-chip ${activeView === 'tasks' ? 'active' : ''}`}
            type="button"
            onClick={() => setActiveView('tasks')}
          >
            Pending tasks
          </button>
          <button
            className={`btn cleaner-view-chip ${activeView === 'history' ? 'active' : ''}`}
            type="button"
            onClick={() => setActiveView('history')}
          >
            My history
          </button>
        </div>

        {error ? <div className="card error cleaner-alert">{error}</div> : null}

        {loading ? (
          <div className="cleaner-empty-state">
            <h2>Loading tasks...</h2>
            <p>Mình đang kiểm tra các phòng đã được báo hư hỏng.</p>
          </div>
        ) : activeView === 'history' ? (
          <>
            <div className="work-history-filters">
              <label className="field">
                <div className="field-label">Villa</div>
                <select className="select" value={historyRoomCode} onChange={(e) => setHistoryRoomCode(e.target.value)}>
                  <option value="">All villas</option>
                  {historyRoomOptions.map((room) => (
                    <option key={room.id} value={room.code}>
                      {room.code} • {room.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <RoomWorkHistoryList
              logs={historyLogs}
              showActor={false}
              emptyTitle="Chưa có lịch sử công việc"
              emptyMessage="Những lần bạn hoàn tất sửa chữa sẽ hiện ở đây."
            />
          </>
        ) : pendingCount === 0 ? (
          <div className="cleaner-empty-state">
            <h2>All clear</h2>
            <p>Chưa có phòng nào cần sửa lúc này. Trang sẽ tự cập nhật khi admin hoặc cleaner báo hư hỏng mới.</p>
          </div>
        ) : (
          <div className="cleaner-grid">
            {rooms.map((room) => (
              <article key={room.id} className="cleaner-task-card">
                <div className="cleaner-task-top">
                  <div>
                    <div className="cleaner-room-code">{room.code}</div>
                    <h2>{room.name}</h2>
                  </div>
                  <span className="cleaner-status-pill cleaner-status-pill--repair">Needs repair</span>
                </div>

                <div className="cleaner-task-meta">
                  <div>
                    <span>Location</span>
                    <strong>{room.location || 'Not set'}</strong>
                  </div>
                  <div>
                    <span>Host</span>
                    <strong>{room.host || 'Not assigned'}</strong>
                  </div>
                  <div>
                    <span>Reported at</span>
                    <strong>{formatDateTime(room.repairReportedAt)}</strong>
                  </div>
                  <div>
                    <span>Reported by</span>
                    <strong>{room.repairReportedByName || room.repairReportedByUsername || 'Unknown'}</strong>
                  </div>
                  <div>
                    <span>Door password</span>
                    <strong>{room.doorPassword || 'Not set'}</strong>
                  </div>
                  <div>
                    <span>Cleaning status</span>
                    <strong>{room.operationalStatus === 'NEEDS_CLEANING' ? 'Needs cleaning' : room.operationalStatus === 'CHECKED_IN' ? 'Checked in' : 'Ready'}</strong>
                  </div>
                </div>

                <div className="cleaner-repair-box">
                  <span>Repair detail</span>
                  <strong>{room.repairDetails || 'No detail yet'}</strong>
                </div>

                {room.notes ? (
                  <div className="cleaner-notes">
                    <span>Room notes</span>
                    <strong>{room.notes}</strong>
                  </div>
                ) : null}

                <button
                  className="btn primary cleaner-done-btn"
                  type="button"
                  onClick={() => void handleDone(room)}
                  disabled={finishingId === room.id}
                  style={{ marginTop: 18 }}
                >
                  {finishingId === room.id ? 'Saving...' : 'Done repair'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {notificationOpen && pendingCount > 0 ? (
        <div className="cleaner-notification-backdrop" role="presentation" onClick={() => setNotificationOpen(false)}>
          <div
            className="cleaner-notification-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Repair notification"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cleaner-kicker">New repair alert</div>
            <h2>{pendingCount === 1 ? 'Có 1 phòng cần sửa ngay.' : `Có ${pendingCount} phòng cần sửa ngay.`}</h2>
            <p>Chi tiết hư hỏng đã hiện sẵn trong danh sách bên dưới để người sửa chữa xử lý ngay.</p>
            <button className="btn primary" type="button" onClick={() => setNotificationOpen(false)}>
              View tasks
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}
