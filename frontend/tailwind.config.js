/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#fdf4e7',
          100: '#fde8c8',
          200: '#fbd08e',
          300: '#f9b354',
          400: '#f79522',
          500: '#e87a0a',
          600: '#c45f07',
          700: '#9a4609',
          800: '#7c380c',
          900: '#652e0e',
        },
        forest: {
          50:  '#edf7f0',
          100: '#d0edda',
          200: '#a0dab5',
          300: '#6bc28a',
          400: '#3da866',
          500: '#228b4a',
          600: '#187039',
          700: '#12572c',
          800: '#0d4221',
          900: '#093218',
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'bell-shake':   'bellShake 0.6s ease-in-out',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        bellShake: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '15%':      { transform: 'rotate(15deg)' },
          '30%':      { transform: 'rotate(-10deg)' },
          '45%':      { transform: 'rotate(10deg)' },
          '60%':      { transform: 'rotate(-5deg)' },
          '75%':      { transform: 'rotate(5deg)' },
        },
      },
    },
  },
  plugins: [],
};
