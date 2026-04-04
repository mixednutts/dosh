import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devModeEnabled = (process.env.VITE_DEV_MODE ?? env.VITE_DEV_MODE ?? 'false') === 'true'

  return {
    plugins: [react()],
    define: {
      __DEV_MODE__: JSON.stringify(devModeEnabled),
    },
    server: {
      host: '127.0.0.1',
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
    },
    test: {
      environment: 'jsdom',
    },
  }
})
