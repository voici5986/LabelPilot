# LabelPilot 本地质量门禁
# 用法:
#   .\release.ps1 -ValidateOnly   # 运行本地发布前质量门禁，不修改 Git 或发布元数据
#
# 正式版本由 GitHub Actions 中的 release-please Release PR 管理。
param(
    [switch]$ValidateOnly
)

if ($args.Count -gt 0) {
    Write-Host "不支持的参数: $($args -join ' ')。正式版本由 release-please 管理；本地仅支持 -ValidateOnly。" -ForegroundColor Red
    exit 2
}

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# 统一控制台为 UTF-8，避免中文输出在 GBK（代码页 936）控制台上乱码。
try {
    [Console]::OutputEncoding = [Text.Encoding]::UTF8
    $OutputEncoding = [Text.Encoding]::UTF8
}
catch {
    # 非交互或受限环境下无法修改控制台编码，不影响质量门禁。
}

$root = $PSScriptRoot
$packageJson = Join-Path $root "package.json"
$lockFile = Join-Path $root "pnpm-lock.yaml"

function Assert-RequiredFile {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "缺少质量门禁所需文件: $Path"
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

function Invoke-QualityGates {
    # 先锁定依赖，后续步骤统一使用已安装的依赖解析结果。
    Invoke-NativeStep "[准备] 校验锁文件并安装依赖" "pnpm" @(
        "install",
        "--frozen-lockfile"
    ) $root

    # Release PR 的完整门禁由 .github/workflows/ci.yml 执行；这里保留
    # Windows 本地可复现的格式、lint、单测和生产构建检查。
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

if (-not $ValidateOnly) {
    Write-Host "正式版本不再由本地脚本创建。请使用 .\release.ps1 -ValidateOnly 运行本地门禁；release-please 负责 GitHub Release PR、版本、标签和发布记录。" -ForegroundColor Yellow
    exit 2
}

Write-Host "=== LabelPilot 本地质量门禁 ===" -ForegroundColor Cyan
Write-Host "模式: 仅运行校验，不创建版本、不修改 Git、不推送远程状态"
Write-Host ""

try {
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        throw "未找到命令 'pnpm'，请先安装并加入 PATH。"
    }

    Assert-RequiredFile $packageJson
    Assert-RequiredFile $lockFile
    Invoke-QualityGates

    Write-Host ""
    Write-Host "=== 本地质量门禁全部通过，未创建版本 ===" -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host "操作已中止: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
