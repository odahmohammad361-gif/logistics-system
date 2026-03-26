import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBoard } from '@/services/marketService'
import clsx from 'clsx'

// Fullscreen TV display — no auth required, refreshes every 30s
export default function PortalPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['board-tv'],
    queryFn: getBoard,
    refetchInterval: 30_000,
  })

  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const now = new Date()
  const timeStr = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const ratesList = data?.rates?.rates ?? []
  const revenueClients = data?.top_clients_by_revenue ?? []
  const shipmentClients = data?.top_clients_by_shipments ?? []

  return (
    <div
      className="min-h-screen bg-brand-bg text-white overflow-hidden"
      style={{ fontFamily: 'Cairo, sans-serif' }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-brand-border bg-brand-surface">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-green flex items-center justify-center">
            <span className="text-base font-black text-black">WI</span>
          </div>
          <div>
            <p className="text-sm font-bold text-white">胡萨姆贸易公司有限公司</p>
            <p className="text-xs text-gray-400">شركة أرض الوسام للتجارة والشحن</p>
          </div>
        </div>
        <div className="text-end">
          <p className="text-2xl font-bold text-brand-green tabular-nums">{timeStr}</p>
          <p className="text-xs text-gray-400">{dateStr}</p>
        </div>
      </div>

      {/* Currency ticker */}
      <div className="bg-brand-navy/50 border-b border-brand-border py-2 overflow-hidden">
        {ratesList.length > 0 && (
          <div className="flex items-center gap-10 animate-ticker whitespace-nowrap px-4">
            {[...ratesList, ...ratesList].map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">USD/{r.currency}</span>
                <span className="font-bold text-white">{r.rate.toFixed(3)}</span>
                <span className="text-gray-500 text-xs">({r.inverse.toFixed(4)})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-3 gap-6 p-8 h-[calc(100vh-140px)]">
        {/* Exchange rates */}
        <div className="col-span-1 space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            أسعار الصرف (1 USD)
          </h2>
          {isLoading ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
            ))
          ) : (
            ratesList.map((r) => (
              <div key={r.currency} className="bg-brand-card border border-brand-border rounded-xl px-5 py-4 flex items-center justify-between">
                <span className="text-base font-semibold text-gray-300">{r.currency}</span>
                <div className="text-end">
                  <p className="text-2xl font-bold text-brand-green">{r.rate.toFixed(3)}</p>
                  <p className="text-xs text-gray-500">1 {r.currency} = {r.inverse.toFixed(4)} $</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Top clients by revenue */}
        <div className="col-span-1 space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            أفضل العملاء (حجم التجارة)
          </h2>
          {revenueClients.map((c, i) => (
            <div key={c.client_id} className="bg-brand-card border border-brand-border rounded-xl px-5 py-4 flex items-center gap-4">
              <span className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                i === 0 && 'bg-yellow-500/30 text-yellow-300',
                i === 1 && 'bg-gray-500/30 text-gray-300',
                i === 2 && 'bg-orange-500/30 text-orange-300',
                i >= 3 && 'bg-white/5 text-gray-500',
              )}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-white truncate">{c.name}</p>
                <p className="text-xs text-gray-500">{c.client_code}</p>
              </div>
              <p className="text-lg font-bold text-brand-green">${Number(c.value).toLocaleString()}</p>
            </div>
          ))}
          {revenueClients.length === 0 && !isLoading && (
            <p className="text-sm text-gray-600 text-center py-8">لا توجد بيانات</p>
          )}
        </div>

        {/* Top clients by shipments + agent rates */}
        <div className="col-span-1 space-y-6">
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              أفضل العملاء (الشحنات)
            </h2>
            <div className="space-y-3">
              {shipmentClients.slice(0, 3).map((c, i) => (
                <div key={c.client_id} className="bg-brand-card border border-brand-border rounded-xl px-5 py-3 flex items-center gap-3">
                  <span className={clsx(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    i === 0 && 'bg-yellow-500/30 text-yellow-300',
                    i === 1 && 'bg-gray-500/30 text-gray-300',
                    i === 2 && 'bg-orange-500/30 text-orange-300',
                  )}>
                    {i + 1}
                  </span>
                  <p className="flex-1 text-sm text-white truncate">{c.name}</p>
                  <p className="text-brand-green font-bold">{c.value} شحنة</p>
                </div>
              ))}
            </div>
          </div>

          {/* Agent quick prices */}
          {(data?.agent_quick_prices ?? []).length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                أسعار الشحن
              </h2>
              <div className="space-y-2">
                {(data?.agent_quick_prices ?? []).slice(0, 5).map((a) => (
                  <div key={a.agent_id} className="bg-brand-card border border-brand-border rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-semibold text-white">{a.agent_name}</p>
                      {a.warehouse_city && (
                        <p className="text-xs text-gray-500">{a.warehouse_city}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {a.price_20gp != null && (
                        <span className="text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full">
                          20GP ${Number(a.price_20gp).toLocaleString()}
                        </span>
                      )}
                      {a.price_40ft != null && (
                        <span className="text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full">
                          40FT ${Number(a.price_40ft).toLocaleString()}
                        </span>
                      )}
                      {a.price_40hq != null && (
                        <span className="text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full">
                          40HQ ${Number(a.price_40hq).toLocaleString()}
                        </span>
                      )}
                      {a.price_air_kg != null && (
                        <span className="text-xs bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-full">
                          جوي ${Number(a.price_air_kg).toFixed(2)}/كغ
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed quotes if available */}
          {(data?.agent_rates ?? []).length > 0 && (data?.agent_quick_prices ?? []).length === 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                أسعار الوكلاء
              </h2>
              <div className="space-y-2">
                {(data?.agent_rates ?? []).slice(0, 4).map((r, i) => (
                  <div key={i} className="bg-brand-card border border-brand-border rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">{r.agent_name}</p>
                      <p className="text-xs text-gray-500">{r.container_type ?? '—'} · {r.incoterm ?? '—'}</p>
                    </div>
                    <p className="text-base font-bold text-brand-green">${r.total_usd?.toFixed(0) ?? '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 inset-x-0 bg-brand-surface/80 backdrop-blur-sm border-t border-brand-border px-8 py-2 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {data?.rates?.fetched_at && `Last updated: ${new Date(data.rates.fetched_at).toLocaleTimeString()}`}
        </p>
        <p className="text-xs text-gray-600">Husam Trading Co. © {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
