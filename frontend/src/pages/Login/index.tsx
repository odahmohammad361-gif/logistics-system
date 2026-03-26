import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { login, getMe } from '@/services/authService'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'
import { Globe } from 'lucide-react'

export default function LoginPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const { lang, setLang } = useUIStore()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const token = await login(username, password)
      const user = await getMe(token.access_token)
      setAuth(user, token.access_token, token.refresh_token)
      navigate('/', { replace: true })
    } catch {
      setError(t('auth.invalid_credentials'))
    } finally {
      setLoading(false)
    }
  }

  function toggleLang() {
    const next = lang === 'ar' ? 'en' : 'ar'
    setLang(next)
    i18n.changeLanguage(next)
    document.documentElement.lang = next
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr'
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      {/* Lang toggle */}
      <button
        onClick={toggleLang}
        className="fixed top-4 end-4 flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg bg-brand-surface border border-brand-border transition-colors"
      >
        <Globe size={14} />
        {lang === 'ar' ? 'EN' : 'AR'}
      </button>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-green mb-4">
            <span className="text-2xl font-black text-black">WI</span>
          </div>
          <h1 className="text-lg font-bold text-white">胡萨姆贸易公司有限公司</h1>
          <p className="text-sm text-gray-400 mt-1">شركة أرض الوسام للتجارة والشحن</p>
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-white mb-5">{t('auth.login')}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('auth.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
            <Input
              type="password"
              label={t('auth.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            {error && (
              <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
            )}
            <Button type="submit" loading={loading} className="w-full">
              {t('auth.login')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
