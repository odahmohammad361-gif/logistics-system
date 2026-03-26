import api from './api'
import type { Branch } from '@/types'

export const getBranches = (): Promise<Branch[]> =>
  api.get<Branch[]>('/branches').then((r) => r.data)
