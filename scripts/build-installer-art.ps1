$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectPath = Split-Path $PSScriptRoot -Parent
$outputPath = Join-Path $projectPath 'src-tauri/windows'
[System.IO.Directory]::CreateDirectory($outputPath) | Out-Null
$logo = [System.Drawing.Image]::FromFile((Join-Path $projectPath 'public/logo-icon.png'))

function New-InstallerImage([string]$Name, [int]$Width, [int]$Height, [bool]$Sidebar) {
    $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear([System.Drawing.Color]::White)
    $panelWidth = if ($Sidebar -and $Width -gt 200) { 164 } else { $Width }
    $rectangle = [System.Drawing.Rectangle]::new(0, 0, $panelWidth, $Height)
    $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rectangle, [System.Drawing.Color]::FromArgb(19, 103, 223), [System.Drawing.Color]::FromArgb(8, 33, 83), 90.0)
    $graphics.FillRectangle($brush, $rectangle)
    if ($Sidebar) {
        $graphics.FillEllipse([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(25, 255, 255, 255)), -95, ($Height - 135), 300, 230)
        $logoWidth = 104
        $logoHeight = [int]($logoWidth * $logo.Height / $logo.Width)
        $graphics.DrawImage($logo, [int](($panelWidth - $logoWidth) / 2), 35, $logoWidth, $logoHeight)
        $format = [System.Drawing.StringFormat]::new()
        $format.Alignment = [System.Drawing.StringAlignment]::Center
        $title = [System.Drawing.Font]::new('Segoe UI', 19, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $subtitle = [System.Drawing.Font]::new('Segoe UI', 11, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $graphics.DrawString("Minh Spark`nOffice", $title, [System.Drawing.Brushes]::White, [System.Drawing.RectangleF]::new(8, 150, ($panelWidth - 16), 65), $format)
        $graphics.DrawString("Văn phòng số`ntrên mọi thiết bị", $subtitle, [System.Drawing.Brushes]::White, [System.Drawing.RectangleF]::new(8, 224, ($panelWidth - 16), 45), $format)
        $graphics.DrawString('DOCS  ·  SHEETS  ·  PDF', $subtitle, [System.Drawing.Brushes]::White, [System.Drawing.RectangleF]::new(4, ($Height - 32), ($panelWidth - 8), 25), $format)
        $title.Dispose()
        $subtitle.Dispose()
        $format.Dispose()
    } else {
        $size = $Height - 10
        $graphics.DrawImage($logo, ($Width - $size - 8), 5, $size, $size)
    }
    $bitmap.Save((Join-Path $outputPath $Name), [System.Drawing.Imaging.ImageFormat]::Bmp)
    $brush.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

try {
    New-InstallerImage 'sidebar.bmp' 164 314 $true
    New-InstallerImage 'header.bmp' 150 57 $false
    New-InstallerImage 'wix-dialog.bmp' 493 312 $true
    New-InstallerImage 'wix-banner.bmp' 493 58 $false
} finally {
    $logo.Dispose()
}
