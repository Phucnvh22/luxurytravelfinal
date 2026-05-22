export type RecentlyViewedKind = 'destination' | 'experience' | 'service'

export type RecentlyViewedItem = {
  kind: RecentlyViewedKind
  id: number
  name: string
  imageUrl: string
  itemType?: string
  path: string
  viewedAt: number
}

const STORAGE_KEY = 'recentlyViewed.v1'
const MAX_ITEMS = 12

function safeParse(json: string | null): unknown {
  if (!json) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

function normalize(items: unknown): RecentlyViewedItem[] {
  if (!Array.isArray(items)) return []
  const out: RecentlyViewedItem[] = []
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Partial<RecentlyViewedItem>
    if (!r.kind || !r.id || !r.name || !r.imageUrl || !r.path || !r.viewedAt) continue
    if (r.kind !== 'destination' && r.kind !== 'experience' && r.kind !== 'service') continue
    const id = Number(r.id)
    const viewedAt = Number(r.viewedAt)
    if (!Number.isFinite(id) || !Number.isFinite(viewedAt)) continue
    out.push({
      kind: r.kind,
      id,
      name: String(r.name),
      imageUrl: String(r.imageUrl),
      itemType: r.itemType ? String(r.itemType) : undefined,
      path: String(r.path),
      viewedAt,
    })
  }
  out.sort((a, b) => b.viewedAt - a.viewedAt)
  return out.slice(0, MAX_ITEMS)
}

export function getRecentlyViewed(): RecentlyViewedItem[] {
  const raw = safeParse(localStorage.getItem(STORAGE_KEY))
  return normalize(raw)
}

export function addRecentlyViewed(input: Omit<RecentlyViewedItem, 'viewedAt'> & { viewedAt?: number }) {
  const next: RecentlyViewedItem = {
    ...input,
    viewedAt: typeof input.viewedAt === 'number' && Number.isFinite(input.viewedAt) ? input.viewedAt : Date.now(),
  }
  const current = getRecentlyViewed()
  const deduped = current.filter((it) => !(it.kind === next.kind && it.id === next.id))
  const merged = [next, ...deduped].slice(0, MAX_ITEMS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  window.dispatchEvent(new Event('recently-viewed:updated'))
}

export function clearRecentlyViewed() {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event('recently-viewed:updated'))
}

