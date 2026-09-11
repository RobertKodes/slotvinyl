import { defineConfig } from 'vite'

export default defineConfig({
  base: '/slotvinyl/',
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
})
