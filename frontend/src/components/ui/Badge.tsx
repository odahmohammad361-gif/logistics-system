import clsx from 'clsx'

const COLORS: Record<string, string> = {
  // Invoice statuses
  draft:      'bg-gray-700/50 text-gray-300',
  sent:       'bg-blue-500/20 text-blue-300',
  approved:   'bg-brand-green/20 text-brand-green',
  paid:       'bg-emerald-500/20 text-emerald-400',
  cancelled:  'bg-red-500/20 text-red-400',
  // Container statuses
  booking:    'bg-yellow-500/20 text-yellow-400',
  in_transit: 'bg-blue-500/20 text-blue-300',
  arrived:    'bg-purple-500/20 text-purple-300',
  cleared:    'bg-brand-green/20 text-brand-green',
  delivered:  'bg-emerald-500/20 text-emerald-400',
  // Quote statuses
  active:     'bg-brand-green/20 text-brand-green',
  expired:    'bg-orange-500/20 text-orange-400',
  rejected:   'bg-red-500/20 text-red-400',
  // Generic
  green:      'bg-brand-green/20 text-brand-green',
  blue:       'bg-blue-500/20 text-blue-300',
  yellow:     'bg-yellow-500/20 text-yellow-400',
  red:        'bg-red-500/20 text-red-400',
  gray:       'bg-gray-700/50 text-gray-300',
}

interface Props {
  value: string
  label?: string
  className?: string
}

export default function Badge({ value, label, className }: Props) {
  const color = COLORS[value] ?? COLORS.gray
  return (
    <span className={clsx('badge', color, className)}>
      {label ?? value}
    </span>
  )
}
