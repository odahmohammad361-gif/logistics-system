import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { getInvoices } from '@/services/invoiceService'
import Badge from '@/components/ui/Badge'
import { FileText, Clock } from 'lucide-react'

export default function RecentActivity() {
  const { t } = useTranslation()

  const { data: invoices } = useQuery({
    queryKey: ['invoices-recent'],
    queryFn:  () => getInvoices({ page: 1, page_size: 7 }),
  })

  const items = (invoices?.results ?? []).map((inv) => ({
    id:     `i-${inv.id}`,
    label:  inv.invoice_number,
    sub:    inv.client?.name ?? inv.buyer_name ?? '—',
    status: inv.status,
  }))

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: '#0A1929', border: '1px solid #12263F', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
    >
      <div className="flex items-center gap-2 mb-5">
        <Clock size={14} className="text-brand-primary-light" />
        <h3 className="text-sm font-semibold text-brand-text">{t('dashboard.recent_activity', 'آخر النشاطات')}</h3>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-brand-text-muted text-center py-8">{t('common.no_data', 'لا توجد بيانات')}</p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-white/[0.03]"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <FileText size={14} style={{ color: '#10B981' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-text truncate">{item.label}</p>
                <p className="text-xs text-brand-text-muted truncate">{item.sub}</p>
              </div>
              <Badge value={item.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
