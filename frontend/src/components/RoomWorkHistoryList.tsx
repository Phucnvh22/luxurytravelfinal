import type { RoomWorkLog } from '../types'
import '../pages/cleaner-dashboard.css'

function formatDateTime(value?: string) {
  if (!value) return 'Not available'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
}

function getActionMeta(action: RoomWorkLog['action']) {
  switch (action) {
    case 'CLEANING_COMPLETED':
      return { label: 'Cleaning completed', className: 'cleaning' }
    case 'REPAIR_REPORTED':
      return { label: 'Repair reported', className: 'reported' }
    case 'REPAIR_RESOLVED':
      return { label: 'Repair resolved', className: 'resolved' }
    default:
      return { label: action, className: '' }
  }
}

export default function RoomWorkHistoryList({
  logs,
  emptyTitle,
  emptyMessage,
  showActor = true,
}: {
  logs: RoomWorkLog[]
  emptyTitle: string
  emptyMessage: string
  showActor?: boolean
}) {
  if (logs.length === 0) {
    return (
      <div className="cleaner-empty-state">
        <h2>{emptyTitle}</h2>
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="work-history-list">
      {logs.map((log) => {
        const meta = getActionMeta(log.action)
        return (
          <article key={log.id} className="work-history-card">
            <div className="work-history-top">
              <div>
                <div className="cleaner-room-code">{log.roomCode}</div>
                <h3>{log.roomName}</h3>
              </div>
              <span className={`work-history-badge ${meta.className}`}>{meta.label}</span>
            </div>

            <div className="work-history-meta">
              <div>
                <span>Time</span>
                <strong>{formatDateTime(log.occurredAt)}</strong>
              </div>
              {showActor ? (
                <div>
                  <span>Actor</span>
                  <strong>{log.actorName || log.actorUsername}</strong>
                </div>
              ) : null}
              <div>
                <span>Role</span>
                <strong>{log.actorRole}</strong>
              </div>
              <div>
                <span>Villa</span>
                <strong>{log.roomCode}</strong>
              </div>
            </div>

            {log.details ? (
              <div className="cleaner-repair-box">
                <span>Detail</span>
                <strong>{log.details}</strong>
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
