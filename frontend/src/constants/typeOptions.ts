import type { NavKey } from './navigation'

export type TypeOption = {
  navKey: NavKey
  value: string
  labelKey: string
  fallbackLabel: string
  imageUrl: string
}

const accommodationShortImageUrl = encodeURI('/cau-rong.jpg')
const accommodationLongImageUrl = encodeURI('/cauvang-1654247842-9403-1654247849.jpg.webp')
const experiencePrivateTourImageUrl = encodeURI('/—Pngtree—a colorful hot air balloon_16332123.png')
const experienceDiningImageUrl = encodeURI('/—Pngtree—classic metallic desk bell with_21118389.png')
const experiencePhotoImageUrl = encodeURI('/acommodation.jpg')
const serviceCameraImageUrl = encodeURI('/—Pngtree—classic metallic desk bell with_21118389.png')
const serviceCleanImageUrl = encodeURI('/—Pngtree—warm family cartoon house_6261753.png')
const serviceCarImageUrl = encodeURI('/VF9.jpg')

export const TYPE_OPTIONS: TypeOption[] = [
  {
    navKey: 'accommodation',
    value: 'Ngắn hạng',
    labelKey: 'type_accommodation_short',
    fallbackLabel: 'Short stay',
    imageUrl: accommodationShortImageUrl,
  },
  {
    navKey: 'accommodation',
    value: 'Dài hạng',
    labelKey: 'type_accommodation_long',
    fallbackLabel: 'Long stay',
    imageUrl: accommodationLongImageUrl,
  },
  {
    navKey: 'experience',
    value: 'Private tour',
    labelKey: 'type_experience_private_tour',
    fallbackLabel: 'Private tour',
    imageUrl: experiencePrivateTourImageUrl,
  },
  {
    navKey: 'experience',
    value: 'Dining experience',
    labelKey: 'type_experience_dining',
    fallbackLabel: 'Dining experience',
    imageUrl: experienceDiningImageUrl,
  },
  {
    navKey: 'experience',
    value: 'Travel photograph',
    labelKey: 'type_experience_photo',
    fallbackLabel: 'Travel photograph',
    imageUrl: experiencePhotoImageUrl,
  },
  {
    navKey: 'service',
    value: 'Camera for rent',
    labelKey: 'type_service_camera',
    fallbackLabel: 'Camera for rent',
    imageUrl: serviceCameraImageUrl,
  },
  {
    navKey: 'service',
    value: 'Clean service',
    labelKey: 'type_service_clean',
    fallbackLabel: 'Clean service',
    imageUrl: serviceCleanImageUrl,
  },
  {
    navKey: 'service',
    value: 'Private car',
    labelKey: 'type_service_car',
    fallbackLabel: 'Private car',
    imageUrl: serviceCarImageUrl,
  },
]

export function getTypeOptions(navKey: NavKey) {
  return TYPE_OPTIONS.filter((o) => o.navKey === navKey)
}

export function getTypeLabelKey(navKey: NavKey, value: string) {
  return TYPE_OPTIONS.find((o) => o.navKey === navKey && o.value === value)?.labelKey
}

export function getTypeFallbackLabel(navKey: NavKey, value: string) {
  return TYPE_OPTIONS.find((o) => o.navKey === navKey && o.value === value)?.fallbackLabel ?? value
}

