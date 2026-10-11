# UI 维护记录

更新：2026-10-11

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
| P0 已落地  | `StepperButton`                   | `NumberInput`、`ThumbnailItem`                                      | 统一横排加减图标、禁用/焦点/按压状态和 aria 命名；form 变体移动 40px / 桌面 32px，默认 quantity 变体固定 40px              | 数值解析、图片数量草稿与业务上限                          |
| P0 已落地  | `FieldShell`                      | `NumberInput`、文本前缀、校准输入、设置输入                         | 管理 label、hint、error 与输入的 ID 关联，统一字段间距                                                                     | 数值解析、校验时机和文案；仅封装 `useId` 的 hook 收益不足 |
| P0 已落地  | `InlineAlert`                     | 生成就绪错误、文本错误、校准普通错误                                | 统一 danger/warning tone、文字对比度和 `role`；Toast 的布局与生命周期保持独立                                              | Toast 的定位、关闭动作和 live region 保持独立             |
| P0 已落地  | `useModalFocus`                   | `EditSheet`、`CalibrationDialog`                                    | 统一首焦点、Escape、Tab 环回和关闭后焦点恢复；过滤不可聚焦项                                                               | `SettingsMenu` 背景可点击，仍单独处理 popover/dialog 语义 |
| P0 已落地  | `IconButton`                      | Header 主题、Zoom reset、PageNavigator、Toast/ReloadPrompt 关闭按钮 | 统一有限尺寸变体、图标对齐、焦点和禁用反馈；提供明确名称，支持 ref 和原生事件                                              | 带文本按钮、生成状态机；拖拽把手和列表排序/删除暂未迁移   |
| P0 已落地  | `ActionButton`                    | 校准保存/取消、查看预览、更新提示、错误页操作                       | 原生属性/ref + 少量 primary/secondary/quiet 变体，统一按压、焦点和禁用状态；`weight` 与 `disabledOpacity` 处理明确层级差异 | `SmartButton` 的生成/取消状态机                           |
| 已有待深化 | `SegmentedControl`、`SmartButton` | 模式/方向切换、桌面与移动生成入口                                   | `SegmentedControl` 默认内部生成唯一 layout ID；需要隔离动画实例时允许调用方传入前缀                                        | 不在调用方复制一套近似 class                              |

P0/P1 表示复用收益优先级，不代表生产故障等级。“已落地”只表示首批调用点已经迁移，不代表所有相似按钮都必须立刻迁移。

### 迁移边界

- **步进按钮先于整个数值输入**：`NumberInput` 仅行数、列数、编号位数启用步进，表单和图片数量均使用横排减号、输入、加号。公共按钮通过 form / quantity 变体区分响应式表单尺寸与固定图片数量尺寸，保留各自草稿提交和归一化行为。调用方提供已翻译名称、disabled 和事件；公共 Module 不导入 store 或业务上限。
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
- 2026-09-20 critical-flow 的 Unicode+QR 用例在 CI 偶发失败（26/27）：trace 与 ARIA 快照确认是 `fill("")` 清空未生效（SettingsMenu 打开时的 rAF 自动聚焦抢走了输入框焦点），并非 QR 校验逻辑缺陷。修复：自动聚焦改为仅在焦点仍停留在 trigger/body 时执行，恢复步骤补 `toHaveValue("")`。修复后通过 194 条单测与 27 条完整 E2E；同提交重跑前后的 CI 结果仍待观察，以确认偶发已消除。
- 测试约定：修改输入后先断言输入已生效（`toHaveValue`/`toHaveText`），再断言下游状态；否则失败信息会把"输入未生效"误导成业务校验缺陷。
- 此约定针对用户输入交互；直接调用 store action 构造测试状态不属于输入交互，仍应验证该测试关注的最终行为。

以下三节按 2026-10-07 的完成顺序记录不同代码快照。测试数量是各阶段当时的套件总数，后续阶段新增回归，因此不能把三组数字视为同一快照的验收结果。E2E 均指当时配置的 Chromium 套件（桌面及四种移动设备/视口仿真），不代表跨浏览器或真实移动设备验收。

### 阶段 1：数值输入调整验收（2026-10-07）

- 根据用户确认的 HTML 预览，仅行数、列数、编号位数保留横排减号、居中输入、加号；边距、间距、起始编号、总数量和自定义纸张宽高改为直接输入。图片数量保留原有加减操作。
- 表单移动端高 40px、桌面高 32px，图片数量按钮维持 40px。↑ / ↓ 使用原有步长调整，保留原始草稿、Enter 提交及 Escape 恢复；不改变业务范围。
- Chromium 实测：320×667 亮色、375×667 暗色和 1280×720 桌面。320px 下无页面横向溢出，起始编号输入宽约 123px，六位数字约 50px，可完整显示；保留的移动步进按钮实测 40×40px，桌面为 32×32px。
- 实际键盘验证自定义纸张宽度逐字输入 210、起始编号 8 → ↑ 得到 9 → Escape 恢复聚焦前值且编辑面板保持打开；行数输入 8 后点击加号得到 9。
- 当时的 212 条单元测试、类型、lint、相关文件格式、文档链接与 diff 检查通过。生产构建包含 PWA 生成通过；生产预览下当时配置的 Chromium E2E 27/27 通过。开发服务器上的清单检查失败在生产预览中未复现。
- 独立代码复审未发现实质问题。本轮不做截图对比测试；上述 Chromium 仿真不代表真实触屏、Safari 或读屏器验收。

### 阶段 2：混合输入预览透明度修复（2026-10-07）

- 主鼠标支持悬停且为精细指针时，次触屏不再阻止缩放与翻页组闲置时降至 60%；主粗指针或无悬停能力仍保持 100%。沿用悬停、焦点、按压和拖动恢复，不增加指针跟踪逻辑。
- `e2e/critical-flow.spec.ts` 使用 Chromium 的 Blink 设备设置，断言设备同时报告 `hover: hover`、`pointer: fine`、`any-pointer: coarse`。CSS 仅以主指针条件 `@media (hover: hover) and (pointer: fine)` 控制闲置透明度；`any-pointer: coarse` 是测试中确认次触屏存在的条件，不参与 CSS 查询。修复前生产构建下回归失败：闲置缩放组实际 100%，预期 60%；修复后同一测试通过。
- 同一回归覆盖两组闲置 60%、悬停及焦点恢复 100%、滑块拖出组外仍保持 100%、禁用图标局部补偿 50%，以及 CDP 切换主触屏后两组恢复 100%。生产构建、当时的 212 条单元测试、28 条生产预览 Chromium E2E、类型、lint、格式、文档链接与 diff 检查通过。该阶段比阶段 1 新增 1 条 E2E。真实 Chromium 页面在主鼠标与次触屏条件下实测两组闲置透明度均为 0.6。未做截图对比测试，Chromium 仿真不代表真实触屏或 Safari 验收。

### 阶段 3：数值交互与累计像素修复（2026-10-07）

- 1:1 模式下滑块显示 100%，首次方向键调整以该值为起点切回手动缩放。单测覆盖四个方向键，生产预览回归覆盖手动 300% → 1:1 → ↓ 得到 90%，再次 ↓ 得到 80%，且焦点保持在滑块。
- 图片数量清空后失焦或 Enter 恢复当前数量，不提交为 1；非空的 0 和超上限输入仍分别归一化为 1 和 999。四种移动视口的生产预览回归同时验证清空提交与合法数量保存。
- 上传完成解码后重新读取当前队列，补齐已有文件尺寸，再同步校验完整队列并追加文件，防止分批或并发上传绕过累计 160MP 限制。成功尺寸用 File 弱引用缓存，避免重复解码；失败结果不缓存。集成测试保留真实签名与像素校验，仅替代解码器，覆盖分批 4+1、并发完成、已有文件未缓存、160MP 边界及等待期间删除、排序、数量和排版修改。
- 修复前两项交互回归有 6 项失败，累计像素集成回归有 4 项失败；修复后当时的 227 条单元测试、33 条生产预览 Chromium E2E、类型、lint、相关文件格式、文档链接、diff 与生产构建检查通过。该阶段比阶段 2 新增 15 条单测和 5 条 E2E（1 条桌面缩放及 4 个移动仿真项目中的数量用例）。累计像素的极大图片场景由上述集成测试验证，未在浏览器中加载整组极大图片；未新增截图测试，移动项目为 Chromium 仿真。

### 提交范围说明（2026-10-09）

- `1037fd0` 的标题“新增图片上传流程”及正文“优化缩略图展示”不准确：相关 diff 加固的是既有上传流程的累计像素与并发准入，`ThumbnailItem` 仅修复空数量草稿提交行为，没有新增上传流程或改变缩略图展示。
- 该提交的 UI 修复还包含混合输入设备上的闲置半透明恢复，以及 1:1 模式方向键以显示的 100% 为起点。这两项在提交正文中漏述，实际规则与阶段 2、阶段 3 的记录一致。
- 提交正文所称“完整的端到端测试覆盖”应理解为当时配置的 Chromium 套件全部通过；CI 仅安装 Chromium，移动项目是设备/视口仿真。上述阶段记录保留原始数量并明确范围，不表示真实触屏、Safari 或所有交互已有完整覆盖。该提交还包含依赖更新；本轮修正不更改依赖或改写提交历史。

### 标准复核与校验收拢（2026-10-09）

- `createImagePixelBudget` 集中管理累计像素，文件内容校验、队列准入和 PDF worker 共用，每次操作独立创建预算。仍逐张提前校验，保留原有上限、成功尺寸缓存和 worker 的进度/让出执行时机；底层 `validateImageDimensions` 契约保持兼容。`ImageDimensions` 类型移到首次使用之前。
- 上传事务迁入 `useStore.addImageFiles`，App 仅调用 action 并展示本地化错误。解码前的廉价元数据拦截与解码后的竞态复核用途不同，两次检查均保留；最终校验与追加仍同步执行，`setImageItems` 的预览 URL 生命周期保持原样。竞态测试仅替代所需校验依赖，不再手写标签计数或复制资源上限。
- `FileListItem` 保留每行独立拖拽控制器和禁用整行拖拽的职责。已排除的 `ImageFilesSection.test.tsx` 不纳入本轮修改；`App.uploadPixels.test.tsx` 的直接 store 状态构造不属于用户输入交互，未增加无关断言。
- 新增 4 条回归覆盖独立预算、失败不消耗预算、直接 action 的提前拒绝/最新默认数量/URL 生命周期，以及 worker 累计超限和下一请求重置。231 条单元测试、33 条生产预览 Chromium E2E（桌面及四种移动仿真）、类型、lint、相关文件格式、文档链接、diff 和含 PWA 的生产构建通过；独立静态复审未发现实质问题。真实触屏与 Safari 未验收。

### 复核修复与验证边界（2026-10-11）

- 已实现本轮批准的 UI 修复：预览区域可聚焦及本地化名称、校准线防收缩和横向滚动、数值输入语义与夹制播报、上传入口名称、QR 百分比说明、行内校验按场景播报、编辑面板展开按钮状态，以及重复 Toast 按事件标识重新计时。数值输入原有实时更新、Enter/失焦提交和 Escape 恢复行为保留。
- README 已按当前 `IMAGE_LIMITS` 修正图片队列限制：最多 20 个文件，单文件 10 MiB、合计 50 MiB；移除上百张高分辨率图片的承诺，并补充首次联网缓存、第三方资产声明和本地发版入口。
- 发布质量门禁共八项：锁定依赖安装、格式、lint、文档链接、单元测试、生产构建、PDF 可选渲染器离线检查和 Chromium E2E。生产构建包含应用、E2E、Playwright 配置及 scripts 类型检查，并校验必要字体、应用/worker chunk 和导入目标的预缓存；可选 jsPDF HTML/SVG 渲染器使用明确拒绝调用的桩，不再设置依赖排除白名单。pnpm 锁定为 12.11.2，清理 21 项过期发布年龄例外；应用依赖版本未改变。
- 新增回归覆盖合法低校准系数下验证线的实际宽度及右端点可达、高倍率键盘预览滚动、重复 Toast 计时、数值草稿语义和夹制播报。生产构建浏览器回归还覆盖关闭在线页面后的离线冷启动、字体加载、真实 Worker 多页中文及 QR PDF 生成，以及 Service Worker 内容变化后的提示、激活和刷新；更新测试只改变本地测试服务器返回的字节，不改写构建产物。
- 本地验证通过：247 条单元测试（37 个文件）、37 条 Chromium E2E（CI 等价模式，含四种移动设备/视口仿真）、格式、lint、文档链接、类型、含预缓存门禁的生产构建、冻结锁文件安装（跳过生命周期脚本）、PowerShell 发版脚本语法和 diff 检查。此处为本轮快照，不代表远端 CI、Vercel 部署、真实移动设备、辅助技术或字体授权已验收。

### 核心输出与边界修复（2026-10-11）

- 图片与栅格文本显式传入 jsPDF 别名，图片别名由 Worker 在单次请求内生成，不依赖外部 item id；相同 buffer 与 MIME 的准备结果及别名可复用。真实 jsPDF 与浏览器回归确认：两张隐式哈希会碰撞的合法 PNG 仍分别保留其红、蓝像素。
- PNG 先校验结构及源尺寸预算，再以有界压缩输入流验证解压后的精确扫描行长度、滤波字节、位深及 Adam7 交错布局；不保留额外的完整 RGBA 位图。jsPDF 嵌入时仍检查 CRC 并实际解码，损坏源映射为带文件名的错误。没有流式解压 API 时使用原生 bitmap 验证并关闭，缺少两种验证能力时拒绝生成。缓存命中仍计入每个队列项的累计像素预算。
- ASCII 文本改用文字盒中心与 middle 基线；毫米/点换算使用 25.4/72。真实内容流回归覆盖坐标，仍不承诺不同字体替代环境下与预览逐像素一致。
- 预览适应倍率始终为有限正数，极窄容器最小为 0.01；恢复容器后正常适应，1:1 模式继续只依赖校准系数。图片模式直接调用生成入口时，空队列在创建 Worker 或下载前被拒绝。
- 输出质量提示不改变生成门禁：非 ASCII 文本受画布上限影响时显示预计 DPI；已知 JPEG 或 MIME 未声明的图片队列显示条件式方向归一化说明；实际旋转 JPEG 的 1600 万像素处理上限与提示同源。方向切换若夹制行列，显示调整前后的网格；原行列上限保持。
- 最终本地验证通过：290 条单元测试（40 个文件）、42 条 Chromium E2E（CI 等价模式，含四种移动设备/视口仿真）、格式、lint、文档链接、应用与 E2E 类型、含预缓存门禁的生产构建和 diff 检查。浏览器覆盖实际嵌入像素、ASCII 内容流坐标、绕过上传入口的损坏 PNG 拒绝、极窄容器与 1:1、方向调整提示以及低 DPI 提示下仍能生成 PDF。
- 独立复审发现的短扫描行与未知关键块接受差异均已修复并补回归；复审未发现剩余实质问题。合法未知附属块、低位深及 Adam7 PNG 保持兼容。真实低端设备内存、实体打印效果、辅助技术、Safari 和线上部署不在本轮验收范围。

### 补齐复核清单（2026-10-11）

- 可选 jsPDF HTML/SVG 渲染依赖通过 Vite alias 替换为明确拒绝调用的桩，应用和 Worker 构建均生效。预缓存门禁不再豁免 html2canvas/purify/index.es；所有应用 JS 及字面量静态/动态导入必须有缓存，SW 自身与 Workbox 启动文件按独立合同验证。当前产物可选依赖由 384013 字节减少为 429 字节，并有离线冷启动桩验证。
- PNG 上传只读取头部预算与完整压缩文件结构，避免全尺寸 bitmap 和 inflate；JPEG 保持原生解码。完整 CRC/扫描行校验仍由 Worker 执行，接受其完整解压 CPU 代价，保留既有损坏 PNG 防护。测试夹具改用合法 PNG，并继续验证成功缓存、失败重试、累计预算、并发准入、最新默认数量及 URL 生命周期。
- App 单实例计算 readiness，下传桌面与移动面板；进度按 rAF 合并，相同百分比及阶段不产生额外提交。取消、重试、失败、成功及卸载隔离迟到回调，成功立即显示 100%。本轮不额外改预览槽位 memo 策略。
- 小图片单元格最短边低于建议的 5 mm 时显示非阻断提醒；方向调整、QR 百分比和面板状态沿用已实现的行为。InlineAlert 默认使用 polite status，调用方为阻断字段、布局及生成错误明确传入 alert；非阻断质量提醒仍使用 status，独立错误 Toast 继续使用 alert。
- DPR 失效容差改为校准时 DPR 的 3%，在不同缩放比例下具有相同灵敏度；逻辑分辨率变化保留保守重校信号。相同 DPR 和分辨率不能识别显示器，换屏后仍应核对并重校，不能据此保证物理尺寸一直有效。
- scripts 的 JavaScript 和测试通过 allowJs/checkJs 严格 noEmit 项目纳入构建类型门禁；新增 vercel.json 为入口文件及根路径配置重新验证、为内容哈希资源配置长期 immutable 缓存。真实线上响应头与真机/辅助技术测试仍另行验收。
- 本地最终验证通过：319 条单元测试（42 个文件）、43 条 Chromium E2E（CI 等价模式，含四种移动设备/视口仿真）、格式、lint、文档链接、应用/E2E/scripts 严格类型检查、生产构建、预缓存门禁及实际产物的离线冷启动拒绝桩检查。独立复审未发现新的实质问题；应用依赖版本未改变，改动保持未提交、未推送。
- 已复验既有方向调整说明、QR aria-valuetext 与面板 aria-pressed。nonce 位于局部 AnimatePresence 外，重挂载会卸载旧子树；目前不产生双 dialog。数值与图片数量字段均支持 Escape 恢复编辑前的值，实时发布时机沿用既有交互。
- 后续维护留意：预缓存解析随 Workbox 输出格式变化会 fail-closed；修改 PWA 测试并行设置时复核本地服务器与修订状态隔离；jsPDF 基线及 DPI 测试是具体输出合同，依赖/画布策略升级时应先核对再更新期望；条件式 JPEG 提示可在取得可靠方向元数据后细化。P3 清理和字体许可审查继续按各自成本与验收条件安排。

### 协议与别名回归补齐（2026-10-11）

- 本地核对时并不存在协议常量或版本断言；本轮新增协议版本 1，请求 data 与所有响应 envelope 均携带版本。严格校验器与收发边界同时拒绝缺失或不兼容的版本，Worker 在解码/渲染前拒绝请求，主线程在创建下载前拒绝旧 Worker 的无版本完成消息并清理 Worker。版本不一致以独立错误码提示刷新重试；协议结构发生不兼容变化时须提升版本，版本检查不等同于构建提交身份检查。
- 正常测试消息使用合法版本字段；缺失版本、错误版本及旧响应以明确的异常场景测试，不再通过非法类型断言伪造正常请求。未知错误码和畸形消息继续独立拒绝。
- 真实 jsPDF 回归验证相同 buffer 的 3 份同图与 2 份异图恰好嵌入 2 个图像对象，按顺序绘制 5 次并跨 3 页；缓存命中数量、第三来源、不同纸张下源像素与放置矩阵、Unicode 图像身份均有断言。栅格文本别名包含文字、宽、高和字号，任一变化都会改变身份。
- 浏览器图片回归改用两张不同的合法 RGB PNG，精确断言 2 个对象和红/蓝像素；旋转与原方向 JPEG 同时验证两个对象及各自尺寸；10 个中文标签断言 10 个独立原生栅格图像。PDF 输出回归精确验证 3+2 的五次绘制，不使用大于等于 1 来证明未合并。
- 实际画布上限仍为 2048×1024，默认 ASCII 标签仍使用矢量 Courier；新增大中文标签画布预算回归，并保留现有 DPI 提示。未发现所述 8192×8192 或“3 秒”注释，不据其他快照改动当前策略。
- 新增统一命令 pnpm run check:pdf-optional，CI 安装浏览器后执行，本地发布同样执行，发布门禁共八项。命令检查真实构建产物在冷离线状态下对不支持的 HTML/SVG API 明确拒绝。
- 本地验证通过：345 条单元测试（43 个文件）、43 条 Chromium E2E（CI 等价模式，含四种移动设备/视口仿真）、格式、lint、文档链接、应用/E2E/scripts 类型、构建及预缓存门禁、可选渲染器离线检查、PowerShell 语法和 diff 检查。独立复审未发现实质问题；远端 CI、部署及实体打印不在本轮验收范围。

### 请求关联与错误播报复核（2026-10-11）

- 发布门禁的旧“七项”描述已同步为八项，并删除已取消的可选依赖排除白名单说明；当前门禁与本地发布脚本、CI 的检查入口一致。
- 阻断生成或保存的字段、图片、布局及校准错误使用 assertive alert；质量、方向调整和软校准提醒仍使用 polite status。InlineAlert 保留默认 status 与调用方 role 覆盖，FieldShell、预览布局错误及独立错误 Toast 保留 alert。回归覆盖强错误与软提醒并存、有效输入恢复及生成按钮状态。
- 协议因新增请求关联字段提升至版本 2。主线程为每次生成创建 requestId，Worker 的进度、完成和错误响应均回传 ID；严格校验器拒绝缺失、空白或超长 ID。有效的当前版本异 ID 响应与已结束任务的迟到响应被忽略，每次生成最多输出三条含预期/收到 ID 的诊断；版本不兼容或畸形消息仍先拒绝，不按异 ID 隐藏协议错误。
- Worker 保持单请求 in-flight 所有权，并发请求返回携带自身 ID 的 busy 错误，拒绝路径不会释放其他请求的锁。成功或失败后释放锁，后续请求可正常生成；主线程仍为每次生成创建独立 Worker。本地回归覆盖连续并发拒绝、失败后重试、取消/迟到响应及真实 Worker 的响应关联。
- E2E 已通过 extends 继承应用严格编译选项，导入的 src 模块也纳入该严格程序；重复检查不构成已确认的类型不一致。实测直接引用 noEmit 应用项目会产生 TS6306/TS6310，要求启用 composite 和声明输出；本轮保留 noEmit 与现有构建门禁，不为消除重复检查增加声明产物。
- 最终本地验证通过：371 条单元测试（43 个文件）、43 条 Chromium E2E（CI 等价模式，含四种移动设备/视口仿真）、格式、lint、文档链接、应用/E2E/scripts 类型、生产构建及预缓存门禁、可选渲染器离线检查、PowerShell 语法和 diff 检查。E2E 使用现有本仓库预览服务器，执行前比对首页及全部 JS 与本次 dist 字节一致；独立复审未发现实质问题。改动未提交、未推送、未部署，真实读屏朗读行为仍需另行验收。

### 回退、提示与真源复核（2026-10-11）

- 未测量或隐藏容器的零尺寸，以及其他非正/非有限尺寸，fit 回退为初始 0.8；已测量的正尺寸即使小于 20 px，仍夹制到 0.01，防止镜像或非有限倍率。修正旧零尺寸期望，保留实际尺寸模式与 fit 独立的合同。中文夹制播报在字段名与“已调整”之间补空格。
- JPEG 上传按标记段做有界方向元数据读取，不解码像素或读取完整扫描数据，并设读取操作预算；与 Worker 共用原 EXIF 解析。成功验证文件的方向用 WeakMap 缓存，组件不再次读文件或解码。方向 1/无 EXIF 的 JPEG 与已验证 PNG 不显示归一化提醒；方向 2–8 显示，未知或预算耗尽仍保留条件式提醒。Worker 原完整扫描/EOI 验证及直通/重编码行为不变。
- 文本、布局和自定义纸张的 UI 限制引用现有领域常量，校准参考选项/类型/守卫同源，硬边界错误文案引用 K 常量；上传提示从 IMAGE_LIMITS 插值。翻译守卫比较双语键集合与插值变量集合，避免缺英文键静默回落及参数遗漏。
- 删除六组无引用双语词条、FieldShell 无生产调用的 error/errorId、ControlPanel/LayoutFields 无生产调用的行列覆盖 props，以及 min-h-app 死 utility。tooltip 变量实际参与主题映射，予以保留；桌面与移动面板的布局顺序、容器和交互不同，整体复用仍属维护性重构，本轮不改。PWA 更新测试显式声明 serial，保护共享服务器修订状态。
- Vercel 缓存规则补充根目录 workbox 哈希脚本的 immutable 缓存，契约测试按必需规则断言，允许扩展规则而非锁死数组形状。规则使用 [Vercel headers 的 source 模式](https://vercel.com/docs/project-configuration/vercel-json#headers)；配置与本地检查不能代替部署响应头，P1-2 仍待线上验收。
- 最终本地验证通过：408 条单元测试（46 个文件）、43 条 Chromium E2E（CI 等价模式，含四种移动设备/视口仿真）、格式、lint、文档链接、应用/E2E/scripts 类型、生产构建、预缓存门禁、可选渲染器离线检查、PowerShell 语法和 diff 检查。JPEG 浏览器回归验证直通无提示、方向纠正有提示及两个独立 PDF 图像对象；现有预览服务器的首页与全部 JS 已比对为本次 dist。独立复审未发现实质问题，改动未提交、未推送、未部署。

仍待运行的验收（保留原报告编号；原第 3 项极窄预览已由本地 Chromium 实际 ResizeObserver 回归覆盖）：

- 原 1：真实 Vercel 响应头，包含根入口、sw、manifest、assets 和 workbox 哈希脚本；验证入口重新验证、哈希文件长期 immutable。
- 原 2：NVDA/JAWS 虚拟光标能否进入模态背景，以及真实强错误/软提醒朗读。
- 原 4：生成期间禁用字段的实际焦点落点。
- 原 5：真实浏览器 PNG 字节下 jsPDF 隐式别名碰撞率；当前显式别名已避免依赖该概率。
- 原 6：ASCII 默认布局在真实 PDF、预览与实体打印间的视觉量级。
- 原 7：低端设备生成 4×40MP PNG 的时间与内存曲线。
- 原 8：真实 CMYK/Adobe-transform JPEG 的颜色，以及 Safari/iOS 下载可靠性。

### JPEG 准入与逻辑网格补齐（2026-10-11）

- JPEG 上传先有界读取 SOF 尺寸与 EXIF 方向，在完整压缩文件读取之前检查像素预算；方向 5–8 交换返回尺寸轴。通过共享解析器检查压缩标记结构与头部元数据一致性后才缓存，不再为读取尺寸调用 Image/createImageBitmap。PNG 仍不 inflate；页面显示缩略图时浏览器自身的图片渲染不属于此准入路径。
- JPEG 解析器拒绝重复 SOF、非法标记、错误段长度/组件、空扫描和缺 EOI，兼容已有的多 SOS、字节填充、重启标记和 APP14。首个 SOS 后方向固定，晚到 APP1 不改方向，避免头部读取与完整结构检查口径不同而误拒。该检查只证明标记结构：非空坏熵数据加合法 EOI 仍可能通过，直通 JPEG 也没有新增像素解码校验；P3-19 的像素完整性不能据此宣称完全关闭。T.81 结构依据见 [JPEG 标准](https://www.w3.org/Graphics/JPEG/itu-t81.pdf)。
- Worker 未命中缓存时只解析一次元数据并传入准备步骤；命中时使用原始尺寸计入每个队列项的预算，不按归一化后的缩小尺寸减免。缓存继续按 buffer/MIME 隔离；Worker 测试复用共享 JPEG 夹具，该夹具仅用于结构测试，不代表可解码像素。
- 新增持久化的逻辑 gridPreferences，版本提升为 4。当前 config 保持方向上限内的有效网格，切换回原方向恢复逻辑偏好；修改边距、纸张或单个维度不会吃掉另一维度偏好。旧存储仅从其现存有效网格迁移，不能恢复过去已经丢失的输入。桌面/移动提示明确说明临时调整并保留偏好。
- 数值输入未编辑的 blur/Enter 及边界箭头不再发布无变化值；网格输入 Escape 恢复聚焦时的逻辑偏好，避免有效 10 覆盖隐藏的逻辑 20。明确输入新的 9/10 仍更新偏好。
- PreviewPanel 使用默认浅比较 memo，并稳定 App 的相关回调；生成进度和 Toast 等父级状态不重新渲染预览槽位，store、缩放及语言更新仍生效。回归通过真实 App 进度回调检查 QR 预览渲染次数，不宣称已测得真机耗时收益。
- 屏幕尺寸硬等值判定继续保留为保守重校信号：相同 DPR 和分辨率不会因这两个字段而误报，也无法识别同规格换屏；不同逻辑分辨率仍要求重校。跨屏物理尺寸仍需人工核对，不能仅靠这些信号判断。
- 最终本地验证通过：457 条单元测试（47 个文件）、43 条 Chromium E2E（CI 等价模式，含四种移动设备/视口仿真）、格式、lint、文档链接、应用/E2E/scripts 类型、生产构建、预缓存门禁及可选渲染器离线检查。浏览器覆盖方向夹制后重载并恢复 20、真实 JPEG 方向提示及两个独立 PDF 图像对象；预览服务器首页和全部 JS 已与本次 dist 比对一致。独立复审的晚到 APP1 兼容性发现已修复并复验，无未解决实质发现；改动未提交、未推送、未部署。
- 本次主 JS 产物为 500.95 kB（gzip 161.36 kB），触发 Vite 的 500 kB 体积提示；预缓存仍通过，未提高告警阈值。拆包收益、低端设备内存及上述真实部署/辅助技术验收仍另行测量。

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
