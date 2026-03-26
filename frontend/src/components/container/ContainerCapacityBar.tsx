import type { ContainerCapacity } from '@/types'

interface Props {
  capacity: ContainerCapacity
}

function pctColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 70) return 'bg-yellow-500'
  return 'bg-brand-green'
}

function Bar({ label, used, max, pct, unit }: {
  label: string
  used: number
  max: number | null
  pct: number
  unit: string
}) {
  const capped = Math.min(pct, 100)
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="font-mono">
          {used.toFixed(2)} / {max !== null ? max : '∞'} {unit}
          {max !== null && <span className="ml-1 text-gray-500">({pct.toFixed(1)}%)</span>}
        </span>
      </div>
      <div className="h-2 bg-brand-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pctColor(pct)}`}
          style={{ width: `${capped}%` }}
        />
      </div>
    </div>
  )
}

export default function ContainerCapacityBar({ capacity }: Props) {
  return (
    <div className="space-y-2 p-3 bg-brand-surface rounded-lg border border-brand-border">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-300">
          Capacity — {capacity.container_type}
        </span>
        {capacity.agent_price !== null && capacity.agent_price !== undefined && (
          <span className="text-xs text-brand-green font-mono">
            Agent: ${Number(capacity.agent_price).toLocaleString()}
          </span>
        )}
      </div>
      <Bar
        label="Volume (CBM)"
        used={capacity.used_cbm}
        max={capacity.max_cbm}
        pct={capacity.cbm_pct}
        unit="CBM"
      />
      <Bar
        label="Weight"
        used={capacity.used_weight_tons}
        max={capacity.max_weight_tons}
        pct={capacity.weight_pct}
        unit="tons"
      />
      {capacity.lcl_clients.length > 0 && (
        <div className="mt-2 pt-2 border-t border-brand-border">
          <p className="text-xs text-gray-500 mb-1">LCL Clients</p>
          <div className="space-y-1">
            {capacity.lcl_clients.map((lc) => (
              <div key={lc.id} className="flex justify-between text-xs text-gray-400">
                <span>{lc.client?.name ?? `Client #${lc.client_id}`}</span>
                <span className="font-mono">
                  {lc.cbm ?? 0} CBM / {lc.cartons ?? 0} CTN
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
