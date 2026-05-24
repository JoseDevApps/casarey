export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export type UserRole = 'CLIENT' | 'ADMIN' | 'SUPER_ADMIN'
export type ReservationStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED_WAITING_PAYMENT'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED'
export type CalendarStatus = 'BOOKED' | 'BLOCKED'

export interface User {
  id: string
  email: string
  full_name: string
  phone?: string
  role: UserRole
  is_active: boolean
  email_verified: boolean
  must_change_password: boolean
  created_at: string
}

export interface Property {
  id: string
  owner_id: string
  name: string
  description?: string
  address?: string
  latitude?: number
  longitude?: number
  checkin_time: string
  checkout_time: string
  max_guests: number
  rate_adult: number
  rate_child: number
  rate_night_1: number
  rate_night_2: number
  rate_night_3: number
  is_active: boolean
  images: PropertyImage[]
  created_at: string
  video_status?: 'PROCESSING' | 'READY' | 'FAILED' | null
  video_minio_key?: string | null
  video_poster_key?: string | null
}

export interface PropertyImage {
  id: string
  minio_key: string
  sort_order: number
}

export interface CalendarEntry {
  date: string
  status: CalendarStatus
  blocked_reason?: string
}

export interface ReservationPropertySummary {
  id: string
  owner_id: string
  name: string
  address?: string | null
  image_url?: string | null
}

export interface Reservation {
  id: string
  property_id: string
  client_id: string
  check_in_date: string
  check_out_date: string
  num_adults: number
  num_children: number
  snapshot_rate_adult: number
  snapshot_rate_child: number
  snapshot_nightly_rate: number
  snapshot_pricing_tier: number
  total_amount: number
  discount_amount: number
  final_amount: number
  status: ReservationStatus
  created_at: string
  updated_at?: string
  property?: ReservationPropertySummary | null
  client?: User
}

export interface BookingGuest {
  id: string
  full_name: string
  id_number: string
  phone?: string
}

export interface AdminNotificationPreferences {
  id: string
  owner_id: string
  notification_email?: string | null
  client_approved_subject: string
  client_approved_body: string
  client_rejected_subject: string
  client_rejected_body: string
  client_payment_received_subject: string
  client_payment_received_body: string
  client_payment_confirmed_subject: string
  client_payment_confirmed_body: string
  created_at: string
  updated_at: string
}

export interface PaymentMethod {
  id: string
  owner_id: string
  name: string
  description?: string
  minio_key?: string
  is_active: boolean
}

export interface CmsBanner {
  id: string
  title: string
  subtitle?: string
  minio_key?: string
  is_visible: boolean
  sort_order: number
}

export interface CmsPage {
  id: string
  slug: string
  title: string
  content: string
  updated_at: string
}

export interface FeaturedProperty {
  id: string
  property_id: string
  sort_order: number
  property?: Property
}
