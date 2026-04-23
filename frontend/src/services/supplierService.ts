import api from './api'
import type { Supplier, SupplierListResponse } from '@/types'

export const getSuppliers = (params?: Record<string, unknown>) =>
  api.get<SupplierListResponse>('/suppliers', { params }).then((r) => r.data)

export const createSupplier = (data: unknown) =>
  api.post<Supplier>('/suppliers', data).then((r) => r.data)

export const updateSupplier = (id: number, data: unknown) =>
  api.patch<Supplier>(`/suppliers/${id}`, data).then((r) => r.data)

export const deleteSupplier = (id: number) =>
  api.delete(`/suppliers/${id}`)
