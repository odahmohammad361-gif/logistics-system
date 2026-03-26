import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { getInvoices, createInvoice, deleteInvoice, downloadPdf } from '@/services/invoiceService'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import InvoiceTable from '@/components/invoice/InvoiceTable'
import InvoiceForm from '@/components/invoice/InvoiceForm'
import InvoicePreview from '@/components/invoice/InvoicePreview'
import type { Invoice } from '@/types'

const INVOICE_TYPES = ['', 'PI', 'CI', 'PL', 'SC', 'PRICE_OFFER']
const STATUSES = ['', 'draft', 'sent', 'approved', 'paid', 'cancelled']

export default function InvoicesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isStaff, isAdmin } = useAuth()
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [viewing, setViewing] = useState<Invoice | null>(null)
  const [deleting, setDeleting] = useState<Invoice | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { page, search, typeFilter, statusFilter }],
    queryFn: () => getInvoices({
      page,
      page_size: 20,
      search: search || undefined,
      invoice_type: typeFilter || undefined,
      status: statusFilter || undefined,
    }),
  })

  const createMut = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setCreateOpen(false) },
  })

  const deleteMut = useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setDeleting(null) },
  })

  async function handleDownload(inv: Invoice) {
    const blob = await downloadPdf(inv.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${inv.invoice_number}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('invoices.title')}</h1>
          {data && <p className="text-sm text-gray-400 mt-0.5">{data.total} {t('common.results')}</p>}
        </div>
        {isStaff && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            {t('invoices.create')}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={t('common.search')}
            className="input-base ps-9 w-full"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="input-base"
        >
          {INVOICE_TYPES.map((v) => (
            <option key={v} value={v}>{v || t('invoices.all_types')}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="input-base"
        >
          {STATUSES.map((v) => (
            <option key={v} value={v}>{v ? t(`invoices.status.${v}`) : t('common.all_statuses')}</option>
          ))}
        </select>
      </div>

      <InvoiceTable
        data={data?.results ?? []}
        total={data?.total ?? 0}
        page={page}
        loading={isLoading}
        onPageChange={setPage}
        onView={setViewing}
        onDownload={handleDownload}
        onDelete={setDeleting}
        canDelete={isAdmin}
        canEdit={isStaff}
      />

      {/* Create */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('invoices.create')} size="xl">
        <InvoiceForm
          onSubmit={async (v) => createMut.mutateAsync(v)}
          loading={createMut.isPending}
        />
      </Modal>

      {/* View */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.invoice_number ?? ''} size="lg">
        {viewing && (
          <div className="space-y-4">
            <InvoicePreview invoice={viewing} />
            <div className="flex justify-end gap-3 pt-2 border-t border-brand-border">
              {isStaff && (
                <Button variant="secondary" onClick={() => { navigate(`/invoices/${viewing!.id}/edit`); setViewing(null) }}>
                  {t('common.edit')}
                </Button>
              )}
              <Button onClick={() => handleDownload(viewing)}>
                {t('invoices.download_pdf')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={t('common.confirm_delete')} size="sm">
        <p className="text-sm text-gray-300 mb-5">
          {t('invoices.delete_confirm', { number: deleting?.invoice_number })}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
          <Button
            variant="danger"
            loading={deleteMut.isPending}
            onClick={() => deleting && deleteMut.mutate(deleting.id)}
          >
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
