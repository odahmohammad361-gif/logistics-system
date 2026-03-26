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
export type InvoiceStatus = 'draft' | 'sent' | 'approved' | 'paid' | 'cancelled'

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

export interface ContainerShort {
  id: number
  booking_number: string
  container_number: string | null
  container_type: string
  seal_no: string | null
  bl_number: string | null
}

export interface Invoice {
  id: number
  invoice_number: string
  invoice_type: InvoiceType
  status: InvoiceStatus
  client_id: number
  client: ClientShort
  issue_date: string
  due_date: string | null
  // Shipping details
  origin: string | null
  payment_terms: string | null
  shipping_term: string | null
  port_of_loading: string | null
  port_of_discharge: string | null
  shipping_marks: string | null
  // Container / B/L details
  container_no: string | null
  seal_no: string | null
  bl_number: string | null
  vessel_name: string | null
  voyage_number: string | null
  container_id: number | null
  container: ContainerShort | null
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

// ── Container ────────────────────────────────────────────────────────────────
export type ContainerStatus = 'booking' | 'in_transit' | 'arrived' | 'cleared' | 'delivered' | 'cancelled'
export type ContainerType = '20GP' | '40FT' | '40HQ' | 'AIR'

export interface ContainerClientEntry {
  id?: number
  client_id: number
  client?: { id: number; name: string; client_code: string } | null
  cbm: number | null
  cartons: number | null
  net_weight: number | null
  gross_weight: number | null
  freight_share: number | null
  notes: string | null
}

export interface ContainerAgentShort {
  id: number
  name: string
  name_ar: string | null
  country: string | null
  price_20gp: number | null
  price_40ft: number | null
  price_40hq: number | null
  price_air_kg: number | null
}

export interface Container {
  id: number
  booking_number: string
  container_number: string | null
  container_type: ContainerType
  status: ContainerStatus
  client_id: number
  client: { id: number; name: string; client_code: string } | null
  shipping_agent_id: number | null
  shipping_agent: ContainerAgentShort | null
  // B/L & seal
  seal_no: string | null
  bl_number: string | null
  // LCL
  is_lcl: boolean
  cargo_mode: string | null
  lcl_clients: ContainerClientEntry[]
  // Terms
  shipping_term: string | null
  payment_terms: string | null
  // Cargo
  cbm: number | null
  cartons: number | null
  net_weight: number | null
  gross_weight: number | null
  // Route
  port_of_loading: string | null
  port_of_discharge: string | null
  etd: string | null
  eta: string | null
  // Financials
  freight_cost: number | null
  currency: string
  // Goods
  goods_description: string | null
  goods_description_ar: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ContainerListResponse {
  total: number
  page: number
  page_size: number
  results: Container[]
}

export interface ContainerCapacity {
  container_type: string
  max_cbm: number | null
  max_weight_tons: number | null
  used_cbm: number
  used_weight_tons: number
  cbm_pct: number
  weight_pct: number
  agent_price: number | null
  lcl_clients: ContainerClientEntry[]
}

export interface OcrResult {
  bl_number: string | null
  seal_no: string | null
  container_number: string | null
  cargo_mode: 'FCL' | 'LCL' | 'unknown'
  raw_text: string
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
