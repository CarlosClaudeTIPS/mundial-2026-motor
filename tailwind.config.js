/** @type {import('tailwindcss').Config} */
// Tema claro inspirado en plataformas preicfes: fondo claro, tarjetas blancas,
// azul cian como acento y azul marino para textos. Los nombres "dark-*" y la
// escala "gray" se conservan (los usan todos los componentes) pero ahora
// representan superficies claras y textos oscuros.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        dark: { 900: '#F4F7FC', 800: '#FFFFFF', 700: '#EEF2F8', 600: '#C9D8EE' },
        brand: { blue: '#1FA9EC', green: '#10B981', amber: '#F59E0B', red: '#EF4444', navy: '#2B2A63' },
        white: '#2B2A63',
        gray: {
          100: '#2B2A63', 200: '#34336E', 300: '#434766', 400: '#5A6275', 500: '#7B8497', 600: '#A3ADBD', 700: '#CBD5E1', 800: '#E2E8F0', 900: '#F1F5F9',
        },
      },
    },
  },
  plugins: [],
}
