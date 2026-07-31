param(
  [Parameter(Mandatory = $true)]
  [string]$Source
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$repo = Split-Path -Parent $PSScriptRoot
$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$desktopPublic = Join-Path $repo "apps/desktop/public"
$mobileAssets = Join-Path $repo "apps/mobile/assets"
$androidRes = Join-Path $repo "apps/mobile/android/app/src/main/res"

function New-TransparentBitmap([int]$width, [int]$height) {
  return [System.Drawing.Bitmap]::new(
    $width,
    $height,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
}

function Get-AlphaBounds([System.Drawing.Bitmap]$bitmap) {
  $minX = $bitmap.Width
  $minY = $bitmap.Height
  $maxX = -1
  $maxY = -1
  for ($y = 0; $y -lt $bitmap.Height; $y++) {
    for ($x = 0; $x -lt $bitmap.Width; $x++) {
      if ($bitmap.GetPixel($x, $y).A -gt 8) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  if ($maxX -lt 0) { throw "The source icon has no visible alpha pixels." }
  return [System.Drawing.Rectangle]::FromLTRB($minX, $minY, $maxX + 1, $maxY + 1)
}

function Get-SquareCrop(
  [System.Drawing.Bitmap]$bitmap,
  [System.Drawing.Rectangle]$bounds,
  [double]$occupancy = 0.86
) {
  $side = [Math]::Ceiling([Math]::Max($bounds.Width, $bounds.Height) / $occupancy)
  $side = [Math]::Min($side, [Math]::Min($bitmap.Width, $bitmap.Height))
  $centerX = $bounds.Left + ($bounds.Width / 2)
  $centerY = $bounds.Top + ($bounds.Height / 2)
  $left = [Math]::Round($centerX - ($side / 2))
  $top = [Math]::Round($centerY - ($side / 2))
  $left = [Math]::Max(0, [Math]::Min($left, $bitmap.Width - $side))
  $top = [Math]::Max(0, [Math]::Min($top, $bitmap.Height - $side))
  return [System.Drawing.Rectangle]::new($left, $top, $side, $side)
}

function Save-ResizedPng(
  [System.Drawing.Bitmap]$bitmap,
  [System.Drawing.Rectangle]$sourceRect,
  [int]$size,
  [string]$path
) {
  $target = New-TransparentBitmap $size $size
  $graphics = [System.Drawing.Graphics]::FromImage($target)
  try {
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $destination = [System.Drawing.Rectangle]::new(0, 0, $size, $size)
    $graphics.DrawImage(
      $bitmap,
      $destination,
      $sourceRect.X,
      $sourceRect.Y,
      $sourceRect.Width,
      $sourceRect.Height,
      [System.Drawing.GraphicsUnit]::Pixel
    )
    $directory = Split-Path -Parent $path
    if ($directory) { [System.IO.Directory]::CreateDirectory($directory) | Out-Null }
    $target.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $target.Dispose()
  }
}

function Save-MonochromePng([string]$source, [string]$path) {
  $bitmap = [System.Drawing.Bitmap]::FromFile($source)
  try {
    for ($y = 0; $y -lt $bitmap.Height; $y++) {
      for ($x = 0; $x -lt $bitmap.Width; $x++) {
        $pixel = $bitmap.GetPixel($x, $y)
        $bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($pixel.A, 255, 255, 255))
      }
    }
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $bitmap.Dispose()
  }
}

function Save-PngIco([string[]]$pngPaths, [int[]]$sizes, [string]$path) {
  $images = [System.Collections.Generic.List[byte[]]]::new()
  foreach ($pngPath in $pngPaths) {
    $images.Add([System.IO.File]::ReadAllBytes($pngPath))
  }
  $stream = [System.IO.File]::Create($path)
  $writer = [System.IO.BinaryWriter]::new($stream)
  try {
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$images.Count)
    $offset = 6 + (16 * $images.Count)
    for ($index = 0; $index -lt $images.Count; $index++) {
      $size = $sizes[$index]
      $dimension = if ($size -ge 256) { 0 } else { $size }
      $writer.Write([byte]$dimension)
      $writer.Write([byte]$dimension)
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([uint16]1)
      $writer.Write([uint16]32)
      $writer.Write([uint32]$images[$index].Length)
      $writer.Write([uint32]$offset)
      $offset += $images[$index].Length
    }
    foreach ($image in $images) { $writer.Write($image) }
  } finally {
    $writer.Dispose()
    $stream.Dispose()
  }
}

$sourceBitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)
try {
  if ($sourceBitmap.Width -ne $sourceBitmap.Height) {
    throw "The source icon must use a square canvas."
  }
  if (-not $sourceBitmap.PixelFormat.ToString().Contains("Argb")) {
    throw "The source icon must contain a real alpha channel."
  }

  $fullRect = [System.Drawing.Rectangle]::new(0, 0, $sourceBitmap.Width, $sourceBitmap.Height)
  $visibleBounds = Get-AlphaBounds $sourceBitmap
  $normalizedRect = Get-SquareCrop $sourceBitmap $visibleBounds

  Save-ResizedPng $sourceBitmap $normalizedRect 1024 (Join-Path $desktopPublic "icon.png")
  Save-ResizedPng $sourceBitmap $normalizedRect 1024 (Join-Path $desktopPublic "brand-mark.png")
  $desktopSizes = @(16, 32, 48, 64, 128, 256, 512)
  $desktopPngs = @()
  foreach ($size in $desktopSizes) {
    $path = Join-Path $desktopPublic "sized/${size}x${size}.png"
    Save-ResizedPng $sourceBitmap $normalizedRect $size $path
    if ($size -le 256) { $desktopPngs += $path }
  }
  Save-PngIco $desktopPngs @($desktopSizes | Where-Object { $_ -le 256 }) (Join-Path $desktopPublic "icon.ico")

  Save-ResizedPng $sourceBitmap $normalizedRect 1024 (Join-Path $mobileAssets "icon.png")
  Save-ResizedPng $sourceBitmap $fullRect 1024 (Join-Path $mobileAssets "android-icon-foreground.png")
  Save-ResizedPng $sourceBitmap $normalizedRect 1024 (Join-Path $mobileAssets "brand-mark.png")
  Save-ResizedPng $sourceBitmap $normalizedRect 1024 (Join-Path $mobileAssets "splash-icon.png")
  Save-ResizedPng $sourceBitmap $normalizedRect 48 (Join-Path $mobileAssets "favicon.png")
  $monoSource = Join-Path $env:TEMP "orion-monochrome-source.png"
  Save-ResizedPng $sourceBitmap $fullRect 432 $monoSource
  Save-MonochromePng $monoSource (Join-Path $mobileAssets "android-icon-monochrome.png")
  Remove-Item -LiteralPath $monoSource -Force

  $densitySizes = @{
    "mdpi" = @{ legacy = 48; foreground = 108; splash = 288 }
    "hdpi" = @{ legacy = 72; foreground = 162; splash = 432 }
    "xhdpi" = @{ legacy = 96; foreground = 216; splash = 576 }
    "xxhdpi" = @{ legacy = 144; foreground = 324; splash = 864 }
    "xxxhdpi" = @{ legacy = 192; foreground = 432; splash = 1152 }
  }
  foreach ($density in $densitySizes.Keys) {
    $mipmap = Join-Path $androidRes "mipmap-$density"
    foreach ($name in @("ic_launcher.webp", "ic_launcher_foreground.webp", "ic_launcher_round.webp")) {
      $legacyPath = Join-Path $mipmap $name
      if (Test-Path -LiteralPath $legacyPath) { Remove-Item -LiteralPath $legacyPath -Force }
    }
    Save-ResizedPng $sourceBitmap $normalizedRect $densitySizes[$density].legacy (Join-Path $mipmap "ic_launcher.png")
    Save-ResizedPng $sourceBitmap $normalizedRect $densitySizes[$density].legacy (Join-Path $mipmap "ic_launcher_round.png")
    Save-ResizedPng $sourceBitmap $fullRect $densitySizes[$density].foreground (Join-Path $mipmap "ic_launcher_foreground.png")
    Save-ResizedPng $sourceBitmap $normalizedRect $densitySizes[$density].splash (Join-Path $androidRes "drawable-$density/splashscreen_logo.png")
  }

  Write-Host "Generated Desktop and Mobile icon families from $sourcePath"
  Write-Host "Visible alpha bounds: $visibleBounds"
  Write-Host "Normalized crop: $normalizedRect"
} finally {
  $sourceBitmap.Dispose()
}
