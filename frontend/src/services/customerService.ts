import api from './api'
import type { CustomerAdmin, CustomerAdminListResponse } from '@/types'

const BASE = '/customers'

export const getCustomers = (params?: Record<string, unknown>) =>
  api.get<CustomerAdminListResponse>(BASE, { params }).then((r) => r.data)

export const updateCustomer = (id: number, data: { notes?: string; is_active?: boolean }) =>
  api.patch<CustomerAdmin>(`${BASE}/${id}`, data).then((r) => r.data)

export const migrateCustomer = (
  id: number,
  data: {
    name?: string; name_ar?: string; phone?: string; email?: string
    city?: string; country?: string; address?: string
    branch_id?: number; notes?: string
  },
) =>
  api
    .post<{ client: { id: number; client_code: string; name: string }; message: string }>(
      `${BASE}/${id}/migrate`,
      data,
    )
    .then((r) => r.data)

export const deleteCustomer = (id: number) => api.delete(`${BASE}/${id}`)
