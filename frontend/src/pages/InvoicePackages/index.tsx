import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Archive, Boxes, FileText, FolderOpen, PackagePlus, Plus, Search,
  ShoppingBag, UploadCloud, UserRound,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { FormRow, Input, Select, Textarea } from '@/components/ui/Form'
import { getClients } from '@/services/clientService'
import {
  archiveInvoicePackage,
  createInvoicePackage,
  getInvoicePackages,
} from '@/services/invoicePackageService'
import { useAuth } from '@/hooks/useAuth'
import type { InvoicePackage, InvoicePackageSource, InvoicePackageStatus } from '@/types'
import clsx from 'clsx'

const SOURCE_OPTIONS = ['manual', 'shop_order', 'external_upload', 'container_cargo'] as const
const STATUS_OPTIONS = ['draft', 'active', 'approved', 'closed', 'cancelled'] as const

const TXT = {
  en: {
    title: 'Invoice Packages',
    subtitle: 'case files',
    create: 'New Package',
    search: 'Search package, client, buyer...',
    allSources: 'All sources',
    allStatuses: 'All statuses',
    source: 'Source',
    status: 'Status',
    client: 'Client',
    buyer: 'Manual buyer',
    titleField: 'Package title',
    origin: 'Origin',
    destination: 'Destination',
    pol: 'Port of loading',
    pod: 'Port of discharge',
    discount: 'Discount',
    notes: 'Notes',
    save: 'Create package',
    cancel: 'Cancel',
    archive: 'Archive',
    archiveTitle: 'Archive package',
    archiveConfirm: 'Archive this invoice package?',
    empty: 'No invoice packages',
    total: 'Total',
    items: 'Items',
    docs: 'Docs',
    files: 'Files',
    manual: 'Manual',
    shop_order: 'Shop order',
    external_upload: 'External upload',
    container_cargo: 'Container cargo',
    draft: 'Draft',
    active: 'Active',
    approved: 'Approved',
    closed: 'Closed',
    cancelled: 'Cancelled',
  },
  ar: {
    title: 'ملفات الفواتير',
    subtitle: 'ملفات تشغيلية',
    create: 'ملف جديد',
    search: 'بحث بالملف أو العميل أو المشتري...',
    allSources: 'كل المصادر',
    allStatuses: 'كل الحالات',
    source: 'المصدر',
    status: 'الحالة',
    client: 'العميل',
    buyer: 'مشتري يدوي',
    titleField: 'عنوان الملف',
    origin: 'المنشأ',
    destination: 'الوجهة',
    pol: 'ميناء التحميل',
    pod: 'ميناء التفريغ',
    discount: 'الخصم',
    notes: 'ملاحظات',
    save: 'إنشاء الملف',
    cancel: 'إلغاء',
    archive: 'أرشفة',
    archiveTitle: 'أرشفة الملف',
    archiveConfirm: 'هل تريد أرشفة ملف الفاتورة؟',
    empty: 'لا توجد ملفات فواتير',
    total: 'الإجمالي',
    items: 'الأصناف',
    docs: 'المستندات',
    files: 'الملفات',
    manual: 'يدوي',
    shop_order: 'طلب متجر',
    external_upload: 'ملفات خارجية',
    container_cargo: 'بضاعة حاوية',
    draft: 'مسودة',
    active: 'نشط',
    approved: 'معتمد',
    closed: 'مغلق',
    cancelled: 'ملغي',
  },
} as const

function sourceLabel(source: InvoicePackageSource, isAr: boolean) {
  const c = isAr ? TXT.ar : TXT.en
  return (c as any)[source] ?? source
}

function statusLabel(status: InvoicePackageStatus, isAr: boolean) {
  const c = isAr ? TXT.ar : TXT.en
  return (c as any)[status] ?? status
}

function sourceIcon(source: string) {
  if (source === 'shop_order') return <ShoppingBag size={14} />
  if (source === 'external_upload') return <UploadCloud size={14} />
  if (source === 'container_cargo') return <Boxes size={14} />
  return <FileText size={14} />
}

function money(value: number | string | null | undefined, currency = 'USD') {
  return `${currency} ${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface FormState {
  source_type: string
  status: string
  client_id: string
  buyer_name: string
  title: string
  origin: string
  destination: string
  port_of_loading: string
  port_of_discharge: string
  discount: string
  notes: string
}

function emptyForm(): FormState {
  return {
    source_type: 'manual',
    status: 'draft',
    client_id: '',
    buyer_name: '',
    title: '',
    origin: '',
    destination: '',
    port_of_loading: '',
    port_of_discharge: '',
    discount: '0',
    notes: '',
  }
}

function PackageCard({
  pack, isAr, onOpen, onArchive, canArchive,
}: {
  pack: InvoicePackage
  isAr: boolean
  onOpen: () => void
  onArchive: () => void
  canArchive: boolean
}) {
  const clientName = isAr
    ? pack.client?.name_ar || pack.client?.name || pack.buyer_name
    : pack.client?.name || pack.buyer_name

  return (
    <article
      onClick={onOpen}
      className="group relative overflow-hidden rounded-xl border border-brand-border bg-brand-card/80 hover:border-brand-primary/50 transition-all cursor-pointer"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-primary via-emerald-400 to-amber-400 opacity-70" />
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/15 text-brand-primary-light px-2 py-1 font-semibold">
                {sourceIcon(pack.source_type)}
                {sourceLabel(pack.source_type, isAr)}
              </span>
              <span className={clsx(
                'rounded-full px-2 py-1 font-semibold',
                pack.status === 'approved' && 'bg-emerald-500/15 text-emerald-300',
                pack.status === 'closed' && 'bg-blue-500/15 text-blue-300',
                pack.status === 'cancelled' && 'bg-red-500/15 text-red-300',
                !['approved', 'closed', 'cancelled'].includes(pack.status) && 'bg-white/10 text-brand-text-muted',
              )}>
                {statusLabel(pack.status, isAr)}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-bold text-brand-text truncate">{pack.package_number}</h3>
            <p className="text-sm text-brand-text-muted truncate">{pack.title || clientName || '-'}</p>
          </div>
          {canArchive && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onArchive() }}
              className="p-2 rounded-lg text-brand-text-muted hover:text-brand-red hover:bg-brand-red/10 transition-colors"
              title={isAr ? TXT.ar.archive : TXT.en.archive}
            >
              <Archive size={16} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 divide-x divide-brand-border/70 rtl:divide-x-reverse rounded-lg border border-brand-border/60 bg-white/[0.025]">
          <div className="px-3 py-2 text-center">
            <div className="text-[10px] uppercase tracking-widest text-brand-text-muted">{isAr ? TXT.ar.items : TXT.en.items}</div>
            <div className="text-sm font-bold text-brand-text">{pack.items.length}</div>
          </div>
          <div className="px-3 py-2 text-center">
            <div className="text-[10px] uppercase tracking-widest text-brand-text-muted">{isAr ? TXT.ar.docs : TXT.en.docs}</div>
            <div className="text-sm font-bold text-brand-text">{pack.documents.length}</div>
          </div>
          <div className="px-3 py-2 text-center">
            <div className="text-[10px] uppercase tracking-widest text-brand-text-muted">{isAr ? TXT.ar.files : TXT.en.files}</div>
            <div className="text-sm font-bold text-brand-text">{pack.files.length}</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="inline-flex items-center gap-2 text-brand-text-muted min-w-0">
            <UserRound size={14} />
            <span className="truncate">{clientName || '-'}</span>
          </span>
          <span className="font-bold text-emerald-300 whitespace-nowrap">{money(pack.total, pack.currency)}</span>
        </div>
      </div>
    </article>
  )
}

export default function InvoicePackagesPage() {
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const c = isAr ? TXT.ar : TXT.en
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { isStaff, isAdmin } = useAuth()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [status, setStatus] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [archiveTarget, setArchiveTarget] = useState<InvoicePackage | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['invoice-packages', { page, search, source, status }],
    queryFn: () => getInvoicePackages({
      page,
      page_size: 18,
      search: search || undefined,
      source_type: source || undefined,
      status: status || undefined,
    }),
  })

  const { data: clientsData } = useQuery({
    queryKey: ['invoice-package-clients'],
    queryFn: () => getClients({ page: 1, page_size: 200 }),
    staleTime: 60_000,
  })

  const createMut = useMutation({
    mutationFn: createInvoicePackage,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['invoice-packages'] })
      setCreateOpen(false)
      setForm(emptyForm())
      navigate(`/invoices/${created.id}`)
    },
  })

  const archiveMut = useMutation({
    mutationFn: archiveInvoicePackage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-packages'] })
      setArchiveTarget(null)
    },
  })

  const clientOptions = useMemo(() => (clientsData?.results ?? []).map((client) => ({
    value: String(client.id),
    label: `${client.client_code} - ${isAr ? client.name_ar || client.name : client.name}`,
  })), [clientsData, isAr])

  const sourceOptions = SOURCE_OPTIONS.map((value) => ({ value, label: sourceLabel(value, isAr) }))
  const statusOptions = STATUS_OPTIONS.map((value) => ({ value, label: statusLabel(value, isAr) }))

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    createMut.mutate({
      source_type: form.source_type,
      status: form.status,
      client_id: form.client_id ? Number(form.client_id) : null,
      buyer_name: form.buyer_name.trim() || null,
      title: form.title.trim() || null,
      origin: form.origin.trim() || null,
      destination: form.destination.trim() || null,
      port_of_loading: form.port_of_loading.trim() || null,
      port_of_discharge: form.port_of_discharge.trim() || null,
      discount: Number(form.discount || 0),
      notes: form.notes.trim() || null,
      currency: 'USD',
      items: [],
    })
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">{c.title}</h1>
          <p className="text-sm text-brand-text-muted mt-0.5">
            {data?.total ?? 0} {c.subtitle}
          </p>
        </div>
        {isStaff && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            {c.create}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-brand-text-muted" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={c.search}
            className="input-base ps-9 w-full"
          />
        </div>
        <select
          value={source}
          onChange={(e) => { setSource(e.target.value); setPage(1) }}
          className="input-base"
        >
          <option value="">{c.allSources}</option>
          {sourceOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="input-base"
        >
          <option value="">{c.allStatuses}</option>
          {statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="text-sm text-brand-text-muted py-12 text-center">Loading...</div>
      ) : (data?.results.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed border-brand-border p-10 text-center text-brand-text-muted">
          <FolderOpen size={28} className="mx-auto mb-3 opacity-70" />
          {c.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data?.results.map((pack) => (
            <PackageCard
              key={pack.id}
              pack={pack}
              isAr={isAr}
              canArchive={isAdmin}
              onOpen={() => navigate(`/invoices/${pack.id}`)}
              onArchive={() => setArchiveTarget(pack)}
            />
          ))}
        </div>
      )}

      {data && data.total > 18 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {isAr ? 'السابق' : 'Previous'}
          </Button>
          <span className="text-xs text-brand-text-muted">{page}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page * 18 >= data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            {isAr ? 'التالي' : 'Next'}
          </Button>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={c.create} size="lg">
        {createMut.isError && (
          <div className="rounded-lg border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-sm text-brand-red">
            {(createMut.error as any)?.response?.data?.detail ?? 'Error'}
          </div>
        )}
        <form onSubmit={submitCreate} className="space-y-4">
          <FormRow cols={2}>
            <Select
              label={c.source}
              value={form.source_type}
              onChange={(e) => update('source_type', e.target.value)}
              options={sourceOptions}
            />
            <Select
              label={c.status}
              value={form.status}
              onChange={(e) => update('status', e.target.value)}
              options={statusOptions}
            />
          </FormRow>
          <FormRow cols={2}>
            <Select
              label={c.client}
              value={form.client_id}
              onChange={(e) => update('client_id', e.target.value)}
              options={clientOptions}
              placeholder="-"
            />
            <Input
              label={c.buyer}
              value={form.buyer_name}
              onChange={(e) => update('buyer_name', e.target.value)}
            />
          </FormRow>
          <Input
            label={c.titleField}
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
          />
          <FormRow cols={2}>
            <Input label={c.origin} value={form.origin} onChange={(e) => update('origin', e.target.value)} />
            <Input label={c.destination} value={form.destination} onChange={(e) => update('destination', e.target.value)} />
          </FormRow>
          <FormRow cols={2}>
            <Input label={c.pol} value={form.port_of_loading} onChange={(e) => update('port_of_loading', e.target.value)} />
            <Input label={c.pod} value={form.port_of_discharge} onChange={(e) => update('port_of_discharge', e.target.value)} />
          </FormRow>
          <Input
            type="number"
            step="0.01"
            label={c.discount}
            value={form.discount}
            onChange={(e) => update('discount', e.target.value)}
          />
          <Textarea label={c.notes} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              {c.cancel}
            </Button>
            <Button type="submit" loading={createMut.isPending}>
              <PackagePlus size={16} />
              {c.save}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!archiveTarget} onClose={() => setArchiveTarget(null)} title={c.archiveTitle} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-brand-text-muted">{c.archiveConfirm}</p>
          <p className="text-sm font-mono text-brand-text">{archiveTarget?.package_number}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setArchiveTarget(null)}>{c.cancel}</Button>
            <Button
              variant="danger"
              loading={archiveMut.isPending}
              onClick={() => archiveTarget && archiveMut.mutate(archiveTarget.id)}
            >
              {c.archive}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
