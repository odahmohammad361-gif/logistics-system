import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ElementType } from 'react'
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  BrainCircuit,
  Download,
  Eye,
  FileText,
  Landmark,
  Loader2,
  Paperclip,
  ReceiptText,
  Save,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react'

import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { FormRow, Input, Select, Textarea } from '@/components/ui/Form'
import { getAgents, getClearanceAgents } from '@/services/agentService'
import {
  createAccountingEntry,
  downloadAccountingReportCsv,
  getAccountingReportSummary,
  getBankStatementLines,
  getBankStatements,
  getAccountingAttachmentUrl,
  getAccountingEntries,
  getAccountingSummary,
  uploadBankStatement,
  uploadAccountingAttachments,
} from '@/services/accountingService'
import { getBookings } from '@/services/bookingService'
import { getClients } from '@/services/clientService'
import { getInvoices } from '@/services/invoiceService'
import { getSuppliers } from '@/services/supplierService'
import type { AccountingDirection, AccountingEntry, AccountingStatus, BankLineMatchStatus } from '@/types'

type EntryForm = {
  direction: AccountingDirection
  entry_date: string
  amount: string
  currency: string
  payment_method: string
  category: string
  status: AccountingStatus
  counterparty_type: string
  counterparty_name: string
  reference_no: string
  description: string
  notes: string
  client_id: string
  invoice_id: string
  booking_id: string
  shipping_agent_id: string
  clearance_agent_id: string
  supplier_id: string
  tax_rate_pct: string
  tax_amount: string
  has_official_tax_invoice: boolean
  attachment_document_type: string
}

const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = (direction: AccountingDirection): EntryForm => ({
  direction,
  entry_date: today(),
  amount: '',
  currency: 'USD',
  payment_method: 'cash',
  category: direction === 'money_in' ? 'client_payment' : 'supplier_payment',
  status: 'posted',
  counterparty_type: direction === 'money_in' ? 'client' : 'supplier',
  counterparty_name: '',
  reference_no: '',
  description: '',
  notes: '',
  client_id: '',
  invoice_id: '',
  booking_id: '',
  shipping_agent_id: '',
  clearance_agent_id: '',
  supplier_id: '',
  tax_rate_pct: '',
  tax_amount: '',
  has_official_tax_invoice: false,
  attachment_document_type: direction === 'money_in' ? 'receipt' : 'invoice',
})

const numOrNull = (value: string) => {
  const cleaned = value.trim()
  return cleaned === '' ? null : Number(cleaned)
}

const textOrNull = (value: string) => {
  const cleaned = value.trim()
  return cleaned === '' ? null : cleaned
}

function MoneyCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  subtitle?: string
  icon: ElementType
  tone: 'green' | 'red' | 'blue' | 'amber'
}) {
  const tones = {
    green: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    red: 'border-rose-500/20 bg-rose-500/10 text-rose-400',
    blue: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  }
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-brand-text-muted">{title}</p>
          <p className="mt-2 text-2xl font-black text-brand-text font-mono">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-brand-text-muted">{subtitle}</p>}
        </div>
        <div className={`rounded-lg border p-2 ${tones[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}

function ActionButton({
  title,
  icon: Icon,
  onClick,
}: {
  title: string
  icon: ElementType
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-xl border border-brand-border bg-brand-surface p-4 text-start transition-all hover:-translate-y-0.5 hover:border-brand-primary/50 hover:bg-brand-primary/5"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-2 text-brand-primary-light">
          <Icon size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-text group-hover:text-brand-primary-light">{title}</p>
        </div>
      </div>
    </button>
  )
}

function StatusBadge({ status, label }: { status: AccountingStatus; label: string }) {
  const style = {
    draft: 'border-slate-400/25 bg-slate-400/10 text-slate-300',
    posted: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    needs_review: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    void: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
  }[status]
  return <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${style}`}>{label}</span>
}

function MatchBadge({ status, label }: { status: BankLineMatchStatus; label: string }) {
  const style = {
    matched: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    possible: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    unmatched: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
    ignored: 'border-slate-400/25 bg-slate-400/10 text-slate-300',
  }[status]
  return <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${style}`}>{label}</span>
}

export default function AccountingPage() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<EntryForm>(() => emptyForm('money_in'))
  const [files, setFiles] = useState<File[]>([])
  const [search, setSearch] = useState('')
  const [directionFilter, setDirectionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [bankModalOpen, setBankModalOpen] = useState(false)
  const [bankFile, setBankFile] = useState<File | null>(null)
  const [bankName, setBankName] = useState('')
  const [bankAccountNo, setBankAccountNo] = useState('')
  const [bankCurrency, setBankCurrency] = useState('USD')
  const [selectedStatementId, setSelectedStatementId] = useState('')
  const [matchFilter, setMatchFilter] = useState('')
  const [reportDateFrom, setReportDateFrom] = useState('')
  const [reportDateTo, setReportDateTo] = useState('')
  const [reportCurrency, setReportCurrency] = useState('USD')

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['accounting-summary'],
    queryFn: getAccountingSummary,
  })

  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['accounting-entries', search, directionFilter, statusFilter],
    queryFn: () => getAccountingEntries({
      page: 1,
      page_size: 12,
      search,
      direction: directionFilter || undefined,
      status: statusFilter || undefined,
    }),
  })

  const reportParams = {
    date_from: reportDateFrom || undefined,
    date_to: reportDateTo || undefined,
    currency: reportCurrency || 'USD',
  }

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['accounting-report-summary', reportDateFrom, reportDateTo, reportCurrency],
    queryFn: () => getAccountingReportSummary(reportParams),
  })

  const { data: clientsData } = useQuery({
    queryKey: ['accounting-clients'],
    queryFn: () => getClients({ page: 1, page_size: 200 }),
  })
  const { data: invoicesData } = useQuery({
    queryKey: ['accounting-invoices'],
    queryFn: () => getInvoices({ page: 1, page_size: 200 }),
  })
  const { data: bookingsData } = useQuery({
    queryKey: ['accounting-bookings'],
    queryFn: () => getBookings({ page: 1, page_size: 200 }),
  })
  const { data: shippingAgentsData } = useQuery({
    queryKey: ['accounting-shipping-agents'],
    queryFn: () => getAgents({ page: 1, page_size: 200 }),
  })
  const { data: clearanceAgentsData } = useQuery({
    queryKey: ['accounting-clearance-agents'],
    queryFn: () => getClearanceAgents({ page: 1, page_size: 200 }),
  })
  const { data: suppliersData } = useQuery({
    queryKey: ['accounting-suppliers'],
    queryFn: () => getSuppliers({ page: 1, page_size: 200 }),
  })

  const { data: bankStatementsData, isLoading: bankStatementsLoading } = useQuery({
    queryKey: ['bank-statements'],
    queryFn: () => getBankStatements({ limit: 12 }),
  })

  const activeStatementId = selectedStatementId || String(bankStatementsData?.results?.[0]?.id ?? '')
  const { data: bankLinesData, isLoading: bankLinesLoading } = useQuery({
    queryKey: ['bank-statement-lines', activeStatementId, matchFilter],
    enabled: Boolean(activeStatementId),
    queryFn: () => getBankStatementLines(Number(activeStatementId), { match_status: matchFilter || undefined }),
  })

  const createMut = useMutation({
    mutationFn: async () => {
      const created = await createAccountingEntry({
        direction: form.direction,
        entry_date: form.entry_date,
        amount: Number(form.amount),
        currency: form.currency,
        payment_method: form.payment_method,
        category: form.category,
        status: form.status,
        counterparty_type: textOrNull(form.counterparty_type),
        counterparty_name: textOrNull(form.counterparty_name),
        reference_no: textOrNull(form.reference_no),
        description: textOrNull(form.description),
        notes: textOrNull(form.notes),
        client_id: numOrNull(form.client_id),
        invoice_id: numOrNull(form.invoice_id),
        booking_id: numOrNull(form.booking_id),
        shipping_agent_id: numOrNull(form.shipping_agent_id),
        clearance_agent_id: numOrNull(form.clearance_agent_id),
        supplier_id: numOrNull(form.supplier_id),
        tax_rate_pct: numOrNull(form.tax_rate_pct),
        tax_amount: numOrNull(form.tax_amount),
        has_official_tax_invoice: form.has_official_tax_invoice,
      })
      if (files.length) {
        await uploadAccountingAttachments(created.id, files, form.attachment_document_type)
      }
      return created
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting-summary'] })
      qc.invalidateQueries({ queryKey: ['accounting-entries'] })
      setModalOpen(false)
      setFiles([])
    },
  })

  const uploadStatementMut = useMutation({
    mutationFn: () => {
      if (!bankFile) throw new Error(t('accounting.bank.choose_file_error', 'Choose a bank statement file first'))
      return uploadBankStatement({
        file: bankFile,
        bank_name: bankName,
        account_no: bankAccountNo,
        currency: bankCurrency,
      })
    },
    onSuccess: (result) => {
      setSelectedStatementId(String(result.statement.id))
      setBankModalOpen(false)
      setBankFile(null)
      qc.invalidateQueries({ queryKey: ['bank-statements'] })
      qc.invalidateQueries({ queryKey: ['bank-statement-lines'] })
    },
  })

  const exportReportMut = useMutation({
    mutationFn: () => downloadAccountingReportCsv(reportParams),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `accounting-report-${today()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    },
  })

  const paymentOptions = useMemo(() => [
    { value: 'cash', label: t('accounting.payment.cash', 'Cash') },
    { value: 'bank_transfer', label: t('accounting.payment.bank_transfer', 'Bank transfer') },
    { value: 'cliq', label: t('accounting.payment.cliq', 'CliQ') },
    { value: 'card', label: t('accounting.payment.card', 'Card') },
    { value: 'cheque', label: t('accounting.payment.cheque', 'Cheque') },
    { value: 'other', label: t('accounting.payment.other', 'Other') },
  ], [t])

  const statusOptions = useMemo(() => [
    { value: 'draft', label: t('accounting.status.draft', 'Draft') },
    { value: 'posted', label: t('accounting.status.posted', 'Posted') },
    { value: 'needs_review', label: t('accounting.status.needs_review', 'Needs review') },
  ], [t])

  const directionOptions = useMemo(() => [
    { value: 'money_in', label: t('accounting.directions.money_in', 'Money In') },
    { value: 'money_out', label: t('accounting.directions.money_out', 'Money Out') },
  ], [t])

  const categoryOptions = useMemo(() => {
    const moneyIn = [
      { value: 'client_payment', label: t('accounting.categories.client_payment', 'Client payment') },
      { value: 'invoice_payment', label: t('accounting.categories.invoice_payment', 'Invoice payment') },
      { value: 'container_payment', label: t('accounting.categories.container_payment', 'Container payment') },
      { value: 'capital', label: t('accounting.categories.capital', 'Capital') },
      { value: 'refund_received', label: t('accounting.categories.refund_received', 'Refund received') },
      { value: 'other_income', label: t('accounting.categories.other_income', 'Other income') },
    ]
    const moneyOut = [
      { value: 'shipping_agent', label: t('accounting.categories.shipping_agent', 'Shipping agent') },
      { value: 'clearance_agent', label: t('accounting.categories.clearance_agent', 'Clearance agent') },
      { value: 'supplier_payment', label: t('accounting.categories.supplier_payment', 'Supplier payment') },
      { value: 'salary', label: t('accounting.categories.salary', 'Salary') },
      { value: 'manager_expense', label: t('accounting.categories.manager_expense', 'Manager expense') },
      { value: 'rent', label: t('accounting.categories.rent', 'Rent') },
      { value: 'fuel', label: t('accounting.categories.fuel', 'Fuel') },
      { value: 'customs', label: t('accounting.categories.customs', 'Customs') },
      { value: 'tax', label: t('accounting.categories.tax', 'Tax') },
      { value: 'other_expense', label: t('accounting.categories.other_expense', 'Other expense') },
    ]
    return form.direction === 'money_in' ? moneyIn : moneyOut
  }, [form.direction, t])

  const documentOptions = useMemo(() => [
    { value: 'receipt', label: t('accounting.documents.receipt', 'Receipt') },
    { value: 'invoice', label: t('accounting.documents.invoice', 'Invoice') },
    { value: 'bank_proof', label: t('accounting.documents.bank_proof', 'Bank proof') },
    { value: 'salary', label: t('accounting.documents.salary', 'Salary') },
    { value: 'expense', label: t('accounting.documents.expense', 'Expense') },
    { value: 'other', label: t('accounting.documents.other', 'Other') },
  ], [t])

  const matchOptions = useMemo(() => [
    { value: 'matched', label: t('accounting.bank.status.matched', 'Matched') },
    { value: 'possible', label: t('accounting.bank.status.possible', 'Possible') },
    { value: 'unmatched', label: t('accounting.bank.status.unmatched', 'Unmatched') },
    { value: 'ignored', label: t('accounting.bank.status.ignored', 'Ignored') },
  ], [t])

  const clientOptions = (clientsData?.results ?? []).map((c) => ({
    value: String(c.id),
    label: `${c.client_code} — ${isAr && c.name_ar ? c.name_ar : c.name}`,
  }))
  const invoiceOptions = (invoicesData?.results ?? []).map((inv) => ({
    value: String(inv.id),
    label: `${inv.invoice_number} — ${Number(inv.total || 0).toFixed(2)} ${inv.currency}`,
  }))
  const bookingOptions = (bookingsData?.results ?? []).map((b) => ({
    value: String(b.id),
    label: `${b.booking_number} — ${b.mode}${b.container_size ? ` / ${b.container_size}` : ''}`,
  }))
  const shippingAgentOptions = (shippingAgentsData?.results ?? []).map((a) => ({
    value: String(a.id),
    label: isAr && a.name_ar ? a.name_ar : a.name,
  }))
  const clearanceAgentOptions = (clearanceAgentsData?.results ?? []).map((a) => ({
    value: String(a.id),
    label: isAr && a.name_ar ? a.name_ar : a.name,
  }))
  const supplierOptions = (suppliersData?.results ?? []).map((s) => ({
    value: String(s.id),
    label: `${s.code} — ${isAr && s.name_ar ? s.name_ar : s.name}`,
  }))
  const statementOptions = (bankStatementsData?.results ?? []).map((statement) => ({
    value: String(statement.id),
    label: `${statement.original_filename || statement.bank_name || `#${statement.id}`} — ${statement.line_count} ${t('accounting.bank.lines', 'lines')}`,
  }))

  const openEntryModal = (direction: AccountingDirection) => {
    setForm(emptyForm(direction))
    setFiles([])
    setModalOpen(true)
  }

  const setField = <K extends keyof EntryForm>(field: K, value: EntryForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const changeDirection = (direction: AccountingDirection) => {
    setForm((prev) => ({
      ...prev,
      direction,
      category: direction === 'money_in' ? 'client_payment' : 'supplier_payment',
      counterparty_type: direction === 'money_in' ? 'client' : 'supplier',
      attachment_document_type: direction === 'money_in' ? 'receipt' : 'invoice',
    }))
  }

  const money = (value: string | number | undefined) => {
    const n = Number(value ?? 0)
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const esc = (value: unknown) =>
    String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch))

  const statusLabel = (status: AccountingStatus) => t(`accounting.status.${status}`, status)
  const directionLabel = (direction: AccountingDirection) => t(`accounting.directions.${direction}`, direction)
  const categoryLabel = (category: string) => t(`accounting.categories.${category}`, category.replace(/_/g, ' '))
  const methodLabel = (method: string) => t(`accounting.payment.${method}`, method.replace(/_/g, ' '))
  const matchLabel = (status: BankLineMatchStatus) => t(`accounting.bank.status.${status}`, status.replace(/_/g, ' '))

  const printReport = () => {
    if (!report) return
    const categoryRows = report.category_totals.map((row) => `
      <tr>
        <td>${esc(directionLabel(row.direction))}</td>
        <td>${esc(categoryLabel(row.category))}</td>
        <td>${esc(money(row.amount))}</td>
        <td>${esc(row.count)}</td>
      </tr>
    `).join('')
    const alertRows = report.tax_alerts.map((alert) => `
      <tr>
        <td>${esc(alert.entry_number)}</td>
        <td>${esc(alert.entry_date)}</td>
        <td>${esc(money(alert.amount))}</td>
        <td>${esc(categoryLabel(alert.category))}</td>
        <td>${esc(alert.counterparty_name || '')}</td>
        <td>${esc(alert.reason)}</td>
      </tr>
    `).join('')
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>${esc(t('accounting.reports.print_title', 'Accounting report'))}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 28px; color: #111827; }
            h1 { margin: 0 0 4px; font-size: 22px; }
            h2 { margin-top: 24px; font-size: 16px; }
            .muted { color: #6b7280; font-size: 12px; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
            .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; }
            .label { color: #6b7280; font-size: 11px; text-transform: uppercase; }
            .value { font-size: 18px; font-weight: 700; margin-top: 6px; }
            table { border-collapse: collapse; width: 100%; margin-top: 12px; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <button onclick="window.print()">${esc(t('common.print', 'Print'))}</button>
          <h1>${esc(t('accounting.reports.print_title', 'Accounting report'))}</h1>
          <div class="muted">${esc(report.date_from || '...')} - ${esc(report.date_to || '...')} · ${esc(report.currency)}</div>
          <div class="grid">
            <div class="card"><div class="label">${esc(t('accounting.cards.money_in'))}</div><div class="value">${esc(money(report.money_in))}</div></div>
            <div class="card"><div class="label">${esc(t('accounting.cards.money_out'))}</div><div class="value">${esc(money(report.money_out))}</div></div>
            <div class="card"><div class="label">${esc(t('accounting.reports.net', 'Net'))}</div><div class="value">${esc(money(report.net))}</div></div>
            <div class="card"><div class="label">${esc(t('accounting.reports.unmatched_bank', 'Unmatched bank lines'))}</div><div class="value">${esc(report.unmatched_bank_lines)}</div></div>
          </div>
          <h2>${esc(t('accounting.reports.category_totals', 'Category totals'))}</h2>
          <table><thead><tr><th>${esc(t('accounting.table.type'))}</th><th>${esc(t('accounting.table.category'))}</th><th>${esc(t('accounting.table.amount'))}</th><th>#</th></tr></thead><tbody>${categoryRows || '<tr><td colspan="4">No data</td></tr>'}</tbody></table>
          <h2>${esc(t('accounting.reports.tax_alerts', 'Tax alerts'))}</h2>
          <table><thead><tr><th>${esc(t('accounting.table.entry'))}</th><th>${esc(t('common.date'))}</th><th>${esc(t('accounting.table.amount'))}</th><th>${esc(t('accounting.table.category'))}</th><th>${esc(t('accounting.table.counterparty'))}</th><th>${esc(t('accounting.bank.reason'))}</th></tr></thead><tbody>${alertRows || '<tr><td colspan="6">No alerts</td></tr>'}</tbody></table>
        </body>
      </html>
    `)
    win.document.close()
  }

  const counterparty = (entry: AccountingEntry) =>
    entry.client?.name ||
    entry.invoice?.invoice_number ||
    entry.booking?.booking_number ||
    entry.shipping_agent?.name ||
    entry.clearance_agent?.name ||
    entry.supplier?.name ||
    entry.counterparty_name ||
    '—'

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-primary/20 bg-brand-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-primary/25 bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary-light">
              <Landmark size={14} />
              {t('accounting.badge')}
            </div>
            <h1 className="mt-4 text-2xl font-black text-brand-text">{t('accounting.title')}</h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MoneyCard
          title={t('accounting.cards.money_in')}
          value={summaryLoading ? '...' : money(summary?.money_in)}
          icon={TrendingUp}
          tone="green"
        />
        <MoneyCard
          title={t('accounting.cards.money_out')}
          value={summaryLoading ? '...' : money(summary?.money_out)}
          icon={TrendingDown}
          tone="red"
        />
        <MoneyCard
          title={t('accounting.cards.bank_balance')}
          value={summaryLoading ? '...' : money(summary?.balance)}
          icon={Landmark}
          tone="blue"
        />
        <MoneyCard
          title={t('accounting.cards.needs_review')}
          value={summaryLoading ? '...' : String(summary?.needs_review ?? 0)}
          icon={AlertTriangle}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-brand-text">{t('accounting.quick_actions')}</h2>
            </div>
            <BrainCircuit size={18} className="text-brand-primary-light" />
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <ActionButton
              title={t('accounting.actions.money_in')}
              icon={Wallet}
              onClick={() => openEntryModal('money_in')}
            />
            <ActionButton
              title={t('accounting.actions.money_out')}
              icon={Banknote}
              onClick={() => openEntryModal('money_out')}
            />
            <ActionButton
              title={t('accounting.actions.upload_receipt')}
              icon={ReceiptText}
              onClick={() => openEntryModal('money_out')}
            />
            <ActionButton
              title={t('accounting.actions.upload_statement')}
              icon={Upload}
              onClick={() => setBankModalOpen(true)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-brand-text">{t('accounting.ledger_title', 'Recent accounting entries')}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')}
              className="h-10 w-56"
            />
            <Select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
              options={directionOptions}
              placeholder={t('accounting.filters.all_directions', 'All directions')}
              className="h-10 w-44"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'draft', label: statusLabel('draft') },
                { value: 'posted', label: statusLabel('posted') },
                { value: 'needs_review', label: statusLabel('needs_review') },
                { value: 'void', label: statusLabel('void') },
              ]}
              placeholder={t('common.all_statuses')}
              className="h-10 w-44"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-xs uppercase tracking-wide text-brand-text-muted">
                <th className="px-3 py-3 text-start">{t('common.date')}</th>
                <th className="px-3 py-3 text-start">{t('accounting.table.entry', 'Entry')}</th>
                <th className="px-3 py-3 text-start">{t('accounting.table.type', 'Type')}</th>
                <th className="px-3 py-3 text-start">{t('accounting.table.category', 'Category')}</th>
                <th className="px-3 py-3 text-start">{t('accounting.table.counterparty', 'Counterparty')}</th>
                <th className="px-3 py-3 text-end">{t('accounting.table.amount', 'Amount')}</th>
                <th className="px-3 py-3 text-start">{t('common.status')}</th>
                <th className="px-3 py-3 text-start">{t('accounting.table.files', 'Files')}</th>
              </tr>
            </thead>
            <tbody>
              {entriesLoading && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-brand-text-muted">
                    <Loader2 size={18} className="mx-auto mb-2 animate-spin" />
                    {t('common.loading')}
                  </td>
                </tr>
              )}
              {!entriesLoading && !entriesData?.results.length && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-brand-text-muted">
                    {t('common.no_data')}
                  </td>
                </tr>
              )}
              {entriesData?.results.map((entry) => (
                <tr key={entry.id} className="border-b border-brand-border/50 text-brand-text">
                  <td className="px-3 py-3 whitespace-nowrap">{entry.entry_date}</td>
                  <td className="px-3 py-3 font-mono text-xs text-brand-primary-light">{entry.entry_number}</td>
                  <td className="px-3 py-3">
                    <span className={entry.direction === 'money_in' ? 'text-emerald-300' : 'text-rose-300'}>
                      {directionLabel(entry.direction)}
                    </span>
                  </td>
                  <td className="px-3 py-3">{categoryLabel(entry.category)}</td>
                  <td className="px-3 py-3">{counterparty(entry)}</td>
                  <td className="px-3 py-3 text-end font-mono font-semibold">{money(entry.amount)}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={entry.status} label={statusLabel(entry.status)} />
                  </td>
                  <td className="px-3 py-3">
                    {entry.attachments.length ? (
                      <div className="flex flex-wrap gap-1">
                        {entry.attachments.slice(0, 2).map((att) => (
                          <a
                            key={att.id}
                            href={getAccountingAttachmentUrl(entry.id, att.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-brand-border bg-white/[0.04] px-2 py-1 text-[11px] text-brand-text-muted hover:text-brand-primary-light"
                          >
                            <Eye size={12} />
                            {att.original_filename || att.document_type}
                          </a>
                        ))}
                        {entry.attachments.length > 2 && (
                          <span className="rounded-full border border-brand-border px-2 py-1 text-[11px] text-brand-text-muted">
                            +{entry.attachments.length - 2}
                          </span>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-brand-text">{t('accounting.bank.title', 'Bank reconciliation')}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={activeStatementId}
              onChange={(e) => setSelectedStatementId(e.target.value)}
              options={statementOptions}
              placeholder={t('accounting.bank.select_statement', 'Select statement')}
              className="h-10 w-72"
            />
            <Select
              value={matchFilter}
              onChange={(e) => setMatchFilter(e.target.value)}
              options={matchOptions}
              placeholder={t('accounting.bank.all_match_statuses', 'All match statuses')}
              className="h-10 w-48"
            />
            <Button variant="secondary" onClick={() => setBankModalOpen(true)}>
              <Upload size={15} />
              {t('accounting.bank.upload_button', 'Upload statement')}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-4">
          <div className="rounded-xl border border-brand-border/70 bg-white/[0.03] p-3">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-text-muted">
              <Landmark size={14} />
              {t('accounting.bank.import_history', 'Import history')}
            </div>
            <div className="space-y-2">
              {bankStatementsLoading && <p className="text-xs text-brand-text-muted">{t('common.loading')}</p>}
              {!bankStatementsLoading && !bankStatementsData?.results.length && (
                <p className="text-xs leading-5 text-brand-text-muted">{t('accounting.bank.no_statements', 'No bank statements uploaded yet.')}</p>
              )}
              {bankStatementsData?.results.map((statement) => (
                <button
                  key={statement.id}
                  type="button"
                  onClick={() => setSelectedStatementId(String(statement.id))}
                  className={`w-full rounded-lg border px-3 py-2 text-start text-xs transition-colors ${
                    activeStatementId === String(statement.id)
                      ? 'border-brand-primary/60 bg-brand-primary/10 text-brand-primary-light'
                      : 'border-brand-border bg-brand-surface text-brand-text-muted hover:border-brand-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{statement.original_filename || statement.bank_name || `#${statement.id}`}</span>
                    <span>{statement.line_count}</span>
                  </div>
                  <div className="mt-1 text-[11px] opacity-80">
                    {statement.statement_from || '—'} / {statement.statement_to || '—'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-brand-border/70">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-xs uppercase tracking-wide text-brand-text-muted">
                  <th className="px-3 py-3 text-start">{t('common.date')}</th>
                  <th className="px-3 py-3 text-start">{t('accounting.table.type', 'Type')}</th>
                  <th className="px-3 py-3 text-start">{t('accounting.bank.description', 'Description')}</th>
                  <th className="px-3 py-3 text-end">{t('accounting.table.amount', 'Amount')}</th>
                  <th className="px-3 py-3 text-start">{t('accounting.bank.match', 'Match')}</th>
                  <th className="px-3 py-3 text-start">{t('accounting.bank.reason', 'Reason')}</th>
                </tr>
              </thead>
              <tbody>
                {bankLinesLoading && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-brand-text-muted">
                      <Loader2 size={18} className="mx-auto mb-2 animate-spin" />
                      {t('common.loading')}
                    </td>
                  </tr>
                )}
                {!bankLinesLoading && !bankLinesData?.results.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-brand-text-muted">
                      {activeStatementId ? t('accounting.bank.no_lines', 'No lines for this filter.') : t('accounting.bank.upload_first', 'Upload a statement to see extracted lines.')}
                    </td>
                  </tr>
                )}
                {bankLinesData?.results.map((line) => (
                  <tr key={line.id} className="border-b border-brand-border/50 text-brand-text">
                    <td className="px-3 py-3 whitespace-nowrap">{line.transaction_date}</td>
                    <td className="px-3 py-3">
                      <span className={line.direction === 'money_in' ? 'text-emerald-300' : 'text-rose-300'}>
                        {directionLabel(line.direction)}
                      </span>
                    </td>
                    <td className="px-3 py-3 min-w-72">
                      <div>{line.description || '—'}</div>
                      {line.reference_no && <div className="mt-1 font-mono text-[11px] text-brand-text-muted">{line.reference_no}</div>}
                    </td>
                    <td className="px-3 py-3 text-end font-mono font-semibold">{money(line.amount)}</td>
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        <MatchBadge status={line.match_status} label={matchLabel(line.match_status)} />
                        {line.matched_entry && (
                          <div className="font-mono text-[11px] text-brand-primary-light">
                            {line.matched_entry.entry_number}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs leading-5 text-brand-text-muted">
                      {line.match_confidence !== null && line.match_confidence !== undefined && (
                        <span className="me-2 font-mono">{line.match_confidence}%</span>
                      )}
                      {line.match_reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-brand-text">{t('accounting.reports.title', 'Reports and tax control')}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              type="date"
              value={reportDateFrom}
              onChange={(e) => setReportDateFrom(e.target.value)}
              className="h-10 w-40"
            />
            <Input
              type="date"
              value={reportDateTo}
              onChange={(e) => setReportDateTo(e.target.value)}
              className="h-10 w-40"
            />
            <Input
              value={reportCurrency}
              onChange={(e) => setReportCurrency(e.target.value.toUpperCase())}
              className="h-10 w-24"
            />
            <Button variant="secondary" onClick={printReport} disabled={!report || reportLoading}>
              <FileText size={15} />
              {t('accounting.reports.print', 'Print report')}
            </Button>
            <Button variant="secondary" onClick={() => exportReportMut.mutate()} loading={exportReportMut.isPending}>
              <Download size={15} />
              CSV
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <MoneyCard
            title={t('accounting.reports.net', 'Net')}
            value={reportLoading ? '...' : money(report?.net)}
            icon={BarChart3}
            tone="blue"
          />
          <MoneyCard
            title={t('accounting.reports.tax_net', 'Tax net')}
            value={reportLoading ? '...' : money(report?.tax_net)}
            icon={ShieldCheck}
            tone="green"
          />
          <MoneyCard
            title={t('accounting.reports.missing_invoices', 'Missing proof')}
            value={reportLoading ? '...' : String(report?.missing_official_invoice_count ?? 0)}
            icon={AlertTriangle}
            tone="amber"
          />
          <MoneyCard
            title={t('accounting.reports.unmatched_bank', 'Unmatched bank lines')}
            value={reportLoading ? '...' : String(report?.unmatched_bank_lines ?? 0)}
            icon={Landmark}
            tone="red"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="overflow-x-auto rounded-xl border border-brand-border/70">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border text-xs uppercase tracking-wide text-brand-text-muted">
                  <th className="px-3 py-3 text-start">{t('accounting.table.type', 'Type')}</th>
                  <th className="px-3 py-3 text-start">{t('accounting.table.category', 'Category')}</th>
                  <th className="px-3 py-3 text-end">{t('accounting.table.amount', 'Amount')}</th>
                  <th className="px-3 py-3 text-end">#</th>
                </tr>
              </thead>
              <tbody>
                {!report?.category_totals.length && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-brand-text-muted">{t('common.no_data')}</td></tr>
                )}
                {report?.category_totals.map((row) => (
                  <tr key={`${row.direction}-${row.category}`} className="border-b border-brand-border/50">
                    <td className="px-3 py-3 text-brand-text">{directionLabel(row.direction)}</td>
                    <td className="px-3 py-3 text-brand-text">{categoryLabel(row.category)}</td>
                    <td className="px-3 py-3 text-end font-mono text-brand-text">{money(row.amount)}</td>
                    <td className="px-3 py-3 text-end font-mono text-brand-text-muted">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
              <AlertTriangle size={16} />
              {t('accounting.reports.tax_alerts', 'Tax alerts')}
            </div>
            <div className="mt-3 space-y-2">
              {!report?.tax_alerts.length && (
                <p className="text-xs text-brand-text-muted">{t('accounting.reports.no_tax_alerts', 'No missing official invoice alerts in this period.')}</p>
              )}
              {report?.tax_alerts.slice(0, 8).map((alert) => (
                <div key={alert.id} className="rounded-lg border border-brand-border bg-brand-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-brand-primary-light">{alert.entry_number}</span>
                    <span className="font-mono text-xs text-amber-200">{money(alert.amount)}</span>
                  </div>
                  <p className="mt-1 text-xs text-brand-text-muted">
                    {alert.entry_date} · {categoryLabel(alert.category)} · {alert.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.direction === 'money_in' ? t('accounting.form.money_in_title', 'Record Money In') : t('accounting.form.money_out_title', 'Record Money Out')}
        size="xl"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => createMut.mutate()}
              loading={createMut.isPending}
              disabled={!form.amount || Number(form.amount) <= 0}
            >
              <Save size={15} />
              {t('common.save')}
            </Button>
          </>
        )}
      >
        <div className="space-y-5">
          {createMut.error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              {(createMut.error as Error).message}
            </div>
          )}

          <FormRow cols={3}>
            <Select
              label={t('accounting.form.direction', 'Direction')}
              value={form.direction}
              onChange={(e) => changeDirection(e.target.value as AccountingDirection)}
              options={directionOptions}
            />
            <Input
              label={t('accounting.form.entry_date', 'Entry date')}
              type="date"
              value={form.entry_date}
              onChange={(e) => setField('entry_date', e.target.value)}
            />
            <Select
              label={t('common.status')}
              value={form.status}
              onChange={(e) => setField('status', e.target.value as AccountingStatus)}
              options={statusOptions}
            />
          </FormRow>

          <FormRow cols={3}>
            <Input
              label={t('accounting.form.amount', 'Amount')}
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setField('amount', e.target.value)}
            />
            <Input
              label={t('common.currency')}
              value={form.currency}
              onChange={(e) => setField('currency', e.target.value.toUpperCase())}
            />
            <Select
              label={t('accounting.form.payment_method', 'Payment method')}
              value={form.payment_method}
              onChange={(e) => setField('payment_method', e.target.value)}
              options={paymentOptions}
            />
          </FormRow>

          <FormRow cols={3}>
            <Select
              label={t('accounting.form.category', 'Category')}
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
              options={categoryOptions}
            />
            <Input
              label={t('accounting.form.reference_no', 'Reference no.')}
              value={form.reference_no}
              onChange={(e) => setField('reference_no', e.target.value)}
              placeholder={t('accounting.form.reference_placeholder', 'CliQ, bank ref, receipt no.')}
            />
            <Input
              label={t('accounting.form.counterparty_name', 'Manual counterparty')}
              value={form.counterparty_name}
              onChange={(e) => setField('counterparty_name', e.target.value)}
            />
          </FormRow>

          <div className="rounded-xl border border-brand-border bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-text">
              <Paperclip size={16} className="text-brand-primary-light" />
              {t('accounting.form.links_title', 'Optional links')}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <Select
                label={t('clients.title')}
                value={form.client_id}
                onChange={(e) => setField('client_id', e.target.value)}
                options={clientOptions}
                placeholder={t('clients.select')}
              />
              <Select
                label={t('accounting.form.linked_invoice', 'Linked client invoice')}
                value={form.invoice_id}
                onChange={(e) => setField('invoice_id', e.target.value)}
                options={invoiceOptions}
                placeholder={t('accounting.form.select_invoice', 'Select invoice')}
              />
              <Select
                label={t('nav.containers')}
                value={form.booking_id}
                onChange={(e) => setField('booking_id', e.target.value)}
                options={bookingOptions}
                placeholder={t('accounting.form.select_container', 'Select container')}
              />
              <Select
                label={t('nav.shipping_agents')}
                value={form.shipping_agent_id}
                onChange={(e) => setField('shipping_agent_id', e.target.value)}
                options={shippingAgentOptions}
                placeholder={t('accounting.form.select_shipping_agent', 'Select shipping agent')}
              />
              <Select
                label={t('nav.clearance_agents')}
                value={form.clearance_agent_id}
                onChange={(e) => setField('clearance_agent_id', e.target.value)}
                options={clearanceAgentOptions}
                placeholder={t('accounting.form.select_clearance_agent', 'Select clearance agent')}
              />
              <Select
                label={t('nav.suppliers')}
                value={form.supplier_id}
                onChange={(e) => setField('supplier_id', e.target.value)}
                options={supplierOptions}
                placeholder={t('accounting.form.select_supplier', 'Select supplier')}
              />
            </div>
          </div>

          <FormRow cols={3}>
            <Input
              label={t('accounting.form.tax_rate', 'Tax %')}
              type="number"
              step="0.001"
              value={form.tax_rate_pct}
              onChange={(e) => setField('tax_rate_pct', e.target.value)}
            />
            <Input
              label={t('accounting.form.tax_amount', 'Tax amount')}
              type="number"
              step="0.01"
              value={form.tax_amount}
              onChange={(e) => setField('tax_amount', e.target.value)}
            />
            <label className="flex min-h-[72px] items-center gap-3 rounded-lg border border-brand-border bg-white/[0.03] px-4 py-3 text-sm text-brand-text">
              <input
                type="checkbox"
                checked={form.has_official_tax_invoice}
                onChange={(e) => setField('has_official_tax_invoice', e.target.checked)}
                className="h-4 w-4 accent-brand-primary"
              />
              {t('accounting.form.official_tax_invoice', 'Official tax invoice attached')}
            </label>
          </FormRow>

          <FormRow cols={2}>
            <Textarea
              label={t('accounting.form.description', 'Description')}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
            <Textarea
              label={t('common.notes')}
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
            />
          </FormRow>

          <div className="rounded-xl border border-brand-border bg-white/[0.03] p-4">
            <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
              <Select
                label={t('accounting.form.document_type', 'Proof type')}
                value={form.attachment_document_type}
                onChange={(e) => setField('attachment_document_type', e.target.value)}
                options={documentOptions}
              />
              <div>
                <label className="label-base">{t('accounting.form.upload_files', 'Proof files')}</label>
                <label className="mt-1 flex min-h-[46px] cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-text-muted hover:border-brand-primary/60">
                  <span className="inline-flex items-center gap-2">
                    <Upload size={16} />
                    {files.length
                      ? t('accounting.form.files_selected', '{{count}} file(s) selected', { count: files.length })
                      : t('accounting.form.choose_files', 'Choose PDF, image, or receipt files')}
                  </span>
                  <Download size={15} />
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        title={t('accounting.bank.upload_title', 'Upload bank statement')}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setBankModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => uploadStatementMut.mutate()} loading={uploadStatementMut.isPending} disabled={!bankFile}>
              <Upload size={15} />
              {t('accounting.bank.upload_button', 'Upload statement')}
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          {uploadStatementMut.error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              {(uploadStatementMut.error as Error).message}
            </div>
          )}
          <FormRow cols={3}>
            <Input
              label={t('accounting.bank.bank_name', 'Bank name')}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
            <Input
              label={t('accounting.bank.account_no', 'Account no.')}
              value={bankAccountNo}
              onChange={(e) => setBankAccountNo(e.target.value)}
            />
            <Input
              label={t('common.currency')}
              value={bankCurrency}
              onChange={(e) => setBankCurrency(e.target.value.toUpperCase())}
            />
          </FormRow>
          <div>
            <label className="label-base">{t('accounting.bank.statement_file', 'Statement file')}</label>
            <label className="mt-1 flex min-h-[58px] cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-text-muted hover:border-brand-primary/60">
              <span className="inline-flex items-center gap-2">
                <Upload size={16} />
                {bankFile
                  ? bankFile.name
                  : t('accounting.bank.choose_statement', 'Choose CSV or XLSX bank statement')}
              </span>
              <FileText size={16} />
              <input
                type="file"
                accept=".csv,.xlsx,.xlsm"
                className="hidden"
                onChange={(e) => setBankFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="mt-2 text-xs leading-5 text-brand-text-muted">
              {t('accounting.bank.upload_hint', 'Supported columns: date plus amount, or date plus debit/credit. Description/reference/balance are optional. Arabic and English headers are supported.')}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
