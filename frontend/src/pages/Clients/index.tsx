import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Pencil, Trash2, Users,
  Barcode, Download, X, Loader2, ScanLine, CheckCircle2, AlertCircle, ExternalLink,
} from 'lucide-react'
import { getClients, createClient, updateClient, deleteClient } from '@/services/clientService'
import { getBranches } from '@/services/branchService'
import { useAuth } from '@/hooks/useAuth'
import api from '@/services/api'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { Input, Select, FormRow, FormSection } from '@/components/ui/Form'
import { useForm } from 'react-hook-form'
import type { Client } from '@/types'

interface FormValues {
  name: string; phone: string; email: string
  address: string; city: string; country: string; branch_id: string; notes: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Barcode View Modal — fetches SVG via axios (sends Bearer token)
// ─────────────────────────────────────────────────────────────────────────────
function BarcodeModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    let objectUrl: string
    setLoading(true); setError(false)
    api.get(`/clients/${client.id}/barcode`, { responseType: 'blob' })
      .then((r) => { objectUrl = URL.createObjectURL(r.data); setBlobUrl(objectUrl) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [client.id])

  function handleDownload() {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl; a.download = `${client.client_code}.svg`; a.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden animate-slide-in"
        style={{ background: '#0A1929', border: '1px solid #1E3A5F', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border/60">
          <div>
            <p className="text-sm font-semibold text-brand-text">{client.name}</p>
            <p className="text-xs text-brand-text-muted font-mono mt-0.5">{client.client_code}</p>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={15} /></button>
        </div>
        <div className="px-6 py-6 flex flex-col items-center gap-4">
          <div className="w-full rounded-xl p-4 flex items-center justify-center min-h-[100px]"
            style={{ background: '#ffffff' }}>
            {loading  && <div className="flex flex-col items-center gap-2 py-4"><Loader2 size={22} className="animate-spin text-brand-primary" /><span className="text-xs text-gray-400">جاري التحميل...</span></div>}
            {error && !loading && <p className="text-xs text-red-500 text-center py-4">تعذّر تحميل الباركود</p>}
            {blobUrl  && !loading && <img src={blobUrl} alt={client.client_code} className="w-full max-w-[260px] h-auto" />}
          </div>
          <Button onClick={handleDownload} variant="secondary" className="w-full" disabled={!blobUrl}>
            <Download size={14} /> تحميل SVG
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Barcode Image Scanner — decodes uploaded image using @zxing/library
// ─────────────────────────────────────────────────────────────────────────────
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
      // Dynamic import so the large ZXing bundle only loads when needed
      // @ts-ignore — install with: npm install @zxing/library
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
      e.target.value = ''          // reset so same file can be picked again
    }
  }

  const styles: Record<ScanState, string> = {
    idle:     'text-brand-text-muted hover:text-brand-primary hover:bg-brand-primary/10 border-brand-border',
    scanning: 'text-brand-primary bg-brand-primary/10 border-brand-primary/30 cursor-wait',
    success:  'text-brand-green   bg-brand-green/10   border-brand-green/30',
    error:    'text-brand-red     bg-brand-red/10     border-brand-red/30',
  }

  const icons: Record<ScanState, React.ReactNode> = {
    idle:     <ScanLine size={15} />,
    scanning: <Loader2  size={15} className="animate-spin" />,
    success:  <CheckCircle2 size={15} />,
    error:    <AlertCircle  size={15} />,
  }

  const labels: Record<ScanState, string> = {
    idle:     'مسح باركود',
    scanning: 'جاري المسح...',
    success:  'تم العثور عليه!',
    error:    'لم يُعرف الباركود',
  }

  return (
    <>
      <input
        ref={fileRef} type="file" accept="image/*"
        className="hidden" onChange={handleFile}
      />
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

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const { t } = useTranslation()
  const { isStaff } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [modalOpen, setModal]       = useState(false)
  const [editing, setEditing]       = useState<Client | null>(null)
  const [deleting, setDeleting]     = useState<Client | null>(null)
  const [barcodeClient, setBarcode] = useState<Client | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { page, search }],
    queryFn:  () => getClients({ page, page_size: 20, search: search || undefined }),
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'], queryFn: getBranches, staleTime: Infinity,
  })

  const { register, handleSubmit, reset, clearErrors, formState: { errors } } = useForm<FormValues>()

  const saveMut = useMutation({
    mutationFn: (v: FormValues) => {
      const p = {
        name: v.name, phone: v.phone || undefined, email: v.email || undefined,
        address: v.address || undefined, city: v.city || undefined,
        country: v.country || undefined,
        branch_id: v.branch_id ? parseInt(v.branch_id) : undefined,
        notes: v.notes || undefined,
      }
      return editing ? updateClient(editing.id, p) : createClient(p)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setModal(false); setEditing(null) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteClient(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setDeleting(null) },
  })

  function openCreate() {
    setEditing(null)
    reset({ name: '', phone: '', email: '', address: '', city: '', country: '', branch_id: String(branches[0]?.id ?? ''), notes: '' })
    clearErrors(); setModal(true)
  }
  function openEdit(c: Client) {
    setEditing(c)
    reset({ name: c.name, phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '',
      city: c.city ?? '', country: c.country ?? '', branch_id: c.branch ? String(c.branch.id) : '', notes: c.notes ?? '' })
    clearErrors(); setModal(true)
  }

  // Called when barcode scan decodes a value → put it in the search box
  function handleBarcodeDecoded(code: string) {
    setSearch(code)
    setPage(1)
  }

  const branchOptions = branches.map((b) => ({ value: String(b.id), label: b.name }))

  const columns = [
    {
      key: 'name', label: t('clients.name', 'العميل'),
      render: (c: Client) => (
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => navigate(`/clients/${c.id}`)}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold text-brand-green"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            {c.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-text group-hover:text-brand-primary transition-colors flex items-center gap-1">
              {c.name}
              <ExternalLink size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />
            </p>
            <p className="text-xs text-brand-text-muted font-mono">{c.client_code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'branch', label: t('clients.branch', 'الفرع'),
      render: (c: Client) => c.branch
        ? <Badge value={c.branch.code} label={c.branch.name} />
        : <span className="text-brand-text-muted">—</span>,
    },
    {
      key: 'contact', label: t('clients.contact', 'التواصل'),
      render: (c: Client) => (
        <div className="leading-tight">
          {c.phone && <p className="text-sm text-brand-text-dim">{c.phone}</p>}
          {c.email && <p className="text-xs text-brand-text-muted">{c.email}</p>}
          {!c.phone && !c.email && <span className="text-brand-text-muted">—</span>}
        </div>
      ),
    },
    {
      key: 'city', label: t('clients.city', 'المدينة'),
      render: (c: Client) => <span className="text-sm text-brand-text-dim">{c.city ?? '—'}</span>,
    },
    {
      key: 'actions', label: '', className: 'w-28',
      render: (c: Client) => (
        <div className="flex items-center gap-1">
          <button onClick={() => setBarcode(c)}
            className="btn-icon text-brand-primary-light hover:text-brand-primary hover:bg-brand-primary/10"
            title="عرض الباركود">
            <Barcode size={14} />
          </button>
          {isStaff && (
            <>
              <button onClick={() => openEdit(c)} className="btn-icon" title="تعديل"><Pencil size={14} /></button>
              <button onClick={() => setDeleting(c)} className="btn-icon hover:text-brand-red hover:bg-brand-red/10" title="حذف"><Trash2 size={14} /></button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Users size={15} className="text-brand-green" />
            </div>
            <h1 className="page-title">{t('clients.title', 'العملاء')}</h1>
          </div>
          {data && <p className="text-xs text-brand-text-muted mt-1 ms-10">{data.total} عميل</p>}
        </div>
        {isStaff && (
          <Button onClick={openCreate}><Plus size={15} />{t('clients.add', 'عميل جديد')}</Button>
        )}
      </div>

      {/* ── Search toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Text search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="search-icon text-brand-text-muted" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="بحث بالاسم أو الكود أو الهاتف..."
            className="search-input w-full"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1) }}
              className="absolute top-1/2 -translate-y-1/2 end-2 text-brand-text-muted hover:text-brand-text"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Barcode image scan button */}
        <BarcodeScanButton onDecoded={handleBarcodeDecoded} />
      </div>

      {/* Decoded barcode hint */}
      {search && search.includes('-') && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <Barcode size={13} className="text-brand-primary-light flex-shrink-0" />
          <span className="text-brand-text-dim">يتم البحث بكود:</span>
          <span className="font-bold font-mono text-brand-primary-light">{search}</span>
          <button onClick={() => { setSearch(''); setPage(1) }} className="ms-auto text-brand-text-muted hover:text-brand-text">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Table */}
      <Table
        columns={columns} data={data?.results ?? []} total={data?.total ?? 0}
        page={page} loading={isLoading} onPageChange={setPage} rowKey={(c) => c.id}
      />

      {/* Create / Edit Modal */}
      <Modal
        key={modalOpen ? (editing ? `edit-${editing.id}` : 'create') : 'closed'}
        open={modalOpen} onClose={() => setModal(false)}
        title={editing ? 'تعديل العميل' : 'عميل جديد'} size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>إلغاء</Button>
            <Button loading={saveMut.isPending} onClick={handleSubmit((v) => saveMut.mutate(v))}>حفظ</Button>
          </>
        }
      >
        {editing ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
            style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <Barcode size={14} className="text-brand-primary-light flex-shrink-0" />
            <span className="text-xs text-brand-text-muted">رمز العميل (تلقائي):</span>
            <span className="text-sm font-bold text-brand-primary-light font-mono">{editing.client_code}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
            style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Barcode size={14} className="text-brand-green flex-shrink-0" />
            <span className="text-xs text-brand-text-dim">سيتم توليد رمز العميل والباركود تلقائياً عند الحفظ</span>
          </div>
        )}

        <form onSubmit={handleSubmit((v) => saveMut.mutate(v))} className="space-y-5">
          <FormSection title="المعلومات الأساسية">
            <Input label="اسم العميل" {...register('name', { required: true })}
              error={errors.name ? 'مطلوب' : undefined} />
            <FormRow>
              <Input label="الهاتف" {...register('phone')} />
              <Input type="email" label="البريد الإلكتروني" {...register('email')} />
            </FormRow>
            <Select label="الفرع" options={branchOptions} {...register('branch_id')} />
          </FormSection>

          <FormSection title="العنوان">
            <Input label="العنوان التفصيلي" {...register('address')} />
            <FormRow>
              <Input label="المدينة" {...register('city')} />
              <Input label="البلد"   {...register('country')} />
            </FormRow>
          </FormSection>

          <Input label="ملاحظات" {...register('notes')} />
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="تأكيد الحذف" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>إلغاء</Button>
            <Button variant="danger" loading={deleteMut.isPending}
              onClick={() => deleting && deleteMut.mutate(deleting.id)}>حذف</Button>
          </>
        }
      >
        <p className="text-sm text-brand-text-dim">هل تريد حذف العميل: <strong>{deleting?.name}</strong>؟</p>
      </Modal>

      {/* Barcode view modal */}
      {barcodeClient && <BarcodeModal client={barcodeClient} onClose={() => setBarcode(null)} />}
    </div>
  )
}
