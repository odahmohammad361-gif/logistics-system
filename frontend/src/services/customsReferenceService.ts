import api from './api'
import type { HSCodeReference } from '@/types'

export const listHSCodeReferences = (params?: Record<string, unknown>) =>
  api.get<HSCodeReference[]>('/customs-references/hs-codes', { params }).then((r) => r.data)

export const createHSCodeReference = (data: unknown) =>
  api.post<HSCodeReference>('/customs-references/hs-codes', data).then((r) => r.data)

export const updateHSCodeReference = (id: number, data: unknown) =>
  api.patch<HSCodeReference>(`/customs-references/hs-codes/${id}`, data).then((r) => r.data)
