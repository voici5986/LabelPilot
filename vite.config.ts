import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // 使用提示模式，而不是自动静默更新
      includeAssets: ['print.svg', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Label Printer Pro',
        short_name: 'LabelPrint',
        description: 'A professional label printing tool that works offline.',
        theme_color: '#4f46e5',
        icons: [
          {
            src: 'print.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'print.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          },
          {
            src: 'print.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,txt}'],
        // 确保 Web Worker 也能被缓存
        importScripts: [],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true, // 在开发模式下也启用 PWA，解决 Hook 返回 undefined 的问题
        type: 'module'
      }
    })
  ],
  worker: {
    format: 'es'
  }
})
