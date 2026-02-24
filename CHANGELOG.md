# 1.0.0 (2026-02-24)


### Bug Fixes

* 修复布局计算、状态管理和构建配置问题 ([12b50f3](https://github.com/voici5986/label-react/commit/12b50f3273936998193e3483bf248f10f47d552f))
* 移除 MiSans 字体并恢复 PWA 缓存大小限制 ([b60d76b](https://github.com/voici5986/label-react/commit/b60d76b50d407bf4a0a8843613197e0857c5f7e7))


### Features

* 持久化保存文本模式配置到本地存储 ([6b7015c](https://github.com/voici5986/label-react/commit/6b7015c1ac233fffdeba0fe7c080e646345a749d))
* 初始化标签生成器应用，包含预览、控制面板、布局计算及状态管理。 ([964dfb5](https://github.com/voici5986/label-react/commit/964dfb53dcc2e5a4e8c4ccdf258c8fdf442db30f))
* 初始化应用主组件，集成状态管理、主题切换、文件处理、PDF 生成及主要UI布局。 ([221640b](https://github.com/voici5986/label-react/commit/221640bd27602f8fe5c58de5175f7bbf30ac2a94))
* 实现标签打印器应用的核心功能，包括布局配置、图片/文本模式、预览及PDF生成。 ([8834922](https://github.com/voici5986/label-react/commit/883492223bd30efdf38515e6e7e08de89a76043c))
* 实现多页PDF预览并添加分页导航控件 ([176c934](https://github.com/voici5986/label-react/commit/176c9342a2666f8ee302d373c0431e91cc36ef6c))
* 添加标签格式化函数并优化图片内存管理 ([67d0f24](https://github.com/voici5986/label-react/commit/67d0f240f8020e8176a684ffe3b9e0141c34bcbf))
* 添加移动设备横屏提示和PWA安装功能 ([3c14831](https://github.com/voici5986/label-react/commit/3c148315b5679e59162a22275e5d5e21a5e43d80))
* 添加自动编号模式并优化字体缓存 ([1c8d736](https://github.com/voici5986/label-react/commit/1c8d7363ff0d0922d62aee0bd4d22725bfe29243))
* 统一品牌标识为LabelPilot并添加新Logo组件 ([7b81389](https://github.com/voici5986/label-react/commit/7b8138908e6c2dfa17258f4e5ed2f6be354e603c))
* 新增 `ThumbnailItem` 组件，支持图片缩略图展示、移除及数量编辑。 ([2d576d9](https://github.com/voici5986/label-react/commit/2d576d9b8fd51a1b6b918e65a3cae7a9c2d4d7a1))
* 新增二维码生成功能，更新项目版本至 1.4.0，并引入 ControlPanel 和 Header 组件。 ([8eafdbf](https://github.com/voici5986/label-react/commit/8eafdbff7324a4152318e5af808c26f287ae178d))
* 新增国际化支持、PDF 生成功能、智能按钮和控制面板组件，并更新了 ESLint 配置和项目依赖。 ([6aeef14](https://github.com/voici5986/label-react/commit/6aeef1414ede661aeec0ccc55d06902753a1e4c8))
* 新增React应用基础架构，实现图片选择、布局配置和PDF生成功能。 ([4a7e5e2](https://github.com/voici5986/label-react/commit/4a7e5e279f4a61ab49b80e4d9feb50c40545c28b))
* 引入 Husky Git Hooks、React 错误边界组件并集成 Vitest 单元测试框架。 ([137fecd](https://github.com/voici5986/label-react/commit/137fecd7f49e9b6ca5507a7b68f752facb276189))
* 引入双生成模式和 PWA 支持，同时更新项目名称、版本、文档和构建命令。 ([3a68f2b](https://github.com/voici5986/label-react/commit/3a68f2b55c5531ac4bf1b8d38b9fbc5918f27501))
* 支持自定义纸张尺寸和全局设置面板 ([b493fa7](https://github.com/voici5986/label-react/commit/b493fa7d3158eeed48ef16961190b84ffd332f18))
* **pwa:** 添加PWA支持以实现离线使用和更新提示 ([f209301](https://github.com/voici5986/label-react/commit/f2093018d5ccf9d94a569ad30f42b1338140cc7a))


### Performance Improvements

* 精简PWA资源缓存配置并放宽文件大小限制 ([998217b](https://github.com/voici5986/label-react/commit/998217b640fb89cea8a26116aa40216edbed12a6))
* **pdf:** 使用Transferable Objects优化图片数据传输性能 ([393020a](https://github.com/voici5986/label-react/commit/393020a396748aa94adbde4162e8626a8563700d))

# labelpilot

## 1.4.3

### Patch Changes

- a68efff: Automated release for changes:
  M .husky/pre-commit
  D .husky/pre-push
  M pnpm-lock.yaml

## 1.4.2

### Patch Changes

- chore(release): cut new version

## 1.4.1

### Patch Changes

- chore(release): cut new version
