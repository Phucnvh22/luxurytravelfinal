import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import { useI18n } from '../contexts/I18nContext'
import TypeGate from '../components/TypeGate'
import { getTypeOptions } from '../constants/typeOptions'
import RecentlyViewedSection from '../components/RecentlyViewedSection'
import { useAuth } from '../contexts/AuthContext'
import type { Destination, Experience, TravelService } from '../types'
import { addFeaturedCard, deleteFeaturedCard, fetchFeaturedCards, type FeaturedCard } from '../lib/featuredItems'
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

type FeaturedItem = {
  id: number
  name: string
  location?: string
  description?: string
  type: string
  priceFrom: number | string
  imageUrl: string
  createdAt: string
  videoUrls?: string[]
  category: 'destination' | 'experience' | 'service'
  durationDays?: number
}

function DestinationCard({
  d,
  isAdmin,
  isFeatured,
  onToggleFeatured,
}: {
  d: Destination
  isAdmin: boolean
  isFeatured: boolean
  onToggleFeatured: () => void
}) {
  return (
    <div className="card destination-card" style={{ position: 'relative' }}>
      <Link to={`/destinations/${d.id}`} className="card-link-overlay" />
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
      {isAdmin && (
        <button
          type="button"
          className={`card-heart-btn ${isFeatured ? 'card-heart-btn--active' : ''}`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleFeatured()
          }}
          aria-label={isFeatured ? 'Remove from featured' : 'Add to featured'}
          title={isFeatured ? 'Remove from featured' : 'Add to featured'}
        >
          <svg viewBox="0 0 24 24" fill={isFeatured ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      )}
    </div>
  )
}

export default function HomePage() {
  const { t } = useI18n()
  const { isAdmin } = useAuth()
  const location = useLocation()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [services, setServices] = useState<TravelService[]>([])
  const [featuredCards, setFeaturedCards] = useState<FeaturedCard[]>([])
  const [query, setQuery] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const homeResetToken = (location.state as { homeResetToken?: number } | null)?.homeResetToken

  useEffect(() => {
    if (!homeResetToken) return
    setSelectedType('')
    setQuery('')
  }, [homeResetToken])

  useEffect(() => {
    let cancelled = false
    fetchFeaturedCards()
      .then((data) => {
        if (cancelled) return
        setFeaturedCards(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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

  useEffect(() => {
    let cancelled = false
    apiFetch<Experience[]>('/api/experiences')
      .then((data) => {
        if (cancelled) return
        setExperiences(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    apiFetch<TravelService[]>('/api/services')
      .then((data) => {
        if (cancelled) return
        setServices(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const featuredItems = useMemo<FeaturedItem[]>(() => {
    if (featuredCards.length === 0) return []

    const items: FeaturedItem[] = []

    featuredCards.forEach((fc) => {
      if (fc.category === 'destination') {
        const d = destinations.find((dest) => dest.id === fc.id)
        if (d) {
          items.push({
            ...d,
            category: 'destination',
          })
        }
      } else if (fc.category === 'experience') {
        const e = experiences.find((exp) => exp.id === fc.id)
        if (e) {
          items.push({
            id: e.id,
            name: e.name,
            location: undefined,
            description: e.description,
            type: e.type,
            priceFrom: e.priceFrom,
            imageUrl: e.imageUrl,
            createdAt: e.createdAt,
            videoUrls: e.videoUrls,
            category: 'experience',
          })
        }
      } else if (fc.category === 'service') {
        const s = services.find((svc) => svc.id === fc.id)
        if (s) {
          items.push({
            id: s.id,
            name: s.name,
            location: undefined,
            description: s.description,
            type: s.type,
            priceFrom: s.priceFrom,
            imageUrl: s.imageUrl,
            createdAt: s.createdAt,
            videoUrls: s.videoUrls,
            category: 'service',
          })
        }
      }
    })

    return items.sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt))
  }, [featuredCards, destinations, experiences, services])

  const handleToggleFeatured = async (id: number, category: 'destination' | 'experience' | 'service') => {
    const active = featuredCards.some((fc) => fc.id === id && fc.category === category)
    try {
      if (active) {
        await deleteFeaturedCard(category, id)
      } else {
        await addFeaturedCard({ id, category })
      }
      const latest = await fetchFeaturedCards()
      setFeaturedCards(latest)
    } catch {}
  }

  const isCardFeatured = (id: number, category: 'destination' | 'experience' | 'service') => {
    return featuredCards.some((fc) => fc.id === id && fc.category === category)
  }

  const filtered = useMemo(() => {
    if (!selectedType) return []
    const q = query.trim().toLowerCase()
    return destinations.filter((d) => {
      const matchesQuery =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
      if (!matchesQuery) return false
      return (d.type ?? '').toLowerCase() === selectedType.toLowerCase()
    })
  }, [destinations, query, selectedType])


  return (
    <>
      <section className="hero">
        <div className="container hero-inner hero-inner--single">
          <div>
            <div className="badge">{t('home_badge', 'Da Nang Luxury Travel • Private Experiences')}</div>
            <h1>{t('home_title', 'Premium journeys, tailored just for you')}</h1>
            <p className="muted hero-sub">
              {t('home_sub', 'Discover standout destinations, choose your itinerary, and request a booking in minutes.')}
            </p>
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
            {selectedType ? (
              <div className="section-tools">
                <div className="search-inline">
                  <input
                    className="input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('home_search_placeholder', 'Search destinations...')}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {!selectedType ? (
            <>
              {featuredItems.length > 0 ? (
                <div className="grid">
                  <div className="section-head" style={{ gridColumn: '1 / -1', marginBottom: '16px' }}>
                    <div>
                      <h2>{t('home_featured_title', 'Featured')}</h2>
                      <div className="muted">{t('home_featured_sub', 'Handpicked destinations by admin.')}</div>
                    </div>
                  </div>
                  {featuredItems.map((item) => {
                    const getLink = () => {
                      if (item.category === 'experience') return `/experiences/${item.id}`
                      if (item.category === 'service') return `/services/${item.id}`
                      return `/destinations/${item.id}`
                    }
                    const thumb = item.videoUrls?.[0] ? getYouTubeThumbUrl(item.videoUrls[0]) : null
                    const categoryLabel =
                      item.category === 'experience'
                        ? t('nav_experiences', 'Experiences')
                        : item.category === 'service'
                          ? t('nav_services', 'Services')
                          : `${item.durationDays} days`
                    return (
                      <Link to={getLink()} key={`${item.category}-${item.id}`} className="card destination-card">
                        <div className="card-media-carousel">
                          <div className="carousel-item">
                            <div className="thumb" style={{ backgroundImage: `url(${thumb ?? item.imageUrl})` }} />
                          </div>
                        </div>
                        <div className="card-body">
                          <div className="card-title-row">
                            <div className="card-title">{item.name}</div>
                            <div className="pill">{categoryLabel}</div>
                          </div>
                          <div className="muted">{item.location ?? item.description}</div>
                          <div className="price">{formatMoney(String(item.priceFrom))}+</div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              ) : null}

              <TypeGate
                titleKey="type_pick_title"
                titleFallback="Choose a type"
                subtitleKey="type_pick_sub_accommodation"
                subtitleFallback="Pick a type to view accommodations."
                options={getTypeOptions('accommodation')}
                selectedValue={selectedType}
                onSelect={(value) => setSelectedType((prev) => (prev === value ? '' : value))}
              />
            </>
          ) : (
            <>
              <TypeGate
                titleKey="type_pick_title"
                titleFallback="Choose a type"
                subtitleKey="type_pick_sub_accommodation"
                subtitleFallback="Pick a type to view accommodations."
                options={getTypeOptions('accommodation')}
                selectedValue={selectedType}
                onSelect={(value) => setSelectedType((prev) => (prev === value ? '' : value))}
              />
              <RecentlyViewedSection />
            </>
          )}

          {!selectedType ? null : loading ? (
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
                  <DestinationCard
                    key={d.id}
                    d={d}
                    isAdmin={isAdmin}
                    isFeatured={isCardFeatured(d.id, 'destination')}
                    onToggleFeatured={() => void handleToggleFeatured(d.id, 'destination')}
                  />
                )
              })}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
