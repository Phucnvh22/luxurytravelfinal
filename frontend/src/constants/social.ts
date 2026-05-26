export const SUPPORT_PHONE_E164 = '849357572725'
export const WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE_E164}`
export const ZALO_URL = `https://zalo.me/${SUPPORT_PHONE_E164}`
export const KAKAOTALK_URL = 'https://open.kakao.com/'

export const SOCIAL_CHANNELS = [
  { key: 'whatsapp', label: 'WhatsApp', href: WHATSAPP_URL, icon: '/social/whatsapp.svg' },
  { key: 'zalo', label: 'Zalo', href: ZALO_URL, icon: '/social/zalo.svg' },
  { key: 'kakaotalk', label: 'KakaoTalk', href: KAKAOTALK_URL, icon: '/social/kakaotalk.svg' },
] as const
