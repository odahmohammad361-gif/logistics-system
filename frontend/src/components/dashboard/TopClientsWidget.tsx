import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { getBoard } from '@/services/marketService'
import clsx from 'clsx'

export default function TopClientsWidget() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['board'],
    queryFn: getBoard,
  })

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-white mb-4">{t('dashboard.top_clients')}</h3>
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
          ))}
        </div>
      ) : (data?.top_clients_by_revenue ?? []).length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">{t('common.no_data')}</p>
      ) : (
        <div className="space-y-2">
          {(data?.top_clients_by_revenue ?? []).slice(0, 5).map((client, idx) => (
            <div key={client.client_id} className="flex items-center gap-3">
              <span
                className={clsx(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  idx === 0 && 'bg-yellow-500/20 text-yellow-400',
                  idx === 1 && 'bg-gray-400/20 text-gray-300',
                  idx === 2 && 'bg-orange-500/20 text-orange-400',
                  idx >= 3 && 'bg-white/5 text-gray-500',
                )}
              >
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{client.name}</p>
                <p className="text-xs text-gray-500">{client.client_code}</p>
              </div>
              <span className="text-xs font-semibold text-brand-green whitespace-nowrap">
                ${Number(client.value).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
