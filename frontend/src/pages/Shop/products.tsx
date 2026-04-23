import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Search, Filter, Package } from 'lucide-react'
import { listProducts, listCategories } from '@/services/productService'
import ShopLayout from '@/components/layout/ShopLayout'
import ProductCard from '@/components/shop/ProductCard'

export default function ShopProducts() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const [searchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [featuredOnly, setFeaturedOnly] = useState(searchParams.get('featured') === '1')
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
        <div>
          <h1 className="text-2xl font-bold text-white">{isAr ? 'المنتجات' : 'Products'}</h1>
          {data && (
            <p className="text-sm text-gray-400 mt-1">
              {data.total} {isAr ? 'منتج' : 'products'}
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
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
                <option value="">{isAr ? 'الكل' : 'All categories'}</option>
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
            {isAr ? 'المميزة فقط' : 'Featured only'}
          </label>
        </div>

        {/* Category chips */}
        {categories && categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => { setCategory(''); setPage(1) }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !category
                  ? 'bg-brand-primary text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
              }`}
            >
              {isAr ? 'الكل' : 'All'}
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => { setCategory(c); setPage(1) }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  category === c
                    ? 'bg-brand-primary text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse">
                <div className="aspect-square bg-white/5 rounded-t-2xl" />
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
