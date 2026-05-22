import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'
import { clearRecentlyViewed, getRecentlyViewed, type RecentlyViewedItem } from '../lib/recentlyViewed'

const KIND_LABEL: Record<RecentlyViewedItem['kind'], string> = {
  destination: 'Accommodation',
  experience: 'Experience',
  service: 'Service',
}

export default function RecentlyViewedSection({ maxItems = 6 }: { maxItems?: number }) {
  const { t } = useI18n()
  const [items, setItems] = useState<RecentlyViewedItem[]>(() => getRecentlyViewed())

  useEffect(() => {
    const refresh = () => setItems(getRecentlyViewed())
    window.addEventListener('storage', refresh)
    window.addEventListener('recently-viewed:updated', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('recently-viewed:updated', refresh)
    }
  }, [])

  const visible = useMemo(() => items.slice(0, maxItems), [items, maxItems])

  if (visible.length === 0) return null

  return (
    <div className="recently-viewed">
      <div className="recently-viewed-head">
        <div>
          <div className="recently-viewed-title">{t('recently_viewed', 'Recently viewed')}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {t('recently_viewed_hint', 'Pick up where you left off.')}
          </div>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            clearRecentlyViewed()
            setItems([])
          }}
        >
          {t('clear', 'Clear')}
        </button>
      </div>

      <div className="recently-viewed-row">
        {visible.map((it) => (
          <Link key={`${it.kind}-${it.id}`} to={it.path} className="recently-viewed-card">
            <div className="recently-viewed-thumb" style={{ backgroundImage: `url(${it.imageUrl})` }} />
            <div className="recently-viewed-body">
              <div className="recently-viewed-meta">
                <span className="pill">{KIND_LABEL[it.kind]}</span>
                {it.itemType ? <span className="pill">{it.itemType}</span> : null}
              </div>
              <div className="recently-viewed-name">{it.name}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

