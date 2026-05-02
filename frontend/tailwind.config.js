/** @type {import('tailwindcss').Config} */
export default {
  // Note: Tailwind preflight is intentionally disabled to coexist cleanly
  // with Bootstrap (which we also load for responsive grid classes).
  corePlugins: { preflight: false },
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sparrow: {
          50: '#F7F1FF',
          100: '#EFE7FF',
          200: '#E2D3FF',
          300: '#C9A7FF',
          400: '#A974F2',
          500: '#7B2FE8',
          600: '#6C2BD9',
          700: '#4A1A86',
          800: '#3A1D6B',
          900: '#2A0A4D',
        },
      },
    },
  },
  plugins: [],
};
