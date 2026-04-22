import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { getAgents } from '@/services/agentService'
import { Input, Select, Textarea, FormRow, FormSection } from '@/components/ui/Form'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import clsx from 'clsx'
import type { Booking, BookingMode, BookingStatus } from '@/types'

// Common ocean & air carriers
const SEA_CARRIERS = [
  'CMA CGM', 'MSC', 'Evergreen', 'PIL', 'COSCO', 'Yang Ming',
  'Hapag-Lloyd', 'ONE', 'HMM', 'ZIM', 'OOCL', 'Maersk',
]
const AIR_CARRIERS = [
  'Emirates SkyCargo', 'Qatar Airways Cargo', 'Turkish Cargo',
  'Flydubai Cargo', 'Air Arabia Cargo', 'China Southern Cargo',
  'Air China Cargo', 'Cargolux',
]

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
  const { t } = useTranslation()

  const { data: agentsData } = useQuery({
    queryKey: ['agents-all'],
    queryFn:  () => getAgents({ page: 1, page_size: 200 }),
    enabled:  open,
  })

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: { mode: 'LCL', status: 'draft', currency: 'USD', is_direct_booking: false },
  })

  const mode            = watch('mode')
  const isDirect        = watch('is_direct_booking')

  // Filter agents by service mode
  const agentOptions = useMemo(() => {
    const all = agentsData?.results ?? []
    const filtered = mode === 'AIR'
      ? all.filter(a => a.serves_air)
      : all.filter(a => a.serves_sea)
    return filtered.map(a => ({ value: String(a.id), label: a.name }))
  }, [agentsData, mode])

  const statusOptions = STATUSES.map(s => ({ value: s, label: t(`bookings.status_${s}`) }))
  const containerSizeOptions = CONTAINER_SIZES.map(s => ({ value: s, label: s }))
  const incotermOptions = INCOTERMS.map(i => ({ value: i, label: i }))
  const currencyOptions = CURRENCIES.map(c => ({ value: c, label: c }))

  // Carrier dropdown list based on mode
  const carrierOptions = (mode === 'AIR' ? AIR_CARRIERS : SEA_CARRIERS).map(c => ({ value: c, label: c }))

  useEffect(() => {
    if (!open) return
    if (initial) {
      reset({
        mode:              initial.mode,
        status:            initial.status,
        is_direct_booking: initial.is_direct_booking ?? false,
        agent_id:          initial.agent ? String(initial.agent.id) : '',
        carrier_name:      initial.carrier_name       ?? '',
        container_size:    initial.container_size      ?? '',
        container_no:      initial.container_no        ?? '',
        seal_no:           initial.seal_no             ?? '',
        bl_number:         initial.bl_number           ?? '',
        awb_number:        initial.awb_number          ?? '',
        vessel_name:       initial.vessel_name         ?? '',
        voyage_number:     initial.voyage_number       ?? '',
        flight_number:     initial.flight_number       ?? '',
        port_of_loading:   initial.port_of_loading     ?? '',
        port_of_discharge: initial.port_of_discharge   ?? '',
        etd:               initial.etd                 ?? '',
        eta:               initial.eta                 ?? '',
        incoterm:          initial.incoterm            ?? '',
        freight_cost:      initial.freight_cost        != null ? String(initial.freight_cost) : '',
        currency:          initial.currency            ?? 'USD',
        notes:             initial.notes               ?? '',
      })
    } else {
      reset({ mode: 'LCL', status: 'draft', currency: 'USD', is_direct_booking: false })
    }
  }, [open, initial, reset])

  // Clear agent when switching to direct booking
  useEffect(() => {
    if (isDirect) setValue('agent_id', '')
  }, [isDirect, setValue])

  function toNum(v: string) { const n = parseFloat(v); return isNaN(n) ? null : n }

  async function handleFormSubmit(vals: FormValues) {
    await onSubmit({
      mode:               vals.mode,
      status:             vals.status,
      is_direct_booking:  vals.is_direct_booking,
      agent_id:           (!vals.is_direct_booking && vals.agent_id) ? parseInt(vals.agent_id) : null,
      carrier_name:       vals.carrier_name || null,
      container_size:     (vals.mode !== 'AIR' && vals.container_size) ? vals.container_size : null,
      container_no:       vals.container_no       || null,
      seal_no:            vals.seal_no             || null,
      bl_number:          vals.bl_number           || null,
      awb_number:         vals.awb_number          || null,
      vessel_name:        vals.vessel_name         || null,
      voyage_number:      vals.voyage_number       || null,
      flight_number:      vals.flight_number       || null,
      port_of_loading:    vals.port_of_loading     || null,
      port_of_discharge:  vals.port_of_discharge   || null,
      etd:                vals.etd                 || null,
      eta:                vals.eta                 || null,
      incoterm:           vals.incoterm            || null,
      freight_cost:       toNum(vals.freight_cost),
      currency:           vals.currency            || 'USD',
      notes:              vals.notes               || null,
    })
  }

  const modeLabels: Record<BookingMode, string> = {
    LCL: t('bookings.mode_lcl'),
    FCL: t('bookings.mode_fcl'),
    AIR: t('bookings.mode_air'),
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? t('bookings.edit') : t('bookings.new')}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit(handleFormSubmit)} loading={saving}>
            {initial ? t('common.update') : t('common.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Mode selector */}
        <FormSection title={t('bookings.booking_info')}>
          <div>
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
          </div>

          <FormRow>
            <Select
              label={t('common.status')}
              options={statusOptions}
              {...register('status')}
            />
            {/* Direct booking toggle (relevant for AIR mostly) */}
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
                    <input
                      type="radio"
                      className="sr-only"
                      value={String(direct)}
                      checked={isDirect === direct}
                      onChange={() => setValue('is_direct_booking', direct)}
                    />
                    {direct ? t('bookings.direct_booking') : t('bookings.via_agent')}
                  </label>
                ))}
              </div>
            </div>
          </FormRow>

          {/* Agent (only when not direct) */}
          {!isDirect && (
            <FormRow>
              <Select
                label={t('containers.agent')}
                options={agentOptions}
                placeholder={agentOptions.length === 0
                  ? (mode === 'AIR' ? t('bookings.no_air_agents') : t('bookings.no_sea_agents'))
                  : '—'
                }
                {...register('agent_id')}
              />
              <Select
                label={t('bookings.carrier_line')}
                options={carrierOptions}
                placeholder={t('bookings.select_carrier')}
                {...register('carrier_name')}
              />
            </FormRow>
          )}

          {/* Direct booking carrier */}
          {isDirect && (
            <Select
              label={t('bookings.carrier_line')}
              options={carrierOptions}
              placeholder={t('bookings.select_carrier')}
              {...register('carrier_name')}
            />
          )}

          {mode !== 'AIR' && (
            <Select
              label={t('bookings.container_size')}
              options={containerSizeOptions}
              placeholder="—"
              {...register('container_size')}
            />
          )}
        </FormSection>

        {/* Routing */}
        <FormSection title={t('bookings.routing')}>
          <FormRow>
            <Input label={t('bookings.port_loading')}   {...register('port_of_loading')} />
            <Input label={t('bookings.port_discharge')} {...register('port_of_discharge')} />
          </FormRow>
          <FormRow>
            <Input label={t('bookings.etd')} type="date" {...register('etd')} />
            <Input label={t('bookings.eta')} type="date" {...register('eta')} />
          </FormRow>
          <FormRow>
            <Select
              label={t('bookings.incoterm')}
              options={incotermOptions}
              placeholder="—"
              {...register('incoterm')}
            />
            <Select
              label={t('common.currency')}
              options={currencyOptions}
              {...register('currency')}
            />
          </FormRow>
          <Input label={t('bookings.freight_cost')} type="number" step="0.01" min="0" {...register('freight_cost')} />
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
