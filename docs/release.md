# 发布流程

## 版本基线

当前发布基线是 Git tag `v1.3.0`，对应提交 `0ee1446`；根 `package.json` 的版本也保持为 `1.3.0`。README 的版本徽章读取最新 Git tag，CHANGELOG 中的旧 Changesets 记录仅作为未发布历史保留。

## 正式发版

正式版本由 `.github/workflows/release-please.yml` 管理：

1. 提交按 Conventional Commits 合并到 `main`。
2. Release Please 创建或更新 Release PR，修改版本和 `CHANGELOG.md`。
3. `CI / verify` 在该 PR 上运行；确认检查通过后人工合并 Release PR。
4. Release Please 创建 `vX.Y.Z` tag 和对应 GitHub Release。

Release Please 不发布 npm、不上传 `dist`，也不替代 Vercel 的部署策略。

## 仓库设置

首次启用前，仓库管理员需要：

- 创建名为 `RELEASE_PLEASE_TOKEN` 的 Actions Secret。令牌需要能创建/更新 PR、写入仓库内容和 tag，并能让生成的 PR 触发后续 Actions；不要把令牌写入仓库。
- 在 Actions 设置中允许工作流创建和批准 Pull Request（若仓库策略要求）。
- 在 `main` 的 branch rules/ruleset 中将 `CI / verify` 设为 required check。

这些远程设置不由本地脚本自动修改。

## 本地校验

在提交或等待 Release PR 前，可运行：

```powershell
.\release.ps1 -ValidateOnly
```

该命令只执行 frozen install、格式检查、lint、单元测试和生产构建；不会修改版本、CHANGELOG、Git 历史、tag 或远程状态。正式发版不再通过本地脚本执行。

如果自上一个 tag 以来没有会触发版本提升的 Conventional Commit（例如 `feat:`、`fix:`、`deps:` 或 breaking change）或显式 `Release-As` 提示，Release Please 不创建 Release PR 属于正常行为。
