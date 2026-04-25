import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import clsx from 'clsx'

interface Column<T> {
  key: string
  label: string
  render?: (row: T) => React.ReactNode
  className?: string
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  total?: number
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  rowKey?: (row: T) => string | number
}

export default function Table<T>({
  columns, data, loading, total = 0, page = 1, pageSize = 20,
  onPageChange, rowKey,
}: Props<T>) {
  const { t } = useTranslation()
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="rounded-xl border border-brand-border overflow-hidden"
      style={{ background: '#0A1929', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ background: 'rgba(6,18,32,0.9)', borderBottom: '1px solid rgba(18,38,63,0.8)' }}>
              {columns.map((col) => (
                <th key={col.key} className={clsx('table-head text-start', col.className)}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-brand-border/30">
                  {columns.map((col) => (
                    <td key={col.key} className="py-3.5 px-4">
                      <div
                        className="skeleton h-4"
                        style={{ width: `${55 + (i * 17) % 35}%` }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3 text-brand-text-muted">
                    <div className="w-14 h-14 rounded-full bg-brand-border/50 flex items-center justify-center">
                      <Inbox size={24} strokeWidth={1.5} />
                    </div>
                    <p className="text-sm">{t('common.no_data', 'لا توجد بيانات')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={rowKey ? rowKey(row) : i} className="table-row">
                  {columns.map((col) => (
                    <td key={col.key} className={clsx('table-cell', col.className)}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border/60"
          style={{ background: 'rgba(6,18,32,0.6)' }}>
          <span className="text-xs text-brand-text-muted">
            {t('common.results', 'النتائج')}:{' '}
            <span className="text-brand-text-dim font-medium">{total}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-white/5 disabled:opacity-25 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-brand-text-dim px-2 min-w-[4rem] text-center tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-white/5 disabled:opacity-25 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
