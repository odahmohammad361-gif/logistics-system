import { useEffect, useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, FileSpreadsheet, ChevronDown, ChevronUp, Link } from 'lucide-react'
import { Input, Select, Textarea, FormRow, FormSection } from '@/components/ui/Form'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { getClients } from '@/services/clientService'
import { getContainers } from '@/services/containerService'
import type { Invoice, Container } from '@/types'
import {
  SHIPPING_TERMS, PAYMENT_TERMS, getFlatPortOptions,
  calcVolumetricWeight, calcChargeableWeight,
} from '@/constants/logistics'
import ImageUploadZone from './ImageUploadZone'
import StampPositionPicker from './StampPositionPicker'
import ExcelImportPanel from './ExcelImportPanel'
import type { ParsedItem } from './ExcelImportPanel'

const INVOICE_TYPES = ['PI', 'CI', 'PL', 'SC', 'PRICE_OFFER']
const STATUSES = ['draft', 'sent', 'approved', 'paid', 'cancelled']

const SEA_PORT_OPTIONS = getFlatPortOptions('sea')
const AIR_PORT_OPTIONS = getFlatPortOptions('air')
const ALL_PORT_OPTIONS = getFlatPortOptions()

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
  client_id: number
  invoice_type: string
  issue_date: string
  due_date: string
  status: string
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
  container_id: number | null
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
  /** Invoice ID — required for file uploads (stamp, background, item images) */
  invoiceId?: number
  onStampUpload?: (file: File) => Promise<void>
  onBackgroundUpload?: (file: File) => Promise<void>
}

function defaultItem(): ItemFormValues {
  return {
    description: '', description_ar: '', details: '', details_ar: '',
    hs_code: '', quantity: 1, unit: 'pcs', unit_price: 0,
    cartons: null, gross_weight: null, net_weight: null, cbm: null,
    carton_length_cm: null, carton_width_cm: null, carton_height_cm: null,
    sort_order: 0,
  }
}

function airVolumetricDisplay(item: ItemFormValues) {
  if (!item.carton_length_cm || !item.carton_width_cm || !item.carton_height_cm || !item.cartons) return null
  const vol = calcVolumetricWeight(item.carton_length_cm, item.carton_width_cm, item.carton_height_cm, item.cartons)
  const chargeable = calcChargeableWeight(item.gross_weight ?? 0, vol)
  return { vol: vol.toFixed(2), chargeable: chargeable.toFixed(2) }
}

export default function InvoiceForm({
  initial, onSubmit, loading, invoiceId, onStampUpload, onBackgroundUpload,
}: Props) {
  const { t } = useTranslation()
  const [showExcelImport, setShowExcelImport] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({})

  const { data: clientsData } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => getClients({ page: 1, page_size: 200, is_active: true }),
  })

  const { data: containersData } = useQuery({
    queryKey: ['containers-all'],
    queryFn: () => getContainers({ page_size: 200 }),
  })

  const clientOptions = [
    { value: '', label: t('clients.select') },
    ...(clientsData?.results ?? []).map((c) => ({
      value: String(c.id),
      label: `${c.name} (${c.client_code})`,
    })),
  ]

  const containerOptions = [
    { value: '', label: '— No container —' },
    ...(containersData?.results ?? []).map((c: Container) => ({
      value: String(c.id),
      label: `${c.booking_number} · ${c.container_type}${c.container_number ? ' · ' + c.container_number : ''}`,
    })),
  ]

  const {
    register, control, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      client_id: initial?.client_id ?? 0,
      invoice_type: initial?.invoice_type ?? 'PI',
      issue_date: initial?.issue_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      due_date: initial?.due_date?.slice(0, 10) ?? '',
      status: initial?.status ?? 'draft',
      origin: initial?.origin ?? '',
      payment_terms: initial?.payment_terms ?? '',
      shipping_term: initial?.shipping_term ?? '',
      port_of_loading: initial?.port_of_loading ?? '',
      port_of_discharge: initial?.port_of_discharge ?? '',
      shipping_marks: initial?.shipping_marks ?? '',
      container_no: initial?.container_no ?? '',
      seal_no: initial?.seal_no ?? '',
      bl_number: initial?.bl_number ?? '',
      vessel_name: initial?.vessel_name ?? '',
      voyage_number: initial?.voyage_number ?? '',
      container_id: initial?.container_id ?? null,
      stamp_position: initial?.stamp_position ?? 'bottom-right',
      bank_account_name: initial?.bank_account_name ?? '',
      bank_account_no: initial?.bank_account_no ?? '',
      bank_swift: initial?.bank_swift ?? '',
      bank_name: initial?.bank_name ?? '',
      bank_address: initial?.bank_address ?? '',
      discount: initial?.discount != null ? Number(initial.discount) : 0,
      notes: initial?.notes ?? '',
      notes_ar: initial?.notes_ar ?? '',
      items: initial?.items?.map((item) => ({
        description: item.description,
        description_ar: item.description_ar ?? '',
        details: item.details ?? '',
        details_ar: item.details_ar ?? '',
        hs_code: item.hs_code ?? '',
        quantity: Number(item.quantity),
        unit: item.unit ?? 'pcs',
        unit_price: Number(item.unit_price),
        cartons: item.cartons ?? null,
        gross_weight: item.gross_weight ? Number(item.gross_weight) : null,
        net_weight: item.net_weight ? Number(item.net_weight) : null,
        cbm: item.cbm ? Number(item.cbm) : null,
        carton_length_cm: item.carton_length_cm ? Number(item.carton_length_cm) : null,
        carton_width_cm: item.carton_width_cm ? Number(item.carton_width_cm) : null,
        carton_height_cm: item.carton_height_cm ? Number(item.carton_height_cm) : null,
        sort_order: item.sort_order ?? 0,
      })) ?? [defaultItem()],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' })

  const watchItems = watch('items')
  const watchType = watch('invoice_type')
  const watchContainerId = watch('container_id')
  const stampPosition = watch('stamp_position')

  const subtotal = watchItems.reduce((s, it) => s + (Number(it.quantity) * Number(it.unit_price)), 0)
  const discount = Number(watch('discount')) || 0
  const total = Math.max(subtotal - discount, 0)

  const isAir = watchType === 'AIR' ||
    containersData?.results?.find((c: Container) => String(c.id) === String(watchContainerId))?.container_type === 'AIR'
  const isPL = watchType === 'PL'
  const showBankSection = !isPL

  // When container is selected for PL, auto-fill B/L fields
  useEffect(() => {
    if (!watchContainerId || !containersData) return
    const c = containersData.results.find((x: Container) => x.id === Number(watchContainerId))
    if (!c) return
    if (c.bl_number) setValue('bl_number', c.bl_number)
    if (c.seal_no) setValue('seal_no', c.seal_no)
    if (c.container_number) setValue('container_no', c.container_number)
    if (c.port_of_loading) setValue('port_of_loading', c.port_of_loading)
    if (c.port_of_discharge) setValue('port_of_discharge', c.port_of_discharge)
  }, [watchContainerId, containersData, setValue])

  const portOptions = isAir ? AIR_PORT_OPTIONS : SEA_PORT_OPTIONS

  function handleExcelImport(items: ParsedItem[]) {
    replace(items.map((item, idx) => ({
      description: item.description,
      description_ar: '',
      details: item.details,
      details_ar: '',
      hs_code: item.hs_code,
      quantity: item.quantity ?? 1,
      unit: 'pcs',
      unit_price: item.unit_price ?? 0,
      cartons: item.cartons,
      gross_weight: item.gross_weight,
      net_weight: item.net_weight,
      cbm: item.cbm,
      carton_length_cm: null,
      carton_width_cm: null,
      carton_height_cm: null,
      sort_order: idx,
    })))
    setShowExcelImport(false)
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* ── Basic Info ── */}
        <FormSection title={t('invoices.basic_info')}>
          <FormRow>
            <Select
              label={t('clients.title')}
              options={clientOptions}
              {...register('client_id', { required: true, valueAsNumber: true })}
              error={errors.client_id ? t('common.required') : undefined}
            />
            <Select
              label={t('invoices.type')}
              options={INVOICE_TYPES.map((v) => ({ value: v, label: v }))}
              {...register('invoice_type', { required: true })}
            />
          </FormRow>
          <FormRow>
            <Input
              type="date"
              label={t('invoices.date')}
              {...register('issue_date', { required: true })}
              error={errors.issue_date ? t('common.required') : undefined}
            />
            <Input type="date" label={t('invoices.due_date')} {...register('due_date')} />
          </FormRow>
          <FormRow>
            <Select
              label={t('common.status')}
              options={STATUSES.map((v) => ({ value: v, label: t(`invoices.status.${v}`) }))}
              {...register('status')}
            />
            <Input label="Origin" placeholder="e.g. China" {...register('origin')} />
          </FormRow>
        </FormSection>

        {/* ── Shipping Details ── */}
        <FormSection title="Shipping Details">
          <FormRow>
            <Select
              label="Shipping Term (Incoterm)"
              options={[{ value: '', label: '— Select —' }, ...SHIPPING_TERMS.map((v) => ({ value: v, label: v }))]}
              {...register('shipping_term')}
            />
            <Select
              label="Payment Terms"
              options={[{ value: '', label: '— Select —' }, ...PAYMENT_TERMS.map((v) => ({ value: v, label: v }))]}
              {...register('payment_terms')}
            />
          </FormRow>
          <FormRow>
            <Select
              label="Port of Loading"
              options={portOptions}
              {...register('port_of_loading')}
            />
            <Select
              label="Port of Discharge"
              options={portOptions}
              {...register('port_of_discharge')}
            />
          </FormRow>
          <Input label="Shipping Marks" {...register('shipping_marks')} />
        </FormSection>

        {/* ── Container / B/L Details ── */}
        <FormSection title="Container / B/L Details">
          {isPL && (
            <div className="mb-3">
              <Select
                label="Link to Container (auto-fill B/L data)"
                options={containerOptions}
                {...register('container_id', { valueAsNumber: true, setValueAs: v => v === '' || v === 0 ? null : Number(v) })}
              />
              {watchContainerId && (
                <p className="text-xs text-brand-green mt-1 flex items-center gap-1">
                  <Link size={11} /> B/L, seal, and container fields pre-filled from selected container
                </p>
              )}
            </div>
          )}
          <FormRow>
            <Input label="Container No." placeholder="SEGU6361144" {...register('container_no')} />
            <Input label="Seal No." placeholder="M5796799" {...register('seal_no')} />
          </FormRow>
          <FormRow>
            <Input label="B/L No." placeholder="GGZ2848838" {...register('bl_number')} />
            <Input label="Vessel Name" {...register('vessel_name')} />
          </FormRow>
          <Input label="Voyage Number" {...register('voyage_number')} />
        </FormSection>

        {/* ── Items ── */}
        <FormSection title={t('invoices.items')}>
          <div className="flex justify-end mb-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowExcelImport(true)}
            >
              <FileSpreadsheet size={13} />
              Import from Excel
            </Button>
          </div>

          <div className="space-y-3">
            {fields.map((field, i) => {
              const item = watchItems[i] ?? {}
              const airCalc = isAir ? airVolumetricDisplay(item as ItemFormValues) : null
              const expanded = expandedItems[i] ?? false

              return (
                <div key={field.id} className="bg-brand-surface rounded-lg p-3 space-y-3 border border-brand-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {t('invoices.item')} #{i + 1}
                      {item.description && <span className="ml-2 text-gray-500">— {item.description}</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedItems((p) => ({ ...p, [i]: !p[i] }))}
                        className="text-gray-500 hover:text-white transition-colors"
                        title="Toggle advanced fields"
                      >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(i)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Core fields */}
                  <Input
                    label={t('invoices.description')}
                    {...register(`items.${i}.description`, { required: true })}
                    error={errors.items?.[i]?.description ? t('common.required') : undefined}
                  />
                  <Input
                    label="Details (Material, Sizes, Colors, Packing)"
                    placeholder="Mat: 100% Cotton; Sizes: S-XXL; Colors: Black; Packing: 24pcs/ctn"
                    {...register(`items.${i}.details`)}
                  />
                  <FormRow cols={3}>
                    <Input label="HS Code" {...register(`items.${i}.hs_code`)} />
                    <Input
                      type="number"
                      label={t('invoices.qty')}
                      min={0.01}
                      step="any"
                      {...register(`items.${i}.quantity`, { required: true, min: 0.01, valueAsNumber: true })}
                      error={errors.items?.[i]?.quantity ? t('common.required') : undefined}
                    />
                    <Input
                      type="number"
                      label={t('invoices.unit_price') + ' (USD)'}
                      min={0}
                      step="0.0001"
                      {...register(`items.${i}.unit_price`, { required: true, min: 0, valueAsNumber: true })}
                      error={errors.items?.[i]?.unit_price ? t('common.required') : undefined}
                    />
                  </FormRow>

                  {/* Packing / weight fields */}
                  <FormRow cols={4}>
                    <Input
                      type="number"
                      label="Cartons (CTN)"
                      min={0}
                      {...register(`items.${i}.cartons`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
                    />
                    <Input
                      type="number"
                      label="G.W. (kg)"
                      step="0.001"
                      {...register(`items.${i}.gross_weight`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
                    />
                    <Input
                      type="number"
                      label="N.W. (kg)"
                      step="0.001"
                      {...register(`items.${i}.net_weight`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
                    />
                    <Input
                      type="number"
                      label="CBM"
                      step="0.0001"
                      {...register(`items.${i}.cbm`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
                    />
                  </FormRow>

                  {/* Air cargo dimensions — always show if AIR container selected */}
                  {isAir && (
                    <div className="p-2 bg-blue-900/10 border border-blue-800/30 rounded-lg space-y-2">
                      <p className="text-xs text-blue-400 font-semibold">Air Cargo Dimensions (per carton)</p>
                      <FormRow cols={3}>
                        <Input
                          type="number"
                          label="Length (cm)"
                          step="0.01"
                          {...register(`items.${i}.carton_length_cm`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
                        />
                        <Input
                          type="number"
                          label="Width (cm)"
                          step="0.01"
                          {...register(`items.${i}.carton_width_cm`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
                        />
                        <Input
                          type="number"
                          label="Height (cm)"
                          step="0.01"
                          {...register(`items.${i}.carton_height_cm`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
                        />
                      </FormRow>
                      {airCalc && (
                        <div className="flex gap-4 text-xs text-blue-300 font-mono">
                          <span>Volumetric: {airCalc.vol} kg</span>
                          <span className="text-brand-green font-semibold">Chargeable: {airCalc.chargeable} kg</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Advanced fields (collapsed by default) */}
                  {expanded && (
                    <div className="space-y-3 pt-2 border-t border-brand-border">
                      <FormRow>
                        <Input label="Description (Arabic)" {...register(`items.${i}.description_ar`)} />
                        <Input label="Unit" placeholder="pcs, pairs, kg..." {...register(`items.${i}.unit`)} />
                      </FormRow>
                      <Input label="Details (Arabic)" {...register(`items.${i}.details_ar`)} />
                    </div>
                  )}
                </div>
              )
            })}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => append(defaultItem())}
            >
              <Plus size={14} />
              {t('invoices.add_item')}
            </Button>
          </div>
        </FormSection>

        {/* ── Adjustments / Totals ── */}
        <FormSection title={t('invoices.adjustments')}>
          <FormRow>
            <Input
              type="number"
              label={t('invoices.discount')}
              min={0}
              step="0.01"
              {...register('discount', { valueAsNumber: true })}
            />
          </FormRow>
          <div className="bg-brand-surface rounded-lg p-4 text-sm space-y-1">
            <div className="flex justify-between text-gray-400">
              <span>{t('invoices.subtotal')}</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-red-400">
                <span>{t('invoices.discount')}</span>
                <span>-${discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-brand-green border-t border-brand-border pt-2">
              <span>{t('invoices.total')}</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </FormSection>

        {/* ── Bank Details ── */}
        {showBankSection && (
          <FormSection title="Bank / Payment Details">
            <FormRow>
              <Input label="Account Name" {...register('bank_account_name')} />
              <Input label="Account No." {...register('bank_account_no')} />
            </FormRow>
            <FormRow>
              <Input label="SWIFT" {...register('bank_swift')} />
              <Input label="Bank Name" {...register('bank_name')} />
            </FormRow>
            <Input label="Bank Address" {...register('bank_address')} />
          </FormSection>
        )}

        {/* ── Document Assets ── */}
        {invoiceId && (
          <FormSection title="Document Assets (Stamp & Background)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ImageUploadZone
                label="Electronic Stamp"
                currentImageUrl={initial?.stamp_image_path ? undefined : undefined}
                onFile={async (file) => onStampUpload?.(file)}
              />
              <ImageUploadZone
                label="Background Document Image"
                currentImageUrl={undefined}
                onFile={async (file) => onBackgroundUpload?.(file)}
              />
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
          </FormSection>
        )}

        {!invoiceId && (
          <div className="text-xs text-gray-600 bg-brand-surface border border-brand-border rounded p-3">
            Stamp and background image uploads are available after the invoice is created. Save first, then re-open to upload.
          </div>
        )}

        {/* ── Notes ── */}
        <FormRow>
          <Textarea label={t('common.notes')} rows={3} {...register('notes')} />
          <Textarea label="Notes (Arabic)" rows={3} {...register('notes_ar')} />
        </FormRow>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="submit" loading={loading}>
            {initial?.id ? t('common.save') : t('invoices.create')}
          </Button>
        </div>
      </form>

      {/* Excel Import Modal */}
      <Modal
        open={showExcelImport}
        onClose={() => setShowExcelImport(false)}
        title="Import Items from Excel"
        size="lg"
      >
        <ExcelImportPanel
          onImport={handleExcelImport}
          onClose={() => setShowExcelImport(false)}
        />
      </Modal>
    </>
  )
}
