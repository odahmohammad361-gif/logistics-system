import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Container, Plane, Package,
  MapPin, Calendar, Users, Gauge,
} from 'lucide-react'
import {
  getBookings, createBooking,
} from '@/services/bookingService'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import BookingForm from '@/components/booking/BookingForm'
import type { BookingListItem, BookingMode, BookingStatus } from '@/types'
import clsx from 'clsx'

const MODE_ICONS: Record<BookingMode, React.ReactNode> = {
  LCL: <Container size={15} />,
  FCL: <Package    size={15} />,
  AIR: <Plane      size={15} />,
}

const MODE_COLORS: Record<BookingMode, string> = {
  LCL: 'text-blue-400 bg-blue-500/10',
  FCL: 'text-emerald-400 bg-emerald-500/10',
  AIR: 'text-violet-400 bg-violet-500/10',
}

const BOOKING_STATUSES: BookingStatus[] = [
  'draft', 'confirmed', 'in_transit', 'arrived', 'delivered', 'cancelled',
]

export default function ContainersPage() {
  const { t }       = useTranslation()
  const navigate    = useNavigate()
  const qc          = useQueryClient()
  const { isAdmin } = useAuth()

  const [search, setSearch]         = useState('')
  const [filterMode, setFilterMode] = useState<BookingMode | ''>('')
  const [filterStatus, setFilterStatus] = useState<BookingStatus | ''>('')
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', { search, filterMode, filterStatus }],
    queryFn:  () => getBookings({
      search:     search  || undefined,
      mode:       filterMode || undefined,
      status:     filterStatus || undefined,
      page_size:  50,
    }),
  })

  const createMut = useMutation({
    mutationFn: createBooking,
    onSuccess:  (b: { id: number }) => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      setShowForm(false)
      navigate(`/containers/${b.id}`)
    },
  })

  async function handleCreate(data: Record<string, unknown>) {
    setSaving(true)
    try { await createMut.mutateAsync(data) }
    finally { setSaving(false) }
  }

  const bookings = data?.results ?? []

  const modeLabel = (m: BookingMode) => {
    if (m === 'LCL') return t('bookings.mode_lcl')
    if (m === 'FCL') return t('bookings.mode_fcl')
    return t('bookings.mode_air')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-text">{t('bookings.title')}</h1>
          <p className="text-xs text-brand-text-muted mt-0.5">
            {data?.total ?? 0} {t('common.results')}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(true)}>
            <Plus size={15} />
            {t('bookings.new')}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute start-3 top-1/2 -translate-y-1/2 text-brand-text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="input-base ps-8 text-sm"
          />
        </div>

        {/* Mode filter */}
        <div className="flex gap-1 bg-brand-card border border-brand-border rounded-lg p-1">
          {(['', 'LCL', 'FCL', 'AIR'] as const).map(m => (
            <button
              key={m}
              onClick={() => setFilterMode(m as BookingMode | '')}
              className={clsx(
                'px-3 py-1 rounded-md text-xs font-medium transition-all',
                filterMode === m
                  ? 'bg-brand-primary text-white'
                  : 'text-brand-text-muted hover:text-brand-text',
              )}
            >
              {m === '' ? t('bookings.all') : m}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as BookingStatus | '')}
          className="input-base text-sm min-w-[140px]"
        >
          <option value="">{t('common.all_statuses')}</option>
          {BOOKING_STATUSES.map(s => (
            <option key={s} value={s} style={{ background: '#061220' }}>
              {t(`bookings.status_${s}`)}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-16 text-brand-text-muted text-sm">{t('common.loading')}</div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 text-brand-text-muted text-sm">{t('common.no_data')}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bookings.map(b => <BookingCard key={b.id} booking={b} onNavigate={() => navigate(`/containers/${b.id}`)} modeLabel={modeLabel} />)}
        </div>
      )}

      {/* Create form */}
      <BookingForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={handleCreate}
        saving={saving}
      />
    </div>
  )
}

function BookingCard({
  booking, onNavigate, modeLabel,
}: {
  booking: BookingListItem
  onNavigate: () => void
  modeLabel: (m: BookingMode) => string
}) {
  const { t }   = useTranslation()
  const pct     = booking.fill_percent ?? 0
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-500'

  return (
    <button
      onClick={onNavigate}
      className="text-start w-full rounded-xl border border-brand-border bg-brand-card p-4 hover:border-brand-primary/50 hover:bg-brand-primary/5 transition-all group space-y-3"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-brand-text font-mono group-hover:text-brand-primary-light transition-colors">
            {booking.booking_number}
          </p>
          {booking.agent_name && (
            <p className="text-[10px] text-brand-text-muted mt-0.5">{booking.agent_name}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold', MODE_COLORS[booking.mode])}>
            {MODE_ICONS[booking.mode]}
            {booking.mode}
          </span>
          <Badge value={booking.status} label={t(`bookings.status_${booking.status}`)} />
        </div>
      </div>

      {/* Route */}
      {(booking.port_of_loading || booking.port_of_discharge) && (
        <div className="flex items-center gap-1.5 text-xs text-brand-text-muted">
          <MapPin size={11} className="flex-shrink-0" />
          <span className="truncate">
            {booking.port_of_loading ?? '—'} → {booking.port_of_discharge ?? '—'}
          </span>
        </div>
      )}

      {/* Dates */}
      {(booking.etd || booking.eta) && (
        <div className="flex items-center gap-3 text-xs text-brand-text-muted">
          <Calendar size={11} className="flex-shrink-0" />
          {booking.etd && <span>ETD {booking.etd}</span>}
          {booking.eta && <span>ETA {booking.eta}</span>}
        </div>
      )}

      {/* Clients + fill */}
      <div className="flex items-center gap-3 text-xs text-brand-text-muted">
        <span className="flex items-center gap-1">
          <Users size={11} />
          {booking.client_count}
        </span>
        {booking.total_cbm_used != null && (
          <span className="flex items-center gap-1">
            <Gauge size={11} />
            {booking.total_cbm_used.toFixed(2)} m³
          </span>
        )}
      </div>

      {/* Fill bar */}
      {booking.fill_percent != null && booking.mode !== 'AIR' && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-brand-border overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all', barColor)}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-end font-mono" style={{ color: pct >= 90 ? '#f87171' : pct >= 70 ? '#fbbf24' : '#34d399' }}>
            {pct.toFixed(1)}%
          </p>
        </div>
      )}
    </button>
  )
}
