import { useUIStore } from '@/store/uiStore'

export default function RTLWrapper({ children }: { children: React.ReactNode }) {
  const { lang } = useUIStore()
  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen">
      {children}
    </div>
  )
}
