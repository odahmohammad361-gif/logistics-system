import { useTranslation } from 'react-i18next'
import { Menu, Globe, Tv2, Bell } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import ThemePicker from '@/components/ui/ThemePicker'

export default function TopBar() {
  const { t }                        = useTranslation()
  const { toggleSidebar, lang, setLang } = useUIStore()
  const { user }                     = useAuthStore()

  return (
    <header
      className="h-14 flex items-center px-4 gap-3 shrink-0 z-10"
      style={{
        background: 'color-mix(in srgb, var(--brand-card) 85%, transparent)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--brand-border)',
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

      {/* Theme picker */}
      <ThemePicker />

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
            style={{ background: 'color-mix(in srgb, var(--brand-primary) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
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
