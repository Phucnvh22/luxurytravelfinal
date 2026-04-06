import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import './pages.css'

type ServiceItem = {
  id: string
  name: string
  description: string
  priceFrom: number
  youtubeUrl?: string
  imageUrl: string
  badge: string
}

const SERVICES: ServiceItem[] = [
  {
    id: 'private-car',
    name: 'Private Car',
    description: 'Door-to-door transfers with a professional driver. Flexible pick-up times and premium vehicles.',
    priceFrom: 79,
    youtubeUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    imageUrl: 'https://images.unsplash.com/photo-1550353127-b0da3aeaa0ca?auto=format&fit=crop&w=1400&q=80',
    badge: 'Transfer',
  },
  {
    id: 'breakfast',
    name: 'Breakfast',
    description: 'Daily breakfast add-on with dietary options. Great for early departures and relaxed mornings.',
    priceFrom: 15,
    youtubeUrl: 'https://www.youtube.com/watch?v=ysz5S6PUM-U',
    imageUrl: 'https://images.unsplash.com/photo-1495214783159-3503fd1b572d?auto=format&fit=crop&w=1400&q=80',
    badge: 'Meal',
  },
  {
    id: 'tour-guide',
    name: 'Tour Guide',
    description: 'Local experts for private city tours, cultural experiences, and tailored itineraries.',
    priceFrom: 120,
    youtubeUrl: 'https://www.youtube.com/watch?v=YE7VzlLtp-4',
    imageUrl: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1400&q=80',
    badge: 'Experience',
  },
]

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
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SERVICES
    return SERVICES.filter((s) => {
      const hay = `${s.name} ${s.description} ${s.badge}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query])

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <div className="badge">Services • Add-ons</div>
            <h1>Make your trip smoother with premium services</h1>
            <p className="muted hero-sub">
              Add private transfers, breakfast, or a dedicated tour guide to your journey.
            </p>

            <div className="hero-actions">
              <Link className="btn primary" to="/#accommodations">
                Browse accommodations
              </Link>
              <Link className="btn" to="/">
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <h2>Services</h2>
              <div className="muted">Choose an add-on service and mention it in your booking request notes.</div>
            </div>
            <div className="search-inline">
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services..."
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="card muted">No results found.</div>
          ) : (
            <div className="grid">
              {filtered.map((s) => (
                <div key={s.id} className="card destination-card" role="article" aria-label={s.name}>
                  <div className="card-media-carousel">
                    <div className="carousel-item">
                      <div
                        className="thumb"
                        style={{
                          backgroundImage: `url(${(s.youtubeUrl ? getYouTubeThumbUrl(s.youtubeUrl) : null) ?? s.imageUrl})`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="card-title-row">
                      <div className="card-title">{s.name}</div>
                      <div className="pill">{s.badge}</div>
                    </div>
                    <div className="muted">{s.description}</div>
                    <div className="price">{formatMoney(s.priceFrom)}+</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
