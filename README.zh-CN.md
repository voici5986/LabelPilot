# LabelPilot (Web 版)

![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7.0-646CFF?style=flat-square&logo=vite)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=flat-square&logo=tailwind-css)
![Version](https://img.shields.io/badge/Version-1.4.0-green?style=flat-square)

[English](./README.md) | **简体中文**

基于 React 19 重构的现代化 Web 应用，用于批量生成可打印的标签 PDF 文档。完全替代了旧版的 PyQt6 桌面应用程序。

## ✨ 核心特性

- **🖼️ 双重生成模式**:
  - **图片模式**: 批量处理 JPG/PNG 图片为标签，支持智能自动填充。
  - **文本/序列模式**: 生成连续的序列号标签（如 SN-001, SN-002），支持自定义前缀和补位。
  - **🔗 二维码集成**: 序列号模式下可一键开启二维码，支持自定义 URL 前缀，方便资产扫描与跳转。
- **⚡ 极致性能**: 利用 **Web Worker** 实现异步生成。即使处理上百张高分辨率图片，UI 依然流畅且无响应阻塞。
- **🎨 智感按钮反馈**: 将进度追踪和成功/错误状态直接集成在操作按钮中，彻底告别侵入性的全屏遮罩层。
- **📐 动态网格限制**: 行列上限会根据纸张方向（纵向 vs 横向）自动调整并实时修正。
- **🛡️ 智能布局校验**: 实时检测无效布局（如边距超出纸张范围），提供可视化错误反馈，防止打印浪费。
- **🚀 增强型预览导航**: 支持通过输入页码直接跳转，大批量生成时浏览更便捷。
- **🌍 国际化支持**: 内置 **中/英文** 实时切换，所有提示与状态信息均已完美适配。
- **🌓 适配暗色模式**: 完美支持跟随系统的深浅色切换，并支持手动切换（“自动”、“亮色”、“暗色”）。基于 Tailwind CSS 4 深度感知。
- **👁️ 实时预览**: 所见即所得。基于 A4 画布的精准视觉预览。
- **📲 PWA 支持**: 支持离线使用，可作为独立应用安装至桌面或手机。
- **📱 移动端优化**: 内置方向感应遮罩，确保在移动设备上拥有最佳操作体验。

## 🚀 一键部署到 Vercel

[![使用 Vercel 部署](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/voici5986/LabelPilot)

## 🛠️ 技术栈

- **框架**: React 19.2.3
- **构建工具**: Vite 7.3
- **并行计算**: Web Workers (ES Module)
- **PDF 引擎**: jsPDF
- **样式与动画**: Tailwind CSS 4.1, Framer Motion
- **PWA**: vite-plugin-pwa

## 🚀 快速开始

### 安装步骤
1. `pnpm install`
2. `pnpm dev`

### 部署到 Vercel
本项目专为 Vercel 优化，支持零配置部署：
1. Fork 本仓库到您的 GitHub 账号。
2. 在 Vercel 中导入该仓库。
3. 确认以下设置（通常会自动识别）：
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`
4. 点击 **Deploy** 即可。

## 📦 生产环境构建
```bash
pnpm build
```
生成的文件位于 `dist/` 目录中。

## 💡 使用指南

1. **选择模式**: 在顶部导航栏切换“图片”或“文本”模式。
2. **配置排版**: 使用左侧边栏调整行数、列数、间距及纸张方向。
3. **添加内容**:
   - **图片模式**: 上传 JPG/PNG 文件并设置份数。
   - **文本模式**: 设置前缀、起始数字、数字位数及生成总数。支持一键开启 **二维码** 生成。
4. **检查预览**: 在右侧预览面板中确认排版效果。
5. **生成文档**: 点击“生成 PDF 文档”按钮下载最终文件。

## 📄 许可证

MIT License.
