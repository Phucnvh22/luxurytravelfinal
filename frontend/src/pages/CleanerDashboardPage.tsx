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

export default function CleanerDashboardPage() {
  const { user, logout } = useAuth()
  const [rooms, setRooms] = useState<Room[]>([])
  const [historyLogs, setHistoryLogs] = useState<RoomWorkLog[]>([])
  const [historyRoomCode, setHistoryRoomCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<number | null>(null)
  const [reportingId, setReportingId] = useState<number | null>(null)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [repairRoom, setRepairRoom] = useState<Room | null>(null)
  const [repairDetails, setRepairDetails] = useState('')
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
        apiFetch<Room[]>('/api/cleaner/rooms'),
        apiFetch<RoomWorkLog[]>(`/api/cleaner/room-work-logs${logParams.size > 0 ? `?${logParams.toString()}` : ''}`),
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
        setError(e instanceof HttpError ? e.message : 'Could not load cleaning tasks')
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
    if (pendingCount === 0) return 'Hiện chưa có villa nào được phân công đang cần dọn.'
    if (pendingCount === 1) return 'Có 1 villa được phân công đang chờ dọn.'
    return `Có ${pendingCount} villa được phân công đang chờ dọn.`
  }, [pendingCount])
  const historyRoomOptions = useMemo(() => {
    const roomMap = new Map(rooms.map((room) => [room.code, room]))
    return [...roomMap.values()].sort((a, b) => a.code.localeCompare(b.code, 'vi-VN', { numeric: true }))
  }, [rooms])

  const handleDone = async (room: Room) => {
    setCompletingId(room.id)
    setError(null)
    try {
      await apiFetch<Room>(`/api/cleaner/rooms/${room.id}/done`, {
        method: 'POST',
      })
      await load({ silent: true })
    } catch (e: unknown) {
      setError(e instanceof HttpError ? e.message : 'Could not mark room as cleaned')
    } finally {
      setCompletingId(null)
    }
  }

  const openRepairModal = (room: Room) => {
    setRepairRoom(room)
    setRepairDetails(room.repairNeeded ? room.repairDetails || '' : '')
  }

  const closeRepairModal = () => {
    setRepairRoom(null)
    setRepairDetails('')
  }

  const handleReportRepair = async () => {
    if (!repairRoom) return
    setReportingId(repairRoom.id)
    setError(null)
    try {
      await apiFetch<Room>(`/api/cleaner/rooms/${repairRoom.id}/report-repair`, {
        method: 'POST',
        body: JSON.stringify({ details: repairDetails }),
      })
      closeRepairModal()
      await load({ silent: true })
    } catch (e: unknown) {
      setError(e instanceof HttpError ? e.message : 'Could not report repair issue')
    } finally {
      setReportingId(null)
    }
  }

  return (
    <main className="cleaner-shell">
      <section className="cleaner-panel">
        <div className="cleaner-header">
          <div>
            <div className="cleaner-kicker">Cleaner Workspace</div>
            <h1>Cleaning tasks</h1>
            <p>{summaryText}</p>
          </div>
          <div className="cleaner-header-actions">
            <div className="cleaner-user-chip">{user?.fullName || user?.username}</div>
            <button className="btn" type="button" onClick={() => void load()} disabled={loading || completingId !== null}>
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
            <p>Mình đang kiểm tra các phòng vừa checkout.</p>
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
              emptyMessage="Các việc bạn đã làm như dọn phòng hoặc báo hư hỏng sẽ hiện ở đây."
            />
          </>
        ) : pendingCount === 0 ? (
          <div className="cleaner-empty-state">
            <h2>All clear</h2>
            <p>Chưa có villa nào được giao cho bạn đang cần dọn lúc này. Trang sẽ tự cập nhật khi có checkout mới.</p>
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
                  <div className="cleaner-status-stack">
                    <span className="cleaner-status-pill">Needs cleaning</span>
                    {room.repairNeeded ? <span className="cleaner-status-pill cleaner-status-pill--repair">Needs repair</span> : null}
                  </div>
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
                    <span>Requested at</span>
                    <strong>{formatDateTime(room.cleaningRequestedAt)}</strong>
                  </div>
                  <div>
                    <span>Door password</span>
                    <strong>{room.doorPassword || 'Not set'}</strong>
                  </div>
                </div>

                {room.notes ? (
                  <div className="cleaner-notes">
                    <span>Notes</span>
                    <strong>{room.notes}</strong>
                  </div>
                ) : null}

                {room.repairNeeded ? (
                  <div className="cleaner-repair-box">
                    <span>Repair detail</span>
                    <strong>{room.repairDetails || 'No detail yet'}</strong>
                    <div className="cleaner-repair-meta">
                      Reported {formatDateTime(room.repairReportedAt)} by {room.repairReportedByName || room.repairReportedByUsername || 'Unknown'}
                    </div>
                  </div>
                ) : null}

                <div className="cleaner-action-row">
                  <button
                    className="btn cleaner-secondary-btn"
                    type="button"
                    onClick={() => openRepairModal(room)}
                    disabled={completingId === room.id || reportingId === room.id}
                  >
                    {room.repairNeeded ? 'Update repair' : 'Report damage'}
                  </button>
                  <button
                    className="btn primary cleaner-done-btn"
                    type="button"
                    onClick={() => void handleDone(room)}
                    disabled={completingId === room.id || reportingId === room.id}
                  >
                    {completingId === room.id ? 'Saving...' : 'Done cleaning'}
                  </button>
                </div>
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
            aria-label="Cleaning notification"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cleaner-kicker">New cleaning alert</div>
            <h2>{pendingCount === 1 ? 'Có 1 phòng cần dọn ngay.' : `Có ${pendingCount} phòng cần dọn ngay.`}</h2>
            <p>Cleaner đăng nhập vào sẽ thấy ngay danh sách việc cần xử lý. Bấm Done sau khi dọn xong để admin nhận trạng thái mới.</p>
            <button className="btn primary" type="button" onClick={() => setNotificationOpen(false)}>
              View tasks
            </button>
          </div>
        </div>
      ) : null}

      {repairRoom ? (
        <div className="cleaner-notification-backdrop" role="presentation" onClick={closeRepairModal}>
          <div
            className="cleaner-notification-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Repair report"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cleaner-kicker">Report room damage</div>
            <h2>{repairRoom.code} • {repairRoom.name}</h2>
            <p>Mô tả ngắn gọn phần hư hỏng để người sửa chữa nhìn vào là xử lý được ngay.</p>
            <label className="field" style={{ marginTop: 0 }}>
              <div className="field-label">Repair detail</div>
              <textarea
                className="textarea"
                rows={5}
                value={repairDetails}
                onChange={(e) => setRepairDetails(e.target.value)}
                placeholder="Ví dụ: điều hòa phòng master không lạnh, đèn toilet tầng 2 bị chập..."
              />
            </label>
            <div className="cleaner-modal-actions">
              <button className="btn" type="button" onClick={closeRepairModal} disabled={reportingId === repairRoom.id}>
                Cancel
              </button>
              <button className="btn primary" type="button" onClick={() => void handleReportRepair()} disabled={reportingId === repairRoom.id}>
                {reportingId === repairRoom.id ? 'Saving...' : 'Report repair'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
