import api from './api'
import type { Booking, BookingListResponse, BookingCargoLine, BookingCargoImage, BookingCargoDocument } from '@/types'

const BASE = '/bookings'

export const getBookings = (params?: Record<string, unknown>) =>
  api.get<BookingListResponse>(BASE, { params }).then((r) => r.data)

export const getBooking = (id: number) =>
  api.get<Booking>(`${BASE}/${id}`).then((r) => r.data)

export const createBooking = (data: unknown) =>
  api.post<Booking>(BASE, data).then((r) => r.data)

export const updateBooking = (id: number, data: unknown) =>
  api.patch<Booking>(`${BASE}/${id}`, data).then((r) => r.data)

export const deleteBooking = (id: number) =>
  api.delete(`${BASE}/${id}`)

// ── Cargo Lines ───────────────────────────────────────────────────────────────

export const addCargoLine = (bookingId: number, data: unknown) =>
  api.post<BookingCargoLine>(`${BASE}/${bookingId}/cargo-lines`, data).then((r) => r.data)

export const updateCargoLine = (bookingId: number, lineId: number, data: unknown) =>
  api.patch<BookingCargoLine>(`${BASE}/${bookingId}/cargo-lines/${lineId}`, data).then((r) => r.data)

export const deleteCargoLine = (bookingId: number, lineId: number) =>
  api.delete(`${BASE}/${bookingId}/cargo-lines/${lineId}`)

// ── Images ────────────────────────────────────────────────────────────────────

export const uploadCargoImages = (bookingId: number, lineId: number, files: File[]) => {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  return api.post<BookingCargoImage[]>(
    `${BASE}/${bookingId}/cargo-lines/${lineId}/images`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  ).then((r) => r.data)
}

export const deleteCargoImage = (bookingId: number, lineId: number, imgId: number) =>
  api.delete(`${BASE}/${bookingId}/cargo-lines/${lineId}/images/${imgId}`)

export const getCargoImageUrl = (bookingId: number, lineId: number, imgId: number): string => {
  const base = api.defaults.baseURL ?? ''
  return `${base}${BASE}/${bookingId}/cargo-lines/${lineId}/images/${imgId}`
}

// ── Cargo Documents ──────────────────────────────────────────────────────────

export const uploadCargoDocuments = (
  bookingId: number,
  lineId: number,
  documentType: 'pi' | 'ci' | 'pl' | 'sc' | 'co' | 'bl_copy' | 'security_approval' | 'goods_invoice' | 'other',
  files: File[],
  customFileType?: string,
) => {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  const params = customFileType ? { custom_file_type: customFileType } : undefined
  return api.post<BookingCargoDocument[]>(
    `${BASE}/${bookingId}/cargo-lines/${lineId}/documents/${documentType}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, params },
  ).then((r) => r.data)
}

export const deleteCargoDocument = (bookingId: number, lineId: number, docId: number) =>
  api.delete(`${BASE}/${bookingId}/cargo-lines/${lineId}/documents/${docId}`)

export const extractCargoDocuments = (bookingId: number, lineId: number) =>
  api.post<BookingCargoLine>(`${BASE}/${bookingId}/cargo-lines/${lineId}/extract-documents`).then((r) => r.data)

export const getCargoDocumentUrl = (bookingId: number, lineId: number, docId: number): string => {
  const base = api.defaults.baseURL ?? ''
  return `${base}${BASE}/${bookingId}/cargo-lines/${lineId}/documents/${docId}`
}

// ── Eligible clients ──────────────────────────────────────────────────────────

export interface EligibleClient {
  id: number
  name: string
  name_ar: string | null
  client_code: string
  country: string | null
  phone: string | null
  destination: 'jordan' | 'iraq' | null
}

export const getEligibleClients = (bookingId: number) =>
  api.get<{ booking_destination: string | null; total: number; results: EligibleClient[] }>(
    `${BASE}/${bookingId}/eligible-clients`,
  ).then((r) => r.data)

// ── Loading Info ──────────────────────────────────────────────────────────────

export const updateLoadingInfo = (bookingId: number, data: {
  loading_warehouse_id?: number | null
  loading_date?: string | null
  loading_notes?: string | null
}) => api.patch(`${BASE}/${bookingId}/loading-info`, data).then((r) => r.data)

export const uploadLoadingPhotos = (bookingId: number, files: File[], caption?: string) => {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  if (caption) form.append('caption', caption)
  return api.post(`${BASE}/${bookingId}/loading-photos`, form,
    { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
}

export const deleteLoadingPhoto = (bookingId: number, photoId: number) =>
  api.delete(`${BASE}/${bookingId}/loading-photos/${photoId}`)

export const getLoadingPhotoUrl = (bookingId: number, photoId: number): string => {
  const base = api.defaults.baseURL ?? ''
  return `${base}${BASE}/${bookingId}/loading-photos/${photoId}`
}

// ── Packing List ──────────────────────────────────────────────────────────────

export const getPackingList = (bookingId: number) =>
  api.get<Record<string, unknown>>(`${BASE}/${bookingId}/packing-list`).then((r) => r.data)

export const downloadBookingArchiveZip = async (bookingId: number, bookingNumber?: string) => {
  const res = await api.get<Blob>(`${BASE}/${bookingId}/archive.zip`, {
    responseType: 'blob',
    timeout: 120000,
  })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `${bookingNumber || `container-${bookingId}`}-archive.zip`
  a.click()
  URL.revokeObjectURL(url)
}

export const getPorts = () =>
  api.get<{ loading: string[]; discharge: string[] }>(`${BASE}/ports`).then((r) => r.data)
