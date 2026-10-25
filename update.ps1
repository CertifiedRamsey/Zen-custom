# zen-custom updater for a PC that already has it (the home PC).
# Paste this into PowerShell:
#   irm https://raw.githubusercontent.com/CertifiedRamsey/Zen-custom/main/update.ps1 | iex
#
# It downloads the latest zen-custom from GitHub straight into your zen-custom
# folder (no zip in Downloads, no "-main" folder), closes Zen, runs the
# installer, clears Zen's startup cache and opens Zen again.
# Your folder: Documents\zen-custom. To use another one first run:
#   $env:ZC_DIR = "D:\somewhere\zen-custom"
# To try another branch: $env:ZC_BRANCH = "some-branch"
# On the work PC, run bootstrap.ps1 again instead.

function Invoke-ZenCustomUpdate {
  if ($ExecutionContext.SessionState.LanguageMode -ne "FullLanguage") {
    throw "This PC runs PowerShell in a locked-down mode ($($ExecutionContext.SessionState.LanguageMode)), so the update can't run here."
  }
  $ErrorActionPreference = "Stop"
  $ProgressPreference = "SilentlyContinue"   # Windows PowerShell downloads crawl with the progress bar on
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $mySession = (Get-Process -Id $PID).SessionId

  $repoName = "CertifiedRamsey/Zen-custom"
  $branch = if ($env:ZC_BRANCH) { $env:ZC_BRANCH } else { "main" }

  function Step([string]$text) { Write-Host ""; Write-Host "== $text" -ForegroundColor Cyan }
  function Note([string]$text) { Write-Host "   $text" }

  # Which folder to update: ZC_DIR, else the first zen-custom folder that has
  # the installer in it, else a new one in Documents.
  $docs = [Environment]::GetFolderPath("MyDocuments")
  $candidates = @()
  if ($env:ZC_DIR) { $candidates += $env:ZC_DIR }
  $candidates += (Join-Path $env:USERPROFILE "Documents\zen-custom"), (Join-Path $docs "zen-custom")
  $target = $null
  foreach ($c in $candidates) {
    if (Test-Path (Join-Path $c "install\install.ps1")) { $target = $c; break }
  }
  if (-not $target) { $target = $candidates[0] }
  $target = [IO.Path]::GetFullPath($target)

  $work = Join-Path $env:TEMP ("zen-custom-update-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  New-Item -ItemType Directory -Force $work | Out-Null
  Push-Location $env:TEMP   # so the folder we replace isn't the one PowerShell is in
  try {
    Step "Downloading the latest zen-custom ($branch)"
    $zip = Join-Path $work "zen-custom.zip"
    for ($try = 1; $try -le 3; $try++) {
      try { Invoke-WebRequest -Uri "https://codeload.github.com/$repoName/zip/refs/heads/$branch" -OutFile $zip -UseBasicParsing; break }
      catch {
        if ($try -eq 3) { throw "Couldn't download zen-custom from GitHub ($($_.Exception.Message))" }
        Start-Sleep -Seconds (2 * $try)
      }
    }
    $unzipped = Join-Path $work "unzipped"
    [IO.Compression.ZipFile]::ExtractToDirectory($zip, $unzipped)
    # GitHub's zip holds one folder named like Zen-custom-main; use what's inside it
    $src = @(Get-ChildItem $unzipped -Directory)
    if ($src.Count -ne 1 -or -not (Test-Path (Join-Path $src[0].FullName "install\install.ps1"))) {
      throw "The download doesn't look like zen-custom, so nothing was changed."
    }
    $src = $src[0].FullName

    Step "Closing Zen"
    $zenExe = $null
    $zen = @(Get-Process zen -ErrorAction SilentlyContinue | Where-Object { $_.SessionId -eq $mySession })
    if ($zen.Count) {
      $zenExe = ($zen | Where-Object { $_.Path } | Select-Object -First 1).Path
      # Zen saves your open tabs every few seconds and brings them back after
      # this. (Closing its windows one by one would lose all but the last.)
      $zen | Stop-Process -Force
      Start-Sleep -Seconds 2
      Note "Closed."
    } else {
      Note "Zen wasn't open."
    }

    Step "Updating $target"
    if (Test-Path (Join-Path $target ".git")) {
      # a git clone: let git update it rather than copying over its files
      if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "$target is a git clone but git isn't installed. Run 'git pull' there yourself." }
      git -C $target pull --ff-only
      if ($LASTEXITCODE -ne 0) { throw "git pull didn't work in $target (see above), so nothing was installed." }
    } else {
      if ((Test-Path $target) -and @(Get-ChildItem $target -Force).Count -and -not (Test-Path (Join-Path $target "install\install.ps1"))) {
        throw "$target has files in it but isn't a zen-custom folder, so nothing was changed. Set `$env:ZC_DIR to your zen-custom folder and run this again."
      }
      if (Test-Path $target) {
        # keep the old copy until next time, in case the new one misbehaves
        $prev = Join-Path $env:LOCALAPPDATA "zen-custom-update\previous"
        if (Test-Path $prev) { Remove-Item $prev -Recurse -Force }
        New-Item -ItemType Directory -Force (Split-Path $prev) | Out-Null
        Copy-Item $target $prev -Recurse -Force
        Note "Old copy kept in $prev"
      }
      New-Item -ItemType Directory -Force $target | Out-Null
      # make the folder match GitHub exactly, so files removed there go here too
      robocopy $src $target /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
      if ($LASTEXITCODE -ge 8) { throw "Couldn't copy the new files into $target (robocopy code $LASTEXITCODE). Is a file there open in another program?" }
    }
    Note "Done."

    Step "Installing into Zen"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $target "install\install.ps1") -Yes
    if ($LASTEXITCODE -ne 0) { throw "The installer stopped (see above)." }

    Step "Clearing Zen's startup cache"
    Get-ChildItem (Join-Path $env:LOCALAPPDATA "zen\Profiles") -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      $cache = Join-Path $_.FullName "startupCache"
      if (Test-Path $cache) { Remove-Item $cache -Recurse -Force -ErrorAction SilentlyContinue }
    }
    Note "Done."

    if (-not $zenExe) {
      foreach ($p in (Join-Path $env:ProgramFiles "Zen Browser\zen.exe"), (Join-Path $env:LOCALAPPDATA "Zen Browser\zen.exe")) {
        if (Test-Path $p) { $zenExe = $p; break }
      }
    }
    if ($zenExe) { Start-Process $zenExe }
    Write-Host ""
    Write-Host "zen-custom is up to date." -ForegroundColor Green
  } catch {
    Write-Host ""
    Write-Host "The update stopped: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Take a screenshot of this window and send it to Claude."
  } finally {
    Pop-Location
    Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
  }
}
Invoke-ZenCustomUpdate
