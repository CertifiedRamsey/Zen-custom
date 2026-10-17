# zen-custom installer for Windows (x64).
# Usage (from the repo folder, with Zen CLOSED):
#   powershell -ExecutionPolicy Bypass -File .\install\install.ps1
# Optional: -ProfilePath "C:\Users\you\AppData\Roaming\zen\Profiles\abc.Default (release)"
param([string]$ProfilePath)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot

if (Get-Process zen -ErrorAction SilentlyContinue) {
  Write-Host "Please close Zen first, then run this again." -ForegroundColor Yellow
  exit 1
}

function Find-ZenProfile {
  $zenDir = Join-Path $env:APPDATA "zen"
  $ini = Join-Path $zenDir "profiles.ini"
  if (-not (Test-Path $ini)) { throw "Couldn't find $ini. Is Zen installed and opened at least once?" }
  $lines = Get-Content $ini
  # The [Install...] section names the profile Zen actually opens.
  $default = $null; $inInstall = $false
  foreach ($l in $lines) {
    if ($l -match '^\[Install') { $inInstall = $true; continue }
    if ($l -match '^\[') { $inInstall = $false }
    if ($inInstall -and $l -match '^Default=(.+)$') { $default = $Matches[1]; break }
  }
  if (-not $default) {
    $section = $null; $path = $null
    foreach ($l in $lines) {
      if ($l -match '^\[') { $section = $l; $path = $null }
      if ($l -match '^Path=(.+)$') { $path = $Matches[1] }
      if ($l -match '^Default=1$' -and $section -match 'Profile') { $default = $path }
    }
  }
  if (-not $default) { throw "Couldn't work out your default Zen profile. Pass -ProfilePath." }
  if ([System.IO.Path]::IsPathRooted($default)) { return $default }
  return Join-Path $zenDir ($default -replace '/', '\')
}

if (-not $ProfilePath) { $ProfilePath = Find-ZenProfile }
Write-Host "Zen profile: $ProfilePath"

$chrome = Join-Path $ProfilePath "chrome"
New-Item -ItemType Directory -Force $chrome | Out-Null

# Back up anything we're about to touch.
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $ProfilePath "zen-custom-backup-$stamp"
New-Item -ItemType Directory -Force $backup | Out-Null
foreach ($f in "userChrome.css", "userContent.css", "zen-custom") {
  $p = Join-Path $chrome $f
  if (Test-Path $p) { Copy-Item $p $backup -Recurse -Force }
}
$uj = Join-Path $ProfilePath "user.js"
if (Test-Path $uj) { Copy-Item $uj $backup -Force }
Write-Host "Backup saved to $backup"

# Copy our modules into chrome\zen-custom (replaced on every install).
$dest = Join-Path $chrome "zen-custom"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
Copy-Item (Join-Path $repo "chrome\zen-custom") $dest -Recurse

# userChrome.css / userContent.css become one-line loaders for our code.
Set-Content (Join-Path $chrome "userChrome.css") '@import url("zen-custom/userChrome.css");' -Encoding UTF8
Set-Content (Join-Path $chrome "userContent.css") '@import url("zen-custom/userContent.css");' -Encoding UTF8

# JS features (need fx-autoconfig, which Sine installs).
$js = Get-ChildItem (Join-Path $repo "js") -Filter *.uc.js -ErrorAction SilentlyContinue
if ($js) {
  $jsDir = Join-Path $chrome "JS"
  New-Item -ItemType Directory -Force $jsDir | Out-Null
  $js | Copy-Item -Destination $jsDir -Force
}

# Merge our prefs into user.js without wiping anything else in it.
$ours = Get-Content (Join-Path $repo "user.js")
$existing = @()
if (Test-Path $uj) {
  $existing = Get-Content $uj | Where-Object { $_ -notmatch 'zen-custom' -and $_ -notmatch 'legacyUserProfileCustomizations' }
}
Set-Content $uj ($existing + $ours) -Encoding UTF8

Write-Host "Done. Open Zen to see the changes." -ForegroundColor Green
