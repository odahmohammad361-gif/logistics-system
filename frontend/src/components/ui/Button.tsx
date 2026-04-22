import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export default function Button({
  variant = 'primary', size = 'md', loading, className, children, disabled, ...props
}: Props) {
  const base = clsx(
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50',
    'disabled:opacity-40 disabled:cursor-not-allowed',
    size === 'sm' && 'px-3 py-1.5 text-xs',
    size === 'md' && 'px-4 py-2 text-sm',
    size === 'lg' && 'px-5 py-2.5 text-base',
    variant === 'primary'   && 'bg-brand-primary hover:bg-brand-primary-dark text-white shadow-sm',
    variant === 'secondary' && 'bg-white/5 hover:bg-white/10 text-brand-text border border-brand-border hover:border-brand-border-light',
    variant === 'danger'    && 'bg-brand-red/10 hover:bg-brand-red/20 text-brand-red border border-brand-red/30',
    variant === 'ghost'     && 'text-brand-text-dim hover:text-brand-text hover:bg-white/5',
    className,
  )
  return (
    <button className={base} disabled={disabled || loading} {...props}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}
