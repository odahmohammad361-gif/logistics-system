import api from './api'
import type { ClientPortalUser } from '@/store/clientPortalStore'

const BASE = '/client-portal'

export interface ClientShipment {
  booking_id: number
  booking_number: string
  mode: string
  status: string
  container_size: string | null
  carrier_name: string | null
  port_of_loading: string | null
  port_of_discharge: string | null
  etd: string | null
  eta: string | null
  container_no: string | null
  seal_no: string | null
  bl_number: string | null
  vessel_name: string | null
  voyage_number: string | null
  incoterm: string | null
  my_cbm: number | null
  my_cartons: number | null
  my_description: string | null
  my_description_ar: string | null
  my_gross_weight_kg: number | null
  my_freight_share: number | null
  notes: string | null
  max_cbm: number | null
  total_cbm_used: number
  fill_pct: number | null
  my_pct: number | null
}

export interface ClientInvoice {
  id: number
  invoice_number: string
  invoice_type: string
  status: string
  issue_date: string | null
  due_date: string | null
  total: number
  currency: string
  port_of_loading: string | null
  port_of_discharge: string | null
  container_no: string | null
  bl_number: string | null
  vessel_name: string | null
  notes: string | null
}

export const clientPortalLogin = (client_code: string, password: string) =>
  api.post<{ access_token: string; client: ClientPortalUser }>(`${BASE}/login`, { client_code, password })
    .then(r => r.data)

export const clientPortalMe = (token: string) =>
  api.get<ClientPortalUser>(`${BASE}/me`, { params: { token } }).then(r => r.data)

export const clientPortalInvoices = (token: string) =>
  api.get<{ results: ClientInvoice[] }>(`${BASE}/invoices`, { params: { token } }).then(r => r.data)

export const clientPortalShipments = (token: string) =>
  api.get<{ results: ClientShipment[] }>(`${BASE}/shipments`, { params: { token } }).then(r => r.data)
