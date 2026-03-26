import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  loading?: boolean
  size?: 'sm' | 'md'
}

export default function Button({
  variant = 'primary', loading, size = 'md', className, children, disabled, ...props
}: Props) {
  const base = clsx(
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
    variant === 'primary'   && 'bg-brand-green hover:bg-brand-green-dim text-black font-semibold',
    variant === 'secondary' && 'bg-brand-surface hover:bg-brand-card text-white border border-brand-border',
    variant === 'danger'    && 'bg-red-700 hover:bg-red-600 text-white',
    variant === 'ghost'     && 'text-gray-400 hover:text-white hover:bg-white/5',
    className,
  )
  return (
    <button className={base} disabled={disabled || loading} {...props}>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}
