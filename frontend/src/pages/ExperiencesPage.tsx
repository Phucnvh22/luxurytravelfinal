import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
import { useI18n } from '../contexts/I18nContext'
import { NAV_ITEMS } from '../constants/navigation'
import TypeGate from '../components/TypeGate'
import { getTypeFallbackLabel, getTypeLabelKey, getTypeOptions } from '../constants/typeOptions'
import RecentlyViewedSection from '../components/RecentlyViewedSection'
import type { Experience } from '../types'
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

export default function ExperiencesPage() {
  const { t } = useI18n()
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [query, setQuery] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const experienceTypes = NAV_ITEMS.find((item) => item.key === 'experience')?.types ?? []

  useEffect(() => {
    let cancelled = false
    apiFetch<Experience[]>('/api/experiences')
      .then((data) => {
        if (cancelled) return
        setError(null)
        setExperiences(data)
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
    if (!selectedType) return []
    const q = query.trim().toLowerCase()
    return experiences.filter((e) => {
      const hay = `${e.name} ${e.description}`.toLowerCase()
      if (q && !hay.includes(q)) return false
      return (e.type ?? '').toLowerCase() === selectedType.toLowerCase()
    })
  }, [experienceTypes, experiences, query, selectedType])

  return (
    <>
      <section className="hero">
        <div className="container hero-inner hero-inner--single">
          <div>
            <div className="badge">{t('experiences_badge', 'Experiences • Activities')}</div>
            <h1>{t('experiences_title', 'Unique experiences, curated for your trip')}</h1>
            <p className="muted hero-sub">
              {t('experiences_sub', 'Browse curated activities and learn more about each experience.')}
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="experiences">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>{t('experiences_section_title', 'Experiences')}</h2>
              <div className="muted">{t('experiences_section_sub', 'Choose an experience to view details.')}</div>
            </div>
            {selectedType ? (
              <div className="section-tools">
                <div className="type-filters">
                  {experienceTypes.map((typeName) => {
                    const labelKey = getTypeLabelKey('experience', typeName)
                    const fallbackLabel = getTypeFallbackLabel('experience', typeName)
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
                    placeholder={t('experiences_section_title', 'Experiences')}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {!selectedType ? (
            <TypeGate
              titleKey="type_pick_title"
              titleFallback="Choose a type"
              subtitleKey="type_pick_sub_experience"
              subtitleFallback="Pick a type to view experiences."
              options={getTypeOptions('experience')}
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
              {filtered.map((e) => {
                const thumb = e.videoUrls?.[0] ? getYouTubeThumbUrl(e.videoUrls[0]) : null
                return (
                  <Link to={`/experiences/${e.id}`} key={e.id} className="card destination-card">
                    <div className="card-media-carousel">
                      <div className="carousel-item">
                        <div className="thumb" style={{ backgroundImage: `url(${thumb ?? e.imageUrl})` }} />
                      </div>
                    </div>
                    <div className="card-body">
                      <div className="card-title-row">
                        <div className="card-title">{e.name}</div>
                        <div className="pill">{t('nav_experiences', 'Experiences')}</div>
                      </div>
                      <div className="muted">{e.description}</div>
                      <div className="price">{formatMoney(Number(e.priceFrom))}+</div>
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
