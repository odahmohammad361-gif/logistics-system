import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { MapPin, Truck, ShieldCheck, Users, Star, ArrowRight } from 'lucide-react'
import ShopLayout from '@/components/layout/ShopLayout'

const WHY_US = [
  {
    icon: Truck,
    en_title: 'Direct from Factory',
    ar_title: 'مباشر من المصنع',
    en_desc: 'We source goods directly from Guangzhou & Yiwu wholesale markets — no middlemen, no hidden fees.',
    ar_desc: 'نستورد البضاعة مباشرة من أسواق الجملة في قوانغتشو ويوي، بدون وسطاء أو رسوم مخفية.',
  },
  {
    icon: ShieldCheck,
    en_title: 'Transparent Pricing',
    ar_title: 'أسعار شفافة',
    en_desc: 'Real shipping costs from our system — ocean freight + customs clearance — calculated before you order.',
    ar_desc: 'تكاليف شحن حقيقية من نظامنا تشمل الشحن البحري والتخليص الجمركي محسوبة قبل الطلب.',
  },
  {
    icon: MapPin,
    en_title: 'Jordan & Iraq Specialists',
    ar_title: 'متخصصون في الأردن والعراق',
    en_desc: 'Deep knowledge of customs, ports (Aqaba & Umm Qasr), and ground transport in both countries.',
    ar_desc: 'خبرة عميقة في الجمارك والموانئ (العقبة وأم قصر) والنقل البري في كلا البلدين.',
  },
  {
    icon: Users,
    en_title: 'Trusted by Buyers',
    ar_title: 'موثوق من المشترين',
    en_desc: 'Hundreds of orders shipped for wholesalers, retailers, and entrepreneurs across the region.',
    ar_desc: 'مئات الطلبات شُحنت لتجار الجملة والتجزئة ورجال الأعمال في المنطقة.',
  },
]

const MARKETS = [
  { flag: '🇨🇳', name: 'Shahe Fashion Market', city: 'Guangzhou, China', en: 'Wholesale clothing hub', ar: 'مركز الملابس الجملة' },
  { flag: '🇨🇳', name: 'Yiwu International Market', city: 'Yiwu, China', en: 'General merchandise', ar: 'سلع عامة متنوعة' },
  { flag: '🇯🇴', name: 'Port of Aqaba', city: 'Aqaba, Jordan', en: 'Main entry port for Jordan', ar: 'ميناء الدخول الرئيسي للأردن' },
  { flag: '🇮🇶', name: 'Port of Umm Qasr', city: 'Basra, Iraq', en: 'Main entry port for Iraq', ar: 'ميناء الدخول الرئيسي للعراق' },
]

export default function ShopAbout() {
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'

  return (
    <ShopLayout>
      <div className="max-w-4xl mx-auto space-y-14 py-4">

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-primary/30 bg-brand-primary/10 text-xs text-brand-primary-light">
            <Star size={11} fill="currentColor" />
            {isAr ? 'من نحن' : 'About Us'}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white">
            {isAr ? 'أرض الوسام للتجارة والشحن' : 'Ard Al-Wisam Trading & Shipping'}
          </h1>
          <p className="text-gray-400 text-base leading-relaxed max-w-xl mx-auto">
            {isAr
              ? 'وكيل شحن ومستورد جملة متخصص في ربط الأسواق الصينية بالأردن والعراق.'
              : "A wholesale trading and freight forwarding company connecting China's wholesale markets with buyers in Jordan & Iraq."}
          </p>
        </div>

        {/* Story */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 grid sm:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">
              {isAr ? 'قصتنا' : 'Our Story'}
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              {isAr
                ? 'بدأنا كوكلاء شحن صغيرين ونمونا لنصبح شريكاً موثوقاً لمئات المشترين في الأردن والعراق. متخصصون في ملابس الجملة، نحمل خبرة عميقة في أسواق الصين وإجراءات الاستيراد.'
                : 'We started as a small freight forwarding operation and grew into a trusted partner for hundreds of buyers in Jordan and Iraq. Specializing in wholesale clothing, we bring deep knowledge of Chinese markets and import procedures.'}
            </p>
            <p className="text-gray-400 text-sm leading-relaxed">
              {isAr
                ? 'نؤمن بالشفافية الكاملة: كل رسوم الشحن والتخليص موضحة مسبقاً باستخدام نظامنا الخاص للتسعير.'
                : 'We believe in full transparency: every shipping and customs fee is displayed upfront using our own pricing system.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { num: '100+', label: isAr ? 'منتج متاح' : 'Products Listed' },
              { num: '2', label: isAr ? 'دول وجهة' : 'Destination Countries' },
              { num: '7–14', label: isAr ? 'يوم وقت شحن' : 'Day Shipping Time' },
              { num: '3', label: isAr ? 'أنواع حاويات' : 'Container Types' },
            ].map(({ num, label }) => (
              <div key={label} className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                <p className="text-2xl font-black text-brand-primary-light">{num}</p>
                <p className="text-xs text-gray-400 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Why Us */}
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-white">
            {isAr ? 'لماذا تختارنا؟' : 'Why Choose Us?'}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {WHY_US.map(({ icon: Icon, en_title, ar_title, en_desc, ar_desc }) => (
              <div key={en_title} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <Icon size={18} className="text-brand-primary-light" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm mb-1">
                    {isAr ? ar_title : en_title}
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {isAr ? ar_desc : en_desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Markets & Ports */}
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-white">
            {isAr ? 'مواقعنا والموانئ' : 'Markets & Ports We Work With'}
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {MARKETS.map(({ flag, name, city, en, ar }) => (
              <div key={name} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <span className="text-2xl">{flag}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{name}</p>
                  <p className="text-xs text-gray-500">{city}</p>
                  <p className="text-xs text-brand-primary-light mt-0.5">{isAr ? ar : en}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl p-8 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(129,140,248,0.05))', border: '1px solid rgba(99,102,241,0.2)' }}>
          <p className="text-lg font-bold text-white mb-2">
            {isAr ? 'هل لديك أسئلة؟' : 'Have questions?'}
          </p>
          <p className="text-sm text-gray-400 mb-5">
            {isAr ? 'فريقنا جاهز للمساعدة عبر واتساب وتيليجرام' : 'Our team is ready to help via WhatsApp & Telegram'}
          </p>
          <Link
            to="/shop/contact"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white text-sm transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg,#6366F1,#818CF8)' }}
          >
            {isAr ? 'تواصل معنا' : 'Contact Us'} <ArrowRight size={14} />
          </Link>
        </div>

      </div>
    </ShopLayout>
  )
}
