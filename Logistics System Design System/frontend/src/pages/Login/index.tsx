import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Globe, Eye, EyeOff, Package, Users, FileText, TrendingUp } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { login, getMe } from '@/services/authService'
import Button from '@/components/ui/Button'

const FEATURES = [
  { icon: Package,    key: 'feature.containers' },
  { icon: FileText,   key: 'feature.invoices' },
  { icon: Users,      key: 'feature.clients' },
  { icon: TrendingUp, key: 'feature.market' },
]

const FEATURE_LABELS: Record<string, { ar: string; en: string }> = {
  'feature.containers': { ar: 'إدارة الحاويات', en: 'Container Management' },
  'feature.invoices':   { ar: 'الفواتير والمستندات', en: 'Invoices & Documents' },
  'feature.clients':    { ar: 'قاعدة بيانات العملاء', en: 'Client Database' },
  'feature.market':     { ar: 'لوحة السوق المباشر', en: 'Live Market Board' },
}

export default function LoginPage() {
  const { t, i18n } = useTranslation()
  const navigate    = useNavigate()
  const setAuth     = useAuthStore((s) => s.setAuth)
  const { lang, setLang } = useUIStore()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const token = await login(username, password)
      const user  = await getMe(token.access_token)
      setAuth(user, token.access_token, token.refresh_token)
      navigate('/', { replace: true })
    } catch {
      setError(t('auth.invalid_credentials', 'بيانات الدخول غير صحيحة'))
    } finally {
      setLoading(false)
    }
  }

  function toggleLang() {
    const next = lang === 'ar' ? 'en' : 'ar'
    setLang(next)
    i18n.changeLanguage(next)
    document.documentElement.lang = next
    document.documentElement.dir  = next === 'ar' ? 'rtl' : 'ltr'
  }

  const isAr = lang === 'ar'

  return (
    <div className="min-h-screen flex" style={{ background: '#030B18' }}>

      {/* ── Left Panel: Branding ───────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[55%] relative flex-col items-center justify-center p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #040D1A 0%, #0A1929 50%, #061220 100%)' }}
      >
        {/* Background glow orbs */}
        <div className="absolute top-1/4 start-1/4 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)' }} />
        <div className="absolute bottom-1/4 end-1/4 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)' }} />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#6366F1 1px, transparent 1px), linear-gradient(90deg, #6366F1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Logo */}
        <div className="relative z-10 flex flex-col items-center text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 animate-glow"
            style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)', boxShadow: '0 0 30px rgba(99,102,241,0.4)' }}
          >
            <span className="text-white font-black text-2xl">L</span>
          </div>

          <h1 className="text-3xl font-black text-brand-text mb-1">
            {isAr ? 'نظام اللوجستيك' : 'Logistics System'}
          </h1>
          <p className="text-brand-text-dim text-sm mb-1">胡萨姆贸易公司有限公司</p>
          <div className="flex gap-2 mt-2 mb-10">
            {['JO','CN','IQ'].map(b => (
              <span key={b} className="text-xs font-bold px-2.5 py-1 rounded-lg"
                style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818CF8' }}>
                {b}
              </span>
            ))}
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
            {FEATURES.map(({ icon: Icon, key }) => (
              <div key={key}
                className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-start"
                style={{ background: 'rgba(10,25,41,0.7)', border: '1px solid rgba(18,38,63,0.8)' }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.15)' }}>
                  <Icon size={14} className="text-brand-primary-light" />
                </div>
                <span className="text-xs text-brand-text-dim leading-tight">
                  {FEATURE_LABELS[key][isAr ? 'ar' : 'en']}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel: Login Form ───────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="absolute top-4 end-4 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all
                     text-brand-text-dim hover:text-brand-text border border-brand-border hover:border-brand-border-light hover:bg-white/5"
        >
          <Globe size={13} />
          {lang === 'ar' ? 'EN' : 'عر'}
        </button>

        <div className="w-full max-w-sm animate-slide-up">
          {/* Mobile logo */}
          <div className="text-center mb-8 lg:hidden">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
              style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)' }}
            >
              <span className="text-white font-black text-lg">L</span>
            </div>
            <h1 className="text-lg font-bold text-brand-text">{isAr ? 'نظام اللوجستيك' : 'Logistics System'}</h1>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-7"
            style={{
              background: 'rgba(10,25,41,0.8)',
              border: '1px solid rgba(18,38,63,0.9)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <div className="mb-6">
              <h2 className="text-lg font-bold text-brand-text">
                {t('auth.login', 'تسجيل الدخول')}
              </h2>
              <p className="text-sm text-brand-text-muted mt-0.5">
                {isAr ? 'أدخل بياناتك للمتابعة' : 'Enter your credentials to continue'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div className="space-y-1.5">
                <label className="label-base">{t('auth.username', 'اسم المستخدم')}</label>
                <input
                  className="input-base"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  placeholder={isAr ? 'admin@logistics.jo' : 'admin@logistics.jo'}
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="label-base">{t('auth.password', 'كلمة المرور')}</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input-base pe-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute top-1/2 end-3 -translate-y-1/2 text-brand-text-muted hover:text-brand-text transition-colors"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-brand-red bg-brand-red/8 border border-brand-red/20 rounded-lg px-3 py-2.5">
                  <span className="text-brand-red">✕</span>
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
                {t('auth.login', 'دخول')}
              </Button>
            </form>
          </div>

          <p className="text-center text-xs text-brand-text-muted mt-6">
            {isAr ? 'نظام إدارة لوجستي متكامل' : 'Integrated Logistics Management System'} · JO · CN · IQ
          </p>
        </div>
      </div>
    </div>
  )
}
