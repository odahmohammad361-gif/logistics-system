import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Package, Calculator, ArrowRight, Truck, ShieldCheck, Clock, MapPin,
} from 'lucide-react'
import { listProducts } from '@/services/productService'
import ShopLayout from '@/components/layout/ShopLayout'
import ProductStrip from '@/components/shop/ProductStrip'

const STATS = [
  { icon: Truck,       en: 'Ships to JO & IQ',       ar: 'يشحن للأردن والعراق' },
  { icon: Package,     en: 'Direct Wholesale Market', ar: 'مباشر من السوق' },
  { icon: Clock,       en: '7–14 Day Transit',        ar: 'عبور ٧–١٤ يوم' },
  { icon: ShieldCheck, en: 'Transparent Pricing',     ar: 'أسعار شفافة' },
]

const HOW_STEPS = [
  {
    num: '01',
    icon: '🔍',
    en_title: 'Browse Products',
    ar_title: 'تصفح المنتجات',
    en_desc: 'Explore our wholesale catalog. Filter by category, check prices in CNY.',
    ar_desc: 'استعرض كتالوج الجملة. صفّح حسب الفئة وتحقق من الأسعار.',
  },
  {
    num: '02',
    icon: '🧮',
    en_title: 'Calculate Shipping',
    ar_title: 'احسب تكلفة الشحن',
    en_desc: 'Enter carton count and pick Jordan or Iraq. We show real container costs.',
    ar_desc: 'أدخل عدد الكراتين واختر الوجهة، وسنعرض لك التكاليف الفعلية.',
  },
  {
    num: '03',
    icon: '📦',
    en_title: 'Order & Receive',
    ar_title: 'اطلب واستلم',
    en_desc: 'Contact us to confirm your order. Goods ship direct from China to your door.',
    ar_desc: 'تواصل معنا لتأكيد طلبك. البضاعة تصل مباشرة من الصين إلى بابك.',
  },
]

export default function ShopHome() {
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'

  const { data: featured, isLoading: loadingFeatured } = useQuery({
    queryKey: ['shop-featured'],
    queryFn: () => listProducts({ featured_only: true, page_size: 8 }),
    staleTime: 2 * 60 * 1000,
  })

  const { data: newest, isLoading: loadingNewest } = useQuery({
    queryKey: ['shop-newest'],
    queryFn: () => listProducts({ page_size: 8 }),
    staleTime: 2 * 60 * 1000,
  })

  return (
    <ShopLayout>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative -mx-4 -mt-6 px-4 pt-16 pb-12 mb-10 overflow-hidden">
        {/* gradient background */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.18) 0%, transparent 70%)',
          }} />
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(99,102,241,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(129,140,248,0.06) 0%, transparent 50%)',
          }} />

        <div className="relative text-center max-w-2xl mx-auto">
          {/* badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-primary/30 bg-brand-primary/10 text-xs text-brand-primary-light mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary-light animate-pulse" />
            {isAr ? 'مباشر من أسواق الصين الكبرى' : 'Direct from China Wholesale Markets'}
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-4">
            {isAr ? (
              <>
                شريكك في <span style={{ background: 'linear-gradient(135deg,#6366F1,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>الجملة</span>
                <br />من الصين إلى بابك
              </>
            ) : (
              <>
                Your Wholesale Partner{' '}
                <span style={{ background: 'linear-gradient(135deg,#6366F1,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  From China
                </span>
                <br />To Your Door
              </>
            )}
          </h1>

          <p className="text-gray-400 text-base sm:text-lg mb-8 leading-relaxed">
            {isAr
              ? 'ملابس وبضائع جملة عالية الجودة تشحن مباشرة إلى الأردن والعراق'
              : 'Quality wholesale clothing & goods shipped directly to Jordan & Iraq'}
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/shop/products"
              className="px-6 py-3 rounded-xl font-semibold text-white text-sm transition-all hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg,#6366F1,#818CF8)', boxShadow: '0 0 20px rgba(99,102,241,0.35)' }}
            >
              {isAr ? '🛍 تصفح المنتجات' : '🛍 Browse Products'}
            </Link>
            <Link
              to="/shop/calculator"
              className="px-6 py-3 rounded-xl font-semibold text-gray-200 text-sm border border-white/15 bg-white/5 hover:bg-white/10 transition-all hover:scale-105 active:scale-95"
            >
              {isAr ? '🧮 احسب الشحن' : '🧮 Calculate Shipping'}
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {STATS.map(({ icon: Icon, en, ar }) => (
            <div key={en} className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3">
              <Icon size={16} className="text-brand-primary-light flex-shrink-0" />
              <span className="text-xs text-gray-300 leading-tight">{isAr ? ar : en}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Destination chips ────────────────────────────────── */}
      <section className="flex flex-wrap gap-3 mb-10">
        {[
          { flag: '🇯🇴', label: isAr ? 'الأردن — عقبة' : 'Jordan — Aqaba', dest: 'jordan' },
          { flag: '🇮🇶', label: isAr ? 'العراق — أم قصر' : 'Iraq — Umm Qasr', dest: 'iraq' },
        ].map(({ flag, label, dest }) => (
          <Link
            key={dest}
            to={`/shop/calculator?destination=${dest}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:border-brand-primary/30 hover:bg-white/[0.07] transition-all text-sm"
          >
            <span className="text-xl">{flag}</span>
            <div>
              <p className="font-semibold text-white text-xs">{label}</p>
              <p className="text-[11px] text-brand-primary-light">
                {isAr ? 'احسب التكلفة ←' : 'Calculate cost →'}
              </p>
            </div>
          </Link>
        ))}
        <Link
          to="/shop/how-it-works"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:border-white/20 transition-all text-sm text-gray-400 hover:text-white"
        >
          {isAr ? 'كيف يعمل النظام؟ →' : 'How does it work? →'}
        </Link>
      </section>

      {/* ── Featured products strip ───────────────────────────── */}
      {(loadingFeatured || (featured?.results?.length ?? 0) > 0) && (
        <div className="mb-10">
          <ProductStrip
            badge="⭐"
            title={isAr ? 'منتجات مميزة' : 'Featured Products'}
            products={featured?.results ?? []}
            loading={loadingFeatured}
            viewAllLink="/shop/products?featured=1"
            viewAllLabel={isAr ? 'عرض الكل' : 'View All'}
          />
        </div>
      )}

      {/* ── New arrivals strip ────────────────────────────────── */}
      {(loadingNewest || (newest?.results?.length ?? 0) > 0) && (
        <div className="mb-12">
          <ProductStrip
            badge="🆕"
            title={isAr ? 'وصل حديثاً' : 'New Arrivals'}
            products={newest?.results ?? []}
            loading={loadingNewest}
            viewAllLink="/shop/products"
            viewAllLabel={isAr ? 'عرض الكل' : 'View All'}
          />
        </div>
      )}

      {/* ── How It Works teaser ───────────────────────────────── */}
      <section className="mb-12 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">
            {isAr ? '⚙️ كيف يعمل النظام' : '⚙️ How It Works'}
          </h2>
          <Link to="/shop/how-it-works"
            className="flex items-center gap-1 text-sm text-brand-primary-light hover:text-white transition-colors">
            {isAr ? 'اعرف أكثر' : 'Learn more'} <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {HOW_STEPS.map((s) => (
            <div key={s.num} className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
                {s.icon}
              </div>
              <div>
                <p className="text-xs text-brand-primary-light font-mono mb-0.5">{s.num}</p>
                <p className="text-sm font-semibold text-white mb-1">
                  {isAr ? s.ar_title : s.en_title}
                </p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {isAr ? s.ar_desc : s.en_desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA section ───────────────────────────────────────── */}
      <section className="rounded-2xl p-8 text-center relative overflow-hidden mb-4"
        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(129,140,248,0.06))', border: '1px solid rgba(99,102,241,0.2)' }}>
        <p className="text-2xl font-bold text-white mb-2">
          {isAr ? 'هل أنت مستعد للطلب؟' : 'Ready to order?'}
        </p>
        <p className="text-gray-400 text-sm mb-6">
          {isAr ? 'تواصل معنا الآن عبر واتساب أو تيليجرام' : 'Get in touch via WhatsApp or Telegram'}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/shop/contact"
            className="px-6 py-2.5 rounded-xl font-semibold text-white text-sm transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg,#6366F1,#818CF8)' }}
          >
            {isAr ? '📞 تواصل معنا' : '📞 Contact Us'}
          </Link>
          <Link
            to="/shop/products"
            className="px-6 py-2.5 rounded-xl font-semibold text-gray-200 text-sm border border-white/15 bg-white/5 hover:bg-white/10 transition-all"
          >
            {isAr ? 'تصفح المنتجات' : 'Browse Products'}
          </Link>
        </div>
      </section>
    </ShopLayout>
  )
}
