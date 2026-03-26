import { useEffect } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export default function Modal({ open, onClose, title, children, size = 'md' }: Props) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div
        className={clsx(
          'relative w-full bg-brand-card border border-brand-border/80 shadow-2xl',
          'flex flex-col',
          // Mobile: slide up from bottom, full width, rounded top
          'rounded-t-2xl sm:rounded-xl',
          'max-h-[92vh] sm:max-h-[88vh]',
          'animate-slide-up sm:animate-slide-in',
          widths[size],
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border/60 shrink-0">
          {/* Mobile drag handle */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-brand-border rounded-full sm:hidden" />
          <h2 className="text-sm font-semibold text-white mt-1 sm:mt-0">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-5">{children}</div>
      </div>
    </div>
  )
}
