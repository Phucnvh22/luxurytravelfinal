import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import { useI18n } from '../contexts/I18nContext'
import { NAV_ITEMS } from '../constants/navigation'
import type { Destination } from '../types'
import './pages.css'

function formatMoney(value: string) {
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
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

function toTime(value?: string) {
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

export default function HomePage() {
  const { t } = useI18n()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [query, setQuery] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const accommodationTypes = NAV_ITEMS.find((item) => item.key === 'accommodation')?.types ?? []

  useEffect(() => {
    let cancelled = false
    apiFetch<Destination[]>('/api/destinations')
      .then((data) => {
        if (cancelled) return
        setError(null)
        setDestinations([...data].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt) || b.id - a.id))
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
  }, [t])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return destinations.filter((d) => {
      const matchesQuery =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
      if (!matchesQuery) return false

      if (!selectedType) return true
      return (d.type ?? '').toLowerCase() === selectedType.toLowerCase()
    })
  }, [accommodationTypes, destinations, query, selectedType])

  const heroTheme = useMemo(
    () => ({
      title: t('nav_accommodations', 'Accommodations'),
      subtitle: 'Da Nang Bay',
      imageUrl: encodeURI('/acommodation.jpg'),
    }),
    [t],
  )

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <div className="badge">{t('home_badge', 'Da Nang Luxury Travel • Private Experiences')}</div>
            <h1>{t('home_title', 'Premium journeys, tailored just for you')}</h1>
            <p className="muted hero-sub">
              {t('home_sub', 'Discover standout destinations, choose your itinerary, and request a booking in minutes.')}
            </p>

            <div className="hero-topic-grid hero-topic-grid--single">
              <Link to="/" className="hero-topic-card hero-topic-card--single">
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

      <section className="section" id="accommodations">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>{t('home_section_title', 'Accommodations')}</h2>
              <div className="muted">{t('home_section_sub', 'Explore stays and send a booking request instantly.')}</div>
            </div>
            <div className="section-tools">
              <div className="type-filters">
                {accommodationTypes.map((typeName) => (
                  <button
                    type="button"
                    key={typeName}
                    className={`type-filter-btn ${selectedType === typeName ? 'active' : ''}`}
                    onClick={() => setSelectedType((prev) => (prev === typeName ? '' : typeName))}
                  >
                    {typeName}
                  </button>
                ))}
              </div>
              <div className="search-inline">
                <input
                  className="input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('home_search_placeholder', 'Search destinations...')}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="card muted">{t('loading', 'Loading...')}</div>
          ) : error ? (
            <div className="card error">
              <div className="error-title">{t('common_something_wrong', 'Something went wrong')}</div>
              <div className="muted">{error}</div>
              <div className="muted">
                Tip: start the Spring Boot backend at http://localhost:8080
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card muted">{t('common_no_results', 'No results found.')}</div>
          ) : (
            <div className="grid">
              {filtered.map((d) => {
                return (
                  <Link to={`/destinations/${d.id}`} key={d.id} className="card destination-card">
                    <div className="card-media-carousel">
                      {d.videoUrls && d.videoUrls.length > 0 ? (
                        d.videoUrls.map((url, idx) => {
                          const thumb = getYouTubeThumbUrl(url) ?? d.imageUrl
                          return (
                            <div className="carousel-item" key={idx}>
                              <div className="thumb" style={{ backgroundImage: `url(${thumb})` }} />
                            </div>
                          )
                        })
                      ) : (
                        <div className="carousel-item">
                          <div className="thumb" style={{ backgroundImage: `url(${d.imageUrl})` }} />
                        </div>
                      )}
                    </div>
                    <div className="card-body">
                      <div className="card-title-row">
                        <div className="card-title">{d.name}</div>
                        <div className="pill">{d.durationDays} days</div>
                      </div>
                      <div className="muted">{d.location}</div>
                      <div className="price">{formatMoney(String(d.priceFrom))}+</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
