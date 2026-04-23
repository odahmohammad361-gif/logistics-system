import { useTranslation } from 'react-i18next'
import { MessageCircle, Send, Mail, Phone, Clock, MapPin } from 'lucide-react'
import ShopLayout from '@/components/layout/ShopLayout'

// ── Fill in your actual contact details here ──────────────────
const CONTACT = {
  whatsapp:  '+962-XX-XXXXXX',   // replace with real number
  telegram:  '@YourTelegram',     // replace with real handle
  wechat:    'YourWeChat',        // replace with real ID
  email:     'info@example.com',  // replace with real email
  hours_en:  'Sat – Thu, 9 AM – 9 PM (China Time)',
  hours_ar:  'السبت – الخميس، ٩ ص – ٩ م (توقيت الصين)',
  location_en: 'Shahe Market, Guangzhou, China',
  location_ar: 'سوق شاهه، قوانغتشو، الصين',
}

const CHANNELS = [
  {
    icon: MessageCircle,
    name_en: 'WhatsApp',
    name_ar: 'واتساب',
    value: CONTACT.whatsapp,
    desc_en: 'Fastest response — send photos of products you want',
    desc_ar: 'أسرع رد — أرسل صور المنتجات التي تريدها',
    color: '#25D366',
    href: `https://wa.me/${CONTACT.whatsapp.replace(/[^0-9]/g, '')}`,
    btn_en: 'Chat on WhatsApp',
    btn_ar: 'تواصل واتساب',
  },
  {
    icon: Send,
    name_en: 'Telegram',
    name_ar: 'تيليجرام',
    value: CONTACT.telegram,
    desc_en: 'Send bulk orders, catalogs, or just say hello',
    desc_ar: 'أرسل طلبات جملة أو كتالوجات أو فقط قل مرحباً',
    color: '#2AABEE',
    href: `https://t.me/${CONTACT.telegram.replace('@', '')}`,
    btn_en: 'Message on Telegram',
    btn_ar: 'تواصل تيليجرام',
  },
  {
    icon: Mail,
    name_en: 'Email',
    name_ar: 'البريد الإلكتروني',
    value: CONTACT.email,
    desc_en: 'For formal inquiries, invoices, and documents',
    desc_ar: 'للاستفسارات الرسمية والفواتير والوثائق',
    color: '#6366F1',
    href: `mailto:${CONTACT.email}`,
    btn_en: 'Send Email',
    btn_ar: 'إرسال إيميل',
  },
]

const FAQS = [
  {
    q_en: 'What is the minimum order?',
    q_ar: 'ما الحد الأدنى للطلب؟',
    a_en: 'Each product shows its minimum in cartons (usually 1 carton). For shipping efficiency, we recommend filling at least 50% of a container.',
    a_ar: 'كل منتج يوضح الحد الأدنى بالكراتين (عادة كرتون واحد). لكفاءة الشحن، ننصح بملء 50٪ على الأقل من الحاوية.',
  },
  {
    q_en: 'How do I pay?',
    q_ar: 'كيف أدفع؟',
    a_en: 'We accept bank transfer (TT) and Western Union. Payment is split: 30% deposit, 70% before shipping.',
    a_ar: 'نقبل التحويل البنكي والويسترن يونيون. الدفع مقسم: 30٪ عربون، 70٪ قبل الشحن.',
  },
  {
    q_en: 'How long does shipping take?',
    q_ar: 'كم تستغرق الشحنة؟',
    a_en: 'Sea freight: 7–14 days to Aqaba (Jordan) or Umm Qasr (Iraq), depending on vessel schedule.',
    a_ar: 'شحن بحري: 7–14 يوم إلى العقبة (الأردن) أو أم قصر (العراق)، حسب جدول السفينة.',
  },
  {
    q_en: 'Do you handle customs clearance?',
    q_ar: 'هل تتولون التخليص الجمركي؟',
    a_en: 'Yes. We work with clearance agents in both Jordan and Iraq. Fees are shown in the shipping calculator.',
    a_ar: 'نعم. نعمل مع وكلاء تخليص جمركي في الأردن والعراق. الرسوم موضحة في حاسبة الشحن.',
  },
]

export default function ShopContact() {
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'

  return (
    <ShopLayout>
      <div className="max-w-4xl mx-auto space-y-12 py-4">

        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-black text-white">
            {isAr ? '📞 تواصل معنا' : '📞 Contact Us'}
          </h1>
          <p className="text-gray-400 text-base">
            {isAr
              ? 'نحن هنا للإجابة على أسئلتك ومساعدتك في طلبك'
              : "We're here to answer your questions and help with your order"}
          </p>
        </div>

        {/* Contact channels */}
        <div className="grid sm:grid-cols-3 gap-4">
          {CHANNELS.map(({ icon: Icon, name_en, name_ar, value, desc_en, desc_ar, color, href, btn_en, btn_ar }) => (
            <div key={name_en} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                  <Icon size={18} style={{ color }} />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{isAr ? name_ar : name_en}</p>
                  <p className="text-xs text-gray-500 font-mono">{value}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed flex-1">
                {isAr ? desc_ar : desc_en}
              </p>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 rounded-xl text-center text-xs font-semibold text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95"
                style={{ background: `linear-gradient(135deg, ${color}dd, ${color}99)` }}
              >
                {isAr ? btn_ar : btn_en}
              </a>
            </div>
          ))}
        </div>

        {/* Hours & Location */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 flex gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <Clock size={18} className="text-brand-primary-light" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">
                {isAr ? 'ساعات العمل' : 'Business Hours'}
              </p>
              <p className="text-xs text-gray-400">
                {isAr ? CONTACT.hours_ar : CONTACT.hours_en}
              </p>
              <p className="text-[11px] text-gray-600 mt-1">
                {isAr ? '(توقيت الأردن: +5 ساعات)' : '(Jordan time: +5 hrs, Iraq time: +5 hrs)'}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 flex gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <MapPin size={18} className="text-brand-primary-light" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">
                {isAr ? 'موقعنا' : 'Our Location'}
              </p>
              <p className="text-xs text-gray-400">
                {isAr ? CONTACT.location_ar : CONTACT.location_en}
              </p>
              <p className="text-[11px] text-brand-primary-light mt-1">
                {isAr ? 'شراء مباشر من السوق' : 'Direct market sourcing'}
              </p>
            </div>
          </div>
        </div>

        {/* WeChat */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: '#07C16018', border: '1px solid #07C16030' }}>
              <Phone size={18} style={{ color: '#07C160' }} />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">WeChat</p>
              <p className="text-xs text-gray-500 font-mono">{CONTACT.wechat}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {isAr ? 'للتواصل مع عملاء الصين والتحقق من المنتجات' : 'For China-based clients & product verification'}
              </p>
            </div>
          </div>
          <div className="text-xs text-gray-500 italic">
            {isAr ? 'ابحث عن المعرف على WeChat' : 'Search the ID on WeChat'}
          </div>
        </div>

        {/* FAQ */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">
            {isAr ? 'أسئلة شائعة' : 'Frequently Asked Questions'}
          </h2>
          <div className="space-y-3">
            {FAQS.map(({ q_en, q_ar, a_en, a_ar }) => (
              <details key={q_en}
                className="rounded-xl border border-white/10 bg-white/[0.02] group">
                <summary className="px-5 py-4 text-sm font-medium text-white cursor-pointer list-none flex justify-between items-center gap-3">
                  <span>{isAr ? q_ar : q_en}</span>
                  <span className="text-gray-500 group-open:rotate-45 transition-transform flex-shrink-0 text-lg leading-none">+</span>
                </summary>
                <div className="px-5 pb-4">
                  <p className="text-sm text-gray-400 leading-relaxed">{isAr ? a_ar : a_en}</p>
                </div>
              </details>
            ))}
          </div>
        </div>

      </div>
    </ShopLayout>
  )
}
