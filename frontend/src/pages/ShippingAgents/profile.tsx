import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowRight, Ship, Plane, Phone, Mail, MessageSquare,
  Warehouse, CreditCard, Plus, Trash2, Download, FileText,
  TrendingUp, TrendingDown, Minus, Upload, Clock,
  User, X, CheckCircle2, AlertTriangle, Pencil, Globe,
  MapPin, Calendar, Timer,
} from 'lucide-react'
import {
  getAgentProfile, addPriceHistory, uploadAgentContract,
  deleteAgentContract, getAgentContractDownloadUrl,
} from '@/services/agentService'
import { getWarehouses } from '@/services/warehouseService'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, FormRow, FormSection } from '@/components/ui/Form'
import type { ShippingAgent, AgentContract, AgentEditLog, CompanyWarehouse } from '@/types'
import { getFlatPortOptions } from '@/constants/logistics'

const SEA_PORT_OPTIONS = getFlatPortOptions('sea')

const COMMON_SEA_CARRIERS = [
  'CMA CGM', 'MSC', 'Evergreen', 'PIL', 'COSCO', 'Yang Ming',
  'Hapag-Lloyd', 'ONE', 'HMM', 'ZIM', 'OOCL', 'Maersk', 'Wan Hai',
]
import clsx from 'clsx'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtUSD(n: number | null | undefined, suffix = '') {
  if (n == null) return '—'
  return `$${Number(n).toFixed(2)}${suffix}`
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
      n > 0 ? 'text-emerald-400 bg-emerald-400/10' : n < 0 ? 'text-red-400 bg-red-400/10' : 'text-gray-400 bg-white/5',
    )}>
      {n > 0 ? <TrendingUp size={10} /> : n < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
      {pct}%
    </span>
  )
}

function PriceRow({ label, buy, sell }: { label: string; buy: number | null; sell: number | null }) {
  return (
    <div className="grid grid-cols-4 gap-2 py-2 border-b border-brand-border/30 last:border-0 text-sm">
      <span className="text-brand-text-muted text-xs font-mono">{label}</span>
      <span className="font-mono text-brand-text text-center">{fmtUSD(buy)}</span>
      <span className="font-mono text-emerald-400 text-center">{fmtUSD(sell)}</span>
      <div className="text-center"><MarginBadge buy={buy} sell={sell} /></div>
    </div>
  )
}

// ── Offer validity banner ──────────────────────────────────────────────────────
function OfferBanner({ validFrom, validTo, isAr }: { validFrom: string | null; validTo: string | null; isAr: boolean }) {
  if (!validFrom && !validTo) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const start  = validFrom ? new Date(validFrom) : null
  const expiry = validTo   ? new Date(validTo)   : null
  const days   = expiry ? Math.round((expiry.getTime() - today.getTime()) / 86400000) : null
  const isExpired      = days !== null && days < 0
  const isExpiringSoon = days !== null && days >= 0 && days <= 14
  const isActive       = days !== null && days > 14

  // Total span for progress bar
  const totalDays = (start && expiry)
    ? Math.round((expiry.getTime() - start.getTime()) / 86400000)
    : null
  const elapsed = (start && totalDays)
    ? Math.round((today.getTime() - start.getTime()) / 86400000)
    : null
  const progressPct = (totalDays && elapsed !== null)
    ? Math.min(100, Math.max(0, (elapsed / totalDays) * 100))
    : null

  const outerBg  = isExpired ? 'bg-red-500/8 border-red-500/30'   : isExpiringSoon ? 'bg-amber-500/8 border-amber-500/30' : 'bg-emerald-500/8 border-emerald-500/30'
  const accentCl = isExpired ? 'text-red-400'                      : isExpiringSoon ? 'text-amber-400'                    : 'text-emerald-400'
  const barColor = isExpired ? 'bg-red-500'                        : isExpiringSoon ? 'bg-amber-500'                      : 'bg-emerald-500'
  const IconEl   = isExpired ? AlertTriangle : isExpiringSoon ? Timer : CheckCircle2

  const label = isExpired
    ? (isAr ? 'انتهى العرض' : 'Offer Expired')
    : (isAr ? 'العرض ساري' : 'Offer Active')

  const sublabel = isExpired
    ? (isAr ? `منذ ${Math.abs(days!)} يوم` : `${Math.abs(days!)} days ago`)
    : days === 0
      ? (isAr ? 'ينتهي اليوم!' : 'Expires today!')
      : (isAr ? `${days} يوم متبقٍ` : `${days} days remaining`)

  return (
    <div className={clsx('rounded-2xl border p-5', outerBg)}>
      <div className="flex items-start gap-4">
        {/* Big countdown number */}
        <div className={clsx('flex-shrink-0 w-20 h-20 rounded-2xl flex flex-col items-center justify-center border',
          isExpired ? 'bg-red-500/15 border-red-500/30' : isExpiringSoon ? 'bg-amber-500/15 border-amber-500/30' : 'bg-emerald-500/15 border-emerald-500/30')}>
          <IconEl size={18} className={clsx(accentCl, 'mb-1')} />
          {days !== null && (
            <span className={clsx('text-2xl font-black leading-none', accentCl)}>
              {Math.abs(days)}
            </span>
          )}
          <span className={clsx('text-[9px] uppercase tracking-widest mt-0.5', accentCl, 'opacity-70')}>
            {isAr ? 'يوم' : 'days'}
          </span>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={clsx('text-base font-bold', accentCl)}>{label}</p>
          <p className={clsx('text-sm font-semibold mt-0.5', accentCl, 'opacity-80')}>{sublabel}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs text-brand-text-muted">
            {validFrom && <span>{isAr ? 'من:' : 'From:'} <span className="text-brand-text font-medium">{validFrom}</span></span>}
            {validTo   && <span>{isAr ? 'حتى:' : 'Until:'} <span className="text-brand-text font-medium">{validTo}</span></span>}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {progressPct !== null && (
        <div className="mt-4">
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className={clsx('h-full rounded-full transition-all', barColor)} style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-brand-text-muted">
            <span>{validFrom}</span>
            <span>{validTo}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Quote card ─────────────────────────────────────────────────────────────────
// ── Log item ───────────────────────────────────────────────────────────────────
const LOG_COLORS: Record<string, string> = {
  update:           'text-blue-400 bg-blue-400/10',
  price_update:     'text-amber-400 bg-amber-400/10',
  contract_upload:  'text-emerald-400 bg-emerald-400/10',
  contract_delete:  'text-red-400 bg-red-400/10',
}
const LOG_ICONS: Record<string, React.ElementType> = {
  update: Pencil, price_update: TrendingUp, contract_upload: Upload, contract_delete: Trash2,
}
function LogItem({ entry, isAr }: { entry: AgentEditLog; isAr: boolean }) {
  const Icon = LOG_ICONS[entry.action] ?? Clock
  return (
    <div className="flex gap-3 py-3 border-b border-brand-border/30 last:border-0">
      <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', LOG_COLORS[entry.action] ?? 'text-gray-400 bg-white/5')}>
        <Icon size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-brand-text capitalize">{entry.action.replace(/_/g, ' ')}</p>
        {entry.summary && <p className="text-[11px] text-brand-text-muted mt-0.5 break-words">{entry.summary}</p>}
        <p className="text-[11px] text-brand-text-dim mt-0.5">
          {entry.changed_by ?? (isAr ? 'نظام' : 'System')} · {new Date(entry.changed_at).toLocaleString(isAr ? 'ar-JO' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </div>
    </div>
  )
}

// ── Live margin badge for form ────────────────────────────────────────────────
function LiveMargin({ buy, sell }: { buy: string; sell: string }) {
  const b = parseFloat(buy), s = parseFloat(sell)
  if (!b || !s || b === 0) return <span className="text-xs text-brand-text-dim">—%</span>
  const pct = (((s - b) / b) * 100)
  const color = pct > 0 ? 'text-emerald-400' : pct < 0 ? 'text-red-400' : 'text-gray-400'
  return <span className={clsx('text-xs font-bold tabular-nums', color)}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>
}

// ── Multi-carrier price form helpers ──────────────────────────────────────────
// Standard CBM defaults (editable per row)
const DEFAULT_CBM = { '20gp': '28', '40ft': '67', '40hq': '76' }
const CONTAINER_SIZES = [
  { k: '20gp' as const, label: '20GP' },
  { k: '40ft' as const, label: '40GP' },
  { k: '40hq' as const, label: '40HQ' },
]

function fieldFor(size: (typeof CONTAINER_SIZES)[number]['k'], prefix: 'buy' | 'sell' | 'cbm' | 'buy_lcl' | 'sell_lcl') {
  return `${prefix}_${size}` as keyof CarrierRow
}

interface CarrierRow {
  _id: string
  carrier_name: string
  pol: string; pod: string
  sealing_day: string
  vessel_day: string
  loading_warehouse_id: string
  // prices
  buy_20gp: string; sell_20gp: string; cbm_20gp: string
  buy_40ft: string; sell_40ft: string; cbm_40ft: string
  buy_40hq: string; sell_40hq: string; cbm_40hq: string
  buy_lcl_cbm: string; sell_lcl_cbm: string
  // per-size LCL per-CBM (entered per size, optional)
  buy_lcl_20gp: string; sell_lcl_20gp: string
  buy_lcl_40ft: string; sell_lcl_40ft: string
  buy_lcl_40hq: string; sell_lcl_40hq: string
  markup_pct: string
  transit_sea_days: string
  fee_loading: string
  fee_bl: string
  fee_trucking: string
  fee_other: string
  notes: string
}

function emptyCarrierRow(): CarrierRow {
  return {
    _id: Math.random().toString(36).slice(2),
    carrier_name: '', pol: '', pod: '',
    sealing_day: '', vessel_day: '', loading_warehouse_id: '',
    buy_20gp: '', sell_20gp: '', cbm_20gp: DEFAULT_CBM['20gp'],
    buy_40ft: '', sell_40ft: '', cbm_40ft: DEFAULT_CBM['40ft'],
    buy_40hq: '', sell_40hq: '', cbm_40hq: DEFAULT_CBM['40hq'],
    buy_lcl_cbm: '', sell_lcl_cbm: '',
    buy_lcl_20gp: '', sell_lcl_20gp: '',
    buy_lcl_40ft: '', sell_lcl_40ft: '',
    buy_lcl_40hq: '', sell_lcl_40hq: '',
    markup_pct: '', transit_sea_days: '',
    fee_loading: '', fee_bl: '', fee_trucking: '', fee_other: '',
    notes: '',
  }
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AgentProfilePage() {
  const { id }       = useParams<{ id: string }>()
  const agentId      = Number(id)
  const { t, i18n } = useTranslation()
  const isAr         = i18n.language === 'ar'
  const navigate     = useNavigate()
  const qc           = useQueryClient()
  const { isStaff, isAdmin } = useAuth()
  const BackIcon     = isAr ? ArrowRight : ArrowLeft

  const { data: agent, isLoading } = useQuery<ShippingAgent>({
    queryKey: ['agent-profile', agentId],
    queryFn:  () => getAgentProfile(agentId),
    enabled:  !isNaN(agentId),
  })

  const { data: warehouseData } = useQuery({
    queryKey: ['warehouses', 'loading'],
    queryFn:  () => getWarehouses({ warehouse_type: 'loading', page_size: 100 }),
  })

  const loadingWarehouses = (warehouseData?.results ?? []).filter(w => w.is_active)
  const warehouseById = new Map<number, CompanyWarehouse>(loadingWarehouses.map(w => [w.id, w]))

  const today = new Date().toISOString().slice(0, 10)

  // Price modal state
  const [priceModal, setPriceModal]       = useState(false)
  const [effectiveDate, setEffectiveDate] = useState(today)
  const [expiryDate, setExpiryDate]       = useState('')
  const [updateCurrent, setUpdateCurrent] = useState(true)
  const [carrierRows, setCarrierRows]     = useState<CarrierRow[]>([emptyCarrierRow()])
  const [airBuy, setAirBuy]               = useState('')
  const [airSell, setAirSell]             = useState('')
  const [airTransit, setAirTransit]       = useState('')

  function openPriceModal() {
    setEffectiveDate(today); setExpiryDate(''); setUpdateCurrent(true)
    setCarrierRows([emptyCarrierRow()]); setAirBuy(''); setAirSell(''); setAirTransit('')
    setPriceModal(true)
  }

  function setRow(id: string, field: keyof CarrierRow, value: string) {
    setCarrierRows(rows => rows.map(r => r._id === id ? { ...r, [field]: value } : r))
  }

  function applyMarkup(id: string) {
    setCarrierRows(rows => rows.map(r => {
      if (r._id !== id) return r
      const pct = parseFloat(r.markup_pct)
      if (!pct) return r
      const m = (v: string) => { const n = parseFloat(v); return n ? (n * (1 + pct / 100)).toFixed(2) : '' }
      return { ...r,
        sell_20gp: m(r.buy_20gp), sell_40ft: m(r.buy_40ft),
        sell_40hq: m(r.buy_40hq),
        sell_lcl_cbm: m(r.buy_lcl_cbm),
        sell_lcl_20gp: m(r.buy_lcl_20gp), sell_lcl_40ft: m(r.buy_lcl_40ft), sell_lcl_40hq: m(r.buy_lcl_40hq),
      }
    }))
  }

  const priceMut = useMutation({
    mutationFn: () => {
      const n = (s: string) => s ? parseFloat(s) : null
      const ni = (s: string) => s ? parseInt(s) : null
      return addPriceHistory(agentId, {
        effective_date: effectiveDate,
        expiry_date: expiryDate || null,
        buy_air_kg: n(airBuy), sell_air_kg: n(airSell),
        transit_air_days: ni(airTransit),
        update_current: updateCurrent,
        carriers: carrierRows
          .filter(r => r.carrier_name.trim())
          .map(r => ({
            carrier_name: r.carrier_name.trim(),
            pol: r.pol || null, pod: r.pod || null,
            buy_20gp: n(r.buy_20gp), sell_20gp: n(r.sell_20gp), cbm_20gp: n(r.cbm_20gp),
            buy_40ft: n(r.buy_40ft), sell_40ft: n(r.sell_40ft), cbm_40ft: n(r.cbm_40ft),
            buy_40hq: n(r.buy_40hq), sell_40hq: n(r.sell_40hq), cbm_40hq: n(r.cbm_40hq),
            buy_lcl_cbm: n(r.buy_lcl_cbm), sell_lcl_cbm: n(r.sell_lcl_cbm),
            buy_lcl_20gp: n(r.buy_lcl_20gp), sell_lcl_20gp: n(r.sell_lcl_20gp),
            buy_lcl_40ft: n(r.buy_lcl_40ft), sell_lcl_40ft: n(r.sell_lcl_40ft),
            buy_lcl_40hq: n(r.buy_lcl_40hq), sell_lcl_40hq: n(r.sell_lcl_40hq),
            transit_sea_days: ni(r.transit_sea_days),
            sealing_day: r.sealing_day || null,
            vessel_day: r.vessel_day || null,
            loading_warehouse_id: ni(r.loading_warehouse_id),
            fee_loading: n(r.fee_loading),
            fee_bl: n(r.fee_bl),
            fee_trucking: n(r.fee_trucking),
            fee_other: n(r.fee_other),
            notes: r.notes || null,
          })),
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent-profile', agentId] }); setPriceModal(false) },
  })

  // Contract modal state
  const [contractModal, setContractModal] = useState(false)
  const [deletingContract, setDeletingContract] = useState<AgentContract | null>(null)
  const [contractFile, setContractFile]   = useState<File | null>(null)
  const [uploading, setUploading]         = useState(false)
  const [contractTitle, setContractTitle] = useState('')
  const [contractValidFrom, setContractValidFrom] = useState('')
  const [contractValidTo, setContractValidTo]     = useState('')
  const [contractNotes, setContractNotes]         = useState('')

  const deleteContractMut = useMutation({
    mutationFn: (cid: number) => deleteAgentContract(agentId, cid),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['agent-profile', agentId] }); setDeletingContract(null) },
  })

  async function handleContractUpload() {
    if (!contractFile || !contractTitle) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', contractFile); form.append('title', contractTitle)
      form.append('valid_from', contractValidFrom); form.append('valid_to', contractValidTo)
      form.append('notes', contractNotes)
      await uploadAgentContract(agentId, form)
      qc.invalidateQueries({ queryKey: ['agent-profile', agentId] })
      setContractModal(false)
      setContractFile(null); setContractTitle(''); setContractValidFrom(''); setContractValidTo(''); setContractNotes('')
    } finally { setUploading(false) }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse max-w-5xl mx-auto">
        <div className="skeleton h-10 w-64 rounded-lg" />
        <div className="skeleton h-20 rounded-xl" />
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

  const history   = agent.price_history ?? []
  const contracts = agent.contracts   ?? []
  const editLog   = agent.edit_log    ?? []

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-8">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate('/shipping-agents')} className="btn-icon" title={isAr ? 'رجوع' : 'Back'}>
          <BackIcon size={18} />
        </button>
        <div className="flex-1">
          <h1 className="page-title">{agent.name}</h1>
          {agent.name_ar && <p className="page-subtitle">{agent.name_ar}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {agent.serves_sea && <span className="badge bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs"><Ship size={11} /> {isAr ? 'بحري' : 'Sea'}</span>}
          {agent.serves_air && <span className="badge bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs">✈ {isAr ? 'جوي' : 'Air'}</span>}
          <span className={clsx('badge border text-xs', agent.is_active
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border-red-500/20')}>
            {agent.is_active ? <><CheckCircle2 size={11} /> {isAr ? 'نشط' : 'Active'}</> : <><X size={11} /> {isAr ? 'غير نشط' : 'Inactive'}</>}
          </span>
        </div>
      </div>

      {/* ── Offer validity banner ── */}
      <OfferBanner validFrom={agent.offer_valid_from} validTo={agent.offer_valid_to} isAr={isAr} />

      <div className="grid lg:grid-cols-3 gap-5">

        {/* ── LEFT column ── */}
        <div className="space-y-4">

          {/* Contact & Identity */}
          <div className="card space-y-3">
            <h3 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-1">
              {isAr ? 'التواصل والهوية' : 'Contact & Identity'}
            </h3>
            {[
              { icon: Globe,         label: isAr ? 'الدولة'      : 'Country',        value: agent.country },
              { icon: User,          label: isAr ? 'المسؤول'     : 'Contact Person', value: agent.contact_person },
              { icon: Phone,         label: isAr ? 'الهاتف'      : 'Phone',          value: agent.phone },
              { icon: MessageSquare, label: 'WhatsApp',                               value: agent.whatsapp },
              { icon: MessageSquare, label: 'WeChat',                                 value: agent.wechat_id },
              { icon: Mail,          label: isAr ? 'الإيميل'     : 'Email',          value: agent.email },
            ].filter(r => r.value).map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2.5">
                <Icon size={13} className="text-brand-text-muted mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-brand-text-muted uppercase tracking-wider">{label}</p>
                  <p className="text-sm text-brand-text break-all">{value}</p>
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
              {agent.warehouse_city    && <div className="flex items-center gap-2"><MapPin size={12} className="text-brand-text-muted flex-shrink-0" /><p className="text-sm text-brand-text">{agent.warehouse_city}</p></div>}
              {agent.warehouse_address && <p className="text-xs text-brand-text-muted ps-5">{agent.warehouse_address}</p>}
            </div>
          )}

          {/* Transit days */}
          {(agent.transit_sea_days != null || agent.transit_air_days != null) && (
            <div className="card space-y-2">
              <h3 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={12} /> {isAr ? 'أيام العبور' : 'Transit Times'}
              </h3>
              {agent.transit_sea_days != null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-brand-text-muted"><Ship size={12} /> {isAr ? 'بحري' : 'Sea'}</span>
                  <span className="font-bold text-brand-text">{agent.transit_sea_days} {isAr ? 'يوم' : 'days'}</span>
                </div>
              )}
              {agent.transit_air_days != null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-brand-text-muted"><Plane size={12} /> {isAr ? 'جوي' : 'Air'}</span>
                  <span className="font-bold text-brand-text">{agent.transit_air_days} {isAr ? 'يوم' : 'days'}</span>
                </div>
              )}
            </div>
          )}

          {/* Bank */}
          {(agent.bank_name || agent.bank_account) && (
            <div className="card space-y-2">
              <h3 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard size={12} /> {isAr ? 'البنك' : 'Bank Details'}
              </h3>
              {agent.bank_name    && <p className="text-sm text-brand-text">{agent.bank_name}</p>}
              {agent.bank_account && <p className="text-xs text-brand-text-muted font-mono">{isAr ? 'حساب: ' : 'Account: '}{agent.bank_account}</p>}
              {agent.bank_swift   && <p className="text-xs text-brand-text-muted font-mono">SWIFT: {agent.bank_swift}</p>}
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

        {/* ── RIGHT column ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Current Carrier Rates */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-brand-text flex items-center gap-2">
                <TrendingUp size={14} className="text-emerald-400" />
                {isAr ? 'الأسعار الحالية (لكل شركة شحن)' : 'Current Rates (per Carrier)'}
                <span className="text-xs text-brand-text-muted">({(agent.carrier_rates ?? []).length})</span>
              </h3>
              {isStaff && (
                <Button size="sm" onClick={openPriceModal}>
                  <Plus size={13} /> {isAr ? 'تحديث الأسعار' : 'Update Prices'}
                </Button>
              )}
            </div>

            {(agent.carrier_rates ?? []).length === 0 ? (
              <p className="text-sm text-brand-text-muted text-center py-4">
                {isAr ? 'لا توجد أسعار بعد — أضف تحديث أسعار لإضافة شركات الشحن' : 'No rates yet — add a price update to define carriers'}
              </p>
            ) : (
              <div className="space-y-3">
                {(agent.carrier_rates ?? []).map(cr => (
                  <div key={cr.id} className="rounded-xl border border-brand-border/60 bg-brand-surface overflow-hidden">
                    {/* Carrier header */}
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.03] border-b border-brand-border/40">
                      <Ship size={13} className="text-blue-400 flex-shrink-0" />
                      <span className="text-sm font-bold text-brand-text">{cr.carrier_name}</span>
                      {(cr.pol || cr.pod) && (
                        <span className="text-xs text-brand-text-muted">
                          {cr.pol ?? '—'} → {cr.pod ?? '—'}
                        </span>
                      )}
                      {cr.expiry_date && (
                        <span className={clsx('ms-auto text-[11px] flex items-center gap-1',
                          new Date(cr.expiry_date) < new Date() ? 'text-red-400' : 'text-amber-400')}>
                          <Timer size={10} /> {cr.expiry_date}
                        </span>
                      )}
                    </div>
                    {(cr.loading_warehouse_id || cr.sealing_day || cr.vessel_day) && (
                      <div className="px-4 py-2 border-b border-brand-border/30 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-brand-text-muted">
                        {cr.loading_warehouse_id && warehouseById.get(cr.loading_warehouse_id) && (
                          <span>
                            <Warehouse size={10} className="inline me-1" />
                            {warehouseById.get(cr.loading_warehouse_id)?.name}
                          </span>
                        )}
                        {cr.sealing_day && <span>{isAr ? 'تاريخ الإغلاق:' : 'Sealing Date:'} <b className="text-brand-text">{cr.sealing_day}</b></span>}
                        {cr.vessel_day && <span>{isAr ? 'مغادرة السفينة:' : 'Vessel Departure:'} <b className="text-brand-text">{cr.vessel_day}</b></span>}
                      </div>
                    )}
                    {/* Prices grid */}
                    <div className="px-4 py-2.5">
                      <div className="grid grid-cols-4 gap-2 mb-1">
                        {['', isAr ? 'شراء' : 'Buy', isAr ? 'بيع' : 'Sell', isAr ? 'هامش' : 'Margin'].map((h, i) => (
                          <span key={i} className="text-[10px] text-brand-text-muted uppercase tracking-wider text-center first:text-start">{h}</span>
                        ))}
                      </div>
                      {cr.buy_20gp  != null && <PriceRow label="20GP"    buy={cr.buy_20gp}   sell={cr.sell_20gp} />}
                      {cr.buy_40ft  != null && <PriceRow label="40GP"    buy={cr.buy_40ft}   sell={cr.sell_40ft} />}
                      {cr.buy_40hq  != null && <PriceRow label="40HQ"    buy={cr.buy_40hq}   sell={cr.sell_40hq} />}
                      {cr.buy_lcl_cbm != null && <PriceRow label="LCL/m³" buy={cr.buy_lcl_cbm} sell={cr.sell_lcl_cbm} />}
                      {cr.buy_lcl_20gp != null && <PriceRow label="LCL 20/m³" buy={cr.buy_lcl_20gp} sell={cr.sell_lcl_20gp} />}
                      {cr.buy_lcl_40ft != null && <PriceRow label="LCL 40/m³" buy={cr.buy_lcl_40ft} sell={cr.sell_lcl_40ft} />}
                      {cr.buy_lcl_40hq != null && <PriceRow label="LCL 40HQ/m³" buy={cr.buy_lcl_40hq} sell={cr.sell_lcl_40hq} />}
                      {cr.transit_sea_days != null && (
                        <p className="text-[11px] text-brand-text-muted mt-1.5">
                          <Ship size={10} className="inline me-1" />{cr.transit_sea_days} {isAr ? 'يوم' : 'days'}
                        </p>
                      )}
                      {[cr.fee_loading, cr.fee_bl, cr.fee_trucking, cr.fee_other].some(v => v != null) && (
                        <div className="mt-2 pt-2 border-t border-brand-border/30 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-brand-text-muted">
                          {cr.fee_loading != null && <span>{isAr ? 'تحميل:' : 'Loading:'} <b className="text-brand-text font-mono">{fmtUSD(cr.fee_loading)}</b></span>}
                          {cr.fee_bl != null && <span>B/L: <b className="text-brand-text font-mono">{fmtUSD(cr.fee_bl)}</b></span>}
                          {cr.fee_trucking != null && <span>{isAr ? 'نقل:' : 'Trucking:'} <b className="text-brand-text font-mono">{fmtUSD(cr.fee_trucking)}</b></span>}
                          {cr.fee_other != null && <span>{isAr ? 'أخرى:' : 'Other:'} <b className="text-brand-text font-mono">{fmtUSD(cr.fee_other)}</b></span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Air prices (agent-level, not per-carrier) */}
            {agent.serves_air && agent.price_air_kg != null && (
              <div className="mt-3 pt-3 border-t border-brand-border/50">
                <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-1">✈ {isAr ? 'جوي' : 'Air'}</p>
                <div className="grid grid-cols-4 gap-2 mb-1">
                  {['', isAr ? 'شراء/كغ' : 'Buy/kg', isAr ? 'بيع/كغ' : 'Sell/kg', isAr ? 'هامش' : 'Margin'].map((h, i) => (
                    <span key={i} className="text-[10px] text-brand-text-muted uppercase tracking-wider text-center first:text-start">{h}</span>
                  ))}
                </div>
                <PriceRow label="Air/kg" buy={agent.price_air_kg} sell={agent.sell_price_air_kg} />
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
            {history.length === 0
              ? <p className="text-sm text-brand-text-muted text-center py-4">{isAr ? 'لا يوجد سجل أسعار' : 'No price history yet'}</p>
              : <div className="space-y-3">
                  {history.map(ph => (
                    <div key={ph.id} className="rounded-xl border border-brand-border/50 bg-brand-surface overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.02] border-b border-brand-border/40 flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-brand-text font-mono">{ph.effective_date}</span>
                          {ph.expiry_date && (
                            <span className="text-[11px] text-amber-400 flex items-center gap-1">
                              <Timer size={10} /> {isAr ? 'ينتهي:' : 'Exp:'} {ph.expiry_date}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-brand-text-muted">{ph.created_by} · {ph.created_at?.slice(0, 10)}</span>
                      </div>
                      <div className="px-4 py-2.5 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                        {ph.buy_20gp    != null && <span className="text-brand-text-muted">20GP: <b className="text-brand-text font-mono">{fmtUSD(ph.buy_20gp)}</b> → <b className="text-emerald-400 font-mono">{fmtUSD(ph.sell_20gp)}</b> <MarginBadge buy={ph.buy_20gp} sell={ph.sell_20gp} /></span>}
                        {ph.buy_40ft    != null && <span className="text-brand-text-muted">40GP: <b className="text-brand-text font-mono">{fmtUSD(ph.buy_40ft)}</b> → <b className="text-emerald-400 font-mono">{fmtUSD(ph.sell_40ft)}</b> <MarginBadge buy={ph.buy_40ft} sell={ph.sell_40ft} /></span>}
                        {ph.buy_40hq    != null && <span className="text-brand-text-muted">40HQ: <b className="text-brand-text font-mono">{fmtUSD(ph.buy_40hq)}</b> → <b className="text-emerald-400 font-mono">{fmtUSD(ph.sell_40hq)}</b> <MarginBadge buy={ph.buy_40hq} sell={ph.sell_40hq} /></span>}
                        {ph.buy_air_kg  != null && <span className="text-brand-text-muted">Air/kg: <b className="text-brand-text font-mono">{fmtUSD(ph.buy_air_kg)}</b> → <b className="text-emerald-400 font-mono">{fmtUSD(ph.sell_air_kg)}</b> <MarginBadge buy={ph.buy_air_kg} sell={ph.sell_air_kg} /></span>}
                        {ph.buy_lcl_cbm != null && <span className="text-brand-text-muted">LCL/m³: <b className="text-brand-text font-mono">{fmtUSD(ph.buy_lcl_cbm)}</b> → <b className="text-emerald-400 font-mono">{fmtUSD(ph.sell_lcl_cbm)}</b> <MarginBadge buy={ph.buy_lcl_cbm} sell={ph.sell_lcl_cbm} /></span>}
                        {ph.buy_lcl_20gp != null && <span className="text-brand-text-muted">LCL 20/m³: <b className="text-brand-text font-mono">{fmtUSD(ph.buy_lcl_20gp)}</b> → <b className="text-emerald-400 font-mono">{fmtUSD(ph.sell_lcl_20gp)}</b> <MarginBadge buy={ph.buy_lcl_20gp} sell={ph.sell_lcl_20gp} /></span>}
                        {ph.buy_lcl_40ft != null && <span className="text-brand-text-muted">LCL 40/m³: <b className="text-brand-text font-mono">{fmtUSD(ph.buy_lcl_40ft)}</b> → <b className="text-emerald-400 font-mono">{fmtUSD(ph.sell_lcl_40ft)}</b> <MarginBadge buy={ph.buy_lcl_40ft} sell={ph.sell_lcl_40ft} /></span>}
                        {ph.buy_lcl_40hq != null && <span className="text-brand-text-muted">LCL 40HQ/m³: <b className="text-brand-text font-mono">{fmtUSD(ph.buy_lcl_40hq)}</b> → <b className="text-emerald-400 font-mono">{fmtUSD(ph.sell_lcl_40hq)}</b> <MarginBadge buy={ph.buy_lcl_40hq} sell={ph.sell_lcl_40hq} /></span>}
                      </div>
                      {(ph.loading_warehouse_id || ph.sealing_day || ph.vessel_day || [ph.fee_loading, ph.fee_bl, ph.fee_trucking, ph.fee_other].some(v => v != null)) && (
                        <div className="px-4 pb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-brand-text-muted">
                          {ph.loading_warehouse_id && warehouseById.get(ph.loading_warehouse_id) && <span>{warehouseById.get(ph.loading_warehouse_id)?.name}</span>}
                          {ph.sealing_day && <span>{isAr ? 'تاريخ الإغلاق:' : 'Sealing Date:'} <b className="text-brand-text">{ph.sealing_day}</b></span>}
                          {ph.vessel_day && <span>{isAr ? 'مغادرة السفينة:' : 'Vessel Departure:'} <b className="text-brand-text">{ph.vessel_day}</b></span>}
                          {ph.fee_loading != null && <span>{isAr ? 'تحميل:' : 'Loading:'} <b className="text-brand-text font-mono">{fmtUSD(ph.fee_loading)}</b></span>}
                          {ph.fee_bl != null && <span>B/L: <b className="text-brand-text font-mono">{fmtUSD(ph.fee_bl)}</b></span>}
                          {ph.fee_trucking != null && <span>{isAr ? 'نقل:' : 'Trucking:'} <b className="text-brand-text font-mono">{fmtUSD(ph.fee_trucking)}</b></span>}
                          {ph.fee_other != null && <span>{isAr ? 'أخرى:' : 'Other:'} <b className="text-brand-text font-mono">{fmtUSD(ph.fee_other)}</b></span>}
                        </div>
                      )}
                      {ph.notes && <p className="px-4 pb-2 text-[11px] text-brand-text-muted">{ph.notes}</p>}
                    </div>
                  ))}
                </div>
            }
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
            {contracts.length === 0
              ? <p className="text-sm text-brand-text-muted text-center py-4">{isAr ? 'لا توجد وثائق' : 'No documents yet'}</p>
              : <div className="space-y-2">
                  {contracts.map(c => (
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
                      <a href={getAgentContractDownloadUrl(agentId, c.id)} target="_blank" rel="noopener noreferrer"
                        className="btn-icon p-1.5 text-blue-400 hover:bg-blue-400/10" title={isAr ? 'تحميل' : 'Download'}>
                        <Download size={14} />
                      </a>
                      {isAdmin && (
                        <button onClick={() => setDeletingContract(c)} className="btn-icon p-1.5 hover:text-brand-red hover:bg-brand-red/10">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Activity Log */}
          <div className="card">
            <h3 className="text-sm font-semibold text-brand-text mb-4 flex items-center gap-2">
              <Clock size={14} className="text-brand-text-muted" />
              {isAr ? 'سجل التعديلات' : 'Activity Log'}
              <span className="text-xs text-brand-text-muted">({editLog.length})</span>
            </h3>
            {editLog.length === 0
              ? <p className="text-sm text-brand-text-muted text-center py-4">{isAr ? 'لا يوجد نشاط بعد' : 'No activity yet'}</p>
              : <div>{editLog.slice(0, 25).map(e => <LogItem key={e.id} entry={e} isAr={isAr} />)}</div>
            }
          </div>

        </div>
      </div>

      {/* ── Update Prices Modal ── */}
      <Modal open={priceModal} onClose={() => setPriceModal(false)}
        title={isAr ? 'تحديث الأسعار الأسبوعية' : 'Weekly Price Update'} size="xl"
        footer={
          <><Button variant="secondary" onClick={() => setPriceModal(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
          <Button loading={priceMut.isPending} onClick={() => priceMut.mutate()}>{isAr ? 'حفظ' : 'Save'}</Button></>
        }>
        <div className="space-y-5">

          {/* Dates + options */}
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" label={isAr ? 'تاريخ السريان' : 'Effective Date'} value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
            <Input type="date" label={isAr ? 'تاريخ الانتهاء' : 'Expiry Date'} value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer">
            <input type="checkbox" checked={updateCurrent} onChange={e => setUpdateCurrent(e.target.checked)} />
            {isAr ? 'تحديث الأسعار الحالية للوكيل أيضاً' : "Also update agent's current prices"}
          </label>

          {/* Carrier rows */}
          {agent.serves_sea && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Ship size={11} /> {isAr ? 'شركات الشحن (FCL / LCL)' : 'Shipping Lines (FCL / LCL)'}
                </p>
                <button type="button" onClick={() => setCarrierRows(r => [...r, emptyCarrierRow()])}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-primary/15 text-brand-primary-light text-xs font-semibold hover:bg-brand-primary/25 transition-colors">
                  <Plus size={11} /> {isAr ? 'إضافة شركة شحن' : 'Add Carrier'}
                </button>
              </div>

              {carrierRows.map((row, idx) => (
                <div key={row._id} className="rounded-xl border border-brand-border bg-brand-surface p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-brand-primary/15 text-brand-primary-light text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider flex-1">
                      {isAr ? 'بيانات شركة الشحن والعرض' : 'Carrier & Offer Details'}
                    </p>
                    {carrierRows.length > 1 && (
                      <button type="button" onClick={() => setCarrierRows(r => r.filter(x => x._id !== row._id))}
                        className="p-1.5 rounded-lg hover:bg-red-500/15 text-brand-text-muted hover:text-red-400 transition-colors"
                        title={isAr ? 'حذف' : 'Delete'}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] text-brand-text-muted uppercase tracking-wider mb-1">
                        {isAr ? 'شركة الشحن' : 'Carrier'}
                      </label>
                      <input
                        list={`carriers-list-${row._id}`}
                        type="text"
                        placeholder={isAr ? 'PIL, CMA, MSC...' : 'PIL, CMA, MSC...'}
                        value={row.carrier_name}
                        onChange={e => setRow(row._id, 'carrier_name', e.target.value)}
                        className="input-base w-full text-sm font-semibold"
                      />
                      <datalist id={`carriers-list-${row._id}`}>
                        {COMMON_SEA_CARRIERS.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-[10px] text-brand-text-muted uppercase tracking-wider mb-1">
                        {isAr ? 'ميناء التحميل' : 'Port of Loading'}
                      </label>
                      <select value={row.pol} onChange={e => setRow(row._id, 'pol', e.target.value)} className="input-base w-full text-sm">
                        <option value="">—</option>
                        {SEA_PORT_OPTIONS.filter(o => o.value).map(o => (
                          <option key={o.value} value={o.value}>{o.value}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-brand-text-muted uppercase tracking-wider mb-1">
                        {isAr ? 'ميناء التفريغ' : 'Port of Discharge'}
                      </label>
                      <select value={row.pod} onChange={e => setRow(row._id, 'pod', e.target.value)} className="input-base w-full text-sm">
                        <option value="">—</option>
                        {SEA_PORT_OPTIONS.filter(o => o.value).map(o => (
                          <option key={o.value} value={o.value}>{o.value}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-brand-text-muted uppercase tracking-wider mb-1">
                        {isAr ? 'مستودع التحميل' : 'Loading Warehouse'}
                      </label>
                      <select
                        value={row.loading_warehouse_id}
                        onChange={e => setRow(row._id, 'loading_warehouse_id', e.target.value)}
                        className="input-base w-full text-sm"
                      >
                        <option value="">—</option>
                        {loadingWarehouses.map(w => (
                          <option key={w.id} value={w.id}>
                            {w.name}{w.city ? ` — ${w.city}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      type="date"
                      label={isAr ? 'تاريخ الإغلاق' : 'Sealing Date'}
                      value={row.sealing_day}
                      onChange={e => setRow(row._id, 'sealing_day', e.target.value)}
                    />
                    <Input
                      type="date"
                      label={isAr ? 'تاريخ مغادرة السفينة' : 'Vessel Departure Date'}
                      value={row.vessel_day}
                      onChange={e => setRow(row._id, 'vessel_day', e.target.value)}
                    />
                    <Input
                      type="number"
                      min="0"
                      label={isAr ? 'أيام العبور' : 'Transit Days'}
                      value={row.transit_sea_days}
                      onChange={e => setRow(row._id, 'transit_sea_days', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">
                      {isAr ? 'FCL - سعر الحاوية الكامل' : 'FCL - Full Container Prices'}
                    </p>
                    <div className="overflow-x-auto">
                      <div className="min-w-[620px] space-y-1">
                        <div className="grid grid-cols-[64px_90px_1fr_1fr_76px] gap-2 px-1">
                          <span className="text-[10px] text-brand-text-muted uppercase">{isAr ? 'الحجم' : 'Size'}</span>
                          <span className="text-[10px] text-brand-text-muted uppercase">{isAr ? 'سعة م³' : 'CBM cap'}</span>
                          <span className="text-[10px] text-brand-text-muted uppercase">{isAr ? 'شراء / حاوية' : 'Buy / container'}</span>
                          <span className="text-[10px] text-brand-text-muted uppercase">{isAr ? 'بيع / حاوية' : 'Sell / container'}</span>
                          <span className="text-[10px] text-brand-text-muted uppercase text-center">{isAr ? 'هامش' : 'Margin'}</span>
                        </div>
                        {CONTAINER_SIZES.map(({ k, label }) => (
                          <div key={k} className="grid grid-cols-[64px_90px_1fr_1fr_76px] gap-2 items-center">
                            <span className="text-xs font-mono text-brand-text-muted">{label}</span>
                            <input
                              type="number"
                              step="0.1"
                              min="1"
                              placeholder={DEFAULT_CBM[k]}
                              className="input-base text-xs text-amber-300"
                              value={row[fieldFor(k, 'cbm')]}
                              onChange={e => setRow(row._id, fieldFor(k, 'cbm'), e.target.value)}
                            />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="input-base text-xs"
                              value={row[fieldFor(k, 'buy')]}
                              onChange={e => setRow(row._id, fieldFor(k, 'buy'), e.target.value)}
                            />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="input-base text-xs"
                              value={row[fieldFor(k, 'sell')]}
                              onChange={e => setRow(row._id, fieldFor(k, 'sell'), e.target.value)}
                            />
                            <div className="text-center">
                              <LiveMargin buy={row[fieldFor(k, 'buy')]} sell={row[fieldFor(k, 'sell')]} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                      {isAr ? 'LCL - سعر المتر المكعب حسب حجم الحاوية' : 'LCL - CBM Price Per Container Size'}
                    </p>
                    <div className="overflow-x-auto">
                      <div className="min-w-[520px] space-y-1">
                        <div className="grid grid-cols-[64px_1fr_1fr_76px] gap-2 px-1">
                          <span className="text-[10px] text-brand-text-muted uppercase">{isAr ? 'الحجم' : 'Size'}</span>
                          <span className="text-[10px] text-brand-text-muted uppercase">{isAr ? 'شراء / م³' : 'Buy / m³'}</span>
                          <span className="text-[10px] text-brand-text-muted uppercase">{isAr ? 'بيع / م³' : 'Sell / m³'}</span>
                          <span className="text-[10px] text-brand-text-muted uppercase text-center">{isAr ? 'هامش' : 'Margin'}</span>
                        </div>
                        {CONTAINER_SIZES.map(({ k, label }) => (
                          <div key={k} className="grid grid-cols-[64px_1fr_1fr_76px] gap-2 items-center">
                            <span className="text-xs font-mono text-brand-text-muted">{label}</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="input-base text-xs"
                              value={row[fieldFor(k, 'buy_lcl')]}
                              onChange={e => setRow(row._id, fieldFor(k, 'buy_lcl'), e.target.value)}
                            />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="input-base text-xs"
                              value={row[fieldFor(k, 'sell_lcl')]}
                              onChange={e => setRow(row._id, fieldFor(k, 'sell_lcl'), e.target.value)}
                            />
                            <div className="text-center">
                              <LiveMargin buy={row[fieldFor(k, 'buy_lcl')]} sell={row[fieldFor(k, 'sell_lcl')]} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border border-brand-border/50 bg-white/[0.02] p-3">
                    <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                      {isAr ? 'رسوم المنشأ: المستودع ← ميناء التحميل ← العقبة' : 'Origin Fees: Warehouse → Loading Port → Aqaba'}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <Input type="number" step="0.01" min="0" label={isAr ? 'عمال / تحميل' : 'Loading Workers'} value={row.fee_loading} onChange={e => setRow(row._id, 'fee_loading', e.target.value)} />
                      <Input type="number" step="0.01" min="0" label={isAr ? 'رسوم B/L' : 'B/L Fee'} value={row.fee_bl} onChange={e => setRow(row._id, 'fee_bl', e.target.value)} />
                      <Input type="number" step="0.01" min="0" label={isAr ? 'نقل للميناء' : 'Trucking'} value={row.fee_trucking} onChange={e => setRow(row._id, 'fee_trucking', e.target.value)} />
                      <Input type="number" step="0.01" min="0" label={isAr ? 'رسوم أخرى' : 'Other Fees'} value={row.fee_other} onChange={e => setRow(row._id, 'fee_other', e.target.value)} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-brand-border/20 flex-wrap">
                    <input type="number" step="0.1" min="0" placeholder={isAr ? 'هامش %' : 'Markup %'}
                      className="input-base w-24 text-xs" value={row.markup_pct}
                      onChange={e => setRow(row._id, 'markup_pct', e.target.value)}
                    />
                    <button type="button" onClick={() => applyMarkup(row._id)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/25 transition-colors">
                      {isAr ? 'تطبيق % على البيع' : 'Apply % to Sell Prices'}
                    </button>
                    <input type="text" placeholder={isAr ? 'ملاحظات...' : 'Notes...'}
                      className="input-base text-xs flex-1 min-w-48" value={row.notes}
                      onChange={e => setRow(row._id, 'notes', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Air prices */}
          {agent.serves_air && (
            <FormSection title={isAr ? 'أسعار جوية (USD/كغ)' : 'Air Prices (USD/kg)'}>
              <div className="grid grid-cols-[1fr_1fr_60px] gap-3 items-end">
                <Input label={isAr ? 'شراء/كغ' : 'Buy/kg'} type="number" step="0.01" min="0" placeholder="0.00"
                  value={airBuy} onChange={e => setAirBuy(e.target.value)} />
                <Input label={isAr ? 'بيع/كغ' : 'Sell/kg'} type="number" step="0.01" min="0" placeholder="0.00"
                  value={airSell} onChange={e => setAirSell(e.target.value)} />
                <div className="pb-2 text-center"><LiveMargin buy={airBuy} sell={airSell} /></div>
              </div>
              <Input label={isAr ? 'أيام العبور الجوي' : 'Air Transit Days'} type="number"
                value={airTransit} onChange={e => setAirTransit(e.target.value)} />
            </FormSection>
          )}
        </div>
      </Modal>

      {/* ── Upload Contract Modal ── */}
      <Modal open={contractModal} onClose={() => setContractModal(false)}
        title={isAr ? 'رفع وثيقة' : 'Upload Document'} size="md"
        footer={<><Button variant="secondary" onClick={() => setContractModal(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button><Button loading={uploading} onClick={handleContractUpload} disabled={!contractFile || !contractTitle}><Upload size={14} /> {isAr ? 'رفع' : 'Upload'}</Button></>}>
        <div className="space-y-4">
          <label className={clsx('flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all', contractFile ? 'border-brand-primary/50 bg-brand-primary/5' : 'border-brand-border hover:border-brand-primary/40')}>
            <Upload size={20} className="text-brand-text-muted" />
            <span className="text-sm text-brand-text-muted">{contractFile ? contractFile.name : (isAr ? 'اختر ملفاً' : 'Choose file')}</span>
            <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => setContractFile(e.target.files?.[0] ?? null)} />
          </label>
          <Input label={isAr ? 'العنوان' : 'Title'} value={contractTitle} onChange={e => setContractTitle(e.target.value)} />
          <FormRow>
            <Input type="date" label={isAr ? 'صالح من' : 'Valid From'} value={contractValidFrom} onChange={e => setContractValidFrom(e.target.value)} />
            <Input type="date" label={isAr ? 'صالح حتى' : 'Valid To'}  value={contractValidTo}   onChange={e => setContractValidTo(e.target.value)} />
          </FormRow>
          <Input label={isAr ? 'ملاحظات' : 'Notes'} value={contractNotes} onChange={e => setContractNotes(e.target.value)} />
        </div>
      </Modal>

      {/* ── Delete Contract Confirm ── */}
      <Modal open={!!deletingContract} onClose={() => setDeletingContract(null)} title={isAr ? 'تأكيد الحذف' : 'Confirm Delete'} size="sm"
        footer={<><Button variant="secondary" onClick={() => setDeletingContract(null)}>{isAr ? 'إلغاء' : 'Cancel'}</Button><Button variant="danger" loading={deleteContractMut.isPending} onClick={() => deletingContract && deleteContractMut.mutate(deletingContract.id)}>{isAr ? 'حذف' : 'Delete'}</Button></>}>
        <p className="text-sm text-brand-text-dim">{isAr ? `حذف: "${deletingContract?.title}"؟` : `Delete "${deletingContract?.title}"?`}</p>
      </Modal>
    </div>
  )
}
