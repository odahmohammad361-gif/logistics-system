import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Users, FileText, Package, TrendingUp } from 'lucide-react'
import StatCard from '@/components/dashboard/StatCard'
import RecentActivity from '@/components/dashboard/RecentActivity'
import TopClientsWidget from '@/components/dashboard/TopClientsWidget'
import { getClients } from '@/services/clientService'
import { getInvoices } from '@/services/invoiceService'
import { getContainers } from '@/services/containerService'
import { getBoard } from '@/services/marketService'
import { useAuthStore } from '@/store/authStore'

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ['clients-count'],
    queryFn: () => getClients({ page: 1, page_size: 1 }),
  })

  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices-count'],
    queryFn: () => getInvoices({ page: 1, page_size: 1 }),
  })

  const { data: containers, isLoading: loadingContainers } = useQuery({
    queryKey: ['containers-count'],
    queryFn: () => getContainers({ page: 1, page_size: 1 }),
  })

  const { data: board } = useQuery({
    queryKey: ['board'],
    queryFn: getBoard,
    refetchInterval: 60_000,
  })

  const usdJod = board?.rates?.rates?.find((r) => r.currency === 'JOD')?.rate

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('dashboard.title')}</h1>
          {user && (
            <p className="text-sm text-gray-500 mt-0.5">
              {t('dashboard.welcome', { name: user.full_name })}
            </p>
          )}
        </div>
        <div className="text-xs text-gray-600">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('clients.title')}
          value={clients?.total ?? '—'}
          icon={Users}
          color="green"
          loading={loadingClients}
        />
        <StatCard
          title={t('invoices.title')}
          value={invoices?.total ?? '—'}
          icon={FileText}
          color="blue"
          loading={loadingInvoices}
        />
        <StatCard
          title={t('containers.title')}
          value={containers?.total ?? '—'}
          icon={Package}
          color="yellow"
          loading={loadingContainers}
        />
        <StatCard
          title="USD / JOD"
          value={usdJod ? usdJod.toFixed(3) : '—'}
          sub={t('dashboard.live_rate')}
          icon={TrendingUp}
          color="red"
        />
      </div>

      {/* Bottom widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentActivity />
        <TopClientsWidget />
      </div>
    </div>
  )
}
