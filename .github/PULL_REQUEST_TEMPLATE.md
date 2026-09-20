## 关联

- Issue：<!-- 正式开发任务请关联 Issue，流程见 docs/agents/issue-tracker.md -->
- 变更类型：fix / feat / refactor / perf / docs / test / chore

## 变更说明

<!-- 做了什么、为什么。UI 相关可附关键截图或浏览器测量结论。 -->

## 验收清单

- [ ] `pnpm run format:check`、`pnpm run lint`、`pnpm test`、`pnpm run build` 通过
- [ ] 涉及 UI/交互：相关 e2e 通过，并复核键盘、触摸、亮暗主题、中英文与 320px 内容宽度
- [ ] 涉及布局/命中区：用浏览器测量验证，而不是只靠 class 断言
- [ ] 涉及文档：设计规则变化同步 `docs/UI_DESIGN_SPEC.md`，执行状态与验证证据更新 `docs/UI_MAINTENANCE.md`
