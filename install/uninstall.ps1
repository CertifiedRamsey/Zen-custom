# Removes zen-custom from your Zen profile. Your backups stay where they are.
param([string]$ProfilePath)
$ErrorActionPreference = "Stop"
if (-not $ProfilePath) { throw "Pass -ProfilePath (printed by install.ps1)." }
$chrome = Join-Path $ProfilePath "chrome"
Remove-Item (Join-Path $chrome "zen-custom") -Recurse -Force -ErrorAction SilentlyContinue
foreach ($f in "userChrome.css", "userContent.css") {
  $p = Join-Path $chrome $f
  if ((Test-Path $p) -and ((Get-Content $p -Raw) -match 'zen-custom/')) { Remove-Item $p }
}
$uj = Join-Path $ProfilePath "user.js"
if (Test-Path $uj) { Set-Content $uj (Get-Content $uj | Where-Object { $_ -notmatch 'zen-custom' }) }
Write-Host "zen-custom removed. Restore a backup folder if you want your old files back."
