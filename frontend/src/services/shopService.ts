import api from './api'
import type { Customer, CustomerTokenResponse, ShippingCalculatorResult, ShopOrder, ShopOrderListResponse } from '@/types'

export const shopSignup = (data: {
  full_name: string
  email: string
  phone: string
  telegram?: string
  country: string
  password: string
}) => api.post<CustomerTokenResponse>('/shop/signup', data).then((r) => r.data)

export const shopLogin = (data: { email: string; password: string }) =>
  api.post<CustomerTokenResponse>('/shop/login', data).then((r) => r.data)

export const shopGetMe = (token: string) =>
  api.get<Customer>('/shop/me', { params: { token } }).then((r) => r.data)

export const calculateShipping = (totalCbm: number, destination: 'jordan' | 'iraq') =>
  api
    .get<ShippingCalculatorResult>('/shop/calculate-shipping', {
      params: { total_cbm: totalCbm, destination },
    })
    .then((r) => r.data)

export const createShopOrder = (
  token: string,
  data: {
    destination: 'jordan' | 'iraq'
    notes?: string | null
    items: Array<{ product_id: number; cartons: number; notes?: string | null }>
  },
) =>
  api.post<ShopOrder>('/shop/orders', data, { params: { token } }).then((r) => r.data)

export const listShopOrders = (token: string) =>
  api.get<ShopOrderListResponse>('/shop/orders', { params: { token } }).then((r) => r.data)
