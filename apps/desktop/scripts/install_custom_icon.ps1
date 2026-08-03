param(
  [string]$Source
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$generator = Join-Path $repo "scripts/generate-platform-icons.ps1"

if ($Source) {
  & $generator -Source $Source
} else {
  & $generator
}
