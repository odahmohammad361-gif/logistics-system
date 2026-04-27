import api from './api'
import type { CustomsCalculatorRequest, CustomsCalculatorResponse } from '@/types'

export const calculateCustoms = (data: CustomsCalculatorRequest) =>
  api.post<CustomsCalculatorResponse>('/customs-calculator/calculate', data).then((r) => r.data)
