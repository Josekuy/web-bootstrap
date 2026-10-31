import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // La misma dirección local que utilizan la documentación y los comprobadores.
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
})
