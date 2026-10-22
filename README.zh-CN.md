# LabelPilot (Web 版)

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-7-blue?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=flat-square&logo=tailwind-css)
![Version](https://img.shields.io/github/v/tag/voici5986/label-react?label=Version&color=green&style=flat-square)

[English](./README.md) | **简体中文**

基于 React 19 重构的现代化 Web 应用，用于批量生成可打印的标签 PDF 文档。完全替代了旧版的 PyQt6 桌面应用程序。

## ✨ 核心特性

- **🖼️ 双重生成模式**:
  - **图片模式**: 批量处理 JPG/PNG 图片为标签，支持智能自动填充。
  - **文本/序列模式**: 生成连续的序列号标签（如 SN-001, SN-002），支持自定义前缀和补位。
  - **🔗 二维码集成**: 序列号模式下可一键开启二维码，支持自定义 URL 前缀，方便资产扫描与跳转。
- **⚡ 后台 PDF 生成**: 利用 **Web Worker** 异步生成。图片队列最多 **20 个文件**，单文件不超过 **10 MiB**、总大小不超过 **50 MiB**，另有解码像素和标签数量限制。
- **🎨 智感按钮反馈**: 将进度追踪和成功/错误状态直接集成在操作按钮中，彻底告别侵入性的全屏遮罩层。
- **📐 动态网格限制**: 行列上限会根据纸张方向（纵向 vs 横向）自动调整并实时修正。
- **🛡️ 智能布局校验**: 实时检测无效布局（如边距超出纸张范围），提供可视化错误反馈，防止打印浪费。
- **🚀 增强型预览导航**: 支持通过输入页码直接跳转，大批量生成时浏览更便捷。
- **🌍 国际化支持**: 内置 **中/英文** 实时切换，所有提示与状态信息均已完美适配。
- **🌓 适配暗色模式**: 完美支持跟随系统的深浅色切换，并支持手动切换（“自动”、“亮色”、“暗色”）。基于 Tailwind CSS 4 深度感知。
- **👁️ 实时预览**: 所见即所得。基于纸张画布的精准视觉预览，支持标准和自定义尺寸。
- **📏 屏幕 1:1 实际尺寸**: 桌面端量一次屏幕刻度线完成校准，即可按真实物理尺寸查看纸张。校准结果保存在本地，刷新/重启后依然有效。
- **📲 PWA 支持**: 可作为独立应用安装至桌面或手机。离线使用需要首次联网访问并完成 Service Worker 安装和缓存；当前生产预缓存约 **3.5 MiB**，包含 **2.55 MB 的 MiSans 字体**，大小会随构建变化。
- **📱 移动端优化**: 预览优先的工作台 + 可折叠的合并编辑面板，触控操作更顺手。

## 🚀 一键部署到 Vercel

[![使用 Vercel 部署](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/voici5986/LabelPilot)

## 🛠️ 技术栈

- **框架**: React 19
- **构建工具**: Vite 8
- **并行计算**: Web Workers (ES Module)
- **PDF 引擎**: jsPDF
- **样式与动画**: Tailwind CSS 4, Framer Motion
- **PWA**: vite-plugin-pwa

## 🚀 快速开始

### 安装步骤

使用 **Node.js 24.21.0 或更高版本**和锁定的 **pnpm 12.11.2**。CI 使用 Node.js 26，满足同一最低版本要求。

1. `pnpm install`
2. `pnpm dev`

### 部署到 Vercel

部署前请配置并核实 Vercel 的构建工具链：

1. Fork 本仓库到您的 GitHub 账号。
2. 在 Vercel 中导入该仓库。
3. 确认以下设置（通常会自动识别）：
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`
4. 设置 Vercel 环境变量 **`ENABLE_EXPERIMENTAL_COREPACK=1`**，启用平台 Corepack 支持，并确认所选构建环境支持 `packageManager` 指定的 **pnpm 12.11.2**。
5. 点击 **Deploy**，检查构建日志并确认使用了锁定的 pnpm 版本。

### 发布流程

请参阅 [docs/release.md](./docs/release.md) 了解本地 `release.ps1` 发版流程（要求 PowerShell 7.6 或更高版本）及校验命令；脚本调用 `semantic-release`。GitHub Actions 对 `main` 的 push 和 pull request 执行 CI，发版由维护者在本地启动。

## 📦 生产环境构建

```bash
pnpm build
```

生成的文件位于 `dist/` 目录中。

## 💡 使用指南

箭头导览结束后，空白预览区提供“上传图片”和“制作编号标签”入口；入口显示时收起量尺和缩放控件。顶部的“使用指南”可随时查看完整操作步骤。手机等小屏设备上，点击底部“编辑”调整内容与排版，再点“查看预览”返回纸张。

首次使用会提供可跳过的箭头导览，依次介绍添加内容、排版、预览和生成 PDF；桌面还会介绍缩放与 1:1 屏幕校准，手机上先介绍底部“编辑”入口。高亮框和说明直接指向真实控件，可以边看边操作。已有设置继续沿用，也可从“使用指南 → 重新导览”再次查看。导览不代替用户修改参数，完成或跳过后会记住状态。

1. **选择模式**: 在左侧面板顶部切换“图片”或“文本”模式。
2. **配置排版**: 使用左侧边栏调整行数、列数、间距及纸张方向。
3. **添加内容**:
   - **图片模式**: 上传 JPG/PNG 文件并设置份数。
   - **文本模式**: 设置前缀、起始数字、数字位数及生成总数。支持一键开启 **二维码** 生成。
4. **检查预览**: 在右侧预览面板中确认排版效果。
5. **生成文档**: 点击“生成 PDF 文档”按钮下载最终文件。
6. **核对实际尺寸（桌面端）**: 点击缩放滑块旁的 “1:1” 按钮。首次使用时，保持浏览器缩放在 100%（Ctrl+0），量屏幕上的刻度线并填入实测值保存。之后预览即按真实物理尺寸显示纸张；更换显示器或系统显示缩放后请重新校准。

打印下载的 PDF 时，选择与排版一致的纸张，并使用“实际大小”或 100% 缩放。屏幕 1:1 校准只影响预览显示，不会改变 PDF 的纸张尺寸。

**PDF 输出质量：** 非 ASCII 文本以 300 DPI 为目标栅格化。较大的文字区域可能受画布上限影响而降低输出 DPI，此时文本设置会显示预计 DPI。需要纠正方向的 JPEG 可能重新编码，归一化时超过 1600 万像素的图片会缩小；其他 JPEG 保留原始字节。对清晰度有要求时，请检查导出的 PDF 并试印。

PNG 上传准入读取压缩文件的结构和尺寸，不创建全尺寸位图；完整扫描行和 CRC 校验在生成 PDF 时执行，因此结构完整但内容损坏的 PNG 可能在生成时才被拒绝。流式校验仍会完整解压图像数据，PDF 嵌入也需要再次解码；超高分辨率输入仍有 CPU 代价，本次减少的是额外 RGBA 位图分配。图片单元格最短边低于建议的 5 mm 时会显示打印可读性提醒，仍允许生成。

PDF 支持 PNG/JPEG 图片、文本和二维码。可选的 jsPDF HTML/SVG 渲染器已替换为明确拒绝调用的桩，其依赖不能再绕过离线缓存门禁。Vercel 缓存头由 [vercel.json](./vercel.json) 定义，上线前仍需核对部署后的真实响应头。

二维码内容按“内容前缀 + 标签文字”原样拼接。使用 URL 前缀时，请自行提供目标地址需要的 URL 编码；空格和中文仍是合法的二维码文本。

## 📄 许可证

[MIT License](./LICENSE)。

随附第三方资产另有声明，见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
