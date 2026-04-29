import api from './api'
import type { Invoice, ServiceQuote, ServiceQuoteListResponse, ServiceQuoteSuggestion } from '@/types'

export interface ServiceQuotePayload {
  client_id: number
  mode: 'SEA_LCL' | 'SEA_FCL' | 'AIR'
  service_scope: 'port_to_port' | 'warehouse_to_port' | 'factory_to_port' | 'warehouse_to_door' | 'factory_to_door'
  cargo_source: string
  origin_country?: string | null
  origin_city?: string | null
  pickup_address?: string | null
  loading_warehouse_id?: number | null
  port_of_loading?: string | null
  port_of_discharge?: string | null
  destination_country?: string | null
  destination_city?: string | null
  final_address?: string | null
  container_size?: string | null
  cbm?: number | null
  gross_weight_kg?: number | null
  chargeable_weight_kg?: number | null
  cartons?: number | null
  goods_description?: string | null
  hs_code_ref_id?: number | null
  hs_code?: string | null
  clearance_through_us?: boolean
  delivery_through_us?: boolean
  clearance_agent_id?: number | null
  clearance_agent_rate_id?: number | null
  customs_value_usd?: number | null
  shipping_agent_id?: number | null
  agent_carrier_rate_id?: number | null
  city_fee_id?: number | null
  carrier_name?: string | null
  manual_sell_rate?: number | null
  manual_buy_rate?: number | null
  origin_fees_sell?: number | null
  origin_fees_buy?: number | null
  destination_fees_sell?: number | null
  destination_fees_buy?: number | null
  other_fees_sell?: number | null
  other_fees_buy?: number | null
  notes?: string | null
}

export const getServiceQuotes = (clientId?: number) =>
  api.get<ServiceQuoteListResponse>('/service-quotes', { params: { client_id: clientId } }).then((r) => r.data)

export const suggestServiceQuoteRates = (params: Record<string, unknown>) =>
  api.get<ServiceQuoteSuggestion[]>('/service-quotes/suggestions', { params }).then((r) => r.data)

export const createServiceQuote = (data: ServiceQuotePayload) =>
  api.post<ServiceQuote>('/service-quotes', data).then((r) => r.data)

export const updateServiceQuote = (id: number, data: Partial<ServiceQuote>) =>
  api.patch<ServiceQuote>(`/service-quotes/${id}`, data).then((r) => r.data)

export const deleteServiceQuote = (id: number) =>
  api.delete(`/service-quotes/${id}`)

export const createShippingInvoiceFromQuote = (id: number) =>
  api.post<Invoice>(`/service-quotes/${id}/invoice`).then((r) => r.data)

export const downloadServiceQuotePrintHtml = (id: number, lang: 'ar' | 'en' = 'en') =>
  api.get<Blob>(`/service-quotes/${id}/print`, {
    params: { lang },
    responseType: 'blob',
  }).then((r) => r.data)

export const downloadServiceQuotePackage = (id: number) =>
  api.get<Blob>(`/service-quotes/${id}/clearance-package.zip`, {
    responseType: 'blob',
  }).then((r) => r.data)

export const createServiceQuoteFromCargoLine = (lineId: number, data: Partial<ServiceQuotePayload> = {}) =>
  api.post<ServiceQuote>(`/service-quotes/from-cargo-line/${lineId}`, data).then((r) => r.data)
