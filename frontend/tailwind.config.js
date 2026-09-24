import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#222a3c',
        surface: {
          1: 'rgba(78, 92, 128, 0.20)',
          2: 'rgba(88, 104, 142, 0.28)',
          3: 'rgba(20, 26, 42, 0.55)',
        },
        brand: {
          50:  '#fbf6ee',
          100: '#f7ecd9',
          200: '#f4e0bf',
          300: '#f0d0a0',
          400: '#e0b15a',
          500: '#c8893a',
          600: '#a86a30',
          700: '#8c5428',
          800: '#6b3f1f',
          900: '#4a2b16',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
      },
      fontSize: {
        micro:   ['0.6875rem', { lineHeight: '1rem',     letterSpacing: '0.04em' }],
        label:   ['0.75rem',   { lineHeight: '1.1rem',   letterSpacing: '0.02em' }],
        body:    ['0.9375rem', { lineHeight: '1.65rem' }],
        lede:    ['1.0625rem', { lineHeight: '1.75rem' }],
        title:   ['1.375rem',  { lineHeight: '1.75rem',  letterSpacing: '-0.01em' }],
        display: ['2.75rem',   { lineHeight: '1.05',     letterSpacing: '-0.022em' }],
      },
      boxShadow: {
        glass:  '0 18px 40px rgba(12, 16, 32, 0.28), inset 0 1px 0 rgba(255,255,255,0.16)',
        'elev-1': '0 1px 2px rgba(8, 11, 22, 0.28), inset 0 1px 0 rgba(255,255,255,0.07)',
        'elev-2': '0 12px 28px -10px rgba(8, 11, 22, 0.55), inset 0 1px 0 rgba(255,255,255,0.10)',
        'elev-3': '0 28px 60px -16px rgba(8, 11, 22, 0.70), inset 0 1px 0 rgba(255,255,255,0.14)',
        'glow-brand': '0 8px 30px -8px rgba(200, 137, 58, 0.45)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '250ms',
        slow: '400ms',
      },
      keyframes: {
        'fade-rise': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-rise': 'fade-rise 400ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.8s linear infinite',
      },
      typography: {
        invert: {
          css: {
            '--tw-prose-body': '#d1d5db',
            '--tw-prose-headings': '#f9fafb',
            '--tw-prose-links': '#e0b15a',
            '--tw-prose-bold': '#f9fafb',
            '--tw-prose-code': '#f0d0a0',
            '--tw-prose-bullets': '#6b7280',
          },
        },
      },
    },
  },
  plugins: [typography],
}
