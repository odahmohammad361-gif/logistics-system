import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Package, Calculator, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react'
import { getProduct } from '@/services/productService'
import { calculateShipping, createShopOrder } from '@/services/shopService'
import ShopLayout from '@/components/layout/ShopLayout'
import { useShopCurrency } from '@/hooks/useShopCurrency'
import { useShopStore } from '@/store/shopStore'
import type { ShippingOption, ShopOrder } from '@/types'

function ShippingCalculator({ cbmPerCarton, pcsPerCarton }: { cbmPerCarton: number; pcsPerCarton: number }) {
  const { t } = useTranslation()
  const [cartons, setCartons] = useState(1)
  const [destination, setDestination] = useState<'jordan' | 'iraq'>('jordan')
  const [result, setResult] = useState<{ options: ShippingOption[]; usd_to_cny_rate: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalCbm = cartons * cbmPerCarton
  const totalPcs = cartons * pcsPerCarton

  async function handleCalculate() {
    setError('')
    setLoading(true)
    try {
      const res = await calculateShipping(totalCbm, destination)
      setResult(res)
    } catch {
      setError('Could not calculate. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator size={16} className="text-brand-primary-light" />
        <h3 className="font-semibold text-white">{t('shop.calculator')}</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="label-base">{t('shop.cartons')}</label>
          <input
            type="number"
            min={1}
            value={cartons}
            onChange={(e) => setCartons(Math.max(1, Number(e.target.value)))}
            className="input-base w-full"
          />
          <p className="text-xs text-gray-500">{totalPcs.toLocaleString()} pcs · {totalCbm.toFixed(3)} CBM</p>
        </div>
        <div className="space-y-1.5">
          <label className="label-base">{t('shop.destination')}</label>
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value as 'jordan' | 'iraq')}
            className="input-base w-full"
          >
            <option value="jordan">{t('shop.jordan')}</option>
            <option value="iraq">{t('shop.iraq')}</option>
          </select>
        </div>
      </div>

      <button
        onClick={handleCalculate}
        disabled={loading}
        className="w-full py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-60 transition-colors"
      >
        {loading ? t('common.loading') : t('shop.calculate')}
      </button>

      {error && <p className="text-xs text-brand-red">{error}</p>}

      {result && (
        <div className="space-y-3 pt-2">
          <p className="text-xs text-gray-500">Rate: 1 USD = ¥{result.usd_to_cny_rate}</p>
          {result.options.map((opt) => (
            <div key={opt.container_type}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">{opt.container_type}</span>
                <span className="text-xs text-gray-500">{opt.capacity_cbm} CBM capacity</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">{t('shop.containers_needed')}</span>
                  <span className="text-white font-medium">{opt.containers_needed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fill</span>
                  <span className="text-white font-medium">{opt.cbm_used_percent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{t('shop.freight')}</span>
                  <span className="text-white font-medium">${opt.total_freight_usd}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{t('shop.clearance')}</span>
                  <span className="text-white font-medium">${opt.clearance_fees_usd}</span>
                </div>
              </div>
              <div className="border-t border-white/10 pt-2 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">{t('shop.total_cost')}</p>
                  <p className="text-lg font-bold text-emerald-400">${opt.total_cost_usd}</p>
                </div>
                <div className="text-end">
                  <p className="text-xs text-gray-400">{t('shop.cost_per_cbm')}</p>
                  <p className="text-sm font-semibold text-white">${opt.cost_per_cbm_usd}/CBM</p>
                </div>
              </div>
              {(opt.agent_name || opt.transit_days) && (
                <div className="flex gap-3 text-[11px] text-gray-500">
                  {opt.agent_name && <span>{t('shop.agent')}: {opt.agent_name}</span>}
                  {opt.transit_days && <span>{t('shop.transit')}: ~{opt.transit_days} {t('shop.days')}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const [photoIdx, setPhotoIdx] = useState(0)
  const [orderCartons, setOrderCartons] = useState(1)
  const [orderDestination, setOrderDestination] = useState<'jordan' | 'iraq'>('jordan')
  const [createdOrder, setCreatedOrder] = useState<ShopOrder | null>(null)

  const { formatPrice } = useShopCurrency()
  const { token, customer } = useShopStore()

  const { data: product, isLoading } = useQuery({
    queryKey: ['shop-product', id],
    queryFn: () => getProduct(Number(id)),
    enabled: !!id,
  })
  const minCartons = product?.min_order_cartons ?? 1
  const cartonsToOrder = Math.max(Number(minCartons || 1), Number(orderCartons || 1))
  const orderMutation = useMutation({
    mutationFn: () => {
      if (!product || !token) throw new Error('Missing product or customer session')
      return createShopOrder(token, {
        destination: orderDestination,
        items: [{ product_id: product.id, cartons: cartonsToOrder }],
      })
    },
    onSuccess: (order) => setCreatedOrder(order),
  })

  if (isLoading) {
    return (
      <ShopLayout>
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      </ShopLayout>
    )
  }

  if (!product) {
    return (
      <ShopLayout>
        <div className="text-center py-20 text-gray-500">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p>Product not found</p>
          <Link to="/shop" className="text-sm text-brand-primary-light hover:underline mt-2 inline-block">
            {t('common.back')}
          </Link>
        </div>
      </ShopLayout>
    )
  }

  const photos = product.photos.sort((a, b) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0))
  const currentPhoto = photos[photoIdx]

  return (
    <ShopLayout>
      <div className="space-y-6">
        <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={14} />
          {t('common.back')}
        </Link>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Photos */}
          <div className="space-y-3">
            <div className="aspect-square rounded-2xl overflow-hidden bg-white/5 relative">
              {currentPhoto ? (
                <img
                  src={`/uploads/products/${currentPhoto.file_path.split('/').pop()}`}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package size={64} className="text-gray-600" />
                </div>
              )}
              {photos.length > 1 && (
                <>
                  <button
                    onClick={() => setPhotoIdx(i => Math.max(0, i - 1))}
                    disabled={photoIdx === 0}
                    className="absolute start-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPhotoIdx(i => Math.min(photos.length - 1, i + 1))}
                    disabled={photoIdx === photos.length - 1}
                    className="absolute end-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
            </div>
            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((ph, i) => (
                  <button
                    key={ph.id}
                    onClick={() => setPhotoIdx(i)}
                    className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                      i === photoIdx ? 'border-brand-primary' : 'border-white/10'
                    }`}
                  >
                    <img
                      src={`/uploads/products/${ph.file_path.split('/').pop()}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-5">
            {product.category && (
              <span className="inline-block text-xs bg-brand-primary/10 text-brand-primary-light px-2.5 py-1 rounded-full">
                {product.category}
              </span>
            )}

            <div>
              <h1 className="text-2xl font-bold text-white">
                {isAr && product.name_ar ? product.name_ar : product.name}
              </h1>
              {isAr && product.name_ar && product.name && (
                <p className="text-sm text-gray-500 mt-1">{product.name}</p>
              )}
              {product.supplier && (
                <p className="text-sm text-gray-500 mt-1">
                  {product.supplier.name}
                  {product.supplier.market_location && ` · ${product.supplier.market_location}`}
                </p>
              )}
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-yellow-400">{formatPrice(Number(product.price_cny))}</span>
              <span className="text-gray-500 text-sm">/ {product.pcs_per_carton} pcs</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Pcs / Carton', value: product.pcs_per_carton },
                { label: 'CBM / Carton', value: product.cbm_per_carton },
                { label: 'Min Order', value: `${product.min_order_cartons} ctn` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                  <p className="text-lg font-bold text-white">{value}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-emerald-300" />
                <h3 className="font-semibold text-white">{isAr ? 'طلب من المتجر' : 'Shop Order'}</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="label-base">{t('shop.cartons')}</label>
                  <input
                    type="number"
                    min={product.min_order_cartons}
                    value={orderCartons}
                    onChange={(e) => setOrderCartons(Math.max(product.min_order_cartons, Number(e.target.value) || product.min_order_cartons))}
                    className="input-base w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="label-base">{t('shop.destination')}</label>
                  <select
                    value={orderDestination}
                    onChange={(e) => setOrderDestination(e.target.value as 'jordan' | 'iraq')}
                    className="input-base w-full"
                  >
                    <option value="jordan">{t('shop.jordan')}</option>
                    <option value="iraq">{t('shop.iraq')}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
                <span>{(cartonsToOrder * product.pcs_per_carton).toLocaleString()} pcs</span>
                <span>{(cartonsToOrder * Number(product.cbm_per_carton)).toFixed(3)} CBM</span>
                <span>${((Number(product.price_usd || 0) * cartonsToOrder * product.pcs_per_carton)).toFixed(2)}</span>
              </div>
              {customer && token ? (
                <button
                  onClick={() => orderMutation.mutate()}
                  disabled={orderMutation.isPending}
                  className="w-full py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-500/90 disabled:opacity-60 transition-colors"
                >
                  {orderMutation.isPending
                    ? (isAr ? 'جاري إنشاء الطلب...' : 'Creating order...')
                    : (isAr ? 'إنشاء طلب' : 'Create order')}
                </button>
              ) : (
                <Link
                  to="/shop/client-login"
                  className="block w-full py-2.5 rounded-lg bg-brand-primary text-white text-sm font-semibold text-center hover:bg-brand-primary/90 transition-colors"
                >
                  {isAr ? 'سجل الدخول لإنشاء الطلب' : 'Sign in to create order'}
                </Link>
              )}
              {createdOrder && (
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-200">
                  <p className="font-semibold">
                    {isAr ? 'تم إنشاء الطلب' : 'Order created'}: {createdOrder.order_number}
                  </p>
                </div>
              )}
              {orderMutation.isError && (
                <p className="text-xs text-brand-red">
                  {(orderMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                    ?? (isAr ? 'تعذر إنشاء الطلب.' : 'Could not create order.')}
                </p>
              )}
            </div>

            {(product.description || product.description_ar) && (
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
                <p className="text-sm text-gray-300 whitespace-pre-wrap">
                  {isAr && product.description_ar ? product.description_ar : product.description}
                </p>
              </div>
            )}

            <ShippingCalculator
              cbmPerCarton={Number(product.cbm_per_carton)}
              pcsPerCarton={product.pcs_per_carton}
            />
          </div>
        </div>
      </div>
    </ShopLayout>
  )
}
