import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['print.svg'],
      manifest: {
        name: 'LabelPilot',
        short_name: 'LabelPilot',
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
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 增加到 3MB 以支持较大的自定义字体文件
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
