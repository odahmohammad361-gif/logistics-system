import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { getAgents, getAgentCarrierRates } from '@/services/agentService'
import { Input, Select, Textarea, FormRow, FormSection } from '@/components/ui/Form'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import clsx from 'clsx'
import type { Booking, BookingMode, BookingStatus, AgentCarrierRate } from '@/types'
import { getFlatPortOptions } from '@/constants/logistics'

const SEA_PORT_OPTIONS = getFlatPortOptions('sea')
const AIR_PORT_OPTIONS = getFlatPortOptions('air')

const SEA_CARRIERS = [
  'CMA CGM', 'MSC', 'Evergreen', 'PIL', 'COSCO', 'Yang Ming',
  'Hapag-Lloyd', 'ONE', 'HMM', 'ZIM', 'OOCL', 'Maersk',
]
const AIR_CARRIERS = [
  'Emirates SkyCargo', 'Qatar Airways Cargo', 'Turkish Cargo',
  'Flydubai Cargo', 'Air Arabia Cargo', 'China Southern Cargo',
  'Air China Cargo', 'Cargolux',
]

const CONTAINER_CBM_DEFAULTS: Record<string, number> = {
  '20GP': 28,
  '40GP': 57,
  '40HQ': 72,
}

interface FormValues {
  mode:               BookingMode
  status:             BookingStatus
  is_direct_booking:  boolean
  agent_id:           string
  carrier_name:       string
  container_size:     string
  container_no:       string
  seal_no:            string
  bl_number:          string
  awb_number:         string
  vessel_name:        string
  voyage_number:      string
  flight_number:      string
  port_of_loading:    string
  port_of_discharge:  string
  etd:                string
  eta:                string
  incoterm:           string
  freight_cost:       string
  currency:           string
  max_cbm:            string
  markup_pct:         string
  notes:              string
}

interface Props {
  open:     boolean
  onClose:  () => void
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  initial?: Booking | null
  saving?:  boolean
}

const MODES: BookingMode[] = ['LCL', 'FCL', 'AIR']
const STATUSES: BookingStatus[] = ['draft', 'confirmed', 'in_transit', 'arrived', 'delivered', 'cancelled']
const CONTAINER_SIZES = ['20GP', '40GP', '40HQ']
const INCOTERMS = ['EXW', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP', 'FCA', 'CPT', 'CIP', 'DPU']
const CURRENCIES = ['USD', 'CNY', 'JOD', 'IQD', 'EUR']

export default function BookingForm({ open, onClose, onSubmit, initial, saving }: Props) {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'

  const { data: agentsData } = useQuery({
    queryKey: ['agents-all'],
    queryFn:  () => getAgents({ page: 1, page_size: 200 }),
    enabled:  open,
  })

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: { mode: 'FCL', status: 'draft', currency: 'USD', is_direct_booking: false, markup_pct: '0' },
  })

  const mode          = watch('mode')
  const isDirect      = watch('is_direct_booking')
  const agentId       = watch('agent_id')
  const containerSize = watch('container_size')
  const freightCost   = watch('freight_cost')
  const maxCbm        = watch('max_cbm')
  const markupPct     = watch('markup_pct')
  const portDischarge = watch('port_of_discharge')

  // Load carrier rates when an agent is selected
  const { data: carrierRates } = useQuery<AgentCarrierRate[]>({
    queryKey: ['agent-carrier-rates', agentId],
    queryFn:  () => getAgentCarrierRates(Number(agentId)),
    enabled:  !!agentId && !isDirect && mode !== 'AIR',
  })

  // When a carrier is selected from agent rates, auto-fill POL/POD/freight/size
  function applyCarrierRate(carrierName: string) {
    const rate = (carrierRates ?? []).find(r => r.carrier_name === carrierName)
    if (!rate) return
    if (rate.pol) setValue('port_of_loading', rate.pol)
    if (rate.pod) setValue('port_of_discharge', rate.pod)
    // Determine available sizes and pick the sell price
    // Priority: 40HQ > 40GP > 20GP (pick whichever exists)
    if (rate.sell_40hq != null) {
      setValue('container_size', '40HQ')
      setValue('freight_cost', String(rate.sell_40hq))
    } else if (rate.sell_40ft != null) {
      setValue('container_size', '40GP')
      setValue('freight_cost', String(rate.sell_40ft))
    } else if (rate.sell_20gp != null) {
      setValue('container_size', '20GP')
      setValue('freight_cost', String(rate.sell_20gp))
    }
    setValue('carrier_name', carrierName)
  }

  // Detect destination from port of discharge
  const JORDAN_KW = ['jordan', 'aqaba', 'amman', 'zarqa', 'irbid']
  const IRAQ_KW   = ['iraq', 'basra', 'umm qasr', 'baghdad', 'erbil', 'mosul']
  const detectedDest = (() => {
    if (!portDischarge) return null
    const p = portDischarge.toLowerCase()
    if (JORDAN_KW.some(kw => p.includes(kw))) return 'jordan'
    if (IRAQ_KW.some(kw => p.includes(kw)))   return 'iraq'
    return null
  })()

  // Auto-fill max_cbm when container size changes
  useEffect(() => {
    if (containerSize && CONTAINER_CBM_DEFAULTS[containerSize] && !initial?.max_cbm) {
      setValue('max_cbm', String(CONTAINER_CBM_DEFAULTS[containerSize]))
    }
  }, [containerSize, setValue, initial])

  const agentOptions = useMemo(() => {
    const all = agentsData?.results ?? []
    const filtered = mode === 'AIR'
      ? all.filter(a => a.serves_air)
      : all.filter(a => a.serves_sea)
    return filtered.map(a => ({ value: String(a.id), label: a.name }))
  }, [agentsData, mode])

  // Build carrier options from agent's rates (if loaded), otherwise fall back to static list
  const carrierOptionsFromAgent = useMemo(() => {
    if (!carrierRates || carrierRates.length === 0) return null
    return carrierRates.map(r => ({
      value: r.carrier_name,
      label: `${r.carrier_name}${r.pol && r.pod ? ` (${r.pol} → ${r.pod})` : ''}`,
    }))
  }, [carrierRates])

  // Container sizes available for selected carrier
  const sizeOptionsForCarrier = useMemo(() => {
    const watchedCarrier = watch('carrier_name')
    if (!carrierRates || !watchedCarrier) return CONTAINER_SIZES.map(s => ({ value: s, label: s }))
    const rate = carrierRates.find(r => r.carrier_name === watchedCarrier)
    if (!rate) return CONTAINER_SIZES.map(s => ({ value: s, label: s }))
    const available: string[] = []
    if (rate.sell_20gp != null) available.push('20GP')
    if (rate.sell_40ft != null) available.push('40GP')
    if (rate.sell_40hq != null) available.push('40HQ')
    return available.length ? available.map(s => ({ value: s, label: s })) : CONTAINER_SIZES.map(s => ({ value: s, label: s }))
  }, [carrierRates, watch('carrier_name')])

  const statusOptions        = STATUSES.map(s => ({ value: s, label: t(`bookings.status_${s}`) }))
  const containerSizeOptions = sizeOptionsForCarrier
  const incotermOptions      = INCOTERMS.map(i => ({ value: i, label: i }))
  const currencyOptions      = CURRENCIES.map(c => ({ value: c, label: c }))
  const carrierOptions       = carrierOptionsFromAgent
    ?? (mode === 'AIR' ? AIR_CARRIERS : SEA_CARRIERS).map(c => ({ value: c, label: c }))

  // Live price calculations
  const freight  = parseFloat(freightCost) || 0
  const cbmCap   = parseFloat(maxCbm)      || 0
  const markup   = parseFloat(markupPct)   || 0
  const buyingPerCbm  = cbmCap > 0 ? freight / cbmCap : 0
  const sellingPerCbm = buyingPerCbm * (1 + markup / 100)

  useEffect(() => {
    if (!open) return
    if (initial) {
      reset({
        mode:              initial.mode,
        status:            initial.status,
        is_direct_booking: initial.is_direct_booking ?? false,
        agent_id:          initial.agent ? String(initial.agent.id) : '',
        carrier_name:      initial.carrier_name     ?? '',
        container_size:    initial.container_size   ?? '',
        container_no:      initial.container_no     ?? '',
        seal_no:           initial.seal_no          ?? '',
        bl_number:         initial.bl_number        ?? '',
        awb_number:        initial.awb_number       ?? '',
        vessel_name:       initial.vessel_name      ?? '',
        voyage_number:     initial.voyage_number    ?? '',
        flight_number:     initial.flight_number    ?? '',
        port_of_loading:   initial.port_of_loading  ?? '',
        port_of_discharge: initial.port_of_discharge ?? '',
        etd:               initial.etd              ?? '',
        eta:               initial.eta              ?? '',
        incoterm:          initial.incoterm         ?? '',
        freight_cost:      initial.freight_cost != null ? String(initial.freight_cost) : '',
        currency:          initial.currency         ?? 'USD',
        max_cbm:           initial.max_cbm != null  ? String(initial.max_cbm) : '',
        markup_pct:        initial.markup_pct != null ? String(initial.markup_pct) : '0',
        notes:             initial.notes            ?? '',
      })
    } else {
      reset({ mode: 'FCL', status: 'draft', currency: 'USD', is_direct_booking: false, markup_pct: '0' })
    }
  }, [open, initial, reset])

  useEffect(() => {
    if (isDirect) setValue('agent_id', '')
  }, [isDirect, setValue])

  function toNum(v: string) { const n = parseFloat(v); return isNaN(n) ? null : n }

  async function handleFormSubmit(vals: FormValues) {
    await onSubmit({
      mode:               vals.mode,
      status:             vals.status,
      is_direct_booking:  vals.is_direct_booking,
      shipping_agent_id:  (!vals.is_direct_booking && vals.agent_id) ? parseInt(vals.agent_id) : null,
      carrier_name:       vals.carrier_name    || null,
      container_size:     (vals.mode !== 'AIR' && vals.container_size) ? vals.container_size : null,
      container_no:       vals.container_no    || null,
      seal_no:            vals.seal_no         || null,
      bl_number:          vals.bl_number       || null,
      awb_number:         vals.awb_number      || null,
      vessel_name:        vals.vessel_name     || null,
      voyage_number:      vals.voyage_number   || null,
      flight_number:      vals.flight_number   || null,
      port_of_loading:    vals.port_of_loading || null,
      port_of_discharge:  vals.port_of_discharge || null,
      etd:                vals.etd             || null,
      eta:                vals.eta             || null,
      incoterm:           vals.incoterm        || null,
      freight_cost:       toNum(vals.freight_cost),
      currency:           vals.currency        || 'USD',
      max_cbm:            toNum(vals.max_cbm),
      markup_pct:         toNum(vals.markup_pct),
      notes:              vals.notes           || null,
    })
  }

  const modeLabels: Record<BookingMode, string> = {
    LCL: t('bookings.mode_lcl'),
    FCL: t('bookings.mode_fcl'),
    AIR: t('bookings.mode_air'),
  }

  const title = isAr
    ? (initial ? 'تعديل الحاوية' : 'انشاء حاوية')
    : (initial ? t('bookings.edit') : 'Open Container')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit(handleFormSubmit)} loading={saving}>
            {initial ? t('common.update') : (isAr ? 'انشاء الحاوية' : 'Open Container')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">

        {/* Mode */}
        <FormSection title={t('bookings.booking_info')}>
          <div className="flex gap-2">
            {MODES.map(m => (
              <label key={m} className={clsx(
                'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all text-sm font-medium',
                watch('mode') === m
                  ? 'border-brand-primary bg-brand-primary/15 text-brand-primary-light'
                  : 'border-brand-border text-brand-text-muted hover:border-brand-border-focus',
              )}>
                <input type="radio" value={m} className="sr-only" {...register('mode')} />
                {modeLabels[m]}
              </label>
            ))}
          </div>

          <FormRow>
            <Select label={t('common.status')} options={statusOptions} {...register('status')} />
            <div className="space-y-1.5">
              <label className="label-base">{t('bookings.booking_type')}</label>
              <div className="flex gap-2">
                {[false, true].map(direct => (
                  <label key={String(direct)} className={clsx(
                    'flex-1 flex items-center justify-center px-3 py-2 rounded-lg border cursor-pointer text-xs font-medium transition-all',
                    isDirect === direct
                      ? 'border-brand-primary bg-brand-primary/15 text-brand-primary-light'
                      : 'border-brand-border text-brand-text-muted hover:border-brand-border-focus',
                  )}>
                    <input type="radio" className="sr-only" value={String(direct)}
                      checked={isDirect === direct}
                      onChange={() => setValue('is_direct_booking', direct)} />
                    {direct ? t('bookings.direct_booking') : t('bookings.via_agent')}
                  </label>
                ))}
              </div>
            </div>
          </FormRow>

          {!isDirect && (
            <FormRow>
              <Select label={t('containers.agent')} options={agentOptions}
                placeholder={agentOptions.length === 0
                  ? (mode === 'AIR' ? t('bookings.no_air_agents') : t('bookings.no_sea_agents'))
                  : '—'
                }
                {...register('agent_id')} />
              <Select label={t('bookings.carrier_line')} options={carrierOptions}
                placeholder={carrierOptionsFromAgent ? (isAr ? 'اختر شركة الشحن...' : 'Select carrier...') : t('bookings.select_carrier')}
                {...register('carrier_name', {
                  onChange: (e) => { if (carrierOptionsFromAgent) applyCarrierRate(e.target.value) }
                })} />
            </FormRow>
          )}
          {isDirect && (
            <Select label={t('bookings.carrier_line')} options={carrierOptions}
              placeholder={t('bookings.select_carrier')} {...register('carrier_name')} />
          )}

          {mode !== 'AIR' && (
            <FormRow>
              <Select label={t('bookings.container_size')} options={containerSizeOptions}
                placeholder="—"
                {...register('container_size', {
                  onChange: (e) => {
                    // When size changes, update freight_cost from carrier rate sell price
                    const size = e.target.value
                    const watchedCarrier = watch('carrier_name')
                    const rate = (carrierRates ?? []).find(r => r.carrier_name === watchedCarrier)
                    if (rate) {
                      const price = size === '20GP' ? rate.sell_20gp : size === '40GP' ? rate.sell_40ft : size === '40HQ' ? rate.sell_40hq : null
                      if (price != null) setValue('freight_cost', String(price))
                    }
                  }
                })} />
              <Input
                label={isAr ? 'سعة الحاوية (CBM)' : 'Container Capacity (CBM)'}
                type="number" step="0.5" min="1"
                placeholder={containerSize ? String(CONTAINER_CBM_DEFAULTS[containerSize] ?? '') : '—'}
                {...register('max_cbm')}
              />
            </FormRow>
          )}
        </FormSection>

        {/* Routing */}
        <FormSection title={t('bookings.routing')}>
          {/* Destination auto-detection badge */}
          {detectedDest && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
              detectedDest === 'jordan'
                ? 'bg-blue-500/8 border-blue-500/20 text-blue-400'
                : 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400'
            }`}>
              <span className="text-base">{detectedDest === 'jordan' ? '🇯🇴' : '🇮🇶'}</span>
              <span>
                {isAr
                  ? `تم تحديد الوجهة تلقائياً: ${detectedDest === 'jordan' ? 'الأردن' : 'العراق'} — سيتم تصفية العملاء عند إضافة البضائع`
                  : `Destination detected: ${detectedDest === 'jordan' ? 'Jordan' : 'Iraq'} — clients will be filtered when adding cargo`}
              </span>
            </div>
          )}
          <FormRow>
            <Select
              label={t('bookings.port_loading')}
              options={mode === 'AIR' ? AIR_PORT_OPTIONS : SEA_PORT_OPTIONS}
              placeholder={isAr ? '— اختر ميناء الشحن —' : '— Select loading port —'}
              {...register('port_of_loading')}
            />
            <Select
              label={t('bookings.port_discharge')}
              options={mode === 'AIR' ? AIR_PORT_OPTIONS : SEA_PORT_OPTIONS}
              placeholder={isAr ? '— اختر ميناء التفريغ —' : '— Select discharge port —'}
              {...register('port_of_discharge')}
            />
          </FormRow>

          <FormRow>
            <Input label={t('bookings.etd')} type="date" {...register('etd')} />
            <Input label={t('bookings.eta')} type="date" {...register('eta')} />
          </FormRow>
          <FormRow>
            <Select label={t('bookings.incoterm')} options={incotermOptions} placeholder="—" {...register('incoterm')} />
            <Select label={t('common.currency')} options={currencyOptions} {...register('currency')} />
          </FormRow>
        </FormSection>

        {/* Pricing */}
        <FormSection title={isAr ? 'التسعير' : 'Pricing'}>
          <FormRow>
            <Input
              label={isAr ? 'سعر الوكيل (إجمالي)' : 'Agent Price (Total)'}
              type="number" step="0.01" min="0"
              {...register('freight_cost')}
            />
            <Input
              label={isAr ? 'نسبة الربح %' : 'Markup %'}
              type="number" step="0.1" min="0"
              {...register('markup_pct')}
            />
          </FormRow>

          {/* Live calculation preview */}
          {freight > 0 && cbmCap > 0 && (
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4">
              <div className="text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                  {isAr ? 'سعر الشراء / CBM' : 'Buying / CBM'}
                </p>
                <p className="text-base font-bold text-white">${buyingPerCbm.toFixed(2)}</p>
              </div>
              <div className="text-center border-x border-white/10">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                  {isAr ? 'نسبة الربح' : 'Markup'}
                </p>
                <p className="text-base font-bold text-yellow-400">+{markup}%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                  {isAr ? 'سعر البيع / CBM' : 'Selling / CBM'}
                </p>
                <p className="text-base font-bold text-green-400">${sellingPerCbm.toFixed(2)}</p>
              </div>
            </div>
          )}
        </FormSection>

        {/* References */}
        <FormSection title={t('bookings.transport_refs')}>
          {mode !== 'AIR' ? (
            <>
              <FormRow>
                <Input label={t('bookings.container_no')} {...register('container_no')} />
                <Input label={t('bookings.seal_no')}      {...register('seal_no')} />
              </FormRow>
              <FormRow>
                <Input label={t('bookings.bl_number')}   {...register('bl_number')} />
                <Input label={t('bookings.vessel_name')} {...register('vessel_name')} />
              </FormRow>
              <Input label={t('bookings.voyage_number')} {...register('voyage_number')} />
            </>
          ) : (
            <>
              <Input label={t('bookings.awb_number')}    {...register('awb_number')} />
              <Input label={t('bookings.flight_number')} {...register('flight_number')} />
            </>
          )}
        </FormSection>

        <Textarea label={t('common.notes')} {...register('notes')} />
      </div>
    </Modal>
  )
}
