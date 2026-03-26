import { useTranslation } from 'react-i18next'
import { Building2, MapPin, Phone, Globe, Mail } from 'lucide-react'

const BRANCHES = [
  {
    key: 'china',
    flag: '🇨🇳',
    name_ar: 'الفرع الصيني',
    name_en: 'China Branch',
    city: 'Guangzhou',
    details: 'Guangdong Province, China',
    phone: '',
    email: '',
  },
  {
    key: 'jordan',
    flag: '🇯🇴',
    name_ar: 'الفرع الأردني',
    name_en: 'Jordan Branch',
    city: 'Amman',
    details: 'Amman, Jordan',
    phone: '',
    email: '',
  },
  {
    key: 'iraq',
    flag: '🇮🇶',
    name_ar: 'الفرع العراقي',
    name_en: 'Iraq Branch',
    city: 'Baghdad',
    details: 'Baghdad, Iraq',
    phone: '',
    email: '',
  },
]

export default function CompanyPage() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="page-title">{t('company.title')}</h1>
      </div>

      {/* Company identity */}
      <div className="card space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-green flex items-center justify-center shrink-0">
            <span className="text-2xl font-black text-black">WI</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">胡萨姆贸易公司有限公司</h2>
            <p className="text-base text-gray-300">شركة أرض الوسام للتجارة والشحن</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-3 text-gray-400">
            <Building2 size={16} className="mt-0.5 shrink-0 text-brand-green" />
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{t('company.business_type')}</p>
              <p className="text-white">{t('company.freight_forwarding')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 text-gray-400">
            <Globe size={16} className="mt-0.5 shrink-0 text-brand-green" />
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{t('company.operating_regions')}</p>
              <p className="text-white">{t('company.china_jordan_iraq')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Branches */}
      <div>
        <h2 className="text-sm font-semibold text-brand-green border-b border-brand-border pb-2 mb-4">
          {t('company.branches')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {BRANCHES.map((branch) => (
            <div key={branch.key} className="card space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{branch.flag}</span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {isAr ? branch.name_ar : branch.name_en}
                  </p>
                  <p className="text-xs text-gray-500">{branch.city}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-gray-500" />
                  <span>{branch.details}</span>
                </div>
                {branch.phone ? (
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="text-gray-500" />
                    <span>{branch.phone}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="text-gray-500" />
                    <span className="text-gray-600">{t('company.contact_pending')}</span>
                  </div>
                )}
                {branch.email ? (
                  <div className="flex items-center gap-2">
                    <Mail size={12} className="text-gray-500" />
                    <span>{branch.email}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-600 italic">{t('company.info_update_notice')}</p>
    </div>
  )
}
