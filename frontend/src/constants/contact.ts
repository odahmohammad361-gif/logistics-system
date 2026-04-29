export type ContactCountry = {
  value: string
  iso2: string
  flag: string
  dialCode: string
  label: string
  labelAr: string
}

export type RegionOption = {
  value: string
  label: string
  labelAr: string
}

export const CONTACT_COUNTRIES: ContactCountry[] = [
  { value: 'Jordan', iso2: 'JO', flag: '🇯🇴', dialCode: '+962', label: 'Jordan', labelAr: 'الأردن' },
  { value: 'China', iso2: 'CN', flag: '🇨🇳', dialCode: '+86', label: 'China', labelAr: 'الصين' },
  { value: 'Iraq', iso2: 'IQ', flag: '🇮🇶', dialCode: '+964', label: 'Iraq', labelAr: 'العراق' },
]

export const REGION_OPTIONS_BY_COUNTRY: Record<string, RegionOption[]> = {
  Jordan: [
    { value: 'Amman', label: 'Amman', labelAr: 'عمان' },
    { value: 'Irbid', label: 'Irbid', labelAr: 'إربد' },
    { value: 'Zarqa', label: 'Zarqa', labelAr: 'الزرقاء' },
    { value: 'Balqa', label: 'Balqa', labelAr: 'البلقاء' },
    { value: 'Madaba', label: 'Madaba', labelAr: 'مادبا' },
    { value: 'Karak', label: 'Karak', labelAr: 'الكرك' },
    { value: 'Tafilah', label: 'Tafilah', labelAr: 'الطفيلة' },
    { value: "Ma'an", label: "Ma'an", labelAr: 'معان' },
    { value: 'Aqaba', label: 'Aqaba', labelAr: 'العقبة' },
    { value: 'Jerash', label: 'Jerash', labelAr: 'جرش' },
    { value: 'Ajloun', label: 'Ajloun', labelAr: 'عجلون' },
    { value: 'Mafraq', label: 'Mafraq', labelAr: 'المفرق' },
  ],
  Iraq: [
    { value: 'Baghdad', label: 'Baghdad', labelAr: 'بغداد' },
    { value: 'Basra', label: 'Basra', labelAr: 'البصرة' },
    { value: 'Nineveh', label: 'Nineveh', labelAr: 'نينوى' },
    { value: 'Erbil', label: 'Erbil', labelAr: 'أربيل' },
    { value: 'Sulaymaniyah', label: 'Sulaymaniyah', labelAr: 'السليمانية' },
    { value: 'Duhok', label: 'Duhok', labelAr: 'دهوك' },
    { value: 'Kirkuk', label: 'Kirkuk', labelAr: 'كركوك' },
    { value: 'Diyala', label: 'Diyala', labelAr: 'ديالى' },
    { value: 'Anbar', label: 'Anbar', labelAr: 'الأنبار' },
    { value: 'Babil', label: 'Babil', labelAr: 'بابل' },
    { value: 'Karbala', label: 'Karbala', labelAr: 'كربلاء' },
    { value: 'Najaf', label: 'Najaf', labelAr: 'النجف' },
    { value: 'Qadisiyah', label: 'Qadisiyah', labelAr: 'القادسية' },
    { value: 'Muthanna', label: 'Muthanna', labelAr: 'المثنى' },
    { value: 'Dhi Qar', label: 'Dhi Qar', labelAr: 'ذي قار' },
    { value: 'Maysan', label: 'Maysan', labelAr: 'ميسان' },
    { value: 'Wasit', label: 'Wasit', labelAr: 'واسط' },
    { value: 'Saladin', label: 'Saladin', labelAr: 'صلاح الدين' },
    { value: 'Halabja', label: 'Halabja', labelAr: 'حلبجة' },
  ],
  China: [
    { value: 'Guangzhou', label: 'Guangzhou', labelAr: 'غوانزو' },
    { value: 'Shenzhen', label: 'Shenzhen', labelAr: 'شينزن' },
    { value: 'Shanghai', label: 'Shanghai', labelAr: 'شنغهاي' },
    { value: 'Foshan', label: 'Foshan', labelAr: 'فوشان' },
    { value: 'Dongguan', label: 'Dongguan', labelAr: 'دونغقوان' },
    { value: 'Yiwu', label: 'Yiwu', labelAr: 'ييوو' },
    { value: 'Ningbo', label: 'Ningbo', labelAr: 'نينغبو' },
    { value: 'Hangzhou', label: 'Hangzhou', labelAr: 'هانغتشو' },
    { value: 'Qingdao', label: 'Qingdao', labelAr: 'تشينغداو' },
    { value: 'Tianjin', label: 'Tianjin', labelAr: 'تيانجين' },
    { value: 'Beijing', label: 'Beijing', labelAr: 'بكين' },
    { value: 'Chengdu', label: 'Chengdu', labelAr: 'تشنغدو' },
    { value: 'Wuhan', label: 'Wuhan', labelAr: 'ووهان' },
  ],
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeCountryValue(value: string | null | undefined) {
  const raw = (value ?? '').trim()
  const key = raw.toLowerCase()
  if (['jo', 'jor', 'jordan', 'الأردن'].includes(key)) return 'Jordan'
  if (['cn', 'chn', 'china', 'الصين'].includes(key)) return 'China'
  if (['iq', 'irq', 'iraq', 'العراق'].includes(key)) return 'Iraq'
  return raw
}

export function localizedCountryOptions(isAr: boolean, includeBlank = true) {
  const blank = includeBlank ? [{ value: '', label: isAr ? '— اختر دولة —' : '— Select country —' }] : []
  return [
    ...blank,
    ...CONTACT_COUNTRIES.map((country) => ({
      value: country.value,
      label: `${country.flag} ${isAr ? country.labelAr : country.label}`,
    })),
  ]
}

export function localizedRegionOptions(country: string | null | undefined, isAr: boolean, includeBlank = true) {
  const normalized = normalizeCountryValue(country)
  const regions = REGION_OPTIONS_BY_COUNTRY[normalized] ?? []
  const blank = includeBlank ? [{ value: '', label: isAr ? '— اختر المنطقة —' : '— Select region —' }] : []
  return [
    ...blank,
    ...regions.map((region) => ({
      value: region.value,
      label: isAr ? region.labelAr : region.label,
    })),
  ]
}

export function defaultDialCodeForCountry(country: string | null | undefined) {
  const normalized = normalizeCountryValue(country)
  return CONTACT_COUNTRIES.find((item) => item.value === normalized)?.dialCode ?? '+962'
}

export function stripPhoneDigits(value: string | null | undefined) {
  return (value ?? '').replace(/\D/g, '')
}

export function splitPhone(value: string | null | undefined, fallbackDialCode = '+962') {
  const raw = (value ?? '').trim()
  const digits = stripPhoneDigits(raw)
  const matched = CONTACT_COUNTRIES.find((country) => raw.startsWith(country.dialCode) || digits.startsWith(country.dialCode.slice(1)))
  if (!matched) return { dialCode: fallbackDialCode, local: digits.slice(0, 12) }
  const codeDigits = matched.dialCode.slice(1)
  const local = digits.startsWith(codeDigits) ? digits.slice(codeDigits.length) : digits
  return { dialCode: matched.dialCode, local: local.slice(0, 12) }
}

export function composePhone(dialCode: string, local: string) {
  const digits = stripPhoneDigits(local).slice(0, 12)
  return digits ? `${dialCode}${digits}` : ''
}

export function validatePhoneValue(value: string | null | undefined, optional = true) {
  const raw = (value ?? '').trim()
  if (!raw) return optional
  const { local } = splitPhone(raw)
  return local.length >= 8 && local.length <= 12
}

export function validateEmailValue(value: string | null | undefined, optional = true) {
  const raw = (value ?? '').trim()
  if (!raw) return optional
  return EMAIL_PATTERN.test(raw)
}

export function containsArabicScript(value: string | null | undefined) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(value ?? '')
}

export function containsLatinScript(value: string | null | undefined) {
  return /[A-Za-z]/.test(value ?? '')
}

export function validateEnglishNameValue(value: string | null | undefined, optional = false) {
  const raw = (value ?? '').trim()
  if (!raw) return optional
  return !containsArabicScript(raw)
}

export function validateArabicNameValue(value: string | null | undefined, optional = true) {
  const raw = (value ?? '').trim()
  if (!raw) return optional
  return !containsLatinScript(raw)
}
