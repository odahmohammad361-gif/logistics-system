import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { Barcode, Lock, AlertCircle, ArrowLeft } from 'lucide-react'
import ShopLayout from '@/components/layout/ShopLayout'
import { clientPortalLogin } from '@/services/clientPortalService'
import { useClientPortalStore } from '@/store/clientPortalStore'

interface FormValues { client_code: string; password: string }

export default function ClientLoginPage() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const navigate = useNavigate()
  const { setAuth } = useClientPortalStore()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>()

  async function onSubmit(v: FormValues) {
    setError(''); setLoading(true)
    try {
      const res = await clientPortalLogin(v.client_code.trim().toUpperCase(), v.password)
      setAuth(res.access_token, res.client)
      navigate('/shop/client-portal')
    } catch {
      setError(isAr ? 'رمز العميل أو كلمة المرور غير صحيحة' : 'Invalid client code or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ShopLayout>
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-full max-w-sm">

          {/* Back link */}
          <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
            <ArrowLeft size={14} />
            {isAr ? 'العودة للمتجر' : 'Back to shop'}
          </Link>

          {/* Card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 space-y-6">

            {/* Logo area */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center mx-auto">
                <Barcode size={26} className="text-brand-primary-light" />
              </div>
              <h1 className="text-xl font-bold text-white">
                {isAr ? 'بوابة العميل' : 'Client Portal'}
              </h1>
              <p className="text-sm text-gray-400">
                {isAr
                  ? 'ادخل رمز العميل وكلمة المرور للوصول إلى حسابك'
                  : 'Enter your client code and password to access your account'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                  {isAr ? 'رمز العميل' : 'Client Code'}
                </label>
                <div className="relative">
                  <Barcode size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    {...register('client_code', { required: true })}
                    placeholder="JO-0001"
                    className="input-base w-full ps-9 font-mono uppercase"
                    autoComplete="username"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                {errors.client_code && (
                  <p className="text-xs text-brand-red">{isAr ? 'مطلوب' : 'Required'}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                  {isAr ? 'كلمة المرور' : 'Password'}
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    {...register('password', { required: true })}
                    type="password"
                    placeholder="••••••••"
                    className="input-base w-full ps-9"
                    autoComplete="current-password"
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-brand-red">{isAr ? 'مطلوب' : 'Required'}</p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  <AlertCircle size={13} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-brand-primary text-white font-semibold text-sm hover:bg-brand-primary/90 disabled:opacity-60 transition-colors"
              >
                {loading
                  ? (isAr ? 'جارٍ الدخول...' : 'Signing in...')
                  : (isAr ? 'دخول' : 'Sign In')}
              </button>
            </form>

            <p className="text-center text-xs text-gray-500">
              {isAr
                ? 'كلمة المرور تُوفَّر من قِبَل مسؤول النظام'
                : 'Your password is provided by the system administrator'}
            </p>
          </div>
        </div>
      </div>
    </ShopLayout>
  )
}
