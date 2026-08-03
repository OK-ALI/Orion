$ErrorActionPreference = "Stop"

$desktopRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent (Split-Path -Parent $desktopRoot)
$generator = Join-Path $repoRoot "scripts/generate-platform-icons.ps1"

if (-not (Test-Path -LiteralPath $generator)) {
  throw "The shared Orion platform-icon generator was not found at $generator"
}

Write-Warning "This wrapper is retained for compatibility. The shared generator owns Desktop and Mobile icon assets."
& $generator
