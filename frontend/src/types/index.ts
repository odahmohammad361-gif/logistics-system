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
  product_id?: number | null
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
export interface AgentCarrierRate {
  id: number
  carrier_name: string
  rate_type: 'sea' | 'air'
  pol: string | null
  pod: string | null
  effective_date: string | null
  expiry_date: string | null
  sealing_day: string | null
  vessel_day: string | null
  loading_warehouse_id: number | null
  // FCL prices
  buy_20gp: number | null;  sell_20gp: number | null;  cbm_20gp: number | null
  buy_40ft: number | null;  sell_40ft: number | null;  cbm_40ft: number | null
  buy_40hq: number | null;  sell_40hq: number | null;  cbm_40hq: number | null
  // LCL per CBM — per container size
  buy_lcl_cbm: number | null; sell_lcl_cbm: number | null
  buy_air_kg: number | null; sell_air_kg: number | null
  min_load_kg: number | null
  max_load_kg: number | null
  buy_lcl_20gp: number | null; sell_lcl_20gp: number | null
  buy_lcl_40ft: number | null; sell_lcl_40ft: number | null
  buy_lcl_40hq: number | null; sell_lcl_40hq: number | null
  // Origin fees (warehouse → loading port)
  fee_loading: number | null
  fee_bl: number | null
  fee_trucking: number | null
  fee_other: number | null
  transit_sea_days: number | null
  transit_air_days: number | null
  notes: string | null
  is_active: boolean
}

export interface AgentPriceHistory {
  id: number
  carrier_name: string | null
  rate_type: 'sea' | 'air'
  pol: string | null
  pod: string | null
  effective_date: string
  expiry_date: string | null
  buy_20gp: number | null;  sell_20gp: number | null
  buy_40ft: number | null;  sell_40ft: number | null
  buy_40hq: number | null;  sell_40hq: number | null
  buy_air_kg: number | null; sell_air_kg: number | null
  min_load_kg: number | null
  max_load_kg: number | null
  buy_lcl_cbm: number | null; sell_lcl_cbm: number | null
  buy_lcl_20gp: number | null; sell_lcl_20gp: number | null
  buy_lcl_40ft: number | null; sell_lcl_40ft: number | null
  buy_lcl_40hq: number | null; sell_lcl_40hq: number | null
  transit_sea_days: number | null
  transit_air_days: number | null
  sealing_day: string | null
  vessel_day: string | null
  loading_warehouse_id: number | null
  fee_loading: number | null
  fee_bl: number | null
  fee_trucking: number | null
  fee_other: number | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface AgentContract {
  id: number
  title: string
  file_path: string
  original_filename: string | null
  valid_from: string | null
  valid_to: string | null
  notes: string | null
  uploaded_by: string | null
  created_at: string
}

export interface AgentEditLog {
  id: number
  action: string
  summary: string | null
  changed_by: string | null
  changed_at: string
}

export interface AgentQuoteSummary {
  id: number
  quote_number: string
  service_mode: string | null
  container_type: string | null
  incoterm: string | null
  incoterm_point: string | null
  carrier: string | null
  port_of_loading: string | null
  port_of_discharge: string | null
  status: string | null
  validity_from: string | null
  validity_to: string | null
  ocean_freight: number | null
  air_freight_per_kg: number | null
  baf: number | null
  eca_surcharge: number | null
  war_risk_surcharge: number | null
  thc_origin: number | null
  thc_destination: number | null
  customs_destination: number | null
  trucking_destination: number | null
  trucking_origin: number | null
  bl_fee: number | null
  doc_fee: number | null
  stuffing_fee: number | null
  total_origin: number | null
  total_destination: number | null
  total_surcharges: number | null
  total_all: number | null
  transit_days: number | null
  free_days_origin: number | null
  free_days_destination: number | null
  cut_off_days: number | null
  notes: string | null
}

export interface ShippingAgent {
  id: number
  name: string
  name_ar: string | null
  country: string | null
  contact_person: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  wechat_id: string | null
  warehouse_address: string | null
  warehouse_city: string | null
  bank_name: string | null
  bank_account: string | null
  bank_swift: string | null
  price_20gp: number | null
  price_40ft: number | null
  price_40hq: number | null
  price_air_kg: number | null
  buy_lcl_cbm: number | null
  sell_price_20gp: number | null
  sell_price_40ft: number | null
  sell_price_40hq: number | null
  sell_price_air_kg: number | null
  sell_lcl_cbm: number | null
  transit_sea_days: number | null
  transit_air_days: number | null
  serves_sea: boolean
  serves_air: boolean
  offer_valid_from: string | null
  offer_valid_to: string | null
  notes: string | null
  is_active: boolean
  quotes?: AgentQuoteSummary[]
  carrier_rates?: AgentCarrierRate[]
  price_history?: AgentPriceHistory[]
  contracts?: AgentContract[]
  edit_log?: AgentEditLog[]
}

export interface AgentListResponse {
  total: number
  page: number
  page_size: number
  results: ShippingAgent[]
}

// ── Clearance Agent ───────────────────────────────────────────────────────────
export interface ClearanceAgentRate {
  id: number
  service_mode: 'sea' | 'air'
  country: string | null
  port: string | null
  route: string | null
  container_size: string | null
  carrier_name: string | null
  buy_clearance_fee: number | null
  sell_clearance_fee: number | null
  buy_transportation: number | null
  sell_transportation: number | null
  buy_delivery_authorization: number | null
  sell_delivery_authorization: number | null
  buy_inspection_ramp: number | null
  sell_inspection_ramp: number | null
  buy_port_inspection: number | null
  sell_port_inspection: number | null
  buy_import_export_card_pct: number | null
  sell_import_export_card_pct: number | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ClearanceAgentEditLog {
  id: number
  action: string
  summary: string | null
  changed_by: string | null
  changed_at: string
}

export interface ClearanceAgent {
  id: number
  name: string
  name_ar: string | null
  country: string | null
  city: string | null
  address: string | null
  contact_person: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  license_number: string | null
  bank_name: string | null
  bank_account: string | null
  bank_swift: string | null
  clearance_fee: number | null
  service_fee: number | null
  transport_fee: number | null
  handling_fee: number | null
  storage_fee_per_day: number | null
  total_fixed_fees: number | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  rates?: ClearanceAgentRate[]
  edit_log?: ClearanceAgentEditLog[]
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

export interface BookingCargoDocument {
  id: number
  document_type: 'pi' | 'ci' | 'pl' | 'sc' | 'co' | 'bl_copy' | 'security_approval' | 'goods_invoice' | 'other'
  custom_file_type: string | null
  file_path: string
  original_filename: string | null
  uploaded_at: string
}

export interface BookingCargoLine {
  id: number
  booking_id: number
  client: { id: number; name: string; name_ar: string | null; client_code: string }
  invoice_id: number | null
  invoice_number: string | null
  sort_order: number
  goods_source: 'company_buying_service' | 'client_ready_goods' | null
  is_full_container_client: boolean
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
  extracted_goods: {
    version?: number
    extracted_at?: string
    confidence?: string
    invoice_id?: number | null
    invoice_number?: string | null
    invoice_no?: string | null
    source_documents?: Array<{ id: number; type: string; filename: string | null; characters?: number }>
    goods?: Array<{
      product_id?: number | null
      description?: string
      cartons?: number | null
      quantity?: number | null
      gross_weight_kg?: number | null
      cbm?: number | null
      hs_code?: string | null
      source?: string
    }>
  } | null
  clearance_through_us: boolean | null
  clearance_agent_id: number | null
  clearance_agent_name: string | null
  clearance_agent_rate_id: number | null
  manual_clearance_agent_name: string | null
  manual_clearance_agent_phone: string | null
  manual_clearance_agent_notes: string | null
  images: BookingCargoImage[]
  documents: BookingCargoDocument[]
  created_at: string
}

export interface BookingLoadingPhoto {
  id: number
  file_path: string
  original_filename: string | null
  caption: string | null
  uploaded_at: string
}

export interface Booking {
  id: number
  booking_number: string
  mode: BookingMode
  status: BookingStatus
  container_size: string | null
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
  sell_freight_cost: number | null
  currency: string
  notes: string | null
  is_direct_booking: boolean
  carrier_name: string | null
  max_cbm: number | null
  markup_pct: number | null
  agent: { id: number; name: string } | null
  branch: { id: number; name: string; name_ar: string | null; code: string } | null
  cargo_lines: BookingCargoLine[]
  total_cbm_used: number | null
  container_cbm_capacity: number | null
  fill_percent: number | null
  destination: 'jordan' | 'iraq' | null
  // Loading info
  loading_warehouse_id: number | null
  loading_warehouse_name: string | null
  loading_warehouse_city: string | null
  loading_date: string | null
  loading_notes: string | null
  loading_photos: BookingLoadingPhoto[]
  is_locked: boolean
  is_agent_snapshot?: boolean
  agent_carrier_rate_id?: number | null
  created_at: string
  updated_at: string
}

export interface BookingListItem {
  id: number
  booking_number: string
  mode: BookingMode
  status: BookingStatus
  container_size: string | null
  container_no: string | null
  bl_number: string | null
  vessel_name: string | null
  port_of_loading: string | null
  port_of_discharge: string | null
  etd: string | null
  eta: string | null
  client_count: number
  total_cbm_used: number | null
  fill_percent: number | null
  agent_name: string | null
  freight_cost: number | null
  sell_freight_cost: number | null
  max_cbm: number | null
  markup_pct: number | null
  destination: 'jordan' | 'iraq' | null
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

// ── Supplier ──────────────────────────────────────────────────────────────────
export interface Supplier {
  id: number
  code: string
  name: string
  name_ar: string | null
  market_location: string | null
  wechat_id: string | null
  phone: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SupplierListResponse {
  total: number
  results: Supplier[]
}

// ── Product ───────────────────────────────────────────────────────────────────
export interface ProductPhoto {
  id: number
  file_path: string
  is_main: boolean
  sort_order: number
}

export interface ProductMainCategory {
  id: number
  code: string
  name: string
  name_ar: string | null
  description: string | null
  sort_order: number
  is_active: boolean
}

export interface ProductSubcategory {
  id: number
  main_category_id: number
  code: string
  name: string
  name_ar: string | null
  description: string | null
  sort_order: number
  is_active: boolean
}

export interface HSCodeReference {
  id: number
  country: string
  hs_code: string
  chapter: string | null
  description: string
  description_ar: string | null
  customs_unit_basis: string | null
  customs_unit_quantity: string | null
  customs_estimated_value_usd: string | null
  customs_duty_pct: string | null
  sales_tax_pct: string | null
  other_tax_pct: string | null
  source_url: string | null
  notes: string | null
  import_allowed: boolean
  is_active: boolean
}

export interface ProductTypeReference {
  id: number
  main_category_id: number
  subcategory_id: number
  hs_code_ref_id: number | null
  code: string
  name: string
  name_ar: string | null
  description: string | null
  default_customs_unit_basis: string | null
  default_customs_estimated_value_usd: string | null
  default_customs_duty_pct: string | null
  default_sales_tax_pct: string | null
  default_other_tax_pct: string | null
  sort_order: number
  is_active: boolean
  hs_code_ref: HSCodeReference | null
}

export interface ProductReferenceData {
  main_categories: ProductMainCategory[]
  subcategories: ProductSubcategory[]
  product_types: ProductTypeReference[]
  hs_codes: HSCodeReference[]
}

export interface SupplierShort {
  id: number
  code: string
  name: string
  market_location: string | null
}

export interface Product {
  id: number
  code: string
  name: string
  name_ar: string | null
  category: string | null
  description: string | null
  description_ar: string | null
  supplier: SupplierShort | null
  main_category_id: number | null
  subcategory_id: number | null
  product_type_id: number | null
  hs_code_ref_id: number | null
  main_category: ProductMainCategory | null
  subcategory: ProductSubcategory | null
  product_type: ProductTypeReference | null
  hs_code_ref: HSCodeReference | null
  price_cny: string
  price_usd: string | null
  hs_code: string | null
  origin_country: string | null
  customs_category: string | null
  customs_unit_basis: string | null
  customs_estimated_value_usd: string | null
  customs_duty_pct: string | null
  sales_tax_pct: string | null
  other_tax_pct: string | null
  customs_notes: string | null
  pcs_per_carton: number
  cbm_per_carton: string
  min_order_cartons: number
  gross_weight_kg_per_carton: string | null
  net_weight_kg_per_carton: string | null
  carton_length_cm: string | null
  carton_width_cm: string | null
  carton_height_cm: string | null
  is_active: boolean
  is_featured: boolean
  photos: ProductPhoto[]
  created_at: string
  updated_at: string
}

export interface ProductListResponse {
  total: number
  page: number
  page_size: number
  results: Product[]
}

// ── Customs / Tax Calculator ────────────────────────────────────────────────
export interface CustomsCalculatorItemInput {
  product_id?: number | null
  description?: string | null
  description_ar?: string | null
  hs_code?: string | null
  customs_category?: string | null
  unit_basis?: string | null
  cartons?: string | number | null
  pieces_per_carton?: string | number | null
  quantity_pieces?: string | number | null
  gross_weight_kg?: string | number | null
  estimated_value_usd?: string | number | null
  shipping_cost_per_unit_usd?: string | number | null
  shipping_cost_total_usd?: string | number | null
  customs_duty_pct?: string | number | null
  sales_tax_pct?: string | number | null
  other_tax_pct?: string | number | null
  notes?: string | null
}

export interface CustomsCalculatorRequest {
  country: string
  currency: 'USD'
  items: CustomsCalculatorItemInput[]
}

export interface CustomsCalculatorItemResult {
  product_id: number | null
  description: string
  description_ar: string | null
  hs_code: string | null
  customs_category: string | null
  unit_basis: string
  cartons: string
  pieces_per_carton: string
  total_pieces: string
  gross_weight_kg: string
  customs_units: string
  estimated_value_per_unit_usd: string
  shipping_cost_per_unit_usd: string
  shipping_cost_total_usd: string
  product_value_usd: string
  customs_base_usd: string
  customs_duty_pct: string
  sales_tax_pct: string
  other_tax_pct: string
  total_tax_pct: string
  customs_duty_usd: string
  sales_tax_usd: string
  other_tax_usd: string
  total_taxes_usd: string
  landed_estimate_usd: string
  warnings: string[]
}

export interface CustomsCalculatorTotals {
  product_value_usd: string
  shipping_cost_usd: string
  customs_base_usd: string
  customs_duty_usd: string
  sales_tax_usd: string
  other_tax_usd: string
  total_taxes_usd: string
  landed_estimate_usd: string
}

export interface CustomsCalculatorResponse {
  country: string
  currency: 'USD'
  items: CustomsCalculatorItemResult[]
  totals: CustomsCalculatorTotals
}

export interface CustomsEstimateLine extends CustomsCalculatorItemResult {
  id: number
  sort_order: number
}

export interface CustomsEstimate {
  id: number
  estimate_number: string
  title: string | null
  country: string
  currency: 'USD'
  status: string
  notes: string | null
  client_id: number | null
  invoice_id: number | null
  booking_id: number | null
  booking_cargo_line_id: number | null
  client: AccountingClientShort | null
  invoice: {
    id: number
    invoice_number: string
    invoice_type: string
    total: string
    currency: string
  } | null
  booking: AccountingBookingShort | null
  cargo_line: {
    id: number
    booking_id: number
    client_id: number
    client_code: string | null
    client_name: string | null
    cartons: string | null
    cbm: string | null
  } | null
  product_value_usd: string
  shipping_cost_usd: string
  customs_base_usd: string
  customs_duty_usd: string
  sales_tax_usd: string
  other_tax_usd: string
  total_taxes_usd: string
  landed_estimate_usd: string
  created_at: string
  updated_at: string
  lines: CustomsEstimateLine[]
}

export interface CustomsEstimateListResponse {
  total: number
  page: number
  page_size: number
  results: CustomsEstimate[]
}

// ── Customer (shop) ───────────────────────────────────────────────────────────
export interface Customer {
  id: number
  full_name: string
  email: string
  phone: string
  telegram: string | null
  country: string
  is_verified: boolean
  created_at: string
}

export interface CustomerAdmin {
  id: number
  full_name: string
  email: string
  phone: string
  telegram: string | null
  country: string
  is_verified: boolean
  is_active: boolean
  notes: string | null
  created_at: string
}

export interface CustomerAdminListResponse {
  total: number
  page: number
  page_size: number
  results: CustomerAdmin[]
}

export interface CustomerTokenResponse {
  access_token: string
  token_type: string
  customer: Customer
}

// ── Shipping Calculator ───────────────────────────────────────────────────────
export interface ShippingOption {
  container_type: string
  capacity_cbm: number
  containers_needed: number
  cbm_used_percent: number
  freight_per_container_usd: number
  total_freight_usd: number
  clearance_fees_usd: number
  total_cost_usd: number
  cost_per_cbm_usd: number
  agent_name: string | null
  clearance_agent: string | null
  transit_days: number | null
}

export interface ShippingCalculatorResult {
  destination: string
  total_cbm: number
  usd_to_cny_rate: number
  options: ShippingOption[]
}

export interface ShopOrderItem {
  id: number
  product_id: number | null
  product_code: string | null
  product_name: string
  product_name_ar: string | null
  hs_code: string | null
  cartons: string
  pcs_per_carton: string | null
  quantity: string
  unit_price_usd: string
  total_price_usd: string
  cbm: string | null
  gross_weight_kg: string | null
  net_weight_kg: string | null
  notes: string | null
  sort_order: number
  created_at: string
}

export interface ShopOrder {
  id: number
  order_number: string
  customer_id: number
  client_id: number | null
  status: string
  destination: string | null
  currency: string
  subtotal_usd: string
  total_cartons: string
  total_pieces: string
  total_cbm: string
  total_gross_weight_kg: string | null
  notes: string | null
  created_at: string
  updated_at: string
  items: ShopOrderItem[]
}

export interface ShopOrderListResponse {
  total: number
  results: ShopOrder[]
}

// ── Accounting ───────────────────────────────────────────────────────────────
export type AccountingDirection = 'money_in' | 'money_out'
export type AccountingStatus = 'draft' | 'posted' | 'needs_review' | 'void'

export interface AccountingClientShort {
  id: number
  client_code: string
  name: string
  name_ar: string | null
}

export interface AccountingInvoiceShort {
  id: number
  invoice_number: string
  total: string
  currency: string
}

export interface AccountingBookingShort {
  id: number
  booking_number: string
  mode: string
  container_size: string | null
  container_no: string | null
}

export interface AccountingNamedShort {
  id: number
  name: string
  name_ar: string | null
}

export interface AccountingAttachment {
  id: number
  document_type: string
  file_path: string
  original_filename: string | null
  content_type: string | null
  file_size: number | null
  created_at: string
}

export interface AccountingEntry {
  id: number
  entry_number: string
  direction: AccountingDirection
  status: AccountingStatus
  entry_date: string
  amount: string
  currency: string
  payment_method: string
  category: string
  counterparty_type: string | null
  counterparty_name: string | null
  reference_no: string | null
  description: string | null
  notes: string | null
  client: AccountingClientShort | null
  invoice: AccountingInvoiceShort | null
  booking: AccountingBookingShort | null
  shipping_agent: AccountingNamedShort | null
  clearance_agent: AccountingNamedShort | null
  supplier: AccountingNamedShort | null
  tax_rate_pct: string | null
  tax_amount: string | null
  has_official_tax_invoice: boolean
  attachments: AccountingAttachment[]
  created_at: string
  updated_at: string
}

export interface AccountingEntryListResponse {
  total: number
  page: number
  page_size: number
  results: AccountingEntry[]
}

export interface AccountingSummary {
  money_in: string
  money_out: string
  balance: string
  needs_review: number
  recent_count: number
}

export type BankLineMatchStatus = 'matched' | 'possible' | 'unmatched' | 'ignored'

export interface BankStatementImport {
  id: number
  bank_name: string | null
  account_name: string | null
  account_no: string | null
  statement_from: string | null
  statement_to: string | null
  original_filename: string | null
  file_path: string
  currency: string
  line_count: number
  status: string
  notes: string | null
  created_at: string
}

export interface BankStatementImportListResponse {
  total: number
  results: BankStatementImport[]
}

export interface BankStatementLine {
  id: number
  statement_id: number
  transaction_date: string
  direction: AccountingDirection
  amount: string
  currency: string
  description: string | null
  reference_no: string | null
  balance: string | null
  match_status: BankLineMatchStatus
  matched_entry_id: number | null
  matched_entry: AccountingEntry | null
  match_confidence: number | null
  match_reason: string | null
}

export interface BankStatementLineListResponse {
  total: number
  results: BankStatementLine[]
}

export interface BankStatementUploadResponse {
  statement: BankStatementImport
  total_lines: number
  matched: number
  possible: number
  unmatched: number
}

export interface AccountingCategoryTotal {
  direction: AccountingDirection
  category: string
  amount: string
  count: number
}

export interface AccountingTaxAlert {
  id: number
  entry_number: string
  entry_date: string
  amount: string
  currency: string
  category: string
  counterparty_name: string | null
  description: string | null
  reason: string
}

export interface AccountingReportSummary {
  date_from: string | null
  date_to: string | null
  currency: string
  money_in: string
  money_out: string
  net: string
  tax_on_income: string
  tax_on_expenses: string
  tax_net: string
  needs_review_count: number
  missing_official_invoice_count: number
  missing_official_invoice_amount: string
  unmatched_bank_lines: number
  category_totals: AccountingCategoryTotal[]
  tax_alerts: AccountingTaxAlert[]
}
