import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  CONTACT_COUNTRIES,
  composePhone,
  defaultDialCodeForCountry,
  splitPhone,
  stripPhoneDigits,
} from '@/constants/contact'

interface PhoneInputProps {
  label?: string
  value?: string | null
  onChange: (value: string) => void
  error?: string
  hint?: string
  disabled?: boolean
  country?: string | null
  required?: boolean
}

export default function PhoneInput({
  label,
  value,
  onChange,
  error,
  hint,
  disabled,
  country,
  required,
}: PhoneInputProps) {
  const fallbackDialCode = defaultDialCodeForCountry(country)
  const parsed = useMemo(() => splitPhone(value, fallbackDialCode), [value, fallbackDialCode])
  const [dialCode, setDialCode] = useState(parsed.dialCode)

  useEffect(() => {
    if (value) setDialCode(parsed.dialCode)
    if (!value && fallbackDialCode) setDialCode(fallbackDialCode)
  }, [value, parsed.dialCode, fallbackDialCode])

  useEffect(() => {
    const raw = (value ?? '').trim()
    if (raw && parsed.local && !raw.startsWith(parsed.dialCode)) {
      onChange(composePhone(parsed.dialCode, parsed.local))
    }
  }, [value, parsed.dialCode, parsed.local, onChange])

  function changeDialCode(nextDialCode: string) {
    setDialCode(nextDialCode)
    onChange(composePhone(nextDialCode, parsed.local))
  }

  function changeLocal(nextLocal: string) {
    onChange(composePhone(dialCode, stripPhoneDigits(nextLocal)))
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="label-base">
          {label}{required ? ' *' : ''}
        </label>
      )}
      <div
        className={clsx(
          'flex overflow-hidden rounded-lg border bg-brand-surface text-sm transition-all duration-200 focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary/30 hover:border-brand-border-light',
          error ? 'border-brand-red focus-within:ring-brand-red/30' : 'border-brand-border',
          disabled && 'opacity-60',
        )}
      >
        <select
          className="w-32 shrink-0 bg-transparent px-2 py-2.5 text-brand-text outline-none border-e border-brand-border cursor-pointer"
          value={dialCode}
          onChange={(event) => changeDialCode(event.target.value)}
          disabled={disabled}
          aria-label="Phone country code"
        >
          {CONTACT_COUNTRIES.map((item) => (
            <option key={item.dialCode} value={item.dialCode} style={{ background: '#061220' }}>
              {item.flag} {item.dialCode}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={12}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-brand-text placeholder-brand-text-muted outline-none"
          value={parsed.local}
          onChange={(event) => changeLocal(event.target.value)}
          placeholder="8-12 digits"
          disabled={disabled}
        />
      </div>
      {error && <p className="text-xs text-brand-red">{error}</p>}
      {!error && hint && <p className="text-xs text-brand-text-muted">{hint}</p>}
    </div>
  )
}
