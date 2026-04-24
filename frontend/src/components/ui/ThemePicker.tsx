import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Palette, Check } from 'lucide-react'
import { useThemeStore, THEMES } from '@/store/themeStore'
import clsx from 'clsx'

export default function ThemePicker() {
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const { themeId, setTheme } = useThemeStore()
  const [open, setOpen] = useState(false)

  const current = THEMES.find(t => t.id === themeId) ?? THEMES[0]

  return (
    <div className="relative">
      {/* Trigger button — shows current accent color dot */}
      <button
        onClick={() => setOpen(p => !p)}
        className={clsx(
          'flex items-center gap-2 p-2 rounded-lg transition-all',
          open ? 'bg-brand-surface' : 'hover:bg-white/5',
        )}
        title={isAr ? 'لون النظام' : 'Accent color'}
      >
        <div className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-white/20"
          style={{ background: current.color }} />
        <Palette size={13} className="text-brand-text-muted" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div
            className="absolute z-50 mt-2 rounded-2xl border border-brand-border shadow-2xl p-4 w-56"
            style={{
              background: 'var(--brand-card)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              [isAr ? 'right' : 'left']: 0,
            }}
          >
            <p className="text-[10px] font-semibold text-brand-text-muted uppercase tracking-widest mb-3">
              {isAr ? 'لون الواجهة' : 'Accent Color'}
            </p>

            <div className="grid grid-cols-4 gap-2">
              {THEMES.map((t) => {
                const active = themeId === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => { setTheme(t.id); setOpen(false) }}
                    className="flex flex-col items-center gap-1.5 group"
                    title={isAr ? t.nameAr : t.name}
                  >
                    {/* Color circle */}
                    <div className={clsx(
                      'w-9 h-9 rounded-full flex items-center justify-center transition-all',
                      'ring-2 ring-offset-2 ring-offset-brand-card',
                      active ? 'ring-white scale-110' : 'ring-transparent group-hover:ring-white/40 group-hover:scale-105',
                    )}
                      style={{ background: t.color }}>
                      {active && <Check size={14} className="text-white" strokeWidth={3} />}
                    </div>
                    {/* Label */}
                    <span className={clsx(
                      'text-[10px] leading-tight text-center transition-colors',
                      active ? 'text-brand-text' : 'text-brand-text-muted group-hover:text-brand-text',
                    )}>
                      {isAr ? t.nameAr : t.name}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Preview strip */}
            <div className="mt-4 pt-3 border-t border-brand-border/50">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--brand-border)' }}>
                  <div className="h-full w-2/3 rounded-full transition-all duration-300"
                    style={{ background: current.color }} />
                </div>
                <span className="text-[10px] text-brand-text-muted font-mono">{current.color}</span>
              </div>
              <p className="text-[10px] text-brand-text-muted mt-1.5">
                {isAr
                  ? `${isAr ? current.nameAr : current.name} — الخلفية ثابتة، يتغير لون التمييز فقط`
                  : `${current.name} — background stays, only accent changes`}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
