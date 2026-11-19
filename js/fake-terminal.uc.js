// ==UserScript==
// @name           zen-custom: Fake Terminal
// @description    Ctrl+Alt+L covers Zen with a fake coding terminal until Ctrl+T.
// @include        main
// ==/UserScript==
//
// For stepping away from the PC: Ctrl+Alt+L turns the Zen window into a full
// screen terminal with code typing itself, test runs and build bars, hiding
// your tabs and pages. Only Ctrl+T brings Zen back; every other key and click
// is swallowed while it runs. It's a disguise, not a lock: Alt+Tab, the
// Windows key and Ctrl+Alt+Del still work, so lock the keyboard too.
// The same screen runs in PowerShell with "zen ss" (tools/screensaver.ps1).
// Costs nothing until started; everything is removed when it ends.
// Switch off with zen-custom.fake-terminal = false.

(() => {
  "use strict";

  const loadedMark = "zc-loaded-fakeTerminal";
  if (document.documentElement.hasAttribute(loadedMark)) return;
  document.documentElement.setAttribute(loadedMark, "");

  const PREF = "zen-custom.fake-terminal";
  const HTML = "http://www.w3.org/1999/xhtml";

  const SNIPPETS = [
`// services/ward-sync/src/queue/scheduler.ts
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
}`,
`# pipeline/clean_vitals.py
import pandas as pd

def resample_vitals(df: pd.DataFrame, window: str = "15min") -> pd.DataFrame:
    """Align bedside readings to a fixed grid and drop sensor spikes."""
    df = df.sort_values("recorded_at").set_index("recorded_at")
    clipped = df.clip(lower=df.quantile(0.01), upper=df.quantile(0.99), axis=1)
    out = clipped.resample(window).median().interpolate(limit=4)
    out["map"] = (out["sbp"] + 2 * out["dbp"]) / 3
    return out.dropna(how="all")`,
`// Api/Controllers/RosterController.cs
[ApiController]
[Route("api/[controller]")]
public class RosterController : ControllerBase
{
    private readonly IRosterService _roster;

    [HttpGet("{wardId:int}")]
    public async Task<ActionResult<RosterDto>> Get(int wardId, CancellationToken ct)
    {
        var roster = await _roster.ForWardAsync(wardId, ct);
        return roster is null ? NotFound() : Ok(roster);
    }
}`,
`-- migrations/0042_add_handover_notes.sql
CREATE TABLE handover_notes (
    id          BIGSERIAL PRIMARY KEY,
    patient_id  BIGINT NOT NULL REFERENCES patients(id),
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_handover_patient ON handover_notes (patient_id, created_at DESC);`,
`// src/hooks/useDebouncedSearch.ts
export function useDebouncedSearch<T>(fetcher: (q: string) => Promise<T[]>, delay = 250) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  useEffect(() => {
    if (!query.trim()) return setResults([]);
    const id = setTimeout(async () => setResults(await fetcher(query)), delay);
    return () => clearTimeout(id);
  }, [query, fetcher, delay]);
  return { query, setQuery, results };
}`,
  ];
  const KEYWORDS = /^(import|from|export|class|private|public|readonly|async|await|const|let|var|for|of|in|return|new|def|if|else|is|null|function|CREATE|TABLE|INDEX|ON|NOT|NULL|PRIMARY|KEY|REFERENCES|DEFAULT)$/;
  const TYPES = /^(string|number|boolean|Promise|Map|Task|ActionResult|DataFrame|BIGINT|BIGSERIAL|TEXT|TIMESTAMPTZ|int|void)$/;
  const TESTS = ["flushes pending jobs in batches", "retries failed jobs with backoff", "records flush metrics",
    "rejects an empty roster", "keeps handover notes in order", "drops sensor spikes", "debounces quick typing",
    "returns 404 for an unknown ward", "resamples to a 15 minute grid", "survives a dropped connection"];
  const FOLDERS = ["ward-sync", "roster-api", "vitals-pipeline", "handover"];

  const css = `
    #zc-fake-term { position: fixed; inset: 0; z-index: 2147483647; background: #0c0c0c; color: #cccccc;
      font: 15px/1.45 "Cascadia Mono", Consolas, "Courier New", monospace; overflow: hidden; cursor: none;
      padding: 14px 18px; white-space: pre-wrap; word-break: break-all; }
    #zc-fake-term .kw { color: #c586c0; } #zc-fake-term .ty { color: #4ec9b0; } #zc-fake-term .str { color: #ce9178; }
    #zc-fake-term .num { color: #b5cea8; } #zc-fake-term .com { color: #6a9955; } #zc-fake-term .id { color: #9cdcfe; }
    #zc-fake-term .dim { color: #767676; } #zc-fake-term .ok { color: #16c60c; } #zc-fake-term .bar { color: #3b78ff; }
    #zc-fake-term .bad { color: #e74856; }
    #zc-fake-term .caret { display: inline-block; width: .6em; background: #cccccc; animation: zcCaret 1s steps(1) infinite; }
    @keyframes zcCaret { 50% { opacity: 0; } }
  `;

  let term = null, out = null, caret = null, timer = 0, wasFullScreen = false, instant = false;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a));
  const wait = ms => instant ? Promise.resolve() : new Promise(r => { timer = setTimeout(r, ms); });

  function span(cls, text) {
    const s = document.createElementNS(HTML, "span");
    if (cls) s.className = cls;
    s.textContent = text;
    out.insertBefore(s, caret);
    if (term) trim();
    return s;
  }
  // keep the screen short: old lines scroll off and are dropped
  function trim() {
    while (term.scrollHeight > term.clientHeight && out.firstChild !== caret) out.firstChild.remove();
    term.scrollTop = term.scrollHeight;
  }
  const newline = () => { span(null, "\n"); trim(); };

  function classOf(tok, line) {
    if (/^\s*(\/\/|#|--)/.test(line)) return "com";
    if (/^["'`]/.test(tok)) return "str";
    if (/^\d/.test(tok)) return "num";
    if (KEYWORDS.test(tok)) return "kw";
    if (TYPES.test(tok)) return "ty";
    if (/^[A-Za-z_]\w*$/.test(tok)) return "id";
    return null;
  }

  async function typeLine(line) {
    for (const tok of line.match(/"[^"]*"|'[^']*'|\w+|\s+|./g) ?? []) {
      const s = span(classOf(tok, line), "");
      for (const ch of tok) {
        if (!term) return;
        s.textContent += ch;
        await wait(rnd(12, 55));
      }
      if (rnd(0, 40) === 0) await wait(rnd(300, 900));
    }
    newline();
  }

  async function prompt(folder, cmd) {
    span("dim", `PS C:\\dev\\${folder}> `);
    const s = span(null, "");
    for (const ch of cmd) { if (!term) return; s.textContent += ch; await wait(rnd(40, 110)); }
    newline();
    await wait(400);
  }

  async function tests(folder) {
    await prompt(folder, "npm run test");
    const picked = [...TESTS].sort(() => Math.random() - .5).slice(0, rnd(4, 8));
    for (const t of picked) {
      if (!term) return;
      await wait(rnd(150, 700));
      span("ok", "  \u2713 "); span(null, t); span("dim", ` (${rnd(2, 90)} ms)`); newline();
    }
    newline(); span(null, "  Tests: "); span("ok", `${picked.length} passed`); span(null, `, ${picked.length} total`); newline(); newline();
    await wait(900);
  }

  async function build(folder) {
    await prompt(folder, "npm run build");
    const modules = rnd(120, 420), width = 30;
    span("dim", "[build] "); span(null, `compiling ${modules} modules `);
    const bar = span("bar", ""), rest = span("dim", ""), pct = span(null, "");
    for (let p = 0; p <= 100 && term; p += rnd(2, 9)) {
      const f = Math.round(width * p / 100);
      bar.textContent = "\u2588".repeat(f); rest.textContent = "\u2591".repeat(width - f);
      pct.textContent = ` ${String(p).padStart(3)}%`;
      await wait(rnd(60, 260));
    }
    bar.textContent = ""; rest.textContent = ""; pct.textContent = "";
    span("ok", `done in ${(rnd(18, 95) / 10).toFixed(1)}s`); newline(); newline();
    await wait(700);
  }

  async function git(folder) {
    await prompt(folder, "git status --short");
    for (const f of ["M src/queue/scheduler.ts", "M src/telemetry/index.ts", "?? src/queue/retry.test.ts"].slice(0, rnd(2, 4))) {
      span("bad", ` ${f}`); newline(); await wait(120);
    }
    newline();
    await wait(600);
  }

  async function loop() {
    // start with a screen that already looks busy
    instant = true;
    const first = pick(FOLDERS);
    for (const line of pick(SNIPPETS).split("\n")) await typeLine(line);
    newline();
    await tests(first);
    instant = false;
    while (term) {
      const folder = pick(FOLDERS);
      for (const line of pick(SNIPPETS).split("\n")) {
        if (!term) return;
        await typeLine(line);
        if (rnd(0, 6) === 0) await wait(rnd(400, 1600));
      }
      if (!term) return;
      newline();
      await wait(rnd(600, 1500));
      await [tests, build, git][rnd(0, 3)](folder);
    }
  }

  // While it runs, every key and click stops here (only Ctrl+T gets through,
  // and it only ends this).
  function swallow(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  function onKey(e) {
    swallow(e);
    if (e.type === "keydown" && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && e.code === "KeyT") stop();
  }
  const KEY_EVENTS = ["keydown", "keyup", "keypress"];
  // AppCommand: mouse side buttons and media keys (back, forward ...)
  const MOUSE_EVENTS = ["mousedown", "mouseup", "click", "dblclick", "auxclick", "contextmenu", "wheel",
    "AppCommand", "mousemove", "mouseover", "pointerdown", "pointerup", "touchstart"];
  // The window root comes before the window on every event's way in, so
  // nothing (Zen, Firefox, the other zen-custom scripts, other mods) sees a
  // key or click before this does.
  const root = () => window.windowRoot || window;

  // Holding Ctrl+T: its repeats after the screen ends mustn't open new tabs.
  function eatHeldT(e) {
    if (e.code !== "KeyT") return;
    if (e.type === "keydown" && !e.repeat && !e.ctrlKey) {
      // a fresh "t" (the key was let go unnoticed): back to normal
      root().removeEventListener("keydown", eatHeldT, true);
      root().removeEventListener("keyup", eatHeldT, true);
      return;
    }
    swallow(e);
    if (e.type === "keyup") {
      root().removeEventListener("keydown", eatHeldT, true);
      root().removeEventListener("keyup", eatHeldT, true);
    }
  }

  async function start() {
    if (term) return;
    // a full-screen video sits above everything; leave it first
    if (document.fullscreenElement) {
      const left = new Promise(r => document.addEventListener("fullscreenchange", r, { once: true }));
      document.exitFullscreen();
      await Promise.race([left, new Promise(r => setTimeout(r, 1000))]);
      if (term) return;
    }
    if (!document.getElementById("zc-fake-term-style")) {
      const style = document.createElementNS(HTML, "style");
      style.id = "zc-fake-term-style";
      style.textContent = css;
      (document.body || document.documentElement).append(style);
    }
    term = document.createElementNS(HTML, "div");
    term.id = "zc-fake-term";
    out = document.createElementNS(HTML, "div");
    caret = document.createElementNS(HTML, "span");
    caret.className = "caret";
    caret.textContent = " ";
    out.append(caret);
    term.append(out);
    (document.body || document.documentElement).append(term);
    for (const t of KEY_EVENTS) root().addEventListener(t, onKey, true);
    for (const t of MOUSE_EVENTS) root().addEventListener(t, swallow, { capture: true, passive: false });
    // keyboard focus off the page, so nothing typed reaches it
    term.tabIndex = -1;
    term.focus();
    wasFullScreen = window.fullScreen;
    if (!wasFullScreen) window.fullScreen = true;
    loop();
  }

  function stop() {
    if (!term) return;
    clearTimeout(timer);
    term.remove();
    term = out = caret = null;
    for (const t of KEY_EVENTS) root().removeEventListener(t, onKey, true);
    for (const t of MOUSE_EVENTS) root().removeEventListener(t, swallow, { capture: true });
    root().addEventListener("keydown", eatHeldT, true);
    root().addEventListener("keyup", eatHeldT, true);
    if (!wasFullScreen && window.fullScreen) window.fullScreen = false;
    gBrowser.selectedBrowser?.focus();
  }

  window.addEventListener("keydown", e => {
    if (term || e.code !== "KeyL" || !e.ctrlKey || !e.altKey || e.shiftKey || e.metaKey) return;
    if (e.getModifierState("AltGraph")) return;
    if (!Services.prefs.getBoolPref(PREF, true)) return;
    if (document.documentElement.hasAttribute("zen-little-window")) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) start();
  }, true);
})();
