# zen-custom fake coding screensaver. Start it with:  zen ss
# Fills the window with code that types itself, test runs and build bars
# until you press Ctrl+T. Every other key (Ctrl+C, Ctrl+Q, Esc, typing) is
# ignored. It's a disguise, not a lock: the window can still be closed with
# the mouse or Alt+F4, so lock the keyboard (Raycast) as well.

$ErrorActionPreference = "Stop"

# ---------- what it "types" ----------

$snippets = @(
@'
// services/ward-sync/src/queue/scheduler.ts
import { RetryPolicy, backoff } from "./retry";
import { metrics } from "../telemetry";

export class Scheduler {
  private pending = new Map<string, Job>();

  async flush(batchSize = 64): Promise<number> {
    const jobs = [...this.pending.values()].slice(0, batchSize);
    for (const job of jobs) {
      await backoff(() => job.run(), RetryPolicy.exponential);
      metrics.increment("scheduler.flushed");
    }
    return jobs.length;
  }
}
'@,
@'
# pipeline/clean_vitals.py
import pandas as pd
from datetime import timedelta

def resample_vitals(df: pd.DataFrame, window: str = "15min") -> pd.DataFrame:
    """Align bedside readings to a fixed grid and drop sensor spikes."""
    df = df.sort_values("recorded_at").set_index("recorded_at")
    clipped = df.clip(lower=df.quantile(0.01), upper=df.quantile(0.99), axis=1)
    out = clipped.resample(window).median().interpolate(limit=4)
    out["map"] = (out["sbp"] + 2 * out["dbp"]) / 3
    return out.dropna(how="all")
'@,
@'
// Api/Controllers/RosterController.cs
[ApiController]
[Route("api/[controller]")]
public class RosterController : ControllerBase
{
    private readonly IRosterService _roster;

    public RosterController(IRosterService roster) => _roster = roster;

    [HttpGet("{wardId:int}")]
    public async Task<ActionResult<RosterDto>> Get(int wardId, CancellationToken ct)
    {
        var roster = await _roster.ForWardAsync(wardId, ct);
        return roster is null ? NotFound() : Ok(roster);
    }
}
'@,
@'
-- migrations/0042_add_handover_notes.sql
CREATE TABLE handover_notes (
    id          BIGSERIAL PRIMARY KEY,
    patient_id  BIGINT NOT NULL REFERENCES patients(id),
    author_id   BIGINT NOT NULL REFERENCES staff(id),
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_handover_patient ON handover_notes (patient_id, created_at DESC);
'@,
@'
// src/hooks/useDebouncedSearch.ts
export function useDebouncedSearch<T>(fetcher: (q: string) => Promise<T[]>, delay = 250) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  useEffect(() => {
    if (!query.trim()) return setResults([]);
    const id = setTimeout(async () => setResults(await fetcher(query)), delay);
    return () => clearTimeout(id);
  }, [query, fetcher, delay]);
  return { query, setQuery, results };
}
'@
)

$keywords = '^(import|from|export|class|private|public|readonly|async|await|const|let|var|for|of|in|return|new|def|if|else|elif|is|null|var|using|CREATE|TABLE|INDEX|ON|NOT|NULL|PRIMARY|KEY|REFERENCES|DEFAULT|function|type|interface)$'
$types = '^(string|number|boolean|Promise|Map|Task|ActionResult|DataFrame|BIGINT|BIGSERIAL|TEXT|TIMESTAMPTZ|int|void)$'

$tests = @("flushes pending jobs in batches", "retries failed jobs with backoff", "records flush metrics",
  "rejects an empty roster", "keeps handover notes in order", "drops sensor spikes", "debounces quick typing",
  "returns 404 for an unknown ward", "resamples to a 15 minute grid", "survives a dropped connection")
$folders = @("ward-sync", "roster-api", "vitals-pipeline", "handover")

# ---------- screen helpers ----------

$raw = $Host.UI.RawUI
$origFg = $raw.ForegroundColor
$origBg = $raw.BackgroundColor
$origTitle = $raw.WindowTitle

function Write-Color([string]$text, [ConsoleColor]$color) {
  [Console]::ForegroundColor = $color
  [Console]::Write($text)
}

# Ctrl+T ends it; any other key is swallowed.
function Test-Quit {
  while ([Console]::KeyAvailable) {
    $k = [Console]::ReadKey($true)
    if ($k.Key -eq [ConsoleKey]::T -and ($k.Modifiers -band [ConsoleModifiers]::Control)) { return $true }
  }
  return $false
}

# Sleep in small steps so Ctrl+T answers at once.
$script:instant = $false
function Wait([int]$ms) {
  if ($script:instant) { return }
  $end = [DateTime]::UtcNow.AddMilliseconds($ms)
  while ([DateTime]::UtcNow -lt $end) {
    if (Test-Quit) { throw "zen-ss-quit" }
    Start-Sleep -Milliseconds ([Math]::Min(40, [Math]::Max(1, ($end - [DateTime]::UtcNow).TotalMilliseconds)))
  }
  if (Test-Quit) { throw "zen-ss-quit" }
}

function Get-TokenColor([string]$tok, [string]$line) {
  if ($line -match '^\s*(//|#|--)') { return [ConsoleColor]::DarkGreen }
  if ($tok -match '^["''].*') { return [ConsoleColor]::DarkYellow }
  if ($tok -match '^\d') { return [ConsoleColor]::Green }
  if ($tok -match $keywords) { return [ConsoleColor]::Magenta }
  if ($tok -match $types) { return [ConsoleColor]::Cyan }
  if ($tok -match '^[A-Za-z_]\w*$') { return [ConsoleColor]::Gray }
  return [ConsoleColor]::White
}

# Types a line like a person: words at a varying pace, a pause now and then.
function Type-Line([string]$line) {
  $tokens = [regex]::Matches($line, '"[^"]*"|''[^'']*''|\w+|\s+|.')
  foreach ($t in $tokens) {
    $color = Get-TokenColor $t.Value $line
    foreach ($ch in $t.Value.ToCharArray()) {
      Write-Color $ch $color
      Wait (Get-Random -Minimum 12 -Maximum 55)
    }
    if ((Get-Random -Maximum 40) -eq 0) { Wait (Get-Random -Minimum 300 -Maximum 900) }
  }
  [Console]::WriteLine()
}

function Show-Prompt([string]$folder, [string]$command) {
  Write-Color "PS C:\dev\$folder> " DarkGray
  foreach ($ch in $command.ToCharArray()) { Write-Color $ch Gray; Wait (Get-Random -Minimum 40 -Maximum 110) }
  [Console]::WriteLine()
  Wait 400
}

function Show-Tests([string]$folder) {
  Show-Prompt $folder "npm run test"
  $picked = $tests | Get-Random -Count (Get-Random -Minimum 4 -Maximum 8)
  foreach ($name in $picked) {
    Wait (Get-Random -Minimum 150 -Maximum 700)
    Write-Color "  $([char]0x2713) " Green
    Write-Color $name Gray
    Write-Color " ($(Get-Random -Minimum 2 -Maximum 90) ms)`n" DarkGray
  }
  Write-Color "`n  Tests: " White; Write-Color "$($picked.Count) passed" Green; Write-Color ", $($picked.Count) total`n`n" Gray
  Wait 900
}

function Show-Build([string]$folder) {
  Show-Prompt $folder "npm run build"
  $modules = Get-Random -Minimum 120 -Maximum 420
  $width = 30
  for ($p = 0; $p -le 100; $p += (Get-Random -Minimum 2 -Maximum 9)) {
    $filled = [int]($width * $p / 100)
    [Console]::Write("`r")
    Write-Color "[build] " DarkGray
    Write-Color "compiling $modules modules " Gray
    Write-Color (([string][char]0x2588) * $filled) Blue
    Write-Color (([string][char]0x2591) * ($width - $filled)) DarkGray
    Write-Color (" {0,3}%" -f $p) Gray
    Wait (Get-Random -Minimum 60 -Maximum 260)
  }
  [Console]::Write("`r")
  Write-Color "[build] " DarkGray
  Write-Color "done in $([Math]::Round((Get-Random -Minimum 18 -Maximum 95) / 10, 1))s" Green
  [Console]::Write(" " * ($width + 24))
  [Console]::WriteLine(); [Console]::WriteLine()
  Wait 700
}

function Show-Git([string]$folder) {
  Show-Prompt $folder "git status --short"
  foreach ($f in @("M src/queue/scheduler.ts", "M src/telemetry/index.ts", "?? src/queue/retry.test.ts") | Get-Random -Count 2) {
    Write-Color " $f`n" Red
    Wait 120
  }
  [Console]::WriteLine()
  Wait 600
}

# ---------- run ----------

# Full screen: F11 in Windows Terminal, Alt+Enter in the classic console.
$fullKey = if ($env:WT_SESSION) { "{F11}" } else { "%{ENTER}" }
$shell = $null
try { $shell = New-Object -ComObject WScript.Shell } catch { }
function Toggle-FullScreen { if ($shell) { try { $shell.SendKeys($fullKey) } catch { } } }
function Get-Size { $s = $raw.WindowSize; "$($s.Width)x$($s.Height)" }

# Console settings for the run: Ctrl+Break does nothing either, and a mouse
# click doesn't start a selection that would freeze the screen (QuickEdit).
$console = $null
try {
  Add-Type -ErrorAction Stop @"
using System;
using System.Runtime.InteropServices;
public static class ZenSsConsole {
  public delegate bool Handler(int type);
  static Handler keep = t => true;
  [DllImport("kernel32.dll")] static extern bool SetConsoleCtrlHandler(Handler h, bool add);
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int n);
  [DllImport("kernel32.dll")] static extern bool GetConsoleMode(IntPtr h, out uint m);
  [DllImport("kernel32.dll")] static extern bool SetConsoleMode(IntPtr h, uint m);
  static uint saved; static bool haveSaved;
  public static void Begin() {
    SetConsoleCtrlHandler(keep, true);
    IntPtr h = GetStdHandle(-10); uint m;
    if (GetConsoleMode(h, out m)) { saved = m; haveSaved = true; SetConsoleMode(h, (m & ~0x40u) | 0x80u); }
  }
  public static void End() {
    if (haveSaved) SetConsoleMode(GetStdHandle(-10), saved);
    SetConsoleCtrlHandler(keep, false);
  }
}
"@
  $console = $true
} catch { }

[Console]::TreatControlCAsInput = $true
$cursor = $true
try { $cursor = [Console]::CursorVisible } catch { }
$fullSize = $null
try {
  if ($console) { try { [ZenSsConsole]::Begin() } catch { } }
  # Only undo full screen at the end if this made it full screen and it still is.
  $before = Get-Size
  Toggle-FullScreen
  Start-Sleep -Milliseconds 350
  if ((Get-Size) -ne $before) { $fullSize = Get-Size }
  $raw.WindowTitle = "Windows PowerShell"
  [Console]::BackgroundColor = [ConsoleColor]::Black
  Clear-Host
  # start with a screen that already looks busy
  $script:instant = $true
  foreach ($line in (($snippets | Get-Random) -split "`r?`n")) { Type-Line $line }
  [Console]::WriteLine()
  Show-Tests ($folders | Get-Random)
  $script:instant = $false
  while ($true) {
    $folder = $folders | Get-Random
    $code = $snippets | Get-Random
    foreach ($line in ($code -split "`r?`n")) {
      Type-Line $line
      if ((Get-Random -Maximum 6) -eq 0) { Wait (Get-Random -Minimum 400 -Maximum 1600) }
    }
    [Console]::WriteLine()
    Wait (Get-Random -Minimum 600 -Maximum 1500)
    switch (Get-Random -Maximum 3) {
      0 { Show-Tests $folder }
      1 { Show-Build $folder }
      2 { Show-Git $folder }
    }
  }
} catch {
  if ($_.Exception.Message -ne "zen-ss-quit") { throw }
} finally {
  # a held Ctrl+T leaves repeats queued; don't hand them to the shell
  try { while ([Console]::KeyAvailable) { [void][Console]::ReadKey($true) } } catch { }
  # console mode first (it was saved with Ctrl+C already off), then Ctrl+C back on
  if ($console) { try { [ZenSsConsole]::End() } catch { } }
  [Console]::TreatControlCAsInput = $false
  try { [Console]::CursorVisible = $cursor } catch { }
  $raw.WindowTitle = $origTitle
  [Console]::ForegroundColor = $origFg
  [Console]::BackgroundColor = $origBg
  Clear-Host
  if ($fullSize -and (Get-Size) -ne $before) { Toggle-FullScreen }
}
