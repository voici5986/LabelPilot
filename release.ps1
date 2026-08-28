#requires -Version 7.0

[CmdletBinding()]
param(
    [switch]$Release,
    [switch]$DryRun,
    [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"
$formalReleaseStarted = $false
$beforeFormalSnapshot = $null
$beforeFormalSnapshotPath = $null
$locationPushed = $false
$releaseMutex = $null
$ExpectedReleaseCommitFiles = @(
    "CHANGELOG.md"
    "docs/release.md"
    "package.json"
)
$ReleaseDocPlugin = "./scripts/semantic-release-update-release-doc.mjs"

function Assert-RequiredFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "缺少必需文件：$Path"
    }
}

function Assert-RequiredCommand {
    param([Parameter(Mandatory = $true)][string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "找不到命令 '$Name'，请先安装并确保它位于 PATH 中。"
    }
}

function ConvertTo-NormalizedReleasePath {
    param([Parameter(Mandatory = $true)][string]$Path)

    $normalized = $Path.Replace("\", "/")
    while ($normalized.StartsWith("./", [StringComparison]::Ordinal)) {
        $normalized = $normalized.Substring(2)
    }
    return $normalized
}

function Get-SemanticReleasePluginName {
    param([Parameter(Mandatory = $true)]$PluginEntry)

    if ($PluginEntry -is [string]) {
        return [string]$PluginEntry
    }
    if ($PluginEntry -is [Collections.IList] -and $PluginEntry.Count -gt 0) {
        return [string]$PluginEntry[0]
    }
    return ""
}

function Assert-ReleaseConfiguration {
    $config = Get-Content -LiteralPath ".releaserc.json" -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string]$config.tagFormat -cne 'v${version}') {
        throw '.releaserc.json 的 tagFormat 必须为 v${version}。'
    }

    $plugins = @($config.plugins)
    $npmIndices = [Collections.Generic.List[int]]::new()
    $docIndices = [Collections.Generic.List[int]]::new()
    $gitIndices = [Collections.Generic.List[int]]::new()
    $gitPluginConfig = $null

    for ($index = 0; $index -lt $plugins.Count; $index++) {
        $entry = $plugins[$index]
        $name = Get-SemanticReleasePluginName -PluginEntry $entry
        switch -CaseSensitive ($name) {
            "@semantic-release/npm" {
                $npmIndices.Add($index)
            }
            $ReleaseDocPlugin {
                $docIndices.Add($index)
            }
            "@semantic-release/git" {
                $gitIndices.Add($index)
                if ($entry -is [Collections.IList] -and $entry.Count -gt 1) {
                    $gitPluginConfig = $entry[1]
                }
            }
        }
    }

    if ($npmIndices.Count -ne 1 -or $docIndices.Count -ne 1 -or $gitIndices.Count -ne 1) {
        throw ".releaserc.json 必须各包含一个 npm、release 文档和 git plugin。"
    }
    if (-not ($npmIndices[0] -lt $docIndices[0] -and $docIndices[0] -lt $gitIndices[0])) {
        throw ".releaserc.json plugin 顺序必须为 npm、release 文档、git。"
    }
    if ($null -eq $gitPluginConfig) {
        throw ".releaserc.json 缺少 @semantic-release/git 配置。"
    }

    $actualAssets = @(
        $gitPluginConfig.assets |
            ForEach-Object { ConvertTo-NormalizedReleasePath -Path ([string]$_) } |
            Sort-Object
    )
    $expectedAssets = @(
        $ExpectedReleaseCommitFiles |
            ForEach-Object { ConvertTo-NormalizedReleasePath -Path $_ } |
            Sort-Object
    )
    if (($actualAssets -join "|") -cne ($expectedAssets -join "|")) {
        throw "@semantic-release/git assets 与发版文件清单不一致。实际：$($actualAssets -join '、')；预期：$($expectedAssets -join '、')。"
    }

    $packageVersion = Get-PackageVersion
    $releaseDocVersion = Get-ReleaseDocVersion
    if ($packageVersion -cne $releaseDocVersion) {
        throw "发版基线不一致：package.json 为 $packageVersion，docs/release.md 为 $releaseDocVersion。"
    }
}

function Invoke-NativeStep {
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][string]$Command,
        [string[]]$Arguments = @()
    )

    Write-Host ""
    Write-Host "==> $Description" -ForegroundColor Cyan
    & $Command @Arguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$Description 失败，退出码：$exitCode"
    }
}

function Invoke-NativeCaptureStep {
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][string]$Command,
        [string[]]$Arguments = @()
    )

    Write-Host ""
    Write-Host "==> $Description" -ForegroundColor Cyan
    $output = @(& $Command @Arguments 2>&1)
    $exitCode = $LASTEXITCODE

    foreach ($line in $output) {
        Write-Host $line
    }

    if ($exitCode -ne 0) {
        throw "$Description 失败，退出码：$exitCode"
    }

    return @($output | ForEach-Object { $_.ToString() })
}

function Invoke-NativeQuiet {
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][string]$Command,
        [string[]]$Arguments = @()
    )

    $output = @(& $Command @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        $details = ($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
        if ([string]::IsNullOrWhiteSpace($details)) {
            throw "$Description 失败，退出码：$exitCode"
        }
        throw "$Description 失败，退出码：$exitCode$([Environment]::NewLine)$details"
    }

    return @($output | ForEach-Object { $_.ToString() })
}

function Get-QuietSingleLine {
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][string]$Command,
        [string[]]$Arguments = @()
    )

    $lines = @(Invoke-NativeQuiet -Description $Description -Command $Command -Arguments $Arguments)
    $value = ($lines | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Last 1)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "$Description 未返回结果。"
    }

    return $value.Trim()
}

function Get-PackageVersion {
    $package = Get-Content -LiteralPath "package.json" -Raw -Encoding UTF8 | ConvertFrom-Json
    $version = [string]$package.version
    if ([string]::IsNullOrWhiteSpace($version)) {
        throw "package.json 中缺少 version。"
    }

    return $version
}

function Get-ReleaseDocVersion {
    $content = Get-Content -LiteralPath "docs/release.md" -Raw -Encoding UTF8
    $tagMatches = [regex]::Matches(
        $content,
        '(?m)^当前发布标签：`v(?<version>[^`\r\n]+)`\r?$'
    )
    $packageMatches = [regex]::Matches(
        $content,
        '(?m)^`package\.json` 版本：`(?<version>[^`\r\n]+)`\r?$'
    )
    if ($tagMatches.Count -ne 1 -or $packageMatches.Count -ne 1) {
        throw "docs/release.md 必须各包含一行当前发布标签和 package.json 版本。"
    }

    $tagVersion = $tagMatches[0].Groups["version"].Value
    $packageVersion = $packageMatches[0].Groups["version"].Value
    if ($tagVersion -cne $packageVersion) {
        throw "docs/release.md 的标签版本 $tagVersion 与 package 版本 $packageVersion 不一致。"
    }
    return $tagVersion
}

function Get-ReleaseFileHashes {
    $hashes = [ordered]@{}
    foreach ($path in $ExpectedReleaseCommitFiles) {
        $hashes[$path] = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    }
    return [pscustomobject]$hashes
}

function Get-LocalTagSnapshot {
    return @(
        Invoke-NativeQuiet -Description "读取本地标签" -Command "git" -Arguments @(
            "for-each-ref",
            "--format=%(refname:short)|%(objectname)",
            "refs/tags"
        )
    )
}

function Get-RepositorySnapshot {
    param(
        [AllowNull()][string]$RemoteHead,
        [Parameter(Mandatory = $true)][string]$Kind,
        [string[]]$RemoteTagRefs = @()
    )

    $status = @(Invoke-NativeQuiet -Description "读取工作区状态" -Command "git" -Arguments @(
        "status",
        "--porcelain=v1",
        "--untracked-files=all"
    ))

    return [pscustomobject]@{
        kind            = $Kind
        capturedAtUtc   = [DateTime]::UtcNow.ToString("o")
        branch          = Get-QuietSingleLine -Description "读取当前分支" -Command "git" -Arguments @("branch", "--show-current")
        head            = Get-QuietSingleLine -Description "读取 HEAD" -Command "git" -Arguments @("rev-parse", "HEAD")
        remoteMainHead  = $RemoteHead
        remoteTagRefs   = @($RemoteTagRefs)
        packageVersion  = Get-PackageVersion
        releaseDocVersion = Get-ReleaseDocVersion
        releaseFileSha256 = Get-ReleaseFileHashes
        status          = $status
        tags            = @(Get-LocalTagSnapshot)
    }
}

function Save-ReleaseSnapshot {
    param(
        [Parameter(Mandatory = $true)]$Snapshot,
        [Parameter(Mandatory = $true)][string]$Suffix
    )

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
    $path = Join-Path ([IO.Path]::GetTempPath()) "LabelPilot-release-$timestamp-$Suffix.json"
    $Snapshot | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $path -Encoding UTF8
    return $path
}

function Assert-SnapshotUnchanged {
    param(
        [Parameter(Mandatory = $true)]$Before,
        [Parameter(Mandatory = $true)]$After,
        [Parameter(Mandatory = $true)][string]$Stage
    )

    $differences = [System.Collections.Generic.List[string]]::new()
    if ($Before.head -ne $After.head) {
        $differences.Add("HEAD")
    }
    if ($Before.packageVersion -ne $After.packageVersion) {
        $differences.Add("package.json version")
    }
    if ($Before.releaseDocVersion -ne $After.releaseDocVersion) {
        $differences.Add("docs/release.md version")
    }
    foreach ($path in $ExpectedReleaseCommitFiles) {
        $beforeHash = $Before.releaseFileSha256.PSObject.Properties[$path].Value
        $afterHash = $After.releaseFileSha256.PSObject.Properties[$path].Value
        if ($beforeHash -ne $afterHash) {
            $differences.Add($path)
        }
    }
    if (($Before.status -join [Environment]::NewLine) -ne ($After.status -join [Environment]::NewLine)) {
        $differences.Add("工作区状态")
    }
    if (($Before.tags -join [Environment]::NewLine) -ne ($After.tags -join [Environment]::NewLine)) {
        $differences.Add("本地标签")
    }

    if ($differences.Count -gt 0) {
        throw "$Stage 意外修改了仓库：$($differences -join '、')。已停止发版。"
    }
}

function Enter-ReleaseMutex {
    $repositoryRoot = Get-QuietSingleLine -Description "读取仓库根目录" -Command "git" -Arguments @(
        "rev-parse",
        "--show-toplevel"
    )
    $normalizedRoot = [IO.Path]::GetFullPath($repositoryRoot).ToLowerInvariant()
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        $pathHash = $sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($normalizedRoot))
    }
    finally {
        $sha256.Dispose()
    }
    $pathHashText = -join ($pathHash | ForEach-Object { $_.ToString("X2") })
    $mutexName = "Local\LabelPilot-release-$($pathHashText.Substring(0, 24))"
    $mutex = [Threading.Mutex]::new($false, $mutexName)

    try {
        $acquired = $false
        try {
            $acquired = $mutex.WaitOne(0)
        }
        catch [Threading.AbandonedMutexException] {
            $acquired = $true
        }

        if (-not $acquired) {
            throw "同一工作树已有另一个发版脚本正在运行；请等待其结束后再试。"
        }

        return $mutex
    }
    catch {
        $mutex.Dispose()
        throw
    }
}

function Get-NormalizedTagRefs {
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][string]$Repository
    )

    return @(
        Invoke-NativeQuiet -Description $Description -Command "git" -Arguments @(
            "ls-remote",
            "--tags",
            $Repository
        ) |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            ForEach-Object { $_.Trim() } |
            Sort-Object
    )
}

function Assert-LocalTagsMatchOrigin {
    param([Parameter(Mandatory = $true)][string]$Stage)

    $localTags = @(Get-NormalizedTagRefs -Description "读取本地标签引用" -Repository ".")
    $remoteTags = @(Get-NormalizedTagRefs -Description "读取 origin 标签引用" -Repository "origin")
    if (($localTags -join [Environment]::NewLine) -eq ($remoteTags -join [Environment]::NewLine)) {
        return $remoteTags
    }

    $difference = @(
        Compare-Object -ReferenceObject $remoteTags -DifferenceObject $localTags |
            Select-Object -First 12 |
            ForEach-Object {
                $location = if ($_.SideIndicator -eq "=>") { "仅本地" } else { "仅远端或目标不同" }
                "$location：$($_.InputObject)"
            }
    )
    throw "$Stage：本地标签与 origin 标签不完全一致。@semantic-release/git 会推送所有本地标签，因此已停止发版。$([Environment]::NewLine)$($difference -join [Environment]::NewLine)"
}

function Assert-FormalReleaseGitState {
    param([Parameter(Mandatory = $true)][string]$Stage)

    Write-Host ""
    Write-Host "==> $Stage：校验 main 与 origin/main" -ForegroundColor Cyan

    $branch = Get-QuietSingleLine -Description "读取当前分支" -Command "git" -Arguments @("branch", "--show-current")
    if ($branch -ne "main") {
        throw "正式发版只能从 main 分支执行；当前分支：$branch"
    }

    $statusBeforeFetch = @(Invoke-NativeQuiet -Description "读取工作区状态" -Command "git" -Arguments @(
        "status",
        "--porcelain=v1",
        "--untracked-files=all"
    ))
    if ($statusBeforeFetch.Count -gt 0) {
        throw "工作区必须完全干净（包括未跟踪文件）后才能继续。"
    }

    Invoke-NativeStep -Description "$Stage：刷新 origin/main 与远端标签" -Command "git" -Arguments @(
        "fetch",
        "--tags",
        "origin",
        "+refs/heads/main:refs/remotes/origin/main"
    )

    $head = Get-QuietSingleLine -Description "读取 HEAD" -Command "git" -Arguments @("rev-parse", "HEAD")
    $localMain = Get-QuietSingleLine -Description "读取本地 main" -Command "git" -Arguments @("rev-parse", "refs/heads/main")
    $remoteMain = Get-QuietSingleLine -Description "读取 origin/main" -Command "git" -Arguments @("rev-parse", "refs/remotes/origin/main")

    if ($head -ne $localMain) {
        throw "HEAD 与本地 main 不一致，可能处于 detached HEAD；已停止发版。"
    }

    if ($head -ne $remoteMain) {
        $counts = Get-QuietSingleLine -Description "比较 main 与 origin/main" -Command "git" -Arguments @(
            "rev-list",
            "--left-right",
            "--count",
            "refs/heads/main...refs/remotes/origin/main"
        )
        throw "本地 main 与刚刷新得到的 origin/main 不一致（本地/远端计数：$counts）。请先处理同步关系。"
    }

    $statusAfterFetch = @(Invoke-NativeQuiet -Description "再次读取工作区状态" -Command "git" -Arguments @(
        "status",
        "--porcelain=v1",
        "--untracked-files=all"
    ))
    if ($statusAfterFetch.Count -gt 0) {
        throw "刷新远端状态后工作区不再干净；已停止发版。"
    }

    $tagRefs = @(Assert-LocalTagsMatchOrigin -Stage $Stage)
    Write-Host "main 已与刚刷新得到的 origin/main 精确同步：$head" -ForegroundColor Green
    Write-Host "本地与 origin 的标签引用完全一致：$($tagRefs.Count) 条" -ForegroundColor Green
    return [pscustomobject]@{
        Head       = $head
        RemoteHead = $remoteMain
        TagRefs    = $tagRefs
    }
}

function Select-ReleaseMode {
    while ($true) {
        Write-Host ""
        Write-Host "请选择操作：" -ForegroundColor Cyan
        Write-Host "  1. 正式发版（默认）"
        Write-Host "  2. 发版预演（不修改仓库）"
        Write-Host "  3. 仅运行完整验证"
        Write-Host "  Q. 退出"
        $choice = Read-Host "输入选项"

        if ([string]::IsNullOrWhiteSpace($choice) -or $choice -eq "1") {
            return "Release"
        }
        if ($choice -eq "2") {
            return "DryRun"
        }
        if ($choice -eq "3") {
            return "ValidateOnly"
        }
        if ($choice -match "^[Qq]$") {
            return "Quit"
        }

        Write-Warning "无效选项，请重新输入。"
    }
}

function Invoke-PlaywrightGate {
    $nodePath = (Get-Command "node" -ErrorAction Stop).Source
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
    $serverOutputPath = Join-Path ([IO.Path]::GetTempPath()) "LabelPilot-vite-$timestamp.stdout.log"
    $serverErrorPath = Join-Path ([IO.Path]::GetTempPath()) "LabelPilot-vite-$timestamp.stderr.log"
    $server = $null
    $hadCi = Test-Path Env:CI
    $previousCi = $env:CI
    $hadExternalServer = Test-Path Env:PLAYWRIGHT_EXTERNAL_SERVER
    $previousExternalServer = $env:PLAYWRIGHT_EXTERNAL_SERVER

    try {
        Write-Host ""
        Write-Host "==> 启动受控的 Vite 预览服务" -ForegroundColor Cyan
        $server = Start-Process -FilePath $nodePath -ArgumentList @(
            "node_modules/vite/bin/vite.js",
            "preview",
            "--host",
            "127.0.0.1",
            "--port",
            "4173",
            "--strictPort"
        ) -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput $serverOutputPath -RedirectStandardError $serverErrorPath -PassThru

        $ready = $false
        for ($attempt = 0; $attempt -lt 60; $attempt++) {
            if ($server.HasExited) {
                break
            }

            try {
                $response = Invoke-WebRequest -Uri "http://127.0.0.1:4173" -Method Head -TimeoutSec 1
                if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                    $ready = $true
                    break
                }
            }
            catch {
                Start-Sleep -Milliseconds 250
            }
        }

        if (-not $ready) {
            $serverError = if (Test-Path -LiteralPath $serverErrorPath) {
                Get-Content -LiteralPath $serverErrorPath -Raw -ErrorAction SilentlyContinue
            }
            else {
                ""
            }
            throw "Vite 预览服务未能在 15 秒内就绪。错误日志：$serverErrorPath$([Environment]::NewLine)$serverError"
        }

        $env:CI = "true"
        $env:PLAYWRIGHT_EXTERNAL_SERVER = "true"
        Invoke-NativeStep -Description "6/6 Playwright 端到端测试（CI 等价模式）" -Command "node" -Arguments @(
            "node_modules/@playwright/test/cli.js",
            "test"
        )
    }
    catch {
        Write-Warning "Vite 预览日志：$serverOutputPath"
        Write-Warning "Vite 错误日志：$serverErrorPath"
        throw
    }
    finally {
        if ($hadCi) {
            $env:CI = $previousCi
        }
        else {
            $env:CI = $null
        }

        if ($hadExternalServer) {
            $env:PLAYWRIGHT_EXTERNAL_SERVER = $previousExternalServer
        }
        else {
            $env:PLAYWRIGHT_EXTERNAL_SERVER = $null
        }

        if ($null -ne $server -and -not $server.HasExited) {
            Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
            $null = $server.WaitForExit(5000)
        }
    }
}

function Invoke-QualityGates {
    Write-Host ""
    Write-Host "开始完整发版验证。" -ForegroundColor Cyan

    Invoke-NativeStep -Description "1/6 锁定依赖安装" -Command "pnpm" -Arguments @("install", "--frozen-lockfile")
    Invoke-NativeStep -Description "2/6 格式检查" -Command "pnpm" -Arguments @("run", "format:check")
    Invoke-NativeStep -Description "3/6 静态检查" -Command "pnpm" -Arguments @("run", "lint")
    Invoke-NativeStep -Description "4/6 单元测试" -Command "pnpm" -Arguments @("test")
    Invoke-NativeStep -Description "5/6 生产构建" -Command "pnpm" -Arguments @("run", "build")
    Invoke-PlaywrightGate
}

function Invoke-SemanticReleasePreview {
    $nodeScript = @'
(async () => {
  const { default: semanticRelease } = await import("semantic-release");
  const result = await semanticRelease({ dryRun: true, ci: false });
  const version = result && result.nextRelease ? result.nextRelease.version : "";
  console.log("RELEASE_NEXT_VERSION=" + version);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
'@

    $output = @(Invoke-NativeCaptureStep -Description "semantic-release 发版预演" -Command "node" -Arguments @(
        "-e",
        $nodeScript
    ))

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
    $logPath = Join-Path ([IO.Path]::GetTempPath()) "LabelPilot-semantic-release-$timestamp-dry-run.log"
    $output | Set-Content -LiteralPath $logPath -Encoding UTF8

    $marker = $output | Where-Object { $_ -match "^RELEASE_NEXT_VERSION=" } | Select-Object -Last 1
    if ($null -eq $marker) {
        throw "semantic-release 预演未返回版本标记。预演日志：$logPath"
    }

    $nextVersion = $marker.Substring("RELEASE_NEXT_VERSION=".Length).Trim()
    return [pscustomobject]@{
        NextVersion = $nextVersion
        LogPath      = $logPath
    }
}

function Confirm-FormalRelease {
    param([Parameter(Mandatory = $true)][string]$NextVersion)

    Write-Host ""
    Write-Host "即将发布 v$NextVersion。" -ForegroundColor Yellow
    Write-Host "semantic-release 将更新 $($ExpectedReleaseCommitFiles -join '、')，创建 release commit 和标签，并推送 main 与标签。"
    $confirmation = Read-Host "输入版本号 $NextVersion 以确认，其他输入将取消"
    if ([string]::IsNullOrWhiteSpace($confirmation)) {
        return $false
    }
    return $confirmation.Trim() -eq $NextVersion
}

function Get-RemoteTagState {
    param([Parameter(Mandatory = $true)][string]$TagName)

    $output = @(& git ls-remote --tags origin "refs/tags/$TagName" "refs/tags/$TagName^{}" 2>&1)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        return [pscustomobject]@{
            tag    = $TagName
            known  = $false
            exists = $null
            output = @($output | ForEach-Object { $_.ToString() })
        }
    }

    $lines = @($output | ForEach-Object { $_.ToString() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    return [pscustomobject]@{
        tag    = $TagName
        known  = $true
        exists = $lines.Count -gt 0
        output = $lines
    }
}

function Get-NewLocalTags {
    param(
        [Parameter(Mandatory = $true)][string[]]$BeforeTags,
        [Parameter(Mandatory = $true)][string[]]$AfterTags
    )

    $beforeNames = @($BeforeTags | ForEach-Object { ($_ -split "\|", 2)[0] })
    return @(
        $AfterTags |
            ForEach-Object { ($_ -split "\|", 2)[0] } |
            Where-Object { $_ -notin $beforeNames }
    )
}

function Write-ReleaseFailureDiagnostics {
    param(
        [Parameter(Mandatory = $true)]$Before,
        [Parameter(Mandatory = $true)][string]$BeforePath
    )

    Write-Host ""
    Write-Warning "正式发版未完整成功。脚本不会自动回滚、删除标签或覆盖远端。"

    $remoteFetchOutput = @(& git fetch --tags origin "+refs/heads/main:refs/remotes/origin/main" 2>&1)
    $remoteFetchExitCode = $LASTEXITCODE
    $remoteKnown = $remoteFetchExitCode -eq 0
    $remoteHead = $null
    $remoteTagRefs = @()
    if ($remoteKnown) {
        try {
            $remoteHead = Get-QuietSingleLine -Description "读取失败后的 origin/main" -Command "git" -Arguments @(
                "rev-parse",
                "refs/remotes/origin/main"
            )
            $remoteTagRefs = @(Get-NormalizedTagRefs -Description "读取失败后的 origin 标签引用" -Repository "origin")
        }
        catch {
            $remoteKnown = $false
        }
    }

    $after = Get-RepositorySnapshot -RemoteHead $remoteHead -Kind "after-formal-release-failure" -RemoteTagRefs $remoteTagRefs
    $newTags = @(Get-NewLocalTags -BeforeTags $Before.tags -AfterTags $after.tags)
    $remoteTags = @($newTags | ForEach-Object { Get-RemoteTagState -TagName $_ })
    $remoteTagRefsUnchanged = $remoteKnown -and (
        ($Before.remoteTagRefs -join [Environment]::NewLine) -eq
        ($remoteTagRefs -join [Environment]::NewLine)
    )

    $diagnostics = [pscustomobject]@{
        before                 = $Before
        after                  = $after
        newLocalTags           = $newTags
        remoteFetchKnown       = $remoteKnown
        remoteFetchOutput      = @($remoteFetchOutput | ForEach-Object { $_.ToString() })
        remoteTagRefsUnchanged = $remoteTagRefsUnchanged
        remoteTags             = $remoteTags
    }
    $diagnosticPath = Save-ReleaseSnapshot -Snapshot $diagnostics -Suffix "failure"

    Write-Host "发版前快照：$BeforePath"
    Write-Host "失败诊断：$diagnosticPath"
    Write-Host "发版前 HEAD：$($Before.head)"
    Write-Host "当前 HEAD：$($after.head)"
    Write-Host "发版前版本：$($Before.packageVersion)"
    Write-Host "当前版本：$($after.packageVersion)"
    Write-Host "当前 release 文档版本：$($after.releaseDocVersion)"
    Write-Host "新增本地标签：$(if ($newTags.Count -eq 0) { '无' } else { $newTags -join ', ' })"
    Write-Host "远端标签引用是否确认未变化：$remoteTagRefsUnchanged"

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $rescueBranch = "rescue/release-failure-$timestamp"
    if ($after.head -ne $Before.head) {
        Write-Host ""
        Write-Host "先保留当前提交的建议命令（未自动执行）：" -ForegroundColor Yellow
        Write-Host "  git branch $rescueBranch $($after.head)"
    }
    if ($after.status.Count -gt 0) {
        Write-Host "当前还有未提交修改；先运行 git diff 并另存补丁，再决定如何恢复。" -ForegroundColor Yellow
    }

    $remoteUnchanged = $remoteKnown -and $remoteHead -eq $Before.remoteMainHead -and $remoteTagRefsUnchanged
    if ($remoteUnchanged -and ($after.head -ne $Before.head -or $newTags.Count -gt 0)) {
        Write-Host ""
        Write-Host "远端 main 与新增标签均确认未发布。保存救援分支/补丁后，可人工选择以下恢复命令：" -ForegroundColor Yellow
        if ($after.head -ne $Before.head) {
            Write-Host "  git reset --hard $($Before.head)"
        }
        foreach ($tag in $newTags) {
            Write-Host "  git tag -d $tag"
        }
    }
    elseif (-not $remoteUnchanged) {
        Write-Host ""
        Write-Warning "远端状态未知、已变化或标签可能已推送；不要重跑发版或删除标签，请先查看诊断文件并核对 GitHub。"
    }
}

function Assert-FormalReleaseResult {
    param(
        [Parameter(Mandatory = $true)]$Before,
        [Parameter(Mandatory = $true)][string]$ExpectedVersion
    )

    $state = Assert-FormalReleaseGitState -Stage "发版后"
    $actualVersion = Get-PackageVersion
    if ($actualVersion -ne $ExpectedVersion) {
        throw "发版后 package.json 版本为 $actualVersion，预期为 $ExpectedVersion。"
    }
    $releaseDocVersion = Get-ReleaseDocVersion
    if ($releaseDocVersion -ne $ExpectedVersion) {
        throw "发版后 docs/release.md 版本为 $releaseDocVersion，预期为 $ExpectedVersion。"
    }

    if ($state.Head -eq $Before.head) {
        throw "发版后 HEAD 未变化，未检测到 release commit。"
    }

    & git merge-base --is-ancestor $Before.head $state.Head
    if ($LASTEXITCODE -ne 0) {
        throw "发版前提交不是发版后 HEAD 的祖先，已停止验收。"
    }

    $tagName = "v$ExpectedVersion"
    $tagCommit = Get-QuietSingleLine -Description "解析本地发布标签" -Command "git" -Arguments @(
        "rev-parse",
        "refs/tags/$tagName^{}"
    )
    if ($tagCommit -ne $state.Head) {
        throw "本地标签 $tagName 未指向 release commit。"
    }

    $remoteTag = Get-RemoteTagState -TagName $tagName
    if (-not $remoteTag.known -or -not $remoteTag.exists) {
        throw "无法确认远端标签 $tagName。"
    }
    $remoteTagLine = $remoteTag.output | Where-Object { $_ -match "\^\{\}$" } | Select-Object -Last 1
    if ($null -eq $remoteTagLine) {
        $remoteTagLine = $remoteTag.output | Select-Object -Last 1
    }
    $remoteTagCommit = ($remoteTagLine -split "\s+")[0]
    if ($remoteTagCommit -ne $state.Head) {
        throw "远端标签 $tagName 未指向 release commit。"
    }

    $releaseFiles = @(
        Invoke-NativeQuiet -Description "读取 release commit 文件" -Command "git" -Arguments @(
            "diff-tree",
            "--no-commit-id",
            "--name-only",
            "-r",
            $state.Head
        ) | ForEach-Object { ConvertTo-NormalizedReleasePath -Path $_ }
    )
    if ((@($releaseFiles | Sort-Object) -join "|") -cne (@($ExpectedReleaseCommitFiles | Sort-Object) -join "|")) {
        throw "release commit 修改范围异常：$($releaseFiles -join '、')"
    }

    $commitMessage = (
        Invoke-NativeQuiet -Description "读取 release commit message" -Command "git" -Arguments @(
            "log",
            "-1",
            "--pretty=%B",
            $state.Head
        )
    ) -join [Environment]::NewLine
    if ($commitMessage -notmatch "\[skip ci\]") {
        throw "release commit message 缺少 [skip ci]。"
    }

    return $state
}

if ($args.Count -gt 0) {
    throw "不支持的位置参数：$($args -join ' ')"
}

$selectedSwitches = 0
if ($Release) {
    $selectedSwitches++
}
if ($DryRun) {
    $selectedSwitches++
}
if ($ValidateOnly) {
    $selectedSwitches++
}
if ($selectedSwitches -gt 1) {
    throw "-Release、-DryRun 和 -ValidateOnly 只能选择一个。"
}

try {
    Push-Location $PSScriptRoot
    $locationPushed = $true

    Assert-RequiredCommand -Name "git"
    Assert-RequiredCommand -Name "pnpm"
    Assert-RequiredCommand -Name "node"
    $requiredFiles = @(
        "pnpm-lock.yaml"
        ".releaserc.json"
        $ReleaseDocPlugin.Substring(2)
    ) + $ExpectedReleaseCommitFiles
    foreach ($path in $requiredFiles) {
        Assert-RequiredFile -Path $path
    }
    Assert-ReleaseConfiguration

    $releaseMutex = Enter-ReleaseMutex

    $mode = if ($Release) {
        "Release"
    }
    elseif ($DryRun) {
        "DryRun"
    }
    elseif ($ValidateOnly) {
        "ValidateOnly"
    }
    else {
        Select-ReleaseMode
    }

    if ($mode -eq "Quit") {
        Write-Host "已取消。"
        return
    }

    $initialState = Assert-FormalReleaseGitState -Stage "开始前"
    $beforeGates = Get-RepositorySnapshot -RemoteHead $initialState.RemoteHead -Kind "before-quality-gates"

    Invoke-QualityGates

    $afterGates = Get-RepositorySnapshot -RemoteHead $initialState.RemoteHead -Kind "after-quality-gates"
    Assert-SnapshotUnchanged -Before $beforeGates -After $afterGates -Stage "完整发版验证"

    if ($mode -eq "ValidateOnly") {
        Write-Host ""
        Write-Host "完整发版验证通过；未运行 semantic-release，仓库未发生变化。" -ForegroundColor Green
        return
    }

    $preview = Invoke-SemanticReleasePreview
    $afterPreview = Get-RepositorySnapshot -RemoteHead $initialState.RemoteHead -Kind "after-semantic-release-dry-run"
    Assert-SnapshotUnchanged -Before $beforeGates -After $afterPreview -Stage "semantic-release 预演"

    if ([string]::IsNullOrWhiteSpace($preview.NextVersion)) {
        Write-Host ""
        Write-Host "semantic-release 判定当前没有需要发布的版本；本次正常结束。" -ForegroundColor Green
        Write-Host "预演日志：$($preview.LogPath)"
        return
    }

    Write-Host ""
    Write-Host "semantic-release 判定下一版本：v$($preview.NextVersion)" -ForegroundColor Green
    Write-Host "预演日志：$($preview.LogPath)"

    if ($mode -eq "DryRun") {
        Write-Host "发版预演完成；未修改文件、创建提交、标签或推送。" -ForegroundColor Green
        return
    }

    if (-not (Confirm-FormalRelease -NextVersion $preview.NextVersion)) {
        Write-Host "已取消正式发版；仓库未发生变化。"
        return
    }

    $secondState = Assert-FormalReleaseGitState -Stage "正式发版前二次检查"
    if ($secondState.Head -ne $initialState.Head) {
        throw "验证期间 main 发生变化；请从头重新运行发版脚本。"
    }

    $beforeFormalSnapshot = Get-RepositorySnapshot -RemoteHead $secondState.RemoteHead -Kind "before-formal-release" -RemoteTagRefs $secondState.TagRefs
    $beforeFormalSnapshotPath = Save-ReleaseSnapshot -Snapshot $beforeFormalSnapshot -Suffix "before"
    Write-Host "发版前快照：$beforeFormalSnapshotPath"

    $formalReleaseStarted = $true
    Invoke-NativeStep -Description "执行 semantic-release 正式发版" -Command "node" -Arguments @(
        "node_modules/semantic-release/bin/semantic-release.js",
        "--no-ci"
    )
    $finalState = Assert-FormalReleaseResult -Before $beforeFormalSnapshot -ExpectedVersion $preview.NextVersion
    $formalReleaseStarted = $false

    Write-Host ""
    Write-Host "发版成功：v$($preview.NextVersion)" -ForegroundColor Green
    Write-Host "main 与标签已推送，远端提交：$($finalState.Head)"
    Write-Host "本流程不创建 GitHub Release 页面，也不发布 npm 包。"
}
catch {
    if ($formalReleaseStarted -and $null -ne $beforeFormalSnapshot) {
        try {
            Write-ReleaseFailureDiagnostics -Before $beforeFormalSnapshot -BeforePath $beforeFormalSnapshotPath
        }
        catch {
            Write-Warning "生成失败诊断时又发生错误：$($_.Exception.Message)"
            Write-Warning "发版前快照仍保留在：$beforeFormalSnapshotPath"
        }
    }

    Write-Error $_
    exit 1
}
finally {
    if ($null -ne $releaseMutex) {
        try {
            $releaseMutex.ReleaseMutex()
        }
        catch {
            Write-Warning "释放发版互斥锁时发生错误：$($_.Exception.Message)"
        }
        finally {
            $releaseMutex.Dispose()
        }
    }

    if ($locationPushed) {
        Pop-Location
    }
}
