import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { ServiceRequestResponse, User } from '../types'
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

export default function AdminServiceRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequestResponse[]>([])
  const [sellerNameById, setSellerNameById] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)

  const approve = async (r: ServiceRequestResponse) => {
    if (r.status !== 'PENDING') return
    if (!confirm(`Approve request #${r.id}?`)) return
    try {
      await apiFetch(`/api/admin/service-requests/${r.id}/approve`, { method: 'POST' })
      await load()
    } catch (e: unknown) {
      alert(e instanceof HttpError ? e.message : 'Could not approve request')
    }
  }

  async function load(opts?: { silent?: boolean }) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const [requestsData, sellersData] = await Promise.all([
        apiFetch<ServiceRequestResponse[]>('/api/service-requests'),
        apiFetch<User[]>('/api/admin/users/sellers').catch(() => null),
      ])
      setRequests(requestsData)
      setError(null)

      if (sellersData) {
        const next: Record<number, string> = {}
        for (const s of sellersData) {
          next[s.id] = s.fullName || s.username
        }
        setSellerNameById(next)
      } else {
        setSellerNameById({})
      }
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
            <Link to="/admin/destinations" className="btn">
              Destinations
            </Link>
            <Link to="/admin/services" className="btn">
              Services
            </Link>
          </div>
          <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
            Reload
          </button>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>Service requests</h2>
            <div className="muted">Approve requests and credit commission to the seller ref.</div>
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
                    <th style={{ width: 90 }}>Seller Ref</th>
                    <th style={{ width: 120 }}>Actions</th>
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
                      <td>
                        {r.sellerId
                          ? sellerNameById[r.sellerId]
                            ? sellerNameById[r.sellerId]
                            : `Seller #${r.sellerId}`
                          : 'None'}
                      </td>
                      <td>
                        {r.status === 'PENDING' ? (
                          <button className="btn" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => void approve(r)}>
                            Approve
                          </button>
                        ) : (
                          <button
                            className="btn"
                            style={{
                              padding: '4px 8px',
                              fontSize: 12,
                              backgroundColor: 'var(--color-primary)',
                              borderColor: 'var(--color-primary)',
                              color: '#fff',
                            }}
                            type="button"
                            disabled
                          >
                            Approved
                          </button>
                        )}
                      </td>
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

