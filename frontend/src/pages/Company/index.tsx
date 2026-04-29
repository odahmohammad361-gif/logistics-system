import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, MapPin, Phone, Globe, Mail, Plus, Pencil, Trash2, Warehouse } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '@/services/warehouseService'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, Select, FormRow, FormSection, Textarea } from '@/components/ui/Form'
import PhoneInput from '@/components/ui/PhoneInput'
import {
  localizedCountryOptions,
  localizedRegionOptions,
  normalizeCountryValue,
  validatePhoneValue,
} from '@/constants/contact'
import type { CompanyWarehouse } from '@/types'
import clsx from 'clsx'

const BRANCHES = [
  { key: 'china',  flag: '🇨🇳', name_ar: 'الفرع الصيني',   name_en: 'China Branch',  city: 'Guangzhou', details: 'Guangdong Province, China', phone: '', email: '' },
  { key: 'jordan', flag: '🇯🇴', name_ar: 'الفرع الأردني',  name_en: 'Jordan Branch', city: 'Amman',     details: 'Amman, Jordan',            phone: '', email: '' },
  { key: 'iraq',   flag: '🇮🇶', name_ar: 'الفرع العراقي', name_en: 'Iraq Branch',   city: 'Baghdad',   details: 'Baghdad, Iraq',            phone: '', email: '' },
]

interface WHForm {
  name: string
  name_ar: string
  warehouse_type: string
  country: string
  city: string
  address: string
  contact_name: string
  phone: string
  notes: string
}

export default function CompanyPage() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const { isAdmin } = useAuth()
  const qc = useQueryClient()

  const [whModal, setWhModal]       = useState(false)
  const [editingWH, setEditingWH]   = useState<CompanyWarehouse | null>(null)
  const [deletingWH, setDeletingWH] = useState<CompanyWarehouse | null>(null)

  const { data: whData } = useQuery({
    queryKey: ['warehouses'],
    queryFn:  () => getWarehouses(),
  })

  const whForm = useForm<WHForm>({ defaultValues: { warehouse_type: 'loading', country: 'China' } })
  const whCountry = whForm.watch('country')
  const whPhone = whForm.watch('phone')
  const phoneError = isAr ? 'رقم الهاتف يجب أن يكون 8 إلى 12 رقماً' : 'Phone number must be 8 to 12 digits'

  const saveMut = useMutation({
    mutationFn: (v: WHForm) => {
      const payload = { ...v, name_ar: v.name_ar || null, contact_name: v.contact_name || null, phone: v.phone || null, notes: v.notes || null }
      return editingWH ? updateWarehouse(editingWH.id, payload) : createWarehouse(payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouses'] }); setWhModal(false); setEditingWH(null) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteWarehouse(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouses'] }); setDeletingWH(null) },
  })

  function openCreate(type: 'loading' | 'unloading') {
    setEditingWH(null)
    whForm.reset({ warehouse_type: type, country: type === 'loading' ? 'China' : 'Jordan', city: '', phone: '' })
    setWhModal(true)
  }

  function openEdit(wh: CompanyWarehouse) {
    setEditingWH(wh)
    whForm.reset({
      name:           wh.name,
      name_ar:        wh.name_ar       ?? '',
      warehouse_type: wh.warehouse_type,
      country:        normalizeCountryValue(wh.country) || '',
      city:           wh.city          ?? '',
      address:        wh.address       ?? '',
      contact_name:   wh.contact_name  ?? '',
      phone:          wh.phone         ?? '',
      notes:          wh.notes         ?? '',
    })
    setWhModal(true)
  }

  const loadingWH   = (whData?.results ?? []).filter(w => w.warehouse_type === 'loading')
  const unloadingWH = (whData?.results ?? []).filter(w => w.warehouse_type === 'unloading')

  const warehouseTypeOptions = [
    { value: 'loading',   label: t('warehouses.type_loading') },
    { value: 'unloading', label: t('warehouses.type_unloading') },
  ]

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="page-title">{t('company.title')}</h1>

      {/* Company identity */}
      <div className="card space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-green flex items-center justify-center shrink-0">
            <span className="text-2xl font-black text-black">WI</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">胡萨姆贸易公司有限公司</h2>
            <p className="text-base text-gray-300">شركة أرض الوسام للتجارة والشحن</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-3 text-gray-400">
            <Building2 size={16} className="mt-0.5 shrink-0 text-brand-green" />
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{t('company.business_type')}</p>
              <p className="text-white">{t('company.freight_forwarding')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 text-gray-400">
            <Globe size={16} className="mt-0.5 shrink-0 text-brand-green" />
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{t('company.operating_regions')}</p>
              <p className="text-white">{t('company.china_jordan_iraq')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Branches */}
      <div>
        <h2 className="text-sm font-semibold text-brand-green border-b border-brand-border pb-2 mb-4">
          {t('company.branches')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {BRANCHES.map((branch) => (
            <div key={branch.key} className="card space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{branch.flag}</span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {isAr ? branch.name_ar : branch.name_en}
                  </p>
                  <p className="text-xs text-gray-500">{branch.city}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-gray-500" />
                  <span>{branch.details}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-gray-500" />
                  <span className="text-gray-600">{t('company.contact_pending')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Warehouses ──────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Loading warehouses (China) */}
        <div>
          <div className="flex items-center justify-between border-b border-brand-border pb-2 mb-3">
            <h2 className="text-sm font-semibold text-brand-green flex items-center gap-2">
              <Warehouse size={14} />
              {t('warehouses.loading_title')}
            </h2>
            {isAdmin && (
              <Button size="sm" variant="ghost" onClick={() => openCreate('loading')}>
                <Plus size={13} /> {t('warehouses.add')}
              </Button>
            )}
          </div>

          {loadingWH.length === 0 ? (
            <p className="text-xs text-brand-text-muted py-4 text-center">{t('common.no_data')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {loadingWH.map(wh => (
                <WarehouseCard key={wh.id} wh={wh} isAr={isAr} isAdmin={isAdmin ?? false} onEdit={openEdit} onDelete={setDeletingWH} />
              ))}
            </div>
          )}
        </div>

        {/* Unloading warehouses (Jordan / Iraq) */}
        <div>
          <div className="flex items-center justify-between border-b border-brand-border pb-2 mb-3">
            <h2 className="text-sm font-semibold text-brand-green flex items-center gap-2">
              <Warehouse size={14} />
              {t('warehouses.unloading_title')}
            </h2>
            {isAdmin && (
              <Button size="sm" variant="ghost" onClick={() => openCreate('unloading')}>
                <Plus size={13} /> {t('warehouses.add')}
              </Button>
            )}
          </div>

          {unloadingWH.length === 0 ? (
            <p className="text-xs text-brand-text-muted py-4 text-center">{t('common.no_data')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {unloadingWH.map(wh => (
                <WarehouseCard key={wh.id} wh={wh} isAr={isAr} isAdmin={isAdmin ?? false} onEdit={openEdit} onDelete={setDeletingWH} />
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-600 italic">{t('company.info_update_notice')}</p>

      {/* ── Warehouse Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={whModal}
        onClose={() => { setWhModal(false); setEditingWH(null) }}
        title={editingWH ? t('warehouses.edit') : t('warehouses.add')}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setWhModal(false); setEditingWH(null) }}>{t('common.cancel')}</Button>
            <Button onClick={whForm.handleSubmit(v => saveMut.mutate(v))} loading={saveMut.isPending}>
              {editingWH ? t('common.update') : t('common.create')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormSection title={t('common.name')}>
            <FormRow>
              <Input label={t('common.english')} {...whForm.register('name', { required: true })} error={whForm.formState.errors.name ? t('common.required') : undefined} />
              <Input label={t('common.arabic')} dir="rtl" {...whForm.register('name_ar')} />
            </FormRow>
          </FormSection>

          <FormRow>
            <Select
              label={t('common.status')}
              options={warehouseTypeOptions}
              {...whForm.register('warehouse_type')}
            />
            <Select
              label={t('common.country')}
              options={localizedCountryOptions(isAr)}
              placeholder="—"
              {...whForm.register('country')}
            />
          </FormRow>

          <FormRow>
            <Select
              label={isAr ? 'المحافظة / المنطقة' : 'Governorate / Region'}
              options={localizedRegionOptions(whCountry, isAr)}
              disabled={!whCountry}
              {...whForm.register('city')}
            />
            <PhoneInput
              label={t('common.phone')}
              value={whPhone}
              country={whCountry}
              onChange={(value) => whForm.setValue('phone', value, { shouldValidate: true, shouldDirty: true })}
              error={whForm.formState.errors.phone?.message}
            />
            <input type="hidden" {...whForm.register('phone', { validate: (v) => validatePhoneValue(v) || phoneError })} />
          </FormRow>

          <Textarea label={t('common.address')} {...whForm.register('address')} />
          <Input label={t('common.contact')} {...whForm.register('contact_name')} />
          <Textarea label={t('common.notes')} rows={2} {...whForm.register('notes')} />
        </div>
      </Modal>

      {/* ── Delete confirm ─────────────────────────────────────────────────── */}
      {deletingWH && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeletingWH(null)} />
          <div className="relative rounded-xl border border-brand-border bg-brand-card p-6 max-w-sm w-full space-y-4">
            <p className="text-sm text-brand-text">
              {t('warehouses.delete_confirm', { name: deletingWH.name })}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeletingWH(null)}>{t('common.cancel')}</Button>
              <Button variant="danger" size="sm" onClick={() => deleteMut.mutate(deletingWH.id)}>{t('common.delete')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function WarehouseCard({ wh, isAr, isAdmin, onEdit, onDelete }: {
  wh: CompanyWarehouse
  isAr: boolean
  isAdmin: boolean
  onEdit: (wh: CompanyWarehouse) => void
  onDelete: (wh: CompanyWarehouse) => void
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-brand-text">
            {isAr ? (wh.name_ar ?? wh.name) : wh.name}
          </p>
          {wh.country && <p className="text-[10px] text-brand-text-muted font-mono">{wh.country}</p>}
        </div>
        {isAdmin && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => onEdit(wh)} className="p-1.5 rounded text-brand-text-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-colors">
              <Pencil size={12} />
            </button>
            <button onClick={() => onDelete(wh)} className="p-1.5 rounded text-brand-text-muted hover:text-brand-red hover:bg-brand-red/10 transition-colors">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {(wh.city || wh.address) && (
        <div className="flex items-start gap-1.5 text-xs text-brand-text-muted">
          <MapPin size={11} className="mt-0.5 flex-shrink-0" />
          <span>{[wh.city, wh.address].filter(Boolean).join(' — ')}</span>
        </div>
      )}
      {wh.phone && (
        <div className="flex items-center gap-1.5 text-xs text-brand-text-muted">
          <Phone size={11} />
          <span>{wh.phone}</span>
        </div>
      )}
      {wh.contact_name && (
        <p className="text-xs text-brand-text-muted">{wh.contact_name}</p>
      )}
    </div>
  )
}
