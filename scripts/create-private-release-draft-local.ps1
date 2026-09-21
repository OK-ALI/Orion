param(
  [string]$Stage = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Invoke-Checked([string]$Command, [string[]]$Arguments) {
  Write-Host ""
  Write-Host ("> " + $Command + " " + ($Arguments -join " "))
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command failed with exit code $LASTEXITCODE."
  }
}

$map = Get-Content (Join-Path $root "config/orion-release-map-v1.json") -Raw | ConvertFrom-Json
$version = [string]$map.productVersion
$tag = [string]$map.gitTag
if (-not $Stage) { $Stage = Join-Path $root "release/publish-$version" }
$Stage = [IO.Path]::GetFullPath($Stage)

Write-Host "============================================================"
Write-Host " ORION $version - CREATE PRIVATE GITHUB DRAFT"
Write-Host "============================================================"
Write-Host ""
Write-Host "This uploads the already signed immutable local candidate."
Write-Host "It does not build, sign, or register a GitHub self-hosted runner."
Write-Host ""

if (-not (Get-Command gh.exe -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh.exe) is required to create the private draft."
}
Invoke-Checked "gh.exe" @("auth", "status")
Invoke-Checked "node.exe" @((Join-Path $PSScriptRoot "verify-release-bundle.cjs"), $Stage)

$evidencePath = Join-Path $Stage "orion-local-candidate-evidence.json"
if (-not (Test-Path -LiteralPath $evidencePath -PathType Leaf)) {
  throw "Local candidate evidence is missing. Run prepare-protected-release-local.ps1 first."
}
$evidence = Get-Content $evidencePath -Raw | ConvertFrom-Json
if ([string]$evidence.version -ne $version -or [string]$evidence.sourceCommit -notmatch "^[0-9a-fA-F]{40}$") {
  throw "Local candidate evidence does not identify Orion $version and its exact source commit."
}
$sourceCommit = [string]$evidence.sourceCommit
$currentCommit = (& git.exe rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $currentCommit -ne $sourceCommit) {
  throw "Current HEAD is not the exact source commit that produced this immutable candidate."
}
$dirty = @(& git.exe status --porcelain --untracked-files=all)
if ($LASTEXITCODE -ne 0) { throw "Unable to inspect the Git working tree." }
if ($dirty.Count -gt 0) {
  throw "The Git working tree changed after the immutable candidate was built. Refusing to stage a draft."
}

& gh.exe api "repos/OK-ALI/Orion/commits/$sourceCommit" --silent
if ($LASTEXITCODE -ne 0) {
  throw "The candidate source commit is not available on GitHub. Push the exact checkpoint before creating the draft."
}

& gh.exe release view $tag --repo "OK-ALI/Orion" *> $null
if ($LASTEXITCODE -eq 0) {
  throw "Release $tag already exists. Refusing to replace or mutate existing release assets."
}

$notes = Join-Path $root ".github/release-notes-3.2.0.md"
$assets = @(
  (Join-Path $Stage $map.artifacts.windowsInstaller),
  (Join-Path $Stage $map.artifacts.windowsArchive),
  (Join-Path $Stage $map.artifacts.androidInstaller),
  (Join-Path $Stage $map.artifacts.integrityV1),
  (Join-Path $Stage $map.artifacts.integrityV2),
  (Join-Path $Stage $map.artifacts.providerStatusV1)
)
foreach ($asset in $assets) {
  if (-not (Test-Path -LiteralPath $asset -PathType Leaf)) {
    throw "Release asset is missing: $asset"
  }
}

$arguments = @("release", "create", $tag)
$arguments += $assets
$arguments += @(
  "--repo", "OK-ALI/Orion",
  "--target", $sourceCommit,
  "--title", "Orion $version",
  "--notes-file", $notes,
  "--draft"
)
Invoke-Checked "gh.exe" $arguments

$details = & gh.exe release view $tag --repo "OK-ALI/Orion" --json isDraft,isPrerelease,tagName,targetCommitish,url
if ($LASTEXITCODE -ne 0) { throw "The private draft was created but could not be re-read for verification." }
Write-Host ""
Write-Host $details
Write-Host ""
Write-Host "Private draft staged. Nothing is public yet."
Write-Host "Physically validate these exact bytes before using the Preview approval workflow."
