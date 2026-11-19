# The "zen" command that zen-custom's installer adds to PowerShell (and cmd).
#   zen ss    fake coding screensaver; Ctrl+T ends it
#   zen       lists these
param([string]$Command)

switch ($Command) {
  "ss" { & (Join-Path $PSScriptRoot "screensaver.ps1") }
  default {
    Write-Host "zen-custom commands:"
    Write-Host "  zen ss    fake coding screensaver (Ctrl+T ends it)"
  }
}
