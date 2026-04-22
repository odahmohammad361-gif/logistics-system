import { forwardRef } from 'react'
import clsx from 'clsx'

/* ── Input ─────────────────────────────────────────────────── */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, hint, className, ...props }, ref) {
    return (
      <div className="space-y-1.5">
        {label && <label className="label-base">{label}</label>}
        <input
          ref={ref}
          className={clsx('input-base', error && '!border-brand-red focus:!ring-brand-red/30', className)}
          {...props}
        />
        {error && <p className="text-xs text-brand-red">{error}</p>}
        {!error && hint && <p className="text-xs text-brand-text-muted">{hint}</p>}
      </div>
    )
  }
)

/* ── Select ────────────────────────────────────────────────── */
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ label, error, options, placeholder, className, ...props }, ref) {
    return (
      <div className="space-y-1.5">
        {label && <label className="label-base">{label}</label>}
        <select
          ref={ref}
          className={clsx('input-base', error && '!border-brand-red', className)}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value} style={{ background: '#061220' }}>
              {o.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-brand-red">{error}</p>}
      </div>
    )
  }
)

/* ── Textarea ──────────────────────────────────────────────── */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, className, ...props }, ref) {
    return (
      <div className="space-y-1.5">
        {label && <label className="label-base">{label}</label>}
        <textarea
          ref={ref}
          rows={3}
          className={clsx('input-base resize-none', error && '!border-brand-red', className)}
          {...props}
        />
        {error && <p className="text-xs text-brand-red">{error}</p>}
      </div>
    )
  }
)

/* ── FormRow ───────────────────────────────────────────────── */
export function FormRow({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  return (
    <div className={clsx(
      'grid gap-4',
      cols === 1 && 'grid-cols-1',
      cols === 2 && 'grid-cols-1 sm:grid-cols-2',
      cols === 3 && 'grid-cols-1 sm:grid-cols-3',
    )}>
      {children}
    </div>
  )
}

/* ── FormSection ───────────────────────────────────────────── */
export function FormSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-brand-primary" />
          <h3 className="text-xs font-semibold text-brand-text-dim uppercase tracking-widest">{title}</h3>
        </div>
      )}
      {children}
    </div>
  )
}
