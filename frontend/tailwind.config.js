/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        curio: {
          bg0: '#0A0C10',
          bg1: '#10131A',
          bg2: '#171B25',
          bg3: '#1F2430',
          fg1: '#F5F1E8',
          fg2: '#AEB3BE',
          fg3: '#6E7585',
          fg4: '#3F4656',
          accent: '#7FD4D1',
          'accent-hover': '#9AE0DE',
        },
        domain: {
          tech: '#A78BFA',
          science: '#7FD4D1',
          econ: '#E8B65C',
          policy: '#F06E6E',
          biz: '#8BC48A',
          others: '#AEB3BE',
        },
        signal: {
          critical: '#F06E6E',
          warn: '#E8B65C',
          positive: '#8BC48A',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
}
