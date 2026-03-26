import { useUIStore } from '@/store/uiStore'

export const useRTL = () => {
  const { lang } = useUIStore()
  const isRTL = lang === 'ar'
  return { isRTL, dir: isRTL ? 'rtl' : 'ltr' } as const
}
