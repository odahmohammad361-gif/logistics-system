import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, Images, X, Upload, Loader2, ChevronDown, ChevronUp, FileText, ShieldCheck, Receipt, FolderPlus } from 'lucide-react'
import clsx from 'clsx'
import type { BookingCargoDocument, BookingCargoLine, BookingMode } from '@/types'
import { deleteCargoImage, uploadCargoImages, deleteCargoDocument, uploadCargoDocuments, getCargoDocumentUrl } from '@/services/bookingService'

const SLICE_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500',
]

interface Props {
  line: BookingCargoLine
  index: number
  mode: BookingMode
  bookingId: number
  onEdit?: () => void
  onDelete?: () => void
  onRefresh: () => void
  locked?: boolean
}

export default function CargoLineCard({ line, index, mode, bookingId, onEdit, onDelete, onRefresh, locked }: Props) {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.language === 'ar'
  const [showImages, setShowImages] = useState(false)
  const [showDocs, setShowDocs]     = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [otherFileType, setOtherFileType] = useState('')
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
  const docLabel = (doc: BookingCargoDocument) => {
    if (doc.document_type === 'pi') return isRTL ? 'فاتورة أولية' : 'PI / Proforma Invoice'
    if (doc.document_type === 'ci') return isRTL ? 'فاتورة تجارية' : 'CI / Commercial Invoice'
    if (doc.document_type === 'pl') return isRTL ? 'قائمة التعبئة' : 'PL / Packing List'
    if (doc.document_type === 'sc') return isRTL ? 'عقد البيع' : 'SC / Sales Contract'
    if (doc.document_type === 'co') return isRTL ? 'شهادة المنشأ' : 'CO / Certificate of Origin'
    if (doc.document_type === 'bl_copy') return isRTL ? 'نسخة بوليصة الشحن' : 'B/L Copy'
    if (doc.document_type === 'security_approval') return isRTL ? 'موافقات أمنية' : 'Security Approval'
    if (doc.document_type === 'goods_invoice') return isRTL ? 'فواتير البضاعة' : 'Goods Invoice'
    return doc.custom_file_type || (isRTL ? 'ملف آخر' : 'Other File')
  }
  const docsByType = {
    pi: line.documents.filter(d => d.document_type === 'pi').length,
    ci: line.documents.filter(d => d.document_type === 'ci').length,
    pl: line.documents.filter(d => d.document_type === 'pl').length,
    sc: line.documents.filter(d => d.document_type === 'sc').length,
    co: line.documents.filter(d => d.document_type === 'co').length,
    bl_copy: line.documents.filter(d => d.document_type === 'bl_copy').length,
    security_approval: line.documents.filter(d => d.document_type === 'security_approval').length,
    goods_invoice: line.documents.filter(d => d.document_type === 'goods_invoice').length,
    other: line.documents.filter(d => d.document_type === 'other').length,
  }

  async function handleDocumentUpload(
    type: 'pi' | 'ci' | 'pl' | 'sc' | 'co' | 'bl_copy' | 'security_approval' | 'goods_invoice' | 'other',
    files: File[],
  ) {
    if (!files.length) return
    if (type === 'other' && !otherFileType.trim()) return
    setUploadingDoc(type)
    try {
      await uploadCargoDocuments(bookingId, line.id, type, files, otherFileType.trim() || undefined)
      if (type === 'other') setOtherFileType('')
      onRefresh()
    } finally {
      setUploadingDoc(null)
    }
  }

  async function handleDeleteDocument(docId: number) {
    await deleteCargoDocument(bookingId, line.id, docId)
    onRefresh()
  }

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
          {!locked && onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-colors"
              title={t('common.edit')}
            >
              <Pencil size={14} />
            </button>
          )}
          {!locked && onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-red hover:bg-brand-red/10 transition-colors"
              title={t('common.delete')}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Goods source */}
      <div className="px-4 py-2 border-b border-brand-border/50 bg-white/[0.02] flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-brand-text-muted uppercase tracking-wide">
          {isRTL ? 'مصدر البضاعة' : 'Goods Source'}
        </span>
        <span className="rounded-full bg-brand-primary/10 text-brand-primary-light px-2 py-0.5 text-[10px] font-semibold">
          {line.goods_source === 'company_buying_service'
            ? (isRTL ? 'خدمة شراء عن طريق شركتنا' : 'Company buying service')
            : (isRTL ? 'بضاعة جاهزة من العميل' : 'Client ready goods')}
        </span>
        {line.is_full_container_client && (
          <span className="rounded-full bg-emerald-500/10 text-emerald-300 px-2 py-0.5 text-[10px] font-semibold">
            {isRTL ? 'حاوية كاملة لهذا العميل' : 'Full container client'}
          </span>
        )}
      </div>

      {/* Clearance */}
      {(line.clearance_through_us != null || line.clearance_agent_name || line.manual_clearance_agent_name) && (
        <div className="px-4 py-2 border-b border-brand-border/50 bg-white/[0.02]">
          <p className="text-[10px] text-brand-text-muted uppercase tracking-wide mb-1">
            {isRTL ? 'التخليص الجمركي' : 'Customs Clearance'}
          </p>
          <p className="text-xs text-brand-text-muted">
            {line.clearance_through_us === false
              ? `${isRTL ? 'وكيل خارجي' : 'Outside agent'}: ${line.manual_clearance_agent_name || '—'}${line.manual_clearance_agent_phone ? ` · ${line.manual_clearance_agent_phone}` : ''}`
              : `${isRTL ? 'عن طريقنا' : 'Through us'}: ${line.clearance_agent_name || '—'}${line.clearance_agent_rate_id ? ` · rate #${line.clearance_agent_rate_id}` : ''}`}
          </p>
        </div>
      )}

      {/* Stats — backend returns Numeric as strings, so coerce to Number */}
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {line.cbm != null && (
          <div>
            <p className="text-[10px] text-brand-text-muted">{t('bookings.cbm_label')}</p>
            <p className="text-sm font-bold text-brand-text font-mono">{Number(line.cbm).toFixed(3)}</p>
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
            <p className="text-sm font-bold text-brand-text font-mono">{Number(line.gross_weight_kg).toFixed(2)}</p>
          </div>
        )}
        {line.net_weight_kg != null && (
          <div>
            <p className="text-[10px] text-brand-text-muted">{t('bookings.net_weight')}</p>
            <p className="text-sm font-bold text-brand-text font-mono">{Number(line.net_weight_kg).toFixed(2)}</p>
          </div>
        )}
        {mode === 'AIR' && line.chargeable_weight_kg != null && (
          <div>
            <p className="text-[10px] text-brand-text-muted">{t('bookings.chargeable_weight')}</p>
            <p className="text-sm font-bold text-amber-400 font-mono">{Number(line.chargeable_weight_kg).toFixed(2)}</p>
          </div>
        )}
        {line.freight_share != null && (
          <div>
            <p className="text-[10px] text-brand-text-muted">{t('bookings.freight_share')}</p>
            <p className="text-sm font-bold text-brand-text font-mono">${Number(line.freight_share).toFixed(2)}</p>
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

      {/* Documents section */}
      <div className="border-t border-brand-border/60">
        <button
          onClick={() => setShowDocs(v => !v)}
          className="flex items-center justify-between w-full px-4 py-2 text-xs text-brand-text-muted hover:text-brand-text hover:bg-white/5 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <FileText size={13} />
            {isRTL ? 'ملفات العميل' : 'Client Files'} {line.documents.length > 0 && `(${line.documents.length})`}
          </span>
          {showDocs ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {showDocs && (
          <div className="px-4 pb-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-2">
              {([
                { type: 'pi' as const, label: isRTL ? 'رفع فاتورة أولية' : 'Upload PI', icon: Receipt, count: docsByType.pi },
                { type: 'ci' as const, label: isRTL ? 'رفع فاتورة تجارية' : 'Upload CI', icon: Receipt, count: docsByType.ci },
                { type: 'pl' as const, label: isRTL ? 'رفع قائمة التعبئة' : 'Upload PL', icon: FileText, count: docsByType.pl },
                { type: 'sc' as const, label: isRTL ? 'رفع عقد البيع' : 'Upload SC', icon: FileText, count: docsByType.sc },
                { type: 'co' as const, label: isRTL ? 'رفع شهادة المنشأ' : 'Upload CO', icon: FileText, count: docsByType.co },
                { type: 'bl_copy' as const, label: isRTL ? 'رفع نسخة بوليصة الشحن' : 'Upload B/L Copy', icon: FileText, count: docsByType.bl_copy },
                { type: 'security_approval' as const, label: isRTL ? 'رفع موافقات أمنية' : 'Upload Security Approvals', icon: ShieldCheck, count: docsByType.security_approval },
                { type: 'goods_invoice' as const, label: isRTL ? 'رفع فواتير البضاعة' : 'Upload Goods Invoices', icon: Receipt, count: docsByType.goods_invoice },
              ]).map(item => {
                const Icon = item.icon
                return (
                  <label key={item.type} className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-brand-border',
                    'text-xs text-brand-text-muted cursor-pointer hover:border-brand-primary hover:text-brand-primary transition-colors',
                    uploadingDoc === item.type && 'pointer-events-none opacity-50',
                  )}>
                    {uploadingDoc === item.type ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
                    <span>{item.label}{item.count > 0 ? ` (${item.count})` : ''}</span>
                    <input
                      type="file"
                      multiple={!['pi', 'ci', 'pl', 'sc', 'co', 'bl_copy'].includes(item.type)}
                      className="hidden"
                      onChange={e => {
                        handleDocumentUpload(item.type, Array.from(e.target.files ?? []))
                        e.target.value = ''
                      }}
                    />
                  </label>
                )
              })}
              <div className="flex gap-2">
                <input
                  className="input-base flex-1 text-xs"
                  placeholder={isRTL ? 'نوع الملف' : 'File type'}
                  value={otherFileType}
                  onChange={e => setOtherFileType(e.target.value)}
                />
                <label className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-brand-border',
                  'text-xs text-brand-text-muted cursor-pointer hover:border-brand-primary hover:text-brand-primary transition-colors',
                  (!otherFileType.trim() || uploadingDoc === 'other') && 'opacity-50',
                )}>
                  {uploadingDoc === 'other' ? <Loader2 size={13} className="animate-spin" /> : <FolderPlus size={13} />}
                  <span>{isRTL ? 'أخرى' : 'Other'}</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    disabled={!otherFileType.trim()}
                    onChange={e => {
                      handleDocumentUpload('other', Array.from(e.target.files ?? []))
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            </div>

            {line.documents.length > 0 && (
              <div className="space-y-1.5">
                {line.documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-brand-border/50 px-3 py-2">
                    <FileText size={13} className="text-brand-primary-light" />
                    <a
                      href={getCargoDocumentUrl(bookingId, line.id, doc.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 text-xs text-brand-text hover:text-brand-primary-light truncate"
                    >
                      {docLabel(doc)} · {doc.original_filename || 'file'}
                    </a>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="p-1 rounded text-brand-text-muted hover:text-brand-red hover:bg-brand-red/10 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
                      src={`/uploads/${img.file_path}`}
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
