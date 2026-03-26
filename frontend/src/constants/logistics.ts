// Logistics reference constants — mirrors backend app/utils/constants.py

export const SHIPPING_TERMS = [
  'FOB', 'CFR', 'CIF', 'EXW', 'DDP', 'FCA', 'DAP', 'DDU',
]

export const PAYMENT_TERMS = [
  'T/T',
  'L/C',
  'Cash',
  'D/P',
  'D/A',
  '100% payment before shipping',
  '100% payment after shipping',
]

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
