import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { getAgents, getAgentCarrierRates } from '@/services/agentService'
import { Input, Select, Textarea, FormRow, FormSection } from '@/components/ui/Form'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import clsx from 'clsx'
import { Lock } from 'lucide-react'
import type { Booking, BookingMode, BookingStatus, AgentCarrierRate } from '@/types'
import { getFlatPortOptions, INCOTERM_LABELS, SHIPPING_TERMS } from '@/constants/logistics'

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
  agent_carrier_rate_id: string
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
function marginPct(buy: number | null | undefined, sell: number | null | undefined) {
  const b = Number(buy ?? 0)
  const s = Number(sell ?? 0)
  if (b <= 0 || s <= 0) return 0
  return ((s - b) / b) * 100
}

function setAgentDates(rate: AgentCarrierRate, setValue: ReturnType<typeof useForm<FormValues>>['setValue']) {
  if (rate.vessel_day) setValue('etd', rate.vessel_day)
}

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
  const agentRateId   = watch('agent_carrier_rate_id')
  const containerSize = watch('container_size')
  const freightCost   = watch('freight_cost')
  const maxCbm        = watch('max_cbm')
  const markupPct     = watch('markup_pct')
  const portDischarge = watch('port_of_discharge')

  // Load carrier rates when an agent is selected
  const { data: carrierRates } = useQuery<AgentCarrierRate[]>({
    queryKey: ['agent-carrier-rates', agentId],
    queryFn:  () => getAgentCarrierRates(Number(agentId)),
    enabled:  !!agentId && !isDirect,
  })

  // Track which fields were locked from agent
  const [lockedFromAgent, setLockedFromAgent] = useState(false)

  // Reset locking when agent changes or booking is direct
  useEffect(() => {
    if (!agentId || isDirect) {
      setLockedFromAgent(false)
      setValue('agent_carrier_rate_id', '')
    }
  }, [agentId, isDirect])

  const selectedRate = useMemo(() => {
    if (!carrierRates || !agentRateId) return null
    return carrierRates.find(r => String(r.id) === String(agentRateId)) ?? null
  }, [carrierRates, agentRateId])

  function priceFromRate(rate: AgentCarrierRate | null, size: string, modeNow: BookingMode) {
    if (!rate) return { buy: null as number | null, sell: null as number | null, capacity: null as number | null }
    if (modeNow === 'AIR') {
      return { buy: rate.buy_air_kg, sell: rate.sell_air_kg, capacity: null }
    }
    if (modeNow === 'LCL') {
      const lclMap: Record<string, { buy: number | null; sell: number | null; capacity: number | null }> = {
        '20GP': { buy: rate.buy_lcl_20gp ?? rate.buy_lcl_cbm ?? null, sell: rate.sell_lcl_20gp ?? rate.sell_lcl_cbm ?? null, capacity: rate.cbm_20gp ?? 28 },
        '40GP': { buy: rate.buy_lcl_40ft ?? rate.buy_lcl_cbm ?? null, sell: rate.sell_lcl_40ft ?? rate.sell_lcl_cbm ?? null, capacity: rate.cbm_40ft ?? 67 },
        '40HQ': { buy: rate.buy_lcl_40hq ?? rate.buy_lcl_cbm ?? null, sell: rate.sell_lcl_40hq ?? rate.sell_lcl_cbm ?? null, capacity: rate.cbm_40hq ?? 76 },
      }
      return lclMap[size] ?? { buy: null, sell: null, capacity: null }
    }
    const fclMap: Record<string, { buy: number | null; sell: number | null; capacity: number | null }> = {
      '20GP': { buy: rate.buy_20gp, sell: rate.sell_20gp, capacity: rate.cbm_20gp ?? 28 },
      '40GP': { buy: rate.buy_40ft, sell: rate.sell_40ft, capacity: rate.cbm_40ft ?? 67 },
      '40HQ': { buy: rate.buy_40hq, sell: rate.sell_40hq, capacity: rate.cbm_40hq ?? 76 },
    }
    return fclMap[size] ?? { buy: null, sell: null, capacity: null }
  }

  // When a carrier is selected from agent rates, auto-fill and lock fields
  function applyCarrierRate(rateId: string) {
    const rate = (carrierRates ?? []).find(r => String(r.id) === String(rateId))
    if (!rate) { setLockedFromAgent(false); return }
    if (rate.pol) setValue('port_of_loading', rate.pol)
    if (rate.pod) setValue('port_of_discharge', rate.pod)
    setAgentDates(rate, setValue)
    setValue('agent_carrier_rate_id', String(rate.id))
    setValue('carrier_name', rate.carrier_name)

    const hasFcl = rate.sell_20gp != null || rate.sell_40ft != null || rate.sell_40hq != null
    const hasLcl = rate.sell_lcl_cbm != null || rate.sell_lcl_20gp != null || rate.sell_lcl_40ft != null || rate.sell_lcl_40hq != null
    const modeNow = watch('mode')
    if (modeNow === 'AIR' && rate.sell_air_kg != null) {
      const p = priceFromRate(rate, '', 'AIR')
      if (p.buy != null) setValue('freight_cost', String(p.buy))
      setValue('markup_pct', String(marginPct(p.buy, p.sell).toFixed(2)))
    } else if (modeNow === 'LCL' && hasLcl) {
      const size = watch('container_size') || '40HQ'
      setValue('container_size', size)
      const p = priceFromRate(rate, size, 'LCL')
      if (p.buy != null) setValue('freight_cost', String(p.buy))
      if (p.capacity != null) setValue('max_cbm', String(p.capacity))
      setValue('markup_pct', String(marginPct(p.buy, p.sell).toFixed(2)))
    } else if (!hasFcl && hasLcl) {
      setValue('mode', 'LCL')
      const size = watch('container_size') || '40HQ'
      setValue('container_size', size)
      const p = priceFromRate(rate, size, 'LCL')
      if (p.buy != null) setValue('freight_cost', String(p.buy))
      if (p.capacity != null) setValue('max_cbm', String(p.capacity))
      setValue('markup_pct', String(marginPct(p.buy, p.sell).toFixed(2)))
    } else {
      setValue('mode', 'FCL')
      if (rate.sell_40hq != null) {
        setValue('container_size', '40HQ')
        setValue('freight_cost', String(rate.buy_40hq ?? ''))
        setValue('max_cbm', String(rate.cbm_40hq ?? 76))
        setValue('markup_pct', String(marginPct(rate.buy_40hq, rate.sell_40hq).toFixed(2)))
      } else if (rate.sell_40ft != null) {
        setValue('container_size', '40GP')
        setValue('freight_cost', String(rate.buy_40ft ?? ''))
        setValue('max_cbm', String(rate.cbm_40ft ?? 67))
        setValue('markup_pct', String(marginPct(rate.buy_40ft, rate.sell_40ft).toFixed(2)))
      } else if (rate.sell_20gp != null) {
        setValue('container_size', '20GP')
        setValue('freight_cost', String(rate.buy_20gp ?? ''))
        setValue('max_cbm', String(rate.cbm_20gp ?? 28))
        setValue('markup_pct', String(marginPct(rate.buy_20gp, rate.sell_20gp).toFixed(2)))
      }
    }
    setLockedFromAgent(true)
  }

  useEffect(() => {
    if (!selectedRate) return
    if (selectedRate.pol) setValue('port_of_loading', selectedRate.pol)
    if (selectedRate.pod) setValue('port_of_discharge', selectedRate.pod)
    setAgentDates(selectedRate, setValue)
    setValue('carrier_name', selectedRate.carrier_name)

    const size = mode === 'AIR' ? '' : (containerSize || '40HQ')
    if (mode !== 'AIR' && !containerSize) setValue('container_size', size)
    const p = priceFromRate(selectedRate, size, mode)
    if (p.buy != null) setValue('freight_cost', String(p.buy))
    if (p.capacity != null) setValue('max_cbm', String(p.capacity))
    setValue('markup_pct', String(marginPct(p.buy, p.sell).toFixed(2)))
    setLockedFromAgent(true)
  }, [selectedRate, containerSize, mode, setValue])

  // When size changes while carrier is locked, update freight + CBM from that carrier
  function onSizeChange(size: string) {
    const watchedCarrier = watch('carrier_name')
    const rate = (carrierRates ?? []).find(r => String(r.id) === String(watch('agent_carrier_rate_id'))) ?? (carrierRates ?? []).find(r => r.carrier_name === watchedCarrier)
    if (rate) {
      const modeNow = watch('mode')
      const p = priceFromRate(rate, size, modeNow)
      if (p.buy != null) setValue('freight_cost', String(p.buy))
      if (p.capacity != null) setValue('max_cbm', String(p.capacity))
      setValue('markup_pct', String(marginPct(p.buy, p.sell).toFixed(2)))
    }
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
    const filtered = carrierRates.filter(r => mode === 'AIR' ? r.rate_type === 'air' || r.sell_air_kg != null : r.rate_type !== 'air')
    return filtered.map(r => ({
      value: String(r.id),
      label: `${r.carrier_name}${r.pol && r.pod ? ` (${r.pol} → ${r.pod})` : ''}`,
    }))
  }, [carrierRates, mode])

  // Container sizes available for selected carrier — with sell price in label
  const sizeOptionsForCarrier = useMemo(() => {
    if (!selectedRate) return CONTAINER_SIZES.map(s => ({ value: s, label: s }))
    const rate = selectedRate
    if (!rate) return CONTAINER_SIZES.map(s => ({ value: s, label: s }))
    const opts: { value: string; label: string }[] = []
    if (mode === 'LCL') {
      if (rate.sell_lcl_20gp != null || rate.sell_lcl_cbm != null) opts.push({ value: '20GP', label: `20GP — $${Number(rate.sell_lcl_20gp ?? rate.sell_lcl_cbm).toLocaleString()}/CBM` })
      if (rate.sell_lcl_40ft != null || rate.sell_lcl_cbm != null) opts.push({ value: '40GP', label: `40GP — $${Number(rate.sell_lcl_40ft ?? rate.sell_lcl_cbm).toLocaleString()}/CBM` })
      if (rate.sell_lcl_40hq != null || rate.sell_lcl_cbm != null) opts.push({ value: '40HQ', label: `40HQ — $${Number(rate.sell_lcl_40hq ?? rate.sell_lcl_cbm).toLocaleString()}/CBM` })
    } else {
      if (rate.sell_20gp != null) opts.push({ value: '20GP', label: `20GP — $${Number(rate.sell_20gp).toLocaleString()}` })
      if (rate.sell_40ft != null) opts.push({ value: '40GP', label: `40GP — $${Number(rate.sell_40ft).toLocaleString()}` })
      if (rate.sell_40hq != null) opts.push({ value: '40HQ', label: `40HQ — $${Number(rate.sell_40hq).toLocaleString()}` })
    }
    return opts.length ? opts : CONTAINER_SIZES.map(s => ({ value: s, label: s }))
  }, [selectedRate, mode])

  const statusOptions        = STATUSES.map(s => ({ value: s, label: t(`bookings.status_${s}`) }))
  const containerSizeOptions = sizeOptionsForCarrier
  const incotermOptions      = SHIPPING_TERMS.map(i => ({ value: i, label: `${i} - ${INCOTERM_LABELS[i][isAr ? 'ar' : 'en']}` }))
  const directCarrierOptions = (mode === 'AIR' ? AIR_CARRIERS : SEA_CARRIERS).map(c => ({ value: c, label: c }))

  const selectedAgentPrice = priceFromRate(selectedRate, containerSize, mode)

  // Live price calculations from the selected agent rate
  const freight  = parseFloat(freightCost) || 0
  const cbmCap   = parseFloat(maxCbm)      || 0
  const markup   = parseFloat(markupPct)   || 0
  const buyingUnit  = mode === 'FCL' && cbmCap > 0 ? freight / cbmCap : freight
  const sellingUnit = selectedAgentPrice.sell != null
    ? (mode === 'FCL' && cbmCap > 0 ? Number(selectedAgentPrice.sell) / cbmCap : Number(selectedAgentPrice.sell))
    : buyingUnit * (1 + markup / 100)
  const marginValue = Math.max(sellingUnit - buyingUnit, 0)
  const priceUnitLabel = mode === 'AIR' ? 'KG' : 'CBM'

  useEffect(() => {
    if (!open) return
    if (initial) {
      reset({
        mode:              initial.mode,
        status:            initial.status,
        is_direct_booking: initial.is_direct_booking ?? false,
        agent_id:          initial.agent ? String(initial.agent.id) : '',
        agent_carrier_rate_id: initial.agent_carrier_rate_id ? String(initial.agent_carrier_rate_id) : '',
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
      reset({ mode: 'FCL', status: 'draft', currency: 'USD', is_direct_booking: false, markup_pct: '0', agent_carrier_rate_id: '' })
    }
  }, [open, initial, reset])

  useEffect(() => {
    if (isDirect) setValue('agent_id', '')
  }, [isDirect, setValue])

  function toNum(v: string) { const n = parseFloat(v); return isNaN(n) ? null : n }

  async function handleFormSubmit(vals: FormValues) {
    const payload: Record<string, unknown> = {
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
      currency:           'USD',
      max_cbm:            toNum(vals.max_cbm),
      markup_pct:         toNum(vals.markup_pct),
      notes:              vals.notes           || null,
    }

    // If locked from an agent, include the agent_carrier_rate_id for server-side snapshot
    if (!vals.is_direct_booking && carrierRates && vals.agent_carrier_rate_id) {
      const rate = carrierRates.find(r => String(r.id) === String(vals.agent_carrier_rate_id))
      if (rate) payload.agent_carrier_rate_id = rate.id
    }

    await onSubmit(payload)
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
            <>
              <FormRow>
                <Select label={t('containers.agent')} options={agentOptions}
                  placeholder={agentOptions.length === 0
                    ? (mode === 'AIR' ? t('bookings.no_air_agents') : t('bookings.no_sea_agents'))
                    : '—'
                  }
                  {...register('agent_id')} />
                <Select label={t('bookings.carrier_line')} options={carrierOptionsFromAgent ?? []}
                  placeholder={carrierOptionsFromAgent ? (isAr ? 'اختر شركة الشحن...' : 'Select carrier...') : (isAr ? 'لا توجد أسعار حالية لهذا الوكيل' : 'No current rates for this agent')}
                  {...register('agent_carrier_rate_id', {
                    onChange: (e) => { if (carrierOptionsFromAgent) applyCarrierRate(e.target.value) }
                  })} />
              </FormRow>

              <input type="hidden" {...register('carrier_name')} />

              {/* Lock banner — shown when fields are filled from agent */}
              {lockedFromAgent && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8">
                  <Lock size={14} className="text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-400 flex-1">
                    {isAr
                      ? 'تم ملء الميناء والسعة والتسعير تلقائياً من أسعار وكيل الشحن. التسعير للعرض فقط ولا يتم إدخاله يدوياً.'
                      : 'Ports, capacity and pricing are filled from the freight forwarder rate. Pricing is display-only here.'}
                  </p>
                </div>
              )}
            </>
          )}
          {isDirect && (
            <Select label={t('bookings.carrier_line')} options={directCarrierOptions}
              placeholder={t('bookings.select_carrier')} {...register('carrier_name')} />
          )}

          {mode !== 'AIR' && (
            <FormRow>
              <Select label={t('bookings.container_size')} options={containerSizeOptions}
                  placeholder="—"
                  {...register('container_size', {
                    onChange: (e) => {
                      const size = e.target.value
                      onSizeChange(size)
                    }
                  })} />
              <Input
                label={isAr ? 'سعة الحاوية (CBM)' : 'Container Capacity (CBM)'}
                type="number" step="0.5" min="1"
                placeholder={containerSize ? String(CONTAINER_CBM_DEFAULTS[containerSize] ?? '') : '—'}
                  {...register('max_cbm')}
                  disabled={lockedFromAgent}
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
              disabled={lockedFromAgent}
              {...register('port_of_loading')}
            />
            <Select
              label={t('bookings.port_discharge')}
              options={mode === 'AIR' ? AIR_PORT_OPTIONS : SEA_PORT_OPTIONS}
              placeholder={isAr ? '— اختر ميناء التفريغ —' : '— Select discharge port —'}
              disabled={lockedFromAgent}
              {...register('port_of_discharge')}
            />
          </FormRow>

          <FormRow>
            <Input label={t('bookings.etd')} type="date" {...register('etd')} />
            <Input label={t('bookings.eta')} type="date" {...register('eta')} />
          </FormRow>
          <Select label={t('bookings.incoterm')} options={incotermOptions} placeholder="—" {...register('incoterm')} />
        </FormSection>

        <input type="hidden" {...register('freight_cost')} />
        <input type="hidden" {...register('markup_pct')} />
        <input type="hidden" {...register('currency')} />

        {/* Agent rate preview */}
        {!isDirect && selectedRate && freight > 0 && (mode === 'AIR' || cbmCap > 0) && (
          <FormSection title={isAr ? 'سعر وكيل الشحن' : 'Freight Forwarder Rate'}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-0 rounded-xl border border-brand-primary/20 bg-brand-primary/5 overflow-hidden">
              <div className="text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 pt-4">
                  {isAr ? `شراء / ${priceUnitLabel}` : `Buying / ${priceUnitLabel}`}
                </p>
                <p className="text-base font-bold text-white pb-4">${buyingUnit.toFixed(2)}</p>
              </div>
              <div className="text-center border-x border-white/10">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 pt-4">
                  {isAr ? 'نسبة الربح' : 'Markup'}
                </p>
                <p className="text-base font-bold text-yellow-400 pb-4">+{markup.toFixed(2)}%</p>
              </div>
              <div className="text-center border-e border-white/10">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 pt-4">
                  {isAr ? 'قيمة الربح' : 'Profit Value'}
                </p>
                <p className="text-base font-bold text-brand-primary-light pb-4">${marginValue.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 pt-4">
                  {isAr ? `بيع / ${priceUnitLabel}` : `Selling / ${priceUnitLabel}`}
                </p>
                <p className="text-base font-bold text-green-400 pb-4">${sellingUnit.toFixed(2)}</p>
              </div>
            </div>
          </FormSection>
        )}

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
