import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Search, Filter, Package } from 'lucide-react'
import { listProducts, listCategories } from '@/services/productService'
import ShopLayout from '@/components/layout/ShopLayout'
import type { Product } from '@/types'

function ProductCard({ product }: { product: Product }) {
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const mainPhoto = product.photos.find((p) => p.is_main) ?? product.photos[0]

  return (
    <Link
      to={`/shop/product/${product.id}`}
      className="group rounded-2xl border border-white/10 bg-white/[0.03] hover:border-brand-primary/30 hover:bg-white/[0.06] transition-all duration-200 overflow-hidden"
    >
      <div className="aspect-square bg-white/5 overflow-hidden">
        {mainPhoto ? (
          <img
            src={`/uploads/products/${mainPhoto.file_path.split('/').pop()}`}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              const el = e.target as HTMLImageElement
              el.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="text-gray-600"><rect x="2" y="2" width="20" height="20" rx="3"/><path d="m8 10 4 4 4-4"/></svg></div>'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={40} className="text-gray-600" />
          </div>
        )}
      </div>
      <div className="p-3">
        {product.is_featured && (
          <span className="inline-block text-[10px] font-bold bg-yellow-500/15 text-yellow-400 px-1.5 py-0.5 rounded mb-1.5">
            ★ Featured
          </span>
        )}
        <p className="text-sm font-medium text-white group-hover:text-brand-primary-light transition-colors line-clamp-2">
          {isAr && product.name_ar ? product.name_ar : product.name}
        </p>
        {product.supplier && (
          <p className="text-[11px] text-gray-500 mt-0.5">{product.supplier.code}</p>
        )}
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-base font-bold text-yellow-400">¥{Number(product.price_cny).toFixed(2)}</span>
          <span className="text-xs text-gray-500">/ {product.pcs_per_carton} pcs</span>
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {product.cbm_per_carton} CBM/ctn · min {product.min_order_cartons} ctn
        </p>
      </div>
    </Link>
  )
}

export default function ShopPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const PAGE_SIZE = 24

  const { data, isLoading } = useQuery({
    queryKey: ['shop-products', { search, category, page, featuredOnly }],
    queryFn: () => listProducts({ search, category, page, page_size: PAGE_SIZE, featured_only: featuredOnly }),
  })

  const { data: categories } = useQuery({
    queryKey: ['product-categories'],
    queryFn: listCategories,
    staleTime: 5 * 60 * 1000,
  })

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE)

  return (
    <ShopLayout>
      <div className="space-y-6">
        {/* Hero */}
        <div className="text-center py-8">
          <h1 className="text-3xl font-bold text-white mb-2">{t('shop.browse')}</h1>
          <p className="text-gray-400">Direct from China wholesale market</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder={t('common.search')}
              className="input-base ps-9 w-full"
            />
          </div>
          {categories && categories.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-gray-400" />
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1) }}
                className="input-base"
              >
                <option value="">{t('common.all')}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={featuredOnly}
              onChange={(e) => { setFeaturedOnly(e.target.checked); setPage(1) }}
              className="rounded"
            />
            Featured only
          </label>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse">
                <div className="aspect-square bg-white/5" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-white/10 rounded w-3/4" />
                  <div className="h-4 bg-white/10 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : data?.results.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Package size={48} className="mx-auto mb-3 opacity-30" />
            <p>{t('common.no_data')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {data?.results.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-4">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-lg text-sm bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t('common.prev')}
            </button>
            <span className="px-4 py-2 text-sm text-gray-400">
              {page} {t('common.of')} {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-lg text-sm bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t('common.next')}
            </button>
          </div>
        )}
      </div>
    </ShopLayout>
  )
}
