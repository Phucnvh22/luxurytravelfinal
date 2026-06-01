import { apiFetch } from './api'

export type FeaturedCardType = 'destination' | 'experience' | 'service'

export type FeaturedCard = {
  id: number
  category: FeaturedCardType
}

export type FeaturedCardUpsertRequest = {
  id: number
  category: FeaturedCardType
}

export async function fetchFeaturedCards(): Promise<FeaturedCard[]> {
  return apiFetch<FeaturedCard[]>('/api/featured-cards')
}

export async function addFeaturedCard(request: FeaturedCardUpsertRequest): Promise<FeaturedCard> {
  return apiFetch<FeaturedCard>('/api/admin/featured-cards', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export async function deleteFeaturedCard(category: FeaturedCardType, id: number): Promise<void> {
  await apiFetch<void>(`/api/admin/featured-cards/${encodeURIComponent(category)}/${id}`, { method: 'DELETE' })
}
