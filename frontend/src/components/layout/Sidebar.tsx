import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, FileText, Ship,
  Anchor, TrendingUp, UserCog, ChevronLeft, ChevronRight,
  LogOut, Building2, Container, Warehouse, Store, Package, FolderInput,
  Landmark,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { useRTL } from '@/hooks/useRTL'

const NAV = [
  { to: '/dashboard',        icon: LayoutDashboard, key: 'dashboard' },
  { to: '/clients',          icon: Users,           key: 'clients' },
  { to: '/accounting',       icon: Landmark,        key: 'accounting' },
  { to: '/invoices',         icon: FileText,        key: 'invoices' },
  { to: '/containers',       icon: Container,       key: 'containers' },
  { to: '/shipping-agents',  icon: Ship,            key: 'shipping_agents' },
  { to: '/clearance-agents', icon: Anchor,          key: 'clearance_agents' },
  { to: '/market',           icon: TrendingUp,      key: 'market' },
  { to: '/users',            icon: UserCog,         key: 'users' },
  { to: '/company',          icon: Building2,       key: 'company' },
  { to: '/warehouses',       icon: Warehouse,       key: 'warehouses' },
  { to: '/suppliers',              icon: Store,        key: 'suppliers' },
  { to: '/products',               icon: Package,      key: 'products' },
  { to: '/products/bulk-import',   icon: FolderInput,  key: 'bulk_import' },
]

export default function Sidebar() {
  const { t } = useTranslation()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { user, logout } = useAuthStore()
  const { isRTL } = useRTL()
  const navigate = useNavigate()

  const CollapseIcon = isRTL
    ? (sidebarOpen ? ChevronRight : ChevronLeft)
    : (sidebarOpen ? ChevronLeft  : ChevronRight)

  function handleLogout() { logout(); navigate('/login') }

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={clsx(
          'fixed top-0 bottom-0 z-30 flex flex-col',
          'transition-all duration-300 ease-in-out',
          isRTL ? 'right-0 border-l border-brand-border' : 'left-0 border-r border-brand-border',
          sidebarOpen ? 'w-64' : 'w-16',
        )}
        style={{ background: 'linear-gradient(180deg, var(--brand-bg) 0%, var(--brand-surface) 100%)' }}
      >
        {/* ── Logo / Brand ── */}
        <div className={clsx(
          'flex items-center h-16 px-3 border-b border-brand-border/60 shrink-0 gap-2.5',
          !sidebarOpen && 'justify-center',
        )}>
          <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-primary-light))', boxShadow: '0 0 12px color-mix(in srgb, var(--brand-primary) 40%, transparent)' }}>
            <span className="text-white font-black text-sm leading-none">L</span>
          </div>
          {sidebarOpen && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-brand-text leading-tight truncate">
                {t('app.name', 'نظام اللوجستيك')}
              </p>
              <div className="flex gap-1 mt-0.5">
                {['JO','CN','IQ'].map(b => (
                  <span key={b} className="text-[9px] font-bold px-1 py-0.5 rounded bg-brand-primary/15 text-brand-primary-light">{b}</span>
                ))}
              </div>
            </div>
          )}
          {sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="flex-shrink-0 p-1 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-white/5 transition-colors"
            >
              <CollapseIcon size={14} />
            </button>
          )}
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto no-scrollbar py-4 px-2 space-y-0.5">
          {NAV.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx('nav-item', isActive && 'nav-item-active', !sidebarOpen && 'justify-center px-0')
              }
              title={!sidebarOpen ? t(`nav.${key}`) : undefined}
            >
              <Icon size={17} className="flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{t(`nav.${key}`)}</span>}
            </NavLink>
          ))}
        </nav>

        {/* ── User + Logout ── */}
        <div className="border-t border-brand-border/60 p-2 space-y-0.5 shrink-0">
          {sidebarOpen && user && (
            <div className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-lg bg-white/[0.03] border border-brand-border/40">
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-brand-primary-light"
                style={{ background: 'color-mix(in srgb, var(--brand-primary) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}>
                {(user.full_name?.[0] ?? user.email[0]).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-semibold text-brand-text truncate">{user.full_name ?? user.email}</p>
                <p className="text-[10px] text-brand-text-muted truncate">{t(`role.${user.role}`, user.role)}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className={clsx(
              'nav-item w-full text-brand-red/70 hover:text-brand-red hover:bg-brand-red/10',
              !sidebarOpen && 'justify-center px-0',
            )}
            title={!sidebarOpen ? t('nav.logout', 'تسجيل الخروج') : undefined}
          >
            <LogOut size={17} className="flex-shrink-0" />
            {sidebarOpen && <span>{t('nav.logout', 'تسجيل الخروج')}</span>}
          </button>

          {!sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="nav-item w-full justify-center px-0 text-brand-text-muted hover:text-brand-text"
            >
              <CollapseIcon size={14} />
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
