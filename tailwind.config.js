/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand': '#FF203A',
        'brand-hover': '#E01D34',
        'brand-light': '#FF4D64',
        'brand-dark': '#CC1A2E',
        brand: {
          50: '#FFF1F3',
          100: '#FFE1E6',
          200: '#FFC7D1',
          300: '#FF9DAD',
          400: '#FF6383',
          500: '#FF203A',
          600: '#E01D34',
          700: '#C1182D',
          800: '#A1142A',
          900: '#861328',
          DEFAULT: '#FF203A',
        },
        dark: {
          bg: '#212121',
          card: '#1C1C1E',
          border: '#2C2C2E',
        },
      },
      padding: {                                    // ← extend 안으로 이동
        'safe': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      }
    },
  },
  plugins: [],
}