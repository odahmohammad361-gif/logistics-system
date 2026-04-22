import api from './api'
import type { Invoice, InvoiceListResponse } from '@/types'
import type { ParsedItem } from '@/components/invoice/ExcelImportPanel'

export const getInvoices = (params?: Record<string, unknown>) =>
  api.get<InvoiceListResponse>('/invoices', { params }).then((r) => r.data)

export const getInvoice = (id: number) =>
  api.get<Invoice>(`/invoices/${id}`).then((r) => r.data)

export const createInvoice = (data: unknown) =>
  api.post<Invoice>('/invoices', data).then((r) => r.data)

export const updateInvoice = (id: number, data: unknown) =>
  api.patch<Invoice>(`/invoices/${id}`, data).then((r) => r.data)

export const deleteInvoice = (id: number) =>
  api.delete(`/invoices/${id}`)

/** Download PDF as blob */
export const downloadPdf = (id: number, lang: 'ar' | 'en' = 'ar') =>
  api.get<Blob>(`/invoices/${id}/pdf`, { params: { lang }, responseType: 'blob' }).then((r) => r.data)

/** Get PDF URL for inline viewing / printing */
export const getPdfUrl = (id: number, lang: 'ar' | 'en' = 'en') => {
  const base = api.defaults.baseURL ?? ''
  return `${base}/invoices/${id}/pdf?lang=${lang}`
}

/** Upload stamp image */
export const uploadStamp = (invoiceId: number, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post<Invoice>(`/invoices/${invoiceId}/stamp`, fd).then((r) => r.data)
}

/** Upload background document image */
export const uploadBackground = (invoiceId: number, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post<Invoice>(`/invoices/${invoiceId}/background`, fd).then((r) => r.data)
}

/** Upload product image for an item (file) */
export const uploadItemImage = (invoiceId: number, itemId: number, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post<{ path: string }>(`/invoices/${invoiceId}/item/${itemId}/image`, fd).then((r) => r.data)
}

/** Upload product image for an item (base64 from clipboard) */
export const uploadItemImageBase64 = (invoiceId: number, itemId: number, base64: string) =>
  api.post<{ path: string }>(`/invoices/${invoiceId}/item/${itemId}/image-base64`, { data: base64 }).then((r) => r.data)

/** Parse Excel file — returns structured item rows, does NOT save to DB */
export const importInvoiceExcel = (file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post<{ items: ParsedItem[]; count: number }>('/invoices/import-excel', fd).then((r) => r.data)
}

/** Copy B/L, seal, container no from linked container into invoice fields */
export const populateFromContainer = (invoiceId: number) =>
  api.post<Invoice>(`/invoices/${invoiceId}/populate-from-container`).then((r) => r.data)

/** Fetch invoice barcode as blob (SVG) */
export const getInvoiceBarcode = (id: number) =>
  api.get<Blob>(`/invoices/${id}/barcode`, { responseType: 'blob' }).then((r) => r.data)
