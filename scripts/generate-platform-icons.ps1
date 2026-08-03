param(
  [string]$Source
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$repo = Split-Path -Parent $PSScriptRoot
$desktopPublic = Join-Path $repo "apps/desktop/public"
$mobileAssets = Join-Path $repo "apps/mobile/assets"
$androidRes = Join-Path $repo "apps/mobile/android/app/src/main/res"

if ($Source) {
  Write-Warning "-Source is retained for compatibility but ignored. Orion icons now use deterministic Portal Star geometry."
}

$colors = @{
  Obsidian = [System.Drawing.Color]::FromArgb(255, 7, 7, 12)
  ObsidianWarm = [System.Drawing.Color]::FromArgb(255, 20, 8, 14)
  Border = [System.Drawing.Color]::FromArgb(255, 49, 28, 37)
  Portal = [System.Drawing.Color]::FromArgb(255, 242, 5, 31)
  PortalHighlight = [System.Drawing.Color]::FromArgb(255, 255, 79, 94)
  Pearl = [System.Drawing.Color]::FromArgb(255, 255, 244, 236)
  White = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)
}

function New-TransparentBitmap([int]$size) {
  return [System.Drawing.Bitmap]::new(
    $size,
    $size,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
}

function New-RoundedRectanglePath(
  [System.Drawing.RectangleF]$rect,
  [single]$radius
) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $radius * 2
  $path.AddArc($rect.Left, $rect.Top, $diameter, $diameter, 180, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Top, $diameter, $diameter, 270, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($rect.Left, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Set-HighQualityGraphics([System.Drawing.Graphics]$graphics) {
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
}

function Draw-ObsidianTile(
  [System.Drawing.Graphics]$graphics,
  [int]$size,
  [double]$marginRatio,
  [ValidateSet("rounded", "circle", "square")]
  [string]$shape = "rounded"
) {
  $margin = [single]($size * $marginRatio)
  $side = [single]($size - (2 * $margin))
  $rect = [System.Drawing.RectangleF]::new($margin, $margin, $side, $side)
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    $colors.Obsidian,
    $colors.ObsidianWarm,
    45
  )
  try {
    if ($shape -eq "circle") {
      $graphics.FillEllipse($brush, $rect)
      $border = [System.Drawing.Pen]::new($colors.Border, [single][Math]::Max(1, $size * 0.012))
      try { $graphics.DrawEllipse($border, $rect) } finally { $border.Dispose() }
      return
    }
    if ($shape -eq "square") {
      $graphics.FillRectangle($brush, $rect)
      return
    }
    $path = New-RoundedRectanglePath $rect ([single]($side * 0.22))
    try {
      $graphics.FillPath($brush, $path)
      $border = [System.Drawing.Pen]::new($colors.Border, [single][Math]::Max(1, $size * 0.012))
      try { $graphics.DrawPath($border, $path) } finally { $border.Dispose() }
    } finally {
      $path.Dispose()
    }
  } finally {
    $brush.Dispose()
  }
}

function New-PortalStarPath(
  [single]$centerX,
  [single]$centerY,
  [single]$longRadius,
  [single]$innerRadius
) {
  $points = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($centerX, $centerY - $longRadius),
    [System.Drawing.PointF]::new($centerX + $innerRadius, $centerY - $innerRadius),
    [System.Drawing.PointF]::new($centerX + $longRadius, $centerY),
    [System.Drawing.PointF]::new($centerX + $innerRadius, $centerY + $innerRadius),
    [System.Drawing.PointF]::new($centerX, $centerY + $longRadius),
    [System.Drawing.PointF]::new($centerX - $innerRadius, $centerY + $innerRadius),
    [System.Drawing.PointF]::new($centerX - $longRadius, $centerY),
    [System.Drawing.PointF]::new($centerX - $innerRadius, $centerY - $innerRadius)
  )
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddPolygon($points)
  return $path
}

function Draw-PortalStar(
  [System.Drawing.Graphics]$graphics,
  [int]$size,
  [double]$scale = 1.0,
  [bool]$monochrome = $false,
  [bool]$allowGlow = $false
) {
  $center = [single]($size / 2)
  $diameter = [single]($size * 0.57 * $scale)
  $strokeWidth = [single][Math]::Max(1.5, $size * 0.085 * $scale)
  $ringRect = [System.Drawing.RectangleF]::new(
    $center - ($diameter / 2),
    $center - ($diameter / 2),
    $diameter,
    $diameter
  )
  $portalColor = if ($monochrome) { $colors.White } else { $colors.Portal }

  if ($allowGlow -and -not $monochrome -and $size -ge 48) {
    $glow = [System.Drawing.Pen]::new(
      [System.Drawing.Color]::FromArgb(54, 242, 5, 31),
      [single]($strokeWidth * 1.65)
    )
    $glow.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $glow.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    try { $graphics.DrawArc($glow, $ringRect, 50, 310) } finally { $glow.Dispose() }
  }

  $portal = [System.Drawing.Pen]::new($portalColor, $strokeWidth)
  $portal.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $portal.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  try { $graphics.DrawArc($portal, $ringRect, 50, 310) } finally { $portal.Dispose() }

  if (-not $monochrome -and $size -ge 48) {
    $highlight = [System.Drawing.Pen]::new(
      $colors.PortalHighlight,
      [single][Math]::Max(1, $strokeWidth * 0.18)
    )
    $highlight.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $highlight.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $innerRect = [System.Drawing.RectangleF]::new(
      $ringRect.X + ($strokeWidth * 0.18),
      $ringRect.Y + ($strokeWidth * 0.18),
      $ringRect.Width - ($strokeWidth * 0.36),
      $ringRect.Height - ($strokeWidth * 0.36)
    )
    try { $graphics.DrawArc($highlight, $innerRect, 50, 310) } finally { $highlight.Dispose() }
  }

  $starLong = [single]($size * 0.165 * $scale)
  $starInner = [single]($size * 0.034 * $scale)
  $starPath = New-PortalStarPath $center $center $starLong $starInner
  try {
    if ($allowGlow -and -not $monochrome -and $size -ge 48) {
      $glowPath = New-PortalStarPath $center $center ([single]($starLong * 1.12)) ([single]($starInner * 1.35))
      $glowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(48, 255, 40, 58))
      try { $graphics.FillPath($glowBrush, $glowPath) } finally { $glowBrush.Dispose(); $glowPath.Dispose() }
    }
    $starBrush = [System.Drawing.SolidBrush]::new($(if ($monochrome) { $colors.White } else { $colors.PortalHighlight }))
    try { $graphics.FillPath($starBrush, $starPath) } finally { $starBrush.Dispose() }

    if (-not $monochrome -and $size -ge 32) {
      $pearlRadius = [single][Math]::Max(1.5, $size * 0.022 * $scale)
      $pearlBrush = [System.Drawing.SolidBrush]::new($colors.Pearl)
      try {
        $graphics.FillEllipse(
          $pearlBrush,
          $center - $pearlRadius,
          $center - $pearlRadius,
          $pearlRadius * 2,
          $pearlRadius * 2
        )
      } finally { $pearlBrush.Dispose() }
    }
  } finally {
    $starPath.Dispose()
  }
}

function New-OrionIcon(
  [int]$size,
  [ValidateSet("desktop", "mobile", "round", "adaptive", "monochrome", "splash", "brand", "favicon", "background")]
  [string]$mode
) {
  $bitmap = New-TransparentBitmap $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  Set-HighQualityGraphics $graphics
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    switch ($mode) {
      "desktop" {
        Draw-ObsidianTile $graphics $size 0.06 "rounded"
        Draw-PortalStar $graphics $size 0.92 $false $true
      }
      "mobile" {
        $graphics.Clear($colors.Obsidian)
        Draw-ObsidianTile $graphics $size 0.025 "rounded"
        Draw-PortalStar $graphics $size 0.92 $false $true
      }
      "round" {
        Draw-ObsidianTile $graphics $size 0.02 "circle"
        Draw-PortalStar $graphics $size 0.87 $false $true
      }
      "adaptive" { Draw-PortalStar $graphics $size 1.0 $false $false }
      "monochrome" { Draw-PortalStar $graphics $size 1.0 $true $false }
      "splash" { Draw-PortalStar $graphics $size 0.74 $false $false }
      "brand" { Draw-PortalStar $graphics $size 1.05 $false $true }
      "favicon" {
        $graphics.Clear($colors.Obsidian)
        Draw-PortalStar $graphics $size 0.82 $false $false
      }
      "background" { $graphics.Clear($colors.Obsidian) }
    }
  } finally {
    $graphics.Dispose()
  }
  return $bitmap
}

function Save-OrionPng([int]$size, [string]$mode, [string]$path) {
  $directory = Split-Path -Parent $path
  if ($directory) { [System.IO.Directory]::CreateDirectory($directory) | Out-Null }
  $bitmap = New-OrionIcon $size $mode
  try { $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png) } finally { $bitmap.Dispose() }
}

function Save-PngIco([string[]]$pngPaths, [int[]]$sizes, [string]$path) {
  $images = [System.Collections.Generic.List[byte[]]]::new()
  foreach ($pngPath in $pngPaths) { $images.Add([System.IO.File]::ReadAllBytes($pngPath)) }
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

function Get-AlphaBounds([string]$path) {
  $bitmap = [System.Drawing.Bitmap]::FromFile($path)
  try {
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
    if ($maxX -lt 0) { throw "$path has no visible alpha pixels." }
    return [pscustomobject]@{
      Width = $maxX - $minX + 1
      Height = $maxY - $minY + 1
      CanvasWidth = $bitmap.Width
      CanvasHeight = $bitmap.Height
      OccupancyX = ($maxX - $minX + 1) / $bitmap.Width
      OccupancyY = ($maxY - $minY + 1) / $bitmap.Height
    }
  } finally { $bitmap.Dispose() }
}

function Assert-Range([double]$value, [double]$minimum, [double]$maximum, [string]$label) {
  if ($value -lt $minimum -or $value -gt $maximum) {
    throw "$label must be between $minimum and $maximum; received $value."
  }
}

[System.IO.Directory]::CreateDirectory($desktopPublic) | Out-Null
[System.IO.Directory]::CreateDirectory($mobileAssets) | Out-Null

$desktopSizes = @(16, 24, 32, 48, 64, 128, 256, 512, 1024)
$desktopPngs = @()
foreach ($size in $desktopSizes) {
  $path = if ($size -eq 1024) {
    Join-Path $desktopPublic "icon.png"
  } else {
    Join-Path $desktopPublic "sized/${size}x${size}.png"
  }
  Save-OrionPng $size "desktop" $path
  if ($size -le 256) { $desktopPngs += $path }
}
Save-PngIco $desktopPngs @($desktopSizes | Where-Object { $_ -le 256 }) (Join-Path $desktopPublic "icon.ico")
Save-OrionPng 1024 "brand" (Join-Path $desktopPublic "brand-mark.png")

Save-OrionPng 1024 "mobile" (Join-Path $mobileAssets "icon.png")
Save-OrionPng 1024 "brand" (Join-Path $mobileAssets "brand-mark.png")
Save-OrionPng 1024 "adaptive" (Join-Path $mobileAssets "android-icon-foreground.png")
Save-OrionPng 512 "background" (Join-Path $mobileAssets "android-icon-background.png")
Save-OrionPng 432 "monochrome" (Join-Path $mobileAssets "android-icon-monochrome.png")
Save-OrionPng 1024 "splash" (Join-Path $mobileAssets "splash-icon.png")
Save-OrionPng 48 "favicon" (Join-Path $mobileAssets "favicon.png")

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
  Save-OrionPng $densitySizes[$density].legacy "mobile" (Join-Path $mipmap "ic_launcher.png")
  Save-OrionPng $densitySizes[$density].legacy "round" (Join-Path $mipmap "ic_launcher_round.png")
  Save-OrionPng $densitySizes[$density].foreground "adaptive" (Join-Path $mipmap "ic_launcher_foreground.png")
  Save-OrionPng $densitySizes[$density].splash "splash" (Join-Path $androidRes "drawable-$density/splashscreen_logo.png")
}

$desktopBounds = Get-AlphaBounds (Join-Path $desktopPublic "icon.png")
$adaptiveBounds = Get-AlphaBounds (Join-Path $mobileAssets "android-icon-foreground.png")
$monochromeBounds = Get-AlphaBounds (Join-Path $mobileAssets "android-icon-monochrome.png")
Assert-Range $desktopBounds.OccupancyX 0.86 0.90 "Desktop tile horizontal occupancy"
Assert-Range $desktopBounds.OccupancyY 0.86 0.90 "Desktop tile vertical occupancy"
Assert-Range $adaptiveBounds.OccupancyX 0.63 0.68 "Android adaptive horizontal occupancy"
Assert-Range $adaptiveBounds.OccupancyY 0.63 0.68 "Android adaptive vertical occupancy"
Assert-Range $monochromeBounds.OccupancyX 0.63 0.68 "Android monochrome horizontal occupancy"
Assert-Range $monochromeBounds.OccupancyY 0.63 0.68 "Android monochrome vertical occupancy"

$icoStream = [System.IO.File]::OpenRead((Join-Path $desktopPublic "icon.ico"))
$icoReader = [System.IO.BinaryReader]::new($icoStream)
try {
  $reserved = $icoReader.ReadUInt16()
  $type = $icoReader.ReadUInt16()
  $count = $icoReader.ReadUInt16()
  if ($reserved -ne 0 -or $type -ne 1 -or $count -ne 7) {
    throw "Desktop ICO directory is invalid or missing required resolutions."
  }
} finally {
  $icoReader.Dispose()
  $icoStream.Dispose()
}

Write-Host "Generated the Orion Portal Star icon family."
Write-Host ("Desktop tile occupancy: {0:P1} x {1:P1}" -f $desktopBounds.OccupancyX, $desktopBounds.OccupancyY)
Write-Host ("Android adaptive occupancy: {0:P1} x {1:P1}" -f $adaptiveBounds.OccupancyX, $adaptiveBounds.OccupancyY)
Write-Host ("Android monochrome occupancy: {0:P1} x {1:P1}" -f $monochromeBounds.OccupancyX, $monochromeBounds.OccupancyY)
Write-Host "Desktop ICO entries: 16, 24, 32, 48, 64, 128, 256"
