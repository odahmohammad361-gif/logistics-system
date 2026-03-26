import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import { RefreshCw, TrendingUp, Users, Package, Ship, Wind } from 'lucide-react'
import { getBoard, refreshRates } from '@/services/marketService'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import clsx from 'clsx'

export default function MarketPage() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['board'],
    queryFn: getBoard,
    refetchInterval: 60_000,
  })

  const refreshMut = useMutation({
    mutationFn: refreshRates,
    onSuccess: () => refetch(),
  })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('market.title')}</h1>
          {data?.rates?.fetched_at && (
            <p className="text-xs text-gray-500 mt-0.5">
              {t('market.last_update')}: {new Date(data.rates.fetched_at).toLocaleString()}
              {data.rates.is_stale && (
                <span className="ms-2 text-yellow-400">({t('market.stale')})</span>
              )}
            </p>
          )}
        </div>
        {isAdmin && (
          <Button
            variant="secondary"
            size="sm"
            loading={refreshMut.isPending}
            onClick={() => refreshMut.mutate()}
          >
            <RefreshCw size={14} />
            {t('market.refresh')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-white/5" />
          ))}
        </div>
      ) : (
        <>
          {/* Currency rates */}
          <section>
            <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <TrendingUp size={14} />
              {t('market.exchange_rates')} (1 USD =)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {(data?.rates?.rates ?? []).map((r) => (
                <div key={r.currency} className="card text-center">
                  <p className="text-xs text-gray-400 mb-1">{r.currency}</p>
                  <p className="text-xl font-bold text-white">{r.rate.toFixed(3)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    1 {r.currency} = {r.inverse.toFixed(4)} USD
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Top clients */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section>
              <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <Users size={14} />
                {t('market.top_clients_by_revenue')}
              </h2>
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {(data?.top_clients_by_revenue ?? []).map((c, i) => (
                      <tr key={c.client_id} className="border-b border-brand-border last:border-0">
                        <td className="px-4 py-3 w-8">
                          <span className={clsx(
                            'inline-flex w-5 h-5 rounded-full items-center justify-center text-xs font-bold',
                            i === 0 && 'bg-yellow-500/20 text-yellow-400',
                            i === 1 && 'bg-gray-400/20 text-gray-300',
                            i === 2 && 'bg-orange-500/20 text-orange-400',
                            i >= 3 && 'bg-white/5 text-gray-500',
                          )}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.client_code}</p>
                        </td>
                        <td className="px-4 py-3 text-end">
                          <span className="font-semibold text-brand-green">
                            ${c.value.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(data?.top_clients_by_revenue ?? []).length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-gray-500 text-sm">
                          {t('common.no_data')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <Package size={14} />
                {t('market.top_clients_by_shipments')}
              </h2>
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {(data?.top_clients_by_shipments ?? []).map((c, i) => (
                      <tr key={c.client_id} className="border-b border-brand-border last:border-0">
                        <td className="px-4 py-3 w-8">
                          <span className={clsx(
                            'inline-flex w-5 h-5 rounded-full items-center justify-center text-xs font-bold',
                            i === 0 && 'bg-yellow-500/20 text-yellow-400',
                            i === 1 && 'bg-gray-400/20 text-gray-300',
                            i === 2 && 'bg-orange-500/20 text-orange-400',
                            i >= 3 && 'bg-white/5 text-gray-500',
                          )}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.client_code}</p>
                        </td>
                        <td className="px-4 py-3 text-end">
                          <span className="font-semibold text-brand-green">
                            {c.value} {t('market.shipments')}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(data?.top_clients_by_shipments ?? []).length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-gray-500 text-sm">
                          {t('common.no_data')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Agent quick prices */}
          {(data?.agent_quick_prices ?? []).length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <Ship size={14} />
                {t('market.agent_prices')}
              </h2>
              <div className="card p-0 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-surface border-b border-brand-border">
                      <th className="table-head text-start">{t('agents.name')}</th>
                      <th className="table-head text-start">{t('common.location')}</th>
                      <th className="table-head text-end">20GP</th>
                      <th className="table-head text-end">40FT</th>
                      <th className="table-head text-end">40HQ</th>
                      <th className="table-head text-end">{t('market.air_per_kg')}</th>
                      <th className="table-head text-center">{t('market.sea_days')}</th>
                      <th className="table-head text-center">{t('market.air_days')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.agent_quick_prices ?? []).map((a) => (
                      <tr key={a.agent_id} className="table-row">
                        <td className="table-cell">
                          <p className="text-white font-medium">{a.agent_name}</p>
                          {a.agent_wechat && <p className="text-xs text-green-400">WeChat: {a.agent_wechat}</p>}
                        </td>
                        <td className="table-cell text-xs text-gray-400">
                          {[a.warehouse_city, a.country].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="table-cell text-end font-semibold text-blue-300">
                          {a.price_20gp != null ? `$${Number(a.price_20gp).toLocaleString()}` : '—'}
                        </td>
                        <td className="table-cell text-end font-semibold text-blue-300">
                          {a.price_40ft != null ? `$${Number(a.price_40ft).toLocaleString()}` : '—'}
                        </td>
                        <td className="table-cell text-end font-semibold text-blue-300">
                          {a.price_40hq != null ? `$${Number(a.price_40hq).toLocaleString()}` : '—'}
                        </td>
                        <td className="table-cell text-end font-semibold text-purple-300">
                          {a.price_air_kg != null ? `$${Number(a.price_air_kg).toFixed(2)}/kg` : '—'}
                        </td>
                        <td className="table-cell text-center text-gray-400">
                          {a.transit_sea_days != null ? `${a.transit_sea_days}d` : '—'}
                        </td>
                        <td className="table-cell text-center text-gray-400">
                          {a.transit_air_days != null ? `${a.transit_air_days}d` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Agent detailed quotes */}
          {(data?.agent_rates ?? []).length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <Wind size={14} />
                {t('market.agent_rates')}
              </h2>
              <div className="card p-0 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-brand-surface border-b border-brand-border">
                      <th className="table-head text-start">{t('agents.name')}</th>
                      <th className="table-head text-start">{t('agents.service_mode')}</th>
                      <th className="table-head text-start">{t('agents.incoterm')}</th>
                      <th className="table-head text-start">Route</th>
                      <th className="table-head text-end">{t('agents.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.agent_rates ?? []).map((r) => (
                      <tr key={r.quote_number} className="table-row">
                        <td className="table-cell">{r.agent_name}</td>
                        <td className="table-cell text-xs text-brand-green font-semibold">{r.container_type ?? r.quote_number}</td>
                        <td className="table-cell text-xs text-gray-400">{r.incoterm ?? '—'}</td>
                        <td className="table-cell text-xs text-gray-400">{r.route}</td>
                        <td className="table-cell text-end font-semibold text-white">
                          {r.total_usd != null ? `$${Number(r.total_usd).toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
