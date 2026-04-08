import { defineConfig } from 'vite'
import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  proxy: {
    "/api": {
      target: import.meta.env.VITE_APP_BASE_URI,
      changeOrigin: true,
      secure: false,
    },
  },
})
