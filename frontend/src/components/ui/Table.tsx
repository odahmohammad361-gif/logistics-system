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
    <div className="card p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-brand-surface/80 border-b border-brand-border">
              {columns.map((col) => (
                <th key={col.key} className={clsx('table-head text-start', col.className)}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-brand-border/30">
                    {columns.map((col) => (
                      <td key={col.key} className="py-3.5 px-4">
                        <div className="h-4 bg-white/5 rounded animate-pulse" style={{ width: `${60 + (i * 13) % 40}%` }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-600">
                    <Inbox size={32} strokeWidth={1.5} />
                    <p className="text-sm">{t('common.no_data')}</p>
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border/60 bg-brand-surface/30">
          <span className="text-xs text-gray-500">
            {t('common.results')}: <span className="text-gray-300 font-medium">{total}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white disabled:opacity-25 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs text-gray-400 px-2 min-w-[4rem] text-center">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white disabled:opacity-25 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
