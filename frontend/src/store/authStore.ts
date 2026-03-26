import { create } from 'zustand'
import type { AuthUser } from '@/types'

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  setAuth: (user: AuthUser, token: string, refresh: string) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),

  setAuth: (user, token, refresh) => {
    localStorage.setItem('access_token', token)
    localStorage.setItem('refresh_token', refresh)
    set({ user, accessToken: token })
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, accessToken: null })
  },

  isAuthenticated: () => !!get().accessToken,
}))
