import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Customer } from '@/types'

interface ShopState {
  token: string | null
  customer: Customer | null
  setAuth: (token: string, customer: Customer) => void
  clearAuth: () => void
}

export const useShopStore = create<ShopState>()(
  persist(
    (set) => ({
      token: null,
      customer: null,
      setAuth: (token, customer) => set({ token, customer }),
      clearAuth: () => set({ token: null, customer: null }),
    }),
    { name: 'shop-auth' }
  )
)
