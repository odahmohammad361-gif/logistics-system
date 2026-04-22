import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, Warehouse } from 'lucide-react'
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '@/services/warehouseService'
import { useAuth } from '@/hooks/useAuth'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, FormRow, FormSection } from '@/components/ui/Form'
import { useForm } from 'react-hook-form'
import type { CompanyWarehouse } from '@/types'

interface FormValues {
  name: string
  name_ar: string
  warehouse_type: 'loading' | 'unloading'
  country: string
  city: string
  address: string
  contact_name: string
  phone: string
  notes: string
}

export default function WarehousesPage() {
  const { t } = useTranslation()
  const { isStaff, isAdmin } = useAuth()
  const qc = useQueryClient()

  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CompanyWarehouse | null>(null)
  const [deleting, setDeleting] = useState<CompanyWarehouse | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['warehouses', { typeFilter }],
    queryFn: () => getWarehouses(typeFilter ? { warehouse_type: typeFilter } : undefined),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>()

  const saveMut = useMutation({
    mutationFn: (v: FormValues) =>
      editing ? updateWarehouse(editing.id, v) : createWarehouse(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] })
      setModalOpen(false)
      setEditing(null)
      reset()
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteWarehouse,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] })
      setDeleting(null)
    },
  })

  function openCreate() {
    setEditing(null)
    reset({ warehouse_type: 'loading' })
    setModalOpen(true)
  }

  function openEdit(wh: CompanyWarehouse) {
    setEditing(wh)
    reset({
      name: wh.name,
      name_ar: wh.name_ar ?? '',
      warehouse_type: wh.warehouse_type,
      country: wh.country ?? '',
      city: wh.city ?? '',
      address: wh.address ?? '',
      contact_name: wh.contact_name ?? '',
      phone: wh.phone ?? '',
      notes: wh.notes ?? '',
    })
    setModalOpen(true)
  }

  const filtered = (data?.results ?? []).filter((wh) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      wh.name.toLowerCase().includes(q) ||
      (wh.name_ar ?? '').toLowerCase().includes(q) ||
      (wh.city ?? '').toLowerCase().includes(q) ||
      (wh.country ?? '').toLowerCase().includes(q)
    )
  })

  const columns = [
    {
      key: 'name',
      label: t('common.name'),
      render: (wh: CompanyWarehouse) => (
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-brand-primary/10 flex items-center justify-center">
            <Warehouse size={13} className="text-brand-primary-light" />
          </div>
          <div>
            <p className="text-sm text-white font-medium">{wh.name}</p>
            {wh.name_ar && <p className="text-xs text-gray-500 font-arabic">{wh.name_ar}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      label: t('common.status'),
      render: (wh: CompanyWarehouse) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          wh.warehouse_type === 'loading'
            ? 'bg-blue-500/10 text-blue-400'
            : 'bg-emerald-500/10 text-emerald-400'
        }`}>
          {wh.warehouse_type === 'loading' ? t('warehouses.type_loading') : t('warehouses.type_unloading')}
        </span>
      ),
    },
    {
      key: 'location',
      label: t('common.location'),
      render: (wh: CompanyWarehouse) => (
        <span className="text-sm text-gray-400">
          {[wh.city, wh.country].filter(Boolean).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'contact',
      label: t('common.contact'),
      render: (wh: CompanyWarehouse) => (
        <div>
          {wh.contact_name && <p className="text-sm text-gray-300">{wh.contact_name}</p>}
          {wh.phone && <p className="text-xs text-gray-500">{wh.phone}</p>}
        </div>
      ),
    },
    {
      key: 'address',
      label: t('common.address'),
      render: (wh: CompanyWarehouse) => (
        <span className="text-xs text-gray-500 max-w-[200px] truncate block">{wh.address || '—'}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-20',
      render: (wh: CompanyWarehouse) => isAdmin && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEdit(wh)}
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleting(wh)}
            className="p-1.5 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('warehouses.title')}</h1>
          {data && <p className="text-sm text-gray-400 mt-0.5">{data.total} {t('common.results')}</p>}
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus size={16} />
            {t('warehouses.add')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="input-base ps-9 w-full"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="input-base"
        >
          <option value="">{t('common.all')}</option>
          <option value="loading">{t('warehouses.type_loading')}</option>
          <option value="unloading">{t('warehouses.type_unloading')}</option>
        </select>
      </div>

      <Table
        columns={columns}
        data={filtered}
        total={filtered.length}
        page={1}
        loading={isLoading}
        onPageChange={() => {}}
        rowKey={(wh) => wh.id}
      />

      {/* Create / Edit */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        title={editing ? t('warehouses.edit') : t('warehouses.add')}
        size="lg"
      >
        <form onSubmit={handleSubmit((v) => saveMut.mutate(v))} className="space-y-5">
          {saveMut.isError && (
            <div className="px-3 py-2 rounded-lg bg-brand-red/10 border border-brand-red/30 text-xs text-brand-red">
              {(saveMut.error as any)?.response?.data?.detail ?? t('common.required')}
            </div>
          )}

          <FormSection title={t('agents.basic_info')}>
            <FormRow>
              <Input
                label={t('common.name')}
                {...register('name', { required: true })}
                error={errors.name ? t('common.required') : undefined}
              />
              <Input label="Arabic Name" {...register('name_ar')} />
            </FormRow>
            <div className="space-y-1.5">
              <label className="label-base">Type</label>
              <select
                className="input-base w-full"
                {...register('warehouse_type', { required: true })}
              >
                <option value="loading">{t('warehouses.type_loading')}</option>
                <option value="unloading">{t('warehouses.type_unloading')}</option>
              </select>
              {errors.warehouse_type && <p className="text-xs text-brand-red">{t('common.required')}</p>}
            </div>
          </FormSection>

          <FormSection title={t('common.location')}>
            <FormRow>
              <Input label={t('common.city')} {...register('city')} />
              <Input label={t('common.country')} {...register('country')} />
            </FormRow>
            <Input label={t('common.address')} {...register('address')} />
          </FormSection>

          <FormSection title={t('common.contact')}>
            <FormRow>
              <Input label={t('common.name')} {...register('contact_name')} />
              <Input label={t('common.phone')} {...register('phone')} />
            </FormRow>
          </FormSection>

          <Input label={t('common.notes')} {...register('notes')} />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); setEditing(null) }}>
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
          {t('warehouses.delete_confirm', { name: deleting?.name })}
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
