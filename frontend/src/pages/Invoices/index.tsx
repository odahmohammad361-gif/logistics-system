import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, ScanBarcode, ScanLine, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { getInvoices, createInvoice, deleteInvoice, downloadPdf } from '@/services/invoiceService'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import InvoiceTable from '@/components/invoice/InvoiceTable'
import InvoiceForm from '@/components/invoice/InvoiceForm'
import InvoicePreview from '@/components/invoice/InvoicePreview'
import type { Invoice } from '@/types'

// ── Barcode image scan button ─────────────────────────────────────────────────
type ScanState = 'idle' | 'scanning' | 'success' | 'error'

function BarcodeScanButton({ onDecoded }: { onDecoded: (code: string) => void }) {
  const fileRef           = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<ScanState>('idle')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setState('scanning')
    const url = URL.createObjectURL(file)
    try {
      // @ts-ignore
      const { BrowserMultiFormatReader } = await import('@zxing/library')
      const reader = new BrowserMultiFormatReader()
      const result = await reader.decodeFromImageUrl(url)
      onDecoded(result.getText())
      setState('success')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    } finally {
      URL.revokeObjectURL(url)
      e.target.value = ''
    }
  }

  const styles: Record<ScanState, string> = {
    idle:     'text-brand-text-muted hover:text-brand-primary hover:bg-brand-primary/10 border-brand-border',
    scanning: 'text-brand-primary bg-brand-primary/10 border-brand-primary/30 cursor-wait',
    success:  'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    error:    'text-red-400 bg-red-500/10 border-red-500/30',
  }
  const icons: Record<ScanState, React.ReactNode> = {
    idle:     <ScanLine size={15} />,
    scanning: <Loader2  size={15} className="animate-spin" />,
    success:  <CheckCircle2 size={15} />,
    error:    <AlertCircle  size={15} />,
  }
  const labels: Record<ScanState, string> = {
    idle:     'مسح صورة باركود',
    scanning: 'جاري المسح...',
    success:  'تم العثور على الفاتورة!',
    error:    'لم يُعرف الباركود',
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        onClick={() => state === 'idle' && fileRef.current?.click()}
        disabled={state === 'scanning'}
        title={labels[state]}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-200 ${styles[state]}`}
      >
        {icons[state]}
        <span className="hidden sm:inline">{labels[state]}</span>
      </button>
    </>
  )
}

const INVOICE_TYPES = ['', 'PI', 'CI', 'PL', 'SC', 'PRICE_OFFER']
const STATUSES = ['', 'draft', 'sent', 'approved', 'paid', 'cancelled']

// ── Barcode scanner detection ─────────────────────────────────────────────────
// Barcode scanners type chars very fast (< 50 ms apart) then send Enter.
// We buffer keystrokes and flush when Enter is pressed.
function useBarcodeScanner(onScan: (code: string) => void) {
  const buffer    = useRef('')
  const lastTime  = useRef(0)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input / textarea / select
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const now = Date.now()
      if (e.key === 'Enter') {
        const code = buffer.current.trim()
        buffer.current = ''
        if (code.length >= 4) onScan(code)
        return
      }
      // Reset buffer if gap is too large (human typing)
      if (now - lastTime.current > 300) buffer.current = ''
      if (e.key.length === 1) buffer.current += e.key
      lastTime.current = now
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onScan])
}

export default function InvoicesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isStaff, isAdmin } = useAuth()
  const qc = useQueryClient()

  const [page, setPage]               = useState(1)
  const [search, setSearch]           = useState('')
  const [typeFilter, setTypeFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen]   = useState(false)
  const [viewing, setViewing]         = useState<Invoice | null>(null)
  const [deleting, setDeleting]       = useState<Invoice | null>(null)
  // Barcode scan feedback
  const [scanFlash, setScanFlash]     = useState<string | null>(null)

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

  // When barcode scanned: search by invoice number and open if exactly one result
  const handleScan = useCallback(async (code: string) => {
    setScanFlash(code)
    setTimeout(() => setScanFlash(null), 2500)

    try {
      const res = await getInvoices({ page: 1, page_size: 5, search: code })
      if (res.total === 1) {
        setViewing(res.results[0])
      } else if (res.total > 1) {
        // Multiple matches — show in search
        setSearch(code)
        setPage(1)
      }
    } catch { /* ignore */ }
  }, [])

  useBarcodeScanner(handleScan)

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

      {/* Barcode scan flash */}
      {scanFlash && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-mono animate-pulse">
          <ScanBarcode size={16} />
          تم مسح الباركود: <span className="font-bold">{scanFlash}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="بحث بالرقم، الباركود، اسم العميل..."
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
        {/* Barcode image scan */}
        <BarcodeScanButton onDecoded={handleScan} />
        {/* Physical scanner hint */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 self-center">
          <ScanBarcode size={13} />
          أو امسح الباركود مباشرة بالماسح
        </div>
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
        {createMut.isError && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-brand-red/10 border border-brand-red/30 text-xs text-brand-red">
            {(createMut.error as any)?.response?.data?.detail ?? 'حدث خطأ أثناء إنشاء الفاتورة'}
          </div>
        )}
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
