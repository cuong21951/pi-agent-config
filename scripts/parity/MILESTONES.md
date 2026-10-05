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
| M6 | 2026-09-29 | 63/64, 64/64, 64/64 | M6-J (`--port 20950 --jobs 3`, 64 cases with `m6j-input-clear`): runs 2 and 3 clean, 64/64 and 64/64 (run 1 63/64: `clear`, Claude's status line had not drawn `ctx N%` at the typed snapshot; the case now waits for both footers). Every m6g `reqdiff` clean in all three; no Claude capture with the classic-fallback line; self-checks green; `pi-coding-agent.patch.mjs --check` 52/52. Flakes run alone 5 times each before the harness fixes: `clear`, `parallel-calls`, `m6g-stop` 0 of 5 (M6-I: 1 of 5 each; causes in the M6-J ledger bullets); `m6g-stop` with the sleeper paced into its bash differed 3 of 3 (Claude's waiting row), then clean 5 of 6 with pi's loop-live count (3 alone, 3 suite runs; the miss ran beside two other captures and Claude's kill settled before its turn ended, so its row was the done line: a Claude-side race that remains). Before: M6-I runs 1-5 61/63, 62/63, 62/63, 62/63, 60/63 (`--port 20850`), which matched M6-B..I (todos/ctrl+t, background shells, ctrl+r, `/resume`, `/mcp`, the agent view and `/tasks`, the subagent contract, fork, nesting, worktree lines; every m6g `reqdiff` clean). Exceptions in the README ledger. Classic-fallback line in no Claude capture; self-checks green; core patch 52/52 |
| M6b | 2026-10-03 | 67/71, 71/71, 71/71 | Claude's screen model (`--jobs 3`, 71 cases: the 64 plus `screen-newmsg`, `screen-size-132x60`/`-80x24`/`-60x40`, `screen-resize-tool` and the replays `screen-scroll`, `screen-sticky`): runs 3 and 4 clean, 71/71 and 71/71 (`--port 22500`, `22800`). Run 1 67/71 (`--port 21400`): `clear` and `slash-colour` (the slash menu's height follows each side's inventory, diff.py now skips the filler rows above it; both clean when re-diffed), `m6f-view` (a hidden footer kept one row under the `/tasks` card, edit 66), `m6a-ctrlb` (the timer beat the reply while other captures ran beside the suite; clean alone); run 2 was stopped to land edit 66. Before any port, pi's stock fullscreen mode scored 54/64 (dialogs docked at the bottom, the ctrl+o view's three blank rows). Capture lengths equal on both sides on every screen of both clean runs (no terminal scrollback); no Claude capture with the classic-fallback line; self-checks green; core patch 66/66, and the script reproduces both installed bundles byte for byte from a pristine 0.85.1 package. The alt-screen renderer has no `firstChanged < viewportTop` path, so that exit check does not apply. `screen-exit` measured and left out of the suite (the resume command differs by design). Merged into `main` and applied to the Volta and Roaming installs on Cuong's go (2026-10-02), not pushed |

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

## M6b — Claude's screen model, no terminal scrollback (done 2026-10-03; deferred on 2026-09-28, taken up on 2026-10-02 when rows repeated in pi's scrollback and Cuong said to do as Claude does)

Claude 2.1.283 keeps the overflow out of terminal scrollback (pyte `history.top` stays 0), pi writes it to scrollback. First measure exactly what Claude does (alt screen or not, what scrolls, how the transcript is reached again, mouse wheel, resize, ctrl+o, exit), write the rules into the README ledger, then port.
Exit: a scenario set at 132x60, 80x24 and 60x40 with transcripts taller than the screen, resize mid-stream and mid-tool, and exit, all clean against Claude; zero `firstChanged < viewportTop` redraws in a `PI_TUI_DEBUG_REDRAW=1` live run; `history.top` equal on both sides in every capture; suite clean twice. Only then does it go into M7.

## M7 — Land it (needs Cuong's go)

Merge `parity-sandbox` into `main`, update the README ledger, push `origin main`. Running pi sessions pick it up only after a restart; say so.

## Next round (deferred by Cuong 2026-09-29)

Claude's `Monitor` tool; the Workflow tool and cron/wakeup tools (CronCreate/List/Delete, ScheduleWakeup; measured by M6-F); MCP and Fetch permission dialogs in manual mode (pi asks nothing, Claude asks); light theme and `NO_COLOR`; the send-now screen's queued-message placement (`m6a-sendnow` out of the suite); suite-diffed cases for the `/context`, `/usage`, `/status`, `/mcp` panels (selftest-only now); `/btw`; thinking markdown (inline code, nested lists) in the ctrl+o view; M6b.

## At merge (M7)

In the real `~/.pi/agent`: delete the untracked `agents/Explore.md`, `agents/Plan.md`, `agents/general-purpose.md` and drop the uncommitted model edits in `agents/{planner,reviewer,scout,worker}.md` (those files are deleted by fbd147e) — Cuong's decision 2026-09-29: pi's subagents use Claude's built-in defaults. Do it only at merge: pi-subagents reads the agents folder when an agent starts, so earlier it would change running sessions.

# Round 2 (2026-10-04, target Claude Code 2.1.289)

Cuong asked on 2026-10-04 to keep cloning, with a goal cut into milestones and the regression suite green at each one. `GOAL.md` still defines "done"; the ground rules above still hold, except the pinned Claude moves to 2.1.289 in M8. One milestone at a time, a report to Cuong after each.

## State found on 2026-10-04 (investigation)

- Installed: pi 0.85.1 in both installs (npm latest 1.0.2, not taken), Claude Code 2.1.289 (sandbox still pins 2.1.283).
- `main` is 9 commits ahead of `origin/main`. M6b was merged and applied to the installs but never pushed.
- In flight, uncommitted in both trees: the slash-menu round (Enter on a partly typed command, bare `/skill` names, no preselection on a fuzzy-only match, plus the three review fixes), cases `slash-nearest` and `slash-skill` (73 cases). Its first full run was cut off at 35/73 (33 clean; `question` and `question-chat` differed only on the footer's `openrouter ?` balance) when the session ended. The real installs show 71 of 76 core edits.
- Only in `~/.pi/agent`, never in the sandbox: the wheel fix (core edits 67-68 and its two README paragraphs, 2026-10-03, uncommitted) and two commits (`/resume` titles, the Ajv logger hunk). The sandbox is therefore behind `main`, and a suite run there does not test what `main` holds until they are reconciled.
- Cuong's own uncommitted edits in `~/.pi/agent` (`extensions/voice`, `extensions/intent-tools`, `skills/film-download`) are not part of this work and are left alone.

## Regression gate (every milestone, in the sandbox, on the final code)

1. `py -3.12 scripts/selfchecks.py` prints `all self-checks passed`.
2. `node patches/apply.mjs` reports no `NEEDS PORT`, and `node patches/pi-coding-agent.patch.mjs --check` shows every edit present.
3. `py -3.12 scripts/parity/suite.py --jobs 3` (`--jobs 2` when the live model is slow, as on the evening of M8) exits 0 on two consecutive runs: every earlier case plus the milestone's new ones. A case that differs once is run alone three times before it is called a flake, and its cause goes in the README ledger.
4. Every `m6g-*` `reqdiff` is clean, and no Claude capture carries the classic-fallback line.

Landing, after the gate: sync the sandbox files into `~/.pi/agent`, `node patches/apply.mjs` there (`--check` complete on the Volta and Roaming installs), commit, push `origin main`, add a Baseline row. Running pi sessions need a restart.

## M7 — Land the slash-menu round (time box: 1 session)

Investigate: done above.
Work: fast-forward `parity-sandbox` to `main`, carry the wheel edits 67-68 and their README text into the sandbox, re-apply the core patch to the sandbox install, then the gate.
Test: the 73 cases, with `slash-nearest` and `slash-skill`; `question` and `question-chat` rerun alone if the balance row differs again.
Exit: gate green (73/73 twice), `--check` complete on all three installs, committed and pushed (Cuong's go, 2026-10-04: "Xong thì commit và push luôn").

## M8 — Retarget to Claude Code 2.1.289 (time box: 2 sessions)

Investigate: `findings/claude-drift-289.md`, the embedded changelog of 2.1.284-2.1.289 against 2.1.283, each UI item checked against the ledger. Pin `sandbox/claude-2.1.289.exe`, run the suite against it once, and triage every difference: Claude changed (port it), harness (fix the case), or flake.
Work: port what changed, one scenario or replay per ported item; move the target line in the README ledger.
Exit: gate green on 2.1.289; every drift item has a verdict (matched, ported, exception with its measurement, or deferred with a milestone).

## M9 — Widen the regression net (time box: 1 session; split on 2026-10-05)

What is only self-checked or kept out of the suite today. Both halves are done (Round 2 baseline): M9a, the four panels, and M9b, the rest: the queued-message layout, thinking markdown in the ctrl+o view and the status line's `ctx` timing.

M9b, measured on 2.1.289 with `m4b-queued-message` (9 differences, 2026-10-05): Claude draws a queued message in the conversation, one blank row under the last block, as `❯ second message` all `999999` on `373737`, with `ctrl+x ctrl+s to send now` in `999999` two columns in on the next row, and the prompt box reads `Press up to edit queued messages`; pi draws `Steering: second message` and `↳ Alt+Q to edit all queued messages` in `505050` in the dock above the spinner (`updatePendingMessagesDisplay` in pi core) and leaves the box empty. Once delivered the row is a normal prompt row (`❯` `999999`, text `ffffff`), after the tool's group row in Claude and before it in pi (pi's group runs on across the user message). mock.py serves no reply to a message Claude merges into a tool result, so the `finished` screen cannot be compared yet.
Investigate: capture Claude's `/context`, `/usage`, `/status` and `/mcp` panels and the queued-message screens on the pinned binary.
Work: suite cases for the four panels (the account-only rows stay named exceptions); the queued-message layout (Claude's grey `❯` row after the tool, `ctrl+x ctrl+s to send now`, `Press up to edit queued messages`; pi draws `Steering: …` above it), which brings `m6a-sendnow` and `m6j-interrupt-queued` into the suite; thinking markdown in the ctrl+o view (inline code, nested lists); when Claude's status line first shows `ctx N%` (pi shows it when the first reply ends; Claude's status line is re-run during the reply, and in 1 of 4 `stream-lines` `thought` snapshots on 2.1.289 it already showed `ctx 23%`: measure when it refreshes, then either move pi's update to the same moment with a wait in the case, or name the timer in diff.py).
Exit: gate green with the new cases.

## M10 — Dialogs and keys (time box: 2 sessions)

Investigate: the measuring cases `m5d-perm-fetch`, `m5d-perm-mcp`, `m5d-perm-skill`; Claude's transcript key card in the ctrl+o view.
Work: MCP, Fetch and Skill permission dialogs in manual mode (pi asks nothing today); the ctrl+o transcript keys (↑↓ j k, ctrl+u/d, space/b, g/G, `/` search, the `?` key card); a click on the sticky prompt row; the list dialog for several background shells and `x` in Shell details; the dot of a write row while its permission dialog is open (done 2026-10-05: Claude `999999` and steady in 8 of 8 samples until the call resolves, then `3399ff`; `m2-edit-permission` is in the suite).

Measured on 2.1.289 on 2026-10-05 (`m5d-perm-fetch`, `m5d-perm-mcp`, `m5d-perm-skill`, manual mode), waiting for Cuong's word before porting because pi would ask more often than it does now: Fetch asks under the same frame as Bash (title `Fetch`, `Claude wants to fetch content from <host>`, then `url:` and `prompt:` rows between the dashed rules), its row's dot `999999` while it waits; an MCP call asks with title `Tool use`, `<server> — <Tool title> (MCP)`, the arguments between the dashed rules and option 2 `Yes, and don't ask again for <server> — <tool> commands in <cwd>`; a Skill call asks nothing on either side. pi runs both without asking.
Done 2026-10-05 (queued-message leftovers): Esc with queued messages (`m6j-interrupt-queued`, core edit 87) and the `ctrl+g to edit in Notepad` hint (`m10-multiline-hint`), both in the suite; details in the README ledger (Esc with queued messages and the `ctrl+g` hint).
Found on the way and not yet measured (2026-10-05): a loose markdown list (pi keeps the blank rows between items, Claude drew them adjacent in one live reply); paste numbering after a cleared paste (Claude goes on to `#2`, pi restarts at `#1`); the bash-mode box (pi draws no `! ` row and no `! for shell mode` line in `measure-hint2`).
Exit: gate green with a case for each.

## M11 — Tools Claude has and pi lacks (time box: 3 sessions)

Investigate: the `m6f-measure5` captures, re-measured on the pinned binary.
Work: `Monitor`; CronCreate, CronList, CronDelete and ScheduleWakeup with their rows and the scheduled-task fire; the Workflow rows, `/workflows` and the `/tasks` Phases card; `/btw`.
Exit: each one is built with its case, or moved to the ledger as an exception with its measurement; gate green.

## M12 — Themes (time box: 1 session)

Investigate: Claude's light, light-daltonized and ANSI palettes from the bundle; its `NO_COLOR` behaviour on screen.
Work: a light theme, `NO_COLOR`.
Exit: the replay cases run once per theme and are clean; gate green.

## Decisions that are Cuong's (not started without a go)

- pi 1.0.2: every one of the 76 anchored core edits and the seven package patches would need porting. Recommended as its own round after M8.
- The public `pi-claude-harness` mirror is a month behind (11 extensions and most patches missing). `pi-agent-config` has been public since 2026-09-24, so either mirror it again or retire it.
- Cuong's uncommitted `voice`, `intent-tools` and `film-download` edits: commit them or keep them local.

## Round 2 baseline

| Milestone | Date | Suite | Notes |
| --- | --- | --- | --- |
| M7 | 2026-10-04 | 74/74, 74/74 | runs 9 and 10 (`--jobs 3`, 74 cases with `slash-nearest`, `slash-skill`, `markdown-tight-replay`); runs 1-8: 71/73, 71/73, 72/73, 73/73, 72/73, 70/73, 72/74, 73/74, every difference read out of its captures (README, Suite state). Landed: the slash-menu round, the wheel edits 67-68, and four pi differences live Haiku turned up (wrap after inline code, edit 77; blank row between a sentence and a fence, edit 78; a leading `./` in a path; the refused `Stop Task` row). Harness: state waits in `clear` and `slash-nearest`, run.py waits for Claude's final `ctx N%`, mock.py ends the stream after the last block, `m6a-timeout` timer 25 s, `agent` prompt, `m6a-stop` and `m6f-view` waits. `m6g-stop`'s Claude-side race remains (once in ten runs). Every m6g `reqdiff` clean in runs 9 and 10; the classic-fallback line once, in run 10's uncompared `error-replay/claude-live` leg; self-checks green; core patch 78/78 |
| M8 | 2026-10-04 | 74/74, 74/74 | runs 7 and 8 against the pinned 2.1.289 (`--jobs 2`; runs 1-6: 70, 72, 73, 72, 71, 73 of 74, read out in README, Suite state). The first run against 2.1.289 was 8/74. Ported: `❯` `999999` on transcript prompt rows, an idle prompt white at once, the Bash/Edit/Write permission frame (description or path under the title, body between dashed rules), no session-start row (`ponytail.patch`) and a header ending in two blank rows, no `[Skill conflicts]` block for a long skill description (edit 79). Harness: Sonnet cases pin `claude-sonnet-5`, the scripted `asked` reply takes 1.5 s, `--patience 3` on every step timeout, longer `m6a-bg`/`m6a-ctrlb` timers and `m6f-view` wait, a named diff.py rule for Claude's early `ctx N%` (M9 measures it), suite.py keeps `run.log`. Every drift item has a verdict in `findings/claude-drift-289.md`. Every m6g `reqdiff` clean, no classic-fallback line, self-checks green, core patch 79/79 |
| M9a | 2026-10-05 | 76/76, 76/76 | runs 2 and 3 (`--jobs 2`, 76 cases with `m6d-panels` and `m6e-mcp-panel`; run 1 75/76: `m6g-fable`, two finished notices in the other order on pi's side, unexplained, clean 3 of 3 alone). Ported on 2.1.289: `/status` and `/usage` as a modal pane with Claude's frame, tab row, row order and value column; `/context` as a transcript block with estimates before the first reply; `/mcp` with the `▔` rule, Claude's colours, bare tool names and the dynamic-scope labels. Named exceptions: the account, bus and harness rows of `/status`, pi's Provider row and balances, Claude's `Messages` row in a fresh `/context`, the MCP tool's full name. No missed wait, every m6g `reqdiff` clean, no classic-fallback line, self-checks green, core patch 79/79 |
| M9b | 2026-10-05 | 79/79, 79/79 | runs 5 and 6 (`--jobs 2`, 79 cases with `m4b-queued-message`, `m6a-sendnow`, `thinking-md-replay`; runs 1-4: 78, 78, 79, 78 of 79, each a harness or machine cause read out in README, Suite state). Ported on 2.1.289: a queued message as a grey `❯` row in the conversation with one `ctrl+x ctrl+s to send now` hint, the `Press up to edit queued messages` placeholder and Up pulling the queue back (core edits 80-84); a tool group that ends at a user message; thinking as dim markdown in the ctrl+o view; a nested list under its parent's text (edits 85-86); `ctx N%` from the first streamed event. Harness: mock.py serves the reply to a message merged into a tool result, the status-line rule is symmetric, `slow-search` fixture 48000 files, run.py repeats Claude's side on a classic-renderer capture, `m6f-view` waits for the agent's last reply, generated replays carry the live model id. Left: Esc with a queued message (`m6j-interrupt-queued`, 7 differences, out of the suite), `ctrl+g to edit in Notepad` over a box of two or more rows, Up in a multi-line draft with a queue. No missed wait, every m6g `reqdiff` clean, no classic-fallback line, self-checks green, core patch 86/86 |
