import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "https://web-production-783f2.up.railway.app",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  plugins: [
    tailwindcss(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Knopper POS',
        short_name: 'Knopper',
        description: 'Offline-first Point of Sale System',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // This ensures all your JS, CSS, and images are cached for offline use
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Exclude API calls from being cached by the service worker 
        // because we handle those manually with IndexedDB
        navigateFallbackDenylist: [/^\/api/]
      }
    })
  ],
})