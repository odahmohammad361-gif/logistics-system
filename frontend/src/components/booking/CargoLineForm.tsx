import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { getEligibleClients } from '@/services/bookingService'
import { getClearanceAgents } from '@/services/agentService'
import { getInvoices } from '@/services/invoiceService'
import { Input, Select, Textarea, FormRow, FormSection } from '@/components/ui/Form'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import type { BookingCargoLine, BookingMode } from '@/types'

const DEST_LABEL: Record<string, string> = { jordan: '🇯🇴 Jordan', iraq: '🇮🇶 Iraq' }
const DEST_LABEL_AR: Record<string, string> = { jordan: '🇯🇴 الأردن', iraq: '🇮🇶 العراق' }

function normalizeCountry(value: string | null | undefined) {
  const v = (value ?? '').trim().toLowerCase()
  if (!v) return ''
  if (v.includes('jordan') || v.includes('الأردن') || v === 'jo') return 'jordan'
  if (v.includes('iraq') || v.includes('العراق') || v === 'iq') return 'iraq'
  return v
}

function normKey(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function canonicalContainerSize(value: string | null | undefined) {
  const v = normKey(value)
  if (!v) return ''
  if (v.includes('40hq') || v.includes('40hc') || v.includes('40highcube')) return '40HQ'
  if (v.includes('20')) return '20GP'
  if (v.includes('40')) return '40GP'
  return v.toUpperCase()
}

function sizeMatches(rateSize: string | null | undefined, expectedSize: string | null | undefined) {
  const rate = canonicalContainerSize(rateSize)
  const expected = canonicalContainerSize(expectedSize)
  if (!rate || !expected) return true
  return rate === expected || looseKeyMatch(rateSize, expectedSize)
}

function looseKeyMatch(left: string | null | undefined, right: string | null | undefined) {
  const a = normKey(left)
  const b = normKey(right)
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)))
}

function clearanceMode(mode: BookingMode) {
  return mode === 'AIR' ? 'air' : 'sea'
}

interface FormValues {
  client_id:          string
  invoice_id:         string
  goods_source:       string
  is_full_container_client: boolean
  description:        string
  description_ar:     string
  hs_code:            string
  shipping_marks:     string
  cartons:            string
  gross_weight_kg:    string
  net_weight_kg:      string
  cbm:                string
  carton_length_cm:   string
  carton_width_cm:    string
  carton_height_cm:   string
  clearance_through_us: string
  clearance_agent_id: string
  clearance_agent_rate_id: string
  manual_clearance_agent_name: string
  manual_clearance_agent_phone: string
  manual_clearance_agent_notes: string
  notes:              string
}

interface GoodsRow {
  product_id: string
  description: string
  cartons: string
  quantity: string
  gross_weight_kg: string
  cbm: string
  hs_code: string
}

interface Props {
  open:        boolean
  onClose:     () => void
  onSubmit:    (data: Record<string, unknown>) => Promise<void>
  mode:        BookingMode
  bookingId:   number
  containerSize?: string | null
  carrierName?: string | null
  capacityCbm?: number | null
  usedCbm?: number | null
  existingLineCount?: number
  initial?:    BookingCargoLine | null
  saving?:     boolean
  errorMessage?: string | null
}

export default function CargoLineForm({
  open,
  onClose,
  onSubmit,
  mode,
  bookingId,
  containerSize,
  carrierName,
  capacityCbm,
  usedCbm,
  existingLineCount = 0,
  initial,
  saving,
  errorMessage,
}: Props) {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'

  const { data: eligibleData } = useQuery({
    queryKey: ['eligible-clients', bookingId],
    queryFn:  () => getEligibleClients(bookingId),
    enabled:  open && !!bookingId,
  })

  const { data: clearanceAgentsData } = useQuery({
    queryKey: ['clearance-agents-cargo'],
    queryFn: () => getClearanceAgents({ page: 1, page_size: 100 }),
    enabled: open,
  })

  const { data: invoicesData } = useQuery({
    queryKey: ['cargo-line-invoices'],
    queryFn: () => getInvoices({ page: 1, page_size: 100 }),
    enabled: open,
  })

  const bookingDest = eligibleData?.booking_destination ?? null

  const clientOptions = useMemo(() => {
    const clients = eligibleData?.results ?? []
    return clients.map(c => ({
      value: String(c.id),
      label: `${c.client_code} — ${isAr && c.name_ar ? c.name_ar : c.name}${c.destination ? ` (${isAr ? DEST_LABEL_AR[c.destination] : DEST_LABEL[c.destination]})` : ''}`,
    }))
  }, [eligibleData, isAr])

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>()
  const [goodsRows, setGoodsRows] = useState<GoodsRow[]>([])
  const selectedClientId = watch('client_id')
  const selectedInvoiceId = watch('invoice_id')
  const clearanceThroughUs = watch('clearance_through_us') !== 'manual'
  const selectedClearanceAgentId = watch('clearance_agent_id')
  const selectedClearanceRateId = watch('clearance_agent_rate_id')
  const watchedCbm = watch('cbm')
  const baseUsedCbm = Math.max(0, Number(usedCbm ?? 0) - Number(initial?.cbm ?? 0))
  const remainingCbm = capacityCbm != null ? Math.max(0, capacityCbm - baseUsedCbm) : null
  const enteredCbm = parseFloat(watchedCbm || '0') || 0
  const capacityExceeded = mode === 'LCL' && remainingCbm != null && enteredCbm > remainingCbm
  const fillWarning = mode === 'LCL' && capacityCbm != null && capacityCbm > 0 && (Number(usedCbm ?? 0) / capacityCbm) >= 0.9
  const cannotMarkFull = mode === 'LCL' && !initial?.is_full_container_client && existingLineCount > (initial ? 1 : 0)

  const clearanceAgentOptions = useMemo(() => {
    const destination = normalizeCountry(bookingDest)
    return (clearanceAgentsData?.results ?? [])
      .filter(a => !destination || normalizeCountry(a.country) === destination)
      .map(a => ({
      value: String(a.id),
      label: `${isAr && a.name_ar ? a.name_ar : a.name}${a.country ? ` — ${a.country}` : ''}`,
    }))
  }, [clearanceAgentsData, bookingDest, isAr])

  const invoiceOptions = useMemo(() => {
    const invoices = invoicesData?.results ?? []
    return invoices
      .filter(inv => !selectedClientId || !inv.client_id || String(inv.client_id) === selectedClientId)
      .map(inv => ({
        value: String(inv.id),
        label: `${inv.invoice_number} — ${inv.invoice_type} — ${Number(inv.total || 0).toFixed(2)} ${inv.currency || 'USD'}`,
      }))
  }, [invoicesData, selectedClientId])

  const selectedInvoice = useMemo(
    () => (invoicesData?.results ?? []).find(inv => String(inv.id) === selectedInvoiceId),
    [invoicesData, selectedInvoiceId],
  )

  const clearanceRateOptions = useMemo(() => {
    const destination = normalizeCountry(bookingDest)
    const expectedMode = clearanceMode(mode)
    const expectedCarrier = normKey(carrierName)
    const agent = (clearanceAgentsData?.results ?? []).find(a => String(a.id) === selectedClearanceAgentId)
    const baseRates = (agent?.rates ?? [])
      .filter(r => {
        const rateDest = normalizeCountry(r.country)
        if (destination && rateDest && rateDest !== destination) return false
        if (r.service_mode && r.service_mode !== expectedMode) return false
        if (expectedMode === 'sea' && !sizeMatches(r.container_size, containerSize)) return false
        return true
      })
    const strictCarrierRates = baseRates.filter(r => {
      const rateCarrier = normKey(r.carrier_name)
      return !expectedCarrier || !rateCarrier || looseKeyMatch(r.carrier_name, carrierName)
    })
    const rates = strictCarrierRates.length ? strictCarrierRates : baseRates
    return rates.map(r => {
      const carrierFallback = expectedCarrier && normKey(r.carrier_name) && !looseKeyMatch(r.carrier_name, carrierName)
      return {
        value: String(r.id),
        label: [
          r.service_mode?.toUpperCase(),
          r.country,
          r.port,
          r.container_size,
          r.carrier_name,
          r.route,
          carrierFallback ? (isAr ? 'تحقق من الناقل' : 'check carrier') : '',
        ].filter(Boolean).join(' · '),
      }
    })
  }, [clearanceAgentsData, selectedClearanceAgentId, bookingDest, mode, containerSize, carrierName, isAr])

  useEffect(() => {
    if (!open || !clearanceThroughUs) return
    if (clearanceRateOptions.length === 1 && selectedClearanceRateId !== clearanceRateOptions[0].value) {
      setValue('clearance_agent_rate_id', clearanceRateOptions[0].value)
    }
  }, [open, clearanceThroughUs, clearanceRateOptions, selectedClearanceRateId, setValue])

  useEffect(() => {
    if (!open || !selectedClearanceAgentId) return
    if (clearanceAgentOptions.some(a => a.value === selectedClearanceAgentId)) return
    setValue('clearance_agent_id', '')
    setValue('clearance_agent_rate_id', '')
  }, [open, clearanceAgentOptions, selectedClearanceAgentId, setValue])

  useEffect(() => {
    if (!open) return
    if (!selectedClearanceRateId || clearanceRateOptions.some(r => r.value === selectedClearanceRateId)) return
    setValue('clearance_agent_rate_id', '')
  }, [open, clearanceRateOptions, selectedClearanceRateId, setValue])

  useEffect(() => {
    if (!open) return
    const extractedRows = initial?.extracted_goods?.goods?.map(item => ({
      product_id: item.product_id != null ? String(item.product_id) : '',
      description: item.description ?? '',
      cartons: item.cartons != null ? String(item.cartons) : '',
      quantity: item.quantity != null ? String(item.quantity) : '',
      gross_weight_kg: item.gross_weight_kg != null ? String(item.gross_weight_kg) : '',
      cbm: item.cbm != null ? String(item.cbm) : '',
      hs_code: item.hs_code ?? '',
    })) ?? []
    setGoodsRows(extractedRows)
    if (initial) {
      reset({
        client_id:        String(initial.client.id),
        invoice_id:       initial.invoice_id != null ? String(initial.invoice_id) : '',
        goods_source:     initial.goods_source ?? 'client_ready_goods',
        is_full_container_client: initial.is_full_container_client ?? false,
        description:      initial.extracted_goods?.goods?.length && initial.description?.trim().startsWith('1.') ? '' : (initial.description ?? ''),
        description_ar:   initial.description_ar   ?? '',
        hs_code:          initial.hs_code           ?? '',
        shipping_marks:   initial.shipping_marks    ?? '',
        cartons:          initial.cartons           != null ? String(initial.cartons)           : '',
        gross_weight_kg:  initial.gross_weight_kg   != null ? String(initial.gross_weight_kg)   : '',
        net_weight_kg:    initial.net_weight_kg     != null ? String(initial.net_weight_kg)     : '',
        cbm:              initial.cbm               != null ? String(initial.cbm)               : '',
        carton_length_cm: initial.carton_length_cm  != null ? String(initial.carton_length_cm)  : '',
        carton_width_cm:  initial.carton_width_cm   != null ? String(initial.carton_width_cm)   : '',
        carton_height_cm: initial.carton_height_cm  != null ? String(initial.carton_height_cm)  : '',
        clearance_through_us: initial.clearance_through_us === false ? 'manual' : 'us',
        clearance_agent_id: initial.clearance_agent_id != null ? String(initial.clearance_agent_id) : '',
        clearance_agent_rate_id: initial.clearance_agent_rate_id != null ? String(initial.clearance_agent_rate_id) : '',
        manual_clearance_agent_name: initial.manual_clearance_agent_name ?? '',
        manual_clearance_agent_phone: initial.manual_clearance_agent_phone ?? '',
        manual_clearance_agent_notes: initial.manual_clearance_agent_notes ?? '',
        notes:            initial.notes             ?? '',
      })
    } else {
      reset({
        client_id:'', invoice_id:'', goods_source:'client_ready_goods', is_full_container_client:false,
        description:'', description_ar:'', hs_code:'', shipping_marks:'',
        cartons:'', gross_weight_kg:'', net_weight_kg:'', cbm:'',
        carton_length_cm:'', carton_width_cm:'', carton_height_cm:'',
        clearance_through_us:'us', clearance_agent_id:'',
        clearance_agent_rate_id:'', manual_clearance_agent_name:'',
        manual_clearance_agent_phone:'', manual_clearance_agent_notes:'', notes:'',
      })
    }
  }, [open, initial, reset])

  // Auto-calculate volumetric weight for AIR
  const cartons  = watch('cartons')
  const len      = watch('carton_length_cm')
  const wid      = watch('carton_width_cm')
  const hgt      = watch('carton_height_cm')

  useEffect(() => {
    if (mode !== 'AIR') return
    const c = parseFloat(cartons)
    const l = parseFloat(len)
    const w = parseFloat(wid)
    const h = parseFloat(hgt)
    if (c > 0 && l > 0 && w > 0 && h > 0) {
      const vol = (l * w * h * c) / 6000
      setValue('cbm', vol.toFixed(3))
    }
  }, [cartons, len, wid, hgt, mode, setValue])

  function toNum(v: string) { const n = parseFloat(v); return isNaN(n) ? null : n }
  function toInt(v: string) { const n = parseInt(v); return isNaN(n) ? null : n }
  function sumRows(rows: GoodsRow[], field: keyof Pick<GoodsRow, 'cartons' | 'gross_weight_kg' | 'cbm'>, decimals = 3) {
    const total = rows.reduce((sum, row) => sum + (parseFloat(row[field]) || 0), 0)
    if (!total) return ''
    return field === 'cartons' ? String(Math.round(total)) : total.toFixed(decimals)
  }
  function updateGoodsRow(index: number, field: keyof GoodsRow, value: string) {
    setGoodsRows(rows => rows.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }
  function addGoodsRow() {
    setGoodsRows(rows => [...rows, { product_id: '', description: '', cartons: '', quantity: '', gross_weight_kg: '', cbm: '', hs_code: '' }])
  }
  function removeGoodsRow(index: number) {
    setGoodsRows(rows => rows.filter((_, i) => i !== index))
  }

  async function handleFormSubmit(vals: FormValues) {
    const cleanedGoods = goodsRows
      .map(row => ({
        product_id: toInt(row.product_id),
        description: row.description.trim(),
        cartons: toInt(row.cartons),
        quantity: toInt(row.quantity),
        gross_weight_kg: toNum(row.gross_weight_kg),
        cbm: toNum(row.cbm),
        hs_code: row.hs_code.trim() || null,
        source: selectedInvoiceId ? 'linked_invoice' : (initial?.extracted_goods?.goods?.length ? 'document_or_manual' : 'manual'),
      }))
      .filter(row => row.description || row.cartons != null || row.quantity != null || row.gross_weight_kg != null || row.cbm != null || row.hs_code)
    await onSubmit({
      client_id:          parseInt(vals.client_id),
      invoice_id:         vals.invoice_id ? parseInt(vals.invoice_id) : null,
      goods_source:       vals.goods_source || 'client_ready_goods',
      is_full_container_client: Boolean(vals.is_full_container_client),
      description:        vals.description      || null,
      description_ar:     vals.description_ar   || null,
      hs_code:            vals.hs_code           || null,
      shipping_marks:     vals.shipping_marks    || null,
      cartons:            toInt(vals.cartons),
      gross_weight_kg:    toNum(vals.gross_weight_kg),
      net_weight_kg:      toNum(vals.net_weight_kg),
      cbm:                toNum(vals.cbm),
      carton_length_cm:   toNum(vals.carton_length_cm),
      carton_width_cm:    toNum(vals.carton_width_cm),
      carton_height_cm:   toNum(vals.carton_height_cm),
      clearance_through_us: vals.clearance_through_us !== 'manual',
      clearance_agent_id: vals.clearance_through_us !== 'manual' && vals.clearance_agent_id ? parseInt(vals.clearance_agent_id) : null,
      clearance_agent_rate_id: vals.clearance_through_us !== 'manual' && vals.clearance_agent_rate_id ? parseInt(vals.clearance_agent_rate_id) : null,
      manual_clearance_agent_name: vals.clearance_through_us === 'manual' ? (vals.manual_clearance_agent_name || null) : null,
      manual_clearance_agent_phone: vals.clearance_through_us === 'manual' ? (vals.manual_clearance_agent_phone || null) : null,
      manual_clearance_agent_notes: vals.clearance_through_us === 'manual' ? (vals.manual_clearance_agent_notes || null) : null,
      notes:              vals.notes || null,
      extracted_goods: cleanedGoods.length
        ? {
            ...(initial?.extracted_goods ?? {}),
            version: 1,
            updated_at: new Date().toISOString(),
            invoice_id: vals.invoice_id ? parseInt(vals.invoice_id) : null,
            invoice_number: selectedInvoice?.invoice_number ?? initial?.invoice_number ?? null,
            goods: cleanedGoods,
          }
        : null,
    })
  }

  function importSelectedInvoiceGoods() {
    if (!selectedInvoice) return
    const rows = (selectedInvoice.items ?? []).map(item => ({
      product_id: item.product_id != null ? String(item.product_id) : '',
      description: item.description ?? '',
      cartons: item.cartons != null ? String(item.cartons) : '',
      quantity: item.quantity != null ? String(item.quantity) : '',
      gross_weight_kg: item.gross_weight != null ? String(item.gross_weight) : '',
      cbm: item.cbm != null ? String(item.cbm) : '',
      hs_code: item.hs_code ?? '',
    }))
    setGoodsRows(rows)
    setValue('goods_source', 'company_buying_service')
    setValue('cartons', sumRows(rows, 'cartons'))
    setValue('gross_weight_kg', sumRows(rows, 'gross_weight_kg'))
    setValue('cbm', sumRows(rows, 'cbm', 4))
    const hsCodes = Array.from(new Set(rows.map(row => row.hs_code.trim()).filter(Boolean)))
    setValue('hs_code', hsCodes.length === 1 ? hsCodes[0] : '')
    if (!watch('description')) {
      setValue('description', rows.map((row, idx) => `${idx + 1}. ${row.description}`).filter(Boolean).join('\n'))
    }
  }

  const title = initial ? t('bookings.edit_cargo') : t('bookings.add_client_cargo')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit(handleFormSubmit)} loading={saving} disabled={capacityExceeded}>
            {initial ? t('common.update') : t('common.add')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {errorMessage && (
          <div className="rounded-lg border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-xs text-brand-red">
            {errorMessage}
          </div>
        )}
        {/* Destination badge */}
        {bookingDest && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
            bookingDest === 'jordan'
              ? 'bg-blue-500/8 border-blue-500/20 text-blue-400'
              : 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400'
          }`}>
            <span className="text-base">{bookingDest === 'jordan' ? '🇯🇴' : '🇮🇶'}</span>
            <span>
              {isAr
                ? `هذه الحاوية متجهة إلى ${bookingDest === 'jordan' ? 'الأردن' : 'العراق'} — يظهر فقط العملاء المطابقون`
                : `Container destined for ${bookingDest === 'jordan' ? 'Jordan' : 'Iraq'} — only matching clients shown`}
            </span>
          </div>
        )}
        {mode === 'LCL' && remainingCbm != null && (
          <div className={`rounded-lg border px-3 py-2 text-xs ${
            capacityExceeded
              ? 'border-brand-red/30 bg-brand-red/10 text-brand-red'
              : fillWarning
                ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                : 'border-brand-border bg-white/[0.03] text-brand-text-muted'
          }`}>
            {capacityExceeded
              ? (isAr
                ? `لا يمكن إضافة هذه البضاعة. المتبقي ${remainingCbm.toFixed(3)} CBM والمطلوب ${enteredCbm.toFixed(3)} CBM.`
                : `Cannot add this cargo. Remaining capacity is ${remainingCbm.toFixed(3)} CBM and this cargo needs ${enteredCbm.toFixed(3)} CBM.`)
              : (isAr
                ? `المتبقي في الحاوية: ${remainingCbm.toFixed(3)} CBM${fillWarning ? ' — الحاوية وصلت 90% أو أكثر.' : ''}`
                : `Remaining container capacity: ${remainingCbm.toFixed(3)} CBM${fillWarning ? ' — container is at 90% or more.' : ''}`)}
          </div>
        )}

        {/* Client */}
        <FormSection title={t('bookings.cargo_lines')}>
          <Select
            label={t('invoices.client')}
            options={clientOptions}
            placeholder={clientOptions.length === 0
              ? (isAr ? 'لا يوجد عملاء مطابقون' : 'No matching clients')
              : t('clients.select')}
            error={errors.client_id?.message}
            disabled={!!initial}
            {...register('client_id', { required: t('common.required') })}
          />
          <Select
            label={isAr ? 'الفاتورة المرتبطة' : 'Linked Invoice'}
            options={invoiceOptions}
            placeholder={invoiceOptions.length
              ? (isAr ? 'اختياري: اختر فاتورة العميل' : 'Optional: select client invoice')
              : (isAr ? 'لا توجد فواتير مطابقة' : 'No matching invoices')}
            {...register('invoice_id')}
          />
          <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-border bg-white/[0.02] px-3 py-2">
            <div>
              <p className="text-xs font-semibold text-brand-text">
                {isAr ? 'استيراد بنود الفاتورة' : 'Import invoice items'}
              </p>
              <p className="text-[11px] text-brand-text-muted">
                {isAr
                  ? 'ينقل الأصناف والكميات والكراتين والوزن إلى قائمة البضاعة.'
                  : 'Copies items, quantities, cartons, weights, and HS codes into the goods list.'}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={importSelectedInvoiceGoods}
              disabled={!selectedInvoice}
            >
              {isAr ? 'استيراد' : 'Import'}
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label={isAr ? 'مصدر البضاعة' : 'Goods Source'}
              options={[
                { value: 'client_ready_goods', label: isAr ? 'بضاعة جاهزة من العميل' : 'Client ready goods' },
                { value: 'company_buying_service', label: isAr ? 'خدمة شراء عن طريق شركتنا' : 'Company buying service' },
              ]}
              {...register('goods_source')}
            />
            <label className="flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 text-sm text-brand-text-muted">
              <input
                type="checkbox"
                className="accent-brand-primary"
                disabled={cannotMarkFull}
                {...register('is_full_container_client')}
              />
              <span>
                {isAr ? 'هذا العميل حجز الحاوية كاملة' : 'Full container for this client'}
                {mode === 'LCL' && (
                  <span className="block text-[11px] text-brand-text-muted mt-0.5">
                    {isAr
                      ? 'عند الحفظ ستتحول الحاوية إلى FCL برقم جديد ولا يمكن إضافة عملاء آخرين.'
                      : 'Saving this will convert the container to FCL with a new number and no more clients can be added.'}
                  </span>
                )}
                {cannotMarkFull && (
                  <span className="block text-[11px] text-brand-red mt-0.5">
                    {isAr ? 'يجب أن يكون هذا العميل وحده داخل الحاوية.' : 'This client must be the only cargo line in the container.'}
                  </span>
                )}
              </span>
            </label>
          </div>
        </FormSection>

        <FormSection title={isAr ? 'التخليص الجمركي للعميل' : 'Client Customs Clearance'}>
          <div className="grid grid-cols-2 gap-2">
            <label className={`flex items-center justify-center px-3 py-2 rounded-lg border cursor-pointer text-xs font-medium transition-all ${
              clearanceThroughUs
                ? 'border-brand-primary bg-brand-primary/15 text-brand-primary-light'
                : 'border-brand-border text-brand-text-muted hover:border-brand-border-focus'
            }`}>
              <input type="radio" value="us" className="sr-only" {...register('clearance_through_us')} />
              {isAr ? 'التخليص عن طريقنا' : 'Clearance through us'}
            </label>
            <label className={`flex items-center justify-center px-3 py-2 rounded-lg border cursor-pointer text-xs font-medium transition-all ${
              !clearanceThroughUs
                ? 'border-brand-primary bg-brand-primary/15 text-brand-primary-light'
                : 'border-brand-border text-brand-text-muted hover:border-brand-border-focus'
            }`}>
              <input type="radio" value="manual" className="sr-only" {...register('clearance_through_us')} />
              {isAr ? 'وكيل خارجي / يدوي' : 'Outside agent / manual'}
            </label>
          </div>

          {clearanceThroughUs ? (
            <FormRow>
              <Select
                label={isAr ? 'وكيل التخليص' : 'Clearance Agent'}
                options={clearanceAgentOptions}
                placeholder={clearanceAgentOptions.length
                  ? (isAr ? 'اختر وكيل التخليص' : 'Select clearance agent')
                  : (bookingDest
                    ? (isAr ? `لا يوجد وكلاء تخليص لـ ${DEST_LABEL_AR[bookingDest] ?? bookingDest}` : `No clearance agents for ${DEST_LABEL[bookingDest] ?? bookingDest}`)
                    : (isAr ? 'لا يوجد وكلاء تخليص' : 'No clearance agents'))}
                {...register('clearance_agent_id')}
              />
              <Select
                label={isAr ? 'سعر التخليص' : 'Clearance Rate'}
                options={clearanceRateOptions}
                placeholder={clearanceRateOptions.length ? '—' : (isAr ? 'لا توجد أسعار مطابقة للحجم/الناقل' : 'No matching rate for this size/carrier')}
                {...register('clearance_agent_rate_id')}
              />
            </FormRow>
          ) : (
            <>
              <FormRow>
                <Input label={isAr ? 'اسم وكيل التخليص الخارجي' : 'Outside Clearance Agent'} {...register('manual_clearance_agent_name')} />
                <Input label={t('common.phone')} {...register('manual_clearance_agent_phone')} />
              </FormRow>
              <Textarea
                label={isAr ? 'ملاحظات الوكيل الخارجي' : 'Outside Agent Notes'}
                rows={2}
                {...register('manual_clearance_agent_notes')}
              />
            </>
          )}
        </FormSection>

        <FormSection title={isAr ? 'قائمة البضاعة' : 'Goods List'}>
          {goodsRows.length ? (
            <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-brand-primary-light">
                  {initial?.extracted_goods?.goods?.length
                    ? (isAr ? 'قائمة البضاعة المستخرجة من الملفات' : 'Goods list extracted from files')
                    : (isAr ? 'قائمة البضاعة اليدوية' : 'Manual goods list')}
                </p>
                {initial?.extracted_goods?.confidence && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-brand-text-muted">
                    {initial.extracted_goods.confidence}
                  </span>
                )}
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border border-brand-border/50">
                <table className="min-w-[760px] w-full text-xs">
                  <thead className="bg-white/[0.04] text-brand-text-muted">
                    <tr>
                      <th className="px-2 py-1.5 text-start">#</th>
                      <th className="px-2 py-1.5 text-start">{isAr ? 'الوصف' : 'Description'}</th>
                      <th className="px-2 py-1.5 text-end">{isAr ? 'كراتين' : 'CTNS'}</th>
                      <th className="px-2 py-1.5 text-end">{isAr ? 'الكمية' : 'QTY'}</th>
                      <th className="px-2 py-1.5 text-end">{isAr ? 'الوزن' : 'KG'}</th>
                      <th className="px-2 py-1.5 text-end">CBM</th>
                      <th className="px-2 py-1.5 text-start">HS</th>
                      <th className="px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {goodsRows.map((item, idx) => (
                      <tr key={idx} className="border-t border-brand-border/40">
                        <td className="px-2 py-1.5 text-brand-text-muted">{idx + 1}</td>
                        <td className="px-2 py-1.5">
                          <input className="input-base h-8 text-xs" value={item.description} onChange={e => updateGoodsRow(idx, 'description', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="input-base h-8 text-xs text-end" type="number" value={item.cartons} onChange={e => updateGoodsRow(idx, 'cartons', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="input-base h-8 text-xs text-end" type="number" value={item.quantity} onChange={e => updateGoodsRow(idx, 'quantity', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="input-base h-8 text-xs text-end" type="number" value={item.gross_weight_kg} onChange={e => updateGoodsRow(idx, 'gross_weight_kg', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="input-base h-8 text-xs text-end" type="number" value={item.cbm} onChange={e => updateGoodsRow(idx, 'cbm', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="input-base h-8 text-xs" value={item.hs_code} onChange={e => updateGoodsRow(idx, 'hs_code', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button type="button" className="text-brand-red hover:underline" onClick={() => removeGoodsRow(idx)}>
                            {isAr ? 'حذف' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-brand-text-muted">
                  {isAr
                    ? 'هذه القائمة هي المرجع للتصدير لاحقاً. الحقول بالأسفل ملاحظات عامة فقط.'
                    : 'This list is the export reference later. The fields below are only general notes.'}
                </p>
                <button type="button" className="text-xs font-semibold text-brand-primary-light hover:underline" onClick={addGoodsRow}>
                  {isAr ? '+ إضافة بند' : '+ Add item'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="rounded-lg border border-dashed border-brand-border px-3 py-2 text-xs text-brand-text-muted hover:border-brand-primary hover:text-brand-primary" onClick={addGoodsRow}>
              {isAr ? '+ إضافة قائمة بضاعة يدوياً' : '+ Add manual goods list'}
            </button>
          )}
        </FormSection>

        {/* Description */}
        <FormSection title={isAr ? 'ملاحظات وصف البضاعة' : t('bookings.description')}>
          <FormRow>
            <Input label={t('common.english')}    {...register('description')} />
            <Input label={t('common.arabic')} dir="rtl" {...register('description_ar')} />
          </FormRow>
          <FormRow>
            <Input label={t('bookings.hs_code')}        {...register('hs_code')} />
            <Input label={t('bookings.shipping_marks')} {...register('shipping_marks')} />
          </FormRow>
        </FormSection>

        {/* Quantities */}
        <FormSection title={t('bookings.packing_list')}>
          <FormRow cols={3}>
            <Input label={t('bookings.cartons')}      type="number" step="1"    min="0" {...register('cartons')} />
            <Input label={t('bookings.gross_weight')} type="number" step="0.01" min="0" {...register('gross_weight_kg')} />
            <Input label={t('bookings.net_weight')}   type="number" step="0.01" min="0" {...register('net_weight_kg')} />
          </FormRow>
          {mode !== 'AIR' && (
            <Input label={t('bookings.cbm_label')} type="number" step="0.001" min="0" {...register('cbm')} />
          )}
        </FormSection>

        {/* Air dims */}
        {mode === 'AIR' && (
          <FormSection title={t('bookings.air_dims')}>
            <FormRow cols={3}>
              <Input label="L (cm)" type="number" step="0.1" min="0" {...register('carton_length_cm')} />
              <Input label="W (cm)" type="number" step="0.1" min="0" {...register('carton_width_cm')} />
              <Input label="H (cm)" type="number" step="0.1" min="0" {...register('carton_height_cm')} />
            </FormRow>
            <Input
              label={t('bookings.volumetric_weight')}
              type="number" step="0.001" min="0"
              hint="L×W×H×Cartons / 6000"
              {...register('cbm')}
            />
          </FormSection>
        )}

        <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-emerald-300/80">
            {t('bookings.freight_share')}
          </p>
          <p className="mt-1 text-lg font-bold font-mono text-emerald-300">
            {initial?.freight_share != null ? `$${Number(initial.freight_share).toFixed(2)}` : '—'}
          </p>
          <p className="mt-1 text-[11px] text-brand-text-muted">
            {isAr
              ? 'يحسب تلقائياً من سعر البيع حسب CBM أو الوزن أو سعر الحاوية.'
              : 'Auto-calculated from your selling freight by CBM, weight, or container price.'}
          </p>
        </div>

        <Textarea label={t('common.notes')} rows={2} {...register('notes')} />
      </div>
    </Modal>
  )
}
