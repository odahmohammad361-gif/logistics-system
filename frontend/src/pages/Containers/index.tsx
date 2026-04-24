import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, ArrowRight, Container, Plane, Package,
  MapPin, FileText, Clock, Users,
} from 'lucide-react'
import { getBookings, createBooking } from '@/services/bookingService'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import BookingForm from '@/components/booking/BookingForm'
import type { BookingListItem, BookingMode, BookingStatus } from '@/types'
import clsx from 'clsx'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BookingStatus, { label_en: string; label_ar: string; color: string }> = {
  draft:      { label_en: 'Draft',      label_ar: 'مسودة',        color: 'text-gray-400 bg-gray-500/15' },
  confirmed:  { label_en: 'Confirmed',  label_ar: 'مؤكد',         color: 'text-blue-400 bg-blue-500/15' },
  in_transit: { label_en: 'In Transit', label_ar: 'في الطريق',    color: 'text-yellow-400 bg-yellow-500/15' },
  arrived:    { label_en: 'Arrived',    label_ar: 'وصلت',         color: 'text-green-400 bg-green-500/15' },
  delivered:  { label_en: 'Delivered',  label_ar: 'تم التسليم',   color: 'text-emerald-400 bg-emerald-500/15' },
  cancelled:  { label_en: 'Cancelled',  label_ar: 'ملغي',         color: 'text-red-400 bg-red-500/15' },
}

const CARD_BORDER: Record<BookingStatus, string> = {
  draft:      'border-gray-600/30',
  confirmed:  'border-red-500/40',
  in_transit: 'border-yellow-500/40',
  arrived:    'border-green-500/40',
  delivered:  'border-emerald-500/40',
  cancelled:  'border-gray-700/30',
}

const MODE_ICONS: Record<BookingMode, React.ReactNode> = {
  LCL: <Container size={12} />,
  FCL: <Package   size={12} />,
  AIR: <Plane     size={12} />,
}

// ── Countdown badge ───────────────────────────────────────────────────────────

function CountdownBadge({ etd, eta, status, isAr }: {
  etd: string | null; eta: string | null; status: BookingStatus; isAr: boolean
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  function diff(d: string) {
    const dt = new Date(d); dt.setHours(0, 0, 0, 0)
    return Math.round((dt.getTime() - today.getTime()) / 86400000)
  }

  if (status === 'delivered' || status === 'arrived') {
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-400">
      <Clock size={11} />{isAr ? 'وصلت' : 'Arrived'}{eta && ` — ${new Date(eta).toLocaleDateString()}`}
    </span>
  }
  if (status === 'cancelled') return null

  if (eta) {
    const d = diff(eta)
    if (d > 0) return <span className={clsx('inline-flex items-center gap-1 text-[11px] font-medium',
      status === 'in_transit' ? 'text-yellow-400' : 'text-blue-400')}>
      <Clock size={11} />{isAr ? `ETA بعد ${d} يوم` : `ETA in ${d} day${d !== 1 ? 's' : ''}`}
    </span>
    if (d === 0) return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-400">
      <Clock size={11} />{isAr ? 'الوصول اليوم' : 'Arriving today'}
    </span>
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-400">
      <Clock size={11} />{isAr ? `وصلت منذ ${-d} يوم` : `Arrived ${-d}d ago`}
    </span>
  }
  if (etd) {
    const d = diff(etd)
    if (d > 0) return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400">
      <Clock size={11} />{isAr ? `لم تغادر — ETD بعد ${d} يوم` : `Not departed — ETD in ${d}d`}
    </span>
    if (d === 0) return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-400">
      <Clock size={11} />{isAr ? 'المغادرة اليوم' : 'Departing today'}
    </span>
  }
  return <span className="text-[11px] text-gray-500">{isAr ? 'لا توجد مواعيد' : 'No dates set'}</span>
}

// ── CBM bar ───────────────────────────────────────────────────────────────────

function CbmBar({ used, max, pct }: { used: number | null; max: number | null; pct: number | null }) {
  const p = Math.min(pct ?? 0, 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-gray-500">CBM {Number(used ?? 0).toFixed(1)} / {max ?? '?'}</span>
        <span className={p >= 90 ? 'text-red-400' : p >= 70 ? 'text-yellow-400' : 'text-green-400'}>
          {p.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={clsx('h-full rounded-full',
          p >= 90 ? 'bg-red-500' : p >= 70 ? 'bg-yellow-500' : 'bg-green-500')}
          style={{ width: `${p}%` }} />
      </div>
    </div>
  )
}

// ── Container card ────────────────────────────────────────────────────────────

function ContainerCard({ b, isAr, onEdit, onView }: {
  b: BookingListItem; isAr: boolean; onEdit: () => void; onView: () => void
}) {
  const sc     = STATUS_CONFIG[b.status as BookingStatus] ?? STATUS_CONFIG.draft
  const border = CARD_BORDER[b.status as BookingStatus]   ?? 'border-white/10'

  const freight    = Number(b.freight_cost ?? 0)
  const maxCbm     = Number(b.max_cbm ?? 0)
  const markup     = Number(b.markup_pct ?? 0)
  const buyPerCbm  = maxCbm > 0 ? freight / maxCbm : 0
  const sellPerCbm = buyPerCbm * (1 + markup / 100)

  return (
    <div className={clsx('rounded-2xl border bg-white/[0.02] hover:bg-white/[0.04] transition-all flex flex-col', border)}>

      {/* Card header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={clsx('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full',
              b.mode === 'FCL' ? 'text-emerald-400 bg-emerald-500/15' :
              b.mode === 'AIR' ? 'text-violet-400 bg-violet-500/15'   :
                                 'text-blue-400 bg-blue-500/15')}>
              {MODE_ICONS[b.mode as BookingMode]} {b.mode}
            </span>
            {b.container_size && (
              <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
                {b.container_size}
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-white truncate">{b.booking_number}</p>
        </div>
        <span className={clsx('flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full', sc.color)}>
          {isAr ? sc.label_ar : sc.label_en}
        </span>
      </div>

      {/* Card body */}
      <div className="px-4 py-3 flex flex-col gap-2.5 flex-1">
        <CountdownBadge etd={b.etd} eta={b.eta} status={b.status as BookingStatus} isAr={isAr} />

        {/* Route + destination */}
        {(b.port_of_loading || b.port_of_discharge) && (
          <div className="flex items-center gap-1 text-[11px] text-gray-400 flex-wrap">
            <MapPin size={11} className="text-brand-primary-light flex-shrink-0" />
            <span>{b.port_of_loading ?? '—'}</span>
            <ArrowRight size={10} />
            <span>{b.port_of_discharge ?? '—'}</span>
            {(b as any).destination === 'jordan' && <span className="text-base leading-none">🇯🇴</span>}
            {(b as any).destination === 'iraq'   && <span className="text-base leading-none">🇮🇶</span>}
          </div>
        )}

        {/* Dates */}
        {(b.etd || b.eta) && (
          <div className="flex gap-3 text-[10px] text-gray-500">
            {b.etd && <span>ETD {new Date(b.etd).toLocaleDateString()}</span>}
            {b.eta && <span>ETA {new Date(b.eta).toLocaleDateString()}</span>}
          </div>
        )}

        {/* Agent */}
        {b.agent_name && (
          <p className="text-[11px] text-gray-400 truncate">🚢 {b.agent_name}</p>
        )}

        {/* B/L & container number */}
        {(b.container_no || b.bl_number || b.vessel_name) && (
          <div className="text-[10px] font-mono text-gray-500 space-y-0.5">
            {b.container_no && <p>CNT: {b.container_no}</p>}
            {b.bl_number    && <p>B/L: {b.bl_number}</p>}
            {b.vessel_name  && <p>🚢 {b.vessel_name}</p>}
          </div>
        )}

        {/* CBM bar */}
        <CbmBar used={b.total_cbm_used} max={b.max_cbm} pct={b.fill_percent} />

        {/* Clients */}
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <Users size={10} />
          {b.client_count} {isAr ? 'عميل' : b.client_count === 1 ? 'client' : 'clients'}
        </div>

        {/* Pricing row */}
        {freight > 0 && (
          <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2 grid grid-cols-3 gap-1 text-center">
            <div>
              <p className="text-[9px] text-gray-600 uppercase mb-0.5">{isAr ? 'الإجمالي' : 'Total'}</p>
              <p className="text-xs font-bold text-white">${freight.toLocaleString()}</p>
            </div>
            <div className="border-x border-white/5">
              <p className="text-[9px] text-gray-600 uppercase mb-0.5">{isAr ? 'شراء/CBM' : 'Buy/CBM'}</p>
              <p className="text-xs font-bold text-yellow-400">${buyPerCbm.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-[9px] text-gray-600 uppercase mb-0.5">{isAr ? 'بيع/CBM' : 'Sell/CBM'}</p>
              <p className="text-xs font-bold text-green-400">${sellPerCbm.toFixed(1)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="px-4 pb-3 flex gap-2 border-t border-white/5 pt-3">
        <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={onView}>
          <FileText size={12} className="me-1" />{isAr ? 'التفاصيل' : 'Details'}
        </Button>
        <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={onEdit}>
          {isAr ? 'تعديل' : 'Edit'}
        </Button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ALL_STATUSES: Array<BookingStatus | ''> = ['', 'draft', 'confirmed', 'in_transit', 'arrived', 'delivered', 'cancelled']

export default function ContainersPage() {
  const { t, i18n }    = useTranslation()
  const isAr           = i18n.language === 'ar'
  const navigate       = useNavigate()
  const qc             = useQueryClient()
  const { isAdmin }    = useAuth()

  const [search, setSearch]               = useState('')
  const [filterMode, setFilterMode]       = useState<BookingMode | ''>('')
  const [filterStatus, setFilterStatus]   = useState<BookingStatus | ''>('')
  const [filterDest, setFilterDest]       = useState<'jordan' | 'iraq' | ''>('')
  const [showForm, setShowForm]           = useState(false)
  const [editItem, setEditItem]           = useState<BookingListItem | null>(null)
  const [saving, setSaving]               = useState(false)

  void isAdmin // available for future role checks

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', { search, filterMode, filterStatus, filterDest }],
    queryFn: () => getBookings({
      search:      search || undefined,
      mode:        filterMode || undefined,
      status:      filterStatus || undefined,
      destination: filterDest || undefined,
      page_size: 60,
    }),
  })

  const createMut = useMutation({
    mutationFn: createBooking,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); setShowForm(false); setEditItem(null) },
  })

  async function handleSubmit(payload: Record<string, unknown>) {
    setSaving(true)
    try { await createMut.mutateAsync(payload) }
    finally { setSaving(false) }
  }

  const STATUS_LABEL: Record<string, string> = {
    '': isAr ? 'كل الحالات' : 'All statuses',
    draft: isAr ? 'مسودة' : 'Draft',
    confirmed: isAr ? 'مؤكد' : 'Confirmed',
    in_transit: isAr ? 'في الطريق' : 'In Transit',
    arrived: isAr ? 'وصلت' : 'Arrived',
    delivered: isAr ? 'تم التسليم' : 'Delivered',
    cancelled: isAr ? 'ملغي' : 'Cancelled',
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">
            {isAr ? 'الحاويات والشحنات' : 'Containers & Shipments'}
          </h1>
          {data && (
            <p className="text-sm text-gray-400 mt-0.5">
              {data.total} {isAr ? 'حاوية' : 'container(s)'}
            </p>
          )}
        </div>
        <Button onClick={() => { setEditItem(null); setShowForm(true) }} className="flex items-center gap-2">
          <Plus size={15} />
          {isAr ? 'انشاء حاوية' : 'Open Container'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? 'رقم حاوية، B/L، ميناء...' : 'Container no, B/L, port…'}
            className="input-base ps-9 w-56"
          />
        </div>

        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {(['', 'FCL', 'LCL', 'AIR'] as Array<BookingMode | ''>).map(m => (
            <button key={m || 'all'} onClick={() => setFilterMode(m)}
              className={clsx('px-3 py-1 rounded-md text-xs font-semibold transition-all',
                filterMode === m ? 'bg-brand-primary text-white' : 'text-gray-400 hover:text-white')}>
              {m || (isAr ? 'الكل' : 'All')}
            </button>
          ))}
        </div>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as BookingStatus | '')}
          className="input-base"
        >
          {ALL_STATUSES.map(s => (
            <option key={s || 'all'} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>

        {/* Destination filter */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {([
            { v: '',       label: isAr ? 'الكل' : 'All' },
            { v: 'jordan', label: '🇯🇴 ' + (isAr ? 'الأردن' : 'Jordan') },
            { v: 'iraq',   label: '🇮🇶 ' + (isAr ? 'العراق' : 'Iraq') },
          ] as const).map(({ v, label }) => (
            <button key={v || 'all'}
              onClick={() => setFilterDest(v)}
              className={clsx('px-3 py-1 rounded-md text-xs font-semibold transition-all',
                filterDest === v ? 'bg-brand-primary text-white' : 'text-gray-400 hover:text-white')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : (data?.results?.length ?? 0) === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Container size={48} className="mx-auto mb-3 opacity-20" />
          <p className="mb-2">{isAr ? 'لا توجد حاويات' : 'No containers yet'}</p>
          <button onClick={() => setShowForm(true)}
            className="text-sm text-brand-primary-light hover:underline">
            {isAr ? 'انشاء أول حاوية ←' : 'Open your first container →'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {data!.results.map(b => (
            <ContainerCard
              key={b.id}
              b={b}
              isAr={isAr}
              onView={() => navigate(`/containers/${b.id}`)}
              onEdit={() => { setEditItem(b as any); setShowForm(true) }}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      <BookingForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditItem(null) }}
        onSubmit={handleSubmit}
        initial={editItem as any}
        saving={saving}
      />
    </div>
  )
}
