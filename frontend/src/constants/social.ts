export const SUPPORT_PHONE_E164 = '849357572725'
export const WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE_E164}`
export const ZALO_URL = `https://zalo.me/${SUPPORT_PHONE_E164}`
export const KAKAOTALK_URL = 'https://open.kakao.com/'

export const SOCIAL_CHANNELS = [
  { key: 'whatsapp', label: 'WhatsApp', href: WHATSAPP_URL, icon: '/social/whatsapp.svg' },
  { key: 'zalo', label: 'Zalo', href: ZALO_URL, icon: '/social/zalo.svg' },
  { key: 'kakaotalk', label: 'KakaoTalk', href: KAKAOTALK_URL, icon: '/social/kakaotalk.svg' },
] as const

export type SupportChannelKey = (typeof SOCIAL_CHANNELS)[number]['key'] | 'generic'

export function detectSupportChannel(rawUrl?: string | null) {
  const normalized = rawUrl?.trim() ?? ''
  if (!normalized) {
    return { key: 'whatsapp' as SupportChannelKey, label: 'WhatsApp', href: WHATSAPP_URL }
  }

  const lowerUrl = normalized.toLowerCase()
  if (lowerUrl.includes('zalo.me') || lowerUrl.includes('zaloapp.com')) {
    return { key: 'zalo' as SupportChannelKey, label: 'Zalo', href: normalized }
  }
  if (lowerUrl.includes('kakao.com') || lowerUrl.includes('kakaotalk') || lowerUrl.includes('open.kakao.com')) {
    return { key: 'kakaotalk' as SupportChannelKey, label: 'KakaoTalk', href: normalized }
  }
  if (lowerUrl.includes('wa.me') || lowerUrl.includes('whatsapp.com')) {
    return { key: 'whatsapp' as SupportChannelKey, label: 'WhatsApp', href: normalized }
  }
  return { key: 'generic' as SupportChannelKey, label: 'Support link', href: normalized }
}

export function buildSupportQrUrl(rawUrl?: string | null) {
  const channel = detectSupportChannel(rawUrl)
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(channel.href)}`
}
