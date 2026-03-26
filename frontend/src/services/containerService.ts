import api from './api'
import type { Container, ContainerListResponse, ContainerCapacity, OcrResult } from '@/types'

export const getContainers = (params?: Record<string, unknown>) =>
  api.get<ContainerListResponse>('/containers', { params }).then((r) => r.data)

export const getContainer = (id: number) =>
  api.get<Container>(`/containers/${id}`).then((r) => r.data)

export const createContainer = (data: unknown) =>
  api.post<Container>('/containers', data).then((r) => r.data)

export const updateContainer = (id: number, data: unknown) =>
  api.patch<Container>(`/containers/${id}`, data).then((r) => r.data)

export const updateContainerStatus = (id: number, status: string) =>
  api.patch<Container>(`/containers/${id}/status`, { status }).then((r) => r.data)

export const deleteContainer = (id: number) =>
  api.delete(`/containers/${id}`)

/** Get capacity utilization for a container (CBM + weight vs limits) */
export const getContainerCapacity = (id: number) =>
  api.get<ContainerCapacity>(`/containers/${id}/capacity`).then((r) => r.data)

/** Upload a container document image for OCR extraction */
export const ocrContainerDocument = (file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post<OcrResult>('/containers/ocr', fd).then((r) => r.data)
}
