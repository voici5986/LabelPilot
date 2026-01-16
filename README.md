# LabelPilot (Web Version)

![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7.0-646CFF?style=flat-square&logo=vite)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=flat-square&logo=tailwind-css)

**English** | [简体中文](./README.zh-CN.md)

A modern, offline-capable web application for batch generating label PDF documents from images. Rebuilt from the ground up using React 19 to replace the legacy PyQt6 desktop application.

## ✨ Key Features

- **⚡ High Performance**: Powered by **Web Workers**, PDF generation is asynchronous and non-blocking, ensuring the UI remains responsive even with 100+ high-res images.
- **🎨 Smart Button Feedback**: Integrated progress tracking and success/error status directly within the action button. No more intrusive full-screen overlays.
- **📐 Dynamic Constraints**: Grid limits (rows/cols) automatically adjust based on page orientation (Portrait vs Landscape).
- **🌍 Internationalization**: Built-in support for **English** and **Chinese**, with instant language switching.
- **🌓 Adaptive Dark Mode**: Full dark mode support that follows your system preferences or can be manually toggled ('System', 'Light', 'Dark'). Powered by Tailwind CSS 4.
- **👁️ Real-time Preview**: What you see is what you get with a virtual A4 canvas.

## 🚀 One-Click Deploy with Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/voici5986/LabelPilot)

## 🛠️ Tech Stack

- **Framework**: React 19.2.3
- **Build Tool**: Vite 7.3
- **Multithreading**: Web Workers (ES Module)
- **PDF Engine**: jsPDF
- **Styling**: Tailwind CSS 4.1, Framer Motion

## 🚀 Getting Started

### Installation
1. `npm install`
2. `npm run dev`

### Deployment to Vercel
This project is optimized for Vercel. 
1. Fork this repository to your own GitHub account.
2. Import the project in Vercel.
3. Ensure the following settings are detected:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Click **Deploy**.

## 📦 Building for Production
```bash
npm run build
```
The output will be in the `dist/` directory. 

## 💡 Usage Guide

1. **Upload Source**: Click the upload area to select your label image (JPG/PNG).
2. **Configure Layout**: Use the left sidebar to adjust rows, columns, and spacing.
3. **Check Preview**: Verify the layout on the right preview panel.
4. **Generate**: Click "Generate PDF" to download the final file.

## 📄 License

MIT License.
