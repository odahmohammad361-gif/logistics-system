import { CURRENCIES, useShopCurrency } from '@/hooks/useShopCurrency'

export default function CurrencySelector() {
  const { currency, setCurrency } = useShopCurrency()

  return (
    <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
      {CURRENCIES.map((c) => (
        <button
          key={c}
          onClick={() => setCurrency(c)}
          className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all ${
            currency === c
              ? 'bg-brand-primary text-white shadow'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}
