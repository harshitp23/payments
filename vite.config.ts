import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site from /payments/; local dev stays at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/payments/' : '/',
  plugins: [react()],
}))
