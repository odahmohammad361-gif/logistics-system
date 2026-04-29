import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight, ArrowLeft, User, Phone, Mail, MapPin, Building2,
  Hash, Calendar, FileText, TrendingUp, Package,
  Barcode, CheckCircle2, XCircle, Plus, Eye, Pencil,
  Trash2, Download, ChevronDown, Loader2, KeyRound, Copy, RefreshCw,
  CreditCard, ReceiptText, Ship, Calculator, Truck,
} from 'lucide-react'
import { getClient } from '@/services/clientService'
import {
  getInvoices, createInvoice, updateInvoice, updateInvoiceStatus, deleteInvoice, downloadPdf,
  uploadStamp, uploadBackground, createInvoicePayment, downloadPaymentReceiptHtml,
} from '@/services/invoiceService'
import { getBookings, getBooking, getCargoDocumentUrl } from '@/services/bookingService'
import { createServiceQuote, getServiceQuotes, suggestServiceQuoteRates } from '@/services/serviceQuoteService'
import api from '@/services/api'
import type { BookingCargoDocument, Invoice, InvoiceStatus, ServiceQuote, ServiceQuoteMode, ServiceQuoteScope, ServiceQuoteSuggestion } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import InvoiceForm from '@/components/invoice/InvoiceForm'
import InvoicePreview from '@/components/invoice/InvoicePreview'
import clsx from 'clsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft:     'bg-gray-500/15 text-gray-400 border-gray-500/30',
  sent:      'bg-blue-500/15 text-blue-400 border-blue-500/30',
  approved:  'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  paid:      'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
  dummy:     'bg-purple-500/15 text-purple-400 border-purple-500/30',
}

const STATUS_COLORS: Record<InvoiceStatus, { color: string; bg: string }> = {
  draft:     { color: 'text-gray-400',    bg: 'hover:bg-gray-500/10'    },
  sent:      { color: 'text-blue-400',    bg: 'hover:bg-blue-500/10'    },
  approved:  { color: 'text-indigo-400',  bg: 'hover:bg-indigo-500/10'  },
  paid:      { color: 'text-emerald-400', bg: 'hover:bg-emerald-500/10' },
  cancelled: { color: 'text-red-400',     bg: 'hover:bg-red-500/10'     },
  dummy:     { color: 'text-purple-400',  bg: 'hover:bg-purple-500/10'  },
}

const ALL_STATUS_KEYS: InvoiceStatus[] = ['draft', 'sent', 'approved', 'paid', 'cancelled', 'dummy']

function fmtMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' ' + currency
}

function numOrNull(value: string) {
  const n = Number(value)
  return Number.isFinite(n) && value.trim() !== '' ? n : null
}

function toLocalDateTimeInput(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

interface ClientPackingListFile {
  bookingId: number
  bookingNumber: string
  containerNo: string | null
  blNumber: string | null
  lineId: number
  doc: BookingCargoDocument
}

interface ServiceQuoteFormState {
  mode: ServiceQuoteMode
  service_scope: ServiceQuoteScope
  cargo_source: string
  origin_city: string
  pickup_address: string
  port_of_loading: string
  port_of_discharge: string
  destination_country: string
  destination_city: string
  container_size: string
  cbm: string
  gross_weight_kg: string
  chargeable_weight_kg: string
  cartons: string
  goods_description: string
  clearance_through_us: boolean
  delivery_through_us: boolean
  manual_sell_rate: string
  manual_buy_rate: string
  destination_fees_sell: string
  other_fees_sell: string
  notes: string
  selected_rate_id: number | null
}

function defaultServiceQuoteForm(destinationCountry = ''): ServiceQuoteFormState {
  return {
    mode: 'SEA_LCL',
    service_scope: 'warehouse_to_port',
    cargo_source: 'outside_supplier',
    origin_city: '',
    pickup_address: '',
    port_of_loading: '',
    port_of_discharge: '',
    destination_country: destinationCountry,
    destination_city: '',
    container_size: '40HQ',
    cbm: '',
    gross_weight_kg: '',
    chargeable_weight_kg: '',
    cartons: '',
    goods_description: '',
    clearance_through_us: false,
    delivery_through_us: false,
    manual_sell_rate: '',
    manual_buy_rate: '',
    destination_fees_sell: '',
    other_fees_sell: '',
    notes: '',
    selected_rate_id: null,
  }
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

// ── Stat Box ──────────────────────────────────────────────────────────────────
function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={clsx('rounded-xl p-4 border', color)}>
      <p className="text-[11px] font-medium opacity-70 mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}

function paymentScheduleDueRows(invoice: Invoice) {
  const schedule = [...(invoice.payment_schedule ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  let unappliedPaid = Number(invoice.paid_amount ?? 0)

  return schedule.map((part) => {
    const amount = Number(part.amount ?? 0)
    const applied = Math.min(Math.max(unappliedPaid, 0), amount)
    unappliedPaid = Math.max(unappliedPaid - amount, 0)
    return { ...part, remaining_amount: Math.max(amount - applied, 0) }
  }).filter((part) => part.remaining_amount > 0.009)
}

function suggestedPaymentAmount(invoice: Invoice) {
  const nextSchedule = paymentScheduleDueRows(invoice)[0]
  const balanceDue = Number(invoice.balance_due ?? invoice.total ?? 0)
  return Math.max(nextSchedule?.remaining_amount ?? balanceDue, 0)
}

function quoteModeLabel(mode: string, isAr: boolean) {
  if (mode === 'SEA_LCL') return isAr ? 'بحري LCL' : 'Sea LCL'
  if (mode === 'SEA_FCL') return isAr ? 'بحري FCL' : 'Sea FCL'
  if (mode === 'AIR') return isAr ? 'جوي' : 'Air'
  return mode
}

function quoteScopeLabel(scope: string, isAr: boolean) {
  const labels: Record<string, { en: string; ar: string }> = {
    port_to_port: { en: 'Port to port', ar: 'من ميناء إلى ميناء' },
    warehouse_to_port: { en: 'Warehouse to port', ar: 'من المستودع إلى الميناء' },
    factory_to_port: { en: 'Factory to port', ar: 'من المصنع إلى الميناء' },
    warehouse_to_door: { en: 'Warehouse to door', ar: 'من المستودع إلى الباب' },
    factory_to_door: { en: 'Factory to door', ar: 'من المصنع إلى الباب' },
  }
  return labels[scope]?.[isAr ? 'ar' : 'en'] ?? scope
}

// ── StatusChanger ─────────────────────────────────────────────────────────────
function StatusChanger({
  invoice, onUpdate, canEdit,
}: {
  invoice: Invoice
  onUpdate: (id: number, status: InvoiceStatus) => Promise<void>
  canEdit: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const dropW = 208
    const left  = rect.right - dropW < 0 ? rect.left : rect.right - dropW
    setDropPos({ top: rect.bottom + window.scrollY + 6, left: left + window.scrollX, width: dropW })
  }, [open])

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

  const hasBalanceDue = Number(invoice.balance_due ?? 0) > 0.009
  const options = ALL_STATUS_KEYS.filter(s => s !== invoice.status && !(s === 'paid' && hasBalanceDue))

  async function handleChange(next: InvoiceStatus) {
    setLoading(true); setOpen(false)
    try { await onUpdate(invoice.id, next) } finally { setLoading(false) }
  }

  const currentLabel = t(`clients.status_${invoice.status}`)

  if (!canEdit) {
    return (
      <span className={clsx('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium', STATUS_STYLES[invoice.status])}>
        {currentLabel}
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
        {loading ? <Loader2 size={12} className="animate-spin" /> : currentLabel}
        {!loading && <ChevronDown size={11} className="opacity-60" />}
      </button>

      {open && createPortal(
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
          className="rounded-xl border border-brand-border bg-brand-card py-2"
        >
          <p className="text-[11px] text-brand-text-muted px-4 pt-1 pb-2 uppercase tracking-wider font-semibold border-b border-brand-border/40 mb-1">
            {t('clients.status_change_label')}
          </p>
          {options.map((key) => (
            <button
              key={key}
              onClick={() => handleChange(key)}
              className={clsx('w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-start', STATUS_COLORS[key].color, STATUS_COLORS[key].bg)}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-current opacity-80 shrink-0" />
              {t(`clients.status_${key}`)}
            </button>
          ))}
          <div className="border-t border-brand-border/40 mt-1 pt-1">
            <button onClick={() => setOpen(false)} className="w-full text-center text-xs text-brand-text-muted hover:text-brand-text py-2 transition-colors">
              {t('common.cancel')}
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
  const { id }      = useParams<{ id: string }>()
  const clientId    = Number(id)
  const navigate    = useNavigate()
  const { t, i18n } = useTranslation()
  const { isStaff, isAdmin } = useAuth()
  const qc          = useQueryClient()
  const isAr        = i18n.language === 'ar'
  const BackIcon    = isAr ? ArrowRight : ArrowLeft
  const dateLocale  = isAr ? 'ar-JO' : 'en-GB'

  const [createOpen, setCreateOpen]   = useState(false)
  const [viewing, setViewing]         = useState<Invoice | null>(null)
  const [editing, setEditing]         = useState<Invoice | null>(null)
  const [deleting, setDeleting]       = useState<Invoice | null>(null)
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'cash',
    paid_at: toLocalDateTimeInput(),
    reference_no: '',
    notes: '',
  })
  const [pwdModal, setPwdModal]       = useState(false)
  const [pwdResult, setPwdResult]     = useState<{ password: string; client_code: string } | null>(null)
  const [pwdLoading, setPwdLoading]   = useState(false)
  const [copied, setCopied]           = useState(false)
  const [serviceQuoteOpen, setServiceQuoteOpen] = useState(false)
  const [serviceQuoteForm, setServiceQuoteForm] = useState<ServiceQuoteFormState>(() => defaultServiceQuoteForm())
  const [serviceQuoteSuggestions, setServiceQuoteSuggestions] = useState<ServiceQuoteSuggestion[]>([])
  const [serviceQuoteSuggesting, setServiceQuoteSuggesting] = useState(false)

  async function generatePortalPassword() {
    setPwdLoading(true)
    try {
      const res = await api.post(`/clients/${clientId}/set-portal-password`, { generate: true })
      setPwdResult(res.data)
    } finally {
      setPwdLoading(false)
    }
  }

  function copyPassword() {
    if (!pwdResult) return
    navigator.clipboard.writeText(pwdResult.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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

  const { data: serviceQuotesData, isLoading: serviceQuotesLoading } = useQuery({
    queryKey: ['service-quotes', { client_id: clientId }],
    queryFn: () => getServiceQuotes(clientId),
    enabled: !!clientId,
  })

  const serviceQuotes = serviceQuotesData?.results ?? []

  const { data: packingListFiles = [], isLoading: plLoading } = useQuery({
    queryKey: ['client-packing-lists', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const summary = await getBookings({ client_id: clientId, page_size: 50 })
      const bookingIds = Array.from(new Set(summary.results.map((item) => item.id)))
      const bookings = await Promise.all(bookingIds.map((bookingId) => getBooking(bookingId)))
      return bookings.flatMap((booking): ClientPackingListFile[] =>
        booking.cargo_lines
          .filter((line) => line.client.id === clientId)
          .flatMap((line) =>
            line.documents
              .filter((doc) => doc.document_type === 'pl')
              .map((doc) => ({
                bookingId: booking.id,
                bookingNumber: booking.booking_number,
                containerNo: booking.container_no,
                blNumber: booking.bl_number,
                lineId: line.id,
                doc,
              })),
          ),
      )
    },
  })

  const createMut = useMutation({
    mutationFn: createInvoice,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['invoices', { client_id: clientId }] }); qc.invalidateQueries({ queryKey: ['invoices'] }); setCreateOpen(false) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateInvoice>[1] }) => updateInvoice(id, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['invoices', { client_id: clientId }] }); qc.invalidateQueries({ queryKey: ['invoices'] }); setEditing(null) },
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: InvoiceStatus }) => updateInvoiceStatus(id, status),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['invoices', { client_id: clientId }] }); qc.invalidateQueries({ queryKey: ['invoices'] }) },
  })

  const deleteMut = useMutation({
    mutationFn: deleteInvoice,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['invoices', { client_id: clientId }] }); qc.invalidateQueries({ queryKey: ['invoices'] }); setDeleting(null) },
  })

  const paymentMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => createInvoicePayment(id, data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['invoices', { client_id: clientId }] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      setPaymentInvoice(null)
    },
  })

  const createServiceQuoteMut = useMutation({
    mutationFn: createServiceQuote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-quotes', { client_id: clientId }] })
      setServiceQuoteOpen(false)
      setServiceQuoteSuggestions([])
    },
  })

  async function handleStatusChange(id: number, status: InvoiceStatus) {
    try {
      await statusMut.mutateAsync({ id, status })
    } catch {
      window.alert(isAr ? 'تعذر تغيير الحالة. سجل الدفعة أولاً إذا كانت الحالة مدفوعة.' : 'Could not change status. Record the payment first if the invoice is paid.')
    }
  }

  async function handleDownload(inv: Invoice) {
    const blob = await downloadPdf(inv.id)
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `${inv.invoice_number}.pdf`; a.click()
    URL.revokeObjectURL(url)
  }

  async function openReceipt(inv: Invoice, lang: 'ar' | 'en' = isAr ? 'ar' : 'en') {
    const payment = inv.payments?.[0]
    if (!payment) return
    const blob = await downloadPaymentReceiptHtml(inv.id, payment.id, lang)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  function openPayment(inv: Invoice) {
    const due = suggestedPaymentAmount(inv)
    setPaymentInvoice(inv)
    setPaymentForm({
      amount: due > 0 ? due.toFixed(2) : Number(inv.total ?? 0).toFixed(2),
      payment_method: 'cash',
      paid_at: toLocalDateTimeInput(),
      reference_no: '',
      notes: '',
    })
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentInvoice) return
    const amount = Number(paymentForm.amount)
    const balanceDue = Number(paymentInvoice.balance_due ?? paymentInvoice.total ?? 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert(isAr ? 'أدخل مبلغ دفعة صحيح' : 'Enter a valid payment amount')
      return
    }
    if (amount - balanceDue > 0.009) {
      window.alert(isAr ? 'المبلغ أكبر من الرصيد المتبقي' : 'Amount is greater than the remaining balance')
      return
    }
    await paymentMut.mutateAsync({
      id: paymentInvoice.id,
      data: {
        amount,
        currency: paymentInvoice.currency,
        payment_method: paymentForm.payment_method,
        paid_at: paymentForm.paid_at ? new Date(paymentForm.paid_at).toISOString() : undefined,
        reference_no: paymentForm.reference_no || null,
        notes: paymentForm.notes || null,
      },
    })
  }

  function openServiceQuote() {
    setServiceQuoteForm(defaultServiceQuoteForm(client?.country ?? ''))
    setServiceQuoteSuggestions([])
    setServiceQuoteOpen(true)
  }

  async function loadServiceQuoteSuggestions() {
    setServiceQuoteSuggesting(true)
    try {
      const rows = await suggestServiceQuoteRates({
        mode: serviceQuoteForm.mode,
        service_scope: serviceQuoteForm.service_scope,
        container_size: serviceQuoteForm.container_size || undefined,
        cbm: numOrNull(serviceQuoteForm.cbm),
        gross_weight_kg: numOrNull(serviceQuoteForm.gross_weight_kg),
        chargeable_weight_kg: numOrNull(serviceQuoteForm.chargeable_weight_kg),
        port_of_loading: serviceQuoteForm.port_of_loading || undefined,
        port_of_discharge: serviceQuoteForm.port_of_discharge || undefined,
      })
      setServiceQuoteSuggestions(rows)
      if (rows[0]?.agent_carrier_rate_id) {
        setServiceQuoteForm((p) => ({ ...p, selected_rate_id: rows[0].agent_carrier_rate_id }))
      }
    } finally {
      setServiceQuoteSuggesting(false)
    }
  }

  async function submitServiceQuote(e: React.FormEvent) {
    e.preventDefault()
    const selected = serviceQuoteSuggestions.find((row) => row.agent_carrier_rate_id === serviceQuoteForm.selected_rate_id)
    await createServiceQuoteMut.mutateAsync({
      client_id: clientId,
      mode: serviceQuoteForm.mode,
      service_scope: serviceQuoteForm.service_scope,
      cargo_source: serviceQuoteForm.cargo_source,
      origin_country: 'China',
      origin_city: serviceQuoteForm.origin_city || null,
      pickup_address: serviceQuoteForm.pickup_address || null,
      port_of_loading: serviceQuoteForm.port_of_loading || selected?.port_of_loading || null,
      port_of_discharge: serviceQuoteForm.port_of_discharge || selected?.port_of_discharge || null,
      destination_country: serviceQuoteForm.destination_country || null,
      destination_city: serviceQuoteForm.destination_city || null,
      container_size: serviceQuoteForm.mode === 'SEA_FCL' || serviceQuoteForm.mode === 'SEA_LCL' ? serviceQuoteForm.container_size || null : null,
      cbm: numOrNull(serviceQuoteForm.cbm),
      gross_weight_kg: numOrNull(serviceQuoteForm.gross_weight_kg),
      chargeable_weight_kg: numOrNull(serviceQuoteForm.chargeable_weight_kg),
      cartons: numOrNull(serviceQuoteForm.cartons),
      goods_description: serviceQuoteForm.goods_description || null,
      clearance_through_us: serviceQuoteForm.clearance_through_us,
      delivery_through_us: serviceQuoteForm.delivery_through_us,
      shipping_agent_id: selected?.agent_id ?? null,
      agent_carrier_rate_id: serviceQuoteForm.selected_rate_id,
      carrier_name: selected?.carrier_name ?? null,
      manual_sell_rate: serviceQuoteForm.selected_rate_id ? null : numOrNull(serviceQuoteForm.manual_sell_rate),
      manual_buy_rate: serviceQuoteForm.selected_rate_id ? null : numOrNull(serviceQuoteForm.manual_buy_rate),
      destination_fees_sell: numOrNull(serviceQuoteForm.destination_fees_sell),
      other_fees_sell: numOrNull(serviceQuoteForm.other_fees_sell),
      notes: serviceQuoteForm.notes || null,
    })
  }

  function fmt(date: string) {
    return new Date(date).toLocaleDateString(dateLocale, { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const totalInvoices = invoicesData?.total ?? 0
  const paidTotal     = invoices.reduce((s, i) => s + Number(i.paid_amount ?? 0), 0)
  const pendingTotal  = invoices.reduce((s, i) => s + Number(i.balance_due ?? i.total ?? 0), 0)
  const currency      = invoices[0]?.currency ?? 'USD'
  const paymentMethods = [
    { value: 'cash', label: isAr ? 'نقداً' : 'Cash' },
    { value: 'bank_transfer', label: isAr ? 'حوالة بنكية' : 'Bank transfer' },
    { value: 'cliq', label: 'CliQ' },
    { value: 'card', label: isAr ? 'بطاقة' : 'Card' },
    { value: 'other', label: isAr ? 'أخرى' : 'Other' },
  ]

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
        <p>{t('clients.profile_not_found')}</p>
        <button className="btn-secondary text-sm" onClick={() => navigate('/clients')}>
          {t('clients.profile_back_to_list')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/clients')} className="btn-icon" title={t('clients.profile_back')}>
          <BackIcon size={18} />
        </button>
        <div>
          <h1 className="page-title">{isAr && client.name_ar ? client.name_ar : client.name}</h1>
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
              ? <><CheckCircle2 size={11} /> {t('clients.profile_active')}</>
              : <><XCircle size={11} /> {t('clients.profile_inactive')}</>
            }
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label={t('clients.stat_total_invoices')} value={String(totalInvoices)} color="bg-brand-primary/5 border-brand-primary/20 text-brand-primary" />
        <StatBox label={t('clients.stat_paid')}           value={fmtMoney(paidTotal, currency)}    color="bg-emerald-500/5 border-emerald-500/20 text-emerald-400" />
        <StatBox label={t('clients.stat_pending')}        value={fmtMoney(pendingTotal, currency)}  color="bg-amber-500/5 border-amber-500/20 text-amber-400" />
        <StatBox
          label={t('clients.stat_branch')}
          value={client.branch ? (isAr ? (client.branch.name_ar ?? client.branch.name) : client.branch.name) : '—'}
          color="bg-blue-500/5 border-blue-500/20 text-blue-400"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Client Info Card */}
        <div className="card space-y-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-brand-primary/15 flex items-center justify-center">
              <User size={16} className="text-brand-primary" />
            </div>
            <h3 className="text-sm font-semibold text-brand-text">{t('clients.profile_title')}</h3>
          </div>

          <InfoRow icon={Hash}      label={t('clients.profile_code')}    value={client.client_code} />
          <InfoRow icon={User}      label={t('clients.profile_name')}    value={client.name} />
          {client.name_ar && <InfoRow icon={User} label={t('clients.profile_name_ar')} value={client.name_ar} />}
          <InfoRow icon={Building2} label={t('clients.profile_company')} value={client.company_name ?? undefined} />
          {client.company_name_ar && <InfoRow icon={Building2} label={t('clients.profile_company_ar')} value={client.company_name_ar} />}
          <InfoRow icon={Phone}     label={t('clients.phone')}           value={client.phone ?? undefined} />
          <InfoRow icon={Mail}      label={t('clients.email')}           value={client.email ?? undefined} />
          <InfoRow icon={MapPin}    label={t('clients.city')}            value={client.city ?? undefined} />
          <InfoRow icon={MapPin}    label={t('clients.country')}         value={client.country ?? undefined} />
          <InfoRow icon={MapPin}    label={t('clients.address')}         value={client.address ?? undefined} />
          <InfoRow icon={Calendar}  label={t('clients.profile_created')} value={fmt(client.created_at)} />

          {client.notes && (
            <div className="mt-3 p-3 rounded-lg bg-brand-surface border border-brand-border/50">
              <p className="text-[10px] text-brand-text-muted uppercase tracking-wider mb-1">{t('clients.profile_notes')}</p>
              <p className="text-sm text-brand-text-dim">{client.notes}</p>
            </div>
          )}

          <div className="pt-3 space-y-2">
            <Link
              to={`/clients?search=${encodeURIComponent(client.client_code)}`}
              className="btn-secondary w-full text-xs justify-center gap-2"
            >
              <Barcode size={13} />
              {t('clients.profile_view_in_list')}
            </Link>
            {isStaff && (
              <button
                onClick={() => { setPwdModal(true); setPwdResult(null) }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-amber-500/25 text-amber-400 text-xs hover:bg-amber-500/10 transition-colors"
              >
                <KeyRound size={13} />
                {isAr ? 'تعيين كلمة مرور الموقع' : 'Set Portal Password'}
              </button>
            )}
          </div>
        </div>

        {/* Invoices Panel */}
        <div className="lg:col-span-2 card">

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <FileText size={16} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-brand-text">{t('clients.inv_panel_title')}</h3>
                <p className="text-xs text-brand-text-muted">{t('clients.inv_count', { count: totalInvoices })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isStaff && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus size={13} /> {t('clients.inv_new')}
                </Button>
              )}
            </div>
          </div>

          {invLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-brand-text-muted">
              <div className="w-14 h-14 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center">
                <Package size={22} className="opacity-40" />
              </div>
              <p className="text-sm">{t('clients.inv_empty')}</p>
              {isStaff && (
                <button className="btn-primary text-xs" onClick={() => setCreateOpen(true)}>
                  <Plus size={13} /> {t('clients.inv_create')}
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[540px]">
                <thead>
                  <tr className="border-b border-brand-border/60">
                    <th className="table-head text-start pb-2">{t('clients.inv_col_number')}</th>
                    <th className="table-head text-start pb-2">{t('clients.inv_col_status')}</th>
                    <th className="table-head text-start pb-2">{t('clients.inv_col_date')}</th>
                    <th className="table-head text-end pb-2">{t('clients.inv_col_amount')}</th>
                    <th className="table-head pb-2 w-40" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: Invoice) => (
                    <tr key={inv.id} className="table-row">
                      <td className="table-cell font-mono text-brand-text text-xs">{inv.invoice_number}</td>
                      <td className="table-cell">
                        <StatusChanger invoice={inv} onUpdate={handleStatusChange} canEdit={isStaff} />
                      </td>
                      <td className="table-cell text-xs">{fmt(inv.issue_date)}</td>
                      <td className="table-cell text-end font-medium text-brand-text text-xs">
                        {fmtMoney(inv.total, inv.currency)}
                        {Number(inv.paid_amount ?? 0) > 0 && (
                          <span className="block text-[10px] text-emerald-400">
                            {isAr ? 'مدفوع' : 'Paid'} {fmtMoney(Number(inv.paid_amount), inv.currency)}
                          </span>
                        )}
                        {Number(inv.balance_due ?? 0) > 0 && (
                          <span className="block text-[10px] text-amber-400">
                            {isAr ? 'متبقي' : 'Due'} {fmtMoney(Number(inv.balance_due), inv.currency)}
                          </span>
                        )}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setViewing(inv)} className="btn-icon p-1.5" title={t('clients.inv_preview')}>
                            <Eye size={13} />
                          </button>
                          <button onClick={() => handleDownload(inv)} className="btn-icon p-1.5" title={t('clients.inv_download')}>
                            <Download size={13} />
                          </button>
                          {inv.payments?.length > 0 && (
                            <button onClick={() => void openReceipt(inv)} className="btn-icon p-1.5 text-emerald-400" title={isAr ? 'سند قبض' : 'Receipt'}>
                              <ReceiptText size={13} />
                            </button>
                          )}
                          {isStaff && Number(inv.balance_due ?? inv.total) > 0 && (
                            <button onClick={() => openPayment(inv)} className="btn-icon p-1.5 text-amber-400" title={isAr ? 'تسجيل دفعة' : 'Record payment'}>
                              <CreditCard size={13} />
                            </button>
                          )}
                          {isStaff && (
                            <button onClick={() => setEditing(inv)} className="btn-icon p-1.5" title={t('clients.inv_edit')}>
                              <Pencil size={13} />
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={() => setDeleting(inv)} className="btn-icon p-1.5 hover:text-brand-red hover:bg-brand-red/10" title={t('common.delete')}>
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

          {invoices.length > 0 && (
            <div className="mt-4 pt-4 border-t border-brand-border/40 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs text-brand-text-muted">
                <TrendingUp size={13} className="text-emerald-400" />
                <span>{t('clients.inv_summary_paid')}</span>
                <span className="text-emerald-400 font-semibold">{fmtMoney(paidTotal, currency)}</span>
              </div>
              <div className="text-xs text-brand-text-muted">
                {t('clients.inv_summary_pending')} <span className="text-amber-400 font-semibold">{fmtMoney(pendingTotal, currency)}</span>
              </div>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-brand-border/40">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-text-dim">
                  {t('clients.container_pl_title')}
                </h4>
                <p className="text-xs text-brand-text-muted mt-1">{t('clients.container_pl_desc')}</p>
              </div>
              {packingListFiles.length > 0 && (
                <span className="badge bg-brand-surface text-brand-text-muted border border-brand-border text-[10px]">
                  {packingListFiles.length}
                </span>
              )}
            </div>
            {plLoading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
              </div>
            ) : packingListFiles.length === 0 ? (
              <p className="text-xs text-brand-text-muted">{t('clients.container_pl_empty')}</p>
            ) : (
              <div className="space-y-2">
                {packingListFiles.map((file) => (
                  <a
                    key={`${file.bookingId}-${file.lineId}-${file.doc.id}`}
                    href={getCargoDocumentUrl(file.bookingId, file.lineId, file.doc.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 hover:border-brand-primary/40 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-brand-text truncate">
                        {file.doc.original_filename || 'Packing List'}
                      </span>
                      <span className="block text-[10px] text-brand-text-muted mt-0.5">
                        {file.bookingNumber}
                        {file.containerNo ? ` · ${file.containerNo}` : ''}
                        {file.blNumber ? ` · B/L ${file.blNumber}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-brand-primary">{t('clients.container_pl_open')}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Shipping / Service Quotes */}
      <div className="card">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-sky-500/15 flex items-center justify-center">
              <Ship size={16} className="text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-brand-text">{isAr ? 'عروض الشحن والخدمات' : 'Shipping & Service Quotes'}</h3>
              <p className="text-xs text-brand-text-muted">
                {isAr ? 'احسب الشحن حسب CBM / KG / الحاوية مع حفظ نسخة من سعر الوكيل.' : 'Calculate CBM / KG / container service pricing and snapshot the agent rate.'}
              </p>
            </div>
          </div>
          {isStaff && (
            <Button size="sm" onClick={openServiceQuote}>
              <Plus size={13} /> {isAr ? 'عرض شحن جديد' : 'New Shipping Quote'}
            </Button>
          )}
        </div>

        {serviceQuotesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
          </div>
        ) : serviceQuotes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-brand-border bg-brand-surface/40 px-4 py-8 text-center text-sm text-brand-text-muted">
            {isAr ? 'لا توجد عروض شحن لهذا العميل بعد.' : 'No shipping quotes for this client yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {serviceQuotes.map((quote: ServiceQuote) => (
              <div key={quote.id} className="rounded-xl border border-brand-border bg-brand-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-brand-primary">{quote.quote_number}</p>
                    <h4 className="text-sm font-semibold text-brand-text mt-1">
                      {quoteModeLabel(quote.mode, isAr)} · {quoteScopeLabel(quote.service_scope, isAr)}
                    </h4>
                  </div>
                  <span className="badge bg-brand-card border border-brand-border text-brand-text-muted text-[10px]">
                    {quote.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-brand-text-muted">{isAr ? 'الكمية المحسوبة' : 'Chargeable'}</p>
                    <p className="font-mono text-brand-text">{quote.chargeable_quantity ?? '—'} {quote.rate_basis ?? ''}</p>
                  </div>
                  <div>
                    <p className="text-brand-text-muted">{isAr ? 'سعر البيع' : 'Sell total'}</p>
                    <p className="font-mono font-semibold text-emerald-400">{fmtMoney(Number(quote.total_sell), quote.currency)}</p>
                  </div>
                  <div>
                    <p className="text-brand-text-muted">{isAr ? 'الناقل' : 'Carrier'}</p>
                    <p className="text-brand-text truncate">{quote.carrier_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-brand-text-muted">{isAr ? 'الربح' : 'Profit'}</p>
                    <p className="font-mono text-brand-text">{fmtMoney(Number(quote.profit), quote.currency)}</p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-brand-text-muted truncate">
                  {(quote.port_of_loading || '—')} → {(quote.port_of_discharge || '—')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('clients.inv_new_title')} size="xl">
        <InvoiceForm
          initial={{ client_id: clientId } as any}
          lockedClient={{ id: client.id, name: client.name, name_ar: client.name_ar, client_code: client.client_code }}
          onSubmit={async (v) => createMut.mutateAsync(v)}
          loading={createMut.isPending}
          hideStatus
        />
      </Modal>

      <Modal open={serviceQuoteOpen} onClose={() => setServiceQuoteOpen(false)} title={isAr ? 'عرض شحن / خدمة جديد' : 'New Shipping / Service Quote'} size="xl">
        <form onSubmit={submitServiceQuote} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="space-y-1.5">
              <span className="text-xs text-brand-text-muted">{isAr ? 'نوع الخدمة' : 'Mode'}</span>
              <select value={serviceQuoteForm.mode} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, mode: e.target.value as ServiceQuoteMode, selected_rate_id: null }))} className="input-base [color-scheme:dark]">
                <option value="SEA_LCL">{isAr ? 'بحري LCL' : 'Sea LCL'}</option>
                <option value="SEA_FCL">{isAr ? 'بحري FCL' : 'Sea FCL'}</option>
                <option value="AIR">{isAr ? 'جوي' : 'Air'}</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-brand-text-muted">{isAr ? 'نطاق الخدمة' : 'Scope'}</span>
              <select value={serviceQuoteForm.service_scope} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, service_scope: e.target.value as ServiceQuoteScope }))} className="input-base [color-scheme:dark]">
                {(['port_to_port', 'warehouse_to_port', 'factory_to_port', 'warehouse_to_door', 'factory_to_door'] as ServiceQuoteScope[]).map((scope) => (
                  <option key={scope} value={scope}>{quoteScopeLabel(scope, isAr)}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-brand-text-muted">{isAr ? 'مصدر البضاعة' : 'Cargo source'}</span>
              <select value={serviceQuoteForm.cargo_source} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, cargo_source: e.target.value }))} className="input-base [color-scheme:dark]">
                <option value="outside_supplier">{isAr ? 'مصدر خارجي' : 'Outside supplier'}</option>
                <option value="company_goods">{isAr ? 'من شركتنا' : 'Company goods'}</option>
                <option value="client_ready_goods">{isAr ? 'بضاعة العميل' : 'Client goods'}</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {serviceQuoteForm.mode !== 'AIR' && (
              <label className="space-y-1.5">
                <span className="text-xs text-brand-text-muted">{isAr ? 'حجم الحاوية' : 'Container size'}</span>
                <select value={serviceQuoteForm.container_size} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, container_size: e.target.value, selected_rate_id: null }))} className="input-base [color-scheme:dark]">
                  <option value="20GP">20GP</option>
                  <option value="40GP">40GP</option>
                  <option value="40HQ">40HQ</option>
                </select>
              </label>
            )}
            <label className="space-y-1.5">
              <span className="text-xs text-brand-text-muted">CBM</span>
              <input type="number" min="0" step="0.0001" value={serviceQuoteForm.cbm} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, cbm: e.target.value }))} className="input-base [color-scheme:dark]" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-brand-text-muted">{isAr ? 'الوزن الإجمالي' : 'Gross kg'}</span>
              <input type="number" min="0" step="0.001" value={serviceQuoteForm.gross_weight_kg} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, gross_weight_kg: e.target.value }))} className="input-base [color-scheme:dark]" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-brand-text-muted">{isAr ? 'الوزن المحسوب' : 'Chargeable kg'}</span>
              <input type="number" min="0" step="0.001" value={serviceQuoteForm.chargeable_weight_kg} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, chargeable_weight_kg: e.target.value }))} className="input-base [color-scheme:dark]" />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="space-y-1.5">
              <span className="text-xs text-brand-text-muted">{isAr ? 'مدينة المصدر' : 'Origin city'}</span>
              <input value={serviceQuoteForm.origin_city} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, origin_city: e.target.value }))} className="input-base" placeholder="Foshan / Ningbo" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-brand-text-muted">{isAr ? 'ميناء التحميل' : 'POL'}</span>
              <input value={serviceQuoteForm.port_of_loading} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, port_of_loading: e.target.value }))} className="input-base" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-brand-text-muted">{isAr ? 'ميناء التفريغ' : 'POD'}</span>
              <input value={serviceQuoteForm.port_of_discharge} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, port_of_discharge: e.target.value }))} className="input-base" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs text-brand-text-muted">{isAr ? 'بلد الوجهة' : 'Destination'}</span>
              <input value={serviceQuoteForm.destination_country} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, destination_country: e.target.value }))} className="input-base" />
            </label>
          </div>

          <textarea value={serviceQuoteForm.goods_description} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, goods_description: e.target.value }))} className="input-base min-h-20 resize-none" placeholder={isAr ? 'وصف البضاعة / عنوان المصنع / ملاحظات الاستلام' : 'Goods description / factory address / pickup notes'} />

          <div className="rounded-xl border border-brand-border bg-brand-surface p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-brand-text flex items-center gap-2"><Calculator size={14} className="text-brand-primary" />{isAr ? 'اقتراحات الأسعار' : 'Rate suggestions'}</h4>
                <p className="text-xs text-brand-text-muted">{isAr ? 'من أسعار الشحن الحالية المخزنة للوكلاء.' : 'From current stored shipping agent rates.'}</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={loadServiceQuoteSuggestions} loading={serviceQuoteSuggesting}>{isAr ? 'اقترح أسعار' : 'Suggest Rates'}</Button>
            </div>
            {serviceQuoteSuggestions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {serviceQuoteSuggestions.map((row) => (
                  <button type="button" key={row.agent_carrier_rate_id ?? `${row.agent_id}-${row.carrier_name}`} onClick={() => setServiceQuoteForm((p) => ({ ...p, selected_rate_id: row.agent_carrier_rate_id, port_of_loading: p.port_of_loading || row.port_of_loading || '', port_of_discharge: p.port_of_discharge || row.port_of_discharge || '' }))} className={clsx('rounded-xl border p-3 text-start transition-colors', serviceQuoteForm.selected_rate_id === row.agent_carrier_rate_id ? 'border-brand-primary bg-brand-primary/10' : 'border-brand-border bg-brand-card hover:border-brand-primary/50')}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-brand-text truncate">{isAr ? row.agent_name_ar || row.agent_name : row.agent_name}</span>
                      <span className="font-mono text-sm text-emerald-400">{fmtMoney(row.total_sell, row.currency)}</span>
                    </div>
                    <p className="mt-1 text-xs text-brand-text-muted truncate">{row.carrier_name || '—'} · {row.sell_rate}/{row.rate_basis} · {row.chargeable_quantity} {row.rate_basis}</p>
                    <p className="mt-1 text-[11px] text-brand-text-muted truncate">{row.port_of_loading || '—'} → {row.port_of_discharge || '—'}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-brand-text-muted">{isAr ? 'إذا لم يظهر سعر مناسب أدخل سعر البيع اليدوي.' : 'If no rate matches, enter a manual sell rate.'}</p>
            )}
            {!serviceQuoteForm.selected_rate_id && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="number" min="0" step="0.01" value={serviceQuoteForm.manual_sell_rate} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, manual_sell_rate: e.target.value }))} className="input-base [color-scheme:dark]" placeholder={isAr ? 'سعر البيع اليدوي' : 'Manual sell rate'} />
                <input type="number" min="0" step="0.01" value={serviceQuoteForm.manual_buy_rate} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, manual_buy_rate: e.target.value }))} className="input-base [color-scheme:dark]" placeholder={isAr ? 'سعر الشراء اليدوي' : 'Manual buy rate'} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 rounded-xl border border-brand-border bg-brand-surface px-3 py-3 text-sm text-brand-text">
              <input type="checkbox" checked={serviceQuoteForm.clearance_through_us} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, clearance_through_us: e.target.checked }))} />
              {isAr ? 'التخليص عن طريقنا' : 'Clearance through us'}
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-brand-border bg-brand-surface px-3 py-3 text-sm text-brand-text">
              <input type="checkbox" checked={serviceQuoteForm.delivery_through_us} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, delivery_through_us: e.target.checked }))} />
              {isAr ? 'توصيل داخلي' : 'Local delivery'}
            </label>
            <input type="number" min="0" step="0.01" value={serviceQuoteForm.other_fees_sell} onChange={(e) => setServiceQuoteForm((p) => ({ ...p, other_fees_sell: e.target.value }))} className="input-base [color-scheme:dark]" placeholder={isAr ? 'رسوم أخرى للبيع' : 'Other sell fees'} />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-brand-border">
            <Button type="button" variant="secondary" onClick={() => setServiceQuoteOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={createServiceQuoteMut.isPending}><Truck size={14} /> {isAr ? 'حفظ العرض' : 'Save Quote'}</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Invoice Modal */}
      <Modal
        open={!!editing} onClose={() => setEditing(null)}
        title={editing ? t('clients.inv_edit_title', { number: editing.invoice_number }) : ''}
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
            onStampUpload={async (file) => { await uploadStamp(editing.id, file); qc.invalidateQueries({ queryKey: ['invoices', { client_id: clientId }] }) }}
            onBackgroundUpload={async (file) => { await uploadBackground(editing.id, file); qc.invalidateQueries({ queryKey: ['invoices', { client_id: clientId }] }) }}
          />
        )}
      </Modal>

      {/* Preview Modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.invoice_number ?? ''} size="lg">
        {viewing && (
          <div className="space-y-4">
            <InvoicePreview invoice={viewing} />
            <div className="flex justify-end gap-3 pt-2 border-t border-brand-border">
              {isStaff && (
                <Button variant="secondary" onClick={() => { setEditing(viewing); setViewing(null) }}>
                  <Pencil size={14} /> {t('common.edit')}
                </Button>
              )}
              <Button onClick={() => handleDownload(viewing)}>
                <Download size={14} /> {t('clients.inv_download')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        open={!!paymentInvoice}
        onClose={() => setPaymentInvoice(null)}
        title={paymentInvoice ? (isAr ? `تسجيل دفعة - ${paymentInvoice.invoice_number}` : `Record Payment - ${paymentInvoice.invoice_number}`) : ''}
        size="sm"
      >
        {paymentInvoice && (
          <form onSubmit={submitPayment} className="space-y-4">
            <div className="rounded-xl border border-brand-border bg-brand-surface p-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-brand-text-muted">{isAr ? 'إجمالي الفاتورة' : 'Invoice total'}</p>
                <p className="font-mono font-semibold text-brand-text">{fmtMoney(paymentInvoice.total, paymentInvoice.currency)}</p>
              </div>
              <div>
                <p className="text-brand-text-muted">{isAr ? 'الرصيد المتبقي' : 'Balance due'}</p>
                <p className="font-mono font-semibold text-amber-400">{fmtMoney(Number(paymentInvoice.balance_due ?? paymentInvoice.total), paymentInvoice.currency)}</p>
              </div>
            </div>

            {paymentScheduleDueRows(paymentInvoice).length > 0 && (
              <div className="rounded-xl border border-brand-border/80 bg-brand-surface/60 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-brand-text">{isAr ? 'خطة الدفع' : 'Payment plan'}</p>
                  {paymentInvoice.payment_terms && (
                    <span className="text-[10px] text-brand-text-muted text-end">{paymentInvoice.payment_terms}</span>
                  )}
                </div>
                <div className="grid gap-2">
                  {paymentScheduleDueRows(paymentInvoice).map((part) => (
                    <button
                      key={part.id}
                      type="button"
                      onClick={() => setPaymentForm((p) => ({ ...p, amount: part.remaining_amount.toFixed(2) }))}
                      className="flex items-center justify-between gap-3 rounded-lg border border-brand-border bg-brand-card px-3 py-2 text-start hover:border-brand-primary/50 transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-xs text-brand-text truncate">{part.label}</span>
                        <span className="block text-[10px] text-brand-text-muted">{isAr ? 'المتبقي لهذه الدفعة' : 'Remaining for this installment'}</span>
                      </span>
                      <span className="font-mono text-sm text-emerald-400 shrink-0">{fmtMoney(part.remaining_amount, paymentInvoice.currency)}</span>
                    </button>
                  ))}
                  {Number(paymentInvoice.balance_due ?? 0) - suggestedPaymentAmount(paymentInvoice) > 0.009 && (
                    <button
                      type="button"
                      onClick={() => setPaymentForm((p) => ({ ...p, amount: Number(paymentInvoice.balance_due ?? 0).toFixed(2) }))}
                      className="flex items-center justify-between rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-start text-amber-300 hover:border-amber-400/50 transition-colors"
                    >
                      <span className="text-xs">{isAr ? 'دفع كامل الرصيد المتبقي' : 'Pay full remaining balance'}</span>
                      <span className="font-mono text-sm">{fmtMoney(Number(paymentInvoice.balance_due ?? 0), paymentInvoice.currency)}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <label className="block space-y-1.5">
              <span className="text-xs text-brand-text-muted">{isAr ? 'المبلغ' : 'Amount'}</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
                className="input-base font-mono [color-scheme:dark]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs text-brand-text-muted">{isAr ? 'طريقة الدفع' : 'Payment method'}</span>
              <select
                value={paymentForm.payment_method}
                onChange={(e) => setPaymentForm((p) => ({ ...p, payment_method: e.target.value }))}
                className="input-base [color-scheme:dark]"
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value} style={{ background: '#061220', color: '#f8fafc' }}>{method.label}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs text-brand-text-muted">{isAr ? 'تاريخ الدفع' : 'Payment date'}</span>
              <input
                type="datetime-local"
                value={paymentForm.paid_at}
                onChange={(e) => setPaymentForm((p) => ({ ...p, paid_at: e.target.value }))}
                className="input-base [color-scheme:dark]"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs text-brand-text-muted">{isAr ? 'رقم المرجع' : 'Reference no.'}</span>
              <input
                value={paymentForm.reference_no}
                onChange={(e) => setPaymentForm((p) => ({ ...p, reference_no: e.target.value }))}
                className="input-base"
                placeholder={isAr ? 'اختياري' : 'Optional'}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs text-brand-text-muted">{isAr ? 'ملاحظات' : 'Notes'}</span>
              <textarea
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))}
                className="input-base min-h-20 resize-none"
                placeholder={isAr ? 'اختياري' : 'Optional'}
              />
            </label>

            <div className="flex justify-end gap-3 pt-2 border-t border-brand-border">
              <Button type="button" variant="secondary" onClick={() => setPaymentInvoice(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={paymentMut.isPending}>
                <CreditCard size={14} /> {isAr ? 'حفظ الدفعة' : 'Save payment'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Portal Password Modal */}
      <Modal open={pwdModal} onClose={() => setPwdModal(false)} title={isAr ? 'تعيين كلمة مرور الموقع' : 'Set Portal Password'} size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">
            <KeyRound size={14} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-0.5">{isAr ? 'رمز الدخول للموقع' : 'Website Login'}</p>
              <p className="text-amber-400/70">
                {isAr
                  ? `سيستخدم العميل رمزه "${client.client_code}" مع كلمة المرور لتسجيل الدخول للموقع.`
                  : `Client will use code "${client.client_code}" + password to log into the website.`}
              </p>
            </div>
          </div>

          {pwdResult ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-4 text-center space-y-2">
                <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider">
                  {isAr ? 'كلمة المرور الجديدة' : 'New Password'}
                </p>
                <p className="text-2xl font-mono font-bold text-emerald-400 tracking-widest">{pwdResult.password}</p>
                <p className="text-[11px] text-gray-500">
                  {isAr ? 'رمز العميل:' : 'Client code:'}{' '}
                  <span className="font-mono text-white">{pwdResult.client_code}</span>
                </p>
              </div>
              <button
                onClick={copyPassword}
                className={clsx(
                  'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all',
                  copied
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                    : 'border-white/15 text-gray-300 hover:bg-white/5',
                )}
              >
                <Copy size={13} />
                {copied ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ كلمة المرور' : 'Copy Password')}
              </button>
              <button
                onClick={generatePortalPassword}
                disabled={pwdLoading}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <RefreshCw size={12} className={pwdLoading ? 'animate-spin' : ''} />
                {isAr ? 'توليد كلمة مرور جديدة' : 'Generate new password'}
              </button>
            </div>
          ) : (
            <Button
              onClick={generatePortalPassword}
              loading={pwdLoading}
              className="w-full justify-center"
            >
              <RefreshCw size={14} />
              {isAr ? 'توليد كلمة مرور' : 'Generate Password'}
            </Button>
          )}
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={t('clients.inv_delete_title')} size="sm">
        <p className="text-sm text-brand-text-dim mb-5"
          dangerouslySetInnerHTML={{ __html: t('clients.inv_delete_body', { number: `<span class="font-mono font-bold text-brand-text">${deleting?.invoice_number ?? ''}</span>` }) }}
        />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={deleteMut.isPending} onClick={() => deleting && deleteMut.mutate(deleting.id)}>
            <Trash2 size={14} /> {t('common.delete')}
          </Button>
        </div>
      </Modal>

    </div>
  )
}
