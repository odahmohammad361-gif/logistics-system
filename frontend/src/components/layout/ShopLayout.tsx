import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UserCircle2, LogOut, ShoppingBag, Globe } from 'lucide-react'
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

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { customer, token, setAuth, clearAuth } = useShopStore()
  const { lang, setLang } = useUIStore()
  const navigate = useNavigate()

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
      setAuthError('Invalid email or password')
    }
  }

  async function handleSignup(v: SignupForm) {
    setAuthError('')
    try {
      const res = await shopSignup({
        full_name: v.full_name,
        email: v.email,
        phone: v.phone,
        telegram: v.telegram || undefined,
        country: v.country,
        password: v.password,
      })
      setAuth(res.access_token, res.customer)
      setAuthModal(null)
      signupForm.reset()
    } catch (err: any) {
      setAuthError(err?.response?.data?.detail ?? 'Sign up failed')
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#0a0f1e' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-md"
        style={{ background: 'rgba(4,13,26,0.95)' }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/shop" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#6366F1,#818CF8)', boxShadow: '0 0 12px rgba(99,102,241,.4)' }}>
              <ShoppingBag size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">{t('app.name')}</p>
              <p className="text-[10px] text-brand-primary-light">{t('app.tagline')}</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link to="/shop" className="text-gray-400 hover:text-white transition-colors">
              {t('shop.browse')}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Switch Language"
            >
              <Globe size={17} />
            </button>

            {customer ? (
              <div className="flex items-center gap-2">
                <Link to="/shop/profile"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary/10 text-brand-primary-light text-sm hover:bg-brand-primary/20 transition-colors">
                  <UserCircle2 size={15} />
                  <span className="hidden sm:inline">{customer.full_name.split(' ')[0]}</span>
                </Link>
                <button
                  onClick={() => { clearAuth(); navigate('/shop') }}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title={t('shop.logout')}
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setAuthError(''); setAuthModal('login') }}
                  className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  {t('shop.login')}
                </button>
                <button
                  onClick={() => { setAuthError(''); setAuthModal('signup') }}
                  className="px-3 py-1.5 text-sm rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
                >
                  {t('shop.signup')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* Login modal */}
      <Modal open={authModal === 'login'} onClose={() => setAuthModal(null)} title={t('shop.login')} size="sm">
        <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
          {authError && (
            <div className="px-3 py-2 rounded-lg bg-brand-red/10 border border-brand-red/30 text-xs text-brand-red">
              {authError}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="label-base">{t('common.email')}</label>
            <input type="email" className="input-base w-full" {...loginForm.register('email', { required: true })} />
          </div>
          <div className="space-y-1.5">
            <label className="label-base">{t('shop.password')}</label>
            <input type="password" className="input-base w-full" {...loginForm.register('password', { required: true })} />
          </div>
          <div className="flex justify-between items-center pt-1">
            <button type="button" onClick={() => setAuthModal('signup')}
              className="text-xs text-brand-primary-light hover:underline">
              {t('shop.no_account')}
            </button>
            <Button type="submit" loading={loginForm.formState.isSubmitting}>
              {t('shop.login')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Signup modal */}
      <Modal open={authModal === 'signup'} onClose={() => setAuthModal(null)} title={t('shop.signup')} size="md">
        <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
          {authError && (
            <div className="px-3 py-2 rounded-lg bg-brand-red/10 border border-brand-red/30 text-xs text-brand-red">
              {authError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="label-base">{t('shop.full_name')}</label>
              <input className="input-base w-full" {...signupForm.register('full_name', { required: true })} />
            </div>
            <div className="space-y-1.5">
              <label className="label-base">{t('common.email')}</label>
              <input type="email" className="input-base w-full" {...signupForm.register('email', { required: true })} />
            </div>
            <div className="space-y-1.5">
              <label className="label-base">{t('shop.phone')}</label>
              <input className="input-base w-full" {...signupForm.register('phone', { required: true })} />
            </div>
            <div className="space-y-1.5">
              <label className="label-base">{t('shop.telegram')}</label>
              <input className="input-base w-full" placeholder="@username" {...signupForm.register('telegram')} />
            </div>
            <div className="space-y-1.5">
              <label className="label-base">{t('shop.country')}</label>
              <input className="input-base w-full" {...signupForm.register('country', { required: true })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="label-base">{t('shop.password')}</label>
              <input type="password" className="input-base w-full" {...signupForm.register('password', { required: true })} />
            </div>
          </div>
          <div className="flex justify-between items-center pt-1">
            <button type="button" onClick={() => setAuthModal('login')}
              className="text-xs text-brand-primary-light hover:underline">
              {t('shop.already_account')}
            </button>
            <Button type="submit" loading={signupForm.formState.isSubmitting}>
              {t('shop.signup')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
