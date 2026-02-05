/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // 이 줄 필수
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FF203A',
          hover: '#E01D34',
          light: '#FF4D64',
          dark: '#CC1A2E', 
        },
        dark: {
          bg: '#212121',     
          card: '#2C2C2C',
          border: '#3A3A3A',
          input: '#2C2C2C',
          text: {
            primary: '#FFFFFF',
            secondary: '#A0A0A0',
          }
        },
      },
    },
  },
  plugins: [],
}