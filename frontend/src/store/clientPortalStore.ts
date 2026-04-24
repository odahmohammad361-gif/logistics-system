import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ClientPortalUser {
  id: number
  name: string
  name_ar: string | null
  client_code: string
  email: string | null
  phone: string | null
  country: string | null
  city: string | null
  address: string | null
  company_name: string | null
  company_name_ar: string | null
  branch: { id: number; name: string; name_ar: string | null; code: string } | null
  has_portal_access: boolean
}

interface ClientPortalStore {
  token: string | null
  client: ClientPortalUser | null
  setAuth: (token: string, client: ClientPortalUser) => void
  clearAuth: () => void
}

export const useClientPortalStore = create<ClientPortalStore>()(
  persist(
    (set) => ({
      token:  null,
      client: null,
      setAuth:   (token, client) => set({ token, client }),
      clearAuth: () => set({ token: null, client: null }),
    }),
    { name: 'client-portal-auth' },
  ),
)
