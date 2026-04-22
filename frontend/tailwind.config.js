import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg:             '#030B18',
          surface:        '#061220',
          card:           '#0A1929',
          sidebar:        '#040D1A',
          border:         '#12263F',
          'border-light': '#1E3A5F',
          primary:        '#6366F1',
          'primary-dark': '#4F46E5',
          'primary-light':'#818CF8',
          green:          '#10B981',
          'green-dim':    '#059669',
          yellow:         '#F59E0B',
          red:            '#EF4444',
          blue:           '#3B82F6',
          text:           '#F1F5F9',
          'text-dim':     '#94A3B8',
          'text-muted':   '#475569',
        },
      },
      fontFamily: {
        arabic: ['Cairo', 'sans-serif'],
        sans:   ['Inter', 'Cairo', 'sans-serif'],
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-in':   'slideIn 0.25s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'ticker':     'ticker 30s linear infinite',
        'float':      'float 3s ease-in-out infinite',
        'glow':       'glow 2s ease-in-out infinite',
        'shimmer':    'shimmer 1.5s infinite',
        'spin-slow':  'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { transform: 'translateY(-10px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        slideUp: { from: { transform: 'translateY(20px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        ticker:  { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(-100%)' } },
        float:   { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        glow:    { '0%,100%': { boxShadow: '0 0 6px rgba(99,102,241,0.3)' }, '50%': { boxShadow: '0 0 22px rgba(99,102,241,0.6)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      boxShadow: {
        'card':         '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)',
        'card-hover':   '0 6px 24px rgba(0,0,0,0.5)',
        'glow-primary': '0 0 24px rgba(99,102,241,0.35)',
        'glow-green':   '0 0 24px rgba(16,185,129,0.35)',
        'inner-glow':   'inset 0 1px 0 rgba(255,255,255,0.05)',
        'topbar':       '0 1px 0 rgba(255,255,255,0.04)',
      },
    },
  },
  plugins: [],
} satisfies Config
