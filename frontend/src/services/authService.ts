import axios from 'axios'
import type { TokenResponse, AuthUser } from '@/types'

export const login = async (username: string, password: string): Promise<TokenResponse> => {
  const params = new URLSearchParams({ username, password })
  const { data } = await axios.post<TokenResponse>('/api/v1/auth/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data
}

export const getMe = async (token: string): Promise<AuthUser> => {
  const { data } = await axios.get<AuthUser>('/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data
}
