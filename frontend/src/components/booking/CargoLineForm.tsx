import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { getEligibleClients } from '@/services/bookingService'
import { getClearanceAgents } from '@/services/agentService'
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

function clearanceMode(mode: BookingMode) {
  return mode === 'AIR' ? 'air' : 'sea'
}

interface FormValues {
  client_id:          string
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
  freight_share:      string
  clearance_through_us: string
  clearance_agent_id: string
  clearance_agent_rate_id: string
  manual_clearance_agent_name: string
  manual_clearance_agent_phone: string
  manual_clearance_agent_notes: string
  notes:              string
}

interface Props {
  open:        boolean
  onClose:     () => void
  onSubmit:    (data: Record<string, unknown>) => Promise<void>
  mode:        BookingMode
  bookingId:   number
  initial?:    BookingCargoLine | null
  saving?:     boolean
}

export default function CargoLineForm({ open, onClose, onSubmit, mode, bookingId, initial, saving }: Props) {
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

  const bookingDest = eligibleData?.booking_destination ?? null

  const clientOptions = useMemo(() => {
    const clients = eligibleData?.results ?? []
    return clients.map(c => ({
      value: String(c.id),
      label: `${c.client_code} — ${isAr && c.name_ar ? c.name_ar : c.name}${c.destination ? ` (${isAr ? DEST_LABEL_AR[c.destination] : DEST_LABEL[c.destination]})` : ''}`,
    }))
  }, [eligibleData, isAr])

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>()
  const clearanceThroughUs = watch('clearance_through_us') !== 'manual'
  const selectedClearanceAgentId = watch('clearance_agent_id')
  const selectedClearanceRateId = watch('clearance_agent_rate_id')

  const clearanceAgentOptions = useMemo(() => {
    const destination = normalizeCountry(bookingDest)
    return (clearanceAgentsData?.results ?? [])
      .filter(a => !destination || normalizeCountry(a.country) === destination)
      .map(a => ({
      value: String(a.id),
      label: `${isAr && a.name_ar ? a.name_ar : a.name}${a.country ? ` — ${a.country}` : ''}`,
    }))
  }, [clearanceAgentsData, bookingDest, isAr])

  const clearanceRateOptions = useMemo(() => {
    const destination = normalizeCountry(bookingDest)
    const expectedMode = clearanceMode(mode)
    const agent = (clearanceAgentsData?.results ?? []).find(a => String(a.id) === selectedClearanceAgentId)
    return (agent?.rates ?? [])
      .filter(r => (!destination || normalizeCountry(r.country) === destination) && (!r.service_mode || r.service_mode === expectedMode))
      .map(r => ({
      value: String(r.id),
      label: [
        r.service_mode?.toUpperCase(),
        r.country,
        r.port,
        r.container_size,
        r.carrier_name,
        r.route,
      ].filter(Boolean).join(' · '),
    }))
  }, [clearanceAgentsData, selectedClearanceAgentId, bookingDest, mode])

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
    if (initial) {
      reset({
        client_id:        String(initial.client.id),
        description:      initial.description      ?? '',
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
        freight_share:    initial.freight_share     != null ? String(initial.freight_share)     : '',
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
        client_id:'', description:'', description_ar:'', hs_code:'', shipping_marks:'',
        cartons:'', gross_weight_kg:'', net_weight_kg:'', cbm:'',
        carton_length_cm:'', carton_width_cm:'', carton_height_cm:'',
        freight_share:'', clearance_through_us:'us', clearance_agent_id:'',
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

  async function handleFormSubmit(vals: FormValues) {
    await onSubmit({
      client_id:          parseInt(vals.client_id),
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
      freight_share:      toNum(vals.freight_share),
      clearance_through_us: vals.clearance_through_us !== 'manual',
      clearance_agent_id: vals.clearance_through_us !== 'manual' && vals.clearance_agent_id ? parseInt(vals.clearance_agent_id) : null,
      clearance_agent_rate_id: vals.clearance_through_us !== 'manual' && vals.clearance_agent_rate_id ? parseInt(vals.clearance_agent_rate_id) : null,
      manual_clearance_agent_name: vals.clearance_through_us === 'manual' ? (vals.manual_clearance_agent_name || null) : null,
      manual_clearance_agent_phone: vals.clearance_through_us === 'manual' ? (vals.manual_clearance_agent_phone || null) : null,
      manual_clearance_agent_notes: vals.clearance_through_us === 'manual' ? (vals.manual_clearance_agent_notes || null) : null,
      notes:              vals.notes || null,
    })
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
          <Button onClick={handleSubmit(handleFormSubmit)} loading={saving}>
            {initial ? t('common.update') : t('common.add')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
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
                placeholder={clearanceRateOptions.length ? '—' : (isAr ? 'لا توجد أسعار لهذا الوكيل' : 'No rates for this agent')}
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

        {/* Description */}
        <FormSection title={t('bookings.description')}>
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

        {/* Freight share */}
        <FormRow>
          <Input
            label={t('bookings.freight_share')}
            type="number" step="0.01" min="0"
            {...register('freight_share')}
          />
          <Textarea label={t('common.notes')} rows={2} {...register('notes')} />
        </FormRow>
      </div>
    </Modal>
  )
}
