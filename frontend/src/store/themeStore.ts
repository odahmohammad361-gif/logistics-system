import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeId =
  | 'default'
  | 'accent-purple'
  | 'accent-emerald'
  | 'accent-rose'
  | 'accent-amber'
  | 'accent-cyan'
  | 'accent-blue'
  | 'accent-teal'

export interface ThemeMeta {
  id:      ThemeId
  name:    string
  nameAr:  string
  color:   string   // primary hex — shown in the picker dot
}

export const THEMES: ThemeMeta[] = [
  { id: 'default',        name: 'Indigo',   nameAr: 'نيلي',      color: '#6366F1' },
  { id: 'accent-purple',  name: 'Purple',   nameAr: 'بنفسجي',    color: '#8B5CF6' },
  { id: 'accent-blue',    name: 'Blue',     nameAr: 'أزرق',      color: '#3B82F6' },
  { id: 'accent-cyan',    name: 'Cyan',     nameAr: 'سماوي',     color: '#06B6D4' },
  { id: 'accent-teal',    name: 'Teal',     nameAr: 'زيتي',      color: '#14B8A6' },
  { id: 'accent-emerald', name: 'Emerald',  nameAr: 'زمردي',     color: '#10B981' },
  { id: 'accent-amber',   name: 'Amber',    nameAr: 'عنبري',     color: '#F59E0B' },
  { id: 'accent-rose',    name: 'Rose',     nameAr: 'وردي',      color: '#F43F5E' },
]

interface ThemeStore {
  themeId: ThemeId
  setTheme: (id: ThemeId) => void
}

function applyTheme(id: ThemeId) {
  // 'default' → remove the attribute so :root styles apply
  if (id === 'default') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', id)
  }
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      themeId:  'default',
      setTheme: (id) => { set({ themeId: id }); applyTheme(id) },
    }),
    { name: 'app-theme' },
  ),
)

// Called once on app start before React renders
export function applyStoredTheme() {
  try {
    const stored = JSON.parse(localStorage.getItem('app-theme') ?? '{}')
    const id: ThemeId = stored?.state?.themeId ?? 'default'
    applyTheme(id)
  } catch {
    // default theme — no attribute needed
  }
}
