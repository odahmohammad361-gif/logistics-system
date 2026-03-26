import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Shield } from 'lucide-react'
import api from '@/services/api'
import { getBranches } from '@/services/branchService'
import { useAuth } from '@/hooks/useAuth'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { Input, Select, FormRow } from '@/components/ui/Form'
import { useForm } from 'react-hook-form'
import type { User, Branch } from '@/types'

interface FormValues {
  full_name: string
  email: string
  password: string
  role: string
  branch_id: string
}

const ROLES = ['viewer', 'staff', 'branch_manager', 'admin']

export default function UsersPage() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const qc = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users').then((r) => r.data),
  })

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: getBranches,
    staleTime: Infinity,
  })

  const { register, handleSubmit, reset, clearErrors, formState: { errors } } = useForm<FormValues>()

  const saveMut = useMutation({
    mutationFn: (v: FormValues) => {
      const payload: Record<string, unknown> = {
        full_name: v.full_name,
        email: v.email,
        role: v.role,
        branch_id: v.branch_id ? parseInt(v.branch_id) : null,
      }
      if (v.password) payload.password = v.password
      return editing
        ? api.patch(`/users/${editing.id}`, payload).then((r) => r.data)
        : api.post('/users', { ...payload, password: v.password }).then((r) => r.data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setModalOpen(false)
      setEditing(null)
      setSaveError(null)
    },
    onError: (err: any) => {
      setSaveError(err?.response?.data?.detail ?? 'Save failed')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setDeleting(null)
      setDeleteError(null)
    },
    onError: (err: any) => {
      setDeleteError(err?.response?.data?.detail ?? 'Delete failed')
    },
  })

  function openCreate() {
    setEditing(null)
    reset({ full_name: '', email: '', password: '', role: 'staff', branch_id: String(branches[0]?.id ?? '') })
    clearErrors()
    setModalOpen(true)
  }

  function openEdit(user: User) {
    setEditing(user)
    reset({
      full_name: user.full_name,
      email: user.email,
      password: '',
      role: user.role,
      branch_id: user.branch_id ? String(user.branch_id) : '',
    })
    clearErrors()
    setModalOpen(true)
  }

  function branchName(branch_id: number | null): Branch | undefined {
    return branches.find((b) => b.id === branch_id)
  }

  const branchOptions = [
    { value: '', label: '—' },
    ...branches.map((b) => ({ value: String(b.id), label: b.name })),
  ]

  const columns = [
    {
      key: 'full_name',
      label: t('users.full_name'),
      render: (u: User) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand-navy flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">
              {u.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm text-white">{u.full_name}</p>
            <p className="text-xs text-gray-500">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: t('users.role'),
      render: (u: User) => (
        <div className="flex items-center gap-1.5">
          <Shield size={12} className="text-gray-400" />
          <Badge
            value={u.role === 'admin' || u.role === 'super_admin' ? 'active' : u.role === 'branch_manager' ? 'approved' : 'draft'}
            label={t(`users.roles.${u.role}`)}
          />
        </div>
      ),
    },
    {
      key: 'branch',
      label: t('clients.branch'),
      render: (u: User) => {
        const b = branchName(u.branch_id)
        return b ? <Badge value={b.code} label={b.name} /> : <span className="text-gray-500">—</span>
      },
    },
    {
      key: 'is_active',
      label: t('common.status'),
      render: (u: User) => (
        <Badge
          value={u.is_active ? 'active' : 'cancelled'}
          label={u.is_active ? t('users.active') : t('users.inactive')}
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-20',
      render: (u: User) => isAdmin && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEdit(u)}
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleting(u)}
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
          <h1 className="page-title">{t('users.title')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{users.length} {t('common.results')}</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus size={16} />
            {t('users.add')}
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        data={users}
        total={users.length}
        loading={isLoading}
        rowKey={(u) => u.id}
      />

      {/* Modal — key forces fresh form on each open */}
      <Modal
        key={modalOpen ? (editing ? `edit-${editing.id}` : 'create') : 'closed'}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSaveError(null) }}
        title={editing ? t('users.edit') : t('users.add')}
        size="md"
      >
        <form onSubmit={handleSubmit((v) => saveMut.mutate(v))} className="space-y-4">
          {saveError && <p className="text-sm text-red-400">{saveError}</p>}
          <FormRow>
            <Input
              label={t('users.full_name')}
              {...register('full_name', { required: true })}
              error={errors.full_name ? t('common.required') : undefined}
            />
            <Input
              type="email"
              label={t('common.email')}
              {...register('email', { required: true })}
              error={errors.email ? t('common.required') : undefined}
              disabled={!!editing}
            />
          </FormRow>
          <FormRow>
            <Select
              label={t('users.role')}
              options={ROLES.map((r) => ({ value: r, label: t(`users.roles.${r}`) }))}
              {...register('role')}
            />
            <Select
              label={t('clients.branch')}
              options={branchOptions}
              {...register('branch_id')}
            />
          </FormRow>
          <Input
            type="password"
            label={t('auth.password')}
            placeholder={editing ? t('users.leave_blank') : undefined}
            {...register('password', { required: !editing })}
            error={errors.password ? t('common.required') : undefined}
          />

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
      <Modal open={!!deleting} onClose={() => { setDeleting(null); setDeleteError(null) }} title={t('common.confirm_delete')} size="sm">
        <p className="text-sm text-gray-300 mb-5">
          {t('users.delete_confirm', { username: deleting?.email })}
        </p>
        {deleteError && (
          <p className="text-sm text-red-400 mb-4">{deleteError}</p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => { setDeleting(null); setDeleteError(null) }}>{t('common.cancel')}</Button>
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
