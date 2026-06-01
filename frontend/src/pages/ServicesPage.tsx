import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import { useI18n } from '../contexts/I18nContext'
import { NAV_ITEMS } from '../constants/navigation'
import TypeGate from '../components/TypeGate'
import { getTypeFallbackLabel, getTypeLabelKey, getTypeOptions } from '../constants/typeOptions'
import RecentlyViewedSection from '../components/RecentlyViewedSection'
import { useAuth } from '../contexts/AuthContext'
import type { TravelService } from '../types'
import { addFeaturedCard, deleteFeaturedCard, fetchFeaturedCards, type FeaturedCard } from '../lib/featuredItems'
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

function ServiceCard({
  s,
  isAdmin,
  isFeatured,
  onToggleFeatured,
}: {
  s: TravelService
  isAdmin: boolean
  isFeatured: boolean
  onToggleFeatured: () => void
}) {
  const { t } = useI18n()
  const thumb = s.videoUrls?.[0] ? getYouTubeThumbUrl(s.videoUrls[0]) : null
  return (
    <div className="card destination-card" style={{ position: 'relative' }}>
      <Link to={`/services/${s.id}`} className="card-link-overlay" />
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

export default function ServicesPage() {
  const { t } = useI18n()
  const { isAdmin } = useAuth()
  const [services, setServices] = useState<TravelService[]>([])
  const [featuredCards, setFeaturedCards] = useState<FeaturedCard[]>([])
  const [query, setQuery] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const serviceTypes = NAV_ITEMS.find((item) => item.key === 'service')?.types ?? []

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

  const handleToggleFeatured = async (id: number) => {
    const active = featuredCards.some((fc) => fc.id === id && fc.category === 'service')
    try {
      if (active) {
        await deleteFeaturedCard('service', id)
      } else {
        await addFeaturedCard({ id, category: 'service' })
      }
      const latest = await fetchFeaturedCards()
      setFeaturedCards(latest)
    } catch {}
  }

  const isCardFeatured = (id: number) => {
    return featuredCards.some((fc) => fc.id === id && fc.category === 'service')
  }

  const filtered = useMemo(() => {
    if (!selectedType) return []
    const q = query.trim().toLowerCase()
    return services.filter((s) => {
      const hay = `${s.name} ${s.description}`.toLowerCase()
      if (q && !hay.includes(q)) return false
      return (s.type ?? '').toLowerCase() === selectedType.toLowerCase()
    })
  }, [query, selectedType, serviceTypes, services])

  return (
    <>
      <section className="hero">
        <div className="container hero-inner hero-inner--single">
          <div>
            <div className="badge">{t('services_badge', 'Services • Add-ons')}</div>
            <h1>{t('services_title', 'Make your trip smoother with premium services')}</h1>
            <p className="muted hero-sub">
              {t('services_sub', 'Add private transfers, breakfast, or a dedicated tour guide to your journey.')}
            </p>
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
            {selectedType ? (
              <div className="section-tools">
                <div className="type-filters">
                  {serviceTypes.map((typeName) => {
                    const labelKey = getTypeLabelKey('service', typeName)
                    const fallbackLabel = getTypeFallbackLabel('service', typeName)
                    return (
                      <button
                        type="button"
                        key={typeName}
                        className={`type-filter-btn ${selectedType === typeName ? 'active' : ''}`}
                        onClick={() => setSelectedType((prev) => (prev === typeName ? '' : typeName))}
                      >
                        {t(labelKey ?? '', fallbackLabel)}
                      </button>
                    )
                  })}
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
            ) : null}
          </div>

          {!selectedType ? (
            <TypeGate
              titleKey="type_pick_title"
              titleFallback="Choose a type"
              subtitleKey="type_pick_sub_service"
              subtitleFallback="Pick a type to view services."
              options={getTypeOptions('service')}
              onSelect={(value) => setSelectedType(value)}
            />
          ) : (
            <RecentlyViewedSection />
          )}

          {!selectedType ? null : loading ? (
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
              {filtered.map((s) => (
                <ServiceCard
                  key={s.id}
                  s={s}
                  isAdmin={isAdmin}
                  isFeatured={isCardFeatured(s.id)}
                  onToggleFeatured={() => void handleToggleFeatured(s.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
