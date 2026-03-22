/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'monospace'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
      },
      colors: {
        bg:      '#07090d',
        surface: '#0c1018',
        border:  'rgba(111,136,198,0.15)',
        border2: 'rgba(111,136,198,0.28)',
        cyan:    '#22d3ee',
        violet:  '#8b5cf6',
        muted:   '#60708e',
        muted2:  '#8ea0bf',
      },
      animation: {
        'fade-up':   'fadeUp 0.5s ease forwards',
        'fade-in':   'fadeIn 0.4s ease forwards',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        fadeUp:   { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:   { from: { opacity: '0' }, to: { opacity: '1' } },
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.3' } },
      },
    },
  },
  plugins: [],
}
