param(
    [string]$ExePath
)

$ErrorActionPreference = 'Stop'

if (-not $ExePath) {
    $candidates = @(
        "$env:LOCALAPPDATA\Office 23\minh-spark-office.exe",
        "$env:LOCALAPPDATA\Minh Spark Office\minh-spark-office.exe",
        "$env:LOCALAPPDATA\Programs\Minh Spark Office\minh-spark-office.exe",
        "$PSScriptRoot\..\src-tauri\target\release\minh-spark-office.exe"
    )
    foreach ($cand in $candidates) {
        if (Test-Path -LiteralPath $cand) {
            $ExePath = (Resolve-Path $cand).Path
            break
        }
    }
}

if (-not $ExePath -or -not (Test-Path -LiteralPath $ExePath)) {
    throw "Executable minh-spark-office.exe not found. Specify -ExePath."
}

Write-Host "Registering file associations for: $ExePath"

$extensions = @(
    'docx', 'xlsx', 'xlsm', 'xls', 'csv', 'tsv', 'pdf', 'pptx', 'ppt', 'txt', 'md',
    'png', 'jpg', 'jpeg', 'jfif', 'jpe', 'webp', 'gif', 'bmp', 'dib', 'ico', 'svg', 'svgz', 'avif', 'tiff', 'tif', 'heic', 'heif'
)

$appName = "Minh Spark Office"
$progAppKey = "Software\Classes\Applications\minh-spark-office.exe"

# Register Application
New-Item -Path "HKCU:\$progAppKey" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\$progAppKey" -Name "FriendlyAppName" -Value $appName -Force
New-Item -Path "HKCU:\$progAppKey\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\$progAppKey\shell\open\command" -Name "(Default)" -Value "`"$ExePath`" `"%1`"" -Force
New-Item -Path "HKCU:\$progAppKey\SupportedTypes" -Force | Out-Null

# Capabilities
$capKey = "Software\Minh Spark\Minh Spark Office\Capabilities"
New-Item -Path "HKCU:\$capKey" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\$capKey" -Name "ApplicationName" -Value $appName -Force
Set-ItemProperty -Path "HKCU:\$capKey" -Name "ApplicationDescription" -Value "Documents, spreadsheets, slides and photos" -Force
Set-ItemProperty -Path "HKCU:\$capKey" -Name "ApplicationIcon" -Value "`"$ExePath`",0" -Force
New-Item -Path "HKCU:\$capKey\FileAssociations" -Force | Out-Null

New-Item -Path "HKCU:\Software\RegisteredApplications" -Force | Out-Null
Set-ItemProperty -Path "HKCU:\Software\RegisteredApplications" -Name "MinhSparkOffice" -Value $capKey -Force

foreach ($ext in $extensions) {
    $progId = "MinhSparkOffice.$ext"
    $classKey = "Software\Classes\$progId"
    
    New-Item -Path "HKCU:\$classKey" -Force | Out-Null
    Set-ItemProperty -Path "HKCU:\$classKey" -Name "(Default)" -Value "$appName $ext" -Force
    
    New-Item -Path "HKCU:\$classKey\DefaultIcon" -Force | Out-Null
    Set-ItemProperty -Path "HKCU:\$classKey\DefaultIcon" -Name "(Default)" -Value "`"$ExePath`",0" -Force
    
    New-Item -Path "HKCU:\$classKey\shell\open\command" -Force | Out-Null
    Set-ItemProperty -Path "HKCU:\$classKey\shell\open\command" -Name "(Default)" -Value "`"$ExePath`" `"%1`"" -Force
    
    $openWithKey = "Software\Classes\.$ext\OpenWithProgids"
    New-Item -Path "HKCU:\$openWithKey" -Force | Out-Null
    Set-ItemProperty -Path "HKCU:\$openWithKey" -Name $progId -Value "" -Force
    
    Set-ItemProperty -Path "HKCU:\$progAppKey\SupportedTypes" -Name ".$ext" -Value "" -Force
    Set-ItemProperty -Path "HKCU:\$capKey\FileAssociations" -Name ".$ext" -Value $progId -Force
}

# Notify Shell
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class ShellNotifier {
    [DllImport("shell32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
}
"@ -ErrorAction SilentlyContinue

[ShellNotifier]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)

Write-Host "Successfully registered $($extensions.Count) file associations for $appName!"
