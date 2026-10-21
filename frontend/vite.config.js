import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Prevents browser blocking backend and frontend running at the same time.
      // (I think)
      '/api': 'http://localhost:8086'
    }
  }
})
