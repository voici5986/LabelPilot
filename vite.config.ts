import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  // LabelPilot renders PDFs from text, raster images and QR codes. jsPDF's
  // optional HTML/SVG APIs deliberately fail in both app and worker builds.
  resolve: {
    alias: {
      html2canvas: fileURLToPath(
        new URL("./src/utils/pdfOptionalHtml2canvas.ts", import.meta.url),
      ),
      dompurify: fileURLToPath(
        new URL("./src/utils/pdfOptionalDomPurify.ts", import.meta.url),
      ),
      canvg: fileURLToPath(
        new URL("./src/utils/pdfOptionalCanvg.ts", import.meta.url),
      ),
    },
  },
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
        // MiSansVF 可变字体（gb2312 子集）约 2.55 MB，提高预缓存上限以纳入
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
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
