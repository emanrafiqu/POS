/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Veloura premium palette — black / white / gold
        ink: {
          DEFAULT: '#0c0c0e',
          soft: '#17171a',
          muted: '#232328',
        },
        gold: {
          DEFAULT: '#c9a227',
          light: '#e6c65c',
          dark: '#a3821c',
          faint: '#faf5e4',
        },
        surface: '#f7f7f5',
      },
      borderRadius: {
        xl: '0.9rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        soft: '0 4px 24px rgba(12, 12, 14, 0.06)',
        card: '0 2px 12px rgba(12, 12, 14, 0.08)',
        gold: '0 4px 20px rgba(201, 162, 39, 0.25)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: 0, transform: 'scale(0.96)' }, to: { opacity: 1, transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'scale-in': 'scale-in 0.18s ease-out',
      },
    },
  },
  plugins: [],
};
