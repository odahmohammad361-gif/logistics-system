import api from './api'
import type {
  AccountingAttachment,
  AccountingEntry,
  AccountingEntryListResponse,
  AccountingReportSummary,
  AccountingSummary,
  BankStatementImportListResponse,
  BankStatementLineListResponse,
  BankStatementUploadResponse,
} from '@/types'

export const getAccountingSummary = () =>
  api.get<AccountingSummary>('/accounting/summary').then((r) => r.data)

export const getAccountingReportSummary = (params?: Record<string, unknown>) =>
  api.get<AccountingReportSummary>('/accounting/reports/summary', { params }).then((r) => r.data)

export const getAccountingEntries = (params?: Record<string, unknown>) =>
  api.get<AccountingEntryListResponse>('/accounting/entries', { params }).then((r) => r.data)

export const createAccountingEntry = (data: unknown) =>
  api.post<AccountingEntry>('/accounting/entries', data).then((r) => r.data)

export const updateAccountingEntry = (id: number, data: unknown) =>
  api.patch<AccountingEntry>(`/accounting/entries/${id}`, data).then((r) => r.data)

export const voidAccountingEntry = (id: number) =>
  api.delete(`/accounting/entries/${id}`)

export const uploadAccountingAttachments = (entryId: number, files: File[], documentType = 'receipt') => {
  const form = new FormData()
  files.forEach((file) => form.append('files', file))
  return api.post<AccountingAttachment[]>(
    `/accounting/entries/${entryId}/attachments`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, params: { document_type: documentType } },
  ).then((r) => r.data)
}

export const getAccountingAttachmentUrl = (entryId: number, attachmentId: number): string => {
  const base = api.defaults.baseURL ?? ''
  return `${base}/accounting/entries/${entryId}/attachments/${attachmentId}`
}

export const getBankStatements = (params?: Record<string, unknown>) =>
  api.get<BankStatementImportListResponse>('/accounting/bank-statements', { params }).then((r) => r.data)

export const uploadBankStatement = (data: {
  file: File
  bank_name?: string
  account_name?: string
  account_no?: string
  currency?: string
}) => {
  const form = new FormData()
  form.append('file', data.file)
  const params = {
    bank_name: data.bank_name || undefined,
    account_name: data.account_name || undefined,
    account_no: data.account_no || undefined,
    currency: data.currency || 'USD',
  }
  return api.post<BankStatementUploadResponse>('/accounting/bank-statements/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params,
  }).then((r) => r.data)
}

export const getBankStatementLines = (statementId: number, params?: Record<string, unknown>) =>
  api.get<BankStatementLineListResponse>(`/accounting/bank-statements/${statementId}/lines`, { params }).then((r) => r.data)

export const confirmBankLineMatch = (lineId: number, entryId: number) =>
  api.post<BankStatementLineListResponse>(`/accounting/bank-statement-lines/${lineId}/confirm-match/${entryId}`).then((r) => r.data)

export const unmatchBankLine = (lineId: number) =>
  api.post<BankStatementLineListResponse>(`/accounting/bank-statement-lines/${lineId}/unmatch`).then((r) => r.data)

export const getBankStatementDownloadUrl = (statementId: number): string => {
  const base = api.defaults.baseURL ?? ''
  return `${base}/accounting/bank-statements/${statementId}/download`
}

export const getAccountingReportCsvUrl = (params?: Record<string, string>): string => {
  const base = api.defaults.baseURL ?? ''
  const query = new URLSearchParams(params).toString()
  return `${base}/accounting/reports/summary.csv${query ? `?${query}` : ''}`
}

export const downloadAccountingReportCsv = (params?: Record<string, unknown>) =>
  api.get<Blob>('/accounting/reports/summary.csv', { params, responseType: 'blob' }).then((r) => r.data)
