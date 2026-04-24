import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          // Defined as CSS vars — the globals.css overrides ensure runtime theme switching works.
          // Tailwind still generates opacity variants (e.g. bg-brand-primary/10) via its own mechanism.
          bg:              'var(--brand-bg)',
          surface:         'var(--brand-surface)',
          card:            'var(--brand-card)',
          primary:         'var(--brand-primary)',
          'primary-dark':  'var(--brand-primary-dark)',
          'primary-light': 'var(--brand-primary-light)',
          text:            'var(--brand-text)',
          'text-muted':    'var(--brand-text-muted)',
          'text-dim':      'var(--brand-text-dim)',
          red:             'var(--brand-red)',
          green:           'var(--brand-green)',
          'green-dim':     'var(--brand-green-dim)',
          navy:            'var(--brand-navy)',
          'navy-light':    'var(--brand-navy-light)',
          border:          'var(--brand-border)',
          'border-light':  'var(--brand-border-light)',
          'border-focus':  'var(--brand-border-focus)',
        },
      },
      fontFamily: {
        arabic: ['Cairo', 'Noto Kufi Arabic', 'sans-serif'],
        sans:   ['Inter', 'Cairo', 'sans-serif'],
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'ticker':   'ticker 30s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { transform: 'translateY(-8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        slideUp: { from: { transform: 'translateY(100%)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        ticker:  { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(-100%)' } },
      },
    },
  },
  plugins: [],
} satisfies Config
