import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // ✨ [중요] 배포 시 경로 문제 방지
  base: '/', 
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})