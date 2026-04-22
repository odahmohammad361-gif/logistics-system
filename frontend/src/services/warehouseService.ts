import api from './api'
import type { CompanyWarehouse, WarehouseListResponse } from '@/types'

export const getWarehouses = (params?: Record<string, unknown>) =>
  api.get<WarehouseListResponse>('/warehouses', { params }).then(r => r.data)

export const createWarehouse = (data: unknown) =>
  api.post<CompanyWarehouse>('/warehouses', data).then(r => r.data)

export const updateWarehouse = (id: number, data: unknown) =>
  api.patch<CompanyWarehouse>(`/warehouses/${id}`, data).then(r => r.data)

export const deleteWarehouse = (id: number) =>
  api.delete(`/warehouses/${id}`)
