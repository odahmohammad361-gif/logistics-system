import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, RefreshCw, ScanLine, BarChart2 } from 'lucide-react'
import {
  getContainers, createContainer, updateContainer,
  updateContainerStatus, deleteContainer, getContainerCapacity,
} from '@/services/containerService'
import { getClients } from '@/services/clientService'
import { getAgents } from '@/services/agentService'
import { useAuth } from '@/hooks/useAuth'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { Input, Select, Textarea, FormRow, FormSection } from '@/components/ui/Form'
import { useForm, useFieldArray } from 'react-hook-form'
import type { Container, OcrResult } from '@/types'
import { SHIPPING_TERMS, PAYMENT_TERMS, getFlatPortOptions, CONTAINER_LIMITS } from '@/constants/logistics'
import ContainerCapacityBar from '@/components/container/ContainerCapacityBar'
import OcrUploadPanel from '@/components/container/OcrUploadPanel'

const CONTAINER_TYPES = ['20GP', '40FT', '40HQ', 'AIR']
const STATUSES = ['booking', 'in_transit', 'arrived', 'cleared', 'delivered', 'cancelled']
const SEA_PORTS = getFlatPortOptions('sea')
const AIR_PORTS = getFlatPortOptions('air')

interface LCLClientFormEntry {
  client_id: number
  cbm: number | null
  cartons: number | null
  net_weight: number | null
  gross_weight: number | null
  freight_share: number | null
  notes: string
}

interface FormValues {
  client_id: number
  container_type: string
  shipping_agent_id: number | null
  container_number: string
  seal_no: string
  bl_number: string
  is_lcl: boolean
  cargo_mode: string
  shipping_term: string
  payment_terms: string
  cbm: number | null
  net_weight: number | null
  gross_weight: number | null
  cartons: number | null
  port_of_loading: string
  port_of_discharge: string
  etd: string
  eta: string
  freight_cost: number | null
  goods_description: string
  notes: string
  lcl_clients: LCLClientFormEntry[]
}

export default function ContainersPage() {
  const { t } = useTranslation()
  const { isStaff, isAdmin } = useAuth()
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [statusModal, setStatusModal] = useState<Container | null>(null)
  const [editing, setEditing] = useState<Container | null>(null)
  const [deleting, setDeleting] = useState<Container | null>(null)
  const [newStatus, setNewStatus] = useState('')
  const [capacityModal, setCapacityModal] = useState<Container | null>(null)
  const [ocrModal, setOcrModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['containers', { page, search, statusFilter }],
    queryFn: () => getContainers({ page, page_size: 20, search: search || undefined, status: statusFilter || undefined }),
  })

  const { data: clients } = useQuery({
    queryKey: ['clients-all'],
    queryFn: () => getClients({ page: 1, page_size: 200, is_active: true }),
  })

  const { data: agents } = useQuery({
    queryKey: ['agents-all'],
    queryFn: () => getAgents({ page: 1, page_size: 100, is_active: true }),
  })

  const { data: capacityData } = useQuery({
    queryKey: ['container-capacity', capacityModal?.id],
    queryFn: () => getContainerCapacity(capacityModal!.id),
    enabled: !!capacityModal,
  })

  const clientOptions = [
    { value: '', label: t('clients.select') },
    ...(clients?.results ?? []).map((c) => ({ value: String(c.id), label: `${c.name} (${c.client_code})` })),
  ]

  const agentOptions = [
    { value: '', label: '— No agent —' },
    ...(agents?.results ?? []).map((a) => ({ value: String(a.id), label: `${a.name}${a.country ? ' · ' + a.country : ''}` })),
  ]

  const {
    register, handleSubmit, reset, watch, setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { container_type: '40FT', is_lcl: false, lcl_clients: [] },
  })

  const { fields: lclFields, append: lclAppend, remove: lclRemove } = useFieldArray({
    control, name: 'lcl_clients',
  })

  const watchType = watch('container_type')
  const watchIsLcl = watch('is_lcl')
  const isAir = watchType === 'AIR'
  const portOptions = isAir ? AIR_PORTS : SEA_PORTS
  const limits = CONTAINER_LIMITS[watchType] ?? null

  const saveMut = useMutation({
    mutationFn: (v: FormValues) => {
      const payload = {
        ...v,
        shipping_agent_id: v.shipping_agent_id || null,
        container_id: undefined,
      }
      return editing ? updateContainer(editing.id, payload) : createContainer(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['containers'] })
      setModalOpen(false)
      setEditing(null)
      reset()
    },
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateContainerStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['containers'] }); setStatusModal(null) },
  })

  const deleteMut = useMutation({
    mutationFn: deleteContainer,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['containers'] }); setDeleting(null) },
  })

  function openCreate() {
    setEditing(null)
    reset({ container_type: '40FT', is_lcl: false, lcl_clients: [], cargo_mode: 'FCL' })
    setModalOpen(true)
  }

  function openEdit(c: Container) {
    setEditing(c)
    reset({
      client_id: c.client_id,
      container_type: c.container_type,
      shipping_agent_id: c.shipping_agent_id ?? null,
      container_number: c.container_number ?? '',
      seal_no: c.seal_no ?? '',
      bl_number: c.bl_number ?? '',
      is_lcl: c.is_lcl,
      cargo_mode: c.cargo_mode ?? '',
      shipping_term: c.shipping_term ?? '',
      payment_terms: c.payment_terms ?? '',
      cbm: c.cbm ?? null,
      net_weight: c.net_weight ?? null,
      gross_weight: c.gross_weight ?? null,
      cartons: c.cartons ?? null,
      port_of_loading: c.port_of_loading ?? '',
      port_of_discharge: c.port_of_discharge ?? '',
      etd: c.etd?.slice(0, 10) ?? '',
      eta: c.eta?.slice(0, 10) ?? '',
      freight_cost: c.freight_cost ?? null,
      goods_description: c.goods_description ?? '',
      notes: c.notes ?? '',
      lcl_clients: c.lcl_clients?.map((lc) => ({
        client_id: lc.client_id,
        cbm: lc.cbm,
        cartons: lc.cartons,
        net_weight: lc.net_weight,
        gross_weight: lc.gross_weight,
        freight_share: lc.freight_share,
        notes: lc.notes ?? '',
      })) ?? [],
    })
    setModalOpen(true)
  }

  function handleOcrResult(result: OcrResult) {
    if (result.bl_number) setValue('bl_number', result.bl_number)
    if (result.seal_no) setValue('seal_no', result.seal_no)
    if (result.container_number) setValue('container_number', result.container_number)
    if (result.cargo_mode !== 'unknown') setValue('cargo_mode', result.cargo_mode)
    if (result.cargo_mode === 'LCL') setValue('is_lcl', true)
    setOcrModal(false)
  }

  const columns = [
    {
      key: 'booking_number',
      label: t('containers.booking_number'),
      render: (c: Container) => <span className="font-mono text-sm text-white">{c.booking_number}</span>,
    },
    {
      key: 'client_name',
      label: t('clients.title'),
      render: (c: Container) => (
        <div>
          <p className="text-sm text-white">{c.client?.name ?? ''}</p>
          <p className="text-xs text-gray-500">{c.client?.client_code ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'container_type',
      label: t('containers.type'),
      render: (c: Container) => (
        <div>
          <span className="text-xs font-semibold text-brand-green">{c.container_type}</span>
          {c.is_lcl && <span className="ml-1 text-xs text-yellow-400">LCL</span>}
        </div>
      ),
    },
    {
      key: 'bl_seal',
      label: 'B/L / Seal',
      render: (c: Container) => (
        <div className="text-xs font-mono text-gray-400">
          {c.bl_number && <p>{c.bl_number}</p>}
          {c.seal_no && <p className="text-gray-600">{c.seal_no}</p>}
        </div>
      ),
    },
    {
      key: 'cbm',
      label: 'CBM / CTN',
      render: (c: Container) => {
        const lim = CONTAINER_LIMITS[c.container_type]
        const pct = lim?.max_cbm ? Math.min(((c.cbm ?? 0) / lim.max_cbm) * 100, 100) : 0
        return (
          <div className="text-xs text-gray-300 min-w-[80px]">
            <p>{c.cbm ?? 0} CBM</p>
            <p className="text-gray-500">{c.cartons ?? 0} CTN</p>
            {lim?.max_cbm && (
              <div className="mt-1 h-1 bg-brand-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-brand-green'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'status',
      label: t('common.status'),
      render: (c: Container) => <Badge value={c.status} label={t(`containers.status.${c.status}`)} />,
    },
    {
      key: 'eta',
      label: 'ETA',
      render: (c: Container) => <span className="text-sm text-gray-400">{c.eta?.slice(0, 10) ?? '—'}</span>,
    },
    {
      key: 'actions',
      label: '',
      className: 'w-32',
      render: (c: Container) => isStaff && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCapacityModal(c)}
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-brand-green transition-colors"
            title="View capacity"
          >
            <BarChart2 size={14} />
          </button>
          <button
            onClick={() => { setStatusModal(c); setNewStatus(c.status) }}
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-brand-green transition-colors"
            title={t('containers.update_status')}
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => openEdit(c)}
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <Pencil size={14} />
          </button>
          {isAdmin && (
            <button
              onClick={() => setDeleting(c)}
              className="p-1.5 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('containers.title')}</h1>
          {data && <p className="text-sm text-gray-400 mt-0.5">{data.total} {t('common.results')}</p>}
        </div>
        {isStaff && (
          <Button onClick={openCreate}>
            <Plus size={16} />
            {t('containers.add')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={t('common.search')}
            className="input-base ps-9 w-full"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="input-base"
        >
          <option value="">{t('common.all_statuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{t(`containers.status.${s}`)}</option>
          ))}
        </select>
      </div>

      <Table
        columns={columns}
        data={data?.results ?? []}
        total={data?.total ?? 0}
        page={page}
        loading={isLoading}
        onPageChange={setPage}
        rowKey={(c) => c.id}
      />

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('containers.edit') : t('containers.add')}
        size="lg"
      >
        <form onSubmit={handleSubmit((v) => saveMut.mutate(v))} className="space-y-5">

          <FormSection title={t('containers.basic_info')}>
            <FormRow>
              <Select
                label={t('clients.title')}
                options={clientOptions}
                {...register('client_id', { required: true, valueAsNumber: true })}
                error={errors.client_id ? t('common.required') : undefined}
              />
              <Select
                label={t('containers.type')}
                options={CONTAINER_TYPES.map((v) => ({ value: v, label: v }))}
                {...register('container_type', { required: true })}
              />
            </FormRow>

            <Select
              label="Shipping Agent"
              options={agentOptions}
              {...register('shipping_agent_id', {
                setValueAs: (v) => (v === '' || v === '0' ? null : Number(v)),
              })}
            />

            {/* Container limits hint */}
            {limits && (
              <div className="text-xs text-gray-500 bg-brand-surface/50 rounded p-2 border border-brand-border">
                {watchType} limits: max <span className="text-gray-300">{limits.max_cbm ?? '—'} CBM</span> /
                max <span className="text-gray-300">{limits.max_weight_tons ?? '—'} tons</span>
              </div>
            )}

            <FormRow cols={3}>
              <Input
                type="number" label="CBM" step="0.01"
                {...register('cbm', { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
              />
              <Input
                type="number" label="Weight (kg)" step="0.01"
                {...register('net_weight', { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
              />
              <Input
                type="number" label="G.W. (kg)" step="0.01"
                {...register('gross_weight', { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
              />
            </FormRow>
            <FormRow>
              <Input
                type="number" label="Cartons (CTN)"
                {...register('cartons', { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
              />
              <Input
                type="number" label="Freight Cost (USD)" step="0.01"
                {...register('freight_cost', { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })}
              />
            </FormRow>
          </FormSection>

          <FormSection title="B/L & Seal">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">Fill manually or use OCR extraction</p>
              <Button
                type="button" variant="secondary" size="sm"
                onClick={() => setOcrModal(true)}
              >
                <ScanLine size={13} /> Extract via OCR
              </Button>
            </div>
            <FormRow>
              <Input label="Container No." placeholder="SEGU6361144" {...register('container_number')} />
              <Input label="Seal No." placeholder="M5796799" {...register('seal_no')} />
            </FormRow>
            <FormRow>
              <Input label="B/L No." placeholder="GGZ2848838" {...register('bl_number')} />
              <Select
                label="Cargo Mode"
                options={[
                  { value: '', label: '— Select —' },
                  { value: 'FCL', label: 'FCL' },
                  { value: 'LCL', label: 'LCL' },
                  { value: 'AIR', label: 'AIR' },
                ]}
                {...register('cargo_mode')}
              />
            </FormRow>

            {/* LCL toggle */}
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                className="rounded border-brand-border"
                {...register('is_lcl')}
              />
              <span className="text-sm text-gray-300">LCL Mode (multiple clients share this container)</span>
            </label>
          </FormSection>

          {/* LCL Clients */}
          {watchIsLcl && (
            <FormSection title="LCL Clients">
              <div className="space-y-3">
                {lclFields.map((field, i) => (
                  <div key={field.id} className="p-3 bg-brand-surface rounded-lg border border-brand-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Client #{i + 1}</span>
                      <button type="button" onClick={() => lclRemove(i)} className="text-red-400 hover:text-red-300">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <Select
                      label="Client"
                      options={clientOptions}
                      {...register(`lcl_clients.${i}.client_id`, { required: true, valueAsNumber: true })}
                    />
                    <FormRow cols={3}>
                      <Input type="number" label="CBM" step="0.01"
                        {...register(`lcl_clients.${i}.cbm`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })} />
                      <Input type="number" label="Cartons"
                        {...register(`lcl_clients.${i}.cartons`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })} />
                      <Input type="number" label="Freight Share ($)" step="0.01"
                        {...register(`lcl_clients.${i}.freight_share`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })} />
                    </FormRow>
                    <FormRow>
                      <Input type="number" label="G.W. (kg)" step="0.01"
                        {...register(`lcl_clients.${i}.gross_weight`, { valueAsNumber: true, setValueAs: v => v === '' ? null : Number(v) })} />
                      <Input label="Notes" {...register(`lcl_clients.${i}.notes`)} />
                    </FormRow>
                  </div>
                ))}
                <Button
                  type="button" variant="secondary" size="sm"
                  onClick={() => lclAppend({ client_id: 0, cbm: null, cartons: null, net_weight: null, gross_weight: null, freight_share: null, notes: '' })}
                >
                  <Plus size={13} /> Add Client to Container
                </Button>
              </div>
            </FormSection>
          )}

          <FormSection title="Shipping Terms">
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
          </FormSection>

          <FormSection title={t('containers.routing')}>
            <FormRow>
              <Select label={t('containers.origin_port')} options={portOptions} {...register('port_of_loading')} />
              <Select label={t('containers.destination_port')} options={portOptions} {...register('port_of_discharge')} />
            </FormRow>
            <FormRow>
              <Input type="date" label={t('containers.shipping_date')} {...register('etd')} />
              <Input type="date" label="ETA" {...register('eta')} />
            </FormRow>
          </FormSection>

          <Textarea label="Goods Description" rows={2} {...register('goods_description')} />
          <Input label={t('common.notes')} {...register('notes')} />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={saveMut.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* OCR Modal */}
      <Modal open={ocrModal} onClose={() => setOcrModal(false)} title="Extract Container Data via OCR" size="md">
        <OcrUploadPanel
          onExtracted={handleOcrResult}
          onClose={() => setOcrModal(false)}
        />
      </Modal>

      {/* Capacity Modal */}
      <Modal
        open={!!capacityModal}
        onClose={() => setCapacityModal(null)}
        title={`Capacity — ${capacityModal?.booking_number}`}
        size="md"
      >
        {capacityData ? (
          <ContainerCapacityBar capacity={capacityData} />
        ) : (
          <p className="text-sm text-gray-400">Loading...</p>
        )}
      </Modal>

      {/* Status update */}
      <Modal open={!!statusModal} onClose={() => setStatusModal(null)} title={t('containers.update_status')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">{statusModal?.booking_number}</p>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="input-base w-full"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{t(`containers.status.${s}`)}</option>
            ))}
          </select>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setStatusModal(null)}>{t('common.cancel')}</Button>
            <Button
              loading={statusMut.isPending}
              onClick={() => statusModal && statusMut.mutate({ id: statusModal.id, status: newStatus })}
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={t('common.confirm_delete')} size="sm">
        <p className="text-sm text-gray-300 mb-5">
          {t('containers.delete_confirm', { number: deleting?.booking_number })}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
          <Button
            variant="danger"
            loading={deleteMut.isPending}
            onClick={() => deleting && deleteMut.mutate(deleting.id)}
          >
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
