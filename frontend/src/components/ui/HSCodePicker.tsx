import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import type { HSCodeReference } from '@/types'

interface Props {
  label?: string
  value?: string | null
  references: HSCodeReference[]
  isRTL?: boolean
  placeholder?: string
  className?: string
  onChange: (hsCode: string, reference?: HSCodeReference) => void
}

function refLabel(ref: HSCodeReference, isRTL = false) {
  const description = isRTL && ref.description_ar ? ref.description_ar : ref.description
  const unit = ref.customs_unit_basis ? ` · ${ref.customs_unit_basis}` : ''
  return `${ref.country} · ${ref.hs_code} · ${description}${unit}`
}

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

export default function HSCodePicker({
  label,
  value,
  references,
  isRTL = false,
  placeholder,
  className,
  onChange,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const ref = references.find((item) => item.hs_code === value)
    setQuery(ref ? refLabel(ref, isRTL) : (value ?? ''))
  }, [value, references, isRTL])

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocumentClick)
    return () => document.removeEventListener('mousedown', onDocumentClick)
  }, [])

  const filtered = useMemo(() => {
    const q = normalize(query)
    const list = references.filter((ref) => {
      if (!q) return true
      return [
        ref.country,
        ref.hs_code,
        ref.chapter,
        ref.description,
        ref.description_ar,
        ref.customs_unit_basis,
      ].some((part) => normalize(part).includes(q))
    })
    return list.slice(0, 30)
  }, [references, query])

  function selectReference(ref: HSCodeReference) {
    setQuery(refLabel(ref, isRTL))
    setOpen(false)
    onChange(ref.hs_code, ref)
  }

  return (
    <div ref={wrapperRef} className={clsx('relative space-y-1.5', className)}>
      {label && <label className="label-base">{label}</label>}
      <input
        className="input-base w-full"
        value={query}
        dir={isRTL ? 'rtl' : 'ltr'}
        placeholder={placeholder ?? (isRTL ? 'ابحث بالرمز أو الوصف' : 'Search code or description')}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          const next = event.target.value
          setQuery(next)
          setOpen(true)
          const exact = references.find((ref) => ref.hs_code === next.trim())
          if (exact) onChange(exact.hs_code, exact)
          else if (!next.trim()) onChange('')
          else if (/^[0-9.\s-]{4,}$/.test(next.trim())) onChange(next.trim())
        }}
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-brand-border bg-[#061220] shadow-xl">
          {filtered.length ? filtered.map((ref) => (
            <button
              key={ref.id}
              type="button"
              className="block w-full px-3 py-2 text-start text-xs text-brand-text hover:bg-brand-primary/15"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectReference(ref)}
            >
              <span className="font-mono text-brand-primary-light">{ref.hs_code}</span>
              <span className="mx-1 text-brand-text-muted">·</span>
              <span>{isRTL && ref.description_ar ? ref.description_ar : ref.description}</span>
              <span className="ms-1 text-brand-text-muted">({ref.country})</span>
            </button>
          )) : (
            <div className="px-3 py-2 text-xs text-brand-text-muted">
              {isRTL ? 'لا توجد نتائج مطابقة' : 'No matching HS code'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
