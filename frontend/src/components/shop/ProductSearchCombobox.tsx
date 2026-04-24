import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { listProducts } from '@/services/productService'
import type { Product } from '@/types'

interface Props {
  value: string
  onChange: (value: string) => void
  category?: string
  isAr: boolean
}

export default function ProductSearchCombobox({ value, onChange, category, isAr }: Props) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // Fetch suggestions (debounced 300ms)
  useEffect(() => {
    if (!open) return
    clearTimeout(timerRef.current)
    setLoading(true)
    timerRef.current = setTimeout(async () => {
      try {
        const res = await listProducts({
          search: value,
          category: category || undefined,
          page_size: 12,
          page: 1,
        })
        setSuggestions(res.results)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => clearTimeout(timerRef.current)
  }, [value, category, open])

  function select(product: Product) {
    onChange(product.code)
    setOpen(false)
  }

  function clear() {
    onChange('')
    setOpen(false)
  }

  const placeholder = isAr
    ? 'ابحث بالكود أو الاسم بالعربي أو الإنجليزي…'
    : 'Search by code, Arabic or English name…'

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input */}
      <div className="relative">
        <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          placeholder={placeholder}
          className="input-base ps-9 pe-8 w-full"
        />
        {value && (
          <button
            onClick={clear}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-1.5 inset-x-0 z-50 rounded-xl border border-white/10 shadow-2xl overflow-hidden"
          style={{ background: '#0d1629', maxHeight: '320px', overflowY: 'auto' }}>

          {/* Header hint */}
          <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">
              {isAr
                ? (category ? `داخل ${category}` : 'كل المنتجات')
                : (category ? `In ${category}` : 'All products')}
            </span>
            {loading && (
              <span className="text-[10px] text-gray-500">{isAr ? 'جاري البحث…' : 'Searching…'}</span>
            )}
          </div>

          {!loading && suggestions.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-gray-500">
              {isAr ? 'لا توجد نتائج' : 'No results found'}
            </div>
          ) : (
            suggestions.map((p) => {
              const mainPhoto = p.photos?.find((ph) => ph.is_main) ?? p.photos?.[0]
              return (
                <button
                  key={p.id}
                  onMouseDown={(e) => { e.preventDefault(); select(p) }}
                  className="w-full text-start px-3 py-2.5 hover:bg-white/5 transition-colors flex items-center gap-3 border-b border-white/[0.04] last:border-0"
                >
                  {/* Thumbnail */}
                  <div className="w-9 h-9 rounded-lg bg-white/5 overflow-hidden flex-shrink-0">
                    {mainPhoto ? (
                      <img
                        src={`/uploads/products/${mainPhoto.file_path.split('/').pop()}`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-mono text-brand-primary-light leading-tight">{p.code}</p>
                    <p className="text-xs text-white truncate leading-snug">
                      {isAr && p.name_ar ? p.name_ar : p.name}
                    </p>
                    {p.name_ar && p.name && (
                      <p className="text-[10px] text-gray-500 truncate leading-tight">
                        {isAr ? p.name : p.name_ar}
                      </p>
                    )}
                  </div>

                  {/* Category badge */}
                  {p.category && (
                    <span className="text-[10px] text-gray-600 flex-shrink-0 hidden sm:block">
                      {p.category}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
