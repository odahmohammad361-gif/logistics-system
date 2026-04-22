import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight, ArrowLeft, User, Phone, Mail, MapPin, Building2,
  Hash, Calendar, FileText, TrendingUp, Package,
  ExternalLink, Barcode, CheckCircle2, XCircle, Plus, Eye, Pencil,
  Trash2, Download, ChevronDown, Loader2,
} from 'lucide-react'
import { getClient } from '@/services/clientService'
import { getInvoices, createInvoice, updateInvoice, deleteInvoice, downloadPdf, uploadStamp, uploadBackground } from '@/services/invoiceService'
import type { Invoice, InvoiceStatus } from '@/types'
import { useUIStore } from '@/store/uiStore'
import { useAuth } from '@/hooks/useAuth'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import InvoiceForm from '@/components/invoice/InvoiceForm'
import InvoicePreview from '@/components/invoice/InvoicePreview'
import clsx from 'clsx'

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft:     'bg-gray-500/15 text-gray-400 border-gray-500/30',
  sent:      'bg-blue-500/15 text-blue-400 border-blue-500/30',
  approved:  'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  paid:      'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
  dummy:     'bg-purple-500/15 text-purple-400 border-purple-500/30',
}



function fmt(date: string) {
  return new Date(date).toLocaleDateString('ar-JO', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' ' + currency
}

// ── Info Row ──────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-brand-border/30 last:border-0">
      <div className="w-7 h-7 rounded-md bg-brand-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={13} className="text-brand-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-brand-text-muted uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm text-brand-text font-medium">{value}</p>
      </div>
    </div>
  )
}

// ── Stat Box ─────────────────────────────────────────────────────────────────
function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={clsx('rounded-xl p-4 border', color)}>
      <p className="text-[11px] font-medium opacity-70 mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}

const ALL_STATUSES: { value: InvoiceStatus; label: string; color: string; bg: string }[] = [
  { value: 'draft',     label: 'مسودة',   color: 'text-gray-400',    bg: 'hover:bg-gray-500/10'    },
  { value: 'sent',      label: 'مرسلة',   color: 'text-blue-400',    bg: 'hover:bg-blue-500/10'    },
  { value: 'approved',  label: 'معتمدة',  color: 'text-indigo-400',  bg: 'hover:bg-indigo-500/10'  },
  { value: 'paid',      label: 'مدفوعة',  color: 'text-emerald-400', bg: 'hover:bg-emerald-500/10' },
  { value: 'cancelled', label: 'ملغاة',   color: 'text-red-400',     bg: 'hover:bg-red-500/10'     },
  { value: 'dummy',     label: 'غير معتمدة', color: 'text-purple-400', bg: 'hover:bg-purple-500/10' },
]

// ── StatusChanger — clickable badge with portal dropdown ──────────────────────
function StatusChanger({
  invoice, onUpdate, canEdit,
}: {
  invoice: Invoice
  onUpdate: (id: number, status: InvoiceStatus) => Promise<void>
  canEdit: boolean
}) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  // Calculate dropdown position anchored to the button
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const dropW = 208 // w-52
    // flip left if would overflow right edge
    const left = rect.right - dropW < 0 ? rect.left : rect.right - dropW
    setDropPos({
      top:   rect.bottom + window.scrollY + 6,
      left:  left + window.scrollX,
      width: dropW,
    })
  }, [open])

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [open])

  const current = ALL_STATUSES.find(s => s.value === invoice.status)!
  const options = ALL_STATUSES.filter(s => s.value !== invoice.status)

  async function handleChange(next: InvoiceStatus) {
    setLoading(true)
    setOpen(false)
    try { await onUpdate(invoice.id, next) } finally { setLoading(false) }
  }

  if (!canEdit) {
    return (
      <span className={clsx(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium',
        STATUS_STYLES[invoice.status],
      )}>
        {current.label}
      </span>
    )
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen(p => !p) }}
        disabled={loading}
        className={clsx(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium',
          'transition-all cursor-pointer select-none hover:opacity-80 active:scale-95',
          STATUS_STYLES[invoice.status],
          loading && 'opacity-50 cursor-wait',
        )}
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : current.label}
        {!loading && <ChevronDown size={11} className="opacity-60" />}
      </button>

      {open && createPortal(
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top:      dropPos.top,
            left:     dropPos.left,
            width:    dropPos.width,
            zIndex:   9999,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
          className="rounded-xl border border-brand-border bg-brand-card py-2"
        >
          <p className="text-[11px] text-brand-text-muted px-4 pt-1 pb-2 uppercase tracking-wider font-semibold border-b border-brand-border/40 mb-1">
            تغيير الحالة إلى
          </p>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleChange(opt.value)}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-start',
                opt.color, opt.bg,
              )}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-current opacity-80 shrink-0" />
              {opt.label}
            </button>
          ))}
          <div className="border-t border-brand-border/40 mt-1 pt-1">
            <button
              onClick={() => setOpen(false)}
              className="w-full text-center text-xs text-brand-text-muted hover:text-brand-text py-2 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ClientProfile() {
  const { id } = useParams<{ id: string }>()
  const clientId = Number(id)
  const navigate  = useNavigate()
  const { t }     = useTranslation()
  const { lang }  = useUIStore()
  const { isStaff, isAdmin } = useAuth()
  const qc        = useQueryClient()
  const isRTL     = lang === 'ar'
  const BackIcon  = isRTL ? ArrowRight : ArrowLeft

  // ── Modal state ──
  const [createOpen, setCreateOpen]   = useState(false)
  const [viewing, setViewing]         = useState<Invoice | null>(null)
  const [editing, setEditing]         = useState<Invoice | null>(null)
  const [deleting, setDeleting]       = useState<Invoice | null>(null)

  // ── Queries ──
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn:  () => getClient(clientId),
    enabled:  !!clientId,
  })

  const { data: invoicesData, isLoading: invLoading } = useQuery({
    queryKey: ['invoices', { client_id: clientId }],
    queryFn:  () => getInvoices({ client_id: clientId, page_size: 100 }),
    enabled:  !!clientId,
  })

  const invoices = invoicesData?.results ?? []

  // ── Mutations ──
  const createMut = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices', { client_id: clientId }] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      setCreateOpen(false)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateInvoice>[1] }) =>
      updateInvoice(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices', { client_id: clientId }] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      setEditing(null)
    },
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: InvoiceStatus }) =>
      updateInvoice(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices', { client_id: clientId }] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })

  async function handleStatusChange(id: number, status: InvoiceStatus) {
    await statusMut.mutateAsync({ id, status })
  }

  const deleteMut = useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices', { client_id: clientId }] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      setDeleting(null)
    },
  })

  async function handleDownload(inv: Invoice) {
    const blob = await downloadPdf(inv.id)
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${inv.invoice_number}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Stats ──
  const totalInvoices = invoicesData?.total ?? 0
  const paidTotal     = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const pendingTotal  = invoices.filter(i => ['sent', 'approved'].includes(i.status)).reduce((s, i) => s + i.total, 0)
  const currency      = invoices[0]?.currency ?? 'USD'

  // ── Loading ──
  if (clientLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="skeleton h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="skeleton h-80 rounded-xl" />
          <div className="skeleton h-80 rounded-xl lg:col-span-2" />
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-brand-text-muted">
        <XCircle size={40} />
        <p>العميل غير موجود</p>
        <button className="btn-secondary text-sm" onClick={() => navigate('/clients')}>العودة للعملاء</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/clients')} className="btn-icon" title="رجوع">
          <BackIcon size={18} />
        </button>
        <div>
          <h1 className="page-title">{isRTL && client.name_ar ? client.name_ar : client.name}</h1>
          <p className="page-subtitle">{client.client_code}</p>
        </div>
        <div className="ms-auto flex items-center gap-2">
          <span className={clsx(
            'badge border text-xs',
            client.is_active
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-red-500/10 text-red-400 border-red-500/30',
          )}>
            {client.is_active
              ? <><CheckCircle2 size={11} /> نشط</>
              : <><XCircle size={11} /> غير نشط</>
            }
          </span>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox
          label="إجمالي الفواتير"
          value={String(totalInvoices)}
          color="bg-brand-primary/5 border-brand-primary/20 text-brand-primary"
        />
        <StatBox
          label="المدفوع"
          value={fmtMoney(paidTotal, currency)}
          color="bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
        />
        <StatBox
          label="قيد الانتظار"
          value={fmtMoney(pendingTotal, currency)}
          color="bg-amber-500/5 border-amber-500/20 text-amber-400"
        />
        <StatBox
          label="الفرع"
          value={client.branch ? (isRTL ? client.branch.name_ar : client.branch.name) : '—'}
          color="bg-blue-500/5 border-blue-500/20 text-blue-400"
        />
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Client Info Card ── */}
        <div className="card space-y-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-brand-primary/15 flex items-center justify-center">
              <User size={16} className="text-brand-primary" />
            </div>
            <h3 className="text-sm font-semibold text-brand-text">بيانات العميل</h3>
          </div>

          <InfoRow icon={Hash}      label="رمز العميل"        value={client.client_code} />
          <InfoRow icon={User}      label="الاسم"             value={client.name} />
          {client.name_ar && <InfoRow icon={User} label="الاسم بالعربي" value={client.name_ar} />}
          <InfoRow icon={Building2} label="الشركة"            value={client.company_name ?? undefined} />
          {client.company_name_ar && <InfoRow icon={Building2} label="الشركة بالعربي" value={client.company_name_ar} />}
          <InfoRow icon={Phone}     label="الهاتف"            value={client.phone ?? undefined} />
          <InfoRow icon={Mail}      label="البريد الإلكتروني" value={client.email ?? undefined} />
          <InfoRow icon={MapPin}    label="المدينة"           value={client.city ?? undefined} />
          <InfoRow icon={MapPin}    label="الدولة"            value={client.country ?? undefined} />
          <InfoRow icon={MapPin}    label="العنوان"           value={client.address ?? undefined} />
          <InfoRow icon={Calendar}  label="تاريخ الإنشاء"    value={fmt(client.created_at)} />

          {client.notes && (
            <div className="mt-3 p-3 rounded-lg bg-brand-surface border border-brand-border/50">
              <p className="text-[10px] text-brand-text-muted uppercase tracking-wider mb-1">ملاحظات</p>
              <p className="text-sm text-brand-text-dim">{client.notes}</p>
            </div>
          )}

          <div className="pt-3">
            <Link
              to={`/clients?search=${encodeURIComponent(client.client_code)}`}
              className="btn-secondary w-full text-xs justify-center gap-2"
            >
              <Barcode size={13} />
              عرض في قائمة العملاء
            </Link>
          </div>
        </div>

        {/* ── Invoices Panel ── */}
        <div className="lg:col-span-2 card">

          {/* Panel Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <FileText size={16} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-brand-text">الفواتير</h3>
                <p className="text-xs text-brand-text-muted">{totalInvoices} فاتورة</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isStaff && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus size={13} />
                  فاتورة جديدة
                </Button>
              )}
              <Link to={`/invoices?client_id=${clientId}`} className="btn-ghost text-xs gap-1">
                عرض الكل
                <ExternalLink size={12} />
              </Link>
            </div>
          </div>

          {/* Table */}
          {invLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-12 rounded-lg" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-brand-text-muted">
              <div className="w-14 h-14 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center">
                <Package size={22} className="opacity-40" />
              </div>
              <p className="text-sm">لا توجد فواتير لهذا العميل</p>
              {isStaff && (
                <button className="btn-primary text-xs" onClick={() => setCreateOpen(true)}>
                  <Plus size={13} /> إنشاء فاتورة
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[540px]">
                <thead>
                  <tr className="border-b border-brand-border/60">
                    <th className="table-head text-start pb-2">رقم الفاتورة</th>
                    <th className="table-head text-start pb-2">النوع</th>
                    <th className="table-head text-start pb-2">الحالة</th>
                    <th className="table-head text-start pb-2">التاريخ</th>
                    <th className="table-head text-end pb-2">المبلغ</th>
                    <th className="table-head pb-2 w-28" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: Invoice) => (
                    <tr key={inv.id} className="table-row">
                      <td className="table-cell font-mono text-brand-text text-xs">
                        {inv.invoice_number}
                      </td>
                      <td className="table-cell">
                        <span className="badge bg-brand-primary/10 text-brand-primary border border-brand-primary/20 text-[10px]">
                          {t(`invoices.types.${inv.invoice_type}`, inv.invoice_type)}
                        </span>
                      </td>
                      <td className="table-cell">
                        <StatusChanger
                          invoice={inv}
                          onUpdate={handleStatusChange}
                          canEdit={isStaff}
                        />
                      </td>
                      <td className="table-cell text-xs">{fmt(inv.issue_date)}</td>
                      <td className="table-cell text-end font-medium text-brand-text text-xs">
                        {fmtMoney(inv.total, inv.currency)}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1">
                          {/* Preview */}
                          <button
                            onClick={() => setViewing(inv)}
                            className="btn-icon p-1.5"
                            title="معاينة"
                          >
                            <Eye size={13} />
                          </button>
                          {/* Download PDF */}
                          <button
                            onClick={() => handleDownload(inv)}
                            className="btn-icon p-1.5"
                            title="تحميل PDF"
                          >
                            <Download size={13} />
                          </button>
                          {/* Edit */}
                          {isStaff && (
                            <button
                              onClick={() => setEditing(inv)}
                              className="btn-icon p-1.5"
                              title="تعديل الفاتورة"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {/* Delete */}
                          {isAdmin && (
                            <button
                              onClick={() => setDeleting(inv)}
                              className="btn-icon p-1.5 hover:text-brand-red hover:bg-brand-red/10"
                              title="حذف"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary footer */}
          {invoices.length > 0 && (
            <div className="mt-4 pt-4 border-t border-brand-border/40 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs text-brand-text-muted">
                <TrendingUp size={13} className="text-emerald-400" />
                <span>المدفوع:</span>
                <span className="text-emerald-400 font-semibold">{fmtMoney(paidTotal, currency)}</span>
              </div>
              <div className="text-xs text-brand-text-muted">
                قيد الانتظار: <span className="text-amber-400 font-semibold">{fmtMoney(pendingTotal, currency)}</span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Create Invoice Modal ── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="فاتورة جديدة"
        size="xl"
      >
        <InvoiceForm
          initial={{ client_id: clientId } as any}
          lockedClient={{ id: client.id, name: client.name, name_ar: client.name_ar, client_code: client.client_code }}
          onSubmit={async (v) => createMut.mutateAsync(v)}
          loading={createMut.isPending}
          hideStatus
        />
      </Modal>

      {/* ── Edit Invoice Modal ── */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `تعديل الفاتورة — ${editing.invoice_number}` : ''}
        size="xl"
      >
        {editing && (
          <InvoiceForm
            key={editing.id}
            initial={editing}
            invoiceId={editing.id}
            lockedClient={{ id: client.id, name: client.name, name_ar: client.name_ar, client_code: client.client_code }}
            onSubmit={async (v) => updateMut.mutateAsync({ id: editing.id, data: v })}
            loading={updateMut.isPending}
            hideStatus
            onStampUpload={async (file) => {
              await uploadStamp(editing.id, file)
              qc.invalidateQueries({ queryKey: ['invoices', { client_id: clientId }] })
            }}
            onBackgroundUpload={async (file) => {
              await uploadBackground(editing.id, file)
              qc.invalidateQueries({ queryKey: ['invoices', { client_id: clientId }] })
            }}
          />
        )}
      </Modal>

      {/* ── Preview Modal ── */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.invoice_number ?? ''}
        size="lg"
      >
        {viewing && (
          <div className="space-y-4">
            <InvoicePreview invoice={viewing} />
            <div className="flex justify-end gap-3 pt-2 border-t border-brand-border">
              {isStaff && (
                <Button
                  variant="secondary"
                  onClick={() => { setEditing(viewing); setViewing(null) }}
                >
                  <Pencil size={14} />
                  تعديل
                </Button>
              )}
              <Button onClick={() => handleDownload(viewing)}>
                <Download size={14} />
                تحميل PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="تأكيد الحذف"
        size="sm"
      >
        <p className="text-sm text-brand-text-dim mb-5">
          هل أنت متأكد من حذف الفاتورة <span className="font-mono font-bold text-brand-text">{deleting?.invoice_number}</span>؟
          <br />
          <span className="text-xs text-brand-red/80">لا يمكن التراجع عن هذه العملية.</span>
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleting(null)}>إلغاء</Button>
          <Button
            variant="danger"
            loading={deleteMut.isPending}
            onClick={() => deleting && deleteMut.mutate(deleting.id)}
          >
            <Trash2 size={14} />
            حذف
          </Button>
        </div>
      </Modal>

    </div>
  )
}
