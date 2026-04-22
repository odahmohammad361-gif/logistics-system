import { useTranslation } from 'react-i18next'
import { Menu, Globe, Tv2, Bell } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'

export default function TopBar() {
  const { t }                        = useTranslation()
  const { toggleSidebar, lang, setLang } = useUIStore()
  const { user }                     = useAuthStore()

  return (
    <header
      className="h-14 flex items-center px-4 gap-3 shrink-0 z-10"
      style={{
        background: 'rgba(6, 18, 32, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(18, 38, 63, 0.8)',
      }}
    >
      {/* Mobile menu */}
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-white/5 transition-colors md:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* TV Board */}
      <a
        href="/market/tv"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
                   text-brand-text-muted hover:text-brand-green hover:bg-brand-green/8"
      >
        <Tv2 size={14} />
        <span className="hidden sm:block">{t('market.tv_mode', 'شاشة العرض')}</span>
      </a>

      {/* Notification bell */}
      <button className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-white/5 transition-colors relative">
        <Bell size={17} />
        <span className="absolute top-1 end-1 w-1.5 h-1.5 bg-brand-primary rounded-full" />
      </button>

      {/* Language */}
      <button
        onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                   border border-brand-border text-brand-text-dim hover:text-brand-primary hover:border-brand-primary/50 hover:bg-brand-primary/5"
      >
        <Globe size={13} />
        <span>{lang === 'ar' ? 'EN' : 'عر'}</span>
      </button>

      {/* User avatar */}
      {user && (
        <div className="flex items-center gap-2.5 ps-1 cursor-default">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-brand-primary-light"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            {(user.full_name?.[0] ?? user.email[0]).toUpperCase()}
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-xs font-semibold text-brand-text">{user.full_name ?? user.email}</p>
            <p className="text-[10px] text-brand-text-muted">{t(`role.${user.role}`, user.role)}</p>
          </div>
        </div>
      )}
    </header>
  )
}
