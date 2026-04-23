import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import ProductCard from './ProductCard'
import type { Product } from '@/types'

interface Props {
  title: string
  badge?: string
  products: Product[]
  viewAllLink?: string
  viewAllLabel?: string
  loading?: boolean
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse flex-shrink-0 w-44">
      <div className="aspect-square bg-white/5 rounded-t-2xl" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-white/10 rounded w-3/4" />
        <div className="h-4 bg-white/10 rounded w-1/2" />
      </div>
    </div>
  )
}

export default function ProductStrip({ title, badge, products, viewAllLink, viewAllLabel, loading }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {badge && (
            <span className="text-lg">{badge}</span>
          )}
          <h2 className="text-lg font-bold text-white">{title}</h2>
        </div>
        {viewAllLink && (
          <Link
            to={viewAllLink}
            className="flex items-center gap-1 text-sm text-brand-primary-light hover:text-white transition-colors"
          >
            {viewAllLabel ?? 'View All'}
            <ArrowRight size={14} />
          </Link>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1 no-scrollbar
                      sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 sm:overflow-visible sm:pb-0">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : products.map((p) => (
              <div key={p.id} className="flex-shrink-0 w-44 sm:w-auto">
                <ProductCard product={p} />
              </div>
            ))
        }
      </div>
    </section>
  )
}
