# LabelPilot (Web Version)

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7-blue?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=flat-square&logo=tailwind-css)
![Version](https://img.shields.io/github/v/tag/voici5986/label-react?label=Version&color=green&style=flat-square)

**English** | [简体中文](./README.zh-CN.md)

A modern, offline-capable web application for batch generating label PDF documents. Rebuilt from the ground up using React 19 to replace the legacy PyQt6 desktop application.

## ✨ Key Features

- **🖼️ Dual Generation Modes**:
  - **Image Mode**: Batch process JPG/PNG images into labels with smart auto-filling.
  - **Text/Serial Mode**: Generate sequential labels (e.g., SN-001, SN-002) with custom prefixes and padding.
  - **🔗 QR Code Generation**: Optional QR code integration for serial numbers. Supports custom URL prefixes for easy asset tracking.
- **⚡ Background PDF Generation**: Powered by **Web Workers**. The image queue accepts up to **20 files**, **10 MiB per file** and **50 MiB total**, with additional decoded pixel and label-count limits.
- **🎨 Smart Button Feedback**: Integrated progress tracking and success/error status directly within the action button. No more intrusive full-screen overlays.
- **📐 Dynamic Constraints**: Grid limits (rows/cols) automatically adjust based on page orientation (Portrait vs Landscape).
- **🛡️ Smart Layout Validation**: Real-time detection of invalid layouts (e.g., margins exceeding paper size) with visual error feedback.
- **🚀 Enhanced Preview Navigation**: Jump directly to specific pages with the new input-based pagination control.
- **🌍 Internationalization**: Built-in support for **English** and **Chinese**, with instant language switching.
- **🌓 Adaptive Dark Mode**: Full dark mode support that follows your system preferences or can be manually toggled ('System', 'Light', 'Dark'). Powered by Tailwind CSS 4.
- **👁️ Real-time Preview**: What you see is what you get with a virtual paper canvas.
- **📏 Screen 1:1 Actual Size**: Calibrate once by measuring an on-screen ruler line, then view the paper at its true physical size on desktop. The calibration is stored locally and survives reloads.
- **📲 PWA Ready**: Can be installed as a standalone app. Offline use requires a first online visit with service-worker installation and caching completed. The current production precache is approximately **3.5 MiB**, including the **2.55 MB MiSans font**; this size can change with the build.
- **📱 Mobile Optimized**: A preview-first workspace with a collapsible edit sheet for comfortable touch workflows.

## 🚀 One-Click Deploy with Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/voici5986/LabelPilot)

## 🛠️ Tech Stack

- **Framework**: React 19
- **Build Tool**: Vite 8
- **Multithreading**: Web Workers (ES Module)
- **PDF Engine**: jsPDF
- **Styling**: Tailwind CSS 4, Framer Motion
- **PWA**: vite-plugin-pwa

## 🚀 Getting Started

### Installation

Use Node.js **24.21.0 or newer** and the pinned **pnpm 12.11.2**. CI uses Node.js 26, which satisfies the same minimum.

1. `pnpm install`
2. `pnpm dev`

### Deployment to Vercel

Configure and verify the build toolchain on Vercel before deploying.

1. Fork this repository to your own GitHub account.
2. Import the project in Vercel.
3. Ensure the following settings are detected:
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`
4. Enable platform Corepack support with the Vercel environment variable **`ENABLE_EXPERIMENTAL_COREPACK=1`** and verify that the selected build environment supports **pnpm 12.11.2** from `packageManager`.
5. Click **Deploy** and check the build logs to confirm the pinned pnpm version is used.

### Release process

See [docs/release.md](./docs/release.md) for the local `release.ps1` process (PowerShell 7.6 or newer), which invokes `semantic-release`, and its validation commands. GitHub Actions runs CI for pushes to `main` and pull requests; releases are initiated locally.

## 📦 Building for Production

```bash
pnpm build
```

The output will be in the `dist/` directory.

## 💡 Usage Guide

After the arrow tour, use **Upload images** or **Create numbered labels** on an empty preview to get started; the ruler and zoom controls stay hidden while these entry points are displayed. The header's **User guide** is always available for step-by-step help. On smaller screens, tap **Edit** at the bottom to change content and layout, then **View Preview** to return to the page.

New users see an optional arrow tour of content, layout, preview and PDF generation, including zoom and 1:1 screen calibration on desktop; on smaller screens it starts with the **Edit** button. Highlights and short tips point to real controls so you can work as you learn. Returning users keep their settings and can select **User guide → Replay tour** to start again. The tour changes no label settings on its own and remembers when you finish or skip it.

1. **Select Mode**: Switch between **Image** and **Text** mode at the top of the left panel.
2. **Configure Layout**: Use the left sidebar to adjust rows, columns, spacing, and orientation.
3. **Add Content**:
   - In **Image Mode**: Upload JPG/PNG files and set quantities.
   - In **Text Mode**: Set prefix, start number, digits, and total count. Toggle **QR Code** for instant scannable labels.
4. **Check Preview**: Verify the layout on the right preview panel.
5. **Generate**: Click "Generate PDF" to download the final file.
6. **Check Actual Size (desktop)**: Click the "1:1" button next to the zoom slider. On first use, measure the on-screen ruler line (keep browser zoom at 100%, Ctrl+0), enter the value you read, and save. The preview then shows the paper at true physical size; re-calibrate after changing monitors or system display scaling.

When printing the downloaded PDF, choose the matching paper size and **Actual size** or **100%** scaling. Screen 1:1 calibration only affects the preview display; it does not change PDF page dimensions.

**PDF output quality:** Non-ASCII text is rasterized with a target of 300 DPI. Large text boxes can lower the output DPI to stay within the canvas limits; the text controls show the expected DPI when this happens. JPEG images that need orientation correction may be re-encoded, and normalized images above 16 megapixels are resized. Other JPEGs retain their original bytes. Check the exported PDF and a sample print when sharpness matters.

PNG upload admission reads compressed-file structure and dimensions without creating a full-size bitmap. Complete scanline and CRC checks run during PDF generation, so a structurally complete but damaged PNG may be rejected at generation time. Streaming validation still inflates the complete image data, and PDF embedding decodes it again; very high-resolution inputs retain a CPU cost even though the extra RGBA bitmap allocation is removed. Image cells below a recommended 5 mm shortest side show a print-readability warning while allowing generation.

The supported PDF inputs are PNG/JPEG images, text and QR codes. Optional jsPDF HTML/SVG renderers are replaced with explicit unsupported-feature stubs; their dependencies cannot silently bypass the offline cache guard. Vercel cache headers are defined in [vercel.json](./vercel.json); verify the deployed response headers before release.

QR content is the literal prefix followed by the label text. When using a URL prefix, supply any URL encoding your destination requires; spaces and Unicode remain valid QR text.

## 📄 License

[MIT License](./LICENSE).

Bundled third-party assets have separate notices; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
