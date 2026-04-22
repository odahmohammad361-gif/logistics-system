import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import {
  getInvoice,
  updateInvoice,
  uploadStamp,
  uploadBackground,
} from '@/services/invoiceService'
import InvoiceForm from '@/components/invoice/InvoiceForm'
import Button from '@/components/ui/Button'

export default function InvoiceEditPage() {
  const { id } = useParams<{ id: string }>()
  const invoiceId = Number(id)
  const navigate = useNavigate()
  const { t } = useTranslation()
  const qc = useQueryClient()

  const { data: invoice, isLoading, isError } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => getInvoice(invoiceId),
    enabled: !!invoiceId,
  })

  const updateMut = useMutation({
    mutationFn: (data: Parameters<typeof updateInvoice>[1]) =>
      updateInvoice(invoiceId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      navigate('/invoices')
    },
  })

  async function handleStampUpload(file: File) {
    await uploadStamp(invoiceId, file)
    qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
  }

  async function handleBackgroundUpload(file: File) {
    await uploadBackground(invoiceId, file)
    qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">{t('common.loading')}</div>
      </div>
    )
  }

  if (isError || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-400 text-sm">{t('common.error')}</p>
        <Button variant="secondary" onClick={() => navigate('/invoices')}>
          <ArrowLeft size={14} /> {t('common.back')}
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate('/invoices')}>
          <ArrowLeft size={14} />
          رجوع
        </Button>
        <div>
          <h1 className="page-title">تعديل الفاتورة — {invoice.invoice_number}</h1>
          <p className="text-xs text-brand-text-muted mt-0.5">
            النوع: {invoice.invoice_type} · الحالة: {invoice.status}
          </p>
        </div>
      </div>

      <div className="card p-6">
        <InvoiceForm
          initial={invoice}
          invoiceId={invoiceId}
          onSubmit={async (v) => updateMut.mutateAsync(v)}
          loading={updateMut.isPending}
          onStampUpload={handleStampUpload}
          onBackgroundUpload={handleBackgroundUpload}
        />
      </div>
    </div>
  )
}
