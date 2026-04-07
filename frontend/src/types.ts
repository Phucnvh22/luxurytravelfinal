export interface Category {
  id: number
  name: string
  iconUrl: string
  newFeature: boolean
}

export interface CategoryUpsertRequest {
  name: string
  iconUrl: string
  newFeature: boolean
}

export interface User {
  id: number
  username: string
  email?: string
  fullName: string
  role: 'ADMIN' | 'SELLER' | 'USER'
  commissionRate?: number
  commissionBalance?: number
}

export interface UserUpdateRequest {
  fullName: string
  username: string
  email?: string
  role: 'ADMIN' | 'SELLER' | 'USER'
  commissionRate?: number
}

export interface UserCreateRequest extends UserUpdateRequest {
  password?: string
}

export interface AuthResponse {
  token: string
  id: number
  username: string
  email?: string
  fullName: string
  role: 'ADMIN' | 'SELLER' | 'USER'
}

export type Destination = {
  id: number
  name: string
  location: string
  description: string
  priceFrom: number
  durationDays: number
  imageUrl: string
  createdAt: string
  videoUrls?: string[]
}

export type DestinationUpsertRequest = {
  name: string
  location: string
  description: string
  priceFrom: number
  durationDays: number
  imageUrl: string
  videoUrls?: string[]
}

export type TravelService = {
  id: number
  name: string
  description: string
  priceFrom: number
  imageUrl: string
  createdAt: string
  videoUrls?: string[]
}

export type TravelServiceUpsertRequest = {
  name: string
  description: string
  priceFrom: number
  imageUrl: string
  videoUrls?: string[]
}

export type Experience = {
  id: number
  name: string
  description: string
  priceFrom: number
  imageUrl: string
  createdAt: string
  videoUrls?: string[]
}

export type ExperienceUpsertRequest = {
  name: string
  description: string
  priceFrom: number
  imageUrl: string
  videoUrls?: string[]
}

export type BookingCreateRequest = {
  destinationId: number
  customerName: string
  email: string
  phone: string
  travelDate: string
  travelers: number
  notes?: string
  sellerId?: number
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED'

export type BookingResponse = {
  id: number
  destinationId: number
  destinationName: string
  customerName: string
  email: string
  phone: string
  travelDate: string
  travelers: number
  notes: string
  status: BookingStatus
  createdAt: string
  sellerId?: number
  userId?: number
  totalPrice?: number
  commissionAmount?: number
}

export type ServiceRequestCreateRequest = {
  serviceId: number
  customerName: string
  email: string
  phone: string
  travelDate: string
  travelers: number
  notes?: string
  sellerId?: number
}

export type ServiceRequestResponse = {
  id: number
  serviceId: number
  serviceName: string
  customerName: string
  email: string
  phone: string
  travelDate: string
  travelers: number
  notes: string
  status: BookingStatus
  createdAt: string
  sellerId?: number
  userId?: number
  totalPrice?: number
  commissionAmount?: number
}

export type ExperienceRequestCreateRequest = {
  experienceId: number
  customerName: string
  email: string
  phone: string
  travelDate: string
  travelers: number
  notes?: string
  sellerId?: number
}

export type ExperienceRequestResponse = {
  id: number
  experienceId: number
  experienceName: string
  customerName: string
  email: string
  phone: string
  travelDate: string
  travelers: number
  notes: string
  status: BookingStatus
  createdAt: string
  sellerId?: number
  userId?: number
  totalPrice?: number
  commissionAmount?: number
}
