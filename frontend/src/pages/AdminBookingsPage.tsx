import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import type { BookingResponse, User } from '../types'
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

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingResponse[]>([])
  const [sellerNameById, setSellerNameById] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const approve = async (booking: BookingResponse) => {
    if (booking.status !== 'PENDING') return
    if (!confirm(`Approve request #${booking.id}?`)) return
    try {
      await apiFetch(`/api/admin/bookings/${booking.id}/approve`, { method: 'POST' })
      await load()
    } catch (e: unknown) {
      alert(e instanceof HttpError ? e.message : 'Could not approve booking')
    }
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [bookingsData, sellersData] = await Promise.all([
        apiFetch<BookingResponse[]>('/api/bookings'),
        apiFetch<User[]>('/api/admin/users/sellers').catch(() => null),
      ])
      setBookings(bookingsData)

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
      if (e instanceof HttpError) {
        if (e.status === 403) {
          setError('You do not have permission to view this page. Try logging in again.')
        } else if (e.status === 401) {
          setError('Please log in to view this page.')
        } else {
          setError(e.message)
        }
      } else {
        setError('Could not load bookings')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
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
          </div>
          <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
            Reload
          </button>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>Bookings / Requests</h2>
            <div className="muted">All booking requests in one place.</div>
          </div>
        </div>

        {loading ? (
          <div className="card detail-card muted">Loading...</div>
        ) : error ? (
          <div className="card error">
            <div className="error-title">Something went wrong</div>
            <div className="muted">{error}</div>
          </div>
        ) : bookings.length === 0 ? (
          <div className="card detail-card muted">No bookings yet.</div>
        ) : (
          <div className="card detail-card">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>ID</th>
                  <th>Destination</th>
                  <th>Customer</th>
                  <th style={{ width: 120 }}>Travel date</th>
                  <th style={{ width: 90 }}>Guests</th>
                  <th style={{ width: 120 }}>Total Price</th>
                  <th style={{ width: 120 }}>Commission</th>
                  <th style={{ width: 120 }}>Status</th>
                  <th style={{ width: 90 }}>Seller Ref</th>
                  <th style={{ width: 120 }}>Actions</th>
                  <th style={{ width: 170 }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>{b.id}</td>
                    <td>
                      <Link to={`/destinations/${b.destinationId}`} style={{ color: 'inherit' }}>
                        {b.destinationName}
                      </Link>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        #{b.destinationId}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{b.customerName}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {b.email} • {b.phone}
                      </div>
                      {b.notes ? (
                        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                          {b.notes}
                        </div>
                      ) : null}
                    </td>
                    <td>{b.travelDate}</td>
                    <td>{b.travelers}</td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(b.totalPrice)}</td>
                    <td style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                      {formatMoney(b.commissionAmount)}
                    </td>
                    <td>{b.status}</td>
                    <td>
                      {b.sellerId
                        ? sellerNameById[b.sellerId]
                          ? sellerNameById[b.sellerId]
                          : `Seller #${b.sellerId}`
                        : 'None'}
                    </td>
                    <td>
                      <button className="btn" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => void approve(b)} disabled={b.status !== 'PENDING'}>
                        Approve
                      </button>
                    </td>
                    <td>{formatDate(b.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
