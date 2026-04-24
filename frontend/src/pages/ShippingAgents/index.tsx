import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronUp, Ship, Wind, ExternalLink } from 'lucide-react'
import {
  getAgents, createAgent, updateAgent, deleteAgent,
  getAgentQuotes, createQuote, deleteQuote,
} from '@/services/agentService'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { Input, Select, FormRow, FormSection } from '@/components/ui/Form'
import { useForm } from 'react-hook-form'
import type { ShippingAgent } from '@/types'
import clsx from 'clsx'

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
  // Buy prices (from agent)
  price_20gp:   number | ''
  price_40ft:   number | ''
  price_40hq:   number | ''
  price_air_kg: number | ''
  // Sell prices (to clients)
  sell_price_20gp:   number | ''
  sell_price_40ft:   number | ''
  sell_price_40hq:   number | ''
  sell_price_air_kg: number | ''
  // Markup % — used only for auto-calculation in the form, not sent to server
  markup_sea: number | ''
  markup_air: number | ''
  transit_sea_days: number | ''
  transit_air_days: number | ''
  notes: string
}

interface QuoteForm {
  service_mode: string
  carrier: string
  container_type: string
  incoterm: string
  port_of_loading: string
  port_of_discharge: string
  // SEA charges
  ocean_freight: number | ''
  thc_origin: number | ''
  bl_fee: number | ''
  doc_fee: number | ''
  sealing_fee: number | ''
  thc_destination: number | ''
  // AIR charges
  air_freight_per_kg: number | ''
  min_chargeable_weight_kg: number | ''
  // Timing
  transit_days: number | ''
  free_days_origin: number | ''
  free_days_destination: number | ''
  valid_from: string
  valid_to: string
  status: string
  notes: string
}

const SERVICE_MODES = ['SEA_FCL', 'AIR', 'LCL']
const CONTAINER_TYPES = ['20GP', '40FT', '40HQ']
const INCOTERMS = ['FOB', 'CIF', 'CFR', 'EXW', 'DAP', 'DDP']
const QUOTE_STATUSES = ['DRAFT', 'ACTIVE', 'EXPIRED']

export default function ShippingAgentsPage() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const { isStaff, isAdmin } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [agentModal, setAgentModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState<ShippingAgent | null>(null)
  const [deletingAgent, setDeletingAgent] = useState<ShippingAgent | null>(null)
  const [expandedAgent, setExpandedAgent] = useState<number | null>(null)
  const [quoteModal, setQuoteModal] = useState<{ agentId: number; agentName: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['agents', { page, search }],
    queryFn: () => getAgents({ page, page_size: 20, search: search || undefined }),
  })

  const agentForm = useForm<AgentForm>()
  const quoteForm = useForm<QuoteForm>({ defaultValues: { service_mode: 'SEA_FCL', incoterm: 'FOB', status: 'ACTIVE', container_type: '40FT' } })

  const watchServiceMode = quoteForm.watch('service_mode')
  const isAir = watchServiceMode === 'AIR'

  // Watch buy prices and markup to auto-fill sell prices
  const [buy20, buy40ft, buy40hq, buyAir, markupSea, markupAir] = agentForm.watch([
    'price_20gp', 'price_40ft', 'price_40hq', 'price_air_kg', 'markup_sea', 'markup_air',
  ])
  function applyMarkupSea() {
    const pct = parseFloat(String(markupSea))
    if (!pct) return
    if (buy20)   agentForm.setValue('sell_price_20gp',   Number((Number(buy20)   * (1 + pct / 100)).toFixed(2)))
    if (buy40ft) agentForm.setValue('sell_price_40ft',   Number((Number(buy40ft) * (1 + pct / 100)).toFixed(2)))
    if (buy40hq) agentForm.setValue('sell_price_40hq',   Number((Number(buy40hq) * (1 + pct / 100)).toFixed(2)))
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
        price_20gp: n(v.price_20gp),   price_40ft: n(v.price_40ft),
        price_40hq: n(v.price_40hq),   price_air_kg: n(v.price_air_kg),
        sell_price_20gp: n(v.sell_price_20gp),   sell_price_40ft: n(v.sell_price_40ft),
        sell_price_40hq: n(v.sell_price_40hq),   sell_price_air_kg: n(v.sell_price_air_kg),
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

  const saveQuoteMut = useMutation({
    mutationFn: ({ agentId, data }: { agentId: number; data: QuoteForm }) => {
      const payload: Record<string, unknown> = {
        service_mode: data.service_mode,
        carrier: data.carrier || null,
        incoterm: data.incoterm || null,
        port_of_loading: data.port_of_loading || null,
        port_of_discharge: data.port_of_discharge || null,
        status: data.status,
        notes: data.notes || null,
        validity_from: data.valid_from || null,
        validity_to: data.valid_to || null,
        transit_days: data.transit_days !== '' ? Number(data.transit_days) : null,
        free_days_origin: data.free_days_origin !== '' ? Number(data.free_days_origin) : null,
        free_days_destination: data.free_days_destination !== '' ? Number(data.free_days_destination) : null,
      }
      if (data.service_mode === 'AIR') {
        payload.air_freight_per_kg = data.air_freight_per_kg !== '' ? Number(data.air_freight_per_kg) : null
        payload.min_chargeable_weight_kg = data.min_chargeable_weight_kg !== '' ? Number(data.min_chargeable_weight_kg) : null
      } else {
        payload.container_type = data.container_type || null
        payload.ocean_freight = data.ocean_freight !== '' ? Number(data.ocean_freight) : null
        payload.thc_origin = data.thc_origin !== '' ? Number(data.thc_origin) : null
        payload.bl_fee = data.bl_fee !== '' ? Number(data.bl_fee) : null
        payload.doc_fee = data.doc_fee !== '' ? Number(data.doc_fee) : null
        payload.sealing_fee = data.sealing_fee !== '' ? Number(data.sealing_fee) : null
        payload.thc_destination = data.thc_destination !== '' ? Number(data.thc_destination) : null
      }
      return createQuote(agentId, payload)
    },
    onSuccess: (_, { agentId }) => {
      qc.invalidateQueries({ queryKey: ['agent-quotes', agentId] })
      qc.invalidateQueries({ queryKey: ['board'] })
      setQuoteModal(null)
      quoteForm.reset({ service_mode: 'SEA_FCL', incoterm: 'FOB', status: 'ACTIVE', container_type: '40FT' })
    },
  })

  function openCreateAgent() {
    setEditingAgent(null)
    agentForm.reset({
      name: '', phone: '', email: '', wechat_id: '', country: '',
      warehouse_city: '', warehouse_address: '',
      serves_sea: true, serves_air: false,
      price_20gp: '', price_40ft: '', price_40hq: '', price_air_kg: '',
      sell_price_20gp: '', sell_price_40ft: '', sell_price_40hq: '', sell_price_air_kg: '',
      markup_sea: '', markup_air: '',
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
      sell_price_20gp:   n(agent.sell_price_20gp),
      sell_price_40ft:   n(agent.sell_price_40ft),
      sell_price_40hq:   n(agent.sell_price_40hq),
      sell_price_air_kg: n(agent.sell_price_air_kg),
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

      {/* Agent cards with expandable quotes */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="card py-12 text-center text-gray-400 text-sm">{t('common.loading')}</div>
        ) : (data?.results ?? []).length === 0 ? (
          <div className="card py-12 text-center text-gray-500 text-sm">{t('common.no_data')}</div>
        ) : (
          (data?.results ?? []).map((agent) => (
            <div key={agent.id} className="card p-0 overflow-hidden">
              {/* Agent row */}
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Name */}
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => navigate(`/shipping-agents/${agent.id}`)}
                        className="text-sm text-white font-medium hover:text-brand-primary-light transition-colors flex items-center gap-1 group"
                      >
                        {agent.name}
                        <ExternalLink size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                      </button>
                      {agent.serves_sea && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300">
                          <Ship size={8} /> SEA
                        </span>
                      )}
                      {agent.serves_air && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300">
                          <Wind size={8} /> AIR
                        </span>
                      )}
                    </div>
                    {agent.wechat_id && (
                      <p className="text-xs text-green-400 mt-0.5">WeChat: {agent.wechat_id}</p>
                    )}
                    {agent.phone && <p className="text-xs text-gray-500">{agent.phone}</p>}
                  </div>
                  {/* Location */}
                  <div>
                    <p className="text-xs text-gray-500">
                      {[agent.warehouse_city, agent.country].filter(Boolean).join(', ') || '—'}
                    </p>
                  </div>
                  {/* Quick prices */}
                  <div className="flex flex-wrap gap-2">
                    {agent.price_20gp != null && (
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full">
                        <Ship size={10} /> 20GP ${Number(agent.price_20gp).toFixed(0)}
                      </span>
                    )}
                    {agent.price_40ft != null && (
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full">
                        <Ship size={10} /> 40FT ${Number(agent.price_40ft).toFixed(0)}
                      </span>
                    )}
                    {agent.price_40hq != null && (
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full">
                        <Ship size={10} /> 40HQ ${Number(agent.price_40hq).toFixed(0)}
                      </span>
                    )}
                    {agent.price_air_kg != null && (
                      <span className="inline-flex items-center gap-1 text-xs bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-full">
                        <Wind size={10} /> Air ${Number(agent.price_air_kg).toFixed(2)}/kg
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                    className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-brand-green transition-colors"
                    title={t('agents.quotes')}
                  >
                    {expandedAgent === agent.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {isStaff && (
                    <>
                      <button
                        onClick={() => openEditAgent(agent)}
                        className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setDeletingAgent(agent)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Quotes panel */}
              {expandedAgent === agent.id && (
                <AgentQuotesPanel
                  agentId={agent.id}
                  canEdit={isStaff ?? false}
                  onAddQuote={() => {
                    setQuoteModal({ agentId: agent.id, agentName: agent.name })
                    quoteForm.reset({ service_mode: 'SEA_FCL', incoterm: 'FOB', status: 'ACTIVE', container_type: '40FT' })
                  }}
                />
              )}
            </div>
          ))
        )}
      </div>

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

          <FormSection title={t('common.location')}>
            <FormRow>
              <Input label={t('common.city')} {...agentForm.register('warehouse_city')} />
              <Input label={t('common.country')} {...agentForm.register('country')} />
            </FormRow>
            <Input label={t('agents.warehouse_address')} {...agentForm.register('warehouse_address')} />
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

              <div className="grid grid-cols-3 gap-2 text-[10px] text-brand-text-muted font-semibold uppercase tracking-wider px-1">
                <span>{isAr ? 'الحجم' : 'Size'}</span>
                <span>{isAr ? 'سعر الشراء' : 'Buy Price'}</span>
                <span>{isAr ? 'سعر البيع' : 'Sell Price'}</span>
              </div>
              {[
                { key: '20gp' as const, label: '20GP', buyKey: 'price_20gp' as const, sellKey: 'sell_price_20gp' as const },
                { key: '40ft' as const, label: '40GP', buyKey: 'price_40ft' as const, sellKey: 'sell_price_40ft' as const },
                { key: '40hq' as const, label: '40HQ', buyKey: 'price_40hq' as const, sellKey: 'sell_price_40hq' as const },
              ].map(({ label, buyKey, sellKey }) => (
                <div key={label} className="grid grid-cols-3 gap-2 items-end">
                  <div className="text-sm font-mono text-brand-text-muted pb-2.5">{label}</div>
                  <Input type="number" step="0.01" min="0" placeholder="0.00"
                    {...agentForm.register(buyKey)} />
                  <Input type="number" step="0.01" min="0" placeholder="0.00"
                    {...agentForm.register(sellKey)} />
                </div>
              ))}
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

      {/* ── Quote Modal ─────────────────────────────────────────────────────── */}
      <Modal
        open={quoteModal !== null}
        onClose={() => setQuoteModal(null)}
        title={`${t('agents.add_quote')} — ${quoteModal?.agentName ?? ''}`}
        size="xl"
      >
        <form
          onSubmit={quoteForm.handleSubmit((v) =>
            quoteModal && saveQuoteMut.mutate({ agentId: quoteModal.agentId, data: v })
          )}
          className="space-y-5"
        >
          <FormSection title={t('agents.quote_details')}>
            <FormRow cols={3}>
              <Select
                label={t('agents.service_mode')}
                options={SERVICE_MODES.map((v) => ({ value: v, label: v }))}
                {...quoteForm.register('service_mode')}
              />
              {!isAir && (
                <Select
                  label={t('containers.type')}
                  options={CONTAINER_TYPES.map((v) => ({ value: v, label: v }))}
                  {...quoteForm.register('container_type')}
                />
              )}
              <Select
                label={t('agents.incoterm')}
                options={INCOTERMS.map((v) => ({ value: v, label: v }))}
                {...quoteForm.register('incoterm')}
              />
            </FormRow>
            {/* Carrier / shipping line */}
            <Input
              label={t('bookings.carrier_line')}
              placeholder={isAir ? 'Emirates SkyCargo, Turkish Cargo…' : 'CMA CGM, MSC, PIL, Evergreen…'}
              {...quoteForm.register('carrier')}
            />
            <FormRow>
              <Input label={t('containers.origin_port')} {...quoteForm.register('port_of_loading')} />
              <Input label={t('containers.destination_port')} {...quoteForm.register('port_of_discharge')} />
            </FormRow>
            <FormRow>
              <Select
                label={t('common.status')}
                options={QUOTE_STATUSES.map((v) => ({ value: v, label: v }))}
                {...quoteForm.register('status')}
              />
            </FormRow>
          </FormSection>

          {/* SEA charges */}
          {!isAir && (
            <FormSection title={t('agents.freight_charges')}>
              <FormRow cols={3}>
                <Input type="number" step="0.01" label={t('agents.ocean_freight')} {...quoteForm.register('ocean_freight')} />
                <Input type="number" step="0.01" label="THC Origin" {...quoteForm.register('thc_origin')} />
                <Input type="number" step="0.01" label="BL Fee" {...quoteForm.register('bl_fee')} />
              </FormRow>
              <FormRow cols={3}>
                <Input type="number" step="0.01" label="Doc Fee" {...quoteForm.register('doc_fee')} />
                <Input type="number" step="0.01" label="Sealing Fee" {...quoteForm.register('sealing_fee')} />
                <Input type="number" step="0.01" label="THC Dest." {...quoteForm.register('thc_destination')} />
              </FormRow>
            </FormSection>
          )}

          {/* AIR charges */}
          {isAir && (
            <FormSection title={t('agents.air_charges')}>
              <FormRow>
                <Input type="number" step="0.01" label={t('agents.air_rate_per_kg')} {...quoteForm.register('air_freight_per_kg')} />
                <Input type="number" step="0.01" label={t('agents.min_chargeable_kg')} {...quoteForm.register('min_chargeable_weight_kg')} />
              </FormRow>
            </FormSection>
          )}

          <FormSection title={t('agents.timing')}>
            <FormRow cols={3}>
              <Input type="number" label="Transit Days" {...quoteForm.register('transit_days')} />
              <Input type="number" label="Free Days (Origin)" {...quoteForm.register('free_days_origin')} />
              <Input type="number" label="Free Days (Dest)" {...quoteForm.register('free_days_destination')} />
            </FormRow>
            <FormRow>
              <Input type="date" label={t('common.valid_from')} {...quoteForm.register('valid_from')} />
              <Input type="date" label={t('common.valid_to')} {...quoteForm.register('valid_to')} />
            </FormRow>
          </FormSection>

          <Input label={t('common.notes')} {...quoteForm.register('notes')} />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setQuoteModal(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={saveQuoteMut.isPending}>
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

// ─── Agent Quotes Panel ────────────────────────────────────────────────────────
function AgentQuotesPanel({ agentId, canEdit, onAddQuote }: {
  agentId: number
  canEdit: boolean
  onAddQuote: () => void
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const { data: quotes, isLoading } = useQuery({
    queryKey: ['agent-quotes', agentId],
    queryFn: () => getAgentQuotes(agentId),
  })

  const deleteQuoteMut = useMutation({
    mutationFn: ({ agentId, quoteId }: { agentId: number; quoteId: number }) =>
      deleteQuote(agentId, quoteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-quotes', agentId] })
      qc.invalidateQueries({ queryKey: ['board'] })
    },
  })

  return (
    <div className="border-t border-brand-border bg-brand-surface/40 px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('agents.quotes')}</span>
        {canEdit && (
          <Button size="sm" variant="secondary" onClick={onAddQuote}>
            <Plus size={12} />
            {t('agents.add_quote')}
          </Button>
        )}
      </div>
      {isLoading ? (
        <p className="text-xs text-gray-500">{t('common.loading')}</p>
      ) : ((quotes as any)?.results ?? []).length === 0 ? (
        <p className="text-xs text-gray-500 py-2">{t('agents.no_quotes')}</p>
      ) : (
        <div className="space-y-1.5">
          {((quotes as any)?.results ?? []).map((q: any) => (
            <div key={q.id} className="flex items-center gap-3 text-xs bg-brand-card rounded-lg px-3 py-2.5">
              <Badge value={q.status?.toLowerCase()} label={q.status} />
              <span className="text-brand-green font-semibold text-[11px]">{q.service_mode}</span>
              {q.container_type && (
                <span className="text-gray-500">{q.container_type}</span>
              )}
              <span className="text-gray-400">{q.incoterm ?? '—'}</span>
              <span className="text-gray-300">
                {q.port_of_loading || '?'} → {q.port_of_discharge || '?'}
              </span>
              {q.transit_days && (
                <span className="text-gray-500">{q.transit_days}d</span>
              )}
              {q.valid_to && (
                <span className={clsx(
                  'text-[10px]',
                  new Date(q.valid_to) < new Date() ? 'text-red-400' : 'text-gray-600'
                )}>
                  exp. {q.valid_to?.slice(0, 10)}
                </span>
              )}
              <span className="text-brand-green font-bold ms-auto">
                {q.total_all != null
                  ? `$${Number(q.total_all).toFixed(2)}`
                  : q.ocean_freight != null
                    ? `$${Number(q.ocean_freight).toFixed(2)}`
                    : q.air_freight_per_kg != null
                      ? `$${Number(q.air_freight_per_kg).toFixed(2)}/kg`
                      : '—'}
              </span>
              {canEdit && (
                <button
                  onClick={() => deleteQuoteMut.mutate({ agentId, quoteId: q.id })}
                  className="text-gray-600 hover:text-red-400 transition-colors ms-1"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
