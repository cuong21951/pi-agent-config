#Requires -Version 7
<#
.SYNOPSIS
    Ghi âm cuộc họp bằng ffmpeg (thiết bị âm thanh dshow trên Windows).

.DESCRIPTION
    -ListDevices  liệt kê các thiết bị ghi âm (microphone) mà ffmpeg thấy được.
    -Device       tên thiết bị (đúng như hiển thị khi chạy -ListDevices). Nếu bỏ trống,
                  dùng thiết bị đầu tiên tìm thấy.
    -Minutes      số phút ghi âm tối đa. Bắt buộc khi ghi âm thật.
    -Out          đường dẫn file .m4a output. Mặc định:
                  %USERPROFILE%\Documents\Kuha\recordings\<yyyy-MM-dd_HHmm>.m4a

    Ghi âm sẽ kết thúc khi hết thời gian (-Minutes) hoặc khi nhấn Ctrl+C — ffmpeg
    tự hoàn thiện (finalize) file khi nhận tín hiệu dừng, không cần thao tác gì thêm.

.EXAMPLE
    pwsh -File record.ps1 -ListDevices

.EXAMPLE
    pwsh -File record.ps1 -Device "Microphone (Realtek Audio)" -Minutes 45

.EXAMPLE
    pwsh -File record.ps1 -Minutes 60 -Out "D:\hop\hop-khai-truong.m4a"
#>
[CmdletBinding()]
param(
    [switch]$ListDevices,
    [string]$Device,
    [double]$Minutes,
    [string]$Out,
    [switch]$Stop
)

$ErrorActionPreference = 'Stop'

function Get-DshowAudioDevices {
    $ffmpegOutput = & ffmpeg -list_devices true -f dshow -i dummy 2>&1 | Out-String
    $lines = $ffmpegOutput -split "`r?`n"
    $devices = @()
    $inAudioSection = $false
    foreach ($line in $lines) {
        if ($line -match '\(audio\)') {
            $inAudioSection = $true
        } elseif ($line -match '\(video\)') {
            $inAudioSection = $false
        }
        if ($inAudioSection -and $line -match '"([^"]+)"') {
            $devices += $matches[1]
        }
    }
    return $devices
}

if ($Stop) {
    Write-Host "Ghi âm không cần lệnh dừng riêng:"
    Write-Host "  - Nó tự dừng khi đạt đủ số phút chỉ định bằng -Minutes."
    Write-Host "  - Hoặc nhấn Ctrl+C trong cửa sổ đang chạy để dừng sớm — ffmpeg sẽ tự"
    Write-Host "    hoàn thiện (finalize) file .m4a trước khi thoát, file vẫn phát được."
    return
}

if ($ListDevices) {
    $devices = Get-DshowAudioDevices
    if ($devices.Count -eq 0) {
        Write-Host "Không tìm thấy thiết bị ghi âm nào. Kiểm tra microphone đã cắm/bật chưa."
    } else {
        Write-Host "Danh sách thiết bị ghi âm (audio) tìm thấy:"
        for ($i = 0; $i -lt $devices.Count; $i++) {
            Write-Host ("  [{0}] {1}" -f $i, $devices[$i])
        }
        Write-Host ""
        Write-Host "Dùng tên thiết bị (nguyên văn, có dấu ngoặc kép) với tham số -Device."
    }
    return
}

if (-not $Minutes -or $Minutes -le 0) {
    throw "Vui long chi dinh -Minutes <so phut ghi am toi da>, vi du: -Minutes 45. Dung -ListDevices de xem thiet bi, hoac -Stop de xem huong dan dung ghi am."
}

if (-not $Device) {
    $devices = Get-DshowAudioDevices
    if ($devices.Count -eq 0) {
        throw "Khong tim thay thiet bi ghi am nao tren may. Chay lai voi -ListDevices de kiem tra."
    }
    $Device = $devices[0]
    Write-Host "Chua chi dinh -Device, dung thiet bi dau tien: `"$Device`""
}

if (-not $Out) {
    $timestamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
    $recordingsDir = Join-Path $env:USERPROFILE 'Documents\Kuha\recordings'
    if (-not (Test-Path $recordingsDir)) {
        New-Item -ItemType Directory -Path $recordingsDir -Force | Out-Null
    }
    $Out = Join-Path $recordingsDir "$timestamp.m4a"
} else {
    $outDir = Split-Path -Parent $Out
    if ($outDir -and -not (Test-Path $outDir)) {
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    }
}

$seconds = [int]([math]::Round($Minutes * 60))

Write-Host "Bat dau ghi am tu thiet bi: `"$Device`""
Write-Host "Thoi luong toi da: $Minutes phut ($seconds giay)"
Write-Host "File output: $Out"
Write-Host ""
Write-Host "Nhan Ctrl+C de dung ghi am som hon (ffmpeg se tu hoan thien file khi nhan tin hieu dung)."
Write-Host ""

& ffmpeg -f dshow -i "audio=$Device" -t $seconds -c:a aac -y $Out

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Ghi am hoan tat. File da luu tai:"
    Write-Host $Out
} else {
    Write-Warning "ffmpeg ket thuc voi ma loi $LASTEXITCODE. Kiem tra lai file: $Out"
}
