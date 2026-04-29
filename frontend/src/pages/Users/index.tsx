import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, UserCog, Shield } from 'lucide-react'
import api from '@/services/api'
import { getBranches } from '@/services/branchService'
import { useAuth } from '@/hooks/useAuth'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { Input, Select, FormRow } from '@/components/ui/Form'
import { validateEmailValue } from '@/constants/contact'
import { useForm } from 'react-hook-form'
import type { User, Branch } from '@/types'

interface FormValues {
  full_name: string; email: string; password: string; role: string; branch_id: string
}

const ROLES = ['viewer', 'staff', 'branch_manager', 'admin']

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'indigo', admin: 'indigo', branch_manager: 'blue', staff: 'green', viewer: 'gray',
}

export default function UsersPage() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const qc = useQueryClient()

  const [modalOpen, setModal]   = useState(false)
  const [editing, setEditing]   = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [saveError, setSaveErr] = useState<string | null>(null)
  const [delError, setDelErr]   = useState<string | null>(null)

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users').then((r) => r.data),
  })

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'], queryFn: getBranches, staleTime: Infinity,
  })

  const { register, handleSubmit, reset, clearErrors, formState: { errors } } = useForm<FormValues>()
  const emailError = t('common.invalid_email', 'Enter a valid email address')

  const saveMut = useMutation({
    mutationFn: (v: FormValues) => {
      const p: Record<string, unknown> = { full_name: v.full_name, email: v.email, role: v.role, branch_id: v.branch_id ? parseInt(v.branch_id) : null }
      if (v.password) p.password = v.password
      return editing
        ? api.patch(`/users/${editing.id}`, p).then((r) => r.data)
        : api.post('/users', { ...p, password: v.password }).then((r) => r.data)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setModal(false); setSaveErr(null) },
    onError: (e: any) => setSaveErr(e?.response?.data?.detail ?? 'Save failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setDeleting(null); setDelErr(null) },
    onError: (e: any) => setDelErr(e?.response?.data?.detail ?? 'Delete failed'),
  })

  function openCreate() {
    setEditing(null)
    reset({ full_name: '', email: '', password: '', role: 'staff', branch_id: String(branches[0]?.id ?? '') })
    clearErrors(); setSaveErr(null); setModal(true)
  }
  function openEdit(u: User) {
    setEditing(u)
    reset({ full_name: u.full_name, email: u.email, password: '', role: u.role, branch_id: u.branch_id ? String(u.branch_id) : '' })
    clearErrors(); setSaveErr(null); setModal(true)
  }

  const branchOptions = [{ value: '', label: '—' }, ...branches.map((b) => ({ value: String(b.id), label: b.name }))]

  const columns = [
    {
      key: 'full_name', label: t('users.full_name', 'المستخدم'),
      render: (u: User) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-brand-primary-light"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
            {u.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-text">{u.full_name}</p>
            <p className="text-xs text-brand-text-muted">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role', label: t('users.role', 'الدور'),
      render: (u: User) => (
        <div className="flex items-center gap-1.5">
          <Shield size={12} className="text-brand-text-muted" />
          <Badge value={ROLE_BADGE[u.role] ?? 'gray'} label={t(`users.roles.${u.role}`, u.role)} />
        </div>
      ),
    },
    {
      key: 'branch', label: t('clients.branch', 'الفرع'),
      render: (u: User) => {
        const b = branches.find((br) => br.id === u.branch_id)
        return b ? <Badge value={b.code} label={b.name} /> : <span className="text-brand-text-muted">—</span>
      },
    },
    {
      key: 'is_active', label: t('common.status', 'الحالة'),
      render: (u: User) => (
        <Badge value={u.is_active ? 'active' : 'cancelled'} label={u.is_active ? t('users.active', 'نشط') : t('users.inactive', 'غير نشط')} />
      ),
    },
    {
      key: 'actions', label: '', className: 'w-20',
      render: (u: User) => isAdmin && (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(u)} className="btn-icon"><Pencil size={14} /></button>
          <button onClick={() => setDeleting(u)} className="btn-icon hover:text-brand-red hover:bg-brand-red/10"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <UserCog size={15} className="text-brand-primary-light" />
            </div>
            <h1 className="page-title">{t('users.title', 'المستخدمون')}</h1>
          </div>
          <p className="text-xs text-brand-text-muted mt-1 ms-10">{users.length} {t('common.results', 'مستخدم')}</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}><Plus size={15} />{t('users.add', 'مستخدم جديد')}</Button>
        )}
      </div>

      <Table columns={columns} data={users} total={users.length} loading={isLoading} rowKey={(u) => u.id} />

      {/* Create/Edit Modal */}
      <Modal
        key={modalOpen ? (editing ? `edit-${editing.id}` : 'create') : 'closed'}
        open={modalOpen} onClose={() => { setModal(false); setSaveErr(null) }}
        title={editing ? t('users.edit', 'تعديل المستخدم') : t('users.add', 'مستخدم جديد')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>{t('common.cancel', 'إلغاء')}</Button>
            <Button loading={saveMut.isPending} onClick={handleSubmit((v) => saveMut.mutate(v))}>{t('common.save', 'حفظ')}</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit((v) => saveMut.mutate(v))} className="space-y-4">
          {saveError && (
            <div className="text-sm text-brand-red bg-brand-red/8 border border-brand-red/20 rounded-lg px-3 py-2">{saveError}</div>
          )}
          <FormRow>
            <Input label={t('users.full_name', 'الاسم')} {...register('full_name', { required: true })} error={errors.full_name ? t('common.required', 'مطلوب') : undefined} />
            <Input
              type="email"
              label={t('common.email', 'البريد الإلكتروني')}
              {...register('email', { required: true, validate: (v) => validateEmailValue(v, false) || emailError })}
              error={errors.email ? (errors.email.message || t('common.required', 'مطلوب')) : undefined}
              disabled={!!editing}
            />
          </FormRow>
          <FormRow>
            <Select label={t('users.role', 'الدور')} options={ROLES.map((r) => ({ value: r, label: t(`users.roles.${r}`, r) }))} {...register('role')} />
            <Select label={t('clients.branch', 'الفرع')} options={branchOptions} {...register('branch_id')} />
          </FormRow>
          <Input
            type="password" label={t('auth.password', 'كلمة المرور')}
            placeholder={editing ? t('users.leave_blank', 'اتركه فارغاً إن لم تريد تغييره') : undefined}
            {...register('password', { required: !editing })}
            error={errors.password ? t('common.required', 'مطلوب') : undefined}
          />
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => { setDeleting(null); setDelErr(null) }} title={t('common.confirm_delete', 'تأكيد الحذف')} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setDeleting(null); setDelErr(null) }}>{t('common.cancel', 'إلغاء')}</Button>
            <Button variant="danger" loading={deleteMut.isPending} onClick={() => deleting && deleteMut.mutate(deleting.id)}>{t('common.delete', 'حذف')}</Button>
          </>
        }
      >
        {delError && <div className="text-sm text-brand-red mb-3">{delError}</div>}
        <p className="text-sm text-brand-text-dim">{t('users.delete_confirm', { username: deleting?.email })}</p>
      </Modal>
    </div>
  )
}
