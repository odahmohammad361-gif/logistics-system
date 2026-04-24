import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  ArrowLeft, ArrowRight, Ship, Phone, Mail, MessageSquare,
  Warehouse, CreditCard, Plus, Trash2, Download, FileText,
  TrendingUp, TrendingDown, Minus, Upload, Loader2, Clock,
  User, X, CheckCircle2, AlertTriangle, Pencil,
} from 'lucide-react'
import {
  getAgentProfile, addPriceHistory, uploadAgentContract,
  deleteAgentContract, getAgentContractDownloadUrl, updateAgent,
} from '@/services/agentService'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, FormRow, FormSection, Textarea, Select } from '@/components/ui/Form'
import type { ShippingAgent, AgentPriceHistory, AgentContract, AgentEditLog } from '@/types'
import clsx from 'clsx'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return `$${Number(n).toFixed(2)}`
}

function margin(buy: number | null, sell: number | null) {
  if (!buy || !sell) return null
  return (((sell - buy) / buy) * 100).toFixed(1)
}

function MarginBadge({ buy, sell }: { buy: number | null; sell: number | null }) {
  const pct = margin(buy, sell)
  if (!pct) return <span className="text-xs text-gray-500">—</span>
  const n = parseFloat(pct)
  return (
    <span className={clsx(
      'inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full',
      n > 0 ? 'text-emerald-400 bg-emerald-400/10' : n < 0 ? 'text-brand-red bg-brand-red/10' : 'text-gray-400 bg-white/5',
    )}>
      {n > 0 ? <TrendingUp size={10} /> : n < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
      {pct}%
    </span>
  )
}

// ── Price Row ──────────────────────────────────────────────────────────────────
function PriceRow({ label, buy, sell }: { label: string; buy: number | null; sell: number | null }) {
  return (
    <div className="grid grid-cols-4 gap-2 py-2 border-b border-brand-border/30 last:border-0 text-sm">
      <span className="text-brand-text-muted text-xs">{label}</span>
      <span className="font-mono text-brand-text text-center">{fmt(buy)}</span>
      <span className="font-mono text-emerald-400 text-center">{fmt(sell)}</span>
      <div className="text-center"><MarginBadge buy={buy} sell={sell} /></div>
    </div>
  )
}

// ── Action LOG item ────────────────────────────────────────────────────────────
const LOG_COLORS: Record<string, string> = {
  update:           'text-blue-400 bg-blue-400/10',
  price_update:     'text-amber-400 bg-amber-400/10',
  contract_upload:  'text-emerald-400 bg-emerald-400/10',
  contract_delete:  'text-red-400 bg-red-400/10',
}
const LOG_ICONS: Record<string, React.ElementType> = {
  update:           Pencil,
  price_update:     TrendingUp,
  contract_upload:  Upload,
  contract_delete:  Trash2,
}

function LogItem({ entry, isAr }: { entry: AgentEditLog; isAr: boolean }) {
  const Icon = LOG_ICONS[entry.action] ?? Clock
  return (
    <div className="flex gap-3 py-3 border-b border-brand-border/30 last:border-0">
      <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', LOG_COLORS[entry.action] ?? 'text-gray-400 bg-white/5')}>
        <Icon size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-brand-text capitalize">{entry.action.replace('_', ' ')}</p>
        {entry.summary && <p className="text-[11px] text-brand-text-muted mt-0.5 break-words">{entry.summary}</p>}
        <p className="text-[11px] text-brand-text-dim mt-0.5">
          {entry.changed_by ?? (isAr ? 'نظام' : 'System')} · {new Date(entry.changed_at).toLocaleString(isAr ? 'ar-JO' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
interface PriceForm {
  effective_date: string
  buy_20gp: string; sell_20gp: string
  buy_40ft: string; sell_40ft: string
  buy_40hq: string; sell_40hq: string
  buy_air_kg: string; sell_air_kg: string
  transit_sea_days: string; transit_air_days: string
  notes: string
  update_current: boolean
}

export default function AgentProfilePage() {
  const { id }      = useParams<{ id: string }>()
  const agentId     = Number(id)
  const { t, i18n } = useTranslation()
  const isAr        = i18n.language === 'ar'
  const navigate    = useNavigate()
  const qc          = useQueryClient()
  const { isStaff, isAdmin } = useAuth()
  const BackIcon    = isAr ? ArrowRight : ArrowLeft

  const [priceModal, setPriceModal]       = useState(false)
  const [contractModal, setContractModal] = useState(false)
  const [deletingContract, setDeletingContract] = useState<AgentContract | null>(null)
  const [contractFile, setContractFile]   = useState<File | null>(null)
  const [uploading, setUploading]         = useState(false)
  const [contractTitle, setContractTitle] = useState('')
  const [contractValidFrom, setContractValidFrom] = useState('')
  const [contractValidTo, setContractValidTo]     = useState('')
  const [contractNotes, setContractNotes]         = useState('')

  const { data: agent, isLoading } = useQuery<ShippingAgent>({
    queryKey: ['agent-profile', agentId],
    queryFn:  () => getAgentProfile(agentId),
    enabled:  !isNaN(agentId),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PriceForm>({
    defaultValues: { effective_date: new Date().toISOString().slice(0, 10), update_current: true },
  })

  const priceMut = useMutation({
    mutationFn: (v: PriceForm) => addPriceHistory(agentId, {
      effective_date:   v.effective_date,
      buy_20gp:         v.buy_20gp  ? parseFloat(v.buy_20gp)  : null,
      sell_20gp:        v.sell_20gp ? parseFloat(v.sell_20gp) : null,
      buy_40ft:         v.buy_40ft  ? parseFloat(v.buy_40ft)  : null,
      sell_40ft:        v.sell_40ft ? parseFloat(v.sell_40ft) : null,
      buy_40hq:         v.buy_40hq  ? parseFloat(v.buy_40hq)  : null,
      sell_40hq:        v.sell_40hq ? parseFloat(v.sell_40hq) : null,
      buy_air_kg:       v.buy_air_kg  ? parseFloat(v.buy_air_kg)  : null,
      sell_air_kg:      v.sell_air_kg ? parseFloat(v.sell_air_kg) : null,
      transit_sea_days: v.transit_sea_days ? parseInt(v.transit_sea_days) : null,
      transit_air_days: v.transit_air_days ? parseInt(v.transit_air_days) : null,
      notes: v.notes || null,
      update_current: v.update_current,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent-profile', agentId] }); setPriceModal(false); reset() },
  })

  const deleteContractMut = useMutation({
    mutationFn: (contractId: number) => deleteAgentContract(agentId, contractId),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['agent-profile', agentId] }); setDeletingContract(null) },
  })

  async function handleContractUpload() {
    if (!contractFile || !contractTitle) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', contractFile)
      form.append('title', contractTitle)
      form.append('valid_from', contractValidFrom)
      form.append('valid_to', contractValidTo)
      form.append('notes', contractNotes)
      await uploadAgentContract(agentId, form)
      qc.invalidateQueries({ queryKey: ['agent-profile', agentId] })
      setContractModal(false)
      setContractFile(null); setContractTitle(''); setContractValidFrom(''); setContractValidTo(''); setContractNotes('')
    } finally {
      setUploading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse max-w-5xl mx-auto">
        <div className="skeleton h-10 w-64 rounded-lg" />
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="skeleton h-80 rounded-xl" />
          <div className="skeleton h-80 rounded-xl lg:col-span-2" />
        </div>
      </div>
    )
  }

  if (!agent) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-brand-text-muted">
      <Ship size={40} className="opacity-30" />
      <p>{isAr ? 'الوكيل غير موجود' : 'Agent not found'}</p>
      <button className="btn-secondary text-sm" onClick={() => navigate('/shipping-agents')}>
        {isAr ? 'العودة' : 'Back'}
      </button>
    </div>
  )

  const history  = agent.price_history ?? []
  const contracts = agent.contracts ?? []
  const editLog   = agent.edit_log   ?? []

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/shipping-agents')} className="btn-icon" title={isAr ? 'رجوع' : 'Back'}>
          <BackIcon size={18} />
        </button>
        <div>
          <h1 className="page-title">{agent.name}</h1>
          {agent.name_ar && <p className="page-subtitle">{agent.name_ar}</p>}
        </div>
        <div className="ms-auto flex items-center gap-2 flex-wrap">
          {agent.serves_sea && (
            <span className="badge bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs">
              <Ship size={11} /> {isAr ? 'بحري' : 'Sea'}
            </span>
          )}
          {agent.serves_air && (
            <span className="badge bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs">
              ✈ {isAr ? 'جوي' : 'Air'}
            </span>
          )}
          <span className={clsx('badge border text-xs', agent.is_active
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border-red-500/20')}>
            {agent.is_active ? <><CheckCircle2 size={11} /> {isAr ? 'نشط' : 'Active'}</> : <><X size={11} /> {isAr ? 'غير نشط' : 'Inactive'}</>}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">

        {/* ── LEFT: Info ── */}
        <div className="space-y-4">

          {/* Contact */}
          <div className="card space-y-3">
            <h3 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
              {isAr ? 'التواصل' : 'Contact'}
            </h3>
            {[
              { icon: User,         label: isAr ? 'المسؤول' : 'Contact Person', value: agent.contact_person },
              { icon: Phone,        label: isAr ? 'الهاتف'  : 'Phone',          value: agent.phone },
              { icon: MessageSquare,label: 'WhatsApp',                           value: agent.whatsapp },
              { icon: MessageSquare,label: 'WeChat',                             value: agent.wechat_id },
              { icon: Mail,         label: isAr ? 'الإيميل' : 'Email',          value: agent.email },
            ].filter(r => r.value).map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2.5">
                <Icon size={13} className="text-brand-text-muted mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-brand-text-muted uppercase tracking-wider">{label}</p>
                  <p className="text-sm text-brand-text">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Warehouse */}
          {(agent.warehouse_city || agent.warehouse_address) && (
            <div className="card space-y-2">
              <h3 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Warehouse size={12} /> {isAr ? 'المستودع' : 'Warehouse'}
              </h3>
              {agent.warehouse_city    && <p className="text-sm text-brand-text">{agent.warehouse_city}</p>}
              {agent.warehouse_address && <p className="text-xs text-brand-text-muted">{agent.warehouse_address}</p>}
            </div>
          )}

          {/* Bank */}
          {(agent.bank_name || agent.bank_account) && (
            <div className="card space-y-2">
              <h3 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard size={12} /> {isAr ? 'البنك' : 'Bank'}
              </h3>
              {agent.bank_name    && <p className="text-sm text-brand-text">{agent.bank_name}</p>}
              {agent.bank_account && <p className="text-xs text-brand-text-muted font-mono">{agent.bank_account}</p>}
              {agent.bank_swift   && <p className="text-xs text-brand-text-muted font-mono">{agent.bank_swift}</p>}
            </div>
          )}

          {/* Notes */}
          {agent.notes && (
            <div className="card">
              <p className="text-[10px] text-brand-text-muted uppercase tracking-wider mb-1">{isAr ? 'ملاحظات' : 'Notes'}</p>
              <p className="text-sm text-brand-text-dim">{agent.notes}</p>
            </div>
          )}
        </div>

        {/* ── RIGHT ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Current Prices */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-brand-text flex items-center gap-2">
                <TrendingUp size={14} className="text-emerald-400" />
                {isAr ? 'الأسعار الحالية' : 'Current Prices'}
              </h3>
              {isStaff && (
                <Button size="sm" onClick={() => { setPriceModal(true); reset({ effective_date: new Date().toISOString().slice(0, 10), update_current: true }) }}>
                  <Plus size={13} /> {isAr ? 'تحديث الأسعار' : 'Update Prices'}
                </Button>
              )}
            </div>

            {/* Sea prices */}
            {agent.serves_sea && (
              <div className="mb-4">
                <div className="grid grid-cols-4 gap-2 mb-1.5">
                  <span className="text-[10px] text-brand-text-muted uppercase">{isAr ? 'الحجم' : 'Size'}</span>
                  <span className="text-[10px] text-brand-text-muted uppercase text-center">{isAr ? 'شراء' : 'Buy'}</span>
                  <span className="text-[10px] text-brand-text-muted uppercase text-center">{isAr ? 'بيع' : 'Sell'}</span>
                  <span className="text-[10px] text-brand-text-muted uppercase text-center">{isAr ? 'هامش' : 'Margin'}</span>
                </div>
                <PriceRow label="20GP" buy={agent.price_20gp} sell={agent.sell_price_20gp} />
                <PriceRow label="40GP" buy={agent.price_40ft} sell={agent.sell_price_40ft} />
                <PriceRow label="40HQ" buy={agent.price_40hq} sell={agent.sell_price_40hq} />
                {(agent.transit_sea_days != null) && (
                  <p className="text-[11px] text-brand-text-muted mt-2">
                    ⏱ {isAr ? 'مدة العبور البحري:' : 'Sea transit:'} {agent.transit_sea_days} {isAr ? 'يوم' : 'days'}
                  </p>
                )}
              </div>
            )}

            {/* Air prices */}
            {agent.serves_air && (
              <div>
                {agent.serves_sea && <div className="border-t border-brand-border/50 pt-3 mt-2" />}
                <div className="grid grid-cols-4 gap-2 mb-1.5">
                  <span className="text-[10px] text-brand-text-muted uppercase">{isAr ? 'الجوي' : 'Air'}</span>
                  <span className="text-[10px] text-brand-text-muted uppercase text-center">{isAr ? 'شراء/كغ' : 'Buy/kg'}</span>
                  <span className="text-[10px] text-brand-text-muted uppercase text-center">{isAr ? 'بيع/كغ' : 'Sell/kg'}</span>
                  <span className="text-[10px] text-brand-text-muted uppercase text-center">{isAr ? 'هامش' : 'Margin'}</span>
                </div>
                <PriceRow label="Air /kg" buy={agent.price_air_kg} sell={agent.sell_price_air_kg} />
                {(agent.transit_air_days != null) && (
                  <p className="text-[11px] text-brand-text-muted mt-2">
                    ⏱ {isAr ? 'مدة العبور الجوي:' : 'Air transit:'} {agent.transit_air_days} {isAr ? 'يوم' : 'days'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Price History */}
          <div className="card">
            <h3 className="text-sm font-semibold text-brand-text mb-4 flex items-center gap-2">
              <Clock size={14} className="text-amber-400" />
              {isAr ? 'سجل الأسعار الأسبوعي' : 'Weekly Price History'}
              <span className="text-xs text-brand-text-muted">({history.length})</span>
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-brand-text-muted text-center py-6">{isAr ? 'لا يوجد سجل أسعار بعد' : 'No price history yet'}</p>
            ) : (
              <div className="space-y-3">
                {history.map((ph) => (
                  <div key={ph.id} className="rounded-xl border border-brand-border/50 bg-brand-surface overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-white/[0.02] border-b border-brand-border/40">
                      <span className="text-sm font-semibold text-brand-text font-mono">{ph.effective_date}</span>
                      <span className="text-[11px] text-brand-text-muted">{ph.created_by} · {ph.created_at?.slice(0, 10)}</span>
                    </div>
                    <div className="px-4 py-2.5 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      {ph.buy_20gp != null  && <span className="text-brand-text-muted">20GP: <span className="text-brand-text font-mono">{fmt(ph.buy_20gp)}</span> → <span className="text-emerald-400 font-mono">{fmt(ph.sell_20gp)}</span> <MarginBadge buy={ph.buy_20gp} sell={ph.sell_20gp} /></span>}
                      {ph.buy_40ft != null  && <span className="text-brand-text-muted">40GP: <span className="text-brand-text font-mono">{fmt(ph.buy_40ft)}</span> → <span className="text-emerald-400 font-mono">{fmt(ph.sell_40ft)}</span> <MarginBadge buy={ph.buy_40ft} sell={ph.sell_40ft} /></span>}
                      {ph.buy_40hq != null  && <span className="text-brand-text-muted">40HQ: <span className="text-brand-text font-mono">{fmt(ph.buy_40hq)}</span> → <span className="text-emerald-400 font-mono">{fmt(ph.sell_40hq)}</span> <MarginBadge buy={ph.buy_40hq} sell={ph.sell_40hq} /></span>}
                      {ph.buy_air_kg != null && <span className="text-brand-text-muted">Air/kg: <span className="text-brand-text font-mono">{fmt(ph.buy_air_kg)}</span> → <span className="text-emerald-400 font-mono">{fmt(ph.sell_air_kg)}</span> <MarginBadge buy={ph.buy_air_kg} sell={ph.sell_air_kg} /></span>}
                    </div>
                    {ph.notes && <p className="px-4 pb-2 text-[11px] text-brand-text-muted">{ph.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contracts */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-brand-text flex items-center gap-2">
                <FileText size={14} className="text-blue-400" />
                {isAr ? 'العقود والوثائق' : 'Contracts & Documents'}
                <span className="text-xs text-brand-text-muted">({contracts.length})</span>
              </h3>
              {isStaff && (
                <Button size="sm" variant="secondary" onClick={() => setContractModal(true)}>
                  <Upload size={13} /> {isAr ? 'رفع وثيقة' : 'Upload'}
                </Button>
              )}
            </div>

            {contracts.length === 0 ? (
              <p className="text-sm text-brand-text-muted text-center py-6">{isAr ? 'لا توجد وثائق بعد' : 'No contracts yet'}</p>
            ) : (
              <div className="space-y-2">
                {contracts.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-brand-border/50 bg-brand-surface">
                    <FileText size={18} className="text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-text truncate">{c.title}</p>
                      <p className="text-[11px] text-brand-text-muted">
                        {c.original_filename}
                        {c.valid_from && ` · ${isAr ? 'من' : 'from'} ${c.valid_from}`}
                        {c.valid_to   && ` ${isAr ? 'إلى' : 'to'} ${c.valid_to}`}
                      </p>
                    </div>
                    <a
                      href={getAgentContractDownloadUrl(agentId, c.id)}
                      target="_blank" rel="noopener noreferrer"
                      className="btn-icon p-1.5 text-blue-400 hover:bg-blue-400/10"
                      title={isAr ? 'تحميل' : 'Download'}
                    >
                      <Download size={14} />
                    </a>
                    {isAdmin && (
                      <button
                        onClick={() => setDeletingContract(c)}
                        className="btn-icon p-1.5 hover:text-brand-red hover:bg-brand-red/10"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edit Log */}
          <div className="card">
            <h3 className="text-sm font-semibold text-brand-text mb-4 flex items-center gap-2">
              <Clock size={14} className="text-brand-text-muted" />
              {isAr ? 'سجل التعديلات' : 'Activity Log'}
              <span className="text-xs text-brand-text-muted">({editLog.length})</span>
            </h3>
            {editLog.length === 0 ? (
              <p className="text-sm text-brand-text-muted text-center py-6">{isAr ? 'لا يوجد سجل تعديلات' : 'No activity yet'}</p>
            ) : (
              <div>
                {editLog.slice(0, 20).map(entry => (
                  <LogItem key={entry.id} entry={entry} isAr={isAr} />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Add Price Modal ── */}
      <Modal
        open={priceModal}
        onClose={() => setPriceModal(false)}
        title={isAr ? 'تحديث الأسعار الأسبوعية' : 'Weekly Price Update'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPriceModal(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
            <Button loading={priceMut.isPending} onClick={handleSubmit(v => priceMut.mutate(v))}>
              {isAr ? 'حفظ الأسعار' : 'Save Prices'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <FormSection title={isAr ? 'التاريخ' : 'Date'}>
            <Input type="date" label={isAr ? 'تاريخ السريان' : 'Effective Date'}
              {...register('effective_date', { required: true })}
              error={errors.effective_date ? (isAr ? 'مطلوب' : 'Required') : undefined}
            />
            <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
              <input type="checkbox" className="rounded" {...register('update_current')} />
              {isAr ? 'تحديث الأسعار الحالية للوكيل أيضاً' : 'Also update agent\'s current prices'}
            </label>
          </FormSection>

          {agent.serves_sea && (
            <FormSection title={isAr ? 'أسعار الشحن البحري (USD)' : 'Sea Freight Prices (USD)'}>
              <div className="grid grid-cols-4 gap-2 mb-2 text-[10px] text-brand-text-muted uppercase tracking-wider">
                <span>{isAr ? 'الحجم' : 'Size'}</span>
                <span>{isAr ? 'سعر الشراء' : 'Buy Price'}</span>
                <span>{isAr ? 'سعر البيع' : 'Sell Price'}</span>
                <span></span>
              </div>
              {[
                { key: '20gp', label: '20GP' },
                { key: '40ft', label: '40GP' },
                { key: '40hq', label: '40HQ' },
              ].map(({ key, label }) => (
                <div key={key} className="grid grid-cols-3 gap-3 items-end">
                  <Input label={`${label} — ${isAr ? 'شراء' : 'Buy'}`} type="number" step="0.01" min="0"
                    {...register(`buy_${key}` as any)} />
                  <Input label={`${label} — ${isAr ? 'بيع' : 'Sell'}`} type="number" step="0.01" min="0"
                    {...register(`sell_${key}` as any)} />
                  <div className="pb-2.5 text-[11px] text-brand-text-muted">{isAr ? 'هامش يحسب تلقائياً' : 'Margin auto-calculated'}</div>
                </div>
              ))}
              <FormRow>
                <Input label={isAr ? 'مدة العبور البحري (أيام)' : 'Sea Transit (days)'} type="number" min="0"
                  {...register('transit_sea_days')} />
                <div />
              </FormRow>
            </FormSection>
          )}

          {agent.serves_air && (
            <FormSection title={isAr ? 'أسعار الشحن الجوي (USD/كغ)' : 'Air Freight Prices (USD/kg)'}>
              <FormRow>
                <Input label={isAr ? 'شراء / كغ' : 'Buy / kg'} type="number" step="0.01" min="0"
                  {...register('buy_air_kg')} />
                <Input label={isAr ? 'بيع / كغ' : 'Sell / kg'} type="number" step="0.01" min="0"
                  {...register('sell_air_kg')} />
              </FormRow>
              <Input label={isAr ? 'مدة العبور الجوي (أيام)' : 'Air Transit (days)'} type="number" min="0"
                {...register('transit_air_days')} />
            </FormSection>
          )}

          <Input label={isAr ? 'ملاحظات' : 'Notes'} placeholder={isAr ? 'سبب التغيير، مصدر السعر...' : 'Reason for change, source...'}
            {...register('notes')} />
        </div>
      </Modal>

      {/* ── Upload Contract Modal ── */}
      <Modal
        open={contractModal}
        onClose={() => setContractModal(false)}
        title={isAr ? 'رفع وثيقة / عقد' : 'Upload Contract / Document'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setContractModal(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
            <Button loading={uploading} onClick={handleContractUpload} disabled={!contractFile || !contractTitle}>
              <Upload size={14} /> {isAr ? 'رفع' : 'Upload'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="label-base">{isAr ? 'الملف (PDF أو صورة)' : 'File (PDF or image)'}</label>
            <label className={clsx(
              'flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all',
              contractFile ? 'border-brand-primary/50 bg-brand-primary/5' : 'border-brand-border hover:border-brand-primary/40',
            )}>
              <Upload size={20} className="text-brand-text-muted" />
              <span className="text-sm text-brand-text-muted">
                {contractFile ? contractFile.name : (isAr ? 'اختر ملف PDF أو صورة' : 'Choose PDF or image file')}
              </span>
              <input type="file" accept=".pdf,image/*" className="hidden"
                onChange={e => setContractFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <Input label={isAr ? 'عنوان الوثيقة' : 'Document Title'} value={contractTitle}
            onChange={e => setContractTitle(e.target.value)} placeholder={isAr ? 'مثال: عقد 2026، سعر الشحن يناير...' : 'e.g. Contract 2026, Jan freight rate...'} />
          <FormRow>
            <Input type="date" label={isAr ? 'صالح من' : 'Valid From'} value={contractValidFrom}
              onChange={e => setContractValidFrom(e.target.value)} />
            <Input type="date" label={isAr ? 'صالح حتى' : 'Valid To'} value={contractValidTo}
              onChange={e => setContractValidTo(e.target.value)} />
          </FormRow>
          <Input label={isAr ? 'ملاحظات' : 'Notes'} value={contractNotes}
            onChange={e => setContractNotes(e.target.value)} />
        </div>
      </Modal>

      {/* ── Delete Contract Confirm ── */}
      <Modal open={!!deletingContract} onClose={() => setDeletingContract(null)} title={isAr ? 'تأكيد الحذف' : 'Confirm Delete'} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingContract(null)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
            <Button variant="danger" loading={deleteContractMut.isPending}
              onClick={() => deletingContract && deleteContractMut.mutate(deletingContract.id)}>
              {isAr ? 'حذف' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-brand-text-dim">
          {isAr ? `هل تريد حذف الوثيقة: "${deletingContract?.title}"؟` : `Delete contract "${deletingContract?.title}"?`}
        </p>
      </Modal>
    </div>
  )
}
