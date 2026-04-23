import { useTranslation } from 'react-i18next'
import { Navigate, Link } from 'react-router-dom'
import { UserCircle2, CheckCircle2, Clock, ArrowLeft } from 'lucide-react'
import { useShopStore } from '@/store/shopStore'
import ShopLayout from '@/components/layout/ShopLayout'

export default function ShopProfile() {
  const { t } = useTranslation()
  const { customer } = useShopStore()

  if (!customer) return <Navigate to="/shop" replace />

  return (
    <ShopLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={14} />
          {t('common.back')}
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-brand-primary-light"
              style={{ background: 'rgba(99,102,241,0.15)', border: '2px solid rgba(99,102,241,0.3)' }}>
              {customer.full_name[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{customer.full_name}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                {customer.is_verified ? (
                  <>
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    <span className="text-xs text-emerald-400">{t('shop.verified')}</span>
                  </>
                ) : (
                  <>
                    <Clock size={13} className="text-yellow-500" />
                    <span className="text-xs text-yellow-500">{t('shop.not_verified')}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {[
              { label: t('common.email'), value: customer.email },
              { label: t('shop.phone'), value: customer.phone },
              { label: 'Telegram', value: customer.telegram ?? '—' },
              { label: t('shop.country'), value: customer.country },
              { label: 'Member since', value: new Date(customer.created_at).toLocaleDateString() },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-2.5 border-b border-white/5">
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-sm text-gray-200">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ShopLayout>
  )
}
