import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import {
  Plus, Trash2, FileSpreadsheet, ChevronDown, ChevronUp,
  Package, Ship, Banknote, FileText,
  StickyNote, AlertCircle,
} from 'lucide-react'
import { Input, Select, Textarea, FormRow } from '@/components/ui/Form'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import type { Invoice } from '@/types'
import {
  SHIPPING_TERMS, PAYMENT_TERMS, getFlatPortOptions,
  calcVolumetricWeight, calcChargeableWeight,
} from '@/constants/logistics'
import ImageUploadZone from './ImageUploadZone'
import StampPositionPicker from './StampPositionPicker'
import ExcelImportPanel from './ExcelImportPanel'
import type { ParsedItem } from './ExcelImportPanel'
import clsx from 'clsx'

// ── Constants ────────────────────────────────────────────────────────────────

const CURRENCIES = ['USD', 'EUR', 'CNY', 'JOD', 'IQD', 'SAR', 'AED']

const UNIT_VALUES = ['pcs','pairs','sets','kg','tons','cbm','rolls','bags','boxes','cartons'] as const

const SEA_PORT_OPTIONS  = getFlatPortOptions('sea')
const AIR_PORT_OPTIONS  = getFlatPortOptions('air')

// ── Tabs ──────────────────────────────────────────────────────────────────────
type TabId = 'info' | 'shipping' | 'items' | 'bank' | 'notes'

const TAB_ICONS: Record<TabId, React.ElementType> = {
  info: FileText, shipping: Ship, items: Package, bank: Banknote, notes: StickyNote,
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ItemFormValues {
  description: string
  description_ar: string
  details: string
  details_ar: string
  hs_code: string
  quantity: number
  unit: string
  unit_price: number
  cartons: number | null
  gross_weight: number | null
  net_weight: number | null
  cbm: number | null
  carton_length_cm: number | null
  carton_width_cm: number | null
  carton_height_cm: number | null
  sort_order: number
}

interface FormValues {
  client_id: number | null
  buyer_name: string       // manual name for dummy invoices
  invoice_type: string
  issue_date: string
  due_date: string
  status: string
  currency: string
  origin: string
  payment_terms: string
  shipping_term: string
  port_of_loading: string
  port_of_discharge: string
  shipping_marks: string
  container_no: string
  seal_no: string
  bl_number: string
  vessel_name: string
  voyage_number: string
  stamp_position: string
  bank_account_name: string
  bank_account_no: string
  bank_swift: string
  bank_name: string
  bank_address: string
  discount: number
  notes: string
  notes_ar: string
  items: ItemFormValues[]
}

interface Props {
  initial?: Partial<Invoice>
  onSubmit: (data: FormValues) => Promise<unknown>
  loading?: boolean
  invoiceId?: number
  onStampUpload?: (file: File) => Promise<void>
  onBackgroundUpload?: (file: File) => Promise<void>
  /** When set, the client field is locked (pre-filled, not editable) */
  lockedClient?: { id: number; name: string; name_ar?: string | null; client_code: string }
  /** When true, the status selector is hidden (status managed externally) */
  hideStatus?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function defaultItem(): ItemFormValues {
  return {
    description: '', description_ar: '', details: '', details_ar: '',
    hs_code: '', quantity: 1, unit: 'pcs', unit_price: 0,
    cartons: null, gross_weight: null, net_weight: null, cbm: null,
    carton_length_cm: null, carton_width_cm: null, carton_height_cm: null,
    sort_order: 0,
  }
}

function airCalc(item: ItemFormValues) {
  if (!item.carton_length_cm || !item.carton_width_cm || !item.carton_height_cm || !item.cartons) return null
  const vol = calcVolumetricWeight(item.carton_length_cm, item.carton_width_cm, item.carton_height_cm, item.cartons)
  const ch  = calcChargeableWeight(item.gross_weight ?? 0, vol)
  return { vol: vol.toFixed(2), chargeable: ch.toFixed(2) }
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children, accent = 'indigo' }: {
  title: string; children: React.ReactNode; accent?: 'indigo' | 'emerald' | 'blue' | 'amber'
}) {
  const colors = {
    indigo:  'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }
  return (
    <div className="space-y-4">
      <div className={clsx('inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold', colors[accent])}>
        {title}
      </div>
      <div className="space-y-4 ps-1">
        {children}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function InvoiceForm({
  initial, onSubmit, loading, invoiceId, onStampUpload, onBackgroundUpload, lockedClient, hideStatus,
}: Props) {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.language === 'ar'

  const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'info',     label: t('invoices.tab_info'),     icon: TAB_ICONS.info     },
    { id: 'shipping', label: t('invoices.tab_shipping'), icon: TAB_ICONS.shipping },
    { id: 'items',    label: t('invoices.tab_items'),    icon: TAB_ICONS.items    },
    { id: 'bank',     label: t('invoices.tab_bank'),     icon: TAB_ICONS.bank     },
    { id: 'notes',    label: t('invoices.tab_notes'),    icon: TAB_ICONS.notes    },
  ]

  const INVOICE_TYPES = [
    { value: 'PI',          abbr: 'PI', label: t('invoices.types.PI') },
    { value: 'CI',          abbr: 'CI', label: t('invoices.types.CI') },
    { value: 'PL',          abbr: 'PL', label: t('invoices.types.PL') },
    { value: 'SC',          abbr: 'SC', label: t('invoices.types.SC') },
    { value: 'price_offer', abbr: '',   label: t('invoices.types.price_offer') },
  ]

  const STATUSES = [
    { value: 'draft',     label: t('invoices.status.draft'),     color: 'text-gray-400' },
    { value: 'sent',      label: t('invoices.status.sent'),      color: 'text-blue-400' },
    { value: 'approved',  label: t('invoices.status.approved'),  color: 'text-indigo-400' },
    { value: 'paid',      label: t('invoices.status.paid'),      color: 'text-emerald-400' },
    { value: 'cancelled', label: t('invoices.status.cancelled'), color: 'text-red-400' },
    { value: 'dummy',     label: t('invoices.status.dummy'),     color: 'text-purple-400' },
  ]

  const UNITS: { value: string; label: string }[] = UNIT_VALUES.map((v) => ({
    value: v,
    label: isRTL ? t(`invoices.units.${v}`) : t(`invoices.units.${v}`),
  }))

  const [activeTab, setActiveTab]         = useState<TabId>('info')
  const [showExcelImport, setExcelImport] = useState(false)
  const [expandedItems, setExpanded]      = useState<Record<number, boolean>>({})
  const [tabErrors, setTabErrors]         = useState<Partial<Record<TabId, boolean>>>({})
  // No toggle needed — both client dropdown and buyer_name field are always shown (both optional)
  const [clientError, setClientError] = useState<string | null>(null)

  const {
    register, control, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      client_id:        initial?.client_id ?? null,
      buyer_name:       (initial as any)?.buyer_name ?? '',
      invoice_type:     initial?.invoice_type ?? 'PI',
      issue_date:       initial?.issue_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      due_date:         initial?.due_date?.slice(0, 10) ?? '',
      status:           initial?.status ?? 'draft',
      currency:         (initial as any)?.currency ?? 'USD',
      origin:           initial?.origin ?? '',
      payment_terms:    initial?.payment_terms ?? '',
      shipping_term:    initial?.shipping_term ?? '',
      port_of_loading:  initial?.port_of_loading ?? '',
      port_of_discharge: initial?.port_of_discharge ?? '',
      shipping_marks:   initial?.shipping_marks ?? '',
      container_no:     initial?.container_no ?? '',
      seal_no:          initial?.seal_no ?? '',
      bl_number:        initial?.bl_number ?? '',
      vessel_name:      initial?.vessel_name ?? '',
      voyage_number:    initial?.voyage_number ?? '',
      stamp_position:   initial?.stamp_position ?? 'bottom-right',
      bank_account_name: initial?.bank_account_name ?? '',
      bank_account_no:  initial?.bank_account_no ?? '',
      bank_swift:       initial?.bank_swift ?? '',
      bank_name:        initial?.bank_name ?? '',
      bank_address:     initial?.bank_address ?? '',
      discount:         initial?.discount != null ? Number(initial.discount) : 0,
      notes:            initial?.notes ?? '',
      notes_ar:         initial?.notes_ar ?? '',
      items: initial?.items?.map((item) => ({
        description:    item.description,
        description_ar: item.description_ar ?? '',
        details:        item.details ?? '',
        details_ar:     item.details_ar ?? '',
        hs_code:        item.hs_code ?? '',
        quantity:       Number(item.quantity),
        unit:           item.unit ?? 'pcs',
        unit_price:     Number(item.unit_price),
        cartons:        item.cartons ?? null,
        gross_weight:   item.gross_weight ? Number(item.gross_weight) : null,
        net_weight:     item.net_weight  ? Number(item.net_weight)  : null,
        cbm:            item.cbm ? Number(item.cbm) : null,
        carton_length_cm: item.carton_length_cm ? Number(item.carton_length_cm) : null,
        carton_width_cm:  item.carton_width_cm  ? Number(item.carton_width_cm)  : null,
        carton_height_cm: item.carton_height_cm ? Number(item.carton_height_cm) : null,
        sort_order: item.sort_order ?? 0,
      })) ?? [defaultItem()],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' })

  const watchItems      = watch('items')
  const watchType       = watch('invoice_type')
  const watchCurrency   = watch('currency')

  const subtotal = watchItems.reduce((s, it) => s + (Number(it.quantity) * Number(it.unit_price)), 0)
  const discount = Number(watch('discount')) || 0
  const total    = Math.max(subtotal - discount, 0)

  const isAir = watchType === 'AIR'
  const portOptions = isAir ? AIR_PORT_OPTIONS : SEA_PORT_OPTIONS

  function handleExcelImport(items: ParsedItem[]) {
    replace(items.map((item, idx) => ({
      description: item.description, description_ar: '',
      details: item.details,        details_ar: '',
      hs_code: item.hs_code,
      quantity: item.quantity ?? 1,
      unit: 'pcs',
      unit_price: item.unit_price ?? 0,
      cartons: item.cartons, gross_weight: item.gross_weight,
      net_weight: item.net_weight, cbm: item.cbm,
      carton_length_cm: null, carton_width_cm: null, carton_height_cm: null,
      sort_order: idx,
    })))
    setExcelImport(false)
  }

  // On submit error, highlight which tabs have issues
  function onInvalid() {
    const errs: Partial<Record<TabId, boolean>> = {}
    if (errors.client_id || errors.invoice_type || errors.issue_date) errs.info = true
    if (errors.items) errs.items = true
    setTabErrors(errs)
  }

  // Sanitize form data before sending to backend:
  // - empty string dates  → undefined (backend expects null or valid date)
  function sanitize(data: FormValues) {
    return {
      ...data,
      // lockedClient takes priority (from client profile), else use dropdown selection
      client_id:  lockedClient ? lockedClient.id : (data.client_id || null),
      buyer_name: data.buyer_name || undefined,
      due_date:     data.due_date     || undefined,
      // strip empty optional strings so backend stores null
      origin:           data.origin           || undefined,
      payment_terms:    data.payment_terms    || undefined,
      shipping_term:    data.shipping_term    || undefined,
      port_of_loading:  data.port_of_loading  || undefined,
      port_of_discharge: data.port_of_discharge || undefined,
      shipping_marks:   data.shipping_marks   || undefined,
      container_no:     data.container_no     || undefined,
      seal_no:          data.seal_no          || undefined,
      bl_number:        data.bl_number        || undefined,
      vessel_name:      data.vessel_name      || undefined,
      voyage_number:    data.voyage_number    || undefined,
      bank_account_name: data.bank_account_name || undefined,
      bank_account_no:  data.bank_account_no  || undefined,
      bank_swift:       data.bank_swift       || undefined,
      bank_name:        data.bank_name        || undefined,
      bank_address:     data.bank_address     || undefined,
      notes:            data.notes            || undefined,
      notes_ar:         data.notes_ar         || undefined,
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit((data) => {
          const s = sanitize(data)
          // Must have either a real client or a buyer name
          if (!lockedClient && !s.client_id && !s.buyer_name) {
            setClientError(t('invoices.client_required'))
            setActiveTab('info')
            return
          }
          setClientError(null)
          return onSubmit(s as FormValues)
        }, onInvalid)}
        className="flex flex-col gap-0"
      >

        {/* ── Tab Bar ── */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 mb-5 border-b border-brand-border/50">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const hasErr   = tabErrors[tab.id]
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setActiveTab(tab.id); setTabErrors(p => ({ ...p, [tab.id]: false })) }}
                className={clsx(
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                  isActive
                    ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/30'
                    : 'text-brand-text-muted hover:text-brand-text hover:bg-white/5',
                  hasErr && 'text-brand-red border-brand-red/30 bg-brand-red/10',
                )}
              >
                <Icon size={13} />
                {tab.label}
                {hasErr && <AlertCircle size={11} className="text-brand-red" />}
              </button>
            )
          })}
        </div>

        {/* ══════════════════════ TAB: معلومات الفاتورة ══════════════════════ */}
        {activeTab === 'info' && (
          <div className="space-y-6">

            {/* Invoice Type selector */}
            <Section title={t('invoices.section_type')} accent="indigo">
              <div className="flex flex-wrap gap-2">
                {INVOICE_TYPES.map((typ) => (
                  <button
                    key={typ.value}
                    type="button"
                    onClick={() => setValue('invoice_type', typ.value)}
                    className={clsx(
                      'flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all',
                      watchType === typ.value
                        ? 'bg-brand-primary/15 text-brand-primary border-brand-primary/40 shadow-sm'
                        : 'bg-brand-surface text-brand-text-dim border-brand-border hover:border-brand-border-light hover:text-brand-text',
                    )}
                  >
                    <span className="text-sm font-bold">
                      {isRTL ? typ.label : (typ.abbr || typ.label)}
                    </span>
                    {typ.abbr && (
                      <span className="text-[10px] opacity-60">
                        {isRTL ? typ.abbr : typ.label}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <input type="hidden" {...register('invoice_type', { required: true })} />
            </Section>

            {/* Client + Status + Currency */}
            <Section title={t('invoices.section_invoice_data')} accent="indigo">
              <FormRow>
                {lockedClient ? (
                  <div className="space-y-1.5">
                    <label className="label-base">{t('invoices.client_label')}</label>
                    <div className="input-base flex items-center gap-3 bg-brand-primary/5 border-brand-primary/25 cursor-default select-none">
                      <div className="w-7 h-7 rounded-lg bg-brand-primary/15 flex items-center justify-center shrink-0 text-xs font-bold text-brand-primary">
                        {lockedClient.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-brand-text leading-tight truncate">{lockedClient.name}</p>
                        <p className="text-[10px] text-brand-text-muted font-mono">{lockedClient.client_code}</p>
                      </div>
                    </div>
                    <input type="hidden" {...register('client_id', { valueAsNumber: true })} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="label-base">{t('invoices.buyer_name_label')}</label>
                    <Input
                      placeholder={t('invoices.buyer_name_placeholder')}
                      {...register('buyer_name', {
                        onChange: (e) => { if (e.target.value) setClientError(null) },
                      })}
                    />
                    {clientError && (
                      <p className="text-xs text-brand-red flex items-center gap-1">
                        <AlertCircle size={11} /> {clientError}
                      </p>
                    )}
                  </div>
                )}
                {!hideStatus && (
                  <div className="space-y-1.5">
                    <label className="label-base">{t('invoices.status_label')}</label>
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setValue('status', s.value)}
                          className={clsx(
                            'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                            watch('status') === s.value
                              ? `${s.color} bg-white/5 border-current`
                              : 'text-brand-text-muted border-brand-border hover:border-brand-border-light',
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <input type="hidden" {...register('status')} />
                  </div>
                )}
                {hideStatus && <input type="hidden" {...register('status')} />}
              </FormRow>

              <FormRow cols={3}>
                <Input
                  type="date"
                  label={t('invoices.issue_date')}
                  {...register('issue_date', { required: true })}
                  error={errors.issue_date ? t('invoices.item_required') : undefined}
                />
                <Input
                  type="date"
                  label={t('invoices.due_date')}
                  {...register('due_date')}
                />
                <div className="space-y-1.5">
                  <label className="label-base">{t('invoices.currency_label')}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CURRENCIES.map((cur) => (
                      <button
                        key={cur}
                        type="button"
                        onClick={() => setValue('currency', cur)}
                        className={clsx(
                          'px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold transition-all',
                          watchCurrency === cur
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'text-brand-text-muted border-brand-border hover:border-brand-border-light',
                        )}
                      >
                        {cur}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" {...register('currency')} />
                </div>
              </FormRow>
            </Section>
          </div>
        )}

        {/* ══════════════════════ TAB: الشحن والتجارة ══════════════════════ */}
        {activeTab === 'shipping' && (
          <div className="space-y-6">

            <Section title={t('invoices.section_shipping_info')} accent="blue">
              <FormRow>
                <Input
                  label={t('invoices.origin')}
                  placeholder={t('invoices.origin_placeholder')}
                  {...register('origin')}
                />
                <Select
                  label={t('invoices.shipping_term')}
                  options={[{ value: '', label: t('invoices.select_placeholder') }, ...SHIPPING_TERMS.map((v) => ({ value: v, label: v }))]}
                  {...register('shipping_term')}
                />
              </FormRow>
              <FormRow>
                <Select
                  label={t('invoices.payment_terms')}
                  options={[{ value: '', label: t('invoices.select_placeholder') }, ...PAYMENT_TERMS.map((v) => ({ value: v, label: v }))]}
                  {...register('payment_terms')}
                />
                <Input
                  label={t('invoices.shipping_marks')}
                  placeholder={isRTL ? 'N/M أو اسم العميل...' : 'N/M or client name...'}
                  {...register('shipping_marks')}
                />
              </FormRow>
              <FormRow>
                <Select
                  label={t('invoices.port_loading')}
                  options={portOptions}
                  {...register('port_of_loading')}
                />
                <Select
                  label={t('invoices.port_discharge')}
                  options={portOptions}
                  {...register('port_of_discharge')}
                />
              </FormRow>
            </Section>

            <Section title={t('invoices.container_bl_title', 'بيانات الحاوية وسند الشحن')} accent="blue">
              <FormRow>
                <Input label={t('invoices.container_no')} placeholder="SEGU6361144" {...register('container_no')} />
                <Input label={t('invoices.seal_no')}      placeholder="M5796799"    {...register('seal_no')} />
              </FormRow>
              <FormRow>
                <Input label={t('invoices.bl_number')} placeholder="GGZ2848838" {...register('bl_number')} />
                <Input label={t('invoices.vessel')}                              {...register('vessel_name')} />
              </FormRow>
              <Input label={t('invoices.voyage_number')} {...register('voyage_number')} />
            </Section>
          </div>
        )}

        {/* ══════════════════════ TAB: البضائع ══════════════════════ */}
        {activeTab === 'items' && (
          <div className="space-y-4">

            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-brand-text-muted">{t('invoices.items_count', { count: fields.length })}</span>
                {errors.items && (
                  <span className="text-xs text-brand-red flex items-center gap-1">
                    <AlertCircle size={11} /> {t('invoices.items_error')}
                  </span>
                )}
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setExcelImport(true)}>
                <FileSpreadsheet size={13} />
                {t('invoices.import_excel')}
              </Button>
            </div>

            {/* Items */}
            <div className="space-y-3">
              {fields.map((field, i) => {
                const item     = watchItems[i] ?? {}
                const calc     = isAir ? airCalc(item as ItemFormValues) : null
                const expanded = expandedItems[i] ?? false
                const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)

                return (
                  <div
                    key={field.id}
                    className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden"
                  >
                    {/* Item Header */}
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.02] border-b border-brand-border/50">
                      <div className="w-6 h-6 rounded-md bg-brand-primary/15 flex items-center justify-center text-[10px] font-bold text-brand-primary shrink-0">
                        {i + 1}
                      </div>
                      <span className="text-xs text-brand-text-dim flex-1 truncate">
                        {item.description || t('invoices.new_item_placeholder')}
                      </span>
                      <span className="text-xs font-semibold text-emerald-400 font-mono shrink-0">
                        {lineTotal > 0 ? lineTotal.toFixed(2) + ' ' + watchCurrency : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpanded((p) => ({ ...p, [i]: !p[i] }))}
                        className="btn-icon p-1 text-brand-text-muted"
                        title={t('invoices.item_details_toggle')}
                      >
                        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(i)}
                          className="btn-icon p-1 hover:text-brand-red hover:bg-brand-red/10"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {/* Item Body */}
                    <div className="p-4 space-y-3">

                      {/* Description */}
                      <FormRow>
                        <Input
                          label={t('invoices.item_name')}
                          placeholder={t('invoices.item_name_placeholder')}
                          {...register(`items.${i}.description`, { required: true })}
                          error={errors.items?.[i]?.description ? t('invoices.item_required') : undefined}
                        />
                        <Input
                          label={t('invoices.item_details_label')}
                          placeholder={t('invoices.item_details_placeholder')}
                          {...register(`items.${i}.details`)}
                        />
                      </FormRow>

                      {/* Qty + Unit + Price */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Input
                          type="number"
                          label={t('invoices.item_qty')}
                          min={0.01}
                          step="any"
                          {...register(`items.${i}.quantity`, { required: true, min: 0.01, valueAsNumber: true })}
                          error={errors.items?.[i]?.quantity ? t('invoices.item_required') : undefined}
                        />
                        <div className="space-y-1.5">
                          <label className="label-base">{t('invoices.item_unit')}</label>
                          <select
                            className="input-base"
                            {...register(`items.${i}.unit`)}
                          >
                            {UNITS.map((u) => (
                              <option key={u.value} value={u.value} style={{ background: '#061220' }}>{u.label}</option>
                            ))}
                          </select>
                        </div>
                        <Input
                          type="number"
                          label={t('invoices.item_unit_price', { currency: watchCurrency })}
                          min={0}
                          step="0.0001"
                          {...register(`items.${i}.unit_price`, { required: true, min: 0, valueAsNumber: true })}
                          error={errors.items?.[i]?.unit_price ? t('invoices.item_required') : undefined}
                        />
                        <div className="space-y-1.5">
                          <label className="label-base">{t('invoices.item_total')}</label>
                          <div className="input-base flex items-center font-mono text-emerald-400 font-semibold bg-emerald-500/5 border-emerald-500/15">
                            {lineTotal.toFixed(2)} {watchCurrency}
                          </div>
                        </div>
                      </div>

                      {/* HS Code */}
                      <FormRow>
                        <Input label={t('invoices.hs_code')} placeholder="6109.10" {...register(`items.${i}.hs_code`)} />
                        <div className="invisible sm:block" />
                      </FormRow>

                      {/* Packing / Weight */}
                      <div className="p-3 rounded-lg border border-brand-border/50 bg-white/[0.015] space-y-3">
                        <p className="text-[10px] font-semibold text-brand-text-muted uppercase tracking-wider">{t('invoices.packing_section')}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <Input
                            type="number" label={t('invoices.cartons_count')} min={0}
                            {...register(`items.${i}.cartons`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
                          />
                          <Input
                            type="number" label={t('invoices.gross_weight')} step="0.001"
                            {...register(`items.${i}.gross_weight`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
                          />
                          <Input
                            type="number" label={t('invoices.net_weight')} step="0.001"
                            {...register(`items.${i}.net_weight`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
                          />
                          <Input
                            type="number" label={t('invoices.cbm')} step="0.0001"
                            {...register(`items.${i}.cbm`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
                          />
                        </div>
                      </div>

                      {/* Air Cargo */}
                      {isAir && (
                        <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-3">
                          <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">
                            {t('invoices.air_dims_section')}
                          </p>
                          <div className="grid grid-cols-3 gap-3">
                            <Input type="number" label={t('invoices.air_length')} step="0.01"
                              {...register(`items.${i}.carton_length_cm`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })} />
                            <Input type="number" label={t('invoices.air_width')} step="0.01"
                              {...register(`items.${i}.carton_width_cm`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })} />
                            <Input type="number" label={t('invoices.air_height')} step="0.01"
                              {...register(`items.${i}.carton_height_cm`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })} />
                          </div>
                          {calc && (
                            <div className="flex gap-4 text-xs font-mono">
                              <span className="text-blue-300">{t('invoices.air_volumetric', { val: calc.vol })}</span>
                              <span className="text-emerald-400 font-bold">{t('invoices.air_chargeable', { val: calc.chargeable })}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expanded: Arabic names */}
                      {expanded && (
                        <div className="space-y-3 pt-3 border-t border-brand-border/40">
                          <p className="text-[10px] font-semibold text-brand-text-muted uppercase tracking-wider">{t('invoices.bilingual_section')}</p>
                          <FormRow>
                            <Input label={t('invoices.item_name_en')}    {...register(`items.${i}.description_ar`)} />
                            <Input label={t('invoices.item_details_en')} {...register(`items.${i}.details_ar`)} />
                          </FormRow>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              <Button type="button" variant="secondary" size="sm" onClick={() => append(defaultItem())}>
                <Plus size={14} />
                {t('invoices.add_item')}
              </Button>
            </div>

            {/* Totals Summary */}
            <div className="rounded-xl border border-brand-border bg-brand-surface p-4 space-y-2">
              <div className="flex justify-between text-sm text-brand-text-dim">
                <span>{t('invoices.subtotal')}</span>
                <span className="font-mono">{subtotal.toFixed(2)} {watchCurrency}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-brand-text-dim shrink-0">{t('invoices.discount')}</span>
                <input
                  type="number" min={0} step="0.01"
                  className="input-base text-xs font-mono w-36"
                  {...register('discount', { valueAsNumber: true })}
                />
                <span className="text-xs text-brand-text-muted">{watchCurrency}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-brand-red">
                  <span>{t('invoices.discount')}</span>
                  <span className="font-mono">- {discount.toFixed(2)} {watchCurrency}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t border-brand-border pt-2">
                <span className="text-brand-text">{t('invoices.grand_total')}</span>
                <span className="font-mono text-emerald-400">{total.toFixed(2)} {watchCurrency}</span>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════ TAB: بيانات البنك ══════════════════════ */}
        {activeTab === 'bank' && (
          <div className="space-y-6">
            <Section title={t('invoices.section_bank')} accent="emerald">
              <FormRow>
                <Input label={t('invoices.bank_account_name')} {...register('bank_account_name')} />
                <Input label={t('invoices.bank_account_no')}   {...register('bank_account_no')} />
              </FormRow>
              <FormRow>
                <Input label={t('company.bank_swift')} {...register('bank_swift')} placeholder="ABCDJOD1" />
                <Input label={t('invoices.bank_name_label')}    {...register('bank_name')} />
              </FormRow>
              <Input label={t('invoices.bank_address_label')}   {...register('bank_address')} />
            </Section>

            {invoiceId && (
              <Section title={t('invoices.section_stamp')} accent="amber">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ImageUploadZone
                    label={isRTL ? 'الختم الإلكتروني' : 'Stamp'}
                    currentImageUrl={undefined}
                    onFile={async (file) => onStampUpload?.(file)}
                  />
                  <ImageUploadZone
                    label={isRTL ? 'خلفية الوثيقة' : 'Document Background'}
                    currentImageUrl={undefined}
                    onFile={async (file) => onBackgroundUpload?.(file)}
                  />
                  {/* ImageUploadZone label is an internal visual label, not a translatable string — left as-is */}
                </div>
                <div className="mt-3">
                  <Controller
                    control={control}
                    name="stamp_position"
                    render={({ field }) => (
                      <StampPositionPicker value={field.value ?? 'bottom-right'} onChange={field.onChange} />
                    )}
                  />
                </div>
              </Section>
            )}

            {!invoiceId && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{t('invoices.stamp_hint')}</span>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════ TAB: ملاحظات ══════════════════════ */}
        {activeTab === 'notes' && (
          <div className="space-y-6">
            <Section title={t('invoices.section_notes')} accent="indigo">
              <FormRow>
                <Textarea label={t('invoices.notes_ar_label')} rows={4} placeholder={t('invoices.notes_ar_placeholder')} {...register('notes_ar')} />
                <Textarea label={t('invoices.notes_en_label')} rows={4} placeholder="Any additional notes..."             {...register('notes')} />
              </FormRow>
            </Section>
          </div>
        )}

        {/* ── Sticky Footer ── */}
        <div className="sticky bottom-0 -mx-5 px-5 py-4 mt-6 bg-brand-card border-t border-brand-border/60 flex items-center justify-between gap-4">
          {/* Mini totals bar */}
          <div className="hidden sm:flex items-center gap-4 text-xs text-brand-text-muted">
            <span>
              {t('invoices.footer_total')}
              <span className="font-mono font-bold text-emerald-400 ms-1">{total.toFixed(2)} {watchCurrency}</span>
            </span>
            <span className="text-brand-border">|</span>
            <span>{t('invoices.items_count', { count: fields.length })}</span>
            <span className="text-brand-border">|</span>
            <span>{watchType} · {STATUSES.find(s => s.value === watch('status'))?.label}</span>
          </div>

          <div className="flex items-center gap-2 ms-auto">
            {activeTab !== 'info' && (
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => {
                  const idx = TABS.findIndex(tab => tab.id === activeTab)
                  if (idx > 0) setActiveTab(TABS[idx - 1].id)
                }}
              >
                {isRTL ? 'التالي →' : '← ' + t('common.prev')}
              </button>
            )}
            {activeTab !== 'notes' && (
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => {
                  const idx = TABS.findIndex(tab => tab.id === activeTab)
                  if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id)
                }}
              >
                {isRTL ? '← السابق' : t('common.next') + ' →'}
              </button>
            )}
            <Button type="submit" loading={loading}>
              {initial?.id ? t('invoices.save_edit') : t('invoices.save_new')}
            </Button>
          </div>
        </div>

      </form>

      {/* Excel Import Modal */}
      <Modal open={showExcelImport} onClose={() => setExcelImport(false)} title={t('invoices.import_excel_title')} size="lg">
        <ExcelImportPanel onImport={handleExcelImport} onClose={() => setExcelImport(false)} />
      </Modal>
    </>
  )
}
