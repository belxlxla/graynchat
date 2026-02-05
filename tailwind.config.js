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
        // ✅ 방법 1: 플랫한 구조로 변경
        'brand': '#FF203A',
        'brand-hover': '#E01D34',
        'brand-light': '#FF4D64',
        'brand-dark': '#CC1A2E',
        
        // 또는
        
        // ✅ 방법 2: 중첩 구조 유지하되 숫자 사용
        brand: {
          50: '#FFF1F3',
          100: '#FFE1E6',
          200: '#FFC7D1',
          300: '#FF9DAD',
          400: '#FF6383',
          500: '#FF203A',   // DEFAULT
          600: '#E01D34',   // hover
          700: '#C1182D',
          800: '#A1142A',
          900: '#861328',
          DEFAULT: '#FF203A',
        },
        
        dark: {
          bg: '#000000',
          card: '#1C1C1E',
          border: '#2C2C2E',
        },
      },
    },
  },
  plugins: [],
}