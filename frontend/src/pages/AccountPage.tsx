import { useAuth } from '../contexts/AuthContext'

export default function AccountPage() {
  const { user } = useAuth()

  return (
    <div className="section">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="card" style={{ padding: 24, display: 'grid', gap: 20 }}>
          <div>
            <div className="eyebrow">Account</div>
            <h1 style={{ margin: '8px 0 0' }}>Your account</h1>
            <div className="muted" style={{ marginTop: 8 }}>
              Thong tin tai khoan hien tai.
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div className="card detail-card">
              <div className="field-label">Full name</div>
              <div>{user?.fullName || '-'}</div>
            </div>
            <div className="card detail-card">
              <div className="field-label">Username</div>
              <div>{user?.username || '-'}</div>
            </div>
            <div className="card detail-card">
              <div className="field-label">Email</div>
              <div>{user?.email || '-'}</div>
            </div>
            <div className="card detail-card">
              <div className="field-label">Role</div>
              <div>{user?.role || '-'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
