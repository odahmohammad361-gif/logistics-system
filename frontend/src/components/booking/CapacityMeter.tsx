import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

interface ClientSlice {
  clientName: string
  cbm: number
  color: string
}

interface Props {
  usedCbm: number
  totalCbm: number
  slices?: ClientSlice[]
  compact?: boolean
}

const SLICE_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500',
]

export default function CapacityMeter({ usedCbm, totalCbm, slices, compact }: Props) {
  const { t } = useTranslation()
  const pct = totalCbm > 0 ? Math.min((usedCbm / totalCbm) * 100, 100) : 0

  const barColor =
    pct >= 90 ? 'bg-red-500' :
    pct >= 70 ? 'bg-amber-400' :
    'bg-emerald-500'

  return (
    <div className={clsx('space-y-2', compact && 'space-y-1')}>
      {/* Label row */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-brand-text-muted">{t('bookings.fill_percent')}</span>
        <span className={clsx(
          'font-bold font-mono',
          pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-amber-400' : 'text-emerald-400',
        )}>
          {pct.toFixed(1)}%
        </span>
      </div>

      {/* Bar */}
      <div className="relative h-3 rounded-full bg-brand-border overflow-hidden">
        {slices && slices.length > 0 ? (
          /* Segmented bar — one color per client */
          slices.map((s, i) => {
            const width = totalCbm > 0 ? (s.cbm / totalCbm) * 100 : 0
            const left  = slices.slice(0, i).reduce((acc, prev) => acc + (prev.cbm / totalCbm) * 100, 0)
            return (
              <div
                key={i}
                className={clsx('absolute top-0 h-full transition-all', SLICE_COLORS[i % SLICE_COLORS.length])}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${s.clientName}: ${s.cbm.toFixed(3)} م³`}
              />
            )
          })
        ) : (
          <div
            className={clsx('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>

      {/* Numbers */}
      <div className="flex items-center justify-between text-xs text-brand-text-muted font-mono">
        <span>{usedCbm.toFixed(3)} م³ {t('bookings.cbm_used')}</span>
        <span>{totalCbm} م³ {t('bookings.cbm_capacity')}</span>
      </div>

      {/* Client legend (non-compact) */}
      {!compact && slices && slices.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {slices.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-brand-text-muted">
              <div className={clsx('w-2.5 h-2.5 rounded-sm flex-shrink-0', SLICE_COLORS[i % SLICE_COLORS.length])} />
              <span className="truncate max-w-[100px]">{s.clientName}</span>
              <span className="font-mono text-brand-text-dim">{s.cbm.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
