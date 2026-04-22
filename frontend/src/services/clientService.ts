import api from './api'
import type { Client, ClientListResponse } from '@/types'

export const getClients = (params?: Record<string, unknown>) =>
  api.get<ClientListResponse>('/clients', { params }).then((r) => r.data)

export const getClient = (id: number) =>
  api.get<Client>(`/clients/${id}`).then((r) => r.data)

export const createClient = (data: unknown) =>
  api.post<Client>('/clients', data).then((r) => r.data)

export const updateClient = (id: number, data: unknown) =>
  api.patch<Client>(`/clients/${id}`, data).then((r) => r.data)

export const deleteClient = (id: number) =>
  api.delete(`/clients/${id}`)
