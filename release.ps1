# LabelPilot 严格校验与正式版本发布脚本
# 用法:
#   .\release.ps1                    # 交互选择创建正式版本或仅运行质量门禁
#   .\release.ps1 -Release           # 直接创建正式版本（跳过菜单，仍会二次确认）
#   .\release.ps1 -ValidateOnly      # 只运行全部质量门禁，不修改 Git
param(
    [switch]$Release,
    [switch]$ValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# 统一控制台为 UTF-8，避免中文输出或捕获 git 中文输出时
# 在 GBK（代码页 936）控制台上出现乱码。
try {
    [Console]::OutputEncoding = [Text.Encoding]::UTF8
    $OutputEncoding = [Text.Encoding]::UTF8
}
catch {
    # 非交互或受限环境下无法修改控制台编码，不影响发布流程。
}

$root = $PSScriptRoot
$packageJson = Join-Path $root "package.json"
$lockFile = Join-Path $root "pnpm-lock.yaml"
$formalReleaseStarted = $false

function Assert-RequiredFile {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "缺少发布所需文件: $Path"
    }
}

function Invoke-NativeStep {
    param(
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][string[]]$Arguments,
        [string]$WorkingDirectory = $root
    )

    Write-Host $Label -ForegroundColor Yellow
    Push-Location $WorkingDirectory
    try {
        & $Command @Arguments
        $exitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    if ($exitCode -ne 0) {
        throw "$Label 失败，退出码: $exitCode"
    }

    Write-Host "$Label 通过。" -ForegroundColor Green
}

function Invoke-NativeCaptureStep {
    param(
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][string[]]$Arguments,
        [string]$WorkingDirectory = $root,
        [switch]$ShowOutput,
        [switch]$Stream
    )

    Write-Host $Label -ForegroundColor Yellow
    # 分离 stdout 与 stderr：返回值只含 stdout，避免 git 的 CRLF 等 stderr 警告
    # 混入判定数据；stderr 仅用于失败诊断和 -ShowOutput 展示。
    $stdoutLines = [System.Collections.Generic.List[string]]::new()
    $combinedLines = [System.Collections.Generic.List[string]]::new()
    Push-Location $WorkingDirectory
    try {
        & $Command @Arguments 2>&1 | ForEach-Object {
            $line = "$_"
            $combinedLines.Add($line)
            if ($Stream) {
                Write-Host $line
            }
            if ($_ -isnot [System.Management.Automation.ErrorRecord]) {
                $stdoutLines.Add($line)
            }
        }
        $exitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    if ($ShowOutput) {
        foreach ($line in $combinedLines) {
            Write-Host $line
        }
    }

    if ($exitCode -ne 0) {
        $outputLines = @($combinedLines)
        if ($outputLines.Count -gt 60) {
            $outputLines = @(
                "... 已省略前 $($outputLines.Count - 60) 行输出 ..."
                $outputLines[-60..-1]
            )
        }
        $outputText = $outputLines -join [Environment]::NewLine
        throw "$Label 失败，退出码: $exitCode`n$outputText"
    }

    return @($stdoutLines)
}

function Get-SingleLineOutput {
    param(
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][string[]]$Arguments,
        [string]$WorkingDirectory = $root
    )

    # 标量读取（如 rev-parse、rev-list --count）必须恰好是一行非空输出；
    # 行数异常说明输出被污染或环境异常，立即中止而不是带着数组继续比较。
    $lines = @(
        Invoke-NativeCaptureStep $Label $Command $Arguments $WorkingDirectory |
            Where-Object { "$_".Trim() }
    )
    if ($lines.Count -ne 1) {
        throw "$Label 预期输出单行，实际得到 $($lines.Count) 行：$($lines -join ' | ')"
    }

    return $lines[0].Trim()
}

function Select-ReleaseMode {
    while ($true) {
        Write-Host ""
        Write-Host "请选择操作：" -ForegroundColor Cyan
        Write-Host "  [1] 创建正式版本（semantic-release 更新版本、CHANGELOG、Git 提交和标签并推送）"
        Write-Host "  [2] 仅运行质量门禁（不创建版本、不修改 Git）"
        Write-Host "  [Q] 取消"
        Write-Host ""
        $choice = (Read-Host "请选择 [默认 1]").Trim().ToUpperInvariant()

        switch ($choice) {
            "" { return "Release" }
            "1" { return "Release" }
            "2" { return "ValidateOnly" }
            "Q" { return "Cancel" }
            default {
                Write-Host "无效选择，请输入 1、2 或 Q。" -ForegroundColor Red
            }
        }
    }
}

function Get-PackageVersion {
    Assert-RequiredFile $packageJson
    $packageMetadata = Get-Content -LiteralPath $packageJson -Raw | ConvertFrom-Json
    $packageVersion = "$($packageMetadata.version)".Trim()
    if (-not $packageVersion) {
        throw "package.json 缺少有效的 version。"
    }
    if ($packageVersion -notmatch "^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$") {
        throw "package.json version 必须是无 build metadata 的 SemVer，例如 1.5.0 或 1.5.0-beta.1。当前值: $packageVersion"
    }

    return $packageVersion
}

function Assert-FormalReleaseGitState {
    $branch = Get-SingleLineOutput `
        "[正式版本] 检查 Git 分支" `
        "git" `
        @("branch", "--show-current")
    if ($branch -ne "main") {
        throw "正式版本只能在 main 分支创建，当前分支: $branch"
    }

    $status = @(
        Invoke-NativeCaptureStep `
            "[正式版本] 检查 Git 工作区" `
            "git" `
            @("status", "--porcelain", "--untracked-files=all")
    )
    if ($status.Count -gt 0) {
        throw "创建正式版本要求 Git 工作区干净，请先提交或处理未提交文件。`n$($status -join [Environment]::NewLine)"
    }

    return Get-SingleLineOutput `
        "[正式版本] 记录当前提交" `
        "git" `
        @("rev-parse", "HEAD")
}

function Get-NextReleaseVersion {
    $previewScript = @'
import semanticRelease from "semantic-release";

const result = await semanticRelease({ dryRun: true, ci: false });
const version = result?.nextRelease?.version ?? "";
process.stdout.write(`\nRELEASE_NEXT_VERSION=${version}\n`);
'@
    $previewOutput = Invoke-NativeCaptureStep `
        "[正式版本] 预演 semantic-release 并计算下一个版本" `
        "node" `
        @("--input-type=module", "--eval", $previewScript) `
        $root
    $previewText = $previewOutput -join [Environment]::NewLine
    $plainPreviewText = [regex]::Replace($previewText, "$([char]27)\[[0-9;]*[A-Za-z]", "")
    $versionMatch = [regex]::Match(
        $plainPreviewText,
        "RELEASE_NEXT_VERSION=([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)"
    )
    if (-not $versionMatch.Success) {
        throw "semantic-release 没有计算出可发布版本。请确认从上一个 Git 标签以来存在 fix、feat 或破坏性变更提交。"
    }

    $nextVersion = $versionMatch.Groups[1].Value
    Write-Host "下一个正式版本: v$nextVersion" -ForegroundColor Green
    return $nextVersion
}

function Confirm-FormalRelease {
    param(
        [Parameter(Mandatory)][string]$CurrentVersion,
        [Parameter(Mandatory)][string]$NextVersion
    )

    Write-Host ""
    Write-Host "即将创建正式版本：v$CurrentVersion -> v$NextVersion" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "semantic-release 将执行："
    Write-Host "  - 更新 package.json 和 CHANGELOG.md"
    Write-Host "  - 创建发布提交和 v$NextVersion Git 标签"
    Write-Host "  - 推送发布提交和标签到远程仓库"
    Write-Host "  - 不发布到 npm，不生成任何部署产物"
    Write-Host ""
    $confirmation = (Read-Host "确认创建正式版本？[y/N]").Trim()
    return $confirmation -match "^(?i:y|yes|是)$"
}

function Invoke-QualityGates {
    # 先锁定依赖，后续步骤统一使用已安装的依赖解析结果。
    Invoke-NativeStep "[准备] 校验锁文件并安装依赖" "pnpm" @(
        "install",
        "--frozen-lockfile"
    ) $root

    # 所有质量门禁都必须通过；发布脚本不提供跳过参数。
    Invoke-NativeStep "[1/4] 检查代码格式" "pnpm" @(
        "run",
        "format:check"
    ) $root
    Invoke-NativeStep "[2/4] 运行 lint" "pnpm" @(
        "run",
        "lint"
    ) $root
    Invoke-NativeStep "[3/4] 运行单元测试" "pnpm" @(
        "run",
        "test"
    ) $root
    Invoke-NativeStep "[4/4] 构建前端生产包" "pnpm" @(
        "run",
        "build"
    ) $root
}

function Invoke-FormalRelease {
    param([Parameter(Mandatory)][string]$ExpectedSourceHead)

    $currentVersion = Get-PackageVersion
    $nextReleaseVersion = Get-NextReleaseVersion
    if (-not (Confirm-FormalRelease $currentVersion $nextReleaseVersion)) {
        Write-Host "已取消创建正式版本，未修改 Git。" -ForegroundColor Yellow
        return $null
    }

    $verifiedHead = Assert-FormalReleaseGitState
    if ($verifiedHead -ne $ExpectedSourceHead) {
        throw "质量检查期间 Git HEAD 发生变化，拒绝继续创建正式版本。"
    }

    $script:formalReleaseStarted = $true
    # 流式显示 semantic-release 实时输出，同时捕获全部输出；
    # semantic-release 在无法发布时（如远程访问失败、分支落后、无可发布提交）
    # 会以退出码 0 静默退出，需要捕获输出才能诊断具体原因。
    $releaseOutput = @(
        Invoke-NativeCaptureStep `
            "[正式版本] 更新版本、CHANGELOG、Git 提交和标签" `
            "pnpm" `
            @("run", "release") `
            $root -Stream
    )

    $releasedVersion = Get-PackageVersion
    if ($releasedVersion -ne $nextReleaseVersion) {
        $releaseText = $releaseOutput -join [Environment]::NewLine
        $skipReason = if ($releaseText -match "is behind the remote") {
            "本地分支落后于远程分支，请先推送或同步本地提交。"
        }
        elseif ($releaseText -match "not a release branch|not triggered") {
            "当前分支不是发布分支（.releaserc.json 配置为 main）。"
        }
        elseif ($releaseText -match "no relevant") {
            "自上一个标签以来没有 fix、feat 或破坏性变更提交。"
        }
        elseif ($releaseText -match "ls-remote|ENOTFOUND|ETIMEDOUT|Could not resolve|failed to connect") {
            "远程仓库访问失败（网络或凭据问题），请稍后重试。"
        }
        elseif ($releaseText -match "not triggered in a known CI environment") {
            "semantic-release 检测到非 CI 环境并自动降级为 dry-run（release 脚本应带 --no-ci 参数）。"
        }
        else {
            "semantic-release 退出码为 0 但未创建发布，请检查上方输出。"
        }
        throw "semantic-release 没有实际发布（package.json 版本仍为 $releasedVersion，预期 $nextReleaseVersion）。原因：$skipReason 请检查上方输出并核实 Git 状态后重试。"
    }

    $releasedHead = Assert-FormalReleaseGitState
    $releaseTags = @(
        Invoke-NativeCaptureStep `
            "[正式版本] 验证 Git 标签" `
            "git" `
            @("tag", "--points-at", "HEAD")
    )
    if ($releaseTags -cnotcontains "v$nextReleaseVersion") {
        throw "未在当前发布的提交上找到标签 v$nextReleaseVersion。"
    }

    $script:formalReleaseStarted = $false
    Write-Host ""
    Write-Host "=== 正式版本 v$nextReleaseVersion 创建完成 ===" -ForegroundColor Cyan

    return [PSCustomObject]@{
        Version = $nextReleaseVersion
        Head    = $releasedHead
    }
}

if ($ValidateOnly -and $Release) {
    throw "-Release 与 -ValidateOnly 不能同时使用。"
}

$mode = $null
if ($ValidateOnly) {
    $mode = "ValidateOnly"
}
elseif ($Release) {
    $mode = "Release"
}
else {
    $selectedMode = Select-ReleaseMode
    if ($selectedMode -eq "Cancel") {
        Write-Host "已取消，未修改文件。" -ForegroundColor Yellow
        exit 0
    }
    $mode = $selectedMode
}

Write-Host "=== LabelPilot 严格校验与正式版本发布 ===" -ForegroundColor Cyan
Write-Host "模式: $(if ($mode -eq 'ValidateOnly') { '仅运行质量门禁' } else { '创建正式版本' })"
Write-Host ""

try {
    $requiredCommands = @("pnpm", "git")
    if ($mode -ne "ValidateOnly") {
        $requiredCommands += "node"
    }

    foreach ($commandName in $requiredCommands) {
        if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
            throw "未找到命令 '$commandName'，请先安装并加入 PATH。"
        }
    }

    Assert-RequiredFile $packageJson
    Assert-RequiredFile $lockFile

    $releaseSourceHead = $null
    if ($mode -eq "Release") {
        $releaseSourceHead = Assert-FormalReleaseGitState
    }

    Invoke-QualityGates

    if ($mode -eq "ValidateOnly") {
        Write-Host ""
        Write-Host "=== 所有发布前检查已通过，未创建版本 ===" -ForegroundColor Cyan
        return
    }

    $releaseResult = Invoke-FormalRelease $releaseSourceHead
    if (-not $releaseResult) {
        return
    }

    Write-Host ""
    Write-Host "=== 正式版本 v$($releaseResult.Version) 发布完成 ===" -ForegroundColor Cyan
    Write-Host "发布提交和标签已推送到远程仓库，Vercel 将自动检测 main 分支并触发部署。"
}
catch {
    Write-Host ""
    if ($formalReleaseStarted) {
        Write-Host "正式版本流程已经开始，semantic-release 可能已修改或推送部分状态。" -ForegroundColor Yellow
        Write-Host "请检查 package.json、CHANGELOG.md、Git 提交、标签和远程仓库。" -ForegroundColor Yellow
    }

    Write-Host "操作已中止: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
