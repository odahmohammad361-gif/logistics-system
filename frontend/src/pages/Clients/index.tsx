import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { getClients, createClient, updateClient, deleteClient } from '@/services/clientService'
import { getBranches } from '@/services/branchService'
import { useAuth } from '@/hooks/useAuth'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { Input, Select, FormRow, FormSection } from '@/components/ui/Form'
import { useForm } from 'react-hook-form'
import type { Client } from '@/types'

interface FormValues {
  name: string
  client_code: string
  phone: string
  email: string
  address: string
  city: string
  country: string
  branch_id: string   // string from select, we convert to int on submit
  notes: string
}

export default function ClientsPage() {
  const { t } = useTranslation()
  const { isStaff } = useAuth()
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState<Client | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { page, search }],
    queryFn: () => getClients({ page, page_size: 20, search: search || undefined, is_active: true }),
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: getBranches,
    staleTime: Infinity,
  })

  const { register, handleSubmit, reset, clearErrors, formState: { errors } } = useForm<FormValues>()

  const saveMut = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        client_code: values.client_code,
        phone: values.phone || undefined,
        email: values.email || undefined,
        address: values.address || undefined,
        city: values.city || undefined,
        country: values.country || undefined,
        branch_id: values.branch_id ? parseInt(values.branch_id) : undefined,
        notes: values.notes || undefined,
      }
      return editing ? updateClient(editing.id, payload) : createClient(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      setModalOpen(false)
      setEditing(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteClient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      setDeleting(null)
    },
  })

  function openCreate() {
    setEditing(null)
    reset({ name: '', client_code: '', phone: '', email: '', address: '', city: '', country: '', branch_id: String(branches[0]?.id ?? ''), notes: '' })
    clearErrors()
    setModalOpen(true)
  }

  function openEdit(client: Client) {
    setEditing(client)
    reset({
      name: client.name,
      client_code: client.client_code,
      phone: client.phone ?? '',
      email: client.email ?? '',
      address: client.address ?? '',
      city: client.city ?? '',
      country: client.country ?? '',
      branch_id: client.branch ? String(client.branch.id) : '',
      notes: client.notes ?? '',
    })
    clearErrors()
    setModalOpen(true)
  }

  const branchOptions = branches.map((b) => ({ value: String(b.id), label: b.name }))

  const columns = [
    {
      key: 'name',
      label: t('clients.name'),
      render: (c: Client) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-green/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-brand-green">{c.name.charAt(0)}</span>
          </div>
          <div>
            <p className="text-sm text-white font-medium">{c.name}</p>
            <p className="text-xs text-gray-500 font-mono">{c.client_code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'branch',
      label: t('clients.branch'),
      render: (c: Client) => c.branch ? (
        <Badge value={c.branch.code} label={c.branch.name} />
      ) : <span className="text-gray-500">—</span>,
    },
    {
      key: 'contact',
      label: t('clients.contact'),
      render: (c: Client) => (
        <div>
          {c.phone && <p className="text-sm text-gray-300">{c.phone}</p>}
          {c.email && <p className="text-xs text-gray-500">{c.email}</p>}
        </div>
      ),
    },
    {
      key: 'city',
      label: t('clients.city'),
      render: (c: Client) => <span className="text-sm text-gray-400">{c.city ?? '—'}</span>,
    },
    {
      key: 'actions',
      label: '',
      className: 'w-20',
      render: (c: Client) => isStaff && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEdit(c)}
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleting(c)}
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
          <h1 className="page-title">{t('clients.title')}</h1>
          {data && <p className="text-sm text-gray-400 mt-0.5">{data.total} {t('common.results')}</p>}
        </div>
        {isStaff && (
          <Button onClick={openCreate}>
            <Plus size={16} />
            {t('clients.add')}
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-xs">
        <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder={t('common.search')}
          className="input-base ps-9 w-full"
        />
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

      {/* Create / Edit Modal — key forces fresh form state on each open */}
      <Modal
        key={modalOpen ? (editing ? `edit-${editing.id}` : 'create') : 'closed'}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('clients.edit') : t('clients.add')}
        size="lg"
      >
        <form onSubmit={handleSubmit((v) => saveMut.mutate(v))} className="space-y-5">
          <FormSection title={t('clients.basic_info')}>
            <FormRow>
              <Input
                label={t('clients.name')}
                {...register('name', { required: true })}
                error={errors.name ? t('common.required') : undefined}
              />
              <Input
                label={t('clients.code')}
                {...register('client_code', { required: true })}
                error={errors.client_code ? t('common.required') : undefined}
              />
            </FormRow>
            <FormRow>
              <Input label={t('clients.phone')} {...register('phone')} />
              <Input type="email" label={t('clients.email')} {...register('email')} />
            </FormRow>
            <Select
              label={t('clients.branch')}
              options={branchOptions}
              {...register('branch_id')}
            />
          </FormSection>

          <FormSection title={t('clients.address')}>
            <Input label={t('clients.address')} {...register('address')} />
            <FormRow>
              <Input label={t('clients.city')} {...register('city')} />
              <Input label={t('clients.country')} {...register('country')} />
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

      {/* Delete Confirm */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t('common.confirm_delete')}
        size="sm"
      >
        <p className="text-sm text-gray-300 mb-5">
          {t('clients.delete_confirm', { name: deleting?.name })}
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
