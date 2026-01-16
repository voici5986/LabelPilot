# LabelPilot (Web 版)

![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7.0-646CFF?style=flat-square&logo=vite)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=flat-square&logo=tailwind-css)

[English](./README.md) | **简体中文**

基于 React 19 重构的现代化 Web 应用，用于将图片批量生成为可打印的标签 PDF 文档。完全替代了旧版的 PyQt6 桌面应用程序。

## ✨ 核心特性

- **⚡ 极致性能**: 利用 **Web Worker** 实现异步生成。即使处理上百张高分辨率图片，UI 依然流畅且无响应阻塞。
- **🎨 智感按钮反馈**: 将进度追踪和成功/错误状态直接集成在操作按钮中，彻底告别侵入性的全屏遮罩层。
- **📐 动态网格限制**: 行列上限会根据纸张方向（纵向 vs 横向）自动调整并实时修正。
- **🌍 国际化支持**: 内置 **中/英文** 实时切换，所有提示与状态信息均已完美适配。
- **🌓 适配暗色模式**: 完美支持跟随系统的深浅色切换，并支持手动切换（“自动”、“亮色”、“暗色”）。基于 Tailwind CSS 4 深度感知。
- **👁️ 实时预览**: 所见即所得。基于 A4 画布的精准视觉预览。

## 🚀 一键部署到 Vercel

[![使用 Vercel 部署](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/voici5986/LabelPilot)

## 🛠️ 技术栈

- **框架**: React 19.2.3
- **构建工具**: Vite 7.3
- **并行计算**: Web Workers (ES Module)
- **PDF 引擎**: jsPDF
- **样式与动画**: Tailwind CSS 4.1, Framer Motion

## 🚀 快速开始

### 安装步骤
1. `npm install`
2. `npm run dev`

### 部署到 Vercel
本项目专为 Vercel 优化，支持零配置部署：
1. Fork 本仓库到您的 GitHub 账号。
2. 在 Vercel 中导入该仓库。
3. 确认以下设置（通常会自动识别）：
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. 点击 **Deploy** 即可。

## 📦 生产环境构建
```bash
npm run build
```
生成的文件位于 `dist/` 目录中。

## 💡 使用指南

1. **上传源文件**: 点击上传区域选择您的标签图片 (JPG/PNG)。
2. **配置排版**: 使用左侧边栏调整行数、列数和间距。
3. **检查预览**: 在右侧预览面板中确认排版效果。
4. **生成文档**: 点击“生成 PDF 文档”按钮下载最终文件。

## 📄 许可证

MIT License.
