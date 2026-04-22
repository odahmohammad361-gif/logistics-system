import { create } from 'zustand'

interface UIState {
  lang: 'ar' | 'en'
  sidebarOpen: boolean
  setLang: (lang: 'ar' | 'en') => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  lang: (localStorage.getItem('lang') as 'ar' | 'en') ?? 'ar',
  sidebarOpen: true,

  setLang: (lang) => {
    localStorage.setItem('lang', lang)
    set({ lang })
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
