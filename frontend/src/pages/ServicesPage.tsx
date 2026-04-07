import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import { useI18n } from '../contexts/I18nContext'
import type { TravelService } from '../types'
import './pages.css'

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function getYouTubeId(u: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = u.match(regExp)
  return match && match[2]?.length === 11 ? match[2] : null
}

function getYouTubeThumbUrl(videoUrl: string) {
  const id = getYouTubeId(videoUrl)
  if (!id) return null
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}

export default function ServicesPage() {
  const { t } = useI18n()
  const [services, setServices] = useState<TravelService[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiFetch<TravelService[]>('/api/services')
      .then((data) => {
        if (cancelled) return
        setError(null)
        setServices(data)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof HttpError ? e.message : t('common_something_wrong', 'Something went wrong'))
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return services
    return services.filter((s) => {
      const hay = `${s.name} ${s.description}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query, services])

  const heroTheme = useMemo(
    () => ({
      title: t('nav_services', 'Services'),
      subtitle: 'Marble Mountains',
      imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Marble_Mountain_Gate,_Da_Nang.jpg?width=1600',
    }),
    [t],
  )

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <div className="badge">{t('services_badge', 'Services • Add-ons')}</div>
            <h1>{t('services_title', 'Make your trip smoother with premium services')}</h1>
            <p className="muted hero-sub">
              {t('services_sub', 'Add private transfers, breakfast, or a dedicated tour guide to your journey.')}
            </p>

            <div className="hero-topic-grid hero-topic-grid--single">
              <Link to="/services" className="hero-topic-card hero-topic-card--single">
                <div className="hero-topic-media" style={{ backgroundImage: `url(${heroTheme.imageUrl})` }} />
                <div className="hero-topic-overlay">
                  <div className="hero-topic-title">{heroTheme.title}</div>
                  <div className="hero-topic-subtitle">{heroTheme.subtitle}</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="services">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>{t('services_section_title', 'Services')}</h2>
              <div className="muted">{t('services_section_sub', 'Choose an add-on service and send a request instantly.')}</div>
            </div>
            <div className="search-inline">
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('services_section_title', 'Services')}
              />
            </div>
          </div>

          {loading ? (
            <div className="card muted">{t('loading', 'Loading...')}</div>
          ) : error ? (
            <div className="card error">
              <div className="error-title">{t('common_something_wrong', 'Something went wrong')}</div>
              <div className="muted">{error}</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card muted">{t('common_no_results', 'No results found.')}</div>
          ) : (
            <div className="grid">
              {filtered.map((s) => {
                const thumb = s.videoUrls?.[0] ? getYouTubeThumbUrl(s.videoUrls[0]) : null
                return (
                  <Link to={`/services/${s.id}`} key={s.id} className="card destination-card">
                    <div className="card-media-carousel">
                      <div className="carousel-item">
                        <div className="thumb" style={{ backgroundImage: `url(${thumb ?? s.imageUrl})` }} />
                      </div>
                    </div>
                    <div className="card-body">
                      <div className="card-title-row">
                        <div className="card-title">{s.name}</div>
                        <div className="pill">{t('nav_services', 'Services')}</div>
                      </div>
                      <div className="muted">{s.description}</div>
                      <div className="price">{formatMoney(Number(s.priceFrom))}+</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
