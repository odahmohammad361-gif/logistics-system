import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Users, FileText, Container, Ship, Shield,
  TrendingUp, Settings, UserCog, LogOut, ChevronLeft, ChevronRight, Menu,
} from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { useRTL } from '@/hooks/useRTL'
import clsx from 'clsx'

const NAV = [
  { to: '/dashboard',        icon: LayoutDashboard, key: 'dashboard' },
  { to: '/clients',          icon: Users,           key: 'clients' },
  { to: '/invoices',         icon: FileText,        key: 'invoices' },
  { to: '/containers',       icon: Container,       key: 'containers' },
  { to: '/shipping-agents',  icon: Ship,            key: 'shipping_agents' },
  { to: '/clearance-agents', icon: Shield,          key: 'clearance_agents' },
  { to: '/market',           icon: TrendingUp,      key: 'market' },
  { to: '/users',            icon: UserCog,         key: 'users' },
  { to: '/company',          icon: Settings,        key: 'company' },
]

export default function Sidebar() {
  const { t } = useTranslation()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { logout } = useAuthStore()
  const { isRTL } = useRTL()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  const CollapseIcon = isRTL
    ? (sidebarOpen ? ChevronRight : ChevronLeft)
    : (sidebarOpen ? ChevronLeft : ChevronRight)

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={clsx(
          'fixed top-0 h-full z-30 flex flex-col bg-brand-navy',
          'border-e border-brand-border/60',
          'transition-all duration-300 ease-in-out',
          isRTL ? 'right-0' : 'left-0',
          sidebarOpen ? 'w-64' : 'w-16',
        )}
      >
        {/* Header */}
        <div className="flex items-center h-16 px-3 border-b border-brand-border/50 gap-3 shrink-0">
          {sidebarOpen ? (
            <div className="flex-1 min-w-0 flex items-center gap-2.5">
              <div className="w-8 h-8 bg-brand-green rounded-lg flex items-center justify-center shrink-0">
                <span className="text-black font-black text-sm leading-none">WI</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {t('app.name')}
                </p>
                <p className="text-[10px] text-gray-500 truncate">{t('app.name_cn')}</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 bg-brand-green rounded-lg flex items-center justify-center mx-auto">
              <span className="text-black font-black text-sm">WI</span>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors shrink-0"
          >
            {sidebarOpen ? <CollapseIcon size={15} /> : <Menu size={15} />}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {NAV.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => clsx('nav-link', isActive && 'active')}
              title={!sidebarOpen ? t(`nav.${key}`) : undefined}
            >
              <Icon size={17} className="shrink-0" />
              {sidebarOpen && (
                <span className="truncate text-[13px]">{t(`nav.${key}`)}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-brand-border/50 shrink-0">
          <button
            onClick={handleLogout}
            className={clsx(
              'nav-link w-full text-red-400/80 hover:text-red-300 hover:bg-red-500/10',
              !sidebarOpen && 'justify-center'
            )}
            title={!sidebarOpen ? t('nav.logout') : undefined}
          >
            <LogOut size={17} className="shrink-0" />
            {sidebarOpen && <span className="text-[13px]">{t('nav.logout')}</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
