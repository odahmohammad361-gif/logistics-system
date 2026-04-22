import { create } from 'zustand'
import { useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import clsx from 'clsx'

/* ─── Store ────────────────────────────────────────────────── */
type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  type: ToastType
  message: string
}

interface ToastStore {
  toasts: ToastItem[]
  add:    (type: ToastType, message: string) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (type, message) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/* ─── Helper ───────────────────────────────────────────────── */
export const toast = {
  success: (msg: string) => useToastStore.getState().add('success', msg),
  error:   (msg: string) => useToastStore.getState().add('error',   msg),
  warning: (msg: string) => useToastStore.getState().add('warning', msg),
  info:    (msg: string) => useToastStore.getState().add('info',    msg),
}

/* ─── Config ───────────────────────────────────────────────── */
const CONFIG: Record<ToastType, { icon: typeof CheckCircle; color: string; bg: string; border: string }> = {
  success: { icon: CheckCircle,  color: 'text-brand-green',   bg: 'bg-brand-green/10',   border: 'border-brand-green/25' },
  error:   { icon: XCircle,      color: 'text-brand-red',     bg: 'bg-brand-red/10',     border: 'border-brand-red/25' },
  warning: { icon: AlertCircle,  color: 'text-brand-yellow',  bg: 'bg-brand-yellow/10',  border: 'border-brand-yellow/25' },
  info:    { icon: Info,         color: 'text-brand-primary-light', bg: 'bg-brand-primary/10', border: 'border-brand-primary/25' },
}

/* ─── Toast Item ───────────────────────────────────────────── */
function ToastItem({ toast: t }: { toast: ToastItem }) {
  const { remove } = useToastStore()
  const { icon: Icon, color, bg, border } = CONFIG[t.type]

  useEffect(() => {
    return () => {}
  }, [])

  return (
    <div
      className={clsx(
        'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm w-full animate-slide-in',
        bg, border,
      )}
      style={{ background: 'rgba(10,25,41,0.95)', backdropFilter: 'blur(12px)' }}
    >
      <Icon size={16} className={clsx('flex-shrink-0 mt-0.5', color)} />
      <p className="flex-1 text-sm text-brand-text">{t.message}</p>
      <button
        onClick={() => remove(t.id)}
        className="flex-shrink-0 text-brand-text-muted hover:text-brand-text transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}

/* ─── Toast Container ──────────────────────────────────────── */
export default function ToastContainer() {
  const { toasts } = useToastStore()
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 end-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
    </div>
  )
}
