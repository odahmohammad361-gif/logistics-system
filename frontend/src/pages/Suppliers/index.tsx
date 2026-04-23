import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, Store } from 'lucide-react'
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '@/services/supplierService'
import { useAuth } from '@/hooks/useAuth'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, FormRow, FormSection } from '@/components/ui/Form'
import { useForm } from 'react-hook-form'
import type { Supplier } from '@/types'

interface FormValues {
  code: string
  name: string
  name_ar: string
  market_location: string
  wechat_id: string
  phone: string
  notes: string
}

export default function SuppliersPage() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [deleting, setDeleting] = useState<Supplier | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', search],
    queryFn: () => getSuppliers(search ? { search } : undefined),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>()

  const saveMut = useMutation({
    mutationFn: (v: FormValues) =>
      editing ? updateSupplier(editing.id, v) : createSupplier(v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      setModalOpen(false)
      setEditing(null)
      reset()
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      setDeleting(null)
    },
  })

  function openCreate() {
    setEditing(null)
    reset({ code: '', name: '', name_ar: '', market_location: '', wechat_id: '', phone: '', notes: '' })
    setModalOpen(true)
  }

  function openEdit(s: Supplier) {
    setEditing(s)
    reset({
      code: s.code,
      name: s.name,
      name_ar: s.name_ar ?? '',
      market_location: s.market_location ?? '',
      wechat_id: s.wechat_id ?? '',
      phone: s.phone ?? '',
      notes: s.notes ?? '',
    })
    setModalOpen(true)
  }

  const columns = [
    {
      key: 'name',
      label: t('common.name'),
      render: (s: Supplier) => (
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-brand-primary/10 flex items-center justify-center">
            <Store size={13} className="text-brand-primary-light" />
          </div>
          <div>
            <p className="text-sm text-white font-medium">{s.name}</p>
            {s.name_ar && <p className="text-xs text-gray-500 font-arabic">{s.name_ar}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'code',
      label: t('suppliers.code'),
      render: (s: Supplier) => (
        <span className="text-xs font-mono bg-white/5 px-2 py-0.5 rounded">{s.code}</span>
      ),
    },
    {
      key: 'market_location',
      label: t('suppliers.market_location'),
      render: (s: Supplier) => (
        <span className="text-sm text-gray-400">{s.market_location || '—'}</span>
      ),
    },
    {
      key: 'wechat',
      label: t('suppliers.wechat'),
      render: (s: Supplier) => (
        <span className="text-sm text-gray-400">{s.wechat_id || '—'}</span>
      ),
    },
    {
      key: 'phone',
      label: t('common.phone'),
      render: (s: Supplier) => (
        <span className="text-sm text-gray-400">{s.phone || '—'}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-20',
      render: (s: Supplier) => isAdmin && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEdit(s)}
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleting(s)}
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
          <h1 className="page-title">{t('suppliers.title')}</h1>
          {data && <p className="text-sm text-gray-400 mt-0.5">{data.total} {t('common.results')}</p>}
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          {t('suppliers.add')}
        </Button>
      </div>

      <div className="relative w-full sm:max-w-xs">
        <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.search')}
          className="input-base ps-9 w-full"
        />
      </div>

      <Table
        columns={columns}
        data={data?.results ?? []}
        total={data?.total ?? 0}
        page={1}
        loading={isLoading}
        onPageChange={() => {}}
        rowKey={(s) => s.id}
      />

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        title={editing ? t('suppliers.edit') : t('suppliers.add')}
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
                label={t('suppliers.code')}
                placeholder="WI-001"
                {...register('code', { required: true })}
                error={errors.code ? t('common.required') : undefined}
              />
              <Input
                label={t('common.name')}
                {...register('name', { required: true })}
                error={errors.name ? t('common.required') : undefined}
              />
            </FormRow>
            <FormRow>
              <Input label="Arabic Name" {...register('name_ar')} />
              <Input label={t('suppliers.market_location')} placeholder="Shahe, Guangzhou" {...register('market_location')} />
            </FormRow>
          </FormSection>

          <FormSection title={t('common.contact')}>
            <FormRow>
              <Input label={t('suppliers.wechat')} {...register('wechat_id')} />
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

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={t('common.confirm_delete')} size="sm">
        <p className="text-sm text-gray-300 mb-5">
          {t('suppliers.delete_confirm', { name: deleting?.name })}
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
