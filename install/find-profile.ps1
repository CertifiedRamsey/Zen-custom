# Shared by install.ps1 and uninstall.ps1: works out which Zen profile to use.
function Find-ZenProfile {
  $zenDir = Join-Path $env:APPDATA "zen"
  $ini = Join-Path $zenDir "profiles.ini"
  if (-not (Test-Path $ini)) { throw "Couldn't find $ini. Is Zen installed and opened at least once?" }
  $lines = @([IO.File]::ReadAllLines($ini)) + "[end]"

  # Each [Install...] section names the profile one Zen install opens.
  $found = @()
  $inInstall = $false
  foreach ($l in $lines) {
    if ($l -match '^\[') { $inInstall = $l -match '^\[Install'; continue }
    if ($inInstall -and $l -match '^Default=(.+)$') { $found += $Matches[1].Trim() }
  }
  # Older files: the [Profile...] section marked Default=1.
  if ($found.Count -eq 0) {
    $isProfile = $false; $path = $null; $isDefault = $false
    foreach ($l in $lines) {
      if ($l -match '^\[') {
        if ($isProfile -and $isDefault -and $path) { $found += $path }
        $isProfile = $l -match '^\[Profile'; $path = $null; $isDefault = $false
        continue
      }
      if ($l -match '^Path=(.+)$') { $path = $Matches[1].Trim() }
      if ($l -match '^Default=1$') { $isDefault = $true }
    }
  }

  $sep = [IO.Path]::DirectorySeparatorChar
  $paths = @($found | ForEach-Object {
      if ([IO.Path]::IsPathRooted($_)) { $_ } else { Join-Path $zenDir ($_ -replace '/', $sep) }
    } | Select-Object -Unique | Where-Object { Test-Path $_ })
  if ($paths.Count -eq 0) { throw "Couldn't work out your Zen profile. Pass -ProfilePath." }

  # More than one (say, Zen and Zen Twilight): take the one opened last.
  if ($paths.Count -gt 1) {
    $paths = @($paths | Sort-Object -Descending {
        $p = Join-Path $_ "prefs.js"
        if (Test-Path $p) { (Get-Item $p).LastWriteTime } else { [datetime]::MinValue }
      })
    Write-Host "Found more than one Zen profile; using the one opened most recently."
    Write-Host "To pick another, run again with -ProfilePath and one of these:"
    $paths | ForEach-Object { Write-Host "  $_" }
  }
  return $paths[0]
}
