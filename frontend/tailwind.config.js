/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#222a3c',
        brand: {
          50:  '#fbf6ee',
          300: '#f0d0a0',
          400: '#e0b15a',
          500: '#c8893a',
          600: '#a86a30',
          700: '#8c5428',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        glass: '0 18px 40px rgba(12, 16, 32, 0.28), inset 0 1px 0 rgba(255,255,255,0.16)',
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
  plugins: [],
}
