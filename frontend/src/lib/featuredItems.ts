import type { NavKey } from '../constants/navigation'

const FEATURED_NAV_KEYS_STORAGE = 'featuredNavKeys'

export function getFeaturedNavKeys(): NavKey[] {
  try {
    const stored = localStorage.getItem(FEATURED_NAV_KEYS_STORAGE)
    if (!stored) return []
    return JSON.parse(stored) as NavKey[]
  } catch {
    return []
  }
}

export function setFeaturedNavKeys(keys: NavKey[]): void {
  localStorage.setItem(FEATURED_NAV_KEYS_STORAGE, JSON.stringify(keys))
}

export function toggleFeaturedNavKey(key: NavKey): NavKey[] {
  const current = getFeaturedNavKeys()
  const exists = current.includes(key)
  const updated = exists ? current.filter((k) => k !== key) : [...current, key]
  setFeaturedNavKeys(updated)
  return updated
}

export function isNavKeyFeatured(key: NavKey): boolean {
  return getFeaturedNavKeys().includes(key)
}