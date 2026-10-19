# Convert the existing MF icon into NSIS's required 24-bit sidebar bitmap.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$source = [Drawing.Image]::FromFile((Join-Path $repoRoot 'src/native/icons/icon.png'))
$bitmap = [Drawing.Bitmap]::new(164, 314, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
$graphics = [Drawing.Graphics]::FromImage($bitmap)
try {
    $graphics.Clear([Drawing.Color]::FromArgb(20, 20, 20))
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($source, 0, 75, 164, 164)
    $bitmap.Save((Join-Path $repoRoot 'tooling/installer/sidebar.bmp'), [Drawing.Imaging.ImageFormat]::Bmp)
} finally {
    $graphics.Dispose()
    $bitmap.Dispose()
    $source.Dispose()
}
