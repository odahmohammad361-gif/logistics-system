import { useMemo, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, ImagePlus, X, Package, Database, Save } from 'lucide-react'
import {
  adminListProducts, createProduct, updateProduct, deleteProduct,
  uploadProductPhoto, deleteProductPhoto, listProductTaxonomy,
  createProductMainCategory, updateProductMainCategory,
  createProductSubcategory, updateProductSubcategory,
  createProductTypeReference, updateProductTypeReference,
} from '@/services/productService'
import { getSuppliers } from '@/services/supplierService'
import { useAuth } from '@/hooks/useAuth'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, FormRow, FormSection } from '@/components/ui/Form'
import { useForm } from 'react-hook-form'
import type { Product, ProductMainCategory, ProductSubcategory, ProductTypeReference } from '@/types'

interface FormValues {
  code: string
  name: string
  name_ar: string
  category: string
  description: string
  description_ar: string
  supplier_id: string
  main_category_id: string
  subcategory_id: string
  product_type_id: string
  hs_code_ref_id: string
  price_cny: string
  price_usd: string
  pcs_per_carton: string
  cbm_per_carton: string
  min_order_cartons: string
  gross_weight_kg_per_carton: string
  net_weight_kg_per_carton: string
  carton_length_cm: string
  carton_width_cm: string
  carton_height_cm: string
  is_featured: boolean
  is_active: boolean
}

type ReferenceTab = 'main' | 'sub' | 'type'
type ReferenceItem = ProductMainCategory | ProductSubcategory | ProductTypeReference

interface ReferenceForm {
  main_category_id: string
  subcategory_id: string
  hs_code_ref_id: string
  code: string
  name: string
  name_ar: string
  description: string
  sort_order: string
  is_active: boolean
}

const emptyReferenceForm: ReferenceForm = {
  main_category_id: '',
  subcategory_id: '',
  hs_code_ref_id: '',
  code: '',
  name: '',
  name_ar: '',
  description: '',
  sort_order: '0',
  is_active: true,
}

export default function ProductsPage() {
  const { t, i18n } = useTranslation()
  const { isAdmin } = useAuth()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [referenceOpen, setReferenceOpen] = useState(false)
  const [referenceTab, setReferenceTab] = useState<ReferenceTab>('main')
  const [editingReference, setEditingReference] = useState<ReferenceItem | null>(null)
  const [referenceForm, setReferenceForm] = useState<ReferenceForm>(emptyReferenceForm)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [photosProduct, setPhotosProduct] = useState<Product | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['products-admin', { search, page }],
    queryFn: () => adminListProducts({ search, page, page_size: 20 }),
  })

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => getSuppliers(),
  })

  const { data: taxonomyData } = useQuery({
    queryKey: ['product-taxonomy'],
    queryFn: () => listProductTaxonomy(),
  })

  const { data: referenceTaxonomyData } = useQuery({
    queryKey: ['product-taxonomy', 'manager'],
    queryFn: () => listProductTaxonomy({ include_inactive: true }),
    enabled: referenceOpen,
  })

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>()
  const selectedMainCategoryId = watch('main_category_id')
  const selectedSubcategoryId = watch('subcategory_id')
  const selectedProductTypeId = watch('product_type_id')
  const selectedHsCodeRefId = watch('hs_code_ref_id')
  const isAr = i18n.language === 'ar'
  const managerTaxonomyData = referenceTaxonomyData ?? taxonomyData

  const subcategoryOptions = useMemo(
    () => (taxonomyData?.subcategories ?? []).filter((item) => !selectedMainCategoryId || String(item.main_category_id) === selectedMainCategoryId),
    [taxonomyData, selectedMainCategoryId],
  )
  const productTypeOptions = useMemo(
    () => (taxonomyData?.product_types ?? []).filter((item) => !selectedSubcategoryId || String(item.subcategory_id) === selectedSubcategoryId),
    [taxonomyData, selectedSubcategoryId],
  )
  const hsCodeOptions = useMemo(() => {
    const productType = (taxonomyData?.product_types ?? []).find((item) => String(item.id) === selectedProductTypeId)
    const typeHs = productType?.hs_code_ref?.hs_code
    const countryPriority = (a: string) => a === 'Jordan' ? 0 : a === 'Iraq' ? 1 : 2
    return [...(taxonomyData?.hs_codes ?? [])]
      .filter((item) => !typeHs || item.hs_code === typeHs)
      .sort((a, b) => countryPriority(a.country) - countryPriority(b.country) || a.hs_code.localeCompare(b.hs_code))
  }, [taxonomyData, selectedProductTypeId])
  const referenceSubcategoryOptions = useMemo(
    () => (managerTaxonomyData?.subcategories ?? []).filter((item) => !referenceForm.main_category_id || String(item.main_category_id) === referenceForm.main_category_id),
    [managerTaxonomyData, referenceForm.main_category_id],
  )

  function refLabel(item: { name: string; name_ar?: string | null }) {
    return isAr && item.name_ar ? item.name_ar : item.name
  }

  function setRefField<K extends keyof ReferenceForm>(field: K, value: ReferenceForm[K]) {
    setReferenceForm((prev) => ({ ...prev, [field]: value }))
  }

  function switchReferenceTab(tab: ReferenceTab) {
    setReferenceTab(tab)
    setEditingReference(null)
    setReferenceForm({ ...emptyReferenceForm })
  }

  function referenceTabTitle(tab: ReferenceTab) {
    if (tab === 'main') return t('products.main_categories')
    if (tab === 'sub') return t('products.subcategories')
    return t('products.product_types')
  }

  function referenceRows() {
    if (referenceTab === 'main') return managerTaxonomyData?.main_categories ?? []
    if (referenceTab === 'sub') return managerTaxonomyData?.subcategories ?? []
    return managerTaxonomyData?.product_types ?? []
  }

  function referenceRowTitle(item: ReferenceItem) {
    const row = item as ProductMainCategory | ProductSubcategory | ProductTypeReference
    return refLabel(row)
  }

  function referenceRowMeta(item: ReferenceItem) {
    if (referenceTab === 'main') return (item as ProductMainCategory).code
    if (referenceTab === 'sub') {
      const row = item as ProductSubcategory
      const main = managerTaxonomyData?.main_categories.find((m) => m.id === row.main_category_id)
      return `${row.code} · ${main ? refLabel(main) : t('products.main_category')}`
    }
    if (referenceTab === 'type') {
      const row = item as ProductTypeReference
      const sub = managerTaxonomyData?.subcategories.find((s) => s.id === row.subcategory_id)
      return `${row.code} · ${sub ? refLabel(sub) : t('products.subcategory')}${row.hs_code_ref ? ` · HS ${row.hs_code_ref.hs_code}` : ''}`
    }
    return ''
  }

  function startCreateReference() {
    setEditingReference(null)
    setReferenceForm({ ...emptyReferenceForm })
  }

  function startEditReference(item: ReferenceItem) {
    setEditingReference(item)
    if (referenceTab === 'main') {
      const row = item as ProductMainCategory
      setReferenceForm({
        ...emptyReferenceForm,
        code: row.code,
        name: row.name,
        name_ar: row.name_ar ?? '',
        description: row.description ?? '',
        sort_order: String(row.sort_order ?? 0),
        is_active: row.is_active,
      })
      return
    }
    if (referenceTab === 'sub') {
      const row = item as ProductSubcategory
      setReferenceForm({
        ...emptyReferenceForm,
        main_category_id: String(row.main_category_id),
        code: row.code,
        name: row.name,
        name_ar: row.name_ar ?? '',
        description: row.description ?? '',
        sort_order: String(row.sort_order ?? 0),
        is_active: row.is_active,
      })
      return
    }
    if (referenceTab === 'type') {
      const row = item as ProductTypeReference
      setReferenceForm({
        ...emptyReferenceForm,
        main_category_id: String(row.main_category_id),
        subcategory_id: String(row.subcategory_id),
        hs_code_ref_id: row.hs_code_ref_id ? String(row.hs_code_ref_id) : '',
        code: row.code,
        name: row.name,
        name_ar: row.name_ar ?? '',
        description: row.description ?? '',
        sort_order: String(row.sort_order ?? 0),
        is_active: row.is_active,
      })
      return
    }
  }

  function numberOrNull(value: string) {
    return value === '' ? null : Number(value)
  }

  function buildReferencePayload() {
    if (referenceTab === 'main') {
      return {
        code: referenceForm.code.trim(),
        name: referenceForm.name.trim(),
        name_ar: referenceForm.name_ar || null,
        description: referenceForm.description || null,
        sort_order: Number(referenceForm.sort_order || 0),
        is_active: referenceForm.is_active,
      }
    }
    if (referenceTab === 'sub') {
      return {
        main_category_id: Number(referenceForm.main_category_id),
        code: referenceForm.code.trim(),
        name: referenceForm.name.trim(),
        name_ar: referenceForm.name_ar || null,
        description: referenceForm.description || null,
        sort_order: Number(referenceForm.sort_order || 0),
        is_active: referenceForm.is_active,
      }
    }
    if (referenceTab === 'type') {
      return {
        main_category_id: Number(referenceForm.main_category_id),
        subcategory_id: Number(referenceForm.subcategory_id),
        hs_code_ref_id: numberOrNull(referenceForm.hs_code_ref_id),
        code: referenceForm.code.trim(),
        name: referenceForm.name.trim(),
        name_ar: referenceForm.name_ar || null,
        description: referenceForm.description || null,
        sort_order: Number(referenceForm.sort_order || 0),
        is_active: referenceForm.is_active,
      }
    }
    return {}
  }

  function applyHsRef(id: string) {
    setValue('hs_code_ref_id', id)
  }

  function applyProductType(id: string) {
    setValue('product_type_id', id)
    const productType = (taxonomyData?.product_types ?? []).find((item) => String(item.id) === id)
    if (!productType) return
    setValue('main_category_id', String(productType.main_category_id))
    setValue('subcategory_id', String(productType.subcategory_id))
    const mainCategory = (taxonomyData?.main_categories ?? []).find((item) => item.id === productType.main_category_id)
    if (mainCategory) setValue('category', mainCategory.name)
    if (productType.hs_code_ref_id) applyHsRef(String(productType.hs_code_ref_id))
  }

  function changeMainCategory(id: string) {
    setValue('main_category_id', id)
    setValue('subcategory_id', '')
    setValue('product_type_id', '')
    setValue('hs_code_ref_id', '')
    const mainCategory = (taxonomyData?.main_categories ?? []).find((item) => String(item.id) === id)
    setValue('category', mainCategory?.name ?? '')
  }

  function changeSubcategory(id: string) {
    setValue('subcategory_id', id)
    setValue('product_type_id', '')
    setValue('hs_code_ref_id', '')
  }

  const saveMut = useMutation({
    mutationFn: (v: FormValues) => {
      const payload = {
        code: v.code,
        name: v.name,
        name_ar: v.name_ar || null,
        category: v.category || null,
        description: v.description || null,
        description_ar: v.description_ar || null,
        supplier_id: v.supplier_id ? Number(v.supplier_id) : null,
        main_category_id: v.main_category_id ? Number(v.main_category_id) : null,
        subcategory_id: v.subcategory_id ? Number(v.subcategory_id) : null,
        product_type_id: v.product_type_id ? Number(v.product_type_id) : null,
        hs_code_ref_id: v.hs_code_ref_id ? Number(v.hs_code_ref_id) : null,
        price_cny: v.price_cny,
        price_usd: v.price_usd || null,
        pcs_per_carton: Number(v.pcs_per_carton),
        cbm_per_carton: v.cbm_per_carton,
        min_order_cartons: Number(v.min_order_cartons),
        gross_weight_kg_per_carton: v.gross_weight_kg_per_carton || null,
        net_weight_kg_per_carton: v.net_weight_kg_per_carton || null,
        carton_length_cm: v.carton_length_cm || null,
        carton_width_cm: v.carton_width_cm || null,
        carton_height_cm: v.carton_height_cm || null,
        is_featured: v.is_featured,
        is_active: v.is_active,
      }
      return editing ? updateProduct(editing.id, payload) : createProduct(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products-admin'] })
      setModalOpen(false)
      setEditing(null)
      reset()
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products-admin'] })
      setDeleting(null)
    },
  })

  const saveReferenceMut = useMutation({
    mutationFn: (): Promise<ReferenceItem> => {
      const payload = buildReferencePayload()
      const id = editingReference?.id
      if (referenceTab === 'main') {
        return id ? updateProductMainCategory(id, payload) : createProductMainCategory(payload)
      }
      if (referenceTab === 'sub') {
        return id ? updateProductSubcategory(id, payload) : createProductSubcategory(payload)
      }
      if (referenceTab === 'type') {
        return id ? updateProductTypeReference(id, payload) : createProductTypeReference(payload)
      }
      return Promise.reject(new Error('Unsupported reference tab'))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-taxonomy'] })
      qc.invalidateQueries({ queryKey: ['products-admin'] })
      startCreateReference()
    },
  })

  const uploadMut = useMutation({
    mutationFn: ({ productId, file }: { productId: number; file: File }) =>
      uploadProductPhoto(productId, file),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['products-admin'] })
      setPhotosProduct(updated)
    },
  })

  const deletePhotoMut = useMutation({
    mutationFn: ({ productId, photoId }: { productId: number; photoId: number }) =>
      deleteProductPhoto(productId, photoId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['products-admin'] })
      setPhotosProduct((prev) =>
        prev ? { ...prev, photos: prev.photos.filter((p) => p.id !== vars.photoId) } : null
      )
    },
  })

  function openCreate() {
    setEditing(null)
    reset({
      code: '', name: '', name_ar: '', category: '',
      description: '', description_ar: '', supplier_id: '',
      main_category_id: '', subcategory_id: '', product_type_id: '', hs_code_ref_id: '',
      price_usd: '',
      price_cny: '', pcs_per_carton: '250', cbm_per_carton: '0.20',
      gross_weight_kg_per_carton: '', net_weight_kg_per_carton: '',
      carton_length_cm: '', carton_width_cm: '', carton_height_cm: '',
      min_order_cartons: '1', is_featured: false, is_active: true,
    })
    setModalOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    reset({
      code: p.code, name: p.name, name_ar: p.name_ar ?? '',
      category: p.category ?? '', description: p.description ?? '',
      description_ar: p.description_ar ?? '',
      supplier_id: p.supplier?.id ? String(p.supplier.id) : '',
      main_category_id: p.main_category_id ? String(p.main_category_id) : '',
      subcategory_id: p.subcategory_id ? String(p.subcategory_id) : '',
      product_type_id: p.product_type_id ? String(p.product_type_id) : '',
      hs_code_ref_id: p.hs_code_ref_id ? String(p.hs_code_ref_id) : '',
      price_usd: p.price_usd ?? '',
      price_cny: p.price_cny, pcs_per_carton: String(p.pcs_per_carton),
      cbm_per_carton: p.cbm_per_carton, min_order_cartons: String(p.min_order_cartons),
      gross_weight_kg_per_carton: p.gross_weight_kg_per_carton ?? '',
      net_weight_kg_per_carton: p.net_weight_kg_per_carton ?? '',
      carton_length_cm: p.carton_length_cm ?? '',
      carton_width_cm: p.carton_width_cm ?? '',
      carton_height_cm: p.carton_height_cm ?? '',
      is_featured: p.is_featured, is_active: p.is_active,
    })
    setModalOpen(true)
  }

  const PAGE_SIZE = 20
  const columns = [
    {
      key: 'name',
      label: t('common.name'),
      render: (p: Product) => {
        const mainPhoto = p.photos.find((ph) => ph.is_main) ?? p.photos[0]
        return (
          <div className="flex items-center gap-3">
            {mainPhoto ? (
              <img
                src={`/api/v1/products/${p.id}/photos/${mainPhoto.id}`}
                alt={p.name}
                className="w-10 h-10 rounded-lg object-cover bg-white/5 flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <Package size={16} className="text-gray-500" />
              </div>
            )}
            <div>
              <p className="text-sm text-white font-medium">{p.name}</p>
              {p.name_ar && <p className="text-xs text-gray-500 font-arabic">{p.name_ar}</p>}
              {(p.main_category || p.product_type || p.category) && (
                <p className="text-[11px] text-gray-500">
                  {p.main_category ? refLabel(p.main_category) : p.category}
                  {p.product_type ? ` · ${refLabel(p.product_type)}` : ''}
                </p>
              )}
              {p.hs_code_ref && <p className="text-[11px] text-brand-primary-light font-mono">HS {p.hs_code_ref.hs_code}</p>}
            </div>
          </div>
        )
      },
    },
    {
      key: 'code',
      label: t('products.code'),
      render: (p: Product) => (
        <span className="text-xs font-mono bg-white/5 px-2 py-0.5 rounded">{p.code}</span>
      ),
    },
    {
      key: 'supplier',
      label: t('products.supplier'),
      render: (p: Product) => (
        <span className="text-sm text-gray-400">{p.supplier?.name ?? '—'}</span>
      ),
    },
    {
      key: 'price',
      label: t('products.price_cny'),
      render: (p: Product) => (
        <div className="leading-tight">
          <span className="text-sm text-yellow-400 font-medium">¥{Number(p.price_cny).toFixed(2)}</span>
          {p.price_usd && <p className="text-xs text-brand-green">${Number(p.price_usd).toFixed(2)}</p>}
        </div>
      ),
    },
    {
      key: 'hs_ref',
      label: t('products.hs_code_reference'),
      render: (p: Product) => (
        <div className="leading-tight text-xs text-gray-400">
          <p>{p.hs_code_ref ? `${p.hs_code_ref.country} · ${p.hs_code_ref.hs_code}` : '—'}</p>
          {p.hs_code_ref && <p className="text-brand-text-muted">{isAr && p.hs_code_ref.description_ar ? p.hs_code_ref.description_ar : p.hs_code_ref.description}</p>}
        </div>
      ),
    },
    {
      key: 'carton',
      label: t('products.pcs_per_carton'),
      render: (p: Product) => (
        <span className="text-xs text-gray-400">{p.pcs_per_carton} pcs / {p.cbm_per_carton} CBM</span>
      ),
    },
    {
      key: 'status',
      label: t('common.status'),
      render: (p: Product) => (
        <div className="flex gap-1">
          {p.is_featured && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/10 text-yellow-400">
              ★ Featured
            </span>
          )}
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            p.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {p.is_active ? t('common.active') : t('common.inactive')}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-28',
      render: (p: Product) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPhotosProduct(p)}
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            title="Photos"
          >
            <ImagePlus size={14} />
          </button>
          <button
            onClick={() => openEdit(p)}
            className="p-1.5 rounded hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <Pencil size={14} />
          </button>
          {isAdmin && (
            <button
              onClick={() => setDeleting(p)}
              className="p-1.5 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('products.title')}</h1>
          {data && <p className="text-sm text-gray-400 mt-0.5">{data.total} {t('common.results')}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setReferenceOpen(true)}>
            <Database size={16} />
            {t('products.reference_data')}
          </Button>
          <Button onClick={openCreate}>
            <Plus size={16} />
            {t('products.add')}
          </Button>
        </div>
      </div>

      <div className="relative w-full sm:max-w-xs">
        <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder={t('common.search')}
          className="input-base ps-9 w-full"
        />
      </div>

      <Table
        columns={columns}
        data={data?.results ?? []}
        total={data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        loading={isLoading}
        onPageChange={setPage}
        rowKey={(p) => p.id}
      />

      <Modal
        open={referenceOpen}
        onClose={() => setReferenceOpen(false)}
        title={t('products.reference_data')}
        size="xl"
      >
        <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
          <div className="space-y-2">
            {(['main', 'sub', 'type'] as ReferenceTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => switchReferenceTab(tab)}
                className={`w-full text-start rounded-lg px-3 py-2 text-sm transition-colors ${
                  referenceTab === tab
                    ? 'bg-brand-primary/20 text-brand-primary-light border border-brand-primary/50'
                    : 'bg-white/5 text-brand-text-muted border border-brand-border hover:text-brand-text'
                }`}
              >
                {referenceTabTitle(tab)}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {saveReferenceMut.isError && (
              <div className="px-3 py-2 rounded-lg bg-brand-red/10 border border-brand-red/30 text-xs text-brand-red">
                {(saveReferenceMut.error as any)?.response?.data?.detail ?? t('common.required')}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveReferenceMut.mutate()
              }}
              className="space-y-4 rounded-xl border border-brand-border bg-white/[0.02] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-brand-text">
                    {editingReference ? t('products.update_reference') : t('products.add_reference')}
                  </h3>
                  <p className="text-xs text-brand-text-muted">{referenceTabTitle(referenceTab)}</p>
                </div>
                {editingReference && (
                  <Button type="button" variant="ghost" size="sm" onClick={startCreateReference}>
                    <Plus size={14} />
                    {t('common.add')}
                  </Button>
                )}
              </div>

              {referenceTab !== 'main' && (
                <div className="space-y-1.5">
                  <label className="label-base">{t('products.main_category')}</label>
                  <select
                    required
                    className="input-base w-full"
                    value={referenceForm.main_category_id}
                    onChange={(e) => {
                      setRefField('main_category_id', e.target.value)
                      if (referenceTab === 'type') setRefField('subcategory_id', '')
                    }}
                  >
                    <option value="">—</option>
                    {(managerTaxonomyData?.main_categories ?? []).map((item) => (
                      <option key={item.id} value={item.id}>{refLabel(item)}</option>
                    ))}
                  </select>
                </div>
              )}

              {referenceTab === 'type' && (
                <FormRow>
                  <div className="space-y-1.5">
                    <label className="label-base">{t('products.subcategory')}</label>
                    <select
                      required
                      className="input-base w-full"
                      value={referenceForm.subcategory_id}
                      onChange={(e) => setRefField('subcategory_id', e.target.value)}
                    >
                      <option value="">—</option>
                      {referenceSubcategoryOptions.map((item) => (
                        <option key={item.id} value={item.id}>{refLabel(item)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="label-base">{t('products.hs_code_reference')}</label>
                    <select
                      className="input-base w-full"
                      value={referenceForm.hs_code_ref_id}
                      onChange={(e) => setRefField('hs_code_ref_id', e.target.value)}
                    >
                      <option value="">—</option>
                      {(managerTaxonomyData?.hs_codes ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.country} · {item.hs_code} · {isAr && item.description_ar ? item.description_ar : item.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </FormRow>
              )}

              <FormRow>
                <Input
                  label={t('products.reference_code')}
                  required
                  value={referenceForm.code}
                  onChange={(e) => setRefField('code', e.target.value)}
                />
                <Input
                  label={t('common.name')}
                  required
                  value={referenceForm.name}
                  onChange={(e) => setRefField('name', e.target.value)}
                />
              </FormRow>
              <FormRow>
                <Input
                  label={t('common.arabic')}
                  value={referenceForm.name_ar}
                  onChange={(e) => setRefField('name_ar', e.target.value)}
                />
                <Input
                  label={t('products.sort_order')}
                  type="number"
                  value={referenceForm.sort_order}
                  onChange={(e) => setRefField('sort_order', e.target.value)}
                />
              </FormRow>
              <Input
                label={t('products.description')}
                value={referenceForm.description}
                onChange={(e) => setRefField('description', e.target.value)}
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={referenceForm.is_active}
                      onChange={(e) => setRefField('is_active', e.target.checked)}
                    />
                    <span className="text-sm text-gray-300">{t('common.active')}</span>
                  </label>
                </div>
                <Button type="submit" loading={saveReferenceMut.isPending}>
                  <Save size={15} />
                  {editingReference ? t('common.update') : t('common.save')}
                </Button>
              </div>
            </form>

            <div className="space-y-2">
              {(referenceRows() as ReferenceItem[]).map((item) => (
                <div
                  key={`${referenceTab}-${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-brand-border bg-white/[0.02] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-text">{referenceRowTitle(item)}</p>
                    <p className="truncate text-xs text-brand-text-muted">{referenceRowMeta(item)}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => startEditReference(item)}>
                    <Pencil size={14} />
                    {t('common.edit')}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Create / Edit */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        title={editing ? t('products.edit') : t('products.add')}
        size="xl"
      >
        <form onSubmit={handleSubmit((v) => saveMut.mutate(v))} className="space-y-5">
          {saveMut.isError && (
            <div className="px-3 py-2 rounded-lg bg-brand-red/10 border border-brand-red/30 text-xs text-brand-red">
              {(saveMut.error as any)?.response?.data?.detail ?? t('common.required')}
            </div>
          )}
          <input type="hidden" {...register('main_category_id')} />
          <input type="hidden" {...register('subcategory_id')} />
          <input type="hidden" {...register('product_type_id')} />
          <input type="hidden" {...register('hs_code_ref_id')} />

          <FormSection title={t('agents.basic_info')}>
            <FormRow>
              <Input
                label={t('products.code')}
                placeholder="SH-001"
                {...register('code', { required: true })}
                error={errors.code ? t('common.required') : undefined}
              />
              <div className="space-y-1.5">
                <label className="label-base">{t('products.supplier')}</label>
                <select className="input-base w-full" {...register('supplier_id')}>
                  <option value="">— None —</option>
                  {suppliersData?.results.map((s) => (
                    <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                  ))}
                </select>
              </div>
            </FormRow>
            <FormRow>
              <Input
                label={t('common.name')}
                {...register('name', { required: true })}
                error={errors.name ? t('common.required') : undefined}
              />
              <Input label="Arabic Name" {...register('name_ar')} />
            </FormRow>
          </FormSection>

          <FormSection title={t('products.reference_tree')}>
            <FormRow>
              <div className="space-y-1.5">
                <label className="label-base">{t('products.main_category')}</label>
                <select className="input-base w-full" value={selectedMainCategoryId || ''} onChange={(e) => changeMainCategory(e.target.value)}>
                  <option value="">—</option>
                  {(taxonomyData?.main_categories ?? []).map((item) => (
                    <option key={item.id} value={item.id}>{refLabel(item)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="label-base">{t('products.subcategory')}</label>
                <select className="input-base w-full" value={selectedSubcategoryId || ''} onChange={(e) => changeSubcategory(e.target.value)}>
                  <option value="">—</option>
                  {subcategoryOptions.map((item) => (
                    <option key={item.id} value={item.id}>{refLabel(item)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="label-base">{t('products.product_type')}</label>
                <select className="input-base w-full" value={selectedProductTypeId || ''} onChange={(e) => applyProductType(e.target.value)}>
                  <option value="">—</option>
                  {productTypeOptions.map((item) => (
                    <option key={item.id} value={item.id}>{refLabel(item)}</option>
                  ))}
                </select>
              </div>
            </FormRow>
            <FormRow>
              <div className="space-y-1.5">
                <label className="label-base">{t('products.hs_code_reference')}</label>
                <select className="input-base w-full" value={selectedHsCodeRefId || ''} onChange={(e) => applyHsRef(e.target.value)}>
                  <option value="">—</option>
                  {hsCodeOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.country} · {item.hs_code} · {isAr && item.description_ar ? item.description_ar : item.description}
                    </option>
                  ))}
                </select>
              </div>
              <Input label={t('products.category')} placeholder="Legacy category text" {...register('category')} />
            </FormRow>
          </FormSection>

          <FormSection title={t('products.price_cny')}>
            <FormRow>
              <Input
                label={t('products.price_cny')}
                type="number"
                step="0.01"
                {...register('price_cny', { required: true })}
                error={errors.price_cny ? t('common.required') : undefined}
              />
              <Input
                label={t('products.price_usd')}
                type="number"
                step="0.0001"
                {...register('price_usd')}
              />
              <Input
                label={t('products.pcs_per_carton')}
                type="number"
                {...register('pcs_per_carton', { required: true })}
              />
              <Input
                label={t('products.cbm_per_carton')}
                type="number"
                step="0.001"
                {...register('cbm_per_carton', { required: true })}
              />
            </FormRow>
            <FormRow>
              <Input
                label={t('products.min_order')}
                type="number"
                {...register('min_order_cartons', { required: true })}
              />
            </FormRow>
          </FormSection>

          <FormSection title={t('products.packing_defaults')}>
            <FormRow>
              <Input
                label={t('products.gross_weight_kg_per_carton')}
                type="number"
                step="0.001"
                {...register('gross_weight_kg_per_carton')}
              />
              <Input
                label={t('products.net_weight_kg_per_carton')}
                type="number"
                step="0.001"
                {...register('net_weight_kg_per_carton')}
              />
              <Input
                label={t('products.carton_length_cm')}
                type="number"
                step="0.01"
                {...register('carton_length_cm')}
              />
            </FormRow>
            <FormRow>
              <Input
                label={t('products.carton_width_cm')}
                type="number"
                step="0.01"
                {...register('carton_width_cm')}
              />
              <Input
                label={t('products.carton_height_cm')}
                type="number"
                step="0.01"
                {...register('carton_height_cm')}
              />
            </FormRow>
          </FormSection>

          <FormSection title={t('products.description')}>
            <Input label="Description (EN)" {...register('description')} />
            <Input label="Description (AR)" {...register('description_ar')} />
          </FormSection>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded" {...register('is_featured')} />
              <span className="text-sm text-gray-300">{t('products.featured')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded" {...register('is_active')} />
              <span className="text-sm text-gray-300">{t('common.active')}</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); setEditing(null) }}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={saveMut.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Photos modal */}
      {photosProduct && (
        <Modal
          open={!!photosProduct}
          onClose={() => setPhotosProduct(null)}
          title={`${t('products.photos')} — ${photosProduct.name}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {photosProduct.photos.map((ph) => (
                <div key={ph.id} className="relative group rounded-lg overflow-hidden bg-white/5 aspect-square">
                  <img
                    src={`/uploads/products/${ph.file_path.split('/').pop()}`}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '' }}
                  />
                  {ph.is_main && (
                    <span className="absolute top-1 start-1 text-[10px] bg-yellow-500 text-black px-1.5 py-0.5 rounded font-bold">
                      MAIN
                    </span>
                  )}
                  <button
                    onClick={() => deletePhotoMut.mutate({ productId: photosProduct.id, photoId: ph.id })}
                    className="absolute top-1 end-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadMut.mutate({ productId: photosProduct.id, file })
                if (photoInputRef.current) photoInputRef.current.value = ''
              }}
            />
            <Button
              onClick={() => photoInputRef.current?.click()}
              loading={uploadMut.isPending}
              variant="secondary"
            >
              <ImagePlus size={16} />
              {t('products.upload_photo')}
            </Button>
          </div>
        </Modal>
      )}

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={t('common.confirm_delete')} size="sm">
        <p className="text-sm text-gray-300 mb-5">
          {t('products.delete_confirm', { name: deleting?.name })}
        </p>
        <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-5">
          {t('products.delete_warning')}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
          <Button
            variant="danger"
            loading={deleteMut.isPending}
            onClick={() => deleting && deleteMut.mutate(deleting.id)}
          >
            {t('common.delete')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
