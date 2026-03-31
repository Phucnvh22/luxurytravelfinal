export type ApiError = {
  message?: string
  timestamp?: string
  fields?: Record<string, string>
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

export class HttpError extends Error {
  status: number
  body?: ApiError

  constructor(status: number, message: string, body?: ApiError) {
    super(message)
    this.status = status
    this.body = body
  }
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`
  const token = localStorage.getItem('token')
  const headers = new Headers(options.headers)

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let body
    try {
      body = await response.json()
    } catch {
      // ignore
    }
    const message = body?.message || response.statusText || 'API Error'
    throw new HttpError(response.status, message, body)
  }

  // Handle 204 No Content or empty responses
  const text = await response.text()
  if (!text) {
    return {} as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}
