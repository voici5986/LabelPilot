# LabelPilot (Web Version)

![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7.0.2-blue?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=flat-square&logo=vite)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4.2-38B2AC?style=flat-square&logo=tailwind-css)
![Version](https://img.shields.io/github/v/tag/voici5986/label-react?label=Version&color=green&style=flat-square)

**English** | [简体中文](./README.zh-CN.md)

A modern, offline-capable web application for batch generating label PDF documents. Rebuilt from the ground up using React 19 to replace the legacy PyQt6 desktop application.

## ✨ Key Features

- **🖼️ Dual Generation Modes**:
  - **Image Mode**: Batch process JPG/PNG images into labels with smart auto-filling.
  - **Text/Serial Mode**: Generate sequential labels (e.g., SN-001, SN-002) with custom prefixes and padding.
  - **🔗 QR Code Generation**: Optional QR code integration for serial numbers. Supports custom URL prefixes for easy asset tracking.
- **⚡ High Performance**: Powered by **Web Workers**, PDF generation is asynchronous and non-blocking, ensuring the UI remains responsive even with 100+ high-res images.
- **🎨 Smart Button Feedback**: Integrated progress tracking and success/error status directly within the action button. No more intrusive full-screen overlays.
- **📐 Dynamic Constraints**: Grid limits (rows/cols) automatically adjust based on page orientation (Portrait vs Landscape).
- **🛡️ Smart Layout Validation**: Real-time detection of invalid layouts (e.g., margins exceeding paper size) with visual error feedback.
- **🚀 Enhanced Preview Navigation**: Jump directly to specific pages with the new input-based pagination control.
- **🌍 Internationalization**: Built-in support for **English** and **Chinese**, with instant language switching.
- **🌓 Adaptive Dark Mode**: Full dark mode support that follows your system preferences or can be manually toggled ('System', 'Light', 'Dark'). Powered by Tailwind CSS 4.
- **👁️ Real-time Preview**: What you see is what you get with a virtual A4 canvas.
- **📏 Screen 1:1 Actual Size**: Calibrate once by measuring an on-screen ruler line, then view the paper at its true physical size on desktop. The calibration is stored locally and survives reloads.
- **📲 PWA Ready**: Supports offline use and can be installed as a standalone app.
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

1. `pnpm install`
2. `pnpm dev`

### Deployment to Vercel

This project is optimized for Vercel.

1. Fork this repository to your own GitHub account.
2. Import the project in Vercel.
3. Ensure the following settings are detected:
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`
4. Click **Deploy**.

### Release process

See [docs/release.md](./docs/release.md) for the manually triggered `semantic-release` workflow and local validation commands.

## 📦 Building for Production

```bash
pnpm build
```

The output will be in the `dist/` directory.

## 💡 Usage Guide

1. **Select Mode**: Switch between **Image** and **Text** mode at the top of the left panel.
2. **Configure Layout**: Use the left sidebar to adjust rows, columns, spacing, and orientation.
3. **Add Content**:
   - In **Image Mode**: Upload JPG/PNG files and set quantities.
   - In **Text Mode**: Set prefix, start number, digits, and total count. Toggle **QR Code** for instant scannable labels.
4. **Check Preview**: Verify the layout on the right preview panel.
5. **Generate**: Click "Generate PDF" to download the final file.
6. **Check Actual Size (desktop)**: Click the "1:1" button next to the zoom slider. On first use, measure the on-screen ruler line (keep browser zoom at 100%, Ctrl+0), enter the value you read, and save. The preview then shows the paper at true physical size; re-calibrate after changing monitors or system display scaling.

## 📄 License

[MIT License](./LICENSE).
