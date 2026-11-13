$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectPath = Split-Path $PSScriptRoot -Parent
$outputPath = Join-Path $projectPath 'src-tauri/windows'
[System.IO.Directory]::CreateDirectory($outputPath) | Out-Null
$logo = [System.Drawing.Image]::FromFile((Join-Path $projectPath 'public/logo-icon.png'))

function New-InstallerImage([string]$Name, [int]$Width, [int]$Height, [bool]$Sidebar, [bool]$AlignRight = $false) {
    $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear([System.Drawing.Color]::White)
    $panelWidth = if ($Sidebar -and $Width -gt 200) { 164 } else { $Width }
    $brush = $null
    if ($Sidebar) {
        $rectangle = [System.Drawing.Rectangle]::new(0, 0, $panelWidth, $Height)
        $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rectangle, [System.Drawing.Color]::FromArgb(19, 103, 223), [System.Drawing.Color]::FromArgb(8, 33, 83), 90.0)
        $graphics.FillRectangle($brush, $rectangle)
        $ellipseBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(25, 255, 255, 255))
        $graphics.FillEllipse($ellipseBrush, -95, ($Height - 135), 300, 230)
        $ellipseBrush.Dispose()
        $logoWidth = 104
        $logoHeight = [int]($logoWidth * $logo.Height / $logo.Width)
        $graphics.DrawImage($logo, [int](($panelWidth - $logoWidth) / 2), 35, $logoWidth, $logoHeight)
        $format = [System.Drawing.StringFormat]::new()
        $format.Alignment = [System.Drawing.StringAlignment]::Center
        $title = [System.Drawing.Font]::new('Segoe UI', 19, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $subtitle = [System.Drawing.Font]::new('Segoe UI', 11, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $graphics.DrawString("Office`n23", $title, [System.Drawing.Brushes]::White, [System.Drawing.RectangleF]::new(8, 150, ($panelWidth - 16), 65), $format)
        $graphics.DrawString("Văn phòng số`ntrên mọi thiết bị", $subtitle, [System.Drawing.Brushes]::White, [System.Drawing.RectangleF]::new(8, 224, ($panelWidth - 16), 45), $format)
        $graphics.DrawString('DOCS  ·  SHEETS  ·  PDF', $subtitle, [System.Drawing.Brushes]::White, [System.Drawing.RectangleF]::new(4, ($Height - 32), ($panelWidth - 8), 25), $format)
        $title.Dispose()
        $subtitle.Dispose()
        $format.Dispose()
    } else {
        $available = [Math]::Min(48, $Height - 8)
        $scale = [Math]::Min($available / $logo.Width, $available / $logo.Height)
        $logoWidth = [single]($logo.Width * $scale)
        $logoHeight = [single]($logo.Height * $scale)
        $left = if ($AlignRight) { $Width - $logoWidth - 16 } else { ($Width - $logoWidth) / 2 }
        $top = ($Height - $logoHeight) / 2
        $graphics.DrawImage($logo, [System.Drawing.RectangleF]::new($left, $top, $logoWidth, $logoHeight))
    }
    $bitmap.Save((Join-Path $outputPath $Name), [System.Drawing.Imaging.ImageFormat]::Bmp)
    if ($brush) { $brush.Dispose() }
    $graphics.Dispose()
    $bitmap.Dispose()
}

function New-ApplicationIcons {
    $iconDirectory = Join-Path $projectPath 'src-tauri/icons'
    $frames = [System.Collections.Generic.List[byte[]]]::new()
    $sizes = @(16, 24, 32, 48, 64, 128, 256)
    foreach ($size in $sizes) {
        $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $scale = [Math]::Min($size / $logo.Width, $size / $logo.Height)
        $width = [single]($logo.Width * $scale)
        $height = [single]($logo.Height * $scale)
        $graphics.DrawImage($logo, [System.Drawing.RectangleF]::new(($size - $width) / 2, ($size - $height) / 2, $width, $height))
        $stream = [System.IO.MemoryStream]::new()
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        $frames.Add($stream.ToArray())
        if ($size -eq 32) { [System.IO.File]::WriteAllBytes((Join-Path $iconDirectory '32x32.png'), $stream.ToArray()) }
        if ($size -eq 128) { [System.IO.File]::WriteAllBytes((Join-Path $iconDirectory '128x128.png'), $stream.ToArray()) }
        if ($size -eq 256) { [System.IO.File]::WriteAllBytes((Join-Path $iconDirectory '128x128@2x.png'), $stream.ToArray()) }
        $stream.Dispose()
        $graphics.Dispose()
        $bitmap.Dispose()
    }
    $output = [System.IO.File]::Create((Join-Path $iconDirectory 'icon.ico'))
    $writer = [System.IO.BinaryWriter]::new($output)
    try {
        $writer.Write([uint16]0)
        $writer.Write([uint16]1)
        $writer.Write([uint16]$sizes.Count)
        $offset = 6 + 16 * $sizes.Count
        for ($index = 0; $index -lt $sizes.Count; $index++) {
            $writer.Write([byte]($sizes[$index] % 256))
            $writer.Write([byte]($sizes[$index] % 256))
            $writer.Write([byte]0)
            $writer.Write([byte]0)
            $writer.Write([uint16]1)
            $writer.Write([uint16]32)
            $writer.Write([uint32]$frames[$index].Length)
            $writer.Write([uint32]$offset)
            $offset += $frames[$index].Length
        }
        foreach ($frame in $frames) { $writer.Write($frame) }
    } finally { $writer.Dispose(); $output.Dispose() }
}

try {
    New-ApplicationIcons
    New-InstallerImage 'sidebar.bmp' 164 314 $true
    New-InstallerImage 'header.bmp' 150 57 $false
    New-InstallerImage 'wix-dialog.bmp' 493 312 $true
    New-InstallerImage 'wix-banner.bmp' 493 58 $false $true
} finally {
    $logo.Dispose()
}
