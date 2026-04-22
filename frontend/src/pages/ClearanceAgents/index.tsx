import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { getClearanceAgents, createClearanceAgent, updateClearanceAgent, deleteClearanceAgent } from '@/services/agentService'
import { useAuth } from '@/hooks/useAuth'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, Select, FormRow, FormSection } from '@/components/ui/Form'
import { useForm } from 'react-hook-form'
import type { ClearanceAgent } from '@/types'

interface FormValues {
  name: string
  phone: string
  email: string
  country: string
  city: string
  license_number: string
  clearance_fee: number
  service_fee: number
  transport_fee: number
  handling_fee: number
  notes: string
}

const COUNTRIES = ['jordan', 'iraq', 'china', 'uae', 'saudi_arabia', 'other']

export default function ClearanceAgentsPage() {
  const { t } = useTranslation()
  const { isStaff, isAdmin } = useAuth()
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ClearanceAgent | null>(null)
  const [deleting, setDeleting] = useState<ClearanceAgent | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['clearance-agents', { page, search, countryFilter }],
    queryFn: () => getClearanceAgents({
      page, page_size: 20,
      search: search || undefined,
      country: countryFilter || undefined,
    }),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>()

  const saveMut = useMutation({
    mutationFn: (v: FormValues) =>
      editing ? updateClearanceAgent(editing.id, v) : createClearanceAgent(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clearance-agents'] })
      setModalOpen(false)
      setEditing(null)
      reset()
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteClearanceAgent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clearance-agents'] })
      setDeleting(null)
    },
  })

  function openCreate() {
    setEditing(null)
    reset({ clearance_fee: 0, service_fee: 0, transport_fee: 0, handling_fee: 0 })
    setModalOpen(true)
  }

  function openEdit(agent: ClearanceAgent) {
    setEditing(agent)
    reset({
      name: agent.name,
      phone: agent.phone ?? '',
      email: agent.email ?? '',
      country: agent.country ?? '',
      city: agent.city ?? '',
      license_number: agent.license_number ?? '',
      clearance_fee: Number(agent.clearance_fee ?? 0),
      service_fee: Number(agent.service_fee ?? 0),
      transport_fee: Number(agent.transport_fee ?? 0),
      handling_fee: Number(agent.handling_fee ?? 0),
      notes: agent.notes ?? '',
    })
    setModalOpen(true)
  }

  const columns = [
    {
      key: 'name',
      label: t('agents.name'),
      render: (a: ClearanceAgent) => (
        <div>
          <p className="text-sm text-white font-medium">{a.name}</p>
          
        </div>
      ),
    },
    {
      key: 'location',
      label: t('common.location'),
      render: (a: ClearanceAgent) => (
        <span className="text-sm text-gray-400">
          {[a.city, a.country].filter(Boolean).join(', ')}
        </span>
      ),
    },
    {
      key: 'contact',
      label: t('common.contact'),
      render: (a: ClearanceAgent) => (
        <div>
          {a.phone && <p className="text-sm text-gray-300">{a.phone}</p>}
          {a.email && <p className="text-xs text-gray-500">{a.email}</p>}
        </div>
      ),
    },
    {
      key: 'fees',
      label: t('agents.fees'),
      render: (a: ClearanceAgent) => (
        <div className="text-xs text-gray-300">
          {a.clearance_fee != null && <p>Clearance: ${a.clearance_fee}</p>}
          {(a as any).total_fixed_fees != null && (
            <p className="text-brand-green font-semibold">Total: ${(a as any).total_fixed_fees}</p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-20',
      render: (a: ClearanceAgent) => isStaff && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEdit(a)}
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <Pencil size={14} />
          </button>
          {isAdmin && (
            <button
              onClick={() => setDeleting(a)}
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
          <h1 className="page-title">{t('agents.clearance_title')}</h1>
          {data && <p className="text-sm text-gray-400 mt-0.5">{data.total} {t('common.results')}</p>}
        </div>
        {isStaff && (
          <Button onClick={openCreate}>
            <Plus size={16} />
            {t('agents.add')}
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
          value={countryFilter}
          onChange={(e) => { setCountryFilter(e.target.value); setPage(1) }}
          className="input-base"
        >
          <option value="">{t('common.all_countries')}</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
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
        rowKey={(a) => a.id}
      />

      {/* Create / Edit */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('agents.edit') : t('agents.add')}
        size="lg"
      >
        <form onSubmit={handleSubmit((v) => saveMut.mutate(v))} className="space-y-5">
          <FormSection title={t('agents.basic_info')}>
            <FormRow>
              <Input
                label={t('agents.name')}
                {...register('name', { required: true })}
                error={errors.name ? t('common.required') : undefined}
              />
            </FormRow>
            <FormRow>
              <Input label={t('common.phone')} {...register('phone')} />
              <Input type="email" label={t('common.email')} {...register('email')} />
            </FormRow>
            <Input label={t('agents.license_number')} {...register('license_number')} />
          </FormSection>

          <FormSection title={t('common.location')}>
            <FormRow>
              <Input label={t('common.city')} {...register('city')} />
              <Input label={t('common.country')} {...register('country')} />
            </FormRow>
          </FormSection>

          <FormSection title={t('agents.fees')}>
            <FormRow cols={2}>
              <Input type="number" step="0.01" label={t('agents.clearance_fee')} {...register('clearance_fee', { valueAsNumber: true })} />
              <Input type="number" step="0.01" label={t('agents.service_fee')} {...register('service_fee', { valueAsNumber: true })} />
            </FormRow>
            <FormRow cols={2}>
              <Input type="number" step="0.01" label={t('agents.transport_fee')} {...register('transport_fee', { valueAsNumber: true })} />
              <Input type="number" step="0.01" label={t('agents.handling_fee')} {...register('handling_fee', { valueAsNumber: true })} />
            </FormRow>
          </FormSection>

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

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={t('common.confirm_delete')} size="sm">
        <p className="text-sm text-gray-300 mb-5">
          {t('agents.delete_confirm', { name: deleting?.name })}
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
