import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UserCircle2, LogOut, ShoppingBag, Globe, Menu, X } from 'lucide-react'
import { useShopStore } from '@/store/shopStore'
import { useUIStore } from '@/store/uiStore'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useForm } from 'react-hook-form'
import { shopLogin, shopSignup } from '@/services/shopService'

interface LoginForm { email: string; password: string }
interface SignupForm {
  full_name: string; email: string; phone: string
  telegram: string; country: string; password: string
}

const NAV_LINKS = [
  { to: '/shop',             en: 'Home',        ar: 'الرئيسية' },
  { to: '/shop/products',    en: 'Products',    ar: 'المنتجات' },
  { to: '/shop/calculator',  en: 'Calculator',  ar: 'حاسبة الشحن' },
  { to: '/shop/how-it-works',en: 'How It Works',ar: 'كيف يعمل' },
  { to: '/shop/about',       en: 'About',       ar: 'عن الشركة' },
  { to: '/shop/contact',     en: 'Contact',     ar: 'تواصل معنا' },
]

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'

  const { customer, setAuth, clearAuth } = useShopStore()
  const { lang, setLang } = useUIStore()
  const navigate = useNavigate()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [authModal, setAuthModal] = useState<'login' | 'signup' | null>(null)
  const [authError, setAuthError] = useState('')

  const loginForm = useForm<LoginForm>()
  const signupForm = useForm<SignupForm>()

  async function handleLogin(v: LoginForm) {
    setAuthError('')
    try {
      const res = await shopLogin(v)
      setAuth(res.access_token, res.customer)
      setAuthModal(null)
      loginForm.reset()
    } catch {
      setAuthError(isAr ? 'بريد إلكتروني أو كلمة مرور خاطئة' : 'Invalid email or password')
    }
  }

  async function handleSignup(v: SignupForm) {
    setAuthError('')
    try {
      const res = await shopSignup({
        full_name: v.full_name, email: v.email, phone: v.phone,
        telegram: v.telegram || undefined, country: v.country, password: v.password,
      })
      setAuth(res.access_token, res.customer)
      setAuthModal(null)
      signupForm.reset()
    } catch (err: any) {
      setAuthError(err?.response?.data?.detail ?? (isAr ? 'فشل التسجيل' : 'Sign up failed'))
    }
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm transition-colors ${isActive ? 'text-white font-medium' : 'text-gray-400 hover:text-white'}`

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0f1e' }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-md flex-shrink-0"
        style={{ background: 'rgba(4,13,26,0.95)' }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link to="/shop" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#6366F1,#818CF8)', boxShadow: '0 0 12px rgba(99,102,241,.4)' }}>
              <ShoppingBag size={15} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-white leading-tight truncate max-w-[160px]">
                {isAr ? 'أرض الوسام' : 'Ard Al-Wisam'}
              </p>
              <p className="text-[10px] text-brand-primary-light">
                {isAr ? 'تجارة وشحن' : 'Trading & Shipping'}
              </p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-5">
            {NAV_LINKS.map(({ to, en, ar }) => (
              <NavLink key={to} to={to} end={to === '/shop'} className={navLinkClass}>
                {isAr ? ar : en}
              </NavLink>
            ))}
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setLang(lang === 'ar' ? 'en' : 'ar'); i18n.changeLanguage(lang === 'ar' ? 'en' : 'ar') }}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors text-xs font-bold"
            >
              {lang === 'ar' ? 'EN' : 'عر'}
            </button>

            {customer ? (
              <div className="flex items-center gap-1.5">
                <Link to="/shop/profile"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-primary/10 text-brand-primary-light text-sm hover:bg-brand-primary/20 transition-colors">
                  <UserCircle2 size={15} />
                  <span className="hidden sm:inline max-w-[80px] truncate text-xs">
                    {customer.full_name.split(' ')[0]}
                  </span>
                </Link>
                <button
                  onClick={() => { clearAuth(); navigate('/shop') }}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={() => { setAuthError(''); setAuthModal('login') }}
                  className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {isAr ? 'دخول' : 'Login'}
                </button>
                <button
                  onClick={() => { setAuthError(''); setAuthModal('signup') }}
                  className="px-3 py-1.5 text-sm rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
                >
                  {isAr ? 'تسجيل' : 'Sign Up'}
                </button>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-white/10 px-4 py-4 space-y-1"
            style={{ background: 'rgba(4,13,26,0.98)' }}>
            {NAV_LINKS.map(({ to, en, ar }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/shop'}
                className={({ isActive }) =>
                  `block px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-brand-primary/10 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`
                }
                onClick={() => setMobileOpen(false)}
              >
                {isAr ? ar : en}
              </NavLink>
            ))}
            {!customer && (
              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => { setAuthError(''); setAuthModal('login'); setMobileOpen(false) }}
                  className="flex-1 py-2 text-sm text-center border border-white/15 rounded-lg text-gray-300 hover:bg-white/5 transition-colors"
                >
                  {isAr ? 'دخول' : 'Login'}
                </button>
                <button
                  onClick={() => { setAuthError(''); setAuthModal('signup'); setMobileOpen(false) }}
                  className="flex-1 py-2 text-sm text-center rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
                >
                  {isAr ? 'تسجيل' : 'Sign Up'}
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── Main ───────────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 mt-12 flex-shrink-0"
        style={{ background: 'rgba(4,13,26,0.8)' }}>
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid sm:grid-cols-3 gap-8">
            {/* Brand */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#6366F1,#818CF8)' }}>
                  <ShoppingBag size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {isAr ? 'أرض الوسام' : 'Ard Al-Wisam'}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {isAr ? 'تجارة وشحن' : 'Trading & Shipping'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {isAr
                  ? 'شريكك في استيراد الجملة من الصين إلى الأردن والعراق.'
                  : 'Your wholesale import partner from China to Jordan & Iraq.'}
              </p>
              <div className="flex gap-1">
                {['🇨🇳', '🇯🇴', '🇮🇶'].map(f => (
                  <span key={f} className="text-lg">{f}</span>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {isAr ? 'روابط سريعة' : 'Quick Links'}
              </p>
              <div className="space-y-2">
                {NAV_LINKS.map(({ to, en, ar }) => (
                  <Link key={to} to={to}
                    className="block text-sm text-gray-500 hover:text-white transition-colors">
                    {isAr ? ar : en}
                  </Link>
                ))}
              </div>
            </div>

            {/* Contact snippet */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {isAr ? 'تواصل معنا' : 'Contact'}
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <p>💬 WhatsApp / Telegram</p>
                <p>🇨🇳 {isAr ? 'قوانغتشو، الصين' : 'Guangzhou, China'}</p>
                <p>🇯🇴 {isAr ? 'الأردن' : 'Jordan'} · 🇮🇶 {isAr ? 'العراق' : 'Iraq'}</p>
                <Link to="/shop/contact"
                  className="inline-block mt-2 text-xs text-brand-primary-light hover:underline">
                  {isAr ? 'عرض كل بيانات التواصل ←' : 'View all contact info →'}
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 mt-8 pt-6 flex flex-wrap justify-between items-center gap-3">
            <p className="text-xs text-gray-600">
              © {new Date().getFullYear()} {isAr ? 'أرض الوسام للتجارة والشحن' : 'Ard Al-Wisam Trading & Shipping'}. {isAr ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-600">
              <Globe size={12} />
              <span>{isAr ? 'عربي / English' : 'Arabic / English'}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Login modal ─────────────────────────────────────────── */}
      <Modal open={authModal === 'login'} onClose={() => setAuthModal(null)}
        title={isAr ? 'تسجيل الدخول' : 'Login'} size="sm">
        <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
          {authError && (
            <div className="px-3 py-2 rounded-lg bg-brand-red/10 border border-brand-red/30 text-xs text-brand-red">
              {authError}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="label-base">{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
            <input type="email" className="input-base w-full"
              {...loginForm.register('email', { required: true })} />
          </div>
          <div className="space-y-1.5">
            <label className="label-base">{isAr ? 'كلمة المرور' : 'Password'}</label>
            <input type="password" className="input-base w-full"
              {...loginForm.register('password', { required: true })} />
          </div>
          <div className="flex justify-between items-center pt-1">
            <button type="button" onClick={() => setAuthModal('signup')}
              className="text-xs text-brand-primary-light hover:underline">
              {isAr ? 'ليس لديك حساب؟' : "Don't have an account?"}
            </button>
            <Button type="submit" loading={loginForm.formState.isSubmitting}>
              {isAr ? 'دخول' : 'Login'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Signup modal ────────────────────────────────────────── */}
      <Modal open={authModal === 'signup'} onClose={() => setAuthModal(null)}
        title={isAr ? 'إنشاء حساب' : 'Create Account'} size="md">
        <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
          {authError && (
            <div className="px-3 py-2 rounded-lg bg-brand-red/10 border border-brand-red/30 text-xs text-brand-red">
              {authError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="label-base">{isAr ? 'الاسم الكامل' : 'Full Name'}</label>
              <input className="input-base w-full"
                {...signupForm.register('full_name', { required: true })} />
            </div>
            <div className="space-y-1.5">
              <label className="label-base">{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
              <input type="email" className="input-base w-full"
                {...signupForm.register('email', { required: true })} />
            </div>
            <div className="space-y-1.5">
              <label className="label-base">{isAr ? 'رقم الهاتف' : 'Phone'}</label>
              <input className="input-base w-full"
                {...signupForm.register('phone', { required: true })} />
            </div>
            <div className="space-y-1.5">
              <label className="label-base">{isAr ? 'تيليجرام (اختياري)' : 'Telegram (optional)'}</label>
              <input className="input-base w-full" placeholder="@username"
                {...signupForm.register('telegram')} />
            </div>
            <div className="space-y-1.5">
              <label className="label-base">{isAr ? 'الدولة' : 'Country'}</label>
              <input className="input-base w-full"
                {...signupForm.register('country', { required: true })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="label-base">{isAr ? 'كلمة المرور' : 'Password'}</label>
              <input type="password" className="input-base w-full"
                {...signupForm.register('password', { required: true })} />
            </div>
          </div>
          <div className="flex justify-between items-center pt-1">
            <button type="button" onClick={() => setAuthModal('login')}
              className="text-xs text-brand-primary-light hover:underline">
              {isAr ? 'لديك حساب بالفعل؟' : 'Already have an account?'}
            </button>
            <Button type="submit" loading={signupForm.formState.isSubmitting}>
              {isAr ? 'إنشاء حساب' : 'Sign Up'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
