import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, ImagePlus, X, Package } from 'lucide-react'
import {
  adminListProducts, createProduct, updateProduct, deleteProduct,
  uploadProductPhoto, deleteProductPhoto,
} from '@/services/productService'
import { getSuppliers } from '@/services/supplierService'
import { useAuth } from '@/hooks/useAuth'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, FormRow, FormSection } from '@/components/ui/Form'
import { useForm } from 'react-hook-form'
import type { Product } from '@/types'

interface FormValues {
  code: string
  name: string
  name_ar: string
  category: string
  description: string
  description_ar: string
  supplier_id: string
  price_cny: string
  pcs_per_carton: string
  cbm_per_carton: string
  min_order_cartons: string
  is_featured: boolean
  is_active: boolean
}

export default function ProductsPage() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
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

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>()

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
        price_cny: v.price_cny,
        pcs_per_carton: Number(v.pcs_per_carton),
        cbm_per_carton: v.cbm_per_carton,
        min_order_cartons: Number(v.min_order_cartons),
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
      price_cny: '', pcs_per_carton: '250', cbm_per_carton: '0.20',
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
      price_cny: p.price_cny, pcs_per_carton: String(p.pcs_per_carton),
      cbm_per_carton: p.cbm_per_carton, min_order_cartons: String(p.min_order_cartons),
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
        <span className="text-sm text-yellow-400 font-medium">¥{Number(p.price_cny).toFixed(2)}</span>
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
        <Button onClick={openCreate}>
          <Plus size={16} />
          {t('products.add')}
        </Button>
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
            <FormRow>
              <Input label={t('products.category')} placeholder="T-Shirts, Jeans..." {...register('category')} />
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
