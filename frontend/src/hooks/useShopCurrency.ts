import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'

type Currency = 'CNY' | 'USD' | 'JOD' | 'IQD'

interface CurrencyStore {
  currency: Currency
  setCurrency: (c: Currency) => void
}

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set) => ({
      currency: 'CNY',
      setCurrency: (currency) => set({ currency }),
    }),
    { name: 'shop-currency' }
  )
)

const FALLBACK_RATES: Record<string, number> = {
  CNY: 7.23,
  USD: 1.0,
  JOD: 0.709,
  IQD: 1308.0,
}

const SYMBOLS: Record<Currency, string> = {
  CNY: '¥',
  USD: '$',
  JOD: 'JD',
  IQD: 'IQD',
}

export function useShopCurrency() {
  const { currency, setCurrency } = useCurrencyStore()

  const { data } = useQuery({
    queryKey: ['shop-rates'],
    queryFn: () => api.get('/shop/rates').then((r) => r.data),
    staleTime: 30 * 60 * 1000,
  })

  const rates: Record<string, number> = data?.rates ?? FALLBACK_RATES

  function formatPrice(cnyAmount: number | string | null | undefined): string {
    const amount = Number(cnyAmount)
    if (!amount || isNaN(amount)) return '—'

    const usdAmount = amount / (rates.CNY ?? 7.23)

    switch (currency) {
      case 'USD': {
        return `$${usdAmount.toFixed(2)}`
      }
      case 'JOD': {
        const jod = usdAmount * (rates.JOD ?? 0.709)
        return `JD ${jod.toFixed(3)}`
      }
      case 'IQD': {
        const iqd = usdAmount * (rates.IQD ?? 1308)
        return `IQD ${Math.round(iqd).toLocaleString()}`
      }
      default: // CNY
        return `¥${amount.toFixed(2)}`
    }
  }

  return { currency, setCurrency, formatPrice, rates, symbol: SYMBOLS[currency] }
}

export const CURRENCIES: Currency[] = ['CNY', 'USD', 'JOD', 'IQD']
