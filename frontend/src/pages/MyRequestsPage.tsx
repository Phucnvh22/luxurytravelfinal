import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import { useI18n } from '../contexts/I18nContext'
import type { BookingResponse, ExperienceRequestResponse, ServiceRequestResponse } from '../types'
import './pages.css'

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function toTime(value?: string) {
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

export default function MyRequestsPage() {
  const { t } = useI18n()
  const [bookings, setBookings] = useState<BookingResponse[]>([])
  const [serviceRequests, setServiceRequests] = useState<ServiceRequestResponse[]>([])
  const [experienceRequests, setExperienceRequests] = useState<ExperienceRequestResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt) || b.id - a.id),
    [bookings],
  )
  const sortedServices = useMemo(
    () => [...serviceRequests].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt) || b.id - a.id),
    [serviceRequests],
  )
  const sortedExperiences = useMemo(
    () => [...experienceRequests].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt) || b.id - a.id),
    [experienceRequests],
  )

  async function load(opts?: { silent?: boolean }) {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const [b, s, e] = await Promise.all([
        apiFetch<BookingResponse[]>('/api/bookings'),
        apiFetch<ServiceRequestResponse[]>('/api/service-requests'),
        apiFetch<ExperienceRequestResponse[]>('/api/experience-requests'),
      ])
      setBookings(b)
      setServiceRequests(s)
      setExperienceRequests(e)
      setError(null)
    } catch (err: unknown) {
      if (!opts?.silent) {
        if (err instanceof HttpError) {
          if (err.status === 403) setError(t('my_requests_forbidden', 'You do not have permission to view this page.'))
          else if (err.status === 401) setError(t('my_requests_login_required', 'Please log in to view your requests.'))
          else setError(err.message)
        } else {
          setError(t('my_requests_load_failed', 'Could not load your requests.'))
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
    const intervalId = window.setInterval(tick, 8000)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', tick)
    }
  }, [])

  const hasAny = sortedBookings.length + sortedServices.length + sortedExperiences.length > 0

  return (
    <section className="section">
      <div className="container">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Link to="/" className="btn">
            ← {t('back', 'Back')}
          </Link>
          <button className="btn" type="button" onClick={() => void load()} disabled={loading}>
            {t('reload', 'Reload')}
          </button>
        </div>

        <div className="section-head" style={{ marginTop: 14 }}>
          <div>
            <h2>{t('my_requests_title', 'My requests')}</h2>
            <div className="muted">{t('my_requests_sub', 'View your booking and service requests. Status updates after admin confirmation.')}</div>
          </div>
        </div>

        {loading ? (
          <div className="card detail-card muted">{t('loading', 'Loading...')}</div>
        ) : error ? (
          <div className="card error">
            <div className="error-title">{t('common_something_wrong', 'Something went wrong')}</div>
            <div className="muted">{error}</div>
          </div>
        ) : !hasAny ? (
          <div className="card detail-card muted">{t('my_requests_empty', 'No requests yet.')}</div>
        ) : (
          <>
            <div className="card detail-card" style={{ marginBottom: 14 }}>
              <div className="section-head" style={{ marginTop: 0, marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{t('my_requests_bookings', 'Trips / Accommodations')}</h3>
                </div>
              </div>
              {sortedBookings.length === 0 ? (
                <div className="muted">{t('my_requests_bookings_empty', 'No booking requests yet.')}</div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>ID</th>
                        <th>{t('my_requests_item', 'Item')}</th>
                        <th style={{ width: 120 }}>{t('form_travel_date', 'Travel date')}</th>
                        <th style={{ width: 90 }}>{t('form_guests', 'Guests')}</th>
                        <th style={{ width: 120 }}>{t('my_requests_status', 'Status')}</th>
                        <th style={{ width: 170 }}>{t('my_requests_created', 'Created')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedBookings.map((b) => (
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
                          <td>{b.travelDate}</td>
                          <td>{b.travelers}</td>
                          <td>{b.status}</td>
                          <td>{formatDate(b.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card detail-card" style={{ marginBottom: 14 }}>
              <div className="section-head" style={{ marginTop: 0, marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{t('my_requests_services', 'Services')}</h3>
                </div>
              </div>
              {sortedServices.length === 0 ? (
                <div className="muted">{t('my_requests_services_empty', 'No service requests yet.')}</div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>ID</th>
                        <th>{t('my_requests_item', 'Item')}</th>
                        <th style={{ width: 120 }}>{t('form_travel_date', 'Travel date')}</th>
                        <th style={{ width: 90 }}>{t('form_guests', 'Guests')}</th>
                        <th style={{ width: 120 }}>{t('my_requests_status', 'Status')}</th>
                        <th style={{ width: 170 }}>{t('my_requests_created', 'Created')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedServices.map((s) => (
                        <tr key={s.id}>
                          <td>{s.id}</td>
                          <td>
                            <Link to={`/services/${s.serviceId}`} style={{ color: 'inherit' }}>
                              {s.serviceName}
                            </Link>
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              #{s.serviceId}
                            </div>
                          </td>
                          <td>{s.travelDate}</td>
                          <td>{s.travelers}</td>
                          <td>{s.status}</td>
                          <td>{formatDate(s.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card detail-card">
              <div className="section-head" style={{ marginTop: 0, marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{t('my_requests_experiences', 'Experiences')}</h3>
                </div>
              </div>
              {sortedExperiences.length === 0 ? (
                <div className="muted">{t('my_requests_experiences_empty', 'No experience requests yet.')}</div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>ID</th>
                        <th>{t('my_requests_item', 'Item')}</th>
                        <th style={{ width: 120 }}>{t('form_travel_date', 'Travel date')}</th>
                        <th style={{ width: 90 }}>{t('form_guests', 'Guests')}</th>
                        <th style={{ width: 120 }}>{t('my_requests_status', 'Status')}</th>
                        <th style={{ width: 170 }}>{t('my_requests_created', 'Created')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedExperiences.map((e) => (
                        <tr key={e.id}>
                          <td>{e.id}</td>
                          <td>
                            <Link to={`/experiences/${e.experienceId}`} style={{ color: 'inherit' }}>
                              {e.experienceName}
                            </Link>
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              #{e.experienceId}
                            </div>
                          </td>
                          <td>{e.travelDate}</td>
                          <td>{e.travelers}</td>
                          <td>{e.status}</td>
                          <td>{formatDate(e.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

