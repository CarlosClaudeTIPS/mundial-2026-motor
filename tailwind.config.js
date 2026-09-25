/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta sobria: fondo oscuro, acento azul, verde/ámbar/rojo para estado
        dark: { 900: '#0F172A', 800: '#1E293B', 700: '#334155', 600: '#475569' },
        brand: { blue: '#38BDF8', green: '#34D399', amber: '#FBBF24', red: '#F87171' },
      },
    },
  },
  plugins: [],
}
