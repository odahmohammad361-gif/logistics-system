import api from './api'
import type { Booking, BookingListResponse, BookingCargoLine, BookingCargoImage } from '@/types'

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

// ── Packing List ──────────────────────────────────────────────────────────────

export const getPackingList = (bookingId: number) =>
  api.get<Record<string, unknown>>(`${BASE}/${bookingId}/packing-list`).then((r) => r.data)
