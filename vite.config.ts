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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,txt,woff2}'],
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
        enabled: false, // 关闭开发模式下的 PWA，消除终端警告
        type: 'module'
      }
    })
  ],
  worker: {
    format: 'es'
  }
})
