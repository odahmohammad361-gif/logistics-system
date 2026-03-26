import { forwardRef } from 'react'
import clsx from 'clsx'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, className, ...props }, ref) {
    return (
      <div>
        {label && <label className="label-base">{label}</label>}
        <input ref={ref} className={clsx('input-base', error && 'border-red-500', className)} {...props} />
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    )
  }
)

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ label, error, options, className, ...props }, ref) {
    return (
      <div>
        {label && <label className="label-base">{label}</label>}
        <select ref={ref} className={clsx('input-base', error && 'border-red-500', className)} {...props}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    )
  }
)

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, className, ...props }, ref) {
    return (
      <div>
        {label && <label className="label-base">{label}</label>}
        <textarea
          ref={ref}
          rows={3}
          className={clsx('input-base resize-none', error && 'border-red-500', className)}
          {...props}
        />
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    )
  }
)

export function FormRow({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div className={clsx('grid gap-4', cols === 1 && 'grid-cols-1', cols === 2 && 'grid-cols-1 sm:grid-cols-2', cols === 3 && 'grid-cols-1 sm:grid-cols-3')}>
      {children}
    </div>
  )
}

export function FormSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      {title && <h3 className="text-sm font-semibold text-brand-green border-b border-brand-border pb-2">{title}</h3>}
      {children}
    </div>
  )
}
