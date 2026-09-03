#Requires -Version 5.1
<#
.SYNOPSIS
    Cai dat goi ky nang Kuha cho pi coding agent.
.DESCRIPTION
    Idempotent installer: kiem tra cong cu he thong, cai goi Python, dang ky
    skills/prompts cua Kuha vao settings.json cua pi, tao thu muc luu file
    trong thu muc du an. Honour bien moi truong PI_CODING_AGENT_DIR de tro
    thu muc agent (dung khi test trong sandbox, khong dung ~/.pi/agent that).
.PARAMETER Dir
    Thu muc du an (noi luu bao-cao/nghien-cuu/... va noi mo pi lam viec). Bo
    qua thi tu tim thu muc dau tien co san trong: %USERPROFILE%\KuHa,
    %USERPROFILE%\Kuha, %USERPROFILE%\kuha, %USERPROFILE%\Documents\Kuha,
    %USERPROFILE%\Documents\KuHa. Khong tim thay thi khong tao gi ca.
#>
param(
    [string]$Dir
)

$ErrorActionPreference = 'Stop'

function Write-Section($text) {
    Write-Host ""
    Write-Host "== $text ==" -ForegroundColor Cyan
}

function Test-CommandExists($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

# ---------------------------------------------------------------------------
# 0. Duong dan co ban
# ---------------------------------------------------------------------------

$KuhaDir = $PSScriptRoot
$SkillsRoot = Join-Path $KuhaDir 'skills'
$PromptsDir = Join-Path $KuhaDir 'prompts'
$KuhaAgentsMd = Join-Path $KuhaDir 'AGENTS.md'

if ($env:PI_CODING_AGENT_DIR) {
    $AgentDir = $env:PI_CODING_AGENT_DIR
} else {
    $AgentDir = Join-Path $HOME '.pi\agent'
}

function Find-ProjectDir {
    $candidates = @(
        (Join-Path $env:USERPROFILE 'KuHa'),
        (Join-Path $env:USERPROFILE 'Kuha'),
        (Join-Path $env:USERPROFILE 'kuha'),
        (Join-Path $env:USERPROFILE 'Documents\Kuha'),
        (Join-Path $env:USERPROFILE 'Documents\KuHa')
    )
    foreach ($c in $candidates) {
        if (Test-Path $c -PathType Container) { return $c }
    }
    return $null
}

if ($Dir) {
    $ProjectDir = $Dir
} else {
    $ProjectDir = Find-ProjectDir
}

Write-Host "Kuha installer cho pi coding agent" -ForegroundColor Green
Write-Host "Thu muc agent dich: $AgentDir"
if ($ProjectDir) {
    Write-Host "Thu muc du an: $ProjectDir"
} else {
    Write-Host "Thu muc du an: chua xac dinh (xem phan 'Thu muc du an' ben duoi)"
}

# ---------------------------------------------------------------------------
# 1. Kiem tra cong cu he thong
# ---------------------------------------------------------------------------

Write-Section "Kiem tra cong cu he thong"

$missing = @()

if (Test-CommandExists 'git') {
    Write-Host "[OK] git: $(git --version)"
} else {
    Write-Host "[THIEU] git" -ForegroundColor Yellow
    $missing += 'winget install --id Git.Git -e --source winget'
}

if (Test-CommandExists 'node') {
    Write-Host "[OK] node: $(node --version)"
} else {
    Write-Host "[THIEU] Node.js" -ForegroundColor Yellow
    $missing += 'winget install --id OpenJS.NodeJS.LTS -e --source winget'
}

$pyOk = $false
if (Test-CommandExists 'py') {
    try {
        $pyVer = & py -3.12 --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] python: $pyVer"
            $pyOk = $true
        }
    } catch { }
}
if (-not $pyOk) {
    Write-Host "[THIEU] Python 3.12 (py -3.12)" -ForegroundColor Yellow
    $missing += 'winget install --id Python.Python.3.12 -e --source winget'
}

if (Test-CommandExists 'ffmpeg') {
    Write-Host "[OK] ffmpeg: $((ffmpeg -version 2>&1 | Select-Object -First 1))"
} else {
    Write-Host "[THIEU] ffmpeg" -ForegroundColor Yellow
    $missing += 'winget install --id Gyan.FFmpeg -e --source winget'
}

if (Test-CommandExists 'soffice') {
    Write-Host "[OK] LibreOffice: co san"
} else {
    Write-Host "[TUY CHON] LibreOffice chua co (khong bat buoc)" -ForegroundColor DarkYellow
    $missing += 'winget install --id TheDocumentFoundation.LibreOffice -e --source winget  (tuy chon)'
}

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "Chay cac lenh sau (PowerShell voi quyen quan tri) de cai cong cu con thieu:" -ForegroundColor Yellow
    foreach ($cmd in $missing) { Write-Host "  $cmd" }
}

# ---------------------------------------------------------------------------
# 2. Cai goi Python
# ---------------------------------------------------------------------------

Write-Section "Cai goi Python (--user)"

if ($pyOk) {
    $packages = @(
        'python-pptx', 'python-docx', 'openpyxl', 'reportlab', 'pypdf',
        'pdfplumber', 'pandas', 'matplotlib', 'faster-whisper', 'requests',
        'beautifulsoup4', 'edge-tts'
    )
    Write-Host "py -3.12 -m pip install --user $($packages -join ' ')"
    & py -3.12 -m pip install --user @packages
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[CANH BAO] pip install ket thuc voi loi (xem log o tren)" -ForegroundColor Yellow
    }
} else {
    Write-Host "[BO QUA] Python 3.12 chua co, khong the cai goi." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# 3. Dam bao thu muc agent ton tai
# ---------------------------------------------------------------------------

Write-Section "Thu muc agent"

if (-not (Test-Path $AgentDir)) {
    New-Item -ItemType Directory -Path $AgentDir -Force | Out-Null
}
Write-Host "[OK] $AgentDir"

# ---------------------------------------------------------------------------
# 4. Merge settings.json
# ---------------------------------------------------------------------------

Write-Section "Cap nhat settings.json"

$SettingsPath = Join-Path $AgentDir 'settings.json'

if (Test-Path $SettingsPath) {
    $raw = Get-Content -Raw -Path $SettingsPath -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace($raw)) {
        $settings = [PSCustomObject]@{}
    } else {
        $settings = $raw | ConvertFrom-Json
    }
} else {
    $settings = [PSCustomObject]@{}
}

function Add-UniqueArrayItem {
    param($Object, [string]$PropertyName, [string]$Value)
    if (-not $Object.PSObject.Properties[$PropertyName]) {
        $Object | Add-Member -NotePropertyName $PropertyName -NotePropertyValue @($Value)
        return
    }
    $current = @($Object.$PropertyName)
    if ($current -notcontains $Value) {
        $Object.$PropertyName = $current + $Value
    }
}

$requiredPackages = @(
    'npm:pi-web-access',
    'npm:@juicesharp/rpiv-ask-user-question',
    'npm:pi-notify'
)
foreach ($pkg in $requiredPackages) {
    Add-UniqueArrayItem -Object $settings -PropertyName 'packages' -Value $pkg
}
# powerline used to own the footer and the editor; it overrode claude-footer/claude-input
$settings.packages = @($settings.packages | Where-Object { $_ -ne 'npm:pi-powerline-footer' })
if ($settings.PSObject.Properties['powerline']) { $settings.PSObject.Properties.Remove('powerline') }

$managedByPackage = $KuhaDir -like '*\git\github.com\*'
if ($managedByPackage) {
    Write-Host "Kuha duoc cai qua 'pi install git:...': skills/prompts da duoc package.json dang ky, bo qua buoc dang ky thu cong."
} else {
    if (Test-Path $SkillsRoot) {
        Get-ChildItem -Path $SkillsRoot -Directory | ForEach-Object {
            Add-UniqueArrayItem -Object $settings -PropertyName 'skills' -Value $_.FullName
        }
    }
    if (Test-Path $PromptsDir) {
        Add-UniqueArrayItem -Object $settings -PropertyName 'prompts' -Value $PromptsDir
    }
}

if (-not $settings.PSObject.Properties['enabledModels']) {
    $settings | Add-Member -NotePropertyName 'enabledModels' -NotePropertyValue @('openrouter/z-ai/glm-5.3-flash', 'openrouter/deepseek/deepseek-v4-flash*')
}
if (-not $settings.PSObject.Properties['defaultProvider']) {
    $settings | Add-Member -NotePropertyName 'defaultProvider' -NotePropertyValue 'openrouter'
    $settings | Add-Member -NotePropertyName 'defaultModel' -NotePropertyValue 'z-ai/glm-5.3-flash'
}
if (-not $settings.PSObject.Properties['hideThinkingBlock']) {
    $settings | Add-Member -NotePropertyName 'hideThinkingBlock' -NotePropertyValue $true
}
if (-not $settings.PSObject.Properties['quietStartup']) {
    $settings | Add-Member -NotePropertyName 'quietStartup' -NotePropertyValue $true
}
if (-not $settings.PSObject.Properties['tuiMode']) {
    $settings | Add-Member -NotePropertyName 'tuiMode' -NotePropertyValue 'fullscreen'
}

if (-not $settings.PSObject.Properties['defaultThinkingLevel']) {
    $settings | Add-Member -NotePropertyName 'defaultThinkingLevel' -NotePropertyValue 'medium'
}

$settings | ConvertTo-Json -Depth 10 | Set-Content -Path $SettingsPath -Encoding utf8
Write-Host "[OK] Da cap nhat $SettingsPath"

# ---------------------------------------------------------------------------
# 5. AGENTS.md
# ---------------------------------------------------------------------------

Write-Section "AGENTS.md"

$TargetAgentsMd = Join-Path $AgentDir 'AGENTS.md'
$Marker = '# Kuha'

if (-not (Test-Path $TargetAgentsMd)) {
    Copy-Item -Path $KuhaAgentsMd -Destination $TargetAgentsMd
    Write-Host "[OK] Da tao $TargetAgentsMd tu kuha/AGENTS.md"
} else {
    $existing = Get-Content -Raw -Path $TargetAgentsMd
    if ($existing -notmatch [regex]::Escape($Marker)) {
        $kuhaContent = Get-Content -Raw -Path $KuhaAgentsMd
        Add-Content -Path $TargetAgentsMd -Value "`r`n`r`n$kuhaContent" -Encoding utf8
        Write-Host "[OK] Da them phan '$Marker' vao $TargetAgentsMd"
    } else {
        Write-Host "[BO QUA] $TargetAgentsMd da co phan '$Marker'"
    }
}

# ---------------------------------------------------------------------------
# 6. Thu muc du an (noi luu file ket qua) va shortcut
# ---------------------------------------------------------------------------

Write-Section "Thu muc du an"

$subDirs = @('bao-cao', 'nghien-cuu', 'phap-ly', 'tai-chinh', 'bien-ban', 'slide', 'recordings')

function Test-HasSubdirs($path) {
    return [bool](Get-ChildItem -Path $path -Directory -Force -ErrorAction SilentlyContinue | Select-Object -First 1)
}

if (-not $ProjectDir) {
    Write-Host "[BO QUA] Khong tim thay thu muc du an co san (KuHa, Kuha, kuha," -ForegroundColor Yellow
    Write-Host "Documents\Kuha, Documents\KuHa duoi $env:USERPROFILE) va khong co tham so -Dir."
    Write-Host "Hay tao thu muc du an truoc (vi du $env:USERPROFILE\KuHa), roi chay lai:"
    Write-Host "  install.ps1 -Dir `"$env:USERPROFILE\KuHa`""
    Write-Host "Hoac chi can mo 'pi' ngay ben trong thu muc du an do - khong bat buoc"
    Write-Host "phai chay lai installer."
} else {
    if (-not (Test-Path $ProjectDir)) {
        New-Item -ItemType Directory -Path $ProjectDir -Force | Out-Null
    }
    if (Test-HasSubdirs $ProjectDir) {
        Write-Host "[BO QUA] $ProjectDir da co san thu muc con, khong tao them 7 thu muc" -ForegroundColor Yellow
        Write-Host "loai chuan de tranh xao tron cay thu muc co san. Tro ly se hoi anh/chi"
        Write-Host "thu muc nao dung cho loai nao khi lam viec (xem AGENTS.md)."
    } else {
        foreach ($d in $subDirs) {
            $full = Join-Path $ProjectDir $d
            if (-not (Test-Path $full)) {
                New-Item -ItemType Directory -Path $full -Force | Out-Null
            }
        }
        Write-Host "[OK] $ProjectDir\{$($subDirs -join ',')}"
    }

    $Launcher = Join-Path $env:USERPROFILE 'Desktop\Kuha.cmd'
    $writeLauncher = $true
    if (Test-Path $Launcher) {
        $existingLauncher = Get-Content -Raw -Path $Launcher -ErrorAction SilentlyContinue
        if ($existingLauncher -notmatch [regex]::Escape(':: kuha-launcher')) {
            $writeLauncher = $false
            Write-Host "[BO QUA] $Launcher da ton tai va khong phai do Kuha tao, khong ghi de." -ForegroundColor Yellow
        }
    }
    if ($writeLauncher) {
        $launcherDir = Split-Path -Parent $Launcher
        if (-not (Test-Path $launcherDir)) {
            New-Item -ItemType Directory -Path $launcherDir -Force | Out-Null
        }
        $launcherContent = @"
@echo off
:: kuha-launcher
cd /d "$ProjectDir"
pi
"@
        Set-Content -Path $Launcher -Value $launcherContent -Encoding ascii
        Write-Host "[OK] Da tao $Launcher"
    }
}

# ---------------------------------------------------------------------------
# 7. Tom tat
# ---------------------------------------------------------------------------

Write-Section "Hoan tat"

Write-Host "Thu muc agent   : $AgentDir"
Write-Host "settings.json   : $SettingsPath"
Write-Host "AGENTS.md       : $TargetAgentsMd"
Write-Host "Thu muc du an   : $(if ($ProjectDir) { $ProjectDir } else { 'chua xac dinh' })"
Write-Host ""
Write-Host "Buoc tiep theo:" -ForegroundColor Green
Write-Host "  1. Neu chua co API key: chay 'pi' roi go /login, hoac dat bien moi truong OPENROUTER_API_KEY."
Write-Host "  2. Mo terminal moi (de nhan PATH cap nhat neu vua cai cong cu)."
Write-Host "  3. Chay 'pi' trong thu muc du an va thu lenh: /nghien-cuu, /bao-cao, /phan-tich-bctc, /tra-luat, /bien-ban-hop, /slide"
