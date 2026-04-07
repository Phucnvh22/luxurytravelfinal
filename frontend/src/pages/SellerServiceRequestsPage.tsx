import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { ServiceRequestResponse } from '../types'
import './pages.css'

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function formatMoney(val: number | undefined) {
  if (val === undefined || val === null) return '0'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)
}

export default function SellerServiceRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequestResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)

  async function load(opts?: { silent?: boolean }) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await apiFetch<ServiceRequestResponse[]>('/api/service-requests')
      setRequests(data)
      setError(null)
    } catch (e: unknown) {
      if (!opts?.silent) {
        if (e instanceof HttpError) {
          if (e.status === 403) {
            setError('You do not have permission to view this page. Try logging in again.')
          } else if (e.status === 401) {
            setError('Please log in to view this page.')
          } else {
            setError(e.message)
          }
        } else {
          setError('Could not load service requests')
        }
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
      void load({ silent: true })
    }
    const intervalId = window.setInterval(tick, 5000)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', tick)
    }
  }, [])

  return (
    <section className="section">
      <div className="container">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <Link to="/" className="btn">
              ← Home
            </Link>
            <Link to="/seller/experiences" className="btn">
              Manage experiences
            </Link>
            <Link to="/seller/bookings" className="btn">
              Booking requests
            </Link>
            <Link to="/seller/experience-requests" className="btn">
              Experience requests
            </Link>
          </div>
          <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
            Reload
          </button>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>My service requests</h2>
            <div className="muted">Only requests attributed to your seller account.</div>
          </div>
        </div>

        {loading ? (
          <div className="card detail-card muted">Loading...</div>
        ) : error ? (
          <div className="card error">
            <div className="error-title">Something went wrong</div>
            <div className="muted">{error}</div>
          </div>
        ) : requests.length === 0 ? (
          <div className="card detail-card muted">No requests yet.</div>
        ) : (
          <div className="card detail-card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>ID</th>
                    <th>Service</th>
                    <th>Customer</th>
                    <th style={{ width: 120 }}>Travel date</th>
                    <th style={{ width: 90 }}>Guests</th>
                    <th style={{ width: 120 }}>Total</th>
                    <th style={{ width: 120 }}>Commission</th>
                    <th style={{ width: 120 }}>Status</th>
                    <th style={{ width: 170 }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>
                        <Link to={`/services/${r.serviceId}`} style={{ color: 'inherit' }}>
                          {r.serviceName}
                        </Link>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          #{r.serviceId}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{r.customerName}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {r.email} • {r.phone}
                        </div>
                        {r.notes ? (
                          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                            {r.notes}
                          </div>
                        ) : null}
                      </td>
                      <td>{r.travelDate}</td>
                      <td>{r.travelers}</td>
                      <td style={{ fontWeight: 600 }}>{formatMoney(r.totalPrice)}</td>
                      <td style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{formatMoney(r.commissionAmount)}</td>
                      <td>{r.status}</td>
                      <td>{formatDate(r.createdAt)}</td>
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
