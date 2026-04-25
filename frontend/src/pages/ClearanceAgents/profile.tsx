import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Anchor, ArrowLeft, ArrowRight, BadgeCheck, Clock, Mail, MapPin, Pencil, Phone, Plus, Ship, Trash2, TrendingUp, User, Wind } from 'lucide-react'
import {
  getClearanceAgent, createClearanceAgentRate, updateClearanceAgentRate,
  deleteClearanceAgentRate,
} from '@/services/agentService'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, FormSection, Textarea } from '@/components/ui/Form'
import type { ClearanceAgent, ClearanceAgentRate } from '@/types'

const COUNTRY_PORTS: Record<string, { sea: string[]; air: string[] }> = {
  Jordan: {
    sea: ['Aqaba Port'],
    air: ['AMM - Queen Alia Amman', 'AQJ - Aqaba King Hussein'],
  },
  Iraq: {
    sea: ['Umm Qasr Port', 'Basra Port'],
    air: ['BGW - Baghdad', 'EBL - Erbil', 'BSR - Basra'],
  },
}

const PRICE_FIELDS = [
  ['clearance_fee', 'Clearance Fees'],
  ['transportation', 'Transportation'],
  ['delivery_authorization', 'Delivery Authorization'],
  ['inspection_ramp', 'Inspection Ramp'],
  ['port_inspection', 'Port Inspection'],
] as const

type PriceKey = typeof PRICE_FIELDS[number][0]
type RateForm = Record<string, string>

function money(v: number | null | undefined) {
  if (v == null) return '—'
  return `$${Number(v).toFixed(2)}`
}

function margin(buy?: string | number | null, sell?: string | number | null) {
  const b = Number(buy), s = Number(sell)
  if (!b || !s) return '—'
  return `${(((s - b) / b) * 100).toFixed(1)}%`
}

function emptyRateForm(agent?: ClearanceAgent | null): RateForm {
  return {
    service_mode: 'sea',
    country: agent?.country ?? 'Jordan',
    port: '',
    route: '',
    buy_clearance_fee: '',
    sell_clearance_fee: '',
    buy_transportation: '',
    sell_transportation: '',
    buy_delivery_authorization: '',
    sell_delivery_authorization: '',
    buy_inspection_ramp: '',
    sell_inspection_ramp: '',
    buy_port_inspection: '',
    sell_port_inspection: '',
    buy_import_export_card_pct: '',
    sell_import_export_card_pct: '',
    notes: '',
    markup_pct: '25',
  }
}

function formFromRate(rate: ClearanceAgentRate): RateForm {
  return {
    service_mode: rate.service_mode,
    country: rate.country ?? '',
    port: rate.port ?? '',
    route: rate.route ?? '',
    buy_clearance_fee: rate.buy_clearance_fee?.toString() ?? '',
    sell_clearance_fee: rate.sell_clearance_fee?.toString() ?? '',
    buy_transportation: rate.buy_transportation?.toString() ?? '',
    sell_transportation: rate.sell_transportation?.toString() ?? '',
    buy_delivery_authorization: rate.buy_delivery_authorization?.toString() ?? '',
    sell_delivery_authorization: rate.sell_delivery_authorization?.toString() ?? '',
    buy_inspection_ramp: rate.buy_inspection_ramp?.toString() ?? '',
    sell_inspection_ramp: rate.sell_inspection_ramp?.toString() ?? '',
    buy_port_inspection: rate.buy_port_inspection?.toString() ?? '',
    sell_port_inspection: rate.sell_port_inspection?.toString() ?? '',
    buy_import_export_card_pct: rate.buy_import_export_card_pct?.toString() ?? '',
    sell_import_export_card_pct: rate.sell_import_export_card_pct?.toString() ?? '',
    notes: rate.notes ?? '',
    markup_pct: '25',
  }
}

export default function ClearanceAgentProfilePage() {
  const { id } = useParams<{ id: string }>()
  const agentId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const BackIcon = isAr ? ArrowRight : ArrowLeft
  const { isStaff } = useAuth()

  const [rateModal, setRateModal] = useState(false)
  const [editingRate, setEditingRate] = useState<ClearanceAgentRate | null>(null)
  const [deletingRate, setDeletingRate] = useState<ClearanceAgentRate | null>(null)
  const [form, setForm] = useState<RateForm>(emptyRateForm())

  const { data: agent, isLoading } = useQuery<ClearanceAgent>({
    queryKey: ['clearance-agent-profile', agentId],
    queryFn: () => getClearanceAgent(agentId),
    enabled: !Number.isNaN(agentId),
  })

  const saveRateMut = useMutation({
    mutationFn: () => {
      const n = (s: string) => s ? Number(s) : null
      const payload = {
        service_mode: form.service_mode,
        country: form.country || null,
        port: form.port || null,
        route: form.route || null,
        buy_clearance_fee: n(form.buy_clearance_fee),
        sell_clearance_fee: n(form.sell_clearance_fee),
        buy_transportation: n(form.buy_transportation),
        sell_transportation: n(form.sell_transportation),
        buy_delivery_authorization: n(form.buy_delivery_authorization),
        sell_delivery_authorization: n(form.sell_delivery_authorization),
        buy_inspection_ramp: form.service_mode === 'sea' ? n(form.buy_inspection_ramp) : null,
        sell_inspection_ramp: form.service_mode === 'sea' ? n(form.sell_inspection_ramp) : null,
        buy_port_inspection: form.service_mode === 'sea' ? n(form.buy_port_inspection) : null,
        sell_port_inspection: form.service_mode === 'sea' ? n(form.sell_port_inspection) : null,
        buy_import_export_card_pct: n(form.buy_import_export_card_pct),
        sell_import_export_card_pct: n(form.sell_import_export_card_pct),
        notes: form.notes || null,
      }
      return editingRate
        ? updateClearanceAgentRate(agentId, editingRate.id, payload)
        : createClearanceAgentRate(agentId, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clearance-agent-profile', agentId] })
      qc.invalidateQueries({ queryKey: ['clearance-agents'] })
      setRateModal(false)
      setEditingRate(null)
    },
  })

  const deleteRateMut = useMutation({
    mutationFn: (rateId: number) => deleteClearanceAgentRate(agentId, rateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clearance-agent-profile', agentId] })
      qc.invalidateQueries({ queryKey: ['clearance-agents'] })
      setDeletingRate(null)
    },
  })

  function setField(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function openAddRate() {
    setEditingRate(null)
    setForm(emptyRateForm(agent))
    setRateModal(true)
  }

  function openEditRate(rate: ClearanceAgentRate) {
    setEditingRate(rate)
    setForm(formFromRate(rate))
    setRateModal(true)
  }

  function applyMarkup() {
    const pct = Number(form.markup_pct)
    if (!pct) return
    setForm(f => {
      const next = { ...f }
      PRICE_FIELDS.forEach(([key]) => {
        const buyKey = `buy_${key}`
        const sellKey = `sell_${key}`
        const buy = Number(f[buyKey])
        if (buy) next[sellKey] = (buy * (1 + pct / 100)).toFixed(2)
      })
      const cardPct = Number(f.buy_import_export_card_pct)
      if (cardPct) next.sell_import_export_card_pct = (cardPct * (1 + pct / 100)).toFixed(3)
      return next
    })
  }

  if (isLoading) return <div className="skeleton h-80 rounded-xl max-w-5xl mx-auto" />
  if (!agent) return <div className="card max-w-3xl mx-auto text-center text-brand-text-muted">Agent not found</div>

  const ports = COUNTRY_PORTS[form.country]?.[form.service_mode as 'sea' | 'air'] ?? []

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-8">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate('/clearance-agents')} className="btn-icon" title={isAr ? 'رجوع' : 'Back'}>
          <BackIcon size={18} />
        </button>
        <div className="flex-1">
          <h1 className="page-title">{agent.name}</h1>
          {agent.name_ar && <p className="page-subtitle">{agent.name_ar}</p>}
        </div>
        <span className="badge bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs">
          <Anchor size={11} /> {isAr ? 'تخليص' : 'Clearance'}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="space-y-4">
          <div className="card space-y-3">
            <h3 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider">{isAr ? 'المعلومات الأساسية' : 'Basic Info'}</h3>
            {agent.contact_person && <Info icon={User} label={isAr ? 'المسؤول' : 'Contact'} value={agent.contact_person} />}
            {agent.phone && <Info icon={Phone} label={t('common.phone')} value={agent.phone} />}
            {agent.whatsapp && <Info icon={Phone} label="WhatsApp" value={agent.whatsapp} />}
            {agent.email && <Info icon={Mail} label={t('common.email')} value={agent.email} />}
            {(agent.city || agent.country) && <Info icon={MapPin} label={t('common.location')} value={[agent.city, agent.country].filter(Boolean).join(', ')} />}
            {agent.address && <Info icon={MapPin} label={isAr ? 'العنوان' : 'Address'} value={agent.address} />}
            {agent.license_number && <Info icon={BadgeCheck} label={t('agents.license_number')} value={agent.license_number} />}
          </div>
          {(agent.bank_name || agent.bank_account) && (
            <div className="card space-y-2">
              <h3 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider">{isAr ? 'البنك' : 'Bank Details'}</h3>
              {agent.bank_name && <p className="text-sm text-brand-text">{agent.bank_name}</p>}
              {agent.bank_account && <p className="text-xs text-brand-text-muted font-mono">{agent.bank_account}</p>}
              {agent.bank_swift && <p className="text-xs text-brand-text-muted font-mono">SWIFT: {agent.bank_swift}</p>}
            </div>
          )}
          {agent.notes && <div className="card text-sm text-brand-text-muted">{agent.notes}</div>}
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-brand-text flex items-center gap-2">
                <TrendingUp size={14} className="text-emerald-400" />
                {isAr ? 'أسعار التخليص الحالية' : 'Current Clearance Rates'}
                <span className="text-xs text-brand-text-muted">({agent.rates?.length ?? 0})</span>
              </h3>
              {isStaff && <Button size="sm" onClick={openAddRate}><Plus size={13} /> {isAr ? 'تحديث السعر' : 'Update Rate'}</Button>}
            </div>

            {(agent.rates ?? []).length === 0 ? (
              <p className="text-sm text-brand-text-muted text-center py-4">{isAr ? 'لا توجد أسعار بعد' : 'No rates yet'}</p>
            ) : (
              <div className="space-y-3">
                {(agent.rates ?? []).map(rate => (
                  <RateCard key={rate.id} rate={rate} isAr={isAr} onEdit={() => openEditRate(rate)} onDelete={() => setDeletingRate(rate)} canEdit={isStaff} />
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-brand-text mb-4 flex items-center gap-2">
              <Clock size={14} className="text-brand-text-muted" />
              {isAr ? 'سجل التعديلات' : 'Edit Log'}
              <span className="text-xs text-brand-text-muted">({agent.edit_log?.length ?? 0})</span>
            </h3>
            {(agent.edit_log ?? []).length === 0 ? (
              <p className="text-sm text-brand-text-muted text-center py-4">{isAr ? 'لا يوجد نشاط بعد' : 'No activity yet'}</p>
            ) : (
              <div>
                {(agent.edit_log ?? []).slice(0, 30).map(log => (
                  <div key={log.id} className="flex gap-3 py-3 border-b border-brand-border/30 last:border-0">
                    <div className="w-7 h-7 rounded-lg bg-brand-primary/10 text-brand-primary-light flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Pencil size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-brand-text capitalize">{log.action.replace(/_/g, ' ')}</p>
                      {log.summary && <p className="text-[11px] text-brand-text-muted mt-0.5 break-words">{log.summary}</p>}
                      <p className="text-[11px] text-brand-text-dim mt-0.5">
                        {log.changed_by ?? (isAr ? 'نظام' : 'System')} · {new Date(log.changed_at).toLocaleString(isAr ? 'ar-JO' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={rateModal} onClose={() => setRateModal(false)} title={editingRate ? (isAr ? 'تعديل سعر التخليص' : 'Edit Clearance Rate') : (isAr ? 'إضافة سعر تخليص' : 'Add Clearance Rate')} size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRateModal(false)}>{t('common.cancel')}</Button>
            <Button loading={saveRateMut.isPending} onClick={() => saveRateMut.mutate()}>{t('common.save')}</Button>
          </>
        }>
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="label-base">{isAr ? 'نوع التخليص' : 'Clearance Type'}</label>
              <select className="input-base w-full" value={form.service_mode} onChange={e => setField('service_mode', e.target.value)}>
                <option value="sea">{isAr ? 'بحري' : 'Sea'}</option>
                <option value="air">{isAr ? 'جوي' : 'Air'}</option>
              </select>
            </div>
            <div>
              <label className="label-base">{t('common.country')}</label>
              <select className="input-base w-full" value={form.country} onChange={e => setField('country', e.target.value)}>
                <option value="Jordan">Jordan</option>
                <option value="Iraq">Iraq</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="label-base">{form.service_mode === 'air' ? (isAr ? 'المطار' : 'Airport') : (isAr ? 'الميناء' : 'Port')}</label>
              <input list="clearance-ports" className="input-base w-full" value={form.port} onChange={e => setField('port', e.target.value)} />
              <datalist id="clearance-ports">{ports.map(p => <option key={p} value={p} />)}</datalist>
            </div>
            <Input label={isAr ? 'المسار' : 'Route'} placeholder="Aqaba -> Amman" value={form.route} onChange={e => setField('route', e.target.value)} />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input type="number" step="0.1" min="0" className="input-base w-28 text-xs" value={form.markup_pct} onChange={e => setField('markup_pct', e.target.value)} placeholder={isAr ? 'نسبة %' : 'Margin %'} />
            <button type="button" onClick={applyMarkup} className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/25 transition-colors">
              {isAr ? 'تطبيق النسبة على كل البيع' : 'Apply % to All Sells'}
            </button>
          </div>

          <FormSection title={isAr ? 'أسعار التخليص' : 'Clearance Prices'}>
            <div className="overflow-x-auto">
              <div className="min-w-[680px] space-y-1">
                <div className="grid grid-cols-[1.2fr_1fr_1fr_80px] gap-2 px-1">
                  <span className="text-[10px] text-brand-text-muted uppercase">{isAr ? 'البند' : 'Item'}</span>
                  <span className="text-[10px] text-brand-text-muted uppercase">{isAr ? 'شراء' : 'Buy'}</span>
                  <span className="text-[10px] text-brand-text-muted uppercase">{isAr ? 'بيع' : 'Sell'}</span>
                  <span className="text-[10px] text-brand-text-muted uppercase text-center">{isAr ? 'هامش' : 'Margin'}</span>
                </div>
                {PRICE_FIELDS.filter(([key]) => form.service_mode === 'sea' || !['inspection_ramp', 'port_inspection'].includes(key)).map(([key, label]) => (
                  <PriceInputRow key={key} field={key} label={label} form={form} setField={setField} />
                ))}
                <div className="grid grid-cols-[1.2fr_1fr_1fr_80px] gap-2 items-center">
                  <span className="text-xs text-brand-text-muted">{isAr ? 'بطاقة الاستيراد والتصدير %' : 'Import / Export Card %'}</span>
                  <input type="number" step="0.001" min="0" className="input-base text-xs" value={form.buy_import_export_card_pct} onChange={e => setField('buy_import_export_card_pct', e.target.value)} />
                  <input type="number" step="0.001" min="0" className="input-base text-xs" value={form.sell_import_export_card_pct} onChange={e => setField('sell_import_export_card_pct', e.target.value)} />
                  <div className="text-xs text-center text-brand-text-muted">{margin(form.buy_import_export_card_pct, form.sell_import_export_card_pct)}</div>
                </div>
              </div>
            </div>
          </FormSection>

          <Textarea label={t('common.notes')} value={form.notes} onChange={e => setField('notes', e.target.value)} />
        </div>
      </Modal>

      <Modal open={!!deletingRate} onClose={() => setDeletingRate(null)} title={t('common.confirm_delete')} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingRate(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" loading={deleteRateMut.isPending} onClick={() => deletingRate && deleteRateMut.mutate(deletingRate.id)}>{t('common.delete')}</Button>
          </>
        }>
        <p className="text-sm text-brand-text-muted">{isAr ? 'حذف سعر التخليص هذا؟' : 'Delete this clearance rate?'}</p>
      </Modal>
    </div>
  )
}

function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={13} className="text-brand-text-muted mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-brand-text-muted uppercase tracking-wider">{label}</p>
        <p className="text-sm text-brand-text break-words">{value}</p>
      </div>
    </div>
  )
}

function PriceInputRow({ field, label, form, setField }: { field: PriceKey; label: string; form: RateForm; setField: (field: string, value: string) => void }) {
  const buyKey = `buy_${field}`
  const sellKey = `sell_${field}`
  return (
    <div className="grid grid-cols-[1.2fr_1fr_1fr_80px] gap-2 items-center">
      <span className="text-xs text-brand-text-muted">{label}</span>
      <input type="number" step="0.01" min="0" className="input-base text-xs" value={form[buyKey]} onChange={e => setField(buyKey, e.target.value)} />
      <input type="number" step="0.01" min="0" className="input-base text-xs" value={form[sellKey]} onChange={e => setField(sellKey, e.target.value)} />
      <div className="text-xs text-center text-brand-text-muted">{margin(form[buyKey], form[sellKey])}</div>
    </div>
  )
}

function RateCard({ rate, isAr, canEdit, onEdit, onDelete }: { rate: ClearanceAgentRate; isAr: boolean; canEdit: boolean; onEdit: () => void; onDelete: () => void }) {
  const Icon = rate.service_mode === 'air' ? Wind : Ship
  const row = (label: string, buy: number | null, sell: number | null, suffix = '') => (
    <div className="grid grid-cols-4 gap-2 py-2 border-b border-brand-border/30 last:border-0 text-sm">
      <span className="text-brand-text-muted text-xs">{label}</span>
      <span className="font-mono text-brand-text text-center">{buy == null ? '—' : `${money(buy)}${suffix}`}</span>
      <span className="font-mono text-emerald-400 text-center">{sell == null ? '—' : `${money(sell)}${suffix}`}</span>
      <span className="text-xs text-brand-text-muted text-center">{margin(buy, sell)}</span>
    </div>
  )
  return (
    <div className="rounded-xl border border-brand-border/60 bg-brand-surface overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.03] border-b border-brand-border/40">
        <Icon size={13} className={rate.service_mode === 'air' ? 'text-violet-400' : 'text-blue-400'} />
        <span className="text-sm font-bold text-brand-text">{rate.service_mode === 'air' ? (isAr ? 'تخليص جوي' : 'Air Clearance') : (isAr ? 'تخليص بحري' : 'Sea Clearance')}</span>
        <span className="text-xs text-brand-text-muted">{[rate.country, rate.port, rate.route].filter(Boolean).join(' · ')}</span>
        {canEdit && (
          <div className="ms-auto flex items-center gap-1">
            <button type="button" onClick={onEdit} className="btn-icon p-1.5 text-brand-text-muted hover:text-brand-primary-light"><Pencil size={13} /></button>
            <button type="button" onClick={onDelete} className="btn-icon p-1.5 text-brand-text-muted hover:text-red-400"><Trash2 size={13} /></button>
          </div>
        )}
      </div>
      <div className="px-4 py-2.5">
        <div className="grid grid-cols-4 gap-2 mb-1">
          {['', isAr ? 'شراء' : 'Buy', isAr ? 'بيع' : 'Sell', isAr ? 'هامش' : 'Margin'].map((h, i) => (
            <span key={i} className="text-[10px] text-brand-text-muted uppercase tracking-wider text-center first:text-start">{h}</span>
          ))}
        </div>
        {row(isAr ? 'رسوم التخليص' : 'Clearance', rate.buy_clearance_fee, rate.sell_clearance_fee)}
        {row(isAr ? 'النقل' : 'Transportation', rate.buy_transportation, rate.sell_transportation)}
        {row(isAr ? 'إذن التسليم' : 'Delivery Auth.', rate.buy_delivery_authorization, rate.sell_delivery_authorization)}
        {rate.service_mode === 'sea' && row(isAr ? 'رامب التفتيش' : 'Inspection Ramp', rate.buy_inspection_ramp, rate.sell_inspection_ramp)}
        {rate.service_mode === 'sea' && row(isAr ? 'تفتيش الميناء' : 'Port Inspection', rate.buy_port_inspection, rate.sell_port_inspection)}
        <div className="grid grid-cols-4 gap-2 py-2 text-sm">
          <span className="text-brand-text-muted text-xs">{isAr ? 'بطاقة استيراد/تصدير' : 'Import/Export Card'}</span>
          <span className="font-mono text-brand-text text-center">{rate.buy_import_export_card_pct ?? '—'}%</span>
          <span className="font-mono text-emerald-400 text-center">{rate.sell_import_export_card_pct ?? '—'}%</span>
          <span className="text-xs text-brand-text-muted text-center">{margin(rate.buy_import_export_card_pct, rate.sell_import_export_card_pct)}</span>
        </div>
        {rate.notes && <p className="mt-2 pt-2 border-t border-brand-border/30 text-[11px] text-brand-text-muted">{rate.notes}</p>}
      </div>
    </div>
  )
}
