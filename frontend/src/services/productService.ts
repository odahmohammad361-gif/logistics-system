import api from './api'
import type { Product, ProductListResponse, ProductReferenceData } from '@/types'

// Admin endpoints
export const adminListProducts = (params?: Record<string, unknown>) =>
  api.get<ProductListResponse>('/products/admin', { params }).then((r) => r.data)

export const listProductTaxonomy = (params?: Record<string, unknown>) =>
  api.get<ProductReferenceData>('/products/taxonomy', { params }).then((r) => r.data)

export const createProduct = (data: unknown) =>
  api.post<Product>('/products/admin', data).then((r) => r.data)

export const updateProduct = (id: number, data: unknown) =>
  api.patch<Product>(`/products/admin/${id}`, data).then((r) => r.data)

export const deleteProduct = (id: number) =>
  api.delete(`/products/admin/${id}`)

export const uploadProductPhoto = (productId: number, file: File, isMain = false) => {
  const form = new FormData()
  form.append('file', file)
  form.append('is_main', String(isMain))
  return api.post<Product>(`/products/admin/${productId}/photos`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data)
}

export const deleteProductPhoto = (productId: number, photoId: number) =>
  api.delete(`/products/admin/${productId}/photos/${photoId}`)

// Public endpoints
export const listProducts = (params?: Record<string, unknown>) =>
  api.get<ProductListResponse>('/products', { params }).then((r) => r.data)

export const getProduct = (id: number) =>
  api.get<Product>(`/products/${id}`).then((r) => r.data)

export const listCategories = () =>
  api.get<string[]>('/products/categories').then((r) => r.data)
