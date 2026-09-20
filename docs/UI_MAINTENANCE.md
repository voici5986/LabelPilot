# UI 维护记录

更新：2026-09-20

从 [UI 设计规范](UI_DESIGN_SPEC.md) 迁出的待办、复用评估与验证记录。以下是迁移快照，不代表本次重新测试，复核后更新状态。

按用户要求保留独立本地记录。正式开发任务遵循 [Issue tracker](agents/issue-tracker.md)，关联 GitHub Issue；有 Issue 后以其状态为准，避免维护两套进度。

## 1. 待办与验收缺口

以下区分尚待评估的设计细节和验证缺口；候选建议不代表已批准或已实现：

### 预览修复（2026-09-20 已实现，视觉效果待用户实测）

- 标尺移至右上角，采用 1/2/5 刻度自适应长度，横线不超过约 80px，与底部翻页分开。
- 倍率改为常驻紧凑读数，键盘及触屏可见，并用 aria-describedby 解释比例。
- 页码、倍率、1:1 统一 font-mono 与 tabular-nums。
- 中英文及可访问名称改为“适应窗口 / Fit to Window”，补充适应比例和物理实际尺寸说明。

### 控件状态一致性（2026-09-20 已实现，视觉效果待用户实测）

- SmartButton：可取消的生成中保持不透明、正常颜色及 hover/tap，保留特殊进度表面。
- SegmentedControl、QR 开关和纸张选项：共享 choice-feedback，统一禁用弱化与光标反馈，包含 fieldset 继承禁用。
- QR 开关：增加 hover/active 明暗反馈，保留 checked 轨道色与滑块位置。
- SettingsMenu：主预设和 Custom 增加 aria-pressed，共享选项按压反馈；保留下拉菜单 aria-checked。
- ThumbnailItem：拖拽、排序、删除迁入 IconButton，统一图标按钮状态；拖拽保留 grab/grabbing，删除保留 danger 变体。
- 输入：input-base 与复合数量输入共享 input-disabled，保留输入框与按钮的类别差异。

状态含义见规范第 7 节；不把主操作、危险操作、分段控件与开关强行改成同一种外观。

### 设备与辅助技术验收

- **真实触屏与窄屏**：Chromium 的 Pixel 7、iPhone 14 配置、375px 和 360px 流程已通过；真实触屏误触率、320px 内容宽度和 Safari 仍需 UAT（iPhone 配置不等于 Safari 实测）。
- **辅助技术与视觉回归**：此前完整 26 条 Chromium 流程通过；随后焦点调整通过 192 条单测与 5 条缩放/校准流程，不据此宣称当前完整套件全部重跑。用户已实测确认焦点和半透明效果；本轮不做截图测试。真实读屏器、亮暗主题及复杂图片背景的完整验收仍待补齐。
- **对比度验收**：状态和 tooltip token 已有静态阈值测试，完整界面对比度仍需真实主题截图复核。
- 历史审查报告和原型目前位于被忽略的归档目录，不作为本规范的运行时依赖。

### 后续能力候选

鼠标滚轮、双指缩放尚未实现。未来若加入，应分别围绕指针位置、双指中点缩放，尚未排期。

## 2. 复用评估快照

以下保留原规范的落地清单与候选评估，不构成全部实施计划。稳定使用原则见规范第 6 节。

### 提取评估

公共组件的目标是让同一契约只有一个视觉实现，而不是把所有相似 JSX 合并成一个“万能组件”。满足以下条件时才抽取：

1. 至少有两个真实调用点；
2. 视觉结构、键盘行为、无障碍语义和状态模型基本一致；
3. 抽取后能减少重复 class 和重复测试，而不是增加大量互斥 props；
4. 业务校验、文案和数据变换仍由调用方负责，公共组件只拥有明确的 UI 契约。

建议按以下优先级演进：

| 优先级     | 候选                              | 当前调用点/范围                                                     | 建议边界                                                                                                                   | 不应合并的部分                                            |
| ---------- | --------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| P0 已落地  | `StepperButton`                   | `NumberInput`、`ThumbnailItem`                                      | 统一 `40px` 移动端步进按钮、图标、禁用/焦点/按压状态和 aria 命名；支持水平/响应式布局变体                                  | 行列/毫米的数值解析、图片数量草稿与业务上限               |
| P0 已落地  | `FieldShell`                      | `NumberInput`、文本前缀、校准输入、设置输入                         | 管理 label、hint、error 与输入的 ID 关联，统一字段间距                                                                     | 数值解析、校验时机和文案；仅封装 `useId` 的 hook 收益不足 |
| P0 已落地  | `InlineAlert`                     | 生成就绪错误、文本错误、校准普通错误                                | 统一 danger/warning tone、文字对比度和 `role`；Toast 的布局与生命周期保持独立                                              | Toast 的定位、关闭动作和 live region 保持独立             |
| P0 已落地  | `useModalFocus`                   | `EditSheet`、`CalibrationDialog`                                    | 统一首焦点、Escape、Tab 环回和关闭后焦点恢复；过滤不可聚焦项                                                               | `SettingsMenu` 背景可点击，仍单独处理 popover/dialog 语义 |
| P0 已落地  | `IconButton`                      | Header 主题、Zoom reset、PageNavigator、Toast/ReloadPrompt 关闭按钮 | 统一有限尺寸变体、图标对齐、焦点和禁用反馈；提供明确名称，支持 ref 和原生事件                                              | 带文本按钮、生成状态机；拖拽把手和列表排序/删除暂未迁移   |
| P0 已落地  | `ActionButton`                    | 校准保存/取消、查看预览、更新提示、错误页操作                       | 原生属性/ref + 少量 primary/secondary/quiet 变体，统一按压、焦点和禁用状态；`weight` 与 `disabledOpacity` 处理明确层级差异 | `SmartButton` 的生成/取消状态机                           |
| 已有待深化 | `SegmentedControl`、`SmartButton` | 模式/方向切换、桌面与移动生成入口                                   | `SegmentedControl` 默认内部生成唯一 layout ID；需要隔离动画实例时允许调用方传入前缀                                        | 不在调用方复制一套近似 class                              |

P0/P1 表示复用收益优先级，不代表生产故障等级。“已落地”只表示首批调用点已经迁移，不代表所有相似按钮都必须立刻迁移。

### 迁移边界

- **步进按钮先于整个数值输入**：`NumberInput` 在桌面是竖排箭头，移动端是横排加减；图片数量一直是横排。先共享按钮 Module，通过少量布局变体统一图标与尺寸，保留各自草稿提交和归一化行为。调用方提供已翻译名称、disabled 和事件；公共 Module 不导入 store 或业务上限。
- **IconButton 的 Interface**：有限的 size/tone、必需的可访问名称，加原生 button 属性/ref。内部统一图标尺寸、默认 `type="button"`、focus-visible 和 disabled；不让每个调用点继续覆盖宽高。不默认给所有按钮套 `hit-target`，由布局决定不重叠的命中策略。
- **字段容器与输入样式分工**：`FieldShell` 负责 label/hint/error 关联；基础输入外观继续复用 `input-base`。数值解析、提交时机和业务校验仍由调用方负责。
- **提示语义由使用场景决定**：普通行内错误可以共享窄范围的 danger tone；Toast 和更新提示只共享状态色 token，不共享布局、生命周期、关闭动作或 live region。避免提示内部和外层同时建立 live region，造成重复播报。
- **普通文字按钮可独立演进**：校准保存/取消、查看预览、更新按钮和错误页操作已统一到 `ActionButton` 的少量 primary/secondary/quiet 变体；字重和禁用透明度通过 `weight`、`disabledOpacity` 接口表达，不在调用方叠加冲突 utility；`SmartButton` 的生成/取消状态机保持独立。
- **模态焦点与轻量浮层分开**：`EditSheet` 和 `CalibrationDialog` 已共享 `useModalFocus`，由模块统一首焦点、Escape、Tab 环回、关闭恢复和不可聚焦项过滤；`SettingsMenu` 是非模态 dialog/popover，允许背景点击和 Tab 离开，并单独处理外部焦点关闭。
- **状态色和表面优先用 token/utility**：danger、warning、success、tooltip 的前景/淡背景/边框已集中到主题 token；重复的 `border + bg-surface` 可评估 `surface-card` utility，不为此创建透传大量布局参数的 React `Surface`。
- **分组标题先保留 utility**：`LayoutFields`、`TextModeFields`、图片分组共享 `group-title` 已有收益。仅标题加图标不必立即建组件；如需统一帮助入口或右侧摘要，再提取 SectionHeader，并允许调用方指定 h2/h3。
- **暂不提取**：二维码开关只有一个业务语义，QR range 与预览竖向缩放条交互不同；上传入口有真实文件 input 覆盖层，不能直接替换成普通按钮；预设菜单和分段选择的键盘语义也不同。
- **继续复用已有模块**：`LayoutFields`、`TextModeFields`、`ImageFilesSection`、`SegmentedControl`、`SmartButton` 已在桌面/移动流程复用，不再创建两套近似实现。

共享视觉 Module 可放在 `src/components/ui/`，业务组合留在现有目录；这是迁移建议，不为整理目录而移动无关文件。遵循 codebase-design 的小 Interface 原则：调用方只描述意图，尺寸、状态和关联复杂度集中在 Implementation；若移除 Module 后复杂度没有重新散落到调用点，就应重新评估提取价值。

每次先迁移两个真实调用点，通过行为测试和浏览器样式检查，再扩展。验证重点是键盘操作、disabled 不触发、aria 关联、亮暗主题、窄宽度和真实点击范围；不以 class 字符串一致作为唯一验收。视觉快照可逐步建立，不作为所有提取工作的前置工程。

## 3. 回归入口与历史证据

### 测试映射

| UI 契约            | 主要回归位置                                                                        | 必须守护的内容                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 桌面控制面板滚动链 | `ControlPanel.test.tsx`                                                             | 已有 class 结构断言；1440×420 浏览器验证 `clientHeight=301`、`scrollHeight=530`，生成按钮位于滚动区外 |
| 图片队列与数量控件 | `ImageFilesSection.test.tsx`、`e2e/mobile-flow.spec.ts`                             | 文件名优先、排序可用、数量步进按钮为 `40px` 可见尺寸、上传入口不重复显示摘要                          |
| 移动编辑面板       | `EditSheet.test.tsx`、`src/hooks/useModalFocus.test.tsx`、`e2e/mobile-flow.spec.ts` | 已有折叠错误、面板高度、上传流程和共享模态焦点环回检查；真实辅助技术仍待补                            |
| 设置浮层           | `SettingsMenu.test.tsx`                                                             | 非模态语义、外部点击/焦点关闭、打开首帧 Escape、短视口滚动类和隐藏/禁用项过滤                         |
| 主题对比度         | `themeContrast.test.ts`                                                             | 品牌色与状态/提示 token 的定义；完整界面对比度仍需视觉/辅助技术验收                                   |
| 预览/校准          | `PreviewPanel.test.tsx`、`ZoomControl.test.tsx`、`e2e/calibration-flow.spec.ts`     | 缩放间距与实际模式滑块、分页、布局错误 alert、环境失效后的回退                                        |
| 数值与字段模块     | `NumberInput.test.tsx`、相关组件测试                                                | 失焦/Enter 提交、Escape 恢复、FieldShell 的 label/hint 关联和边界 disabled                            |

- 2026-09-19 Chromium 360px 流程确认数量复合框和内部按钮均为 40px，使用 inset shadow 表达边框，焦点轮廓位于内部。
- 原规范记录 Toast 22px 按钮扩展 11px、gap 为 12px，命中检查未覆盖文字；Zoom reset 和 1:1 通过 gap-3 避让扩展命中区。不是本次重新测量。
- 层级实现快照：控制叠层 z-10/20/30，对话框与提示 z-50，设置子菜单 z-[100]，更新提示 z-[1000]；跨祖先不能只按数值判断顺序。
- 具体主题值以 src/index.css 为准，不另维护易漂移的亮暗色值表。
- 新增缩放覆盖位于 e2e/calibration-flow.spec.ts：默认居中、持续拖动、平移后缩放、校准进入实际尺寸、重置；同次拖动缩小至纸张小于视口再放大、边缘夹取仍可补测。
- 文档迁移阶段仅整理文档，未重跑程序测试。
- 随后的四项预览修复通过 193 条单测、27 条完整 Chromium E2E（含移动视口模拟）、lint、格式和构建检查；未做截图对比测试。独立静态审查未发现确认的实质问题。

## 4. 实现索引

当前规范主要对应以下实现：

- 主题 token、共享 utility、焦点和 reduced-motion：[`src/index.css`](../src/index.css)、[`src/main.tsx`](../src/main.tsx)
- 桌面/移动应用框架：[`src/App.tsx`](../src/App.tsx)、[`src/components/ControlPanel.tsx`](../src/components/ControlPanel.tsx)、[`src/components/EditSheet.tsx`](../src/components/EditSheet.tsx)、[`src/components/MobileActionBar.tsx`](../src/components/MobileActionBar.tsx)
- 表单与分段控件：[`src/components/NumberInput.tsx`](../src/components/NumberInput.tsx)、[`src/components/SegmentedControl.tsx`](../src/components/SegmentedControl.tsx)
- 公共 UI 模块：[`src/components/ui/StepperButton.tsx`](../src/components/ui/StepperButton.tsx)、[`src/components/ui/IconButton.tsx`](../src/components/ui/IconButton.tsx)、[`src/components/ui/ActionButton.tsx`](../src/components/ui/ActionButton.tsx)、[`src/components/ui/FieldShell.tsx`](../src/components/ui/FieldShell.tsx)、[`src/components/ui/InlineAlert.tsx`](../src/components/ui/InlineAlert.tsx)
- 模态焦点模块：[`src/hooks/useModalFocus.ts`](../src/hooks/useModalFocus.ts)、[`src/hooks/useModalFocus.test.tsx`](../src/hooks/useModalFocus.test.tsx)
- 顶部与设置浮层：[`src/components/Header.tsx`](../src/components/Header.tsx)、[`src/components/SettingsMenu.tsx`](../src/components/SettingsMenu.tsx)、[`src/components/Toast.tsx`](../src/components/Toast.tsx)、[`src/components/ReloadPrompt.tsx`](../src/components/ReloadPrompt.tsx)
- 图片队列与预览缩放：[`src/components/ImageFilesSection.tsx`](../src/components/ImageFilesSection.tsx)、[`src/components/ThumbnailItem.tsx`](../src/components/ThumbnailItem.tsx)、[`src/components/ZoomControl.tsx`](../src/components/ZoomControl.tsx)、[`src/components/PreviewPanel.tsx`](../src/components/PreviewPanel.tsx)
- 翻译与主题对比度测试：[`src/utils/translations.ts`](../src/utils/translations.ts)、[`src/utils/themeContrast.test.ts`](../src/utils/themeContrast.test.ts)
- 关键交互回归：[`e2e/mobile-flow.spec.ts`](../e2e/mobile-flow.spec.ts)、[`e2e/calibration-flow.spec.ts`](../e2e/calibration-flow.spec.ts)、[`e2e/critical-flow.spec.ts`](../e2e/critical-flow.spec.ts)

## 5. 维护方式

- 问题写清位置、影响、确认程度和建议；风险不等于已确认缺陷。
- 完成工作记录验证范围或关联 Issue/提交，再更新待办状态，保留必要证据。
- 稳定设计决定写入规范；执行状态与证据保留在这里，避免重复抄写。
