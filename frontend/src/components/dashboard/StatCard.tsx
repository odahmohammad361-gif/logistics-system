import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'

interface Props {
  title: string
  value: string | number
  sub?: string
  icon: LucideIcon
  color?: 'green' | 'blue' | 'yellow' | 'red'
  loading?: boolean
}

const colorMap = {
  green:  { icon: 'text-brand-green bg-brand-green/10', border: 'hover:border-brand-green/30' },
  blue:   { icon: 'text-blue-400 bg-blue-400/10',       border: 'hover:border-blue-400/30' },
  yellow: { icon: 'text-yellow-400 bg-yellow-400/10',   border: 'hover:border-yellow-400/30' },
  red:    { icon: 'text-red-400 bg-red-400/10',         border: 'hover:border-red-400/30' },
}

export default function StatCard({ title, value, sub, icon: Icon, color = 'green', loading }: Props) {
  const { icon: iconClass, border } = colorMap[color]
  return (
    <div className={clsx('card flex items-start gap-4 transition-all duration-200', border)}>
      <div className={clsx('p-2.5 rounded-xl shrink-0', iconClass)}>
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-medium">{title}</p>
        {loading ? (
          <div className="h-7 w-20 bg-white/5 rounded-lg animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        )}
        {sub && <p className="text-[11px] text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
