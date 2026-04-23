import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Package } from 'lucide-react'
import type { Product } from '@/types'

export default function ProductCard({ product }: { product: Product }) {
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const mainPhoto = product.photos.find((p) => p.is_main) ?? product.photos[0]

  return (
    <Link
      to={`/shop/product/${product.id}`}
      className="group rounded-2xl border border-white/10 bg-white/[0.03] hover:border-brand-primary/30 hover:bg-white/[0.06] transition-all duration-200 overflow-hidden flex flex-col"
    >
      <div className="aspect-square bg-white/5 overflow-hidden flex-shrink-0">
        {mainPhoto ? (
          <img
            src={`/uploads/products/${mainPhoto.file_path.split('/').pop()}`}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              const el = e.target as HTMLImageElement
              el.style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={40} className="text-gray-600" />
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1">
        {product.is_featured && (
          <span className="inline-block text-[10px] font-bold bg-yellow-500/15 text-yellow-400 px-1.5 py-0.5 rounded mb-1.5 self-start">
            ★ Featured
          </span>
        )}
        <p className="text-sm font-medium text-white group-hover:text-brand-primary-light transition-colors line-clamp-2 flex-1">
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
