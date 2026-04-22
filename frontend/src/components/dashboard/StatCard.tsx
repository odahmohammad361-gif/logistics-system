import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'

interface Props {
  title:   string
  value:   string | number
  sub?:    string
  icon:    LucideIcon
  color?:  'green' | 'blue' | 'yellow' | 'purple' | 'red'
  trend?:  { value: number; label: string }
  loading?: boolean
}

const colorMap = {
  green:  { iconBg: 'rgba(16,185,129,0.12)',  iconColor: '#10B981', glow: 'rgba(16,185,129,0.2)',  border: 'rgba(16,185,129,0.2)' },
  blue:   { iconBg: 'rgba(59,130,246,0.12)',  iconColor: '#3B82F6', glow: 'rgba(59,130,246,0.2)',  border: 'rgba(59,130,246,0.2)' },
  yellow: { iconBg: 'rgba(245,158,11,0.12)',  iconColor: '#F59E0B', glow: 'rgba(245,158,11,0.2)',  border: 'rgba(245,158,11,0.2)' },
  purple: { iconBg: 'rgba(99,102,241,0.12)',  iconColor: '#818CF8', glow: 'rgba(99,102,241,0.2)',  border: 'rgba(99,102,241,0.2)' },
  red:    { iconBg: 'rgba(239,68,68,0.12)',   iconColor: '#EF4444', glow: 'rgba(239,68,68,0.2)',   border: 'rgba(239,68,68,0.2)' },
}

export default function StatCard({ title, value, sub, icon: Icon, color = 'green', trend, loading }: Props) {
  const c = colorMap[color]

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4 transition-all duration-200 hover:translate-y-[-2px]"
      style={{
        background: '#0A1929',
        border: `1px solid ${c.border}`,
        boxShadow: `0 1px 3px rgba(0,0,0,0.4), 0 0 0 0 ${c.glow}`,
      }}
    >
      <div className="flex items-start justify-between">
        {/* Icon */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: c.iconBg, boxShadow: `0 0 16px ${c.glow}` }}
        >
          <Icon size={20} style={{ color: c.iconColor }} strokeWidth={2} />
        </div>

        {/* Trend */}
        {trend && (
          <span className={clsx(
            'text-xs font-semibold px-2 py-0.5 rounded-full',
            trend.value >= 0 ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-red/10 text-brand-red',
          )}>
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-brand-text-muted uppercase tracking-wide mb-1">{title}</p>
        {loading ? (
          <div className="skeleton h-8 w-24 rounded-lg" />
        ) : (
          <p className="text-3xl font-black tabular-nums" style={{ color: '#F1F5F9', letterSpacing: '-0.02em' }}>
            {value}
          </p>
        )}
        {sub && <p className="text-xs text-brand-text-muted mt-1">{sub}</p>}
        {trend && <p className="text-xs text-brand-text-muted mt-0.5">{trend.label}</p>}
      </div>
    </div>
  )
}
