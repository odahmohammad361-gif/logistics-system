import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Ship, Wind, ExternalLink } from 'lucide-react'
import {
  getAgents, createAgent, updateAgent, deleteAgent,
} from '@/services/agentService'
import { getWarehouses } from '@/services/warehouseService'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { Input, Select, FormRow, FormSection } from '@/components/ui/Form'
import { useForm } from 'react-hook-form'
import type { ShippingAgent } from '@/types'
import { getFlatPortOptions } from '@/constants/logistics'
import clsx from 'clsx'

const SEA_PORT_OPTIONS = getFlatPortOptions('sea')
const COMMON_SEA_CARRIERS = [
  'CMA CGM', 'MSC', 'Evergreen', 'PIL', 'COSCO', 'Yang Ming',
  'Hapag-Lloyd', 'ONE', 'HMM', 'ZIM', 'OOCL', 'Maersk', 'Wan Hai',
]

// ── Static location data ───────────────────────────────────────────────────────
const AGENT_COUNTRIES = [
  { value: 'China',        label: '🇨🇳 China' },
  { value: 'Jordan',       label: '🇯🇴 Jordan' },
  { value: 'Iraq',         label: '🇮🇶 Iraq' },
  { value: 'UAE',          label: '🇦🇪 UAE' },
  { value: 'Turkey',       label: '🇹🇷 Turkey' },
  { value: 'Saudi Arabia', label: '🇸🇦 Saudi Arabia' },
  { value: 'Kuwait',       label: '🇰🇼 Kuwait' },
  { value: 'Qatar',        label: '🇶🇦 Qatar' },
  { value: 'Bahrain',      label: '🇧🇭 Bahrain' },
  { value: 'Oman',         label: '🇴🇲 Oman' },
  { value: 'Egypt',        label: '🇪🇬 Egypt' },
  { value: 'Germany',      label: '🇩🇪 Germany' },
  { value: 'Netherlands',  label: '🇳🇱 Netherlands' },
  { value: 'USA',          label: '🇺🇸 USA' },
  { value: 'Other',        label: '🌍 Other' },
]

const CITIES_BY_COUNTRY: Record<string, string[]> = {
  China:        ['Guangzhou', 'Shenzhen', 'Shanghai', 'Foshan', 'Dongguan', 'Yiwu', 'Ningbo', 'Hangzhou', 'Qingdao', 'Tianjin', 'Chengdu', 'Wuhan'],
  Jordan:       ['Amman', 'Aqaba', 'Zarqa', 'Irbid', 'Jerash'],
  Iraq:         ['Baghdad', 'Basra', 'Erbil', 'Mosul', 'Najaf', 'Umm Qasr'],
  UAE:          ['Dubai', 'Abu Dhabi', 'Sharjah', 'Jebel Ali'],
  Turkey:       ['Istanbul', 'Mersin', 'Ankara', 'Izmir'],
  'Saudi Arabia': ['Riyadh', 'Jeddah', 'Dammam', 'Jubail'],
  Kuwait:       ['Kuwait City', 'Shuwaikh'],
  Qatar:        ['Doha', 'Hamad Port'],
  Bahrain:      ['Manama', 'Khalifa Bin Salman Port'],
  Oman:         ['Muscat', 'Sohar', 'Salalah'],
  Egypt:        ['Cairo', 'Alexandria', 'Port Said'],
  Germany:      ['Hamburg', 'Bremen', 'Frankfurt', 'Berlin'],
  Netherlands:  ['Rotterdam', 'Amsterdam'],
  USA:          ['Los Angeles', 'New York', 'Chicago', 'Houston'],
  Other:        [],
}

interface AgentForm {
  name: string
  phone: string
  email: string
  wechat_id: string
  country: string
  warehouse_city: string
  warehouse_address: string
  serves_sea: boolean
  serves_air: boolean
  offer_valid_from: string
  offer_valid_to: string
  // Buy prices (from agent)
  price_20gp:   number | ''
  price_40ft:   number | ''
  price_40hq:   number | ''
  price_air_kg: number | ''
  buy_lcl_cbm:  number | ''
  // Sell prices (to clients)
  sell_price_20gp:   number | ''
  sell_price_40ft:   number | ''
  sell_price_40hq:   number | ''
  sell_price_air_kg: number | ''
  sell_lcl_cbm:      number | ''
  // Calculator helpers — not sent to server
  markup_sea: number | ''
  markup_air: number | ''
  cbm_rate_buy: number | ''
  transit_sea_days: number | ''
  transit_air_days: number | ''
  notes: string
}


export default function ShippingAgentsPage() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const { isStaff, isAdmin } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()

  // Company loading warehouses for address dropdown
  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-loading-agents'],
    queryFn: () => getWarehouses({ warehouse_type: 'loading', page_size: 100 }),
    staleTime: Infinity,
  })

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [agentModal, setAgentModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState<ShippingAgent | null>(null)
  const [deletingAgent, setDeletingAgent] = useState<ShippingAgent | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['agents', { page, search }],
    queryFn: () => getAgents({ page, page_size: 20, search: search || undefined }),
  })

  const agentForm = useForm<AgentForm>()

  // Watch country to update city options
  const watchCountry = agentForm.watch('country')
  const cityOptions = [
    { value: '', label: isAr ? '— اختر مدينة —' : '— Select city —' },
    ...(CITIES_BY_COUNTRY[watchCountry] ?? []).map(c => ({ value: c, label: c })),
  ]
  const countryOptions = [
    { value: '', label: isAr ? '— اختر دولة —' : '— Select country —' },
    ...AGENT_COUNTRIES.map(c => ({ value: c.value, label: c.label })),
  ]
  const warehouseOptions = [
    { value: '', label: isAr ? '— اختر مستودعاً —' : '— Select warehouse —' },
    ...(warehousesData?.results ?? []).map(w => ({
      value: `${w.city ?? ''}||${w.address ?? ''}`,
      label: `${w.name}${w.city ? ` · ${w.city}` : ''}`,
    })),
  ]

  const CBM_CAP = { '20gp': 28, '40ft': 67, '40hq': 76 }

  // Watch buy prices and markup to auto-fill sell prices
  const [buy20, buy40ft, buy40hq, buyAir, buyLcl, markupSea, markupAir] = agentForm.watch([
    'price_20gp', 'price_40ft', 'price_40hq', 'price_air_kg', 'buy_lcl_cbm', 'markup_sea', 'markup_air',
  ])
  function applyMarkupSea() {
    const pct = parseFloat(String(markupSea))
    if (!pct) return
    if (buy20)   agentForm.setValue('sell_price_20gp', Number((Number(buy20)   * (1 + pct / 100)).toFixed(2)))
    if (buy40ft) agentForm.setValue('sell_price_40ft', Number((Number(buy40ft) * (1 + pct / 100)).toFixed(2)))
    if (buy40hq) agentForm.setValue('sell_price_40hq', Number((Number(buy40hq) * (1 + pct / 100)).toFixed(2)))
    if (buyLcl)  agentForm.setValue('sell_lcl_cbm',    Number((Number(buyLcl)  * (1 + pct / 100)).toFixed(2)))
  }
  function applyMarkupAir() {
    const pct = parseFloat(String(markupAir))
    if (!pct || !buyAir) return
    agentForm.setValue('sell_price_air_kg', Number((Number(buyAir) * (1 + pct / 100)).toFixed(2)))
  }

  const saveAgentMut = useMutation({
    mutationFn: (v: AgentForm) => {
      const n = (x: number | '') => (x !== '' ? Number(x) : null)
      const payload = {
        name: v.name, phone: v.phone, email: v.email, wechat_id: v.wechat_id,
        country: v.country, warehouse_city: v.warehouse_city, warehouse_address: v.warehouse_address,
        serves_sea: v.serves_sea, serves_air: v.serves_air,
        offer_valid_from: v.offer_valid_from || null,
        offer_valid_to:   v.offer_valid_to   || null,
        price_20gp: n(v.price_20gp),   price_40ft: n(v.price_40ft),
        price_40hq: n(v.price_40hq),   price_air_kg: n(v.price_air_kg),
        buy_lcl_cbm: n(v.buy_lcl_cbm),
        sell_price_20gp: n(v.sell_price_20gp),   sell_price_40ft: n(v.sell_price_40ft),
        sell_price_40hq: n(v.sell_price_40hq),   sell_price_air_kg: n(v.sell_price_air_kg),
        sell_lcl_cbm: n(v.sell_lcl_cbm),
        transit_sea_days: n(v.transit_sea_days),  transit_air_days: n(v.transit_air_days),
        notes: v.notes,
      }
      return editingAgent ? updateAgent(editingAgent.id, payload) : createAgent(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      setAgentModal(false)
      setEditingAgent(null)
      agentForm.reset()
    },
  })

  const deleteAgentMut = useMutation({
    mutationFn: deleteAgent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      setDeletingAgent(null)
    },
  })

  function openCreateAgent() {
    setEditingAgent(null)
    agentForm.reset({
      name: '', phone: '', email: '', wechat_id: '', country: '',
      warehouse_city: '', warehouse_address: '',
      serves_sea: true, serves_air: false,
      offer_valid_from: '', offer_valid_to: '',
      price_20gp: '', price_40ft: '', price_40hq: '', price_air_kg: '', buy_lcl_cbm: '',
      sell_price_20gp: '', sell_price_40ft: '', sell_price_40hq: '', sell_price_air_kg: '', sell_lcl_cbm: '',
      markup_sea: '', markup_air: '', cbm_rate_buy: '',
      transit_sea_days: '', transit_air_days: '', notes: '',
    })
    setAgentModal(true)
  }

  const n = (x: unknown) => (x != null && x !== '' ? Number(x) : '')

  function openEditAgent(agent: ShippingAgent) {
    setEditingAgent(agent)
    agentForm.reset({
      name: agent.name,
      phone: agent.phone ?? '',
      email: agent.email ?? '',
      wechat_id: agent.wechat_id ?? '',
      country: agent.country ?? '',
      warehouse_city: agent.warehouse_city ?? '',
      warehouse_address: (agent as any).warehouse_address ?? '',
      price_20gp:   n(agent.price_20gp),
      price_40ft:   n(agent.price_40ft),
      price_40hq:   n(agent.price_40hq),
      price_air_kg: n(agent.price_air_kg),
      buy_lcl_cbm:       n(agent.buy_lcl_cbm),
      sell_price_20gp:   n(agent.sell_price_20gp),
      sell_price_40ft:   n(agent.sell_price_40ft),
      sell_price_40hq:   n(agent.sell_price_40hq),
      sell_price_air_kg: n(agent.sell_price_air_kg),
      sell_lcl_cbm:      n(agent.sell_lcl_cbm),
      offer_valid_from: agent.offer_valid_from ?? '',
      offer_valid_to:   agent.offer_valid_to   ?? '',
      markup_sea: '', markup_air: '',
      transit_sea_days: agent.transit_sea_days ?? '',
      transit_air_days: agent.transit_air_days ?? '',
      serves_sea: agent.serves_sea ?? true,
      serves_air: agent.serves_air ?? false,
      notes: agent.notes ?? '',
    })
    setAgentModal(true)
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('agents.shipping_title')}</h1>
          {data && <p className="text-sm text-gray-400 mt-0.5">{data.total} {t('common.results')}</p>}
        </div>
        {isStaff && (
          <Button onClick={openCreateAgent}>
            <Plus size={16} />
            {t('agents.add')}
          </Button>
        )}
      </div>

      <div className="relative w-full sm:max-w-xs">
        <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder={t('common.search')}
          className="input-base ps-9 w-full"
        />
      </div>

      {/* Agent card grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.02] h-56 animate-pulse" />
          ))}
        </div>
      ) : (data?.results ?? []).length === 0 ? (
        <div className="card py-16 text-center text-gray-500 text-sm">{t('common.no_data')}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {(data?.results ?? []).map((agent) => (
            <div key={agent.id} className="rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex flex-col overflow-hidden">

              {/* Card header */}
              <div className="px-4 pt-4 pb-3 border-b border-white/5 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    {agent.serves_sea && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                        <Ship size={9} /> SEA
                      </span>
                    )}
                    {agent.serves_air && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400">
                        <Wind size={9} /> AIR
                      </span>
                    )}
                    {agent.country && (
                      <span className="text-[10px] text-gray-500">{agent.country}</span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-white truncate">{agent.name}</p>
                  {agent.name_ar && <p className="text-xs text-gray-500 truncate">{agent.name_ar}</p>}
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/shipping-agents/${agent.id}`)}
                    className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-brand-primary-light transition-colors"
                    title={isAr ? 'الملف الشخصي' : 'Profile'}
                  >
                    <ExternalLink size={13} />
                  </button>
                  {isStaff && (
                    <button onClick={() => openEditAgent(agent)}
                      className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-white transition-colors">
                      <Pencil size={13} />
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => setDeletingAgent(agent)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Card body */}
              <div className="px-4 py-3 flex flex-col gap-2.5 flex-1">

                {/* Contact */}
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {agent.wechat_id && (
                    <span className="text-[11px] text-green-400">💬 {agent.wechat_id}</span>
                  )}
                  {agent.phone && (
                    <span className="text-[11px] text-gray-500">📞 {agent.phone}</span>
                  )}
                  {agent.warehouse_city && (
                    <span className="text-[11px] text-gray-500">📍 {agent.warehouse_city}</span>
                  )}
                </div>

                {/* Offer validity */}
                {agent.offer_valid_to && (() => {
                  const days = Math.round((new Date(agent.offer_valid_to).getTime() - Date.now()) / 86400000)
                  const color = days < 0 ? 'text-red-400 bg-red-500/10' : days <= 14 ? 'text-amber-400 bg-amber-500/10' : 'text-emerald-400 bg-emerald-500/10'
                  return (
                    <span className={clsx('self-start text-[10px] font-semibold px-2 py-0.5 rounded-full', color)}>
                      {days < 0 ? `⚠ Expired ${Math.abs(days)}d ago` : `✓ ${days}d left`}
                    </span>
                  )
                })()}

                {/* Carrier rates pills */}
                {(agent as any).carrier_rates?.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {(agent as any).carrier_rates.slice(0, 4).map((cr: any) => (
                      <span key={cr.id} className="text-[10px] font-mono bg-white/5 text-gray-300 px-2 py-0.5 rounded-full border border-white/8">
                        {cr.carrier_name}
                      </span>
                    ))}
                    {(agent as any).carrier_rates.length > 4 && (
                      <span className="text-[10px] text-gray-500">+{(agent as any).carrier_rates.length - 4}</span>
                    )}
                  </div>
                ) : (
                  /* fallback: old flat price pills */
                  <div className="flex flex-wrap gap-1.5">
                    {agent.price_20gp != null && (
                      <span className="text-[10px] bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full">20GP ${Number(agent.price_20gp).toFixed(0)}</span>
                    )}
                    {agent.price_40ft != null && (
                      <span className="text-[10px] bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full">40GP ${Number(agent.price_40ft).toFixed(0)}</span>
                    )}
                    {agent.price_40hq != null && (
                      <span className="text-[10px] bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full">40HQ ${Number(agent.price_40hq).toFixed(0)}</span>
                    )}
                    {agent.price_air_kg != null && (
                      <span className="text-[10px] bg-violet-500/10 text-violet-300 px-2 py-0.5 rounded-full">Air ${Number(agent.price_air_kg).toFixed(2)}/kg</span>
                    )}
                  </div>
                )}

                {/* Transit days */}
                {(agent.transit_sea_days != null || agent.transit_air_days != null) && (
                  <div className="flex gap-3 text-[10px] text-gray-500">
                    {agent.transit_sea_days != null && <span><Ship size={9} className="inline me-0.5" />{agent.transit_sea_days}d sea</span>}
                    {agent.transit_air_days != null && <span><Wind size={9} className="inline me-0.5" />{agent.transit_air_days}d air</span>}
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {(data?.total ?? 0) > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            {t('common.prev')}
          </Button>
          <Button variant="secondary" size="sm" disabled={page * 20 >= (data?.total ?? 0)} onClick={() => setPage(p => p + 1)}>
            {t('common.next')}
          </Button>
        </div>
      )}

      {/* ── Agent Create/Edit Modal ─────────────────────────────────────────── */}
      <Modal
        open={agentModal}
        onClose={() => setAgentModal(false)}
        title={editingAgent ? t('agents.edit') : t('agents.add')}
        size="lg"
      >
        <form onSubmit={agentForm.handleSubmit((v) => saveAgentMut.mutate(v))} className="space-y-5">
          <FormSection title={t('agents.basic_info')}>
            <Input
              label={t('agents.name')}
              {...agentForm.register('name', { required: true })}
              error={agentForm.formState.errors.name ? t('common.required') : undefined}
            />
            <FormRow>
              <Input label={t('common.phone')} {...agentForm.register('phone')} />
              <Input label="WeChat ID" {...agentForm.register('wechat_id')} />
            </FormRow>
            <Input type="email" label={t('common.email')} {...agentForm.register('email')} />
          </FormSection>

          {/* Service modes */}
          <FormSection title={t('agents.service_modes')}>
            <div className="flex gap-3">
              {(['serves_sea', 'serves_air'] as const).map((key) => (
                <label key={key} className={clsx(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all text-sm font-medium',
                  agentForm.watch(key)
                    ? 'border-brand-primary bg-brand-primary/15 text-brand-primary-light'
                    : 'border-brand-border text-brand-text-muted hover:border-brand-border-focus',
                )}>
                  <input type="checkbox" className="sr-only" {...agentForm.register(key)} />
                  {key === 'serves_sea' ? (
                    <><Ship size={14} /> {t('agents.serves_sea')}</>
                  ) : (
                    <><Wind size={14} /> {t('agents.serves_air')}</>
                  )}
                </label>
              ))}
            </div>
          </FormSection>

          {/* Offer validity */}
          <FormSection title={isAr ? 'صلاحية العرض' : 'Offer Validity'}>
            <FormRow>
              <Input type="date" label={isAr ? 'تاريخ بداية العرض' : 'Offer Start Date'}
                {...agentForm.register('offer_valid_from')} />
              <Input type="date" label={isAr ? 'تاريخ انتهاء العرض' : 'Offer Expiry Date'}
                {...agentForm.register('offer_valid_to')} />
            </FormRow>
          </FormSection>

          <FormSection title={t('common.location')}>
            <FormRow>
              <Select
                label={t('common.country')}
                options={countryOptions}
                {...agentForm.register('country', {
                  onChange: () => agentForm.setValue('warehouse_city', ''),
                })}
              />
              <Select
                label={t('common.city')}
                options={cityOptions}
                disabled={!watchCountry || cityOptions.length <= 1}
                {...agentForm.register('warehouse_city')}
              />
            </FormRow>

            {/* Warehouse address: pick from company warehouses OR type manually */}
            <div className="space-y-1.5">
              <label className="label-base">
                {isAr ? 'عنوان المستودع' : 'Warehouse Address'}
              </label>
              {(warehousesData?.results ?? []).length > 0 && (
                <select
                  className="input-base w-full mb-1.5"
                  onChange={e => {
                    const [city, address] = e.target.value.split('||')
                    if (city)    agentForm.setValue('warehouse_city',    city)
                    if (address) agentForm.setValue('warehouse_address', address)
                  }}
                  defaultValue=""
                >
                  {warehouseOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
              <Input
                placeholder={isAr ? 'أو اكتب العنوان يدوياً...' : 'Or type address manually...'}
                {...agentForm.register('warehouse_address')}
              />
            </div>
          </FormSection>

          {/* Buy / Sell prices */}
          <FormSection title={t('agents.prices_title')}>
            {/* Sea */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider flex items-center gap-1.5">
                  🚢 {isAr ? 'أسعار الشحن البحري (USD)' : 'Sea Freight (USD)'}
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" step="0.1" min="0" placeholder="%"
                    className="input-base w-20 text-xs py-1.5"
                    {...agentForm.register('markup_sea')}
                  />
                  <button type="button" onClick={applyMarkupSea}
                    className="px-2 py-1.5 rounded-lg bg-brand-primary/15 text-brand-primary-light text-[11px] font-medium hover:bg-brand-primary/25 transition-colors whitespace-nowrap">
                    {isAr ? 'تطبيق %' : 'Apply %'}
                  </button>
                </div>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[44px_1fr_1fr_1fr] gap-2 px-1 mb-1">
                <span />
                <span className="text-[10px] text-brand-text-muted uppercase tracking-wider">{isAr ? 'لكل م³' : 'Per m³'}</span>
                <span className="text-[10px] text-brand-text-muted uppercase tracking-wider">{isAr ? 'شراء (إجمالي)' : 'Buy (total)'}</span>
                <span className="text-[10px] text-brand-text-muted uppercase tracking-wider">{isAr ? 'بيع (إجمالي)' : 'Sell (total)'}</span>
              </div>
              {[
                { label: '20GP', cap: CBM_CAP['20gp'], buyKey: 'price_20gp' as const, sellKey: 'sell_price_20gp' as const, rateKey: 'cbm_rate_buy' as const },
                { label: '40GP', cap: CBM_CAP['40ft'], buyKey: 'price_40ft' as const, sellKey: 'sell_price_40ft' as const, rateKey: 'cbm_rate_buy' as const },
                { label: '40HQ', cap: CBM_CAP['40hq'], buyKey: 'price_40hq' as const, sellKey: 'sell_price_40hq' as const, rateKey: 'cbm_rate_buy' as const },
              ].map(({ label, cap, buyKey, sellKey }) => (
                <div key={label} className="grid grid-cols-[44px_1fr_1fr_1fr] gap-2 items-end">
                  <div className="text-sm font-mono text-brand-text-muted pb-2.5">{label}</div>
                  {/* Per m³ → auto-fills buy total */}
                  <input type="number" step="0.01" min="0" placeholder="0.00"
                    className="input-base text-sm text-blue-300"
                    title={`×${cap} m³`}
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value)
                      if (rate > 0) agentForm.setValue(buyKey, Number((rate * cap).toFixed(2)))
                      else if (e.target.value === '') agentForm.setValue(buyKey, '')
                    }}
                  />
                  <Input type="number" step="0.01" min="0" placeholder="0.00"
                    {...agentForm.register(buyKey)} />
                  <Input type="number" step="0.01" min="0" placeholder="0.00"
                    {...agentForm.register(sellKey)} />
                </div>
              ))}
              {/* LCL per CBM */}
              <div className="grid grid-cols-[44px_1fr_1fr_1fr] gap-2 items-end pt-1 border-t border-brand-border/30">
                <div className="text-sm font-mono text-brand-text-muted pb-2.5">LCL</div>
                <span /> {/* LCL is already per m³ */}
                <Input type="number" step="0.01" min="0" placeholder="0.00"
                  label={isAr ? 'شراء/م³' : 'Buy/m³'}
                  {...agentForm.register('buy_lcl_cbm')} />
                <Input type="number" step="0.01" min="0" placeholder="0.00"
                  label={isAr ? 'بيع/م³' : 'Sell/m³'}
                  {...agentForm.register('sell_lcl_cbm')} />
              </div>
              <Input type="number" min="0"
                label={isAr ? 'مدة العبور البحري (أيام)' : 'Sea Transit (days)'}
                {...agentForm.register('transit_sea_days')} />
            </div>

            <div className="border-t border-brand-border/50 my-2" />

            {/* Air */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider flex items-center gap-1.5">
                  ✈ {isAr ? 'أسعار الشحن الجوي (USD/كغ)' : 'Air Freight (USD/kg)'}
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" step="0.1" min="0" placeholder="%"
                    className="input-base w-20 text-xs py-1.5"
                    {...agentForm.register('markup_air')}
                  />
                  <button type="button" onClick={applyMarkupAir}
                    className="px-2 py-1.5 rounded-lg bg-brand-primary/15 text-brand-primary-light text-[11px] font-medium hover:bg-brand-primary/25 transition-colors whitespace-nowrap">
                    {isAr ? 'تطبيق %' : 'Apply %'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="text-sm font-mono text-brand-text-muted pb-2.5">Air /kg</div>
                <Input type="number" step="0.01" min="0" placeholder="0.00"
                  label={isAr ? 'شراء' : 'Buy'}
                  {...agentForm.register('price_air_kg')} />
                <Input type="number" step="0.01" min="0" placeholder="0.00"
                  label={isAr ? 'بيع' : 'Sell'}
                  {...agentForm.register('sell_price_air_kg')} />
              </div>
              <Input type="number" min="0"
                label={isAr ? 'مدة العبور الجوي (أيام)' : 'Air Transit (days)'}
                {...agentForm.register('transit_air_days')} />
            </div>
          </FormSection>

          <Input label={t('common.notes')} {...agentForm.register('notes')} />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAgentModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={saveAgentMut.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Agent ────────────────────────────────────────────────────── */}
      <Modal open={!!deletingAgent} onClose={() => setDeletingAgent(null)} title={t('common.confirm_delete')} size="sm">
        <p className="text-sm text-gray-300 mb-5">
          {t('agents.delete_confirm', { name: deletingAgent?.name })}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeletingAgent(null)}>{t('common.cancel')}</Button>
          <Button
            variant="danger"
            loading={deleteAgentMut.isPending}
            onClick={() => deletingAgent && deleteAgentMut.mutate(deletingAgent.id)}
          >
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

