import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, Link } from 'react-router-dom'
import { Calculator, ArrowRight } from 'lucide-react'
import { calculateShipping } from '@/services/shopService'
import ShopLayout from '@/components/layout/ShopLayout'
import type { ShippingOption } from '@/types'

const CBM_GUIDE = [
  { label_en: 'T-shirt (250 pcs)', label_ar: 'تيشيرت (250 قطعة)', cbm: 0.20 },
  { label_en: 'Jeans (100 pcs)',   label_ar: 'جينز (100 قطعة)',   cbm: 0.25 },
  { label_en: 'Jackets (60 pcs)',  label_ar: 'جاكيت (60 قطعة)',   cbm: 0.30 },
  { label_en: 'Shoes (12 pairs)',  label_ar: 'أحذية (12 زوج)',    cbm: 0.25 },
]

function OptionCard({ opt, usdToCny, isAr }: { opt: ShippingOption; usdToCny: number; isAr: boolean }) {
  const cnyTotal = (opt.total_cost_usd * usdToCny).toFixed(0)

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-lg font-black text-white">{opt.container_type}</span>
        <div className="text-end">
          <p className="text-xs text-gray-500">{isAr ? 'السعة' : 'Capacity'}</p>
          <p className="text-sm font-semibold text-gray-300">{opt.capacity_cbm} CBM</p>
        </div>
      </div>

      {/* Fill bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{isAr ? 'الامتلاء' : 'Fill rate'}</span>
          <span>{opt.cbm_used_percent}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${opt.cbm_used_percent}%`,
              background: opt.cbm_used_percent > 85
                ? 'linear-gradient(90deg,#10B981,#34D399)'
                : opt.cbm_used_percent > 50
                  ? 'linear-gradient(90deg,#6366F1,#818CF8)'
                  : 'linear-gradient(90deg,#F59E0B,#FBBF24)',
            }}
          />
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">{isAr ? 'الحاويات المطلوبة' : 'Containers'}</span>
          <span className="text-white font-medium">{opt.containers_needed}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">{isAr ? 'شحن بحري' : 'Ocean freight'}</span>
          <span className="text-white font-medium">${opt.total_freight_usd}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">{isAr ? 'تخليص جمركي' : 'Clearance'}</span>
          <span className="text-white font-medium">${opt.clearance_fees_usd}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">{isAr ? 'تكلفة/CBM' : 'Cost/CBM'}</span>
          <span className="text-white font-medium">${opt.cost_per_cbm_usd}</span>
        </div>
      </div>

      {/* Total */}
      <div className="border-t border-white/10 pt-3 flex items-end justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">{isAr ? 'الإجمالي (دولار)' : 'Total (USD)'}</p>
          <p className="text-2xl font-black text-emerald-400">${opt.total_cost_usd}</p>
        </div>
        <div className="text-end">
          <p className="text-xs text-gray-500 mb-0.5">{isAr ? 'تقريبي (يوان)' : 'Approx (CNY)'}</p>
          <p className="text-sm font-semibold text-yellow-400">¥{cnyTotal}</p>
        </div>
      </div>

      {/* Agent info */}
      {(opt.agent_name || opt.clearance_agent || opt.transit_days) && (
        <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 pt-1 border-t border-white/5">
          {opt.agent_name && <span>🚢 {opt.agent_name}</span>}
          {opt.clearance_agent && <span>🏛 {opt.clearance_agent}</span>}
          {opt.transit_days && <span>⏱ ~{opt.transit_days} {isAr ? 'يوم' : 'days'}</span>}
        </div>
      )}
    </div>
  )
}

export default function ShopCalculator() {
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const [searchParams] = useSearchParams()

  const [totalCbm, setTotalCbm] = useState('')
  const [destination, setDestination] = useState<'jordan' | 'iraq'>(
    (searchParams.get('destination') as 'jordan' | 'iraq') ?? 'jordan'
  )
  const [result, setResult] = useState<{ options: ShippingOption[]; usd_to_cny_rate: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCalculate() {
    const cbm = parseFloat(totalCbm)
    if (!cbm || cbm <= 0) { setError(isAr ? 'أدخل قيمة CBM صحيحة' : 'Enter a valid CBM value'); return }
    setError('')
    setLoading(true)
    try {
      const res = await calculateShipping(cbm, destination)
      setResult(res)
    } catch {
      setError(isAr ? 'حدث خطأ، حاول مجدداً' : 'Could not calculate. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-calculate when destination changes if we already have a result
  useEffect(() => {
    if (result && totalCbm) handleCalculate()
  }, [destination])

  return (
    <ShopLayout>
      <div className="max-w-3xl mx-auto space-y-8 py-4">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mx-auto"
            style={{ background: 'linear-gradient(135deg,#6366F1,#818CF8)', boxShadow: '0 0 24px rgba(99,102,241,0.3)' }}>
            <Calculator size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white">
            {isAr ? 'حاسبة الشحن' : 'Shipping Calculator'}
          </h1>
          <p className="text-gray-400 text-sm">
            {isAr
              ? 'أدخل حجم بضاعتك واحصل على تكلفة الشحن الكاملة من الصين'
              : 'Enter your cargo volume and get the full shipping cost from China'}
          </p>
        </div>

        {/* Calculator card */}
        <div className="rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-6 sm:p-8 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="label-base">
                {isAr ? 'إجمالي الحجم (CBM)' : 'Total Volume (CBM)'}
              </label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={totalCbm}
                onChange={(e) => setTotalCbm(e.target.value)}
                placeholder="e.g. 5.0"
                className="input-base w-full text-lg"
              />
              <p className="text-xs text-gray-500">
                {isAr ? '1 كرتون ملابس ≈ 0.2 CBM' : '1 clothing carton ≈ 0.2 CBM'}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="label-base">
                {isAr ? 'وجهة الشحن' : 'Destination'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['jordan', 'iraq'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDestination(d)}
                    className={`py-3 rounded-xl border text-sm font-semibold transition-all ${
                      destination === d
                        ? 'bg-brand-primary border-brand-primary text-white'
                        : 'border-white/15 bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {d === 'jordan' ? (isAr ? '🇯🇴 الأردن' : '🇯🇴 Jordan') : (isAr ? '🇮🇶 العراق' : '🇮🇶 Iraq')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-brand-red">{error}</p>}

          <button
            onClick={handleCalculate}
            disabled={loading || !totalCbm}
            className="w-full py-3.5 rounded-xl font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg,#6366F1,#818CF8)', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}
          >
            {loading
              ? (isAr ? 'جاري الحساب...' : 'Calculating...')
              : (isAr ? '🧮 احسب الشحن' : '🧮 Calculate Shipping')}
          </button>
        </div>

        {/* CBM quick reference */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-300">
            {isAr ? '📏 مرجع CBM لكل كرتون' : '📏 Quick CBM reference per carton'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CBM_GUIDE.map(({ label_en, label_ar, cbm }) => (
              <button
                key={label_en}
                onClick={() => setTotalCbm(String(cbm))}
                className="rounded-xl border border-white/10 bg-white/[0.03] hover:border-brand-primary/30 hover:bg-white/[0.07] p-3 text-center transition-all"
              >
                <p className="text-sm font-bold text-brand-primary-light">~{cbm} CBM</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{isAr ? label_ar : label_en}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600">
            {isAr ? '* انقر لضبط القيمة، ثم عدّلها حسب عدد كراتينك' : '* Click to set value, then adjust for your carton count'}
          </p>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">
                {isAr ? 'نتائج الشحن' : 'Shipping Options'}
              </h2>
              <span className="text-xs text-gray-500">
                1 USD = ¥{result.usd_to_cny_rate} · {totalCbm} CBM → {destination === 'jordan' ? (isAr ? 'الأردن' : 'Jordan') : (isAr ? 'العراق' : 'Iraq')}
              </span>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {result.options.map((opt) => (
                <OptionCard key={opt.container_type} opt={opt} usdToCny={result.usd_to_cny_rate} isAr={isAr} />
              ))}
            </div>
            <p className="text-xs text-gray-600 text-center">
              {isAr
                ? '* الأسعار تقريبية وقد تتغير حسب وقت الحجز وظروف السوق'
                : '* Prices are estimates and may vary based on booking time and market conditions'}
            </p>
          </div>
        )}

        {/* Link to products */}
        <div className="text-center pt-2">
          <Link
            to="/shop/products"
            className="inline-flex items-center gap-2 text-sm text-brand-primary-light hover:text-white transition-colors"
          >
            {isAr ? 'تصفح المنتجات واحسب من صفحة كل منتج' : 'Browse products and calculate from each product page'}
            <ArrowRight size={14} />
          </Link>
        </div>

      </div>
    </ShopLayout>
  )
}
