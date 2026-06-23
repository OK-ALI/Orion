Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$public = Join-Path $root "public"
$sized = Join-Path $public "sized"
New-Item -ItemType Directory -Force -Path $sized | Out-Null

function New-OrionIconBitmap {
  param([int]$Size)

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::Transparent)

  $scale = $Size / 1024.0
  function S([double]$v) { return [single]($v * $scale) }

  $rect = New-Object System.Drawing.RectangleF (S 56), (S 56), (S 912), (S 912)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $radius = S 176
  $diam = $radius * 2
  $path.AddArc($rect.X, $rect.Y, $diam, $diam, 180, 90)
  $path.AddArc($rect.Right - $diam, $rect.Y, $diam, $diam, 270, 90)
  $path.AddArc($rect.Right - $diam, $rect.Bottom - $diam, $diam, $diam, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $diam, $diam, $diam, 90, 90)
  $path.CloseFigure()

  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 6, 6, 12)), ([System.Drawing.Color]::FromArgb(255, 18, 8, 14)), 45
  $g.FillPath($bgBrush, $path)

  for ($i = 0; $i -lt 16; $i++) {
    $alpha = [Math]::Max(0, 42 - ($i * 2))
    $pad = S (84 + ($i * 18))
    $glowRect = New-Object System.Drawing.RectangleF $pad, $pad, ($Size - 2 * $pad), ($Size - 2 * $pad)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alpha, 229, 9, 20))
    $g.FillEllipse($brush, $glowRect)
    $brush.Dispose()
  }

  $oldTransform = $g.Transform.Clone()
  $g.TranslateTransform((S 512), (S 512))
  $g.RotateTransform(-17)
  $orbitRect = New-Object System.Drawing.RectangleF (S -318), (S -254), (S 636), (S 508)
  $orbitPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 245, 22, 36)), (S 60)
  $orbitPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $orbitPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawEllipse($orbitPen, $orbitRect)
  $rimPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(210, 255, 147, 154)), (S 8)
  $g.DrawEllipse($rimPen, $orbitRect)
  $g.Transform = $oldTransform

  $voidBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 3, 3, 7))
  $g.FillEllipse($voidBrush, (S 302), (S 288), (S 420), (S 448))

  $innerPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(230, 255, 62, 76)), (S 10)
  $g.DrawEllipse($innerPen, (S 302), (S 288), (S 420), (S 448))

  $tri = New-Object System.Drawing.Drawing2D.GraphicsPath
  $tri.AddPolygon(@(
    (New-Object System.Drawing.PointF (S 472), (S 408)),
    (New-Object System.Drawing.PointF (S 472), (S 616)),
    (New-Object System.Drawing.PointF (S 638), (S 512))
  ))
  $triBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 39, 52))
  $g.FillPath($triBrush, $tri)

  $starBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 242, 230))
  $g.FillEllipse($starBrush, (S 744), (S 238), (S 68), (S 68))
  $starPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 255, 39, 52)), (S 8)
  $g.DrawEllipse($starPen, (S 732), (S 226), (S 92), (S 92))

  $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(70, 255, 255, 255)), (S 2)
  $g.DrawPath($borderPen, $path)

  $g.Dispose()
  return $bmp
}

function New-OrionBrandMarkBitmap {
  param([int]$Size)

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::Transparent)

  $scale = $Size / 1024.0
  function S([double]$v) { return [single]($v * $scale) }

  for ($i = 0; $i -lt 10; $i++) {
    $alpha = [Math]::Max(0, 42 - ($i * 4))
    $pad = S (250 + ($i * 15))
    $glowRect = New-Object System.Drawing.RectangleF $pad, $pad, ($Size - 2 * $pad), ($Size - 2 * $pad)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alpha, 229, 9, 20))
    $g.FillEllipse($brush, $glowRect)
    $brush.Dispose()
  }

  $oldTransform = $g.Transform.Clone()
  $g.TranslateTransform((S 512), (S 512))
  $g.RotateTransform(-17)
  $orbitRect = New-Object System.Drawing.RectangleF (S -318), (S -254), (S 636), (S 508)
  $orbitPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 245, 22, 36)), (S 72)
  $orbitPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $orbitPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawEllipse($orbitPen, $orbitRect)
  $rimPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(230, 255, 160, 166)), (S 9)
  $g.DrawEllipse($rimPen, $orbitRect)
  $g.Transform = $oldTransform

  $innerPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(235, 255, 62, 76)), (S 13)
  $g.DrawEllipse($innerPen, (S 310), (S 296), (S 404), (S 432))

  $tri = New-Object System.Drawing.Drawing2D.GraphicsPath
  $tri.AddPolygon(@(
    (New-Object System.Drawing.PointF (S 472), (S 408)),
    (New-Object System.Drawing.PointF (S 472), (S 616)),
    (New-Object System.Drawing.PointF (S 638), (S 512))
  ))
  $triBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 39, 52))
  $g.FillPath($triBrush, $tri)

  $starBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 242, 230))
  $g.FillEllipse($starBrush, (S 744), (S 238), (S 68), (S 68))
  $starPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(230, 255, 39, 52)), (S 8)
  $g.DrawEllipse($starPen, (S 732), (S 226), (S 92), (S 92))

  $g.Dispose()
  return $bmp
}

$sizes = @(16, 32, 48, 64, 128, 256, 512, 1024)
foreach ($size in $sizes) {
  $bmp = New-OrionBrandMarkBitmap -Size $size
  $target = if ($size -eq 1024) { Join-Path $public "icon.png" } else { Join-Path $sized "$($size)x$($size).png" }
  $bmp.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

$brandBmp = New-OrionBrandMarkBitmap -Size 1024
$brandBmp.Save((Join-Path $public "brand-mark.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$brandBmp.Dispose()

$icoBmp = New-OrionBrandMarkBitmap -Size 256
$icoPath = Join-Path $public "icon.ico"
$stream = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
$icon = [System.Drawing.Icon]::FromHandle($icoBmp.GetHicon())
$icon.Save($stream)
$stream.Close()
$icon.Dispose()
$icoBmp.Dispose()

Write-Output "Generated Orion icon assets in $public"
