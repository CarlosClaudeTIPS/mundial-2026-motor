/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#00C851',
          yellow: '#FFD700',
          red: '#FF3D3D',
        },
        dark: {
          900: '#0A0E1A',
          800: '#111827',
          700: '#1F2937',
          600: '#374151',
        },
      },
    },
  },
  plugins: [],
}
