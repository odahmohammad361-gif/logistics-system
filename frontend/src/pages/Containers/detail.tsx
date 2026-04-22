import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Pencil, Trash2, Plus,
  Download, Container, Plane, Package, MapPin, Calendar,
} from 'lucide-react'
import {
  getBooking, updateBooking, deleteBooking,
  addCargoLine, updateCargoLine, deleteCargoLine,
  getPackingList,
} from '@/services/bookingService'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import CapacityMeter from '@/components/booking/CapacityMeter'
import CargoLineCard from '@/components/booking/CargoLineCard'
import CargoLineForm from '@/components/booking/CargoLineForm'
import BookingForm from '@/components/booking/BookingForm'
import type { BookingCargoLine, BookingMode } from '@/types'
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

export default function BookingDetailPage() {
  const { t, i18n } = useTranslation()
  const isRTL       = i18n.language === 'ar'
  const { id }      = useParams<{ id: string }>()
  const navigate    = useNavigate()
  const qc          = useQueryClient()
  const { isAdmin } = useAuth()
  const bookingId   = parseInt(id!)

  const [showEditBooking, setShowEditBooking]   = useState(false)
  const [showCargoForm, setShowCargoForm]       = useState(false)
  const [editingLine, setEditingLine]           = useState<BookingCargoLine | null>(null)
  const [savingHeader, setSavingHeader]         = useState(false)
  const [savingCargo, setSavingCargo]           = useState(false)
  const [confirmDelete, setConfirmDelete]       = useState(false)
  const [confirmDeleteLine, setConfirmDeleteLine] = useState<number | null>(null)

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn:  () => getBooking(bookingId),
    enabled:  !isNaN(bookingId),
  })

  const updateMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateBooking(bookingId, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['booking', bookingId] }); setShowEditBooking(false) },
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteBooking(bookingId),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['bookings'] }); navigate('/containers') },
  })

  const addLineMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => addCargoLine(bookingId, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['booking', bookingId] }); setShowCargoForm(false) },
  })

  const updateLineMut = useMutation({
    mutationFn: ({ lineId, data }: { lineId: number; data: Record<string, unknown> }) =>
      updateCargoLine(bookingId, lineId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booking', bookingId] })
      setEditingLine(null)
      setShowCargoForm(false)
    },
  })

  const deleteLineMut = useMutation({
    mutationFn: (lineId: number) => deleteCargoLine(bookingId, lineId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['booking', bookingId] }),
  })

  async function handleUpdateBooking(data: Record<string, unknown>) {
    setSavingHeader(true)
    try { await updateMut.mutateAsync(data) } finally { setSavingHeader(false) }
  }

  async function handleSaveCargo(data: Record<string, unknown>) {
    setSavingCargo(true)
    try {
      if (editingLine) {
        await updateLineMut.mutateAsync({ lineId: editingLine.id, data })
      } else {
        await addLineMut.mutateAsync(data)
      }
    } finally {
      setSavingCargo(false)
    }
  }

  async function handleDownloadPackingList() {
    const pl = await getPackingList(bookingId)
    const blob = new Blob([JSON.stringify(pl, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${booking?.booking_number ?? 'packing-list'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return <div className="text-center py-20 text-brand-text-muted text-sm">{t('common.loading')}</div>
  }

  if (!booking) {
    return <div className="text-center py-20 text-brand-text-muted text-sm">{t('common.no_data')}</div>
  }

  const modeLabel =
    booking.mode === 'LCL' ? t('bookings.lcl_full') :
    booking.mode === 'FCL' ? t('bookings.fcl_full') :
    t('bookings.air_full')

  // Build capacity meter slices
  const slices = booking.cargo_lines
    .filter(l => l.cbm != null)
    .map(l => ({
      clientName: isRTL ? (l.client.name_ar ?? l.client.name) : l.client.name,
      cbm:        l.cbm!,
      color:      '',
    }))

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Breadcrumb / Back */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/containers')}
          className="flex items-center gap-1.5 text-xs text-brand-text-muted hover:text-brand-text transition-colors"
        >
          <ArrowLeft size={13} />
          {t('bookings.title')}
        </button>
      </div>

      {/* Header card */}
      <div className="rounded-xl border border-brand-border bg-brand-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold', MODE_COLORS[booking.mode])}>
                {MODE_ICONS[booking.mode]}
                {modeLabel}
              </span>
              <Badge value={booking.status} label={t(`bookings.status_${booking.status}`)} />
            </div>
            <h1 className="text-2xl font-black text-brand-text font-mono">{booking.booking_number}</h1>
            {booking.agent && (
              <p className="text-xs text-brand-text-muted">{booking.agent.name}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => setShowEditBooking(true)}>
                <Pencil size={13} />
                {t('common.edit')}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleDownloadPackingList}>
              <Download size={13} />
              {t('bookings.download_packing_list')}
            </Button>
            {isAdmin && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={13} />
                {t('common.delete')}
              </Button>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pt-2 border-t border-brand-border/60">
          {(booking.port_of_loading || booking.port_of_discharge) && (
            <div className="col-span-2">
              <p className="text-[10px] text-brand-text-muted mb-0.5 flex items-center gap-1">
                <MapPin size={10} /> {t('bookings.routing')}
              </p>
              <p className="text-sm text-brand-text font-medium">
                {booking.port_of_loading ?? '—'} → {booking.port_of_discharge ?? '—'}
              </p>
            </div>
          )}
          {booking.etd && (
            <div>
              <p className="text-[10px] text-brand-text-muted mb-0.5 flex items-center gap-1">
                <Calendar size={10} /> {t('bookings.etd')}
              </p>
              <p className="text-sm text-brand-text font-medium font-mono">{booking.etd}</p>
            </div>
          )}
          {booking.eta && (
            <div>
              <p className="text-[10px] text-brand-text-muted mb-0.5">{t('bookings.eta')}</p>
              <p className="text-sm text-brand-text font-medium font-mono">{booking.eta}</p>
            </div>
          )}
          {booking.container_no && (
            <div>
              <p className="text-[10px] text-brand-text-muted mb-0.5">{t('bookings.container_no')}</p>
              <p className="text-sm text-brand-text font-mono">{booking.container_no}</p>
            </div>
          )}
          {booking.bl_number && (
            <div>
              <p className="text-[10px] text-brand-text-muted mb-0.5">{t('bookings.bl_number')}</p>
              <p className="text-sm text-brand-text font-mono">{booking.bl_number}</p>
            </div>
          )}
          {booking.awb_number && (
            <div>
              <p className="text-[10px] text-brand-text-muted mb-0.5">{t('bookings.awb_number')}</p>
              <p className="text-sm text-brand-text font-mono">{booking.awb_number}</p>
            </div>
          )}
          {booking.vessel_name && (
            <div>
              <p className="text-[10px] text-brand-text-muted mb-0.5">{t('bookings.vessel_name')}</p>
              <p className="text-sm text-brand-text">{booking.vessel_name}</p>
            </div>
          )}
          {booking.incoterm && (
            <div>
              <p className="text-[10px] text-brand-text-muted mb-0.5">{t('bookings.incoterm')}</p>
              <p className="text-sm text-brand-text font-mono">{booking.incoterm}</p>
            </div>
          )}
          {booking.freight_cost != null && (
            <div>
              <p className="text-[10px] text-brand-text-muted mb-0.5">{t('bookings.freight_cost')}</p>
              <p className="text-sm text-brand-text font-mono">
                {booking.freight_cost.toLocaleString()} {booking.currency}
              </p>
            </div>
          )}
          {booking.container_size && (
            <div>
              <p className="text-[10px] text-brand-text-muted mb-0.5">{t('bookings.container_size')}</p>
              <p className="text-sm text-brand-text font-mono">{booking.container_size}</p>
            </div>
          )}
        </div>

        {/* Capacity meter */}
        {booking.mode !== 'AIR' && booking.container_cbm_capacity != null && (
          <div className="pt-2 border-t border-brand-border/60">
            <CapacityMeter
              usedCbm={booking.total_cbm_used ?? 0}
              totalCbm={booking.container_cbm_capacity}
              slices={slices}
            />
          </div>
        )}

        {/* Notes */}
        {booking.notes && (
          <div className="pt-2 border-t border-brand-border/60">
            <p className="text-[10px] text-brand-text-muted mb-1">{t('common.notes')}</p>
            <p className="text-sm text-brand-text-muted">{booking.notes}</p>
          </div>
        )}
      </div>

      {/* Cargo lines */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-text">{t('bookings.cargo_lines')}</h2>
          {isAdmin && (
            <Button size="sm" onClick={() => { setEditingLine(null); setShowCargoForm(true) }}>
              <Plus size={13} />
              {t('bookings.add_client_cargo')}
            </Button>
          )}
        </div>

        {booking.cargo_lines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-brand-border py-12 text-center text-sm text-brand-text-muted">
            {t('bookings.no_cargo')}
          </div>
        ) : (
          <div className="space-y-3">
            {booking.cargo_lines.map((line, idx) => (
              <CargoLineCard
                key={line.id}
                line={line}
                index={idx}
                mode={booking.mode}
                bookingId={bookingId}
                onEdit={() => { setEditingLine(line); setShowCargoForm(true) }}
                onDelete={() => setConfirmDeleteLine(line.id)}
                onRefresh={() => qc.invalidateQueries({ queryKey: ['booking', bookingId] })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm delete booking */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmDelete(false)} />
          <div className="relative rounded-xl border border-brand-border bg-brand-card p-6 max-w-sm w-full space-y-4">
            <p className="text-sm text-brand-text">
              {t('bookings.delete_confirm', { number: booking.booking_number })}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
              <Button variant="danger" size="sm" onClick={() => deleteMut.mutate()}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete cargo line */}
      {confirmDeleteLine != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmDeleteLine(null)} />
          <div className="relative rounded-xl border border-brand-border bg-brand-card p-6 max-w-sm w-full space-y-4">
            <p className="text-sm text-brand-text">{t('bookings.remove_cargo_confirm')}</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteLine(null)}>{t('common.cancel')}</Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => { deleteLineMut.mutate(confirmDeleteLine!); setConfirmDeleteLine(null) }}
              >
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit booking form */}
      <BookingForm
        open={showEditBooking}
        onClose={() => setShowEditBooking(false)}
        onSubmit={handleUpdateBooking}
        initial={booking}
        saving={savingHeader}
      />

      {/* Cargo line form */}
      <CargoLineForm
        open={showCargoForm}
        onClose={() => { setShowCargoForm(false); setEditingLine(null) }}
        onSubmit={handleSaveCargo}
        mode={booking.mode}
        initial={editingLine}
        saving={savingCargo}
      />
    </div>
  )
}
