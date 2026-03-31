import { Link } from 'react-router-dom'
import './pages.css'

export default function NotFoundPage() {
  return (
    <section className="section">
      <div className="container">
        <div className="card detail-card">
          <h2 style={{ marginTop: 0 }}>404</h2>
          <div className="muted">Page not found.</div>
          <div className="row" style={{ marginTop: 14 }}>
            <Link to="/" className="btn primary">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
