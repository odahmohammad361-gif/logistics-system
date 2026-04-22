import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, Images, X, Upload, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'
import type { BookingCargoLine, BookingMode } from '@/types'
import { deleteCargoImage, uploadCargoImages, getCargoImageUrl } from '@/services/bookingService'

const SLICE_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500',
]

interface Props {
  line: BookingCargoLine
  index: number
  mode: BookingMode
  bookingId: number
  onEdit: () => void
  onDelete: () => void
  onRefresh: () => void
}

export default function CargoLineCard({ line, index, mode, bookingId, onEdit, onDelete, onRefresh }: Props) {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.language === 'ar'
  const [showImages, setShowImages] = useState(false)
  const [uploading, setUploading]   = useState(false)
  const color = SLICE_COLORS[index % SLICE_COLORS.length]

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      await uploadCargoImages(bookingId, line.id, files)
      onRefresh()
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDeleteImage(imgId: number) {
    await deleteCargoImage(bookingId, line.id, imgId)
    onRefresh()
  }

  const clientName = isRTL ? (line.client.name_ar ?? line.client.name) : line.client.name

  return (
    <div className="rounded-xl border border-brand-border bg-brand-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-border/60">
        <div className={clsx('w-2 h-8 rounded-full flex-shrink-0', color)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-text truncate">{clientName}</p>
          <p className="text-[10px] text-brand-text-muted font-mono">{line.client.client_code}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-colors"
            title={t('common.edit')}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-red hover:bg-brand-red/10 transition-colors"
            title={t('common.delete')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {line.cbm != null && (
          <div>
            <p className="text-[10px] text-brand-text-muted">{t('bookings.cbm_label')}</p>
            <p className="text-sm font-bold text-brand-text font-mono">{line.cbm.toFixed(3)}</p>
          </div>
        )}
        {line.cartons != null && (
          <div>
            <p className="text-[10px] text-brand-text-muted">{t('bookings.cartons')}</p>
            <p className="text-sm font-bold text-brand-text font-mono">{line.cartons}</p>
          </div>
        )}
        {line.gross_weight_kg != null && (
          <div>
            <p className="text-[10px] text-brand-text-muted">{t('bookings.gross_weight')}</p>
            <p className="text-sm font-bold text-brand-text font-mono">{line.gross_weight_kg.toFixed(2)}</p>
          </div>
        )}
        {line.net_weight_kg != null && (
          <div>
            <p className="text-[10px] text-brand-text-muted">{t('bookings.net_weight')}</p>
            <p className="text-sm font-bold text-brand-text font-mono">{line.net_weight_kg.toFixed(2)}</p>
          </div>
        )}
        {mode === 'AIR' && line.chargeable_weight_kg != null && (
          <div>
            <p className="text-[10px] text-brand-text-muted">{t('bookings.chargeable_weight')}</p>
            <p className="text-sm font-bold text-amber-400 font-mono">{line.chargeable_weight_kg.toFixed(2)}</p>
          </div>
        )}
        {line.freight_share != null && (
          <div>
            <p className="text-[10px] text-brand-text-muted">{t('bookings.freight_share')}</p>
            <p className="text-sm font-bold text-brand-text font-mono">${line.freight_share.toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* Description */}
      {(line.description || line.hs_code || line.shipping_marks) && (
        <div className="px-4 pb-3 space-y-1">
          {line.description && (
            <p className="text-xs text-brand-text-muted">
              <span className="text-brand-text-dim">{t('bookings.description')}: </span>
              {isRTL ? (line.description_ar ?? line.description) : line.description}
            </p>
          )}
          {line.hs_code && (
            <p className="text-xs text-brand-text-muted">
              <span className="text-brand-text-dim">{t('bookings.hs_code')}: </span>
              <span className="font-mono">{line.hs_code}</span>
            </p>
          )}
          {line.shipping_marks && (
            <p className="text-xs text-brand-text-muted">
              <span className="text-brand-text-dim">{t('bookings.shipping_marks')}: </span>
              {line.shipping_marks}
            </p>
          )}
        </div>
      )}

      {/* Images section */}
      <div className="border-t border-brand-border/60">
        <button
          onClick={() => setShowImages(v => !v)}
          className="flex items-center justify-between w-full px-4 py-2 text-xs text-brand-text-muted hover:text-brand-text hover:bg-white/5 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Images size={13} />
            {t('bookings.images')} {line.images.length > 0 && `(${line.images.length})`}
          </span>
          {showImages ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {showImages && (
          <div className="px-4 pb-4 space-y-3">
            {/* Image grid */}
            {line.images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {line.images.map((img) => (
                  <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border border-brand-border">
                    <img
                      src={getCargoImageUrl(bookingId, line.id, img.id)}
                      alt={img.original_filename ?? ''}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => handleDeleteImage(img.id)}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            <label className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-brand-border',
              'text-xs text-brand-text-muted cursor-pointer hover:border-brand-primary hover:text-brand-primary transition-colors',
              uploading && 'pointer-events-none opacity-50',
            )}>
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              <span>{t('bookings.upload_images')}</span>
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
          </div>
        )}
      </div>
    </div>
  )
}
