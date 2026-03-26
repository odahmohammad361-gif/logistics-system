import api from './api'

export const getPorts = () =>
  api.get<{ ports: Record<string, { sea: string[]; air: string[] }> }>('/reference/ports').then((r) => r.data)

export const getContainerLimits = () =>
  api.get<{ limits: Record<string, { max_weight_tons: number | null; max_cbm: number | null }> }>(
    '/reference/container-limits',
  ).then((r) => r.data)

export const getShippingTerms = () =>
  api.get<{ shipping_terms: string[] }>('/reference/shipping-terms').then((r) => r.data)

export const getPaymentTerms = () =>
  api.get<{ payment_terms: string[] }>('/reference/payment-terms').then((r) => r.data)
