import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import { useI18n } from '../contexts/I18nContext'
import type { ServiceRequestCreateRequest, ServiceRequestResponse, TravelService } from '../types'
import './pages.css'

function formatMoney(value: string) {
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function todayIsoDate() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function getYouTubeId(u: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = u.match(regExp)
  return match && match[2]?.length === 11 ? match[2] : null
}

export default function ServiceDetailPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()

  const serviceId = useMemo(() => Number(id), [id])
  const [service, setService] = useState<TravelService | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<ServiceRequestResponse | null>(null)

  const [form, setForm] = useState<Omit<ServiceRequestCreateRequest, 'serviceId'>>({
    customerName: '',
    email: '',
    phone: '',
    travelDate: todayIsoDate(),
    travelers: 2,
    notes: '',
  })

  useEffect(() => {
    if (!Number.isFinite(serviceId)) {
      navigate('/services')
      return
    }
    let cancelled = false
    apiFetch<TravelService>(`/api/services/${serviceId}`)
      .then((s) => {
        if (cancelled) return
        setError(null)
        setService(s)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const message = e instanceof HttpError ? e.message : t('common_something_wrong', 'Something went wrong')
        setError(message)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [serviceId, navigate, t])

  async function submit() {
    setSubmitting(true)
    setSubmitError(null)
    setSuccess(null)
    try {
      if (!form.customerName.trim()) throw new Error(t('form_full_name', 'Full name'))
      if (!form.email.trim()) throw new Error(t('form_email', 'Email'))
      if (!form.phone.trim()) throw new Error(t('form_phone', 'Phone'))
      if (!form.travelDate) throw new Error(t('form_travel_date', 'Travel date'))
      if (!form.travelers || form.travelers < 1) throw new Error(t('form_guests', 'Guests'))

      const refIdStr = localStorage.getItem('refId') ?? sessionStorage.getItem('refId')
      const sellerId = refIdStr ? Number(refIdStr) : null
      const payload: ServiceRequestCreateRequest = {
        serviceId,
        customerName: form.customerName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        travelDate: form.travelDate,
        travelers: form.travelers,
        notes: form.notes?.trim() || '',
        sellerId:
          typeof sellerId === 'number' && Number.isFinite(sellerId) && Number.isInteger(sellerId) && sellerId > 0
            ? sellerId
            : undefined,
      }

      const result = await apiFetch<ServiceRequestResponse>('/api/service-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setSuccess(result)
      setForm({
        customerName: '',
        email: '',
        phone: '',
        travelDate: todayIsoDate(),
        travelers: 2,
        notes: '',
      })
    } catch (e: unknown) {
      const message =
        e instanceof HttpError
          ? e.body?.fields
            ? Object.values(e.body.fields).join(', ')
            : e.message
          : e instanceof Error
            ? e.message
            : 'Request failed'
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="section">
      <div className="container">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Link to="/services" className="btn">
            ← {t('back', 'Back')}
          </Link>
        </div>

        {loading ? (
          <div className="card detail-card muted" style={{ marginTop: 14 }}>
            {t('loading', 'Loading...')}
          </div>
        ) : error ? (
          <div className="card error" style={{ marginTop: 14 }}>
            <div className="error-title">{t('common_something_wrong', 'Something went wrong')}</div>
            <div className="muted">{error}</div>
          </div>
        ) : !service ? (
          <div className="card detail-card muted" style={{ marginTop: 14 }}>
            {t('common_no_results', 'No results found.')}
          </div>
        ) : (
          <div className="detail-grid" style={{ marginTop: 14 }}>
            <div>
              <div className="detail-carousel">
                {service.videoUrls && service.videoUrls.length > 0 ? (
                  service.videoUrls.map((url, idx) => {
                    const videoId = getYouTubeId(url)
                    return videoId ? (
                      <div className="detail-carousel-item" key={idx}>
                        <iframe
                          className="detail-hero-iframe"
                          src={`https://www.youtube.com/embed/${videoId}?autoplay=${idx === 0 ? 1 : 0}&mute=0`}
                          title={`${service.name} - Video ${idx + 1}`}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      </div>
                    ) : (
                      <div className="detail-carousel-item" key={idx}>
                        <div className="detail-hero" style={{ backgroundImage: `url(${service.imageUrl})` }} />
                      </div>
                    )
                  })
                ) : (
                  <div className="detail-carousel-item">
                    <div className="detail-hero" style={{ backgroundImage: `url(${service.imageUrl})` }} />
                  </div>
                )}
              </div>

              <div className="card detail-card" style={{ marginTop: 14 }}>
                <h2 className="detail-title">{service.name}</h2>
                <div className="detail-meta">
                  <div className="pill">{formatMoney(String(service.priceFrom))}+</div>
                </div>
                <div className="muted" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {service.description}
                </div>
              </div>
            </div>

            <div className="card detail-card">
              <div className="panel-title">{t('form_request_service', 'Request this service')}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {t('form_request_hint', 'Fill in your details to submit a request. Default status: PENDING.')}
              </div>

              <label className="field">
                <div className="field-label">{t('form_full_name', 'Full name')}</div>
                <input
                  className="input"
                  value={form.customerName}
                  onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
                  placeholder="John Doe"
                />
              </label>

              <label className="field">
                <div className="field-label">{t('form_email', 'Email')}</div>
                <input
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="you@email.com"
                />
              </label>

              <label className="field">
                <div className="field-label">{t('form_phone', 'Phone')}</div>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="0901 234 567"
                />
              </label>

              <div className="row">
                <label className="field" style={{ flex: 1, minWidth: 180 }}>
                  <div className="field-label">{t('form_travel_date', 'Travel date')}</div>
                  <input
                    className="input"
                    type="date"
                    value={form.travelDate}
                    onChange={(e) => setForm((p) => ({ ...p, travelDate: e.target.value }))}
                  />
                </label>
                <label className="field" style={{ width: 140 }}>
                  <div className="field-label">{t('form_guests', 'Guests')}</div>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={form.travelers}
                    onChange={(e) => setForm((p) => ({ ...p, travelers: Number(e.target.value) }))}
                  />
                </label>
              </div>

              <label className="field">
                <div className="field-label">{t('form_notes', 'Notes (optional)')}</div>
                <textarea
                  className="textarea"
                  value={form.notes ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Pickup point, dietary preferences..."
                />
              </label>

              {submitError ? (
                <div className="card error" style={{ marginTop: 12 }}>
                  <div className="error-title">{t('common_something_wrong', 'Something went wrong')}</div>
                  <div className="muted">{submitError}</div>
                </div>
              ) : null}

              {success ? (
                <div className="card" style={{ marginTop: 12, padding: 14 }}>
                  <div style={{ fontWeight: 800 }}>{t('form_submit', 'Submit request')}</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Request #{success.id} • {success.status}
                  </div>
                </div>
              ) : null}

              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn primary" type="button" onClick={submit} disabled={submitting}>
                  {submitting ? t('form_sending', 'Sending...') : t('form_submit', 'Submit request')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
