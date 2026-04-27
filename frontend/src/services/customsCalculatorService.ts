import api from './api'
import type {
  CustomsCalculatorRequest,
  CustomsCalculatorResponse,
  CustomsEstimate,
  CustomsEstimateListResponse,
} from '@/types'

export const calculateCustoms = (data: CustomsCalculatorRequest) =>
  api.post<CustomsCalculatorResponse>('/customs-calculator/calculate', data).then((r) => r.data)

export const listCustomsEstimates = (params?: Record<string, unknown>) =>
  api.get<CustomsEstimateListResponse>('/customs-calculator/estimates', { params }).then((r) => r.data)

export const getCustomsEstimate = (id: number) =>
  api.get<CustomsEstimate>(`/customs-calculator/estimates/${id}`).then((r) => r.data)

export const createCustomsEstimate = (data: CustomsCalculatorRequest & {
  title?: string | null
  notes?: string | null
  client_id?: number | null
  invoice_id?: number | null
  booking_id?: number | null
  booking_cargo_line_id?: number | null
}) =>
  api.post<CustomsEstimate>('/customs-calculator/estimates', data).then((r) => r.data)

export const archiveCustomsEstimate = (id: number) =>
  api.delete(`/customs-calculator/estimates/${id}`)
