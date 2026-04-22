// ── Auth ─────────────────────────────────────────────────────────────────────
export type UserRole = 'super_admin' | 'admin' | 'branch_manager' | 'staff' | 'viewer'

export interface AuthUser {
  id: number
  full_name: string
  full_name_ar: string | null
  email: string
  role: UserRole
  branch_id: number | null
  is_active: boolean
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

// ── Branch ───────────────────────────────────────────────────────────────────
export interface Branch {
  id: number
  name: string
  name_ar: string
  code: string
  country: string
}

// ── Client ───────────────────────────────────────────────────────────────────
export interface Client {
  id: number
  name: string
  name_ar?: string | null
  client_code: string
  phone: string | null
  email: string | null
  country: string | null
  city: string | null
  address: string | null
  company_name?: string | null
  company_name_ar?: string | null
  branch: Branch | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface ClientListResponse {
  total: number
  page: number
  page_size: number
  results: Client[]
}

// ── Invoice ──────────────────────────────────────────────────────────────────
export type InvoiceType = 'PRICE_OFFER' | 'PI' | 'CI' | 'PL' | 'SC'
export type InvoiceStatus = 'draft' | 'sent' | 'approved' | 'paid' | 'cancelled' | 'dummy'

export interface InvoiceItem {
  id?: number
  description: string
  description_ar?: string | null
  details?: string | null
  details_ar?: string | null
  hs_code: string | null
  quantity: number
  unit?: string | null
  unit_price: number
  total_price: number
  cartons?: number | null
  gross_weight?: number | null
  net_weight?: number | null
  cbm?: number | null
  product_image_path?: string | null
  // Air cargo dimensions
  carton_length_cm?: number | null
  carton_width_cm?: number | null
  carton_height_cm?: number | null
  volumetric_weight_kg?: number | null
  chargeable_weight_kg?: number | null
  sort_order?: number
}

export interface ClientShort {
  id: number
  client_code: string
  name: string
  name_ar: string | null
  company_name: string | null
  company_name_ar?: string | null
  address?: string | null
  phone: string | null
  email: string | null
}

export interface Invoice {
  id: number
  invoice_number: string
  invoice_type: InvoiceType
  status: InvoiceStatus
  client_id: number | null
  client: ClientShort | null
  buyer_name?: string | null
  issue_date: string
  due_date: string | null
  // Shipping details
  origin: string | null
  payment_terms: string | null
  shipping_term: string | null
  port_of_loading: string | null
  port_of_discharge: string | null
  shipping_marks: string | null
  // B/L & shipping reference details
  container_no: string | null
  seal_no: string | null
  bl_number: string | null
  vessel_name: string | null
  voyage_number: string | null
  // Bank details
  bank_account_name: string | null
  bank_account_no: string | null
  bank_swift: string | null
  bank_name: string | null
  bank_address: string | null
  // Assets
  stamp_image_path: string | null
  stamp_position: string | null
  document_background_path: string | null
  // Financials
  subtotal: number
  discount: number
  total: number
  currency: string
  notes: string | null
  notes_ar: string | null
  items: InvoiceItem[]
  created_at: string
  updated_at: string
}

export interface InvoiceListResponse {
  total: number
  page: number
  page_size: number
  results: Invoice[]
}

// ── Shipping Agent ────────────────────────────────────────────────────────────
export interface ShippingAgent {
  id: number
  name: string
  name_ar: string | null
  country: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
  wechat_id: string | null
  warehouse_address: string | null
  warehouse_city: string | null
  price_20gp: number | null
  price_40ft: number | null
  price_40hq: number | null
  price_air_kg: number | null
  transit_sea_days: number | null
  transit_air_days: number | null
  serves_sea: boolean
  serves_air: boolean
  notes: string | null
  is_active: boolean
}

export interface AgentListResponse {
  total: number
  page: number
  page_size: number
  results: ShippingAgent[]
}

// ── Clearance Agent ───────────────────────────────────────────────────────────
export interface ClearanceAgent {
  id: number
  name: string
  country: string | null
  city: string | null
  phone: string | null
  email: string | null
  license_number: string | null
  clearance_fee: number | null
  service_fee: number | null
  transport_fee: number | null
  handling_fee: number | null
  storage_fee_per_day: number | null
  total_fixed_fees: number | null
  notes: string | null
  is_active: boolean
}

export interface ClearanceAgentListResponse {
  total: number
  page: number
  page_size: number
  results: ClearanceAgent[]
}

// ── Market Board ──────────────────────────────────────────────────────────────
export interface RateEntry {
  currency: string
  rate: number
  inverse: number
}

export interface TopClientEntry {
  rank: number
  client_id: number
  name: string
  client_code: string
  value: number
  label: string
}

export interface RatesSnapshot {
  base: string
  rates: RateEntry[]
  fetched_at: string | null
  is_stale: boolean
}

export interface AgentRateEntry {
  quote_number: string
  agent_id: number
  agent_name: string
  agent_wechat: string | null
  route: string
  container_type: string | null
  incoterm: string | null
  transit_days: number | null
  total_usd: number | null
  ocean_freight: number | null
  validity_to: string | null
}

export interface AgentQuickPrice {
  agent_id: number
  agent_name: string
  agent_wechat: string | null
  warehouse_city: string | null
  country: string | null
  price_20gp: number | null
  price_40ft: number | null
  price_40hq: number | null
  price_air_kg: number | null
  transit_sea_days: number | null
  transit_air_days: number | null
}

export interface BoardResponse {
  rates: RatesSnapshot
  top_clients_by_revenue: TopClientEntry[]
  top_clients_by_shipments: TopClientEntry[]
  agent_rates: AgentRateEntry[]
  agent_quick_prices: AgentQuickPrice[]
  generated_at: string
}

// ── User ──────────────────────────────────────────────────────────────────────
export interface User {
  id: number
  full_name: string
  full_name_ar: string | null
  email: string
  role: UserRole
  branch_id: number | null
  is_active: boolean
  created_at: string
}

export interface UserListResponse {
  total: number
  page: number
  page_size: number
  results: User[]
}

// ── Pagination ────────────────────────────────────────────────────────────────
export interface PaginationParams {
  page?: number
  page_size?: number
  search?: string
}

// ── Bookings ──────────────────────────────────────────────────────────────────
export type BookingMode   = 'LCL' | 'FCL' | 'AIR'
export type BookingStatus = 'draft' | 'confirmed' | 'in_transit' | 'arrived' | 'delivered' | 'cancelled'

export interface BookingCargoImage {
  id: number
  file_path: string
  original_filename: string | null
  uploaded_at: string
}

export interface BookingCargoLine {
  id: number
  booking_id: number
  client: { id: number; name: string; name_ar: string | null; client_code: string }
  sort_order: number
  description: string | null
  description_ar: string | null
  hs_code: string | null
  shipping_marks: string | null
  cartons: number | null
  gross_weight_kg: number | null
  net_weight_kg: number | null
  cbm: number | null
  carton_length_cm: number | null
  carton_width_cm: number | null
  carton_height_cm: number | null
  volumetric_weight_kg: number | null
  chargeable_weight_kg: number | null
  freight_share: number | null
  notes: string | null
  images: BookingCargoImage[]
  created_at: string
}

export interface Booking {
  id: number
  booking_number: string
  mode: BookingMode
  status: BookingStatus
  container_size: string | null   // 20GP | 40GP | 40HQ
  container_no: string | null
  seal_no: string | null
  bl_number: string | null
  awb_number: string | null
  vessel_name: string | null
  voyage_number: string | null
  flight_number: string | null
  port_of_loading: string | null
  port_of_discharge: string | null
  etd: string | null
  eta: string | null
  incoterm: string | null
  freight_cost: number | null
  currency: string
  notes: string | null
  is_direct_booking: boolean
  carrier_name: string | null
  agent: { id: number; name: string } | null
  branch: { id: number; name: string; name_ar: string | null; code: string } | null
  cargo_lines: BookingCargoLine[]
  total_cbm_used: number | null
  container_cbm_capacity: number | null
  fill_percent: number | null
  created_at: string
  updated_at: string
}

export interface BookingListItem {
  id: number
  booking_number: string
  mode: BookingMode
  status: BookingStatus
  container_size: string | null
  port_of_loading: string | null
  port_of_discharge: string | null
  etd: string | null
  eta: string | null
  client_count: number
  total_cbm_used: number | null
  fill_percent: number | null
  agent_name: string | null
  created_at: string
}

// ── Company Warehouse ─────────────────────────────────────────────────────────
export interface CompanyWarehouse {
  id: number
  name: string
  name_ar: string | null
  warehouse_type: 'loading' | 'unloading'
  country: string | null
  city: string | null
  address: string | null
  contact_name: string | null
  phone: string | null
  notes: string | null
  is_active: boolean
  branch_id: number | null
  created_at: string
  updated_at: string
}

export interface WarehouseListResponse {
  total: number
  results: CompanyWarehouse[]
}

export interface BookingListResponse {
  total: number
  page: number
  page_size: number
  results: BookingListItem[]
}
