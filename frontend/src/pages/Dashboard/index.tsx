import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Users, FileText, DollarSign } from 'lucide-react'
import StatCard from '@/components/dashboard/StatCard'
import RecentActivity from '@/components/dashboard/RecentActivity'
import TopClientsWidget from '@/components/dashboard/TopClientsWidget'
import { getClients } from '@/services/clientService'
import { getInvoices } from '@/services/invoiceService'
import { getBoard } from '@/services/marketService'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'

function getGreeting(isAr: boolean): string {
  const h = new Date().getHours()
  if (isAr) {
    if (h < 12) return 'صباح الخير'
    if (h < 17) return 'مساء الخير'
    return 'مساء النور'
  }
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const { t }    = useTranslation()
  const { user } = useAuthStore()
  const { lang } = useUIStore()
  const isAr     = lang === 'ar'

  const { data: clients,    isLoading: lc } = useQuery({ queryKey: ['clients-count'],    queryFn: () => getClients({ page: 1, page_size: 1 }) })
  const { data: invoices,   isLoading: li } = useQuery({ queryKey: ['invoices-count'],   queryFn: () => getInvoices({ page: 1, page_size: 1 }) })
  const { data: board }                      = useQuery({ queryKey: ['board'], queryFn: getBoard, refetchInterval: 60_000 })

  const usdJod = board?.rates?.rates?.find((r) => r.currency === 'JOD')?.rate

  const today = new Date().toLocaleDateString(isAr ? 'ar-JO' : 'en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="space-y-6">

      {/* ── Welcome Banner ─────────────────────────────────── */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(10,25,41,0.9) 60%)',
          border: '1px solid rgba(99,102,241,0.2)',
        }}
      >
        {/* Glow */}
        <div className="absolute top-0 start-0 w-64 h-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 0% 50%, rgba(99,102,241,0.1) 0%, transparent 70%)' }} />

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-brand-text-dim text-sm font-medium">{getGreeting(isAr)}</p>
            <h1 className="text-2xl font-black text-brand-text mt-0.5">
              {user?.full_name ?? (isAr ? 'المستخدم' : 'User')}
            </h1>
            <p className="text-xs text-brand-text-muted mt-1">{today}</p>
          </div>
          <div className="flex gap-2">
            {['JO','CN','IQ'].map(b => (
              <span key={b} className="text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#818CF8' }}>
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={t('clients.title', 'العملاء')}
          value={clients?.total ?? '—'}
          icon={Users}
          color="green"
          loading={lc}
        />
        <StatCard
          title={t('invoices.title', 'الفواتير')}
          value={invoices?.total ?? '—'}
          icon={FileText}
          color="blue"
          loading={li}
        />
        <StatCard
          title="USD / JOD"
          value={usdJod ? usdJod.toFixed(3) : '—'}
          sub={t('dashboard.live_rate', 'السعر المباشر')}
          icon={DollarSign}
          color="purple"
        />
      </div>

      {/* ── Widgets ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentActivity />
        <TopClientsWidget />
      </div>
    </div>
  )
}
