import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["print.svg", "print-maskable.svg"],
      manifest: {
        name: "LabelPilot",
        short_name: "LabelPilot",
        description: "一款支持离线使用的专业标签排版与 PDF 生成工具。",
        lang: "zh-CN",
        theme_color: "#0369a1",
        background_color: "#fafafa",
        icons: [
          {
            src: "print.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "print.svg",
            sizes: "512x512",
            type: "image/svg+xml",
          },
          {
            src: "print-maskable.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,txt,woff2}"],
        globIgnores: [
          "**/html2canvas-*.js",
          "**/purify.es-*.js",
          "**/index.es-*.js",
        ],
        maximumFileSizeToCacheInBytes: 1024 * 1024,
      },
      devOptions: {
        enabled: false, // 关闭开发模式下的 PWA，消除终端警告
        type: "module",
      },
    }),
  ],
  worker: {
    format: "es",
  },
  test: {
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
