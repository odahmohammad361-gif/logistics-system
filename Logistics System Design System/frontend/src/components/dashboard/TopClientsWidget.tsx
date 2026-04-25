import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { getBoard } from '@/services/marketService'
import { Trophy } from 'lucide-react'
import clsx from 'clsx'

const RANK_STYLES = [
  { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.25)' },
  { bg: 'rgba(148,163,184,0.1)', color: '#94A3B8', border: 'rgba(148,163,184,0.2)' },
  { bg: 'rgba(249,115,22,0.1)',  color: '#F97316', border: 'rgba(249,115,22,0.2)' },
]

export default function TopClientsWidget() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['board'],
    queryFn:  getBoard,
  })

  const clients = data?.top_clients_by_revenue ?? []

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: '#0A1929', border: '1px solid #12263F', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
    >
      <div className="flex items-center gap-2 mb-5">
        <Trophy size={14} className="text-brand-yellow" />
        <h3 className="text-sm font-semibold text-brand-text">{t('dashboard.top_clients', 'أبرز العملاء')}</h3>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-lg" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <p className="text-sm text-brand-text-muted text-center py-8">{t('common.no_data', 'لا توجد بيانات')}</p>
      ) : (
        <div className="space-y-1.5">
          {clients.slice(0, 5).map((client, idx) => {
            const rank  = RANK_STYLES[idx] ?? { bg: 'rgba(255,255,255,0.04)', color: '#475569', border: 'rgba(255,255,255,0.06)' }
            const maxVal = Number(clients[0]?.value ?? 1)
            const pct    = (Number(client.value) / maxVal) * 100

            return (
              <div
                key={client.client_id}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/[0.03]',
                  idx === 0 && 'ring-1 ring-brand-yellow/10'
                )}
              >
                {/* Rank badge */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background: rank.bg, border: `1px solid ${rank.border}`, color: rank.color }}
                >
                  {idx + 1}
                </div>

                {/* Info + bar */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-text truncate">{client.name}</p>
                  {/* Progress bar */}
                  <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: rank.color, opacity: 0.7 }}
                    />
                  </div>
                </div>

                {/* Value */}
                <span className="text-xs font-semibold tabular-nums flex-shrink-0 text-brand-green">
                  ${Number(client.value).toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
