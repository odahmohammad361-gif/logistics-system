import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Pencil, Trash2, Plus, Lock,
  Download, Container, Plane, Package, MapPin, Calendar,
  Warehouse, Clock, Camera, X, Upload, Loader2, AlertTriangle,
} from 'lucide-react'
import {
  getBooking, updateBooking, deleteBooking,
  addCargoLine, updateCargoLine, deleteCargoLine,
  getPackingList, updateLoadingInfo, uploadLoadingPhotos,
  deleteLoadingPhoto, getLoadingPhotoUrl,
} from '@/services/bookingService'
import { getBranches } from '@/services/branchService'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import CapacityMeter from '@/components/booking/CapacityMeter'
import CargoLineCard from '@/components/booking/CargoLineCard'
import CargoLineForm from '@/components/booking/CargoLineForm'
import BookingForm from '@/components/booking/BookingForm'
import type { BookingCargoLine, BookingMode, BookingLoadingPhoto } from '@/types'
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

  const [showEditBooking, setShowEditBooking]     = useState(false)
  const [showCargoForm, setShowCargoForm]         = useState(false)
  const [editingLine, setEditingLine]             = useState<BookingCargoLine | null>(null)
  const [savingHeader, setSavingHeader]           = useState(false)
  const [savingCargo, setSavingCargo]             = useState(false)
  const [confirmDelete, setConfirmDelete]         = useState(false)
  const [confirmDeleteLine, setConfirmDeleteLine] = useState<number | null>(null)

  // Loading info state
  const [loadingWh, setLoadingWh]       = useState<string>('')
  const [loadingDate, setLoadingDate]   = useState<string>('')
  const [loadingNotes, setLoadingNotes] = useState<string>('')
  const [savingLoading, setSavingLoading] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [deletingPhoto, setDeletingPhoto]   = useState<number | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Fetch loading warehouses (loading type only)
  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-loading'],
    queryFn: async () => {
      const { getWarehouses } = await import('@/services/warehouseService')
      const r = await getWarehouses({ warehouse_type: 'loading', page_size: 100 })
      return r.results
    },
    staleTime: Infinity,
  })

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

  // Sync loading info fields when booking loads
  const prevBookingId = useRef<number | null>(null)
  if (booking && booking.id !== prevBookingId.current) {
    prevBookingId.current = booking.id
    setLoadingWh(booking.loading_warehouse_id ? String(booking.loading_warehouse_id) : '')
    setLoadingDate(booking.loading_date ? booking.loading_date.slice(0, 16) : '')
    setLoadingNotes(booking.loading_notes ?? '')
  }

  async function handleSaveLoadingInfo() {
    setSavingLoading(true)
    try {
      await updateLoadingInfo(bookingId, {
        loading_warehouse_id: loadingWh ? parseInt(loadingWh) : null,
        loading_date:         loadingDate || null,
        loading_notes:        loadingNotes || null,
      })
      qc.invalidateQueries({ queryKey: ['booking', bookingId] })
    } finally {
      setSavingLoading(false)
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setPhotoUploading(true)
    try {
      await uploadLoadingPhotos(bookingId, files)
      qc.invalidateQueries({ queryKey: ['booking', bookingId] })
    } finally {
      setPhotoUploading(false)
      e.target.value = ''
    }
  }

  async function handleDeletePhoto(photoId: number) {
    setDeletingPhoto(photoId)
    try {
      await deleteLoadingPhoto(bookingId, photoId)
      qc.invalidateQueries({ queryKey: ['booking', bookingId] })
    } finally {
      setDeletingPhoto(null)
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

  // Build capacity meter slices — coerce Numeric strings to numbers
  const slices = booking.cargo_lines
    .filter(l => l.cbm != null)
    .map(l => ({
      clientName: isRTL ? (l.client.name_ar ?? l.client.name) : l.client.name,
      cbm:        Number(l.cbm),
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
              <div className="flex items-center gap-2">
                <p className="text-sm text-brand-text font-medium">
                  {booking.port_of_loading ?? '—'} → {booking.port_of_discharge ?? '—'}
                </p>
                {booking.destination && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
                    booking.destination === 'jordan'
                      ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  }`}>
                    {booking.destination === 'jordan' ? '🇯🇴 Jordan' : '🇮🇶 Iraq'}
                  </span>
                )}
              </div>
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
              usedCbm={Number(booking.total_cbm_used) || 0}
              totalCbm={Number(booking.container_cbm_capacity)}
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

      {/* ── Loading Info Card ── */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <Warehouse size={14} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-brand-text">
              {isRTL ? 'معلومات التحميل' : 'Loading Information'}
            </h2>
            <p className="text-[11px] text-brand-text-muted">
              {isRTL ? 'المستودع الذي تم تحميل الحاوية منه ووقت التحميل' : 'Origin warehouse and loading time'}
            </p>
          </div>
          <div className="ms-auto">
            <Button size="sm" loading={savingLoading} onClick={handleSaveLoadingInfo}>
              {isRTL ? 'حفظ' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {/* Warehouse */}
          <div className="space-y-1.5">
            <label className="label-base flex items-center gap-1">
              <Warehouse size={11} /> {isRTL ? 'مستودع التحميل' : 'Loading Warehouse'}
            </label>
            <select
              className="input-base w-full"
              value={loadingWh}
              onChange={e => setLoadingWh(e.target.value)}
            >
              <option value="">— {isRTL ? 'اختر مستودعاً' : 'Select warehouse'} —</option>
              {(warehousesData ?? []).map(wh => (
                <option key={wh.id} value={String(wh.id)}>
                  {wh.name} {wh.city ? `· ${wh.city}` : ''}
                </option>
              ))}
            </select>
            {booking.loading_warehouse_name && (
              <p className="text-[11px] text-amber-400">
                ✓ {booking.loading_warehouse_name}
                {booking.loading_warehouse_city ? ` — ${booking.loading_warehouse_city}` : ''}
              </p>
            )}
          </div>

          {/* Date/time */}
          <div className="space-y-1.5">
            <label className="label-base flex items-center gap-1">
              <Clock size={11} /> {isRTL ? 'تاريخ ووقت التحميل' : 'Loading Date & Time'}
            </label>
            <input
              type="datetime-local"
              className="input-base w-full"
              value={loadingDate}
              onChange={e => setLoadingDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="label-base">{isRTL ? 'ملاحظات التحميل' : 'Loading Notes'}</label>
            <input
              className="input-base w-full"
              placeholder={isRTL ? 'ملاحظات...' : 'Notes...'}
              value={loadingNotes}
              onChange={e => setLoadingNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Loading photos */}
        <div className="space-y-3 pt-3 border-t border-brand-border/50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Camera size={12} />
              {isRTL ? 'صور التحميل' : 'Loading Photos'}
              {booking.loading_photos.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400 text-[10px] font-bold">
                  {booking.loading_photos.length}
                </span>
              )}
            </p>
            <label className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all',
              'border border-dashed border-brand-border text-brand-text-muted',
              'hover:border-amber-400/50 hover:text-amber-400',
              photoUploading && 'pointer-events-none opacity-50',
            )}>
              {photoUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {isRTL ? 'رفع صور' : 'Upload Photos'}
              <input
                ref={photoInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </label>
          </div>

          {booking.loading_photos.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {booking.loading_photos.map(photo => (
                <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden border border-brand-border">
                  <img
                    src={`/uploads/${photo.file_path}`}
                    alt={photo.original_filename ?? ''}
                    className="w-full h-full object-cover"
                  />
                  {photo.caption && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1.5 py-0.5">
                      <p className="text-[10px] text-white truncate">{photo.caption}</p>
                    </div>
                  )}
                  <button
                    onClick={() => handleDeletePhoto(photo.id)}
                    disabled={deletingPhoto === photo.id}
                    className="absolute top-1 end-1 p-1 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {deletingPhoto === photo.id
                      ? <Loader2 size={10} className="animate-spin" />
                      : <X size={10} />}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-brand-border/50 py-6 text-center text-xs text-brand-text-muted">
              {isRTL ? 'لا توجد صور تحميل بعد' : 'No loading photos yet'}
            </div>
          )}
        </div>
      </div>

      {/* ── Cargo lines ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-text">{t('bookings.cargo_lines')}</h2>
          {isAdmin && !booking.is_locked && (
            <Button size="sm" onClick={() => { setEditingLine(null); setShowCargoForm(true) }}>
              <Plus size={13} />
              {t('bookings.add_client_cargo')}
            </Button>
          )}
        </div>

        {/* Lock banner */}
        {booking.is_locked && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <Lock size={14} className="text-brand-red flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-brand-red">
                {isRTL ? 'الحاوية مغلقة — لا يمكن تعديل البضائع' : 'Container is sealed — cargo cannot be modified'}
              </p>
              <p className="text-xs text-brand-text-muted mt-0.5">
                {isRTL
                  ? `الحالة الحالية: "${booking.status}" — يجب أن تكون الحاوية في وضع "مسودة" لإضافة أو تعديل البضائع.`
                  : `Status is "${booking.status}". Container must be in "draft" to add or edit cargo.`}
              </p>
            </div>
          </div>
        )}

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
                onEdit={booking.is_locked ? undefined : () => { setEditingLine(line); setShowCargoForm(true) }}
                onDelete={booking.is_locked ? undefined : () => setConfirmDeleteLine(line.id)}
                onRefresh={() => qc.invalidateQueries({ queryKey: ['booking', bookingId] })}
                locked={booking.is_locked}
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
        bookingId={bookingId}
        initial={editingLine}
        saving={savingCargo}
      />
    </div>
  )
}
