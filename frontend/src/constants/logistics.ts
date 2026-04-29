// Logistics reference constants — mirrors backend app/utils/constants.py

export const SHIPPING_TERMS = ['EXW', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP', 'FCA', 'CPT', 'CIP', 'DPU']

export const INCOTERM_LABELS: Record<string, { en: string; ar: string }> = {
  EXW: { en: 'Ex Works', ar: 'تسليم من مقر البائع' },
  FOB: { en: 'Free On Board', ar: 'تسليم على ظهر السفينة' },
  CFR: { en: 'Cost and Freight', ar: 'التكلفة والشحن' },
  CIF: { en: 'Cost, Insurance and Freight', ar: 'التكلفة والتأمين والشحن' },
  DAP: { en: 'Delivered At Place', ar: 'تسليم في المكان' },
  DDP: { en: 'Delivered Duty Paid', ar: 'تسليم خالص الرسوم' },
  FCA: { en: 'Free Carrier', ar: 'تسليم للناقل' },
  CPT: { en: 'Carriage Paid To', ar: 'النقل مدفوع إلى' },
  CIP: { en: 'Carriage and Insurance Paid To', ar: 'النقل والتأمين مدفوعان إلى' },
  DPU: { en: 'Delivered at Place Unloaded', ar: 'تسليم في المكان بعد التفريغ' },
}

export const PAYMENT_TERMS = [
  'T/T',
  'L/C',
  'Cash',
  'D/P',
  'D/A',
  '100% payment before shipping',
  '100% payment after shipping',
  '30% before shipping / 70% after shipping',
  '30% deposit / 70% before delivery',
  '50% deposit / 50% before shipping',
  '30% deposit / 40% before loading / 30% before release',
  'Net 7',
  'Net 15',
  'Net 30',
]

export const PAYMENT_TERM_LABELS: Record<string, { en: string; ar: string }> = {
  'T/T': { en: 'Telegraphic Transfer', ar: 'حوالة بنكية' },
  'L/C': { en: 'Letter of Credit', ar: 'اعتماد مستندي' },
  Cash: { en: 'Cash', ar: 'نقداً' },
  'D/P': { en: 'Documents Against Payment', ar: 'مستندات مقابل الدفع' },
  'D/A': { en: 'Documents Against Acceptance', ar: 'مستندات مقابل قبول' },
  '100% payment before shipping': { en: '100% payment before shipping', ar: 'دفع 100% قبل الشحن' },
  '100% payment after shipping': { en: '100% payment after shipping', ar: 'دفع 100% بعد الشحن' },
  '30% before shipping / 70% after shipping': { en: '30% before shipping / 70% after shipping', ar: '30% قبل الشحن / 70% بعد الشحن' },
  '30% deposit / 70% before delivery': { en: '30% deposit / 70% before delivery', ar: '30% دفعة مقدمة / 70% قبل التسليم' },
  '50% deposit / 50% before shipping': { en: '50% deposit / 50% before shipping', ar: '50% دفعة مقدمة / 50% قبل الشحن' },
  '30% deposit / 40% before loading / 30% before release': { en: '30% deposit / 40% before loading / 30% before release', ar: '30% مقدماً / 40% قبل التحميل / 30% قبل الإفراج' },
  'Net 7': { en: 'Net 7 days', ar: 'دفع خلال 7 أيام' },
  'Net 15': { en: 'Net 15 days', ar: 'دفع خلال 15 يوم' },
  'Net 30': { en: 'Net 30 days', ar: 'دفع خلال 30 يوم' },
}

export function localizedShippingTermOptions(isAr: boolean, includeBlank = true) {
  const blank = includeBlank ? [{ value: '', label: isAr ? '— اختر شرط الشحن —' : '— Select shipping term —' }] : []
  return [
    ...blank,
    ...SHIPPING_TERMS.map((term) => ({
      value: term,
      label: `${term} - ${INCOTERM_LABELS[term]?.[isAr ? 'ar' : 'en'] ?? term}`,
    })),
  ]
}

export function localizedPaymentTermOptions(isAr: boolean, includeBlank = true) {
  const blank = includeBlank ? [{ value: '', label: isAr ? '— اختر شروط الدفع —' : '— Select payment terms —' }] : []
  return [
    ...blank,
    ...PAYMENT_TERMS.map((term) => ({
      value: term,
      label: term.includes('%')
        ? (PAYMENT_TERM_LABELS[term]?.[isAr ? 'ar' : 'en'] ?? term)
        : `${term} - ${PAYMENT_TERM_LABELS[term]?.[isAr ? 'ar' : 'en'] ?? term}`,
    })),
  ]
}

export const STAMP_POSITIONS = [
  { value: 'top-left',     label: 'Top Left' },
  { value: 'top-right',    label: 'Top Right' },
  { value: 'bottom-left',  label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
]

export type PortMode = 'sea' | 'air'

export interface PortGroup {
  country: string
  mode: PortMode
  ports: string[]
}

export const PORTS_BY_COUNTRY: Record<string, { sea: string[]; air: string[] }> = {
  China: {
    sea: [
      'Nansha, Guangzhou',
      'Guangzhou',
      'Qingdao',
      'Shanghai',
      'Ningbo',
      'Yiwu',
      'Tianjin',
      'Shenzhen (Yantian)',
    ],
    air: [
      'Guangzhou Baiyun International Airport (CAN)',
      'Shanghai Pudong International Airport (PVG)',
      'Beijing Capital International Airport (PEK)',
      'Shenzhen Bao\'an International Airport (SZX)',
    ],
  },
  Jordan: {
    sea: ['Aqaba Port'],
    air: [
      'Queen Alia International Airport, Amman (AMM)',
      'King Hussein Airport, Aqaba (AQJ)',
    ],
  },
  Iraq: {
    sea: ['Basra UM QASR', 'Umm Qasr Port'],
    air: [
      'Baghdad International Airport (BGW)',
      'Basra International Airport (BSR)',
      'Erbil International Airport (EBL)',
      'Sulaymaniyah International Airport (ISU)',
    ],
  },
  'Saudi Arabia': {
    sea: [
      'Jeddah Islamic Port',
      'Dammam (King Abdulaziz Seaport)',
      'Jubail Commercial Port',
    ],
    air: [
      'Riyadh King Khalid International Airport (RUH)',
      'Jeddah King Abdulaziz International Airport (JED)',
      'Dammam King Fahd International Airport (DMM)',
    ],
  },
}

/** Flat list of all sea ports for a given mode */
export function getPortOptions(mode: PortMode): { group: string; options: string[] }[] {
  return Object.entries(PORTS_BY_COUNTRY).map(([country, p]) => ({
    group: country,
    options: p[mode],
  }))
}

/** All ports flattened to { value, label } for Select components */
export function getFlatPortOptions(mode?: PortMode) {
  const result: { value: string; label: string }[] = [{ value: '', label: '— Select port —' }]
  for (const [country, p] of Object.entries(PORTS_BY_COUNTRY)) {
    const ports = mode ? p[mode] : [...p.sea, ...p.air]
    for (const port of ports) {
      result.push({ value: port, label: `${port} (${country})` })
    }
  }
  return result
}

export const CONTAINER_LIMITS: Record<string, { max_weight_tons: number | null; max_cbm: number | null }> = {
  '20GP': { max_weight_tons: 28, max_cbm: 28 },
  '40FT': { max_weight_tons: 28, max_cbm: 68 },
  '40HQ': { max_weight_tons: 28, max_cbm: 76 },
  'AIR':  { max_weight_tons: null, max_cbm: null },
}

export const CONTAINER_TYPES = ['20GP', '40FT', '40HQ', 'AIR'] as const

/** IATA volumetric weight: L×W×H (cm) × cartons / 6000 */
export function calcVolumetricWeight(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
  cartons: number,
): number {
  return (lengthCm * widthCm * heightCm * cartons) / 6000
}

export function calcChargeableWeight(actualKg: number, volumetricKg: number): number {
  return Math.max(actualKg, volumetricKg)
}
