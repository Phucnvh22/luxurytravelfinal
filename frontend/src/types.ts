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
  role: 'ADMIN' | 'CLEANER' | 'MAINTENANCE' | 'SELLER' | 'USER'
  commissionRate?: number
  commissionBalance?: number
}

export interface UserUpdateRequest {
  fullName: string
  username: string
  email?: string
  role: 'ADMIN' | 'CLEANER' | 'MAINTENANCE' | 'SELLER' | 'USER'
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
  role: 'ADMIN' | 'CLEANER' | 'MAINTENANCE' | 'SELLER' | 'USER'
}

export type RoomWorkLogAction = 'CLEANING_COMPLETED' | 'REPAIR_REPORTED' | 'REPAIR_RESOLVED'

export interface RoomWorkLog {
  id: number
  roomId: number
  roomCode: string
  roomName: string
  action: RoomWorkLogAction
  actorUsername: string
  actorName: string
  actorRole: 'ADMIN' | 'CLEANER' | 'MAINTENANCE' | 'SELLER' | 'USER'
  details?: string
  occurredAt: string
}

export type Destination = {
  id: number
  name: string
  location: string
  description: string
  type: string
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
  type: string
  priceFrom: number
  durationDays: number
  imageUrl: string
  videoUrls?: string[]
}

export type TravelService = {
  id: number
  name: string
  description: string
  type: string
  priceFrom: number
  imageUrl: string
  createdAt: string
  videoUrls?: string[]
}

export type TravelServiceUpsertRequest = {
  name: string
  description: string
  type: string
  priceFrom: number
  imageUrl: string
  videoUrls?: string[]
}

export type Experience = {
  id: number
  name: string
  description: string
  type: string
  priceFrom: number
  imageUrl: string
  createdAt: string
  videoUrls?: string[]
}

export type ExperienceUpsertRequest = {
  name: string
  description: string
  type: string
  priceFrom: number
  imageUrl: string
  videoUrls?: string[]
}

export type RoomArea = {
  id: number
  code: string
  name: string
  sortOrder: number
  active: boolean
}

export type RoomAreaUpsertRequest = {
  name: string
  sortOrder: number
  active: boolean
}

export type VillaSettingCategory = 'ROOM_TYPE' | 'HOST' | 'BOOKING_SOURCE'

export type VillaSettingOption = {
  id: number
  category: VillaSettingCategory
  label: string
  sortOrder: number
  active: boolean
}

export type VillaSettingUpsertRequest = {
  category: VillaSettingCategory
  label: string
}

export type VillaSettingsResponse = {
  roomTypes: VillaSettingOption[]
  hosts: VillaSettingOption[]
  bookingSources: VillaSettingOption[]
}

export type Room = {
  id: number
  code: string
  areaId?: number
  areaCode?: string
  areaName?: string
  name: string
  host: string
  type: string
  airbnbUrl: string
  floorNumber: number
  maxAdults: number
  maxChildren: number
  active: boolean
  bedroomLayout: string
  location: string
  wifiName: string
  wifiPassword: string
  doorPassword: string
  notes: string
  operationalStatus?: 'READY' | 'CHECKED_IN' | 'NEEDS_CLEANING' | 'OOI' | null
  statusUpdatedAt?: string
  lastCheckInMarkedAt?: string
  lastCheckOutMarkedAt?: string
  cleaningRequestedAt?: string
  lastReadyAt?: string
  cleanedAt?: string
  cleanedByUsername?: string
  cleanedByName?: string
  repairNeeded?: boolean
  repairDetails?: string
  repairReportedAt?: string
  repairReportedByUsername?: string
  repairReportedByName?: string
  repairResolvedAt?: string
  repairResolvedByUsername?: string
  repairResolvedByName?: string
  ooiDetails?: string
  ooiMarkedAt?: string
  ooiMarkedByUsername?: string
  ooiMarkedByName?: string
  ooiClearedAt?: string
  ooiClearedByUsername?: string
  ooiClearedByName?: string
  assignedCleanerId?: number | null
}

export type RoomUpsertRequest = {
  code: string
  areaId: number
  name: string
  host: string
  type: string
  airbnbUrl: string
  floorNumber: number
  maxAdults: number
  maxChildren: number
  active: boolean
  bedroomLayout?: string
  location?: string
  wifiName?: string
  wifiPassword?: string
  doorPassword?: string
  notes?: string
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

export type RoomBookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'TEMP_BLOCK'
  | 'AIRBNB_BLOCK'
  | 'KAYSTAY_BLOCK'
  | 'SOPHIA_BLOCK'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'

export type RoomBookingRequest = {
  roomCode: string
  guestName: string
  source?: string
  phone?: string
  adults: number
  children: number
  checkInAt: string
  checkOutAt: string
  status: RoomBookingStatus
  villaRate?: number
  depositAmount?: number
  remainingAmount?: number
  notes?: string
}

export type RoomBookingResponse = {
  id: number
  roomCode: string
  guestName: string
  source: string
  phone: string
  adults: number
  children: number
  checkInAt: string
  checkOutAt: string
  status: RoomBookingStatus
  villaRate?: number
  serviceTotal?: number
  totalAmount?: number
  depositAmount?: number
  remainingAmount?: number
  notes: string
  createdAt: string
  updatedAt: string
  checkedInMarkedAt?: string
  checkedOutMarkedAt?: string
}

export type PublicRoomCalendarRoom = {
  code: string
  name: string
  type: string
  location: string
  airbnbUrl: string
}

export type PublicRoomCalendarBooking = {
  id: number
  roomCode: string
  checkInAt: string
  checkOutAt: string
  status: RoomBookingStatus
}

export type PublicRoomCalendarResponse = {
  rooms: PublicRoomCalendarRoom[]
  bookings: PublicRoomCalendarBooking[]
}

export type AirbnbSyncRunResponse = {
  success: boolean
  message: string
  logs: string[]
}

export type KayStaySyncRunResponse = {
  success: boolean
  message: string
  logs: string[]
}

export type SophiaSyncRunResponse = {
  success: boolean
  message: string
  logs: string[]
}

export type VillaServiceCatalog = {
  id: number
  name: string
  unitPrice?: number | null
  active: boolean
  usageCount: number
  vendors: VillaServiceVendor[]
  createdAt: string
  updatedAt: string
}

export type VillaServiceVendor = {
  id: number
  name: string
}

export type VillaServiceCatalogUpsertRequest = {
  name: string
  unitPrice?: number
  active?: boolean
  vendorNames: string[]
}

export type VillaServiceOrderStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED'
export type VillaServiceOrderType = 'BOOKING' | 'STANDALONE'

export type VillaServiceOrderItemRequest = {
  serviceId: number
  quantity: number
  unitPrice?: number
  vendorId?: number | null
  vendorCost?: number
}

export type VillaServiceOrderUpsertRequest = {
  customerName?: string
  customerPhone?: string
  serviceDate?: string
  depositAmount?: number
  notes?: string
  status?: VillaServiceOrderStatus
  items: VillaServiceOrderItemRequest[]
}

export type VillaServiceOrderItem = {
  id: number
  serviceId: number
  serviceName: string
  vendorId?: number | null
  vendorName?: string | null
  unitPrice: number
  quantity: number
  lineTotal: number
  vendorCost?: number | null
}

export type VillaServiceOrder = {
  id: number | null
  orderType: VillaServiceOrderType
  status: VillaServiceOrderStatus
  bookingId?: number | null
  bookingRoomCode?: string | null
  bookingGuestName?: string | null
  customerName: string
  customerPhone: string
  serviceDate?: string | null
  notes: string
  serviceTotal?: number
  vendorCostTotal?: number | null
  depositAmount?: number | null
  remainingAmount?: number | null
  bookingBaseAmount?: number | null
  finalTotal?: number | null
  createdAt?: string | null
  updatedAt?: string | null
  items: VillaServiceOrderItem[]
}

export type VillaServiceBookingOrderResponse = {
  booking: RoomBookingResponse
  order: VillaServiceOrder
}

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

export type AdminRequestSummary = {
  pendingServiceRequests: number
  pendingExperienceRequests: number
  latestServiceRequestId?: number
  latestExperienceRequestId?: number
  totalPendingRequests: number
}
