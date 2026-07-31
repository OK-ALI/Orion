Add-Type -AssemblyName System.Drawing

$src = "C:\Users\aliwa\.gemini\antigravity-ide\brain\315f35be-f580-4d82-82c1-be24233d8435\media__1782215950214.png"
$root = Split-Path -Parent $PSScriptRoot
$public = Join-Path $root "public"
$sized = Join-Path $public "sized"

New-Item -ItemType Directory -Force -Path $sized | Out-Null

# Helper to resize image
function Resize-Image {
    param(
        [string]$sourcePath,
        [string]$targetPath,
        [int]$width,
        [int]$height
    )
    $srcBmp = New-Object System.Drawing.Bitmap $sourcePath
    $destBmp = New-Object System.Drawing.Bitmap $width, $height
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    $g.DrawImage($srcBmp, 0, 0, $width, $height)
    $g.Dispose()
    $srcBmp.Dispose()
    
    $destBmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
}

# Generate sized pngs
$sizes = @(16, 32, 48, 64, 128, 256, 512)
foreach ($size in $sizes) {
    $target = Join-Path $sized "$($size)x$($size).png"
    Resize-Image $src $target $size $size
}

# Generate public/icon.png and public/brand-mark.png (1024x1024)
Resize-Image $src (Join-Path $public "icon.png") 1024 1024
Resize-Image $src (Join-Path $public "brand-mark.png") 1024 1024

# Generate public/icon.ico
$icoBmp = New-Object System.Drawing.Bitmap 256, 256
$srcBmp = New-Object System.Drawing.Bitmap $src
$g = [System.Drawing.Graphics]::FromImage($icoBmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($srcBmp, 0, 0, 256, 256)
$g.Dispose()
$srcBmp.Dispose()

$icoPath = Join-Path $public "icon.ico"
$stream = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
$icon = [System.Drawing.Icon]::FromHandle($icoBmp.GetHicon())
$icon.Save($stream)
$stream.Close()
$icon.Dispose()
$icoBmp.Dispose()

Write-Output "Successfully updated all Orion app icons!"
