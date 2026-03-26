import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FileText, Download, Trash2, Eye, Pencil } from 'lucide-react'
import Table from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import type { Invoice } from '@/types'

interface Props {
  data: Invoice[]
  total: number
  page: number
  loading?: boolean
  onPageChange: (p: number) => void
  onView: (inv: Invoice) => void
  onDownload: (inv: Invoice) => void
  onDelete: (inv: Invoice) => void
  canDelete?: boolean
  canEdit?: boolean
}

export default function InvoiceTable({
  data, total, page, loading, onPageChange, onView, onDownload, onDelete, canDelete, canEdit,
}: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const columns = [
    {
      key: 'invoice_number',
      label: t('invoices.number'),
      render: (inv: Invoice) => (
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-gray-500" />
          <span className="font-mono text-sm text-white">{inv.invoice_number}</span>
        </div>
      ),
    },
    {
      key: 'invoice_type',
      label: t('invoices.type'),
      render: (inv: Invoice) => (
        <span className="text-xs font-semibold text-brand-green uppercase">{inv.invoice_type}</span>
      ),
    },
    {
      key: 'client_name',
      label: t('clients.title'),
      render: (inv: Invoice) => (
        <div>
          <p className="text-sm text-white">{inv.client?.name}</p>
          <p className="text-xs text-gray-500">{inv.client?.client_code}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: t('common.status'),
      render: (inv: Invoice) => <Badge value={inv.status} label={t(`invoices.status.${inv.status}`)} />,
    },
    {
      key: 'total_usd',
      label: t('invoices.total'),
      render: (inv: Invoice) => (
        <span className="font-semibold text-white">${Number(inv.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
      ),
    },
    {
      key: 'invoice_date',
      label: t('invoices.date'),
      render: (inv: Invoice) => <span className="text-sm text-gray-400">{inv.issue_date?.slice(0, 10)}</span>,
    },
    {
      key: 'actions',
      label: '',
      className: 'w-28',
      render: (inv: Invoice) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onView(inv)}
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            title={t('common.view')}
          >
            <Eye size={14} />
          </button>
          {canEdit && (
            <button
              onClick={() => navigate(`/invoices/${inv.id}/edit`)}
              className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-brand-green transition-colors"
              title={t('common.edit')}
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            onClick={() => onDownload(inv)}
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            title={t('invoices.download_pdf')}
          >
            <Download size={14} />
          </button>
          {canDelete && (
            <button
              onClick={() => onDelete(inv)}
              className="p-1.5 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
              title={t('common.delete')}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <Table
      columns={columns}
      data={data}
      total={total}
      page={page}
      loading={loading}
      onPageChange={onPageChange}
      rowKey={(inv) => inv.id}
    />
  )
}
