import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Search, Calculator, Package, CheckCircle2, ArrowRight } from 'lucide-react'
import ShopLayout from '@/components/layout/ShopLayout'

const STEPS = [
  {
    num: '01',
    icon: Search,
    color: '#6366F1',
    en_title: 'Browse the Catalog',
    ar_title: 'تصفح الكتالوج',
    en_desc: 'Browse our wholesale catalog sourced from Guangzhou and Yiwu markets. Filter by category, check product photos, prices in CNY, pcs per carton, and CBM per carton.',
    ar_desc: 'استعرض كتالوج الجملة الخاص بنا المجمّع من أسواق قوانغتشو ويوي. صفّح حسب الفئة وتحقق من الصور والأسعار بالـ CNY وعدد القطع لكل كرتون وCBM لكل كرتون.',
    tips_en: ['Each product shows min order in cartons', 'Prices are in Chinese Yuan (CNY)', 'CBM helps you estimate container fill'],
    tips_ar: ['كل منتج يوضح الحد الأدنى بالكراتين', 'الأسعار بالين الصيني (CNY)', 'CBM يساعدك على تقدير ملء الحاوية'],
  },
  {
    num: '02',
    icon: Calculator,
    color: '#8B5CF6',
    en_title: 'Calculate Your Shipping Cost',
    ar_title: 'احسب تكلفة الشحن',
    en_desc: 'On each product page, enter the number of cartons you want and select your destination (Jordan or Iraq). The system instantly shows you ocean freight + customs clearance costs for 20GP, 40GP, and 40HQ containers.',
    ar_desc: 'في صفحة كل منتج، أدخل عدد الكراتين التي تريدها وحدد وجهتك (الأردن أو العراق). يعرض النظام فوراً تكاليف الشحن البحري والتخليص الجمركي لحاويات 20GP و40GP و40HQ.',
    tips_en: ['Compare 20GP vs 40HQ total cost', 'Cost per CBM helps you compare options', 'Calculator uses our real agent prices'],
    tips_ar: ['قارن التكلفة الإجمالية بين 20GP و40HQ', 'التكلفة لكل CBM تساعدك على المقارنة', 'الحاسبة تستخدم أسعار وكلائنا الفعلية'],
  },
  {
    num: '03',
    icon: Package,
    color: '#10B981',
    en_title: 'Place Your Order',
    ar_title: 'اطلب بضاعتك',
    en_desc: 'Contact us via WhatsApp or Telegram with the product codes and quantities you want. We confirm stock with the supplier, prepare a proforma invoice, and arrange payment (30% deposit, 70% before shipment).',
    ar_desc: 'تواصل معنا عبر واتساب أو تيليجرام برموز المنتجات والكميات التي تريدها. نؤكد المخزون مع المورد ونعد فاتورة مبدئية ونرتب الدفع (30٪ عربون، 70٪ قبل الشحن).',
    tips_en: ['Share product codes from the website', 'We verify stock before invoicing', 'Proforma invoice issued within 24 hrs'],
    tips_ar: ['شارك رموز المنتجات من الموقع', 'نتحقق من المخزون قبل الفوترة', 'الفاتورة المبدئية تصدر خلال 24 ساعة'],
  },
  {
    num: '04',
    icon: CheckCircle2,
    color: '#F59E0B',
    en_title: 'Receive at Your Door',
    ar_title: 'استلم في بابك',
    en_desc: 'We purchase goods, pack them, and ship via sea from China. Transit time is 7–14 days. Our clearance agents in Aqaba (Jordan) or Umm Qasr (Iraq) handle customs. Final delivery to your warehouse.',
    ar_desc: 'نشتري البضائع ونعبئها ونشحنها بحراً من الصين. وقت العبور 7–14 يوم. وكلاؤنا في العقبة (الأردن) أو أم قصر (العراق) يتولون الجمارك. التسليم النهائي إلى مستودعك.',
    tips_en: ['Sea freight: 7–14 days transit', 'Customs handled by our local agents', 'You get B/L tracking number'],
    tips_ar: ['شحن بحري: 7–14 يوم عبور', 'الجمارك يتولاها وكلاؤنا المحليون', 'تحصل على رقم تتبع B/L'],
  },
]

const CONTAINER_TYPES = [
  { type: '20GP', cbm: 25, en: 'Good for small orders', ar: 'مناسب للطلبات الصغيرة' },
  { type: '40GP', cbm: 55, en: 'Standard large shipment', ar: 'شحنة كبيرة قياسية' },
  { type: '40HQ', cbm: 76, en: 'Max volume container', ar: 'أقصى سعة تخزين' },
]

export default function ShopHowItWorks() {
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'

  return (
    <ShopLayout>
      <div className="max-w-4xl mx-auto space-y-14 py-4">

        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-black text-white">
            {isAr ? '⚙️ كيف يعمل النظام' : '⚙️ How It Works'}
          </h1>
          <p className="text-gray-400 text-base max-w-xl mx-auto">
            {isAr
              ? 'من تصفح المنتجات إلى استلام البضاعة — أربع خطوات بسيطة'
              : 'From browsing products to receiving goods — four simple steps'}
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {STEPS.map(({ num, icon: Icon, color, en_title, ar_title, en_desc, ar_desc, tips_en, tips_ar }) => (
            <div key={num} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 grid sm:grid-cols-[auto_1fr] gap-6">
              <div className="flex sm:flex-col items-center sm:items-start gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                  <Icon size={22} style={{ color }} />
                </div>
                <span className="text-3xl font-black font-mono" style={{ color: `${color}50` }}>{num}</span>
              </div>
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-white">
                  {isAr ? ar_title : en_title}
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {isAr ? ar_desc : en_desc}
                </p>
                <ul className="space-y-1">
                  {(isAr ? tips_ar : tips_en).map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
                      <span style={{ color }}>✓</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Container reference */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">
            {isAr ? '📦 أنواع الحاويات' : '📦 Container Types Reference'}
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {CONTAINER_TYPES.map(({ type, cbm, en, ar }) => (
              <div key={type} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center">
                <p className="text-2xl font-black text-brand-primary-light mb-1">{type}</p>
                <p className="text-4xl font-black text-white mb-1">{cbm}</p>
                <p className="text-xs text-gray-500 mb-2">CBM capacity</p>
                <p className="text-xs text-gray-400">{isAr ? ar : en}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 text-center">
            {isAr
              ? 'CBM = الحجم التجميعي. 1 كرتون ملابس عادةً ≈ 0.2 CBM'
              : 'CBM = Cubic meters volume. 1 clothing carton ≈ 0.2 CBM typically'}
          </p>
        </div>

        {/* CTA */}
        <div className="rounded-2xl p-8 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(129,140,248,0.05))', border: '1px solid rgba(99,102,241,0.2)' }}>
          <p className="text-lg font-bold text-white mb-2">
            {isAr ? 'جاهز للبدء؟' : 'Ready to get started?'}
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-5">
            <Link
              to="/shop/products"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white text-sm transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg,#6366F1,#818CF8)' }}
            >
              {isAr ? 'تصفح المنتجات' : 'Browse Products'} <ArrowRight size={14} />
            </Link>
            <Link
              to="/shop/calculator"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-gray-200 text-sm border border-white/15 bg-white/5 hover:bg-white/10 transition-all"
            >
              {isAr ? 'احسب الشحن' : 'Calculate Shipping'}
            </Link>
          </div>
        </div>

      </div>
    </ShopLayout>
  )
}
