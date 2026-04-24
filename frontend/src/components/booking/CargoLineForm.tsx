import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { getEligibleClients } from '@/services/bookingService'
import { Input, Select, Textarea, FormRow, FormSection } from '@/components/ui/Form'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import type { BookingCargoLine, BookingMode } from '@/types'

const DEST_LABEL: Record<string, string> = { jordan: '🇯🇴 Jordan', iraq: '🇮🇶 Iraq' }
const DEST_LABEL_AR: Record<string, string> = { jordan: '🇯🇴 الأردن', iraq: '🇮🇶 العراق' }

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

  const bookingDest = eligibleData?.booking_destination ?? null

  const clientOptions = useMemo(() => {
    const clients = eligibleData?.results ?? []
    return clients.map(c => ({
      value: String(c.id),
      label: `${c.client_code} — ${isAr && c.name_ar ? c.name_ar : c.name}${c.destination ? ` (${isAr ? DEST_LABEL_AR[c.destination] : DEST_LABEL[c.destination]})` : ''}`,
    }))
  }, [eligibleData, isAr])

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>()

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
        notes:            initial.notes             ?? '',
      })
    } else {
      reset({
        client_id:'', description:'', description_ar:'', hs_code:'', shipping_marks:'',
        cartons:'', gross_weight_kg:'', net_weight_kg:'', cbm:'',
        carton_length_cm:'', carton_width_cm:'', carton_height_cm:'',
        freight_share:'', notes:'',
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
