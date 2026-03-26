import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { getContainers } from '@/services/containerService'
import { getInvoices } from '@/services/invoiceService'
import Badge from '@/components/ui/Badge'
import { Package, FileText } from 'lucide-react'

export default function RecentActivity() {
  const { t } = useTranslation()

  const { data: containers } = useQuery({
    queryKey: ['containers', { page: 1, page_size: 5 }],
    queryFn: () => getContainers({ page: 1, page_size: 5 }),
  })

  const { data: invoices } = useQuery({
    queryKey: ['invoices', { page: 1, page_size: 5 }],
    queryFn: () => getInvoices({ page: 1, page_size: 5 }),
  })

  const items = [
    ...(containers?.results ?? []).map((c) => ({
      id: `c-${c.id}`,
      icon: Package,
      label: c.booking_number,
      sub: c.client?.name ?? '—',
      status: c.status,
      color: 'blue' as const,
    })),
    ...(invoices?.results ?? []).map((inv) => ({
      id: `i-${inv.id}`,
      icon: FileText,
      label: inv.invoice_number,
      sub: inv.client?.name ?? '—',
      status: inv.status,
      color: 'green' as const,
    })),
  ].slice(0, 8)

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-white mb-4">{t('dashboard.recent_activity')}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">{t('common.no_data')}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className={`p-1.5 rounded bg-white/5 text-gray-400`}>
                <item.icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{item.label}</p>
                <p className="text-xs text-gray-500 truncate">{item.sub}</p>
              </div>
              <Badge value={item.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
