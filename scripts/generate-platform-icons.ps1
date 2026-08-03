param(
  [string]$Source
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$repo = Split-Path -Parent $PSScriptRoot
$desktopPublic = Join-Path $repo "apps/desktop/public"
$mobileAssets = Join-Path $repo "apps/mobile/assets"
$androidRes = Join-Path $repo "apps/mobile/android/app/src/main/res"
$defaultSource = Join-Path $repo "assets/branding/orion-pop-master.png"
$sourcePath = if ($Source) { (Resolve-Path -LiteralPath $Source).Path } else { $defaultSource }

if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "Orion Pop master is missing: $sourcePath"
}

$colors = @{
  Obsidian = [System.Drawing.Color]::FromArgb(255, 7, 7, 12)
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
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
}

function Draw-MasterTile(
  [System.Drawing.Graphics]$graphics,
  [System.Drawing.Bitmap]$master,
  [int]$size,
  [double]$marginRatio,
  [ValidateSet("rounded", "circle", "square")]
  [string]$shape = "rounded"
) {
  $margin = [single]($size * $marginRatio)
  $side = [single]($size - (2 * $margin))
  $rect = [System.Drawing.RectangleF]::new($margin, $margin, $side, $side)
  $state = $graphics.Save()
  try {
    if ($shape -eq "circle") {
      $clip = [System.Drawing.Drawing2D.GraphicsPath]::new()
      try {
        $clip.AddEllipse($rect)
        $graphics.SetClip($clip)
        $graphics.DrawImage($master, $rect)
      } finally { $clip.Dispose() }
      return
    }

    if ($shape -eq "rounded") {
      $clip = New-RoundedRectanglePath $rect ([single]($side * 0.205))
      try {
        $graphics.SetClip($clip)
        $graphics.DrawImage($master, $rect)
      } finally { $clip.Dispose() }
      return
    }

    $graphics.DrawImage($master, $rect)
  } finally {
    $graphics.Restore($state)
  }
}

function Draw-PopcornGlyph(
  [System.Drawing.Graphics]$graphics,
  [System.Drawing.Bitmap]$master,
  [int]$size,
  [double]$heightRatio
) {
  # The crop deliberately excludes the master tile's outer red hairline. It keeps
  # the central O and popcorn at their original proportions for adaptive masks,
  # splash screens and compact in-app brand marks.
  $sourceX = [int][Math]::Round($master.Width * 0.125)
  $sourceY = [int][Math]::Round($master.Height * 0.095)
  $sourceWidth = [int][Math]::Round($master.Width * 0.75)
  $sourceHeight = [int][Math]::Round($master.Height * 0.815)
  $destinationHeight = [single]($size * $heightRatio)
  $destinationWidth = [single]($destinationHeight * ($sourceWidth / $sourceHeight))
  $destination = [System.Drawing.Rectangle]::new(
    [int][Math]::Round(($size - $destinationWidth) / 2),
    [int][Math]::Round(($size - $destinationHeight) / 2),
    [int][Math]::Round($destinationWidth),
    [int][Math]::Round($destinationHeight)
  )

  $attributes = [System.Drawing.Imaging.ImageAttributes]::new()
  try {
    # Remove only the near-black field. Red portal, cream popcorn and bucket
    # shading remain lossless and retain the source artwork's anti-aliasing.
    $attributes.SetColorKey(
      [System.Drawing.Color]::FromArgb(0, 0, 0),
      [System.Drawing.Color]::FromArgb(48, 48, 56)
    )
    $graphics.DrawImage(
      $master,
      $destination,
      $sourceX,
      $sourceY,
      $sourceWidth,
      $sourceHeight,
      [System.Drawing.GraphicsUnit]::Pixel,
      $attributes
    )
  } finally { $attributes.Dispose() }

}

function Convert-ToMonochrome([System.Drawing.Bitmap]$bitmap) {
  for ($y = 0; $y -lt $bitmap.Height; $y++) {
    for ($x = 0; $x -lt $bitmap.Width; $x++) {
      $pixel = $bitmap.GetPixel($x, $y)
      if ($pixel.A -eq 0) { continue }
      $brightness = [Math]::Max($pixel.R, [Math]::Max($pixel.G, $pixel.B))
      $alpha = [Math]::Min(255, [Math]::Max($pixel.A, $brightness))
      $bitmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
    }
  }
}

function New-OrionIcon(
  [System.Drawing.Bitmap]$master,
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
      "desktop" { Draw-MasterTile $graphics $master $size 0.035 "rounded" }
      "mobile" {
        $graphics.Clear($colors.Obsidian)
        Draw-MasterTile $graphics $master $size 0.0 "square"
      }
      "round" {
        $graphics.Clear($colors.Obsidian)
        Draw-PopcornGlyph $graphics $master $size 0.69
      }
      "adaptive" { Draw-PopcornGlyph $graphics $master $size 0.66 }
      "monochrome" { Draw-PopcornGlyph $graphics $master $size 0.66 }
      "splash" { Draw-PopcornGlyph $graphics $master $size 0.56 }
      "brand" { Draw-PopcornGlyph $graphics $master $size 0.82 }
      "favicon" {
        $graphics.Clear($colors.Obsidian)
        Draw-MasterTile $graphics $master $size 0.02 "rounded"
      }
      "background" { $graphics.Clear($colors.Obsidian) }
    }
  } finally { $graphics.Dispose() }

  if ($mode -eq "monochrome") { Convert-ToMonochrome $bitmap }
  return $bitmap
}

function Save-OrionPng(
  [System.Drawing.Bitmap]$master,
  [int]$size,
  [string]$mode,
  [string]$path
) {
  $directory = Split-Path -Parent $path
  if ($directory) { [System.IO.Directory]::CreateDirectory($directory) | Out-Null }
  $bitmap = New-OrionIcon $master $size $mode
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

function Get-CornerAlpha([string]$path) {
  $bitmap = [System.Drawing.Bitmap]::FromFile($path)
  try { return $bitmap.GetPixel(0, 0).A } finally { $bitmap.Dispose() }
}

$master = [System.Drawing.Bitmap]::FromFile($sourcePath)
try {
  if ($master.Width -ne $master.Height -or $master.Width -lt 1024) {
    throw "Orion Pop master must be square and at least 1024px; received $($master.Width)x$($master.Height)."
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
    Save-OrionPng $master $size "desktop" $path
    if ($size -le 256) { $desktopPngs += $path }
  }
  Save-PngIco $desktopPngs @($desktopSizes | Where-Object { $_ -le 256 }) (Join-Path $desktopPublic "icon.ico")
  Save-OrionPng $master 1024 "brand" (Join-Path $desktopPublic "brand-mark.png")

  Save-OrionPng $master 1024 "mobile" (Join-Path $mobileAssets "icon.png")
  Save-OrionPng $master 1024 "brand" (Join-Path $mobileAssets "brand-mark.png")
  Save-OrionPng $master 1024 "adaptive" (Join-Path $mobileAssets "android-icon-foreground.png")
  Save-OrionPng $master 512 "background" (Join-Path $mobileAssets "android-icon-background.png")
  Save-OrionPng $master 432 "monochrome" (Join-Path $mobileAssets "android-icon-monochrome.png")
  Save-OrionPng $master 1024 "splash" (Join-Path $mobileAssets "splash-icon.png")
  Save-OrionPng $master 48 "favicon" (Join-Path $mobileAssets "favicon.png")

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
    Save-OrionPng $master $densitySizes[$density].legacy "mobile" (Join-Path $mipmap "ic_launcher.png")
    Save-OrionPng $master $densitySizes[$density].legacy "round" (Join-Path $mipmap "ic_launcher_round.png")
    Save-OrionPng $master $densitySizes[$density].foreground "adaptive" (Join-Path $mipmap "ic_launcher_foreground.png")
    Save-OrionPng $master $densitySizes[$density].splash "splash" (Join-Path $androidRes "drawable-$density/splashscreen_logo.png")
  }
} finally { $master.Dispose() }

$desktopBounds = Get-AlphaBounds (Join-Path $desktopPublic "icon.png")
$adaptiveBounds = Get-AlphaBounds (Join-Path $mobileAssets "android-icon-foreground.png")
$monochromeBounds = Get-AlphaBounds (Join-Path $mobileAssets "android-icon-monochrome.png")
$desktopCornerAlpha = Get-CornerAlpha (Join-Path $desktopPublic "icon.png")
$mobileCornerAlpha = Get-CornerAlpha (Join-Path $mobileAssets "icon.png")
$adaptiveCornerAlpha = Get-CornerAlpha (Join-Path $mobileAssets "android-icon-foreground.png")
Assert-Range $desktopBounds.OccupancyX 0.92 0.94 "Desktop tile horizontal occupancy"
Assert-Range $desktopBounds.OccupancyY 0.92 0.94 "Desktop tile vertical occupancy"
Assert-Range $adaptiveBounds.OccupancyX 0.54 0.64 "Android adaptive horizontal occupancy"
Assert-Range $adaptiveBounds.OccupancyY 0.63 0.68 "Android adaptive vertical occupancy"
Assert-Range $monochromeBounds.OccupancyX 0.54 0.64 "Android monochrome horizontal occupancy"
Assert-Range $monochromeBounds.OccupancyY 0.63 0.68 "Android monochrome vertical occupancy"
if ($desktopCornerAlpha -ne 0) { throw "Desktop icon must retain transparent rounded corners." }
if ($mobileCornerAlpha -ne 255) { throw "Mobile legacy icon must remain fully opaque." }
if ($adaptiveCornerAlpha -ne 0) { throw "Android adaptive foreground must not contain an opaque outer tile." }

$icoStream = [System.IO.File]::OpenRead((Join-Path $desktopPublic "icon.ico"))
$icoReader = [System.IO.BinaryReader]::new($icoStream)
try {
  $reserved = $icoReader.ReadUInt16()
  $type = $icoReader.ReadUInt16()
  $count = $icoReader.ReadUInt16()
  if ($reserved -ne 0 -or $type -ne 1 -or $count -ne 7) {
    throw "Desktop ICO directory is invalid or missing required resolutions."
  }
  $expectedIcoSizes = @(16, 24, 32, 48, 64, 128, 256)
  $decodedIcoSizes = @()
  for ($index = 0; $index -lt $count; $index++) {
    $width = $icoReader.ReadByte()
    $height = $icoReader.ReadByte()
    $icoReader.BaseStream.Seek(14, [System.IO.SeekOrigin]::Current) | Out-Null
    $decodedIcoSizes += $(if ($width -eq 0 -and $height -eq 0) { 256 } else { [int]$width })
  }
  if (($decodedIcoSizes -join ",") -ne ($expectedIcoSizes -join ",")) {
    throw "Desktop ICO sizes are invalid: $($decodedIcoSizes -join ', ')."
  }
} finally {
  $icoReader.Dispose()
  $icoStream.Dispose()
}

Write-Host "Generated the Orion Pop icon family from $sourcePath."
Write-Host ("Desktop tile occupancy: {0:P1} x {1:P1}" -f $desktopBounds.OccupancyX, $desktopBounds.OccupancyY)
Write-Host ("Android adaptive occupancy: {0:P1} x {1:P1}" -f $adaptiveBounds.OccupancyX, $adaptiveBounds.OccupancyY)
Write-Host ("Android monochrome occupancy: {0:P1} x {1:P1}" -f $monochromeBounds.OccupancyX, $monochromeBounds.OccupancyY)
Write-Host "Desktop ICO entries: 16, 24, 32, 48, 64, 128, 256"
