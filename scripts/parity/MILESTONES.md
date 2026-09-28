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

ctrl+o detailed-transcript mode, grouped parallel foreground agents, diff inside the Edit/Write permission prompt, context-low row and compaction notices, plan approval scrolling, the 2.1.282/283 redraw fixes (CJK/emoji in diffs, shrink while streaming) against the flicker criterion.
Exit: same as M4, plus a `PI_TUI_DEBUG_REDRAW=1` live run with no `firstChanged < viewportTop`.

## M6 — Class B features (Cuong decides per item before work starts)

Todo list and ctrl+t, background bash with its notice, ctrl+r history search, `/mcp`, `/context`, `/usage`, `/status`, `/resume` picker, light theme and `NO_COLOR`, Claude's no-scrollback screen model. Each item is either built (with its scenario) or moved to the README ledger as an exception with its measurement.

## M7 — Land it (needs Cuong's go)

Merge `parity-sandbox` into `main`, update the README ledger, push `origin main`. Running pi sessions pick it up only after a restart; say so.
