import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg:        '#0D0D0D',
          surface:   '#141414',
          card:      '#1C1C1C',
          navy:      '#1A2744',
          'navy-light': '#243460',
          green:     '#84C818',
          'green-dim': '#6AAF0A',
          border:    '#2A2A2A',
          'border-light': '#333333',
        },
      },
      fontFamily: {
        arabic: ['Cairo', 'Noto Kufi Arabic', 'sans-serif'],
        sans:   ['Inter', 'Cairo', 'sans-serif'],
      },
      animation: {
        'fade-in':   'fadeIn 0.2s ease-out',
        'slide-in':  'slideIn 0.25s ease-out',
        'slide-up':  'slideUp 0.3s ease-out',
        'ticker':    'ticker 30s linear infinite',
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
