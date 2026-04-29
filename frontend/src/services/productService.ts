import api from './api'
import type {
  HSCodeReference,
  Product,
  ProductListResponse,
  ProductMainCategory,
  ProductReferenceData,
  ProductSubcategory,
  ProductTypeReference,
} from '@/types'

// Admin endpoints
export const adminListProducts = (params?: Record<string, unknown>) =>
  api.get<ProductListResponse>('/products/admin', { params }).then((r) => r.data)

export const listProductTaxonomy = (params?: Record<string, unknown>) =>
  api.get<ProductReferenceData>('/products/taxonomy', { params }).then((r) => r.data)

export const createProductMainCategory = (data: unknown) =>
  api.post<ProductMainCategory>('/products/taxonomy/main-categories', data).then((r) => r.data)

export const updateProductMainCategory = (id: number, data: unknown) =>
  api.patch<ProductMainCategory>(`/products/taxonomy/main-categories/${id}`, data).then((r) => r.data)

export const createProductSubcategory = (data: unknown) =>
  api.post<ProductSubcategory>('/products/taxonomy/subcategories', data).then((r) => r.data)

export const updateProductSubcategory = (id: number, data: unknown) =>
  api.patch<ProductSubcategory>(`/products/taxonomy/subcategories/${id}`, data).then((r) => r.data)

export const createProductTypeReference = (data: unknown) =>
  api.post<ProductTypeReference>('/products/taxonomy/product-types', data).then((r) => r.data)

export const updateProductTypeReference = (id: number, data: unknown) =>
  api.patch<ProductTypeReference>(`/products/taxonomy/product-types/${id}`, data).then((r) => r.data)

export const createHSCodeReference = (data: unknown) =>
  api.post<HSCodeReference>('/products/taxonomy/hs-codes', data).then((r) => r.data)

export const updateHSCodeReference = (id: number, data: unknown) =>
  api.patch<HSCodeReference>(`/products/taxonomy/hs-codes/${id}`, data).then((r) => r.data)

export const createProduct = (data: unknown) =>
  api.post<Product>('/products/admin', data).then((r) => r.data)

export const createProductFromInvoiceItem = (data: unknown) =>
  api.post<Product>('/products/admin/from-invoice-item', data).then((r) => r.data)

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

export const uploadProductPhotos = (productId: number, files: File[]) => {
  const form = new FormData()
  files.slice(0, 20).forEach((file) => form.append('files', file))
  return api.post<Product>(`/products/admin/${productId}/photos/bulk`, form, {
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
