import axios from 'axios'
import api from './api'
import type { BoardResponse } from '@/types'

// No auth — used by TV portal and dashboard
export const getBoard = () =>
  axios.get<BoardResponse>('/api/v1/market/board').then((r) => r.data)

export const refreshRates = () =>
  api.post('/market/rates/refresh').then((r) => r.data)

export const getTopClients = () => getBoard()
