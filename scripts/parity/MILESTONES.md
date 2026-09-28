# Parity milestones (2026-09-28, target Claude Code 2.1.283)

`GOAL.md` defines what "done" means. This file cuts the road there into milestones. Each milestone has an exit check and a stop rule; at the end of each one, report to Cuong (Vietnamese, at most 8 lines: result, numbers, what's next) before starting the next.

## Ground rules for every milestone

- All edits and runs happen in the sandbox: `source ~/.pi/sandbox/env.sh`, working directory `~/.pi/sandbox/agent`, branch `parity-sandbox`. Never edit `~/.pi/agent`, the Volta install, or any running pi process. `~/.pi/sandbox/refresh.ps1` re-syncs the install copy.
- Claude is pinned to the versioned binary `~/.local/share/claude/versions/2.1.283` (it auto-updates; a version change mid-milestone invalidates the numbers).
- Never open Claude's `/config` or any dialog that writes `~/.claude/settings.json` (a discovery run on 2026-09-28 wrote `autoCompactEnabled` into it by accident).
- A finding is only real once pi is measured on screen with the patched Volta bundle (`dist/bundle/cli.js`). Reading `%APPDATA%\npm\...\pi-coding-agent` source does not count: that copy is unpatched.
- Stop rule: if a milestone passes its time box without its exit check moving, stop and report what is blocking, don't keep going.

## Baseline

| Milestone | Date | Suite | Notes |
| --- | --- | --- | --- |
| M0 | 2026-09-28 | 28/33 | `agent` (pi appends `Sonnet 5`: Cuong's uncommitted `agents/*.md` pin Sonnet 5), `modes`/`modes-default`/`plan` (Claude's empty-box placeholder `Try "…"`, pi has none), `interrupt` (Claude side produced no capture) |
| M1 | 2026-09-28 | — | sandbox built, isolation proved (Volta `cli.js` hash unchanged, sandbox pi ran from the copy) |
| M3 | 2026-09-28 | 33/33, 33/33 | sandbox, Claude 2.1.283 pinned, isolated config (runs 2 and 3; run 1 30/33 found the /clear placeholder reset, a sandbox skill-path conflict and the untracked `mcp` scenario). Fixed: sandbox Claude idle screen (`.ponytail-active`, `claudeMdExcludes`), `Try "…"` placeholder in pi, plan folder under `PI_CODING_AGENT_DIR`. Measured, no pi change: agent model tag (Claude draws it too; M0 was Cuong's uncommitted agent file), interrupt child (Claude's `sleep.exe` also outlives esc). No capture with the classic-fallback line; real `~/.claude.json` strikes still 1 |
| M4 | 2026-09-28 | 39/39, 39/39 | runs 4 and 5 (run 1-2 38/39: M4-C's long decline wording is only Claude's network dialog, reverted; run 3 38/39: pi's doubled startup header, moved to M5). Matched: esc esc, ctrl+l, ctrl+c/d hint, exit summary, paste placeholder, argument hint, unknown/typo slash commands, `/help`, narrow footer, Glob/Grep wording, read notice, long-line wrap, bash ctrl+o head, failed bash row, bash decline ends the turn. Real pi install leaked M4 core edits at 17:34 (pi-installs listed every install); restored, fixed in aecd875 |
| M5 | 2026-09-28 | 44/44, 44/44 | M5-D runs C and D (`--port 20250`; run A 42/44: `web` got an httpbin 503, and live Haiku thought in a dash list the ctrl+o view dimmed whole; run B 43/44: the doubled startup header in `task`). Matched: ctrl+o compares the visible screen (Claude's detailed view has no cut rule, its viewport scrolls up to the prompt) with one blank row above the bar, resumed group sentence without the streaming peak, the declined Update's dimmed diff (`m4d-decline-edit` joins the suite), grey dash bullets in ctrl+o thinking, Claude's compaction label and `Compacted (ctrl+o to see full summary)` row (pi-coding-agent edits 48-49; 49/49 present), and the doubled header: pi-mcp-adapter's metadata-cache rename race between concurrent pi instances printed `MCP initialization failed: EPERM` into the TUI (4 of 90 idle starts before the fix, 0 of 90 after). Measured, not fixed: compaction structure (prompt row, history kept, spinner, re-attached files), and the MCP/Fetch permission dialogs pi never shows in manual mode. A live `PI_TUI_DEBUG_REDRAW=1` run logged only `first render`; no Claude capture with the classic-fallback line; self-checks green |

## M2 — Verify and triage the findings (time box: 1 session)

Input: `findings/*.md` (6 areas, about 55 entries, written by discovery agents; some read the wrong pi install, and some contradict the README ledger).
Work: re-measure each finding on screen, pi from the sandbox and Claude from the pinned binary, and write `findings/BACKLOG.md` with one row each: id, area, verdict (`real` / `not real` / `already matched`), evidence path, class (`A` wording or rendering pi can fix; `B` missing feature; `C` pi cannot produce → README exception), size (S/M/L).
Exit: every finding has a verdict and evidence; the three disputed ones are settled first (pi "has no compaction", permission "for this session" wording, `ctrl+l`).

## M3 — Suite green on 2.1.283 (time box: 1 session)

Fix the five M0 differences: empty-box placeholder, agent row model tag (measure Claude with a subagent on a model other than the main one first), `interrupt` capture. Pin `run.py --claude` to the versioned binary.
Exit: `suite.py` 33/33 on two consecutive sandbox runs.

## M4 — Class A quick wins (time box: 2 sessions)

Wording and rendering that pi owns, each one locked by a new scenario or replay, with self-checks where the logic is pure: paste placeholder, `?` card, ctrl+l, ctrl+c/ctrl+d hint and exit summary, unknown command and typo handling, `!` bash mode glyph and hint, permission wording/decline option/`User rejected` row, bash truncation end and marker, Grep/Glob wording, parallel failing call row, resume notice order, footer truncation at 60 columns, queued messages above the spinner.
Exit: every new case clean, suite clean twice, `apply.mjs` no `NEEDS PORT`, self-checks green.

## M5 — Class A structural (time box: 2 sessions)

Carried from M4: pi's startup header drawn twice (`pi v0.85.1` rows repeated; seen in M4 suite run 3 `task`, README already notes 1 in 18 replays with focus reporting) pushes the screen down a row — a real redraw bug for the flicker criterion; `m4c-long-line` and `m4d-bash-rows` end in the ctrl+o view, so they join the suite with ctrl+o mode; `m4d-decline-edit` needs Claude's dimmed diff under `User rejected update to <path>`; the resume-notice move needs run.py to replay Claude with `--resume` for the replay cases first; the tool header `● Bash(cmd)` vs `Ran <desc>` on a failed parallel call; the decline option per dialog kind (Claude's bash dialog says `No`, its network/host dialog says `No, and tell Claude what to do differently (esc)` — M4-C applied the long form everywhere and was reverted after the suite's `permission` case caught it).

ctrl+o detailed-transcript mode, grouped parallel foreground agents, diff inside the Edit/Write permission prompt, context-low row and compaction notices, plan approval scrolling, the 2.1.282/283 redraw fixes (CJK/emoji in diffs, shrink while streaming) against the flicker criterion.
Exit: same as M4, plus a `PI_TUI_DEBUG_REDRAW=1` live run with no `firstChanged < viewportTop`.

## M6 — Class B features (Cuong decided 2026-09-28: build all of them)

Todo list and ctrl+t, background bash with its notice, ctrl+r history search, `/mcp`, `/context`, `/usage`, `/status`, `/resume` picker, light theme and `NO_COLOR`. Each item is either built (with its scenario) or moved to the README ledger as an exception with its measurement.

## M6b — Claude's screen model, no terminal scrollback (Cuong decided 2026-09-28: build it, tested hard)

Claude 2.1.283 keeps the overflow out of terminal scrollback (pyte `history.top` stays 0), pi writes it to scrollback. First measure exactly what Claude does (alt screen or not, what scrolls, how the transcript is reached again, mouse wheel, resize, ctrl+o, exit), write the rules into the README ledger, then port.
Exit: a scenario set at 132x60, 80x24 and 60x40 with transcripts taller than the screen, resize mid-stream and mid-tool, and exit, all clean against Claude; zero `firstChanged < viewportTop` redraws in a `PI_TUI_DEBUG_REDRAW=1` live run; `history.top` equal on both sides in every capture; suite clean twice. Only then does it go into M7.

## M7 — Land it (needs Cuong's go)

Merge `parity-sandbox` into `main`, update the README ledger, push `origin main`. Running pi sessions pick it up only after a restart; say so.
