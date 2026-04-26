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
  deleteLoadingPhoto, downloadBookingArchiveZip,
} from '@/services/bookingService'
import { getBranches } from '@/services/branchService'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import CapacityMeter from '@/components/booking/CapacityMeter'
import CargoLineCard from '@/components/booking/CargoLineCard'
import CargoLineForm from '@/components/booking/CargoLineForm'
import BookingForm from '@/components/booking/BookingForm'
import FilePreviewModal from '@/components/booking/FilePreviewModal'
import type { Booking, BookingCargoLine, BookingMode } from '@/types'
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

type ExportSection = 'summary' | 'cargo' | 'loading' | 'loadingPhotos' | 'cargoImages'
type ExportOptions = Record<ExportSection, boolean>

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  summary: true,
  cargo: true,
  loading: true,
  loadingPhotos: true,
  cargoImages: true,
}

function esc(value: unknown) {
  return String(value ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(value: number | null | undefined, currency = 'USD') {
  if (value == null) return '—'
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`
}

function fileUrl(path: string) {
  return new URL(`/uploads/${path}`, window.location.origin).href
}

function isImagePath(path: string) {
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(path)
}

function infoRow(label: string, value: unknown) {
  return `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`
}

function buildContainerArchiveHtml(booking: Booking, options: ExportOptions, isRTL: boolean) {
  const dir = isRTL ? 'rtl' : 'ltr'
  const title = isRTL ? 'أرشيف بيانات الحاوية' : 'Container Data Archive'
  const generated = new Date().toLocaleString()
  const lineClient = (line: BookingCargoLine) => isRTL ? (line.client.name_ar ?? line.client.name) : line.client.name
  const totalCargoImages = booking.cargo_lines.reduce((sum, line) => sum + line.images.length, 0)
  const totalCargoDocs = booking.cargo_lines.reduce((sum, line) => sum + line.documents.length, 0)

  const summaryRows = [
    infoRow(isRTL ? 'رقم الحجز' : 'Booking No.', booking.booking_number),
    infoRow(isRTL ? 'نوع الشحن' : 'Mode', booking.mode),
    infoRow(isRTL ? 'الحالة' : 'Status', booking.status),
    infoRow(isRTL ? 'وكيل الشحن' : 'Shipping Agent', booking.agent?.name),
    infoRow(isRTL ? 'الناقل' : 'Carrier', booking.carrier_name),
    infoRow(isRTL ? 'حجم الحاوية' : 'Container Size', booking.container_size),
    infoRow(isRTL ? 'رقم الحاوية' : 'Container No.', booking.container_no),
    infoRow(isRTL ? 'رقم الختم' : 'Seal No.', booking.seal_no),
    infoRow(isRTL ? 'رقم بوليصة الشحن' : 'B/L No.', booking.bl_number),
    infoRow(isRTL ? 'رقم AWB' : 'AWB No.', booking.awb_number),
    infoRow(isRTL ? 'السفينة / الرحلة' : 'Vessel / Flight', booking.vessel_name ?? booking.flight_number),
    infoRow(isRTL ? 'الرحلة البحرية' : 'Voyage No.', booking.voyage_number),
    infoRow(isRTL ? 'ميناء التحميل' : 'Port of Loading', booking.port_of_loading),
    infoRow(isRTL ? 'ميناء التفريغ' : 'Port of Discharge', booking.port_of_discharge),
    infoRow(isRTL ? 'ETD' : 'ETD', booking.etd),
    infoRow(isRTL ? 'ETA' : 'ETA', booking.eta),
    infoRow(isRTL ? 'شرط التسليم' : 'Incoterm', booking.incoterm),
    infoRow(isRTL ? 'تكلفة الشحن' : 'Freight Cost', money(booking.freight_cost, booking.currency)),
    infoRow(isRTL ? 'سعر بيع الشحن' : 'Selling Freight', money(booking.sell_freight_cost, booking.currency)),
    infoRow(isRTL ? 'نسبة الربح' : 'Markup', booking.markup_pct != null ? `${booking.markup_pct}%` : '—'),
    infoRow(isRTL ? 'السعة' : 'Capacity', booking.container_cbm_capacity != null ? `${booking.container_cbm_capacity} CBM` : '—'),
    infoRow(isRTL ? 'الحجم المستخدم' : 'Used CBM', booking.total_cbm_used != null ? `${booking.total_cbm_used} CBM` : '—'),
    infoRow(isRTL ? 'نسبة الامتلاء' : 'Fill Percent', booking.fill_percent != null ? `${booking.fill_percent}%` : '—'),
  ].join('')

  const cargoRows = booking.cargo_lines.map((line, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${esc(line.client.client_code)}</td>
      <td>${esc(lineClient(line))}</td>
      <td>${esc(line.goods_source === 'company_buying_service' ? (isRTL ? 'شراء عن طريق الشركة' : 'Company buying') : (isRTL ? 'بضاعة جاهزة' : 'Ready goods'))}</td>
      <td>${esc(line.is_full_container_client ? (isRTL ? 'نعم' : 'Yes') : '')}</td>
      <td>${esc(isRTL ? (line.description_ar ?? line.description) : line.description)}</td>
      <td>${esc(line.cartons)}</td>
      <td>${esc(line.gross_weight_kg)}</td>
      <td>${esc(line.net_weight_kg)}</td>
      <td>${esc(line.cbm)}</td>
      <td>${esc(line.hs_code)}</td>
      <td>${esc(money(line.freight_share, booking.currency))}</td>
      <td>${esc(line.images.length)}</td>
      <td>${esc(line.documents.length)}</td>
    </tr>
  `).join('')

  const loadingRows = [
    infoRow(isRTL ? 'مستودع التحميل' : 'Loading Warehouse', booking.loading_warehouse_name),
    infoRow(isRTL ? 'مدينة المستودع' : 'Warehouse City', booking.loading_warehouse_city),
    infoRow(isRTL ? 'تاريخ التحميل' : 'Loading Date', booking.loading_date),
    infoRow(isRTL ? 'ملاحظات التحميل' : 'Loading Notes', booking.loading_notes),
    infoRow(isRTL ? 'عدد صور التحميل' : 'Loading Photo Count', booking.loading_photos.length),
  ].join('')

  const loadingPhotoPages = booking.loading_photos.map((photo, idx) => `
    <section class="page photo-page">
      <h2>${esc(isRTL ? 'صور التحميل' : 'Loading Photos')} ${idx + 1}/${booking.loading_photos.length}</h2>
      <p class="muted">${esc(photo.original_filename ?? '')}</p>
      <img src="${fileUrl(photo.file_path)}" alt="${esc(photo.original_filename ?? '')}" />
      ${photo.caption ? `<p class="caption">${esc(photo.caption)}</p>` : ''}
    </section>
  `).join('')

  const cargoImagePages = booking.cargo_lines.flatMap(line => line.images.map((img, idx) => `
    <section class="page photo-page">
      <h2>${esc(isRTL ? 'صور بضاعة العميل' : 'Client Cargo Photos')}</h2>
      <p class="muted">${esc(line.client.client_code)} · ${esc(lineClient(line))} · ${idx + 1}/${line.images.length}</p>
      <img src="${fileUrl(img.file_path)}" alt="${esc(img.original_filename ?? '')}" />
      <p class="caption">${esc(img.original_filename ?? '')}</p>
    </section>
  `)).join('')

  const cargoDocumentPages = booking.cargo_lines.flatMap(line => line.documents.map((doc, idx) => {
    const label =
      doc.document_type === 'pi' ? (isRTL ? 'فاتورة أولية' : 'PI / Proforma Invoice') :
      doc.document_type === 'ci' ? (isRTL ? 'فاتورة تجارية' : 'CI / Commercial Invoice') :
      doc.document_type === 'pl' ? (isRTL ? 'قائمة التعبئة' : 'PL / Packing List') :
      doc.document_type === 'sc' ? (isRTL ? 'عقد البيع' : 'SC / Sales Contract') :
      doc.document_type === 'co' ? (isRTL ? 'شهادة المنشأ' : 'CO / Certificate of Origin') :
      doc.document_type === 'bl_copy' ? (isRTL ? 'نسخة بوليصة الشحن' : 'B/L Copy') :
      doc.document_type === 'security_approval' ? (isRTL ? 'موافقات أمنية' : 'Security Approval') :
      doc.document_type === 'goods_invoice' ? (isRTL ? 'فواتير البضاعة' : 'Goods Invoice') :
      (doc.custom_file_type || (isRTL ? 'ملف آخر' : 'Other File'))
    const href = fileUrl(doc.file_path)
    return `
      <section class="page ${isImagePath(doc.file_path) ? 'photo-page' : ''}">
        <h2>${esc(label)}</h2>
        <p class="muted">${esc(line.client.client_code)} · ${esc(lineClient(line))} · ${idx + 1}/${line.documents.length}</p>
        ${isImagePath(doc.file_path)
          ? `<img src="${href}" alt="${esc(doc.original_filename ?? '')}" />`
          : `<div class="file-box"><p>${esc(doc.original_filename ?? 'file')}</p><a href="${href}">${esc(isRTL ? 'فتح الملف' : 'Open file')}</a></div>`}
      </section>
    `
  })).join('')

  return `<!doctype html>
<html lang="${isRTL ? 'ar' : 'en'}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)} - ${esc(booking.booking_number)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Tahoma, sans-serif; color: #111827; background: #fff; }
    .page { min-height: 260mm; page-break-after: always; padding: 8mm 0; }
    .page:last-child { page-break-after: auto; }
    h1 { margin: 0 0 8px; font-size: 26px; }
    h2 { margin: 0 0 12px; font-size: 18px; color: #0f172a; }
    .cover { display: flex; flex-direction: column; justify-content: center; border: 2px solid #0f172a; padding: 18mm; }
    .cover .code { font: 700 30px monospace; margin: 10px 0; color: #0f172a; }
    .muted { color: #64748b; font-size: 12px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 18px; }
    .stat { border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; }
    .stat strong { display: block; font-size: 18px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    th, td { border: 1px solid #cbd5e1; padding: 7px; vertical-align: top; text-align: ${isRTL ? 'right' : 'left'}; }
    th { background: #f1f5f9; width: 28%; }
    .data-table th { width: auto; white-space: nowrap; }
    .photo-page { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .photo-page img { max-width: 100%; max-height: 215mm; object-fit: contain; border: 1px solid #cbd5e1; }
    .caption { margin-top: 10px; font-size: 12px; color: #334155; }
    .file-box { margin: 35mm auto 0; max-width: 120mm; border: 1px solid #cbd5e1; padding: 16px; border-radius: 8px; text-align: center; }
    .file-box a { color: #0369a1; font-weight: 700; }
    .future { color: #94a3b8; font-size: 11px; margin-top: 8px; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { break-after: page; }
      .page:last-child { break-after: auto; }
    }
  </style>
</head>
<body>
  <section class="page cover">
    <p class="muted">${esc(generated)}</p>
    <h1>${esc(title)}</h1>
    <div class="code">${esc(booking.booking_number)}</div>
    <p>${esc(booking.port_of_loading)} → ${esc(booking.port_of_discharge)}</p>
    <div class="stats">
      <div class="stat">${esc(isRTL ? 'العملاء' : 'Clients')}<strong>${booking.cargo_lines.length}</strong></div>
      <div class="stat">${esc(isRTL ? 'صور التحميل' : 'Loading Photos')}<strong>${booking.loading_photos.length}</strong></div>
      <div class="stat">${esc(isRTL ? 'صور البضاعة' : 'Cargo Photos')}<strong>${totalCargoImages}</strong></div>
      <div class="stat">${esc(isRTL ? 'ملفات العملاء' : 'Client Files')}<strong>${totalCargoDocs}</strong></div>
    </div>
    <p class="future">${esc(isRTL ? 'هذا الأرشيف قابل للتوسعة لاحقاً ليشمل B/L و CO والفواتير والتخليص والتسليم.' : 'This archive is ready to expand later with B/L, CO, invoices, clearance and delivery files.')}</p>
  </section>

  ${options.summary ? `<section class="page"><h2>${esc(isRTL ? 'ملخص الحاوية' : 'Container Summary')}</h2><table>${summaryRows}</table></section>` : ''}
  ${options.cargo ? `<section class="page"><h2>${esc(isRTL ? 'بضاعة العملاء' : 'Client Cargo')}</h2><table class="data-table"><thead><tr><th>#</th><th>${esc(isRTL ? 'كود العميل' : 'Client Code')}</th><th>${esc(isRTL ? 'العميل' : 'Client')}</th><th>${esc(isRTL ? 'مصدر البضاعة' : 'Source')}</th><th>${esc(isRTL ? 'حاوية كاملة' : 'Full Container')}</th><th>${esc(isRTL ? 'الوصف' : 'Description')}</th><th>${esc(isRTL ? 'كراتين' : 'Cartons')}</th><th>GW</th><th>NW</th><th>CBM</th><th>HS</th><th>${esc(isRTL ? 'حصة الشحن' : 'Freight Share')}</th><th>${esc(isRTL ? 'صور' : 'Photos')}</th><th>${esc(isRTL ? 'ملفات' : 'Files')}</th></tr></thead><tbody>${cargoRows || `<tr><td colspan="14">${esc(isRTL ? 'لا توجد بضاعة' : 'No cargo')}</td></tr>`}</tbody></table></section>` : ''}
  ${options.loading ? `<section class="page"><h2>${esc(isRTL ? 'معلومات التحميل' : 'Loading Information')}</h2><table>${loadingRows}</table></section>` : ''}
  ${options.loadingPhotos ? loadingPhotoPages : ''}
  ${options.cargoImages ? cargoImagePages : ''}
  ${options.cargo ? cargoDocumentPages : ''}
</body>
</html>`
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
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [exportOptions, setExportOptions]         = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS)
  const [showCargoForm, setShowCargoForm]         = useState(false)
  const [editingLine, setEditingLine]             = useState<BookingCargoLine | null>(null)
  const [savingHeader, setSavingHeader]           = useState(false)
  const [savingCargo, setSavingCargo]             = useState(false)
  const [cargoError, setCargoError]               = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete]         = useState(false)
  const [confirmDeleteLine, setConfirmDeleteLine] = useState<number | null>(null)
  const [downloadingZip, setDownloadingZip]       = useState(false)
  const [previewFile, setPreviewFile]             = useState<{ title: string; url: string; filename?: string | null } | null>(null)

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
    setCargoError(null)
    try {
      if (editingLine) {
        await updateLineMut.mutateAsync({ lineId: editingLine.id, data })
      } else {
        await addLineMut.mutateAsync(data)
      }
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      setCargoError(typeof detail === 'string' ? detail : (isRTL ? 'تعذر حفظ بيانات البضاعة.' : 'Could not save cargo line.'))
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

  function toggleExportOption(key: ExportSection, checked: boolean) {
    setExportOptions(prev => ({ ...prev, [key]: checked }))
  }

  function setAllExportOptions(checked: boolean) {
    setExportOptions({
      summary: checked,
      cargo: checked,
      loading: checked,
      loadingPhotos: checked,
      cargoImages: checked,
    })
  }

  function handleDownloadContainerArchive() {
    if (!booking) return
    const html = buildContainerArchiveHtml(booking, exportOptions, isRTL)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${booking.booking_number}-container-archive.html`
    a.click()
    URL.revokeObjectURL(url)
    setShowDownloadModal(false)
  }

  async function handleDownloadZipArchive() {
    if (!booking) return
    setDownloadingZip(true)
    try {
      await downloadBookingArchiveZip(bookingId, booking.booking_number)
      setShowDownloadModal(false)
    } finally {
      setDownloadingZip(false)
    }
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
  const allExportSelected = Object.values(exportOptions).every(Boolean)
  const cargoImageCount = booking.cargo_lines.reduce((sum, line) => sum + line.images.length, 0)
  const hasFullContainerClient = booking.cargo_lines.some(line => line.is_full_container_client)
  const usedCbm = Number(booking.total_cbm_used ?? 0)
  const capacityCbm = booking.container_cbm_capacity != null ? Number(booking.container_cbm_capacity) : null
  const remainingCbm = capacityCbm != null ? Math.max(0, capacityCbm - usedCbm) : null
  const lclAtCapacity = booking.mode === 'LCL' && remainingCbm != null && remainingCbm <= 0
  const lclNearCapacity = booking.mode === 'LCL' && Number(booking.fill_percent ?? 0) >= 90
  const addCargoBlocked = hasFullContainerClient || lclAtCapacity
  const exportSections: Array<{ key: ExportSection; label: string; hint: string; count?: number }> = [
    {
      key: 'summary',
      label: isRTL ? 'ملخص بيانات الحاوية' : 'Container summary',
      hint: isRTL ? 'المسار، التواريخ، الناقل، السعر، السعة والمراجع' : 'Route, dates, carrier, price, capacity and references',
    },
    {
      key: 'cargo',
      label: isRTL ? 'بضاعة العملاء' : 'Client cargo lines',
      hint: isRTL ? 'تفاصيل العملاء، الكراتين، الوزن، CBM و HS' : 'Clients, cartons, weights, CBM and HS data',
      count: booking.cargo_lines.length,
    },
    {
      key: 'loading',
      label: isRTL ? 'معلومات التحميل' : 'Loading information',
      hint: isRTL ? 'المستودع، تاريخ التحميل وملاحظات التحميل' : 'Warehouse, loading date and loading notes',
    },
    {
      key: 'loadingPhotos',
      label: isRTL ? 'صور التحميل' : 'Loading photos',
      hint: isRTL ? 'كل صورة في صفحة منفصلة جاهزة للطباعة' : 'Each photo on a separate print-ready page',
      count: booking.loading_photos.length,
    },
    {
      key: 'cargoImages',
      label: isRTL ? 'صور بضاعة العملاء' : 'Client cargo photos',
      hint: isRTL ? 'صور البضاعة حسب العميل، كل صورة في صفحة منفصلة' : 'Cargo photos grouped by client, each on its own page',
      count: cargoImageCount,
    },
  ]

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
            <Button variant="ghost" size="sm" onClick={() => setShowDownloadModal(true)}>
              <Download size={13} />
              {isRTL ? 'تحميل بيانات الحاوية' : 'Download Container Data'}
            </Button>
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
          {booking.sell_freight_cost != null && (
            <div>
              <p className="text-[10px] text-brand-text-muted mb-0.5">
                {isRTL ? 'سعر بيع الشحن' : 'Selling Freight'}
              </p>
              <p className="text-sm text-emerald-400 font-mono">
                {booking.sell_freight_cost.toLocaleString()} {booking.currency}
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
                <div
                  key={photo.id}
                  onClick={() => setPreviewFile({
                    title: photo.original_filename || (isRTL ? 'صورة تحميل' : 'Loading photo'),
                    url: `/uploads/${photo.file_path}`,
                    filename: photo.original_filename,
                  })}
                  className="relative group aspect-square rounded-lg overflow-hidden border border-brand-border cursor-pointer"
                >
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
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id) }}
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
            <Button
              size="sm"
              disabled={addCargoBlocked}
              title={
                hasFullContainerClient
                  ? (isRTL ? 'هذه الحاوية مخصصة لعميل واحد' : 'This container is assigned to one full-container client')
                  : lclAtCapacity
                    ? (isRTL ? 'الحاوية ممتلئة ولا يمكن إضافة عميل جديد' : 'Container is full; no more cargo can be added')
                    : undefined
              }
              onClick={() => { setCargoError(null); setEditingLine(null); setShowCargoForm(true) }}
            >
              <Plus size={13} />
              {t('bookings.add_client_cargo')}
            </Button>
          )}
        </div>

        {(hasFullContainerClient || lclNearCapacity) && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
            hasFullContainerClient
              ? 'bg-emerald-500/8 border-emerald-500/20'
              : 'bg-amber-400/8 border-amber-400/20'
          }`}>
            <AlertTriangle size={14} className={hasFullContainerClient ? 'text-emerald-300' : 'text-amber-300'} />
            <p className="text-xs text-brand-text-muted">
              {hasFullContainerClient
                ? (isRTL
                  ? 'هذه الحاوية مخصصة كحاوية كاملة لعميل واحد، لذلك لا يمكن إضافة عملاء آخرين.'
                  : 'This container is marked as a full container for one client, so no additional clients can be added.')
                : (isRTL
                  ? `الحاوية وصلت ${booking.fill_percent ?? 0}% من السعة. المتبقي ${remainingCbm?.toFixed(3) ?? '0.000'} CBM.`
                  : `Container is at ${booking.fill_percent ?? 0}% capacity. Remaining space is ${remainingCbm?.toFixed(3) ?? '0.000'} CBM.`)}
            </p>
          </div>
        )}

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
                onEdit={booking.is_locked ? undefined : () => { setCargoError(null); setEditingLine(line); setShowCargoForm(true) }}
                onDelete={booking.is_locked ? undefined : () => setConfirmDeleteLine(line.id)}
                onRefresh={() => qc.invalidateQueries({ queryKey: ['booking', bookingId] })}
                onExtracted={(extractedLine) => {
                  setCargoError(null)
                  setEditingLine(extractedLine)
                  setShowCargoForm(true)
                  qc.invalidateQueries({ queryKey: ['booking', bookingId] })
                }}
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

      <Modal
        open={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        title={isRTL ? 'تحميل بيانات الحاوية' : 'Download Container Data'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDownloadModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleDownloadContainerArchive}>
              <Download size={14} />
              {isRTL ? 'تحميل ملف جاهز للطباعة' : 'Download Print-Ready File'}
            </Button>
            <Button onClick={handleDownloadZipArchive} loading={downloadingZip}>
              <Download size={14} />
              {isRTL ? 'تحميل أرشيف ZIP' : 'Download ZIP Archive'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 accent-brand-primary"
                checked={allExportSelected}
                onChange={e => setAllExportOptions(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-semibold text-brand-text">
                  {isRTL ? 'تحميل جميع بيانات وملفات الحاوية' : 'Download all container data and files'}
                </span>
                <span className="block text-xs text-brand-text-muted mt-1">
                  {isRTL
                    ? 'سيتم وضع كل صورة أو ملف مرفوع حاليًا في صفحة منفصلة داخل ملف HTML جاهز للطباعة.'
                    : 'Each currently uploaded photo/file is placed on its own page inside a print-ready HTML file.'}
                </span>
                <span className="block text-xs text-brand-text-muted mt-1">
                  {isRTL
                    ? 'خيار ZIP يحفظ ملفات العملاء الأصلية في مجلدات منفصلة حسب العميل ونوع الملف.'
                    : 'The ZIP option saves the original client files in separate folders by client and file type.'}
                </span>
              </span>
            </label>
          </div>

          <div className="space-y-2">
            {exportSections.map(section => (
              <label
                key={section.key}
                className="flex items-start gap-3 rounded-xl border border-brand-border bg-brand-card/60 p-3 cursor-pointer hover:border-brand-border-focus transition-colors"
              >
                <input
                  type="checkbox"
                  className="mt-1 accent-brand-primary"
                  checked={exportOptions[section.key]}
                  onChange={e => toggleExportOption(section.key, e.target.checked)}
                />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 text-sm font-medium text-brand-text">
                    {section.label}
                    {section.count != null && (
                      <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-bold text-brand-text-muted">
                        {section.count}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-brand-text-muted mt-1">{section.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="rounded-xl border border-dashed border-brand-border p-3 text-xs text-brand-text-muted">
            {isRTL
              ? 'لاحقًا سنضيف هنا B/L و CO والفواتير وملفات التخليص والتسليم وملفات كل عميل، وستدخل في نفس أرشيف الحاوية.'
              : 'Later we will plug in B/L, CO, invoices, clearance files, delivery files and client-specific documents into this same container archive.'}
          </div>
        </div>
      </Modal>

      {/* Cargo line form */}
      <CargoLineForm
        open={showCargoForm}
        onClose={() => { setShowCargoForm(false); setEditingLine(null) }}
        onSubmit={handleSaveCargo}
        mode={booking.mode}
        bookingId={bookingId}
        containerSize={booking.container_size}
        carrierName={booking.carrier_name}
        capacityCbm={capacityCbm}
        usedCbm={usedCbm}
        existingLineCount={booking.cargo_lines.length}
        initial={editingLine}
        saving={savingCargo}
        errorMessage={cargoError}
      />
      {previewFile && (
        <FilePreviewModal
          open={!!previewFile}
          onClose={() => setPreviewFile(null)}
          title={previewFile.title}
          url={previewFile.url}
          filename={previewFile.filename}
        />
      )}
    </div>
  )
}
