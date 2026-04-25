import clsx from 'clsx'

const COLORS: Record<string, string> = {
  // Invoice
  draft:      'bg-brand-text-muted/20 text-brand-text-dim border border-brand-text-muted/20',
  sent:       'bg-brand-blue/15 text-blue-300 border border-brand-blue/25',
  approved:   'bg-brand-green/15 text-brand-green border border-brand-green/25',
  paid:       'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  cancelled:  'bg-brand-red/15 text-brand-red border border-brand-red/25',
  // Container
  booking:    'bg-brand-yellow/15 text-brand-yellow border border-brand-yellow/25',
  in_transit: 'bg-brand-blue/15 text-blue-300 border border-brand-blue/25',
  arrived:    'bg-purple-500/15 text-purple-300 border border-purple-500/25',
  cleared:    'bg-brand-green/15 text-brand-green border border-brand-green/25',
  delivered:  'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  // Quote
  active:     'bg-brand-green/15 text-brand-green border border-brand-green/25',
  expired:    'bg-orange-500/15 text-orange-400 border border-orange-500/25',
  rejected:   'bg-brand-red/15 text-brand-red border border-brand-red/25',
  // Generic
  green:  'bg-brand-green/15 text-brand-green border border-brand-green/25',
  blue:   'bg-brand-blue/15 text-blue-300 border border-brand-blue/25',
  yellow: 'bg-brand-yellow/15 text-brand-yellow border border-brand-yellow/25',
  red:    'bg-brand-red/15 text-brand-red border border-brand-red/25',
  gray:   'bg-brand-text-muted/15 text-brand-text-dim border border-brand-text-muted/20',
  indigo: 'bg-brand-primary/15 text-brand-primary-light border border-brand-primary/25',
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
