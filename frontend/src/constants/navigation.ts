export type NavKey = 'accommodation' | 'experience' | 'service'

export type NavigationItem = {
  id: number
  key: NavKey
  to: string
  iconUrl: string
  newFeature: boolean
  types: string[]
}

const accommodationIconUrl = encodeURI('/—Pngtree—warm family cartoon house_6261753.png')
const serviceIconUrl = encodeURI('/—Pngtree—classic metallic desk bell with_21118389.png')
const experienceIconUrl = encodeURI('/—Pngtree—a colorful hot air balloon_16332123.png')

export const NAV_ITEMS: NavigationItem[] = [
  {
    id: 1,
    key: 'accommodation',
    to: '/',
    iconUrl: accommodationIconUrl,
    newFeature: false,
    types: ['Ngắn hạng', 'Dài hạng'],
  },
  {
    id: 2,
    key: 'experience',
    to: '/experiences',
    iconUrl: experienceIconUrl,
    newFeature: true,
    types: ['Private tour', 'Dining experience', 'Travel photograph'],
  },
  {
    id: 3,
    key: 'service',
    to: '/services',
    iconUrl: serviceIconUrl,
    newFeature: true,
    types: ['Camera for rent', 'Clean service', 'Private car'],
  },
]
