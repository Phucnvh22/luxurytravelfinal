export type FeaturedCardType = 'destination' | 'experience' | 'service'

export type FeaturedCard = {
  id: number
  category: FeaturedCardType
}

const FEATURED_CARDS_STORAGE = 'featuredCards'

export function getFeaturedCards(): FeaturedCard[] {
  try {
    const stored = localStorage.getItem(FEATURED_CARDS_STORAGE)
    if (!stored) return []
    return JSON.parse(stored) as FeaturedCard[]
  } catch {
    return []
  }
}

export function setFeaturedCards(cards: FeaturedCard[]): void {
  localStorage.setItem(FEATURED_CARDS_STORAGE, JSON.stringify(cards))
}

export function toggleFeaturedCard(id: number, category: FeaturedCardType): FeaturedCard[] {
  const current = getFeaturedCards()
  const exists = current.some((c) => c.id === id && c.category === category)
  const updated = exists ? current.filter((c) => !(c.id === id && c.category === category)) : [...current, { id, category }]
  setFeaturedCards(updated)
  return updated
}

export function isCardFeatured(id: number, category: FeaturedCardType): boolean {
  return getFeaturedCards().some((c) => c.id === id && c.category === category)
}

export function getFeaturedCardIds(category: FeaturedCardType): number[] {
  return getFeaturedCards().filter((c) => c.category === category).map((c) => c.id)
}