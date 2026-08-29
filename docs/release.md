# 发布流程

## 版本基线

<!-- semantic-release:current-release:start -->

当前发布标签：`v1.3.1`
`package.json` 版本：`1.3.1`

<!-- semantic-release:current-release:end -->

上述区块由 `semantic-release` 在正式发版时自动更新。后续版本完全根据当前发布标签之后的 Conventional Commits 计算，不要手工修改版本区块、`package.json` 版本号或 `CHANGELOG.md`。

## 什么时候发版

发版脚本要求 PowerShell 7.6 或更高版本（当前验证版本为 7.6.5）。发版不是每次 push 自动执行，而是维护者需要发布时，在本地 `main` 分支手动运行：

```powershell
.\release.ps1
```

直接回车选择“正式发版”，或明确运行：

```powershell
.\release.ps1 -Release
```

脚本会依次完成：

1. 确认当前位于干净的 `main`，执行真实的 `git fetch`，要求 `HEAD`、本地 `main`、刚刷新的 `origin/main` 三者完全一致，并要求本地与远端的全部标签引用及目标完全一致。
2. 执行 frozen install、格式检查、lint、单元测试、生产构建和 Playwright 端到端测试。
3. 运行 `semantic-release` 预演，显示下一版本；没有可发布提交时正常结束。
4. 要求输入完整版本号进行确认。
5. 再次刷新并校验远端，防止验证期间 `main` 已发生变化。
6. 更新 `package.json`、`CHANGELOG.md` 和 `docs/release.md`，创建 `chore(release): ... [skip ci]` 提交和 `vX.Y.Z` 标签，然后推送 `main` 与标签。
7. 重新读取远端，确认分支、版本和标签都指向同一个 release commit。

本流程不发布 npm 包、不上传 `dist`、不创建 GitHub Release 页面，也不替代 Vercel 的部署策略。

## 提交如何决定版本

默认规则如下：

- `fix:`、`fix(scope):`、`perf:` 或 revert：patch，例如 `1.3.0` → `1.3.1`。
- `feat:` 或 `feat(scope):`：minor，例如 `1.3.0` → `1.4.0`。
- `type!:` 或正文中的 `BREAKING CHANGE:`：major，例如 `1.3.0` → `2.0.0`。
- 不含 breaking-change 标记时，`chore:`、`docs:`、`refactor:`、`test:`、`style:`、`build:`、`ci:` 等默认不发版。

`deps:` 不是默认 Conventional Commit 类型，`chore(deps):` 本身也不会自动发布（包含 `BREAKING CHANGE:` 时除外）。需要随依赖修复发布时，请使用类似：

```text
fix(deps): update image processing dependency
```

提交仍受 `.husky/commit-msg` 的 commitlint 检查。

## 预演和仅验证

只想确认下一版本而不修改仓库：

```powershell
.\release.ps1 -DryRun
```

该模式执行完整验证和 `semantic-release` 预演，但不会修改文件、创建提交或标签，也不会推送。

只运行完整质量门禁：

```powershell
.\release.ps1 -ValidateOnly
```

该模式不运行 `semantic-release`。三个模式都要求干净且与远端精确同步的 `main` 和标签；远端认证、网络或 fetch 失败都会停止，脚本不会使用陈旧的远端引用继续。标签检查会阻止 `@semantic-release/git` 将本地独有标签顺带推送到远端。同一工作树同时只允许一个发版脚本运行。

端到端测试要求本机已有 Chromium；首次使用可运行：

```powershell
pnpm exec playwright install chromium
```

## CI 与 Git hooks

- 普通 push 仍由 GitHub Actions 的 `CI / verify` 执行完整 CI。
- 本地提交继续执行 pre-commit 的 format/lint-staged 和 commit-msg 检查。
- 本地 push 继续直接执行 `vitest run`。
- 正式发版前已经完成完整门禁，因此自动生成的 release commit 带 `[skip ci]`；semantic-release 推送时本地 pre-push hook 仍会再运行一次单元测试。

不需要单独的 GitHub Token、Actions 发版权限或 Release Please ruleset；只需要当前 Git 凭据有权向 `origin/main` 推送提交和标签。

## 失败处理

正式发版开始前，脚本会在系统临时目录保存快照。正式步骤失败时，它会再次检查本地和远端状态并生成诊断 JSON，列出：

- 发版前后 HEAD、版本和工作区状态；
- 新增的本地标签；
- 远端 `main` 和标签是否已发生变化；
- 在确认远端尚未发布时可人工选择的救援分支、reset 和删标签命令。

脚本不会自动 reset、删标签或覆盖远端。出现失败后不要直接重跑发版，应先按输出核对 GitHub 和诊断文件。

## 从 Release Please 迁移的一次性清理

仓库中的 Release Please workflow 已删除。若 GitHub 上仍有旧的 Release PR 或 `release-please--branches--main--components--labelpilot` 分支，请手工关闭 PR 并删除该远端分支；若 `RELEASE_PLEASE_TOKEN` 只用于这个流程，也可以删除该 Secret。
