import { useTranslation } from 'react-i18next'
import { Menu, Globe, Tv2 } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import clsx from 'clsx'

export default function TopBar() {
  const { t } = useTranslation()
  const { toggleSidebar, lang, setLang } = useUIStore()
  const { user } = useAuthStore()

  const switchLang = () => setLang(lang === 'ar' ? 'en' : 'ar')

  return (
    <header className="h-14 bg-brand-surface border-b border-brand-border/60 flex items-center px-4 gap-3 shrink-0">
      {/* Mobile menu toggle */}
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors md:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1" />

      {/* TV Board link */}
      <a
        href="/market/tv"
        target="_blank"
        rel="noopener noreferrer"
        className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
          'text-gray-400 hover:text-brand-green hover:bg-brand-green/5'
        )}
      >
        <Tv2 size={14} />
        <span className="hidden sm:block">{t('market.tv_mode')}</span>
      </a>

      {/* Language toggle */}
      <button
        onClick={switchLang}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
          'bg-brand-card border border-brand-border text-gray-300 hover:text-brand-green hover:border-brand-green/50'
        )}
      >
        <Globe size={13} />
        <span>{lang === 'ar' ? 'EN' : 'عر'}</span>
      </button>

      {/* User avatar */}
      {user && (
        <div className="flex items-center gap-2.5 ps-1">
          <div className="w-8 h-8 rounded-full bg-brand-green/15 border border-brand-green/25 flex items-center justify-center shrink-0">
            <span className="text-brand-green text-xs font-bold">
              {user.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-xs font-semibold text-white">{user.full_name}</p>
            <p className="text-[10px] text-gray-500">{t(`users.roles.${user.role}`)}</p>
          </div>
        </div>
      )}
    </header>
  )
}
