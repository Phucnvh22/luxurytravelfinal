import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, HttpError } from '../lib/api'
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

export default function HomePage() {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiFetch<Destination[]>('/api/destinations')
      .then((data) => {
        if (cancelled) return
        setError(null)
        setDestinations(data)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const message = e instanceof HttpError ? e.message : 'Could not load data'
        setError(message)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return destinations
    return destinations.filter((d) => {
      const match =
        d.name.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
      return match
    })
  }, [destinations, query])

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <div className="badge">Luxury Travel • Private Experiences</div>
            <h1>Premium journeys, tailored just for you</h1>
            <p className="muted hero-sub">
              Discover standout destinations, choose your itinerary, and request a booking in minutes.
            </p>

            <div className="hero-stats">
              <div className="stat">
                <div className="stat-value">Curated</div>
                <div className="stat-label">Handpicked routes</div>
              </div>
              <div className="stat">
                <div className="stat-value">Fast</div>
                <div className="stat-label">Book in a few steps</div>
              </div>
              <div className="stat">
                <div className="stat-value">Flexible</div>
                <div className="stat-label">Personalized requests</div>
              </div>
            </div>

            <div className="hero-actions">
              <a className="btn primary" href="#accommodations">
                Browse accommodations
              </a>
              <a className="btn" href="/swagger-ui" target="_blank" rel="noreferrer">
                API Docs
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="accommodations">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Accommodations</h2>
              <div className="muted">Explore stays and send a booking request instantly.</div>
            </div>
            <div className="search-inline">
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search accommodations..."
              />
            </div>
          </div>

          {loading ? (
            <div className="card muted">Loading accommodations...</div>
          ) : error ? (
            <div className="card error">
              <div className="error-title">Something went wrong</div>
              <div className="muted">{error}</div>
              <div className="muted">
                Tip: start the Spring Boot backend at http://localhost:8080
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card muted">No results found.</div>
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
