param(
  [Parameter(Mandatory = $true)]
  [string]$Stage
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$map = Get-Content (Join-Path $root "config/orion-release-map-v1.json") -Raw | ConvertFrom-Json
$stagePath = [IO.Path]::GetFullPath($Stage)
$expectedWindowsSigner = "99b64a75f98bbe40ac9a435753c41b5159297df9870fb3fe7a927d2d50db6dc5"
$expectedAndroidSigner = "4422ec4bc16b1c83c914a0ad1b688be8f7c158ff7f99bcd223a909966ac7a1bd"

function Get-Sha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-CertificateSha256($Certificate) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = $sha.ComputeHash($Certificate.RawData)
    return ([BitConverter]::ToString($bytes) -replace "-", "").ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Assert-WindowsSignature([string]$Path) {
  $signature = Get-AuthenticodeSignature -LiteralPath $Path
  if ($signature.Status -ne "Valid" -or -not $signature.SignerCertificate) {
    throw "Windows artifact is not production signed: $([IO.Path]::GetFileName($Path))"
  }
  $fingerprint = Get-CertificateSha256 $signature.SignerCertificate
  if ($fingerprint -ne $expectedWindowsSigner) {
    throw "Windows signer does not match Orion's approved production identity."
  }
  return $fingerprint
}

function Find-AndroidTool([string]$Name) {
  foreach ($extension in @(".bat", ".exe")) {
    $command = Get-Command "$Name$extension" -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
  }
  $sdk = $env:ANDROID_SDK_ROOT
  if (-not $sdk) { $sdk = $env:ANDROID_HOME }
  if (-not $sdk) { throw "Android SDK is unavailable; cannot verify the accepted APK." }
  $candidate = Get-ChildItem (Join-Path $sdk "build-tools") -Directory |
    Sort-Object Name -Descending |
    ForEach-Object {
      foreach ($extension in @(".bat", ".exe")) {
        $tool = Join-Path $_.FullName "$Name$extension"
        if (Test-Path $tool) { $tool }
      }
    } |
    Select-Object -First 1
  if (-not $candidate) { throw "$Name is unavailable; cannot verify the accepted APK." }
  return $candidate
}

$installer = Join-Path $stagePath $map.artifacts.windowsInstaller
$archive = Join-Path $stagePath $map.artifacts.windowsArchive
$apk = Join-Path $stagePath $map.artifacts.androidInstaller
foreach ($file in @($installer, $archive, $apk)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    throw "Missing release artifact: $([IO.Path]::GetFileName($file))"
  }
}

$windowsSigner = Assert-WindowsSignature $installer
$installerVersion = [Diagnostics.FileVersionInfo]::GetVersionInfo($installer)
if ($installerVersion.ProductName -notmatch "Orion" -or $installerVersion.ProductVersion -notlike "$($map.desktopVersion)*") {
  throw "Windows installer product identity or version does not match the release map."
}

$zipFolder = Join-Path ([IO.Path]::GetTempPath()) ("orion-release-verify-" + [Guid]::NewGuid())
try {
  Expand-Archive -LiteralPath $archive -DestinationPath $zipFolder
  $executables = Get-ChildItem $zipFolder -Recurse -File -Filter *.exe
  if (-not $executables) { throw "Windows archive does not contain a signed Orion executable." }
  foreach ($executable in $executables) {
    [void](Assert-WindowsSignature $executable.FullName)
  }
} finally {
  if (Test-Path $zipFolder) { Remove-Item -LiteralPath $zipFolder -Recurse -Force }
}

$apksigner = Find-AndroidTool "apksigner"
$aapt = Find-AndroidTool "aapt"
$signerOutput = (& $apksigner verify --print-certs $apk 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0) { throw "The accepted APK signature could not be verified." }
$signerMatch = [regex]::Match($signerOutput, "certificate SHA-256 digest:\s*([0-9a-fA-F:]{64,})")
if (-not $signerMatch.Success) { throw "The accepted APK signer identity is unavailable." }
$androidSigner = ($signerMatch.Groups[1].Value -replace ":", "").ToLowerInvariant()
if ($androidSigner -ne $expectedAndroidSigner) { throw "Android signer does not match Orion's approved production identity." }

$badging = (& $aapt dump badging $apk 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0) { throw "The accepted APK package identity could not be read." }
$package = [regex]::Match($badging, "package:\s+name='([^']+)'\s+versionCode='([^']+)'\s+versionName='([^']+)'" )
if ((-not $package.Success) -or ($package.Groups[1].Value -ne "com.okali.orion") -or ([int]$package.Groups[2].Value -ne [int]$map.androidVersionCode) -or ($package.Groups[3].Value -ne $map.mobileVersion)) {
  throw "The accepted APK package, version, or build number does not match the release map."
}

$report = [ordered]@{
  schemaVersion = 1
  productVersion = $map.productVersion
  verifiedAt = (Get-Date).ToUniversalTime().ToString("o")
  artifacts = @(
    [ordered]@{ name = $map.artifacts.windowsInstaller; size = (Get-Item $installer).Length; sha256 = Get-Sha256 $installer; signerSha256 = $windowsSigner; productId = "com.orion.musicplanet"; buildNumber = $null },
    [ordered]@{ name = $map.artifacts.windowsArchive; size = (Get-Item $archive).Length; sha256 = Get-Sha256 $archive; signerSha256 = $windowsSigner; productId = "com.orion.musicplanet"; buildNumber = $null },
    [ordered]@{ name = $map.artifacts.androidInstaller; size = (Get-Item $apk).Length; sha256 = Get-Sha256 $apk; signerSha256 = $androidSigner; productId = "com.okali.orion"; buildNumber = [int]$map.androidVersionCode }
  )
}
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $stagePath "orion-artifact-verification.json") -Encoding UTF8
Write-Host "Verified Orion $($map.productVersion) immutable release artifacts."
