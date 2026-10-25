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

  # Which folder to update: ZC_DIR if set, else the zen-custom folder in
  # Documents (also when an unzip left the files one folder down, in
  # zen-custom\Zen-custom-main), else a new one there.
  $looksRight = { param($d) Test-Path (Join-Path $d "install\install.ps1") }
  $nested = { param($d) @(Get-ChildItem $d -Directory -ErrorAction SilentlyContinue | Where-Object { & $looksRight $_.FullName }).Count -gt 0 }
  if ($env:ZC_DIR) {
    $target = $env:ZC_DIR
  } else {
    $candidates = @((Join-Path $env:USERPROFILE "Documents\zen-custom"), (Join-Path ([Environment]::GetFolderPath("MyDocuments")) "zen-custom"))
    $target = $candidates | Where-Object { (& $looksRight $_) -or (& $nested $_) } | Select-Object -First 1
    if (-not $target) { $target = $candidates[0] }
  }
  $target = [IO.Path]::GetFullPath($target).TrimEnd('\')

  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $work = Join-Path $env:TEMP "zen-custom-update-$stamp"
  New-Item -ItemType Directory -Force $work | Out-Null
  $backups = Join-Path $env:LOCALAPPDATA "zen-custom-update"
  $prev = $null
  $zenExe = $null
  $closedZen = $false
  Push-Location $env:TEMP   # so the folder we replace isn't the one PowerShell is in
  try {
    $isGit = Test-Path (Join-Path $target ".git")
    if ($isGit -and -not (Get-Command git -ErrorAction SilentlyContinue)) {
      throw "$target is a git clone but git isn't installed. Run 'git pull' there yourself."
    }
    if (-not $isGit -and (Test-Path $target) -and @(Get-ChildItem $target -Force).Count -and -not ((& $looksRight $target) -or (& $nested $target))) {
      throw "$target has files in it but isn't a zen-custom folder, so nothing was changed. Set `$env:ZC_DIR to your zen-custom folder and run this again."
    }

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
    if ($src.Count -ne 1 -or -not (& $looksRight $src[0].FullName)) {
      throw "The download doesn't look like zen-custom, so nothing was changed."
    }
    $src = $src[0].FullName

    Step "Updating $target"
    if ($isGit) {
      # a git clone: let git update it rather than copying over its files
      git -C $target pull --ff-only
      if ($LASTEXITCODE -ne 0) { throw "git pull didn't work in $target (see above), so nothing was installed." }
    } else {
      if (Test-Path $target) {
        # keep the last 3 old copies, in case a new one misbehaves
        $prev = Join-Path $backups "previous-$stamp"
        New-Item -ItemType Directory -Force $backups | Out-Null
        Copy-Item $target $prev -Recurse -Force
        Get-ChildItem $backups -Directory -Filter "previous-*" | Sort-Object Name -Descending | Select-Object -Skip 3 |
          ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
        Note "Old copy kept in $prev"
        # settings captured on this PC that GitHub doesn't have yet
        $mine = Join-Path $target "setup\my-settings.js"
        $theirs = Join-Path $src "setup\my-settings.js"
        # (GitHub's copy is dated by its last commit, so a newer one here was captured here)
        if ((Test-Path $mine) -and (Test-Path $theirs) -and
            (Get-Item $mine).LastWriteTime -gt (Get-Item $theirs).LastWriteTime -and
            [IO.File]::ReadAllText($mine) -ne [IO.File]::ReadAllText($theirs)) {
          Write-Host "   Your setup\my-settings.js differs from GitHub's. It's kept in $prev\setup; send it to Claude to push." -ForegroundColor Yellow
        }
      }
      New-Item -ItemType Directory -Force $target | Out-Null
      # make the folder match GitHub exactly, so files removed there go here too
      robocopy $src $target /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
      if ($LASTEXITCODE -ge 8) { throw "Couldn't copy the new files into $target (robocopy code $LASTEXITCODE). Is a file there open in another program?" }
    }
    $ver = Join-Path $target "VERSION"
    Note "Now on zen-custom $(if (Test-Path $ver) { ([IO.File]::ReadAllText($ver)).Trim() } else { '(no version)' })."

    Step "Closing Zen"
    $zen = @(Get-Process zen -ErrorAction SilentlyContinue | Where-Object { $_.SessionId -eq $mySession })
    if ($zen.Count) {
      $zenExe = ($zen | Where-Object { $_.Path } | Select-Object -First 1).Path
      # Zen saves your open tabs every few seconds and brings them back after
      # this. (Closing its windows one by one would lose all but the last.)
      $zen | Stop-Process -Force
      $zen | Wait-Process -Timeout 20 -ErrorAction SilentlyContinue
      $closedZen = $true
      Note "Closed."
    } else {
      Note "Zen wasn't open."
    }

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
    if ($prev) {
      Write-Host "Your old copy is in $prev. To put it back, run:"
      Write-Host "   robocopy `"$prev`" `"$target`" /MIR"
    }
    Write-Host "Take a screenshot of this window and send it to Claude."
    # don't leave you without your browser
    if ($closedZen -and $zenExe -and -not (Get-Process zen -ErrorAction SilentlyContinue | Where-Object { $_.SessionId -eq $mySession })) {
      Start-Process $zenExe
    }
  } finally {
    Pop-Location
    Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
  }
}
Invoke-ZenCustomUpdate
