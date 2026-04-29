import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Anchor, BadgeCheck, ExternalLink, Mail, MapPin, Pencil, Phone, Plus, Search, Ship, Trash2, Wind } from 'lucide-react'
import { getClearanceAgents, createClearanceAgent, updateClearanceAgent, deleteClearanceAgent } from '@/services/agentService'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, Select, FormRow, FormSection, Textarea } from '@/components/ui/Form'
import PhoneInput from '@/components/ui/PhoneInput'
import {
  localizedCountryOptions,
  localizedRegionOptions,
  normalizeCountryValue,
  validateEmailValue,
  validatePhoneValue,
} from '@/constants/contact'
import { useForm } from 'react-hook-form'
import type { ClearanceAgent } from '@/types'

interface FormValues {
  name: string
  name_ar: string
  contact_person: string
  phone: string
  whatsapp: string
  email: string
  country: string
  city: string
  address: string
  license_number: string
  bank_name: string
  bank_account: string
  bank_swift: string
  notes: string
}

const COUNTRIES = ['Jordan', 'Iraq', 'China', 'UAE', 'Saudi Arabia', 'Other']

function money(v: number | null | undefined, decimals = 0) {
  if (v == null) return null
  return `$${Number(v).toFixed(decimals)}`
}

function preferred(sell: number | null | undefined, buy: number | null | undefined) {
  return sell ?? buy ?? null
}

export default function ClearanceAgentsPage() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const { isStaff, isAdmin } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()

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

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>()
  const selectedCountry = watch('country')
  const phoneValue = watch('phone')
  const whatsappValue = watch('whatsapp')
  const phoneError = isAr ? 'رقم الهاتف يجب أن يكون 8 إلى 12 رقماً' : 'Phone number must be 8 to 12 digits'
  const emailError = isAr ? 'صيغة البريد الإلكتروني غير صحيحة' : 'Enter a valid email address'
  const countryOptions = localizedCountryOptions(isAr)
  const cityOptions = localizedRegionOptions(selectedCountry, isAr)

  const saveMut = useMutation({
    mutationFn: (v: FormValues) => {
      const payload = {
        name: v.name,
        name_ar: v.name_ar || null,
        contact_person: v.contact_person || null,
        phone: v.phone || null,
        whatsapp: v.whatsapp || null,
        email: v.email || null,
        country: v.country || null,
        city: v.city || null,
        address: v.address || null,
        license_number: v.license_number || null,
        bank_name: v.bank_name || null,
        bank_account: v.bank_account || null,
        bank_swift: v.bank_swift || null,
        notes: v.notes || null,
      }
      return editing ? updateClearanceAgent(editing.id, payload) : createClearanceAgent(payload)
    },
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
    reset({
      name: '', name_ar: '', contact_person: '',
      phone: '', whatsapp: '', email: '',
      country: 'Jordan', city: '', address: '',
      license_number: '', bank_name: '', bank_account: '', bank_swift: '',
      notes: '',
    })
    setModalOpen(true)
  }

  function openEdit(agent: ClearanceAgent) {
    setEditing(agent)
    reset({
      name: agent.name,
      name_ar: agent.name_ar ?? '',
      contact_person: agent.contact_person ?? '',
      phone: agent.phone ?? '',
      whatsapp: agent.whatsapp ?? '',
      email: agent.email ?? '',
      country: normalizeCountryValue(agent.country) || 'Jordan',
      city: agent.city ?? '',
      address: agent.address ?? '',
      license_number: agent.license_number ?? '',
      bank_name: agent.bank_name ?? '',
      bank_account: agent.bank_account ?? '',
      bank_swift: agent.bank_swift ?? '',
      notes: agent.notes ?? '',
    })
    setModalOpen(true)
  }

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
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.02] h-56 animate-pulse" />)}
        </div>
      ) : (data?.results ?? []).length === 0 ? (
        <div className="card py-16 text-center text-gray-500 text-sm">{t('common.no_data')}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {(data?.results ?? []).map((agent) => (
            <div key={agent.id} className="rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex flex-col overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b border-white/5 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300">
                      <Anchor size={9} /> CLEARANCE
                    </span>
                    {agent.country && <span className="text-[10px] text-gray-500">{agent.country}</span>}
                  </div>
                  <p className="text-sm font-bold text-white truncate">{agent.name}</p>
                  {agent.name_ar && <p className="text-xs text-gray-500 truncate">{agent.name_ar}</p>}
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/clearance-agents/${agent.id}`)}
                    className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-brand-primary-light transition-colors"
                    title={isAr ? 'الملف الشخصي' : 'Profile'}
                  >
                    <ExternalLink size={13} />
                  </button>
                  {isStaff && (
                    <button onClick={() => openEdit(agent)} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-white transition-colors">
                      <Pencil size={13} />
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => setDeleting(agent)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="px-4 py-3 flex flex-col gap-2.5 flex-1">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {agent.phone && <span className="text-[11px] text-gray-500 flex items-center gap-1"><Phone size={10} />{agent.phone}</span>}
                  {agent.email && <span className="text-[11px] text-gray-500 flex items-center gap-1"><Mail size={10} />{agent.email}</span>}
                  {(agent.city || agent.country) && <span className="text-[11px] text-gray-500 flex items-center gap-1"><MapPin size={10} />{[agent.city, agent.country].filter(Boolean).join(', ')}</span>}
                </div>

                {agent.license_number && (
                  <span className="self-start text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <BadgeCheck size={10} /> {agent.license_number}
                  </span>
                )}

                {(agent.rates ?? []).length > 0 ? (
                  <div className="space-y-1.5">
                    {(agent.rates ?? []).slice(0, 3).map((rate) => {
                      const clearance = preferred(rate.sell_clearance_fee, rate.buy_clearance_fee)
                      const transport = preferred(rate.sell_transportation, rate.buy_transportation)
                      const Icon = rate.service_mode === 'air' ? Wind : Ship
                      return (
                        <div key={rate.id} className="rounded-xl border border-white/8 bg-white/[0.025] px-2.5 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-white truncate flex items-center gap-1.5">
                              <Icon size={10} className={rate.service_mode === 'air' ? 'text-violet-300' : 'text-blue-300'} />
                              {rate.service_mode.toUpperCase()}
                            </span>
                            {(rate.port || rate.route || rate.container_size || rate.carrier_name) && (
                              <span className="text-[9px] text-gray-500 truncate">
                                {[rate.port, rate.container_size, rate.carrier_name].filter(Boolean).join(' · ')}
                                {rate.route ? ` → ${rate.route}` : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {clearance != null && <span className="text-[10px] bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full">Clearance {money(clearance)}</span>}
                            {transport != null && <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full">Transport {money(transport)}</span>}
                            {rate.sell_import_export_card_pct != null && <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-full">Card {rate.sell_import_export_card_pct}%</span>}
                          </div>
                        </div>
                      )
                    })}
                    {(agent.rates ?? []).length > 3 && (
                      <button type="button" onClick={() => navigate(`/clearance-agents/${agent.id}`)} className="text-[10px] text-brand-primary-light hover:underline">
                        +{(agent.rates ?? []).length - 3} {isAr ? 'أسعار أخرى' : 'more rates'}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500">{isAr ? 'لا توجد أسعار تخليص بعد' : 'No clearance rates yet'}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(data?.total ?? 0) > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('common.prev')}</Button>
          <Button variant="secondary" size="sm" disabled={page * 20 >= (data?.total ?? 0)} onClick={() => setPage(p => p + 1)}>{t('common.next')}</Button>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('agents.edit') : t('agents.add')} size="lg">
        <form onSubmit={handleSubmit((v) => saveMut.mutate(v))} className="space-y-5">
          <FormSection title={t('agents.basic_info')}>
            <FormRow>
              <Input label={t('agents.name')} {...register('name', { required: true })} error={errors.name ? t('common.required') : undefined} />
              <Input label={isAr ? 'الاسم العربي' : 'Arabic Name'} {...register('name_ar')} />
            </FormRow>
            <Input label={isAr ? 'الشخص المسؤول' : 'Contact Person'} {...register('contact_person')} />
            <input type="hidden" {...register('phone', { validate: (v) => validatePhoneValue(v) || phoneError })} />
            <input type="hidden" {...register('whatsapp', { validate: (v) => validatePhoneValue(v) || phoneError })} />
            <FormRow>
              <PhoneInput
                label={t('common.phone')}
                value={phoneValue}
                country={selectedCountry}
                onChange={(value) => setValue('phone', value, { shouldValidate: true, shouldDirty: true })}
                error={errors.phone?.message}
              />
              <PhoneInput
                label="WhatsApp"
                value={whatsappValue}
                country={selectedCountry}
                onChange={(value) => setValue('whatsapp', value, { shouldValidate: true, shouldDirty: true })}
                error={errors.whatsapp?.message}
              />
            </FormRow>
            <Input type="email" label={t('common.email')} {...register('email', { validate: (v) => validateEmailValue(v) || emailError })} error={errors.email?.message} />
            <Input label={t('agents.license_number')} {...register('license_number')} />
          </FormSection>

          <FormSection title={t('common.location')}>
            <FormRow>
              <Select label={t('common.country')} options={countryOptions} {...register('country')} />
              <Select
                label={isAr ? 'المحافظة / المنطقة' : 'Governorate / Region'}
                options={cityOptions}
                disabled={!selectedCountry}
                {...register('city')}
              />
            </FormRow>
            <Textarea label={isAr ? 'العنوان' : 'Address'} {...register('address')} />
          </FormSection>

          <FormSection title={isAr ? 'البنك' : 'Bank Details'}>
            <Input label={isAr ? 'اسم البنك' : 'Bank Name'} {...register('bank_name')} />
            <FormRow>
              <Input label={isAr ? 'رقم الحساب' : 'Account'} {...register('bank_account')} />
              <Input label="SWIFT" {...register('bank_swift')} />
            </FormRow>
          </FormSection>

          <Textarea label={t('common.notes')} {...register('notes')} />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saveMut.isPending}>{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={t('common.confirm_delete')} size="sm">
        <p className="text-sm text-gray-300 mb-5">{t('agents.delete_confirm', { name: deleting?.name })}</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={deleteMut.isPending} onClick={() => deleting && deleteMut.mutate(deleting.id)}>{t('common.delete')}</Button>
        </div>
      </Modal>
    </div>
  )
}
