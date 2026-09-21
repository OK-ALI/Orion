param(
  [string]$AcceptedMobileApkPath = "",
  [string]$ReleaseMetadataPrivateKeyPath = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$expectedCertificateSha1 = "563AE69B35B819BBC845A37D850241D19EE6B6C5"
$expectedWindowsSignerSha256 = "99b64a75f98bbe40ac9a435753c41b5159297df9870fb3fe7a927d2d50db6dc5"
$expectedMobileSha256 = "d3a32160c3767c95d6e2d89a854b3e74153a974d47a549c8cdc07efe806ac6d8"

function Invoke-Checked([string]$Command, [string[]]$Arguments) {
  Write-Host ""
  Write-Host ("> " + $Command + " " + ($Arguments -join " "))
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command failed with exit code $LASTEXITCODE."
  }
}

function Get-CertificateSha256($Certificate) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = $sha.ComputeHash($Certificate.RawData)
    return (([BitConverter]::ToString($bytes)) -replace "-", "").ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $utf8 = New-Object System.Text.UTF8Encoding -ArgumentList $false
  [IO.File]::WriteAllText($Path, $Content, $utf8)
}

$map = Get-Content (Join-Path $root "config/orion-release-map-v1.json") -Raw | ConvertFrom-Json
$version = [string]$map.productVersion
$stage = Join-Path $root "release/publish-$version"
$desktopRelease = Join-Path $root "apps/desktop/release"

if (-not $AcceptedMobileApkPath) {
  $AcceptedMobileApkPath = Join-Path $root "apps/mobile/android/app/build/outputs/apk/distribution/orion-mobile-v$version.apk"
}
if (-not $ReleaseMetadataPrivateKeyPath) {
  $ReleaseMetadataPrivateKeyPath = Join-Path $HOME ".orion/signing/orion-release-ed25519-private.pem"
}

Write-Host "============================================================"
Write-Host " ORION $version - LOCAL PROTECTED RELEASE PREPARATION"
Write-Host "============================================================"
Write-Host ""
Write-Host "This process signs only on this Windows account."
Write-Host "It does not register or contact a self-hosted GitHub runner."
Write-Host ""

Invoke-Checked "git.exe" @("rev-parse", "--is-inside-work-tree")
$dirty = @(& git.exe status --porcelain --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw "Unable to inspect the Git working tree." }
if ($dirty.Count -gt 0) {
  Write-Host ""
  Write-Host "The release tree is not clean:" -ForegroundColor Yellow
  $dirty | ForEach-Object { Write-Host $_ }
  throw "Commit or intentionally discard the changes before producing immutable release bytes."
}
$sourceCommit = (& git.exe rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $sourceCommit -notmatch "^[0-9a-fA-F]{40}$") {
  throw "Unable to resolve the source commit for this release."
}

$certificate = Get-ChildItem Cert:\CurrentUser\My |
  Where-Object { $_.Thumbprint -eq $expectedCertificateSha1 } |
  Select-Object -First 1
if (-not $certificate) {
  throw "Orion's approved Windows signing certificate is missing from CurrentUser\\My."
}
if (-not $certificate.HasPrivateKey) {
  throw "Orion's approved Windows signing certificate does not have its private key on this account."
}
if ($certificate.Subject -ne $certificate.Issuer) {
  throw "The configured Orion release certificate is no longer the approved self-signed identity."
}
if ((Get-CertificateSha256 $certificate) -ne $expectedWindowsSignerSha256) {
  throw "The Windows signing certificate fingerprint does not match Orion's pinned production identity."
}
if ((Get-Date) -lt $certificate.NotBefore -or (Get-Date) -gt $certificate.NotAfter) {
  throw "The Windows signing certificate is outside its validity period."
}
$ekuExtension = $certificate.Extensions |
  Where-Object { $_.Oid.Value -eq "2.5.29.37" } |
  Select-Object -First 1
$eku = @()
if ($ekuExtension) {
  $parsedEku = New-Object `
    System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension `
    $ekuExtension, $ekuExtension.Critical
  $eku = @($parsedEku.EnhancedKeyUsages | ForEach-Object { $_.Value })
}
if ($eku.Count -gt 0 -and -not ($eku -contains "1.3.6.1.5.5.7.3.3")) {
  throw "The Windows signing certificate is not valid for code signing."
}
$trusted = Get-ChildItem Cert:\CurrentUser\Root |
  Where-Object { $_.Thumbprint -eq $expectedCertificateSha1 } |
  Select-Object -First 1
if (-not $trusted) {
  throw "This release account does not locally trust the approved Orion certificate. Release verification would not be deterministic."
}

if (-not (Test-Path -LiteralPath $ReleaseMetadataPrivateKeyPath -PathType Leaf)) {
  throw "The protected Ed25519 release metadata key is unavailable at the configured local path."
}
if (-not (Test-Path -LiteralPath $AcceptedMobileApkPath -PathType Leaf)) {
  throw "The already accepted signed Mobile APK is missing: $AcceptedMobileApkPath"
}
$mobileHash = (Get-FileHash -LiteralPath $AcceptedMobileApkPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($mobileHash -ne $expectedMobileSha256) {
  throw "The Mobile APK is not the already accepted Orion $version artifact. It will not be rebuilt or substituted."
}

Invoke-Checked "npm.cmd" @("ci")
Invoke-Checked "npm.cmd" @("run", "release:check-map")
Invoke-Checked "npm.cmd" @("run", "check", "--workspace", "@orion/desktop")
Invoke-Checked "npm.cmd" @("run", "test:electron", "--workspace", "@orion/desktop")

Remove-Item -LiteralPath $desktopRelease -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $stage | Out-Null

Invoke-Checked "npm.cmd" @("run", "dist:win", "--workspace", "@orion/desktop")

$installerSource = Join-Path $desktopRelease $map.artifacts.windowsInstaller
$archiveSource = Join-Path $desktopRelease $map.artifacts.windowsArchive
foreach ($file in @($installerSource, $archiveSource)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    throw "Expected Desktop release artifact is missing: $file"
  }
}
Copy-Item -LiteralPath $installerSource -Destination (Join-Path $stage $map.artifacts.windowsInstaller) -Force
Copy-Item -LiteralPath $archiveSource -Destination (Join-Path $stage $map.artifacts.windowsArchive) -Force
Copy-Item -LiteralPath $AcceptedMobileApkPath -Destination (Join-Path $stage $map.artifacts.androidInstaller) -Force

& (Join-Path $PSScriptRoot "verify-release-artifacts.ps1") -Stage $stage
if ($LASTEXITCODE -ne 0) { throw "Release artifact verification failed." }

$previousKey = $env:ORION_RELEASE_ED25519_PRIVATE_KEY
try {
  $env:ORION_RELEASE_ED25519_PRIVATE_KEY = $ReleaseMetadataPrivateKeyPath
  Invoke-Checked "npm.cmd" @("run", "release:manifests", "--", $stage)
  Invoke-Checked "npm.cmd" @("run", "release:provider-status", "--", $stage)
} finally {
  $env:ORION_RELEASE_ED25519_PRIVATE_KEY = $previousKey
}
Invoke-Checked "node.exe" @((Join-Path $PSScriptRoot "verify-release-bundle.cjs"), $stage)

$verification = Get-Content (Join-Path $stage "orion-artifact-verification.json") -Raw | ConvertFrom-Json
$candidateEvidence = [ordered]@{
  schemaVersion = 1
  version = $version
  sourceCommit = $sourceCommit
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  artifacts = $verification.artifacts
}
Write-Utf8NoBom (Join-Path $stage "orion-local-candidate-evidence.json") (($candidateEvidence | ConvertTo-Json -Depth 8) + "`n")

Write-Host ""
Write-Host "============================================================"
Write-Host " IMMUTABLE LOCAL CANDIDATE READY"
Write-Host "============================================================"
Write-Host "Stage: $stage"
Write-Host "Source commit: $sourceCommit"
Write-Host ""
$verification.artifacts | ForEach-Object {
  Write-Host ("{0}`n  SHA-256: {1}`n  Signer:  {2}" -f $_.name, $_.sha256, $_.signerSha256)
}
Write-Host ""
Write-Host "Nothing has been published. The next step is the local private-draft script."
