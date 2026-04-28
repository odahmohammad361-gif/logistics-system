import api from './api'
import type {
  InvoicePackage,
  InvoicePackageDocument,
  InvoicePackageFile,
  InvoicePackageItem,
  InvoicePackageListResponse,
} from '@/types'

export const getInvoicePackages = (params?: Record<string, unknown>) =>
  api.get<InvoicePackageListResponse>('/invoice-packages', { params }).then((r) => r.data)

export const getInvoicePackage = (id: number) =>
  api.get<InvoicePackage>(`/invoice-packages/${id}`).then((r) => r.data)

export const createInvoicePackage = (data: unknown) =>
  api.post<InvoicePackage>('/invoice-packages', data).then((r) => r.data)

export const updateInvoicePackage = (id: number, data: unknown) =>
  api.patch<InvoicePackage>(`/invoice-packages/${id}`, data).then((r) => r.data)

export const archiveInvoicePackage = (id: number) =>
  api.delete(`/invoice-packages/${id}`)

export const addInvoicePackageItem = (packageId: number, data: unknown) =>
  api.post<InvoicePackageItem>(`/invoice-packages/${packageId}/items`, data).then((r) => r.data)

export const updateInvoicePackageItem = (packageId: number, itemId: number, data: unknown) =>
  api.patch<InvoicePackageItem>(`/invoice-packages/${packageId}/items/${itemId}`, data).then((r) => r.data)

export const deleteInvoicePackageItem = (packageId: number, itemId: number) =>
  api.delete(`/invoice-packages/${packageId}/items/${itemId}`)

export const generateInvoicePackageDocument = (packageId: number, data: unknown) =>
  api.post<InvoicePackageDocument>(`/invoice-packages/${packageId}/documents/generate`, data).then((r) => r.data)

export const downloadInvoicePackageDocumentPdf = (packageId: number, documentId: number, lang: 'en' | 'ar') =>
  api.get<Blob>(`/invoice-packages/${packageId}/documents/${documentId}/pdf`, {
    params: { lang },
    responseType: 'blob',
  }).then((r) => r.data)

export const uploadInvoicePackageFile = (
  packageId: number,
  file: File,
  meta?: { document_type?: string; document_id?: number | null; custom_file_type?: string | null },
) => {
  const form = new FormData()
  form.append('file', file)
  form.append('document_type', meta?.document_type ?? 'OTHER')
  if (meta?.document_id) form.append('document_id', String(meta.document_id))
  if (meta?.custom_file_type) form.append('custom_file_type', meta.custom_file_type)
  return api.post<InvoicePackageFile>(`/invoice-packages/${packageId}/files`, form).then((r) => r.data)
}

export const deleteInvoicePackageFile = (packageId: number, fileId: number) =>
  api.delete(`/invoice-packages/${packageId}/files/${fileId}`)

export const getInvoicePackageFileUrl = (packageId: number, fileId: number) => {
  const base = api.defaults.baseURL ?? ''
  return `${base}/invoice-packages/${packageId}/files/${fileId}`
}
