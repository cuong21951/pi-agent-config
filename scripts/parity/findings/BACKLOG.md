# M2 backlog — verified findings

Method: every row below was re-measured on screen this pass — pi from the sandbox bundle
(`$PI_CLI` = `C:\Users\cuong\.pi\sandbox\pi-install\dist\bundle\cli.js`, same content-hash as the
live patched Volta install per M1) and Claude from the pinned `versions\2.1.283` binary — **unless**
the evidence column says otherwise (`selftest-only`, `sandbox-source-only`, or `unmeasured`). Several
of the original discovery files already contained genuine on-screen captures (via `pty-capture.py`,
`run.py`, or `session.py` replay against the live patched pi install, which is content-identical to
the sandbox bundle); those are cited by their original evidence path rather than re-captured. Only
`tool-output.md` was flagged as having read the **unpatched** `%APPDATA%\npm` copy of pi for most of
its structural claims — every such claim below was re-checked against the correct sandbox bundle
(`$PI_INSTALL_DIR\dist\core\...`) or re-captured live.

Evidence root for this pass: `%TEMP%\pi-parity\m2\` (subfolders: `permission`, `ctrl-l`, `ctrl-t`,
`compact`, `bash-trunc` / `bash-trunc2`, `perm-decline`, `edit-perm`, `shift-tab`).
New scenario files added under `scripts/parity/scenarios/`: `m2-bash-trunc.json`,
`m2-permission-decline.json`, `m2-edit-permission.json`.

**No new Claude launches this pass.** Every capture I personally ran this session was pi-only
(`--only pi` / `pty-capture.py` against `$PI_CLI` directly); no `claude.exe` process was started by
this pass, so this work added no strikes to `fullscreenBootStrikes`. All Claude-side evidence cited
below is reused from the pre-existing discovery captures. Checked those for the classic-renderer
fallback line ("fullscreen renderer didn't finish starting…"): `grep -rl "fullscreen renderer"` across
every `discovery/{input,lifecycle-layout,slash-commands,tool-output,agents-plan-perm}/**/*.txt` found
**zero hits** — every cited Claude capture's first content row is the normal logo header
(`▐▛███▛█ Claude Code v2.1.283`), meaning all of them booted the fullscreen renderer successfully.
The classic-vs-fullscreen ambiguity the coordinator flagged does not appear to taint any evidence
reused in this backlog.

## The three disputed items — settled first

**(1) Compaction: does pi have any, and does it show a context-low/auto-compact notice?**
Settled as **partially real, and lifecycle-layout.md's headline claim is wrong.** pi has a complete,
real compaction engine (`$PI_INSTALL_DIR\dist\core\compaction\compaction.js` + `agent-session.js`):
automatic threshold compaction (`_checkCompaction`/`_runAutoCompaction`) and manual `/compact`
(`AgentSession.compact()`), both calling the model for a real summary. lifecycle-layout.md's "grep -c
compact = 0" check only grepped the thin `dist/bundle/cli.js` entry stub; the real strings live in
`dist/bundle/chunks/chunk-JVUZSMYM.js`, which contains `Compacting context... ${cancelHint}` and
`Compacted from ${tokenStr} tokens`. I reproduced the exact "Nothing to compact (session too small)"
refusal from slash-commands.md twice independently (a 30-turn ~34.5k-token synthetic session AND a
90-turn ~104k-token one still under-threshold at first) and root-caused it: Cuong's own
`settings.json` sets `compaction.keepRecentTokens: 80000` / `reserveTokens: 200000` (pi's built-in
defaults are 20000/16384) — any session whose real content is under ~80k estimated tokens is entirely
"recent" by design, not a missing feature. Forcing a 90-turn/~104k-token session past that floor
produced a real, live "Compacting context... (escape to cancel)" spinner
(`%TEMP%\pi-parity\m2\compact\out2-spinner1.txt`, `out2-spinner2.txt`) — wording differs from Claude's
bundle-documented "Compacting conversation…". The final "Compacted"-style success row was not
captured (my capture window closed mid-compaction on the large synthetic session; time-boxed). What
**is** confirmed real: no passive pre-emptive warning exists anywhere in pi's bundle — grepped
`chunk-JVUZSMYM.js` for `until auto-compact`, `context used`, `Context low` (case-insensitive): zero
hits. So: pi has no Claude-style "N% until auto-compact" / red "Context low" countdown row (real gap),
but "pi has no compaction at all" is **false**.

**(2) Permission dialog: "for this session" (agents-plan-perm.md) vs README's "always allow access to
…"?** Settled: **README is right, agents-plan-perm.md's headline claim is wrong.** Live capture of a
real bash permission ask (`%TEMP%\pi-parity\m2\permission\pi-asking.txt`, scenario `permission.json`)
and a real Edit permission ask (`%TEMP%\pi-parity\m2\edit-perm\pi-asking.txt`, scenario
`m2-edit-permission.json`) both show pi's actual current option 2 as **"Yes, and always allow access
to `<path>` from this project"** — persistent-sounding wording, not "Yes, for this session". This
matches README's "Outside the measured set" note verbatim. agents-plan-perm.md's citation of
`pattern-suggest.ts`'s `"for this session"` strings is either a dead/unused code path or a different
package version than what's actually wired up — not what renders on screen. One real nuance survives:
Claude's own bash-specific wording is command-count-scoped ("commands in/on `<cwd>`"), while pi's is
directory-access-scoped ("access to `<dir>`") for every surface — a small, real wording gap (see
`agents-plan-perm/session-wording` row).

**(3) Does ctrl+l open pi's model picker?** Settled: **yes, real, reconfirmed on the sandbox bundle.**
Idle, no-model capture (`%TEMP%\pi-parity\m2\ctrl-l\out-idle.txt` →
`out-after-ctrl-l.txt` → `out-after-typing.txt`): ctrl+l opens `Scope: all | scoped` / the model list /
`Enter to select · Ctrl+Alt+S to set as default · Escape/Ctrl+C to cancel`, and typing `hello world`
afterward lands in the picker's own filter (`> hello world` → `No matching models`), confirming it
hijacks all subsequent keystrokes exactly as input.md originally reported.

## Corrections to the original findings (beyond the 3 disputed items)

- `agents-plan-perm/editwrite-diff` — **not real.** The live Edit-permission capture above
  (`edit-perm/pi-asking.txt`) shows a real diff embedded in the prompt (`1 -alpha: 1` / `1 +alpha:
  100`, plus 2 lines of context) — directly contradicting the "pi shows no diff, only a fact table"
  claim. Already matches Claude's `content.kind:"tool-use-line"` behaviour.
- `tool-output/ansi-stripping` — **not real as tested.** Live capture (`bash-trunc2/pi.txt`, a real
  `printf '\033[31mred\033[0m plain\n'` run) shows `red` rendered in red (`fg=red`) and `plain` in
  default colour — ANSI was preserved and rendered, not stripped. `bash-executor.js`'s
  `executeBashWithOperations` (which does call `stripAnsi`) is documented in its own header as the
  path for "remote execution (SSH, containers, etc.)" via custom `BashOperations`; the default local
  exec path evidently doesn't go through it. Flagging for someone to find the actual local-exec
  onData handler; verdict for the visible behaviour is **not real**.
- `tool-output/bash-truncation-direction` — **now confirmed on screen** (previously source-only, wrong
  copy). A 5000-line bash output (`python -c "for i in range(5000): print(i)"`) kept lines ~3000-4999
  (`bash-trunc2/pi.txt` line 18 onward), confirming pi keeps the **tail**, opposite of Claude's
  documented head-keep. The exact bracket marker text was not visible in the captured viewport
  (scrollback-limited); `truncate.js` confirms `DEFAULT_MAX_LINES=2000`/`DEFAULT_MAX_BYTES=50KB`
  unchanged from the original (correct) reading.
- `tool-output/todo-list-missing` and `tool-output/run-in-background-missing` — reconfirmed against
  the **correct** sandbox bundle (`$PI_INSTALL_DIR\dist\core\tools\index.js`:
  `allToolNames = {read,bash,powershell,edit,write,grep,find,ls}`, no todo tool;
  `$PI_INSTALL_DIR\dist\core\tools\bash.js`: `bashSchema = {command, timeout}`, no
  `run_in_background` field). Same conclusion as the original (wrong-copy) finding, now on the right
  file. `ctrl+t` reconfirmed as a byte-identical no-op on the sandbox bundle
  (`%TEMP%\pi-parity\m2\ctrl-t\out-idle.txt` vs `out-after-ctrl-t.txt`, only the cat-mascot animation
  frame differs).
- `tool-output/glob-no-header` and `tool-output/grep-truncation-wording` — reconfirmed against the
  correct sandbox bundle source. Note: the sandbox's actual grep wording (`"${limit} matches limit
  reached. Use limit=${limit*2} for more, or refine pattern"`) is *not byte-identical* to what the
  original (wrong-copy) finding quoted (`limit=${effectiveLimit+N}`) — the two pi copies genuinely
  differ in detail, which is exactly why the recheck mattered. The underlying gap (Claude has 3
  wording variants, pi has 1) still stands.
- `claude-drift/shift-tab-race` — **not real.** Two shift+tab presses (`\x1b[Z\x1b[Z`) sent with
  near-zero gap from `manual` mode landed deterministically on `plan`
  (`%TEMP%\pi-parity\m2\shift-tab\out-start.txt` → `out-after-double.txt`) — exactly 2 steps forward
  in the documented cycle (`manual → accept edits → plan`), not a corrupted/skipped state. No race
  observed in pi.

## Backlog table

Columns: id · verdict · evidence · class · size · owner · note.

### M3 — suite green (cross-references only; not new work from this pass)

| id | verdict | evidence | class | size | owner | note |
|---|---|---|---|---|---|---|
| input/placeholder-empty-box | real | `discovery/input/claude-ready.txt` vs `pi-ready.txt` (live, both sides) | A | S | `extensions/claude-input` | Same gap M0 already tracks ("modes/modes-default/plan" — Claude's `Try "…"` placeholder, pi has none). Claude's is dim SGR, rotates per session start; matching exactly needs a small rotating pool, not file-aware suggestions. |

### M4 — Class A quick wins

| id | verdict | evidence | class | size | owner | note |
|---|---|---|---|---|---|---|
| input/paste-placeholder-wording | real | `discovery/input/claude-paste-paste-result.txt` vs `pi-paste-paste-result.txt` (live both sides) | A | S | pi core paste-collapse (not an extension) | `[Pasted text #1 +10 lines]` (newline-count) vs pi's `[paste #1 +11 lines]` (line-count) + missing `paste again to expand` hint. |
| input/help-card-drift | real | `discovery/input/claude-explore-04-help.txt` vs `pi-explore-04-help.txt` (live both sides) | A | S-M | `extensions/claude-help/index.ts` (`CARD` constant) | ~5 of 12 cells wrong/missing/stale; biggest single-surface word count of drift found. |
| input/ctrl-l-model-picker | real (reconfirmed) | `%TEMP%\pi-parity\m2\ctrl-l\out-*.txt` (sandbox bundle, this pass) | A | S | `keybindings.json` (once the real binding owner is found) | Remap ctrl+l off the model picker; Claude's `chat:clearInput` on this key is a no-op anyway in the captured build. |
| input/ctrlc-ctrld-exit-hint | real | `discovery/input/claude-ctrlc-*.txt` vs `pi-ctrlc-*.txt` (live both sides) | A | S-M | pi core (`app.clear`/`app.exit` are core actions) | pi's ctrl+c clears text immediately (no hint); Claude shows a timed "Press Ctrl-C again to exit" footer notice first. |
| lifecycle/exit-summary-text | real | `discovery/lifecycle-layout/claude-exit*.txt` vs `pi-exit*.txt` (live both sides) | A (wording/colour) + B (mechanism) | M | pi core (exit-summary print + ctrl+c state machine) | Wording, command shape (`--session-dir` clause), and dim-scope all differ; pi's first ctrl+c changes mode instead of arming a "press again" state. |
| input/esc-esc-double-tap | real | `discovery/input/claude-esc*.txt` vs `pi-esc*.txt` (live both sides) | A | S | `extensions/claude-keys/index.ts` | No "Esc again to clear" hint in pi; pi's window (600ms) vs Claude's measured ~300-400ms. |
| slash/unknown-command-burns-turn | real | `discovery/slash-commands/out/claude-unknown-unknown.txt` vs `pi-unknown-result.txt` (live both sides) | A/B | M | new extension pre-submit hook (+ core patch if hook fires too late) | Claude rejects a garbage `/x` for free; pi sends it to the model as chat (real cost + latency every time). |
| slash/typo-silent-execute | real | `discovery/slash-commands/out/claude-typo-unknown.txt` vs `pi-typo-result.txt`/`pi-typo-menu.txt` (live both sides) | B | M | pi core submit path or same pre-submit hook as above | pi can silently execute a *different* builtin (e.g. `/model`) on a near-miss typo with zero confirmation; Claude always asks "did you mean". Flag impact as high despite frequency being typo-only. |
| slash/help-command-missing | real | `discovery/slash-commands/out/claude-tour-help.txt` vs absence in pi's `BUILTIN_SLASH_COMMANDS` | A/B | S-M | same extension as unknown-command fix | `/help` isn't registered in pi; falls into the same burns-a-turn bug as above. Card content can reuse `claude-help`'s existing data. |
| slash/agents-hidden-command | real | `discovery/slash-commands/out/claude-tour-agents.txt` vs pi (no entry) | A | S | small static table, depends on unknown-command fix | Low severity; Claude still gives a free local reply for a removed command, pi burns a turn. |
| slash/compact-wording | real (spinner now captured) | `%TEMP%\pi-parity\m2\compact\out2-spinner1.txt`/`out2-spinner2.txt` (sandbox bundle, this pass) | A | S | wherever pi's compaction spinner text is defined (bundle chunk, not an extension — likely needs a package/core patch) | pi's real spinner text is `Compacting context... (escape to cancel)`; Claude's is `Compacting conversation…` (bundle-documented). Final success-notice wording still unconfirmed on screen (time-boxed). |
| slash/argument-hint-placement | real | `discovery/slash-commands/out/claude-tour-model-arg.txt` vs `pi-settings-model-space.txt` (live both sides) | A | S | `extensions/claude-input` (`promptLines`) | Claude shows a muted inline ghost-text hint after an exact command name; pi only shows hints inside its live-completion dropdown, and only for 3 commands that implement one. |
| tool-output/glob-no-header | real (reconfirmed, sandbox source) | `$PI_INSTALL_DIR\dist\core\tools\find.js` (this pass) | A | S | `dist/core/tools/find.js` (package/core patch) | No `Found N files` header ever; empty case says `"No files found matching pattern"` vs Claude's plain `"No files found"`. |
| tool-output/grep-truncation-wording | real (reconfirmed, sandbox source) | `$PI_INSTALL_DIR\dist\core\tools\grep.js` (this pass) | A | S | `dist/core/tools/grep.js` | pi has one truncation message shape; Claude has 3, chosen by what it knows about the true total. |
| tool-output/bash-truncation-marker | real (direction confirmed on screen) | `%TEMP%\pi-parity\m2\bash-trunc2\pi.txt` (this pass) | A (or explicit design-keep) | S | `dist/core/tools/bash.js`/`truncate.js` | Direction (tail vs Claude's head) may be an intentional, better design — flag for Cuong rather than blind-porting; wording definitely differs either way. |
| tool-output/parallel-fail-row-shape (wording half) | real | `discovery/tool-output/out/claude-ctrlo-expanded.txt` vs `pi-ctrlo-expanded.txt` (live both sides, correct pi bundle via `run.py`/`session.py` harness) | A | S-M | `extensions/claude-tools/format.ts`/`generic.ts` | `● Bash(cmd)` + coloured dot vs pi's `Ran <description>` no dot; failed line `Error: Exit code 7` vs pi's `✗ exit 7` + extra line (the `✗` glyph contradicts pi's own documented "no ✗" rule — looks like a real regression). |
| lifecycle/resume-notice-placement | real | `discovery/lifecycle-layout/claude-resumed.txt` vs `pi-resumed.txt` (live both sides) | A | S | wherever "Ponytail loaded" fires (patch, not extension) | Claude's fresh-launch notice is the LAST thing before the prompt (after replayed history); pi's is the FIRST thing (before it). |
| lifecycle/narrow-footer-truncation | real | `discovery/lifecycle-layout/narrow60/claude.json` vs `pi.json` (live both sides) | A | S | `extensions/claude-footer/index.ts` | Claude truncates char-by-char with `…`; pi drops whole trailing clauses with no marker. |
| lifecycle/unicode-flag-emoji-wrap | real | `discovery/lifecycle-layout/unicode-out/claude.txt` vs `pi-unicode3.txt` (live both sides) | A | S | pi's shared string-width helper | Different bugs each side: Claude eats a space after the flag emoji (cosmetic); pi breaks the *following word* in half (real word-wrap violation, more visible). |
| claude-drift/agent-panel-enter-to-view | done (M6-F: in-place agent view replaces the overlay, locked by `m6f-view`) | `discovery/claude-drift/changelog_282_new.txt` | A | S | agents-list footer extension | Needs a snapshot taken while the agent panel overlay already shows the row being viewed; time-boxed this pass. |
| claude-drift/prompt-tab-cursor | unmeasured (static changelog only) | `discovery/claude-drift/changelog_283_new.txt` | A | S | pi's editor cursor/history-recall logic | Narrow trigger (tab char inside a recalled history prompt); low value, time-boxed. |
| tool-output/read-large-file-notice | unmeasured this pass | original claim only (source, not re-checked against sandbox this pass) | A (wording) / B (hidden `isMeta` channel for full match) | S/M | `dist/core/tools/read.js` | Time-boxed; cheap partial fix is just changing pi's visible wording even without a hidden-reminder channel. |
| tool-output/long-line-no-wrap | unmeasured this pass | original claim only (source, unpatched-copy risk, not re-verified) | A (if real) | S | `extensions/claude-tools/format.ts` (`wrapRow`) | Needs a live 132-col capture of a very long single bash/grep/read line on both sides; time-boxed. |

### M5 — Class A structural

| id | verdict | evidence | class | size | owner | note |
|---|---|---|---|---|---|---|
| tool-output/ctrlo-detailed-transcript-mode | real | `discovery/tool-output/out/claude-ctrlo-collapsed.txt`→`-expanded.txt` vs `pi-ctrlo-collapsed.txt`→`-expanded.txt` (live both sides, correct pi bundle) | B (footer mode-state, not a small wording fix) | L | `extensions/claude-footer` + wherever ctrl+o toggle state lives | Claude's ctrl+o replaces the whole footer with a dedicated bar (scroll/notepad hints); pi's is an inline expand with an unrelated toast, footer never changes. |
| agents-plan-perm/parallel-agents-not-grouped | real | `discovery/agents-plan-perm/out1/pi-finished.txt` (live, Sonnet 5 via Copilot — cost flagged by original agent) | B | M-L | `patches/pi-subagents.patch` (new) | Claude collapses N simultaneous Agent calls into one "N agents…" header + per-agent sub-rows; pi always renders N full independent blocks. |
| agents-plan-perm/editwrite-diff | **not real — already matched** | `%TEMP%\pi-parity\m2\edit-perm\pi-asking.txt` (this pass) | — | — | — | Corrected: pi's Edit/Write permission prompt DOES embed the real diff (`1 -alpha: 1` / `1 +alpha: 100` + context lines). No work needed; remove from backlog, keep evidence for the README ledger. |
| lifecycle/context-low-warning-row | real | bundle grep, sandbox `chunk-JVUZSMYM.js`: zero hits for `until auto-compact`/`context used`/`Context low` (this pass) | B | M | new extension row (mirrors `claude-footer`'s existing ctx% math) | No passive pre-emptive warning anywhere in pi; only the already-accepted `ctx N%` footer badge exists. See "disputed item 1" above — compaction itself is NOT missing, only this warning row is. |
| slash/compact-success-notice | unmeasured (spinner captured, final notice not) | `%TEMP%\pi-parity\m2\compact\out2-spinner2.txt` (this pass, capture window closed before completion) | B (until confirmed) | S once confirmed | same as compact-wording above | Needs one more capture with a longer timeout/settle on a session just past the 80k-token floor. |
| agents-plan-perm/plan-taller-truncation | real (selftest-confirmed, not screen-captured) | `extensions/claude-modes/dialog.ts` selftest (`tight` case) | B | M | `extensions/claude-modes/dialog.ts` + `index.ts` | pi hard-truncates a plan taller than the modal with no indicator; Claude's plan pane is a bounded scrollable viewport. Not independently re-captured on screen this pass (selftest is pi's own code proving current behaviour, which is a lower evidence bar than a live capture but still concrete). |
| claude-drift/update-diff-redraw-cjk | unmeasured (static changelog only) | `discovery/claude-drift/changelog_283_new.txt` | B (redraw-path fix) | M | `patches/pi-coding-agent.patch.mjs` redraw logic | 3 stacked 2.1.283 fixes (CJK/emoji-wrapped diff stale char, non-fullscreen shrink-while-streaming garble, fullscreen startup blank flash); directly relevant to the GOAL's "no flicker" criterion. Needs a scripted CJK diff + mid-stream resize capture; time-boxed this pass. |

### M6 — Class B features (Cuong decides per item)

| id | verdict | evidence | class | size | owner | note |
|---|---|---|---|---|---|---|
| tool-output/todo-list-missing | real (reconfirmed, sandbox source + live ctrl+t) | `$PI_INSTALL_DIR\dist\core\tools\index.js` (`allToolNames`, this pass) + `%TEMP%\pi-parity\m2\ctrl-t\out-*.txt` | B | L | new built-in tool + `extensions/claude-todos` (new) | No todo/task tool anywhere in pi core; `ctrl+t` confirmed byte-identical no-op on the sandbox bundle. |
| tool-output/run-in-background-missing | real (reconfirmed, sandbox source) | `$PI_INSTALL_DIR\dist\core\tools\bash.js` (`bashSchema`, this pass) | B | L | `patches/pi-coding-agent.patch.mjs` + new renderer extension | `bashSchema = {command, timeout}` only; no `run_in_background`/`BashOutput`/`TaskStop`/`KillBash` anywhere in the sandbox bundle. |
| tool-output/bash-timeout-no-backgrounding | real, likely (blocked on the row above) | schema absence implies this; not independently re-verified live this pass | B | M | same as above | Claude can survive a timeout by auto-backgrounding; pi always kills. Needs the run_in_background infra first. |
| tool-output/bash-stdout-stderr-merged | **uncertain — needs follow-up** | contradicted in part by the ANSI-stripping live test (see corrections above) | B (if confirmed) | M | `dist/core/bash-executor.js` (whichever function the local exec path actually uses) | The obvious `executeBashWithOperations` function does merge+strip, but is documented as the *remote/custom-backend* path; local execution clearly goes elsewhere since ANSI survived on screen. Find the real local onData handler before deciding this is real. |
| claude-drift/send-now-key | unmeasured; likely blocked on run-in-background | `discovery/claude-drift/changelog_282_new.txt`/`changelog_283_new.txt` | B | M | depends on run-in-background infra | New Claude key (ctrl+enter / ctrl+x ctrl+s) backgrounds running tools on send-now; pi has no backgrounding capability to move them to. |
| input/ctrl-r-history-search | real | `discovery/input/claude-explore-11-ctrl-r.txt` vs `pi-misc2-b-ctrl-r.txt` (live both sides) | B | L | pi core (persisted cross-session history log) + new extension for the UI | Total feature gap: pi's ctrl+r is completely unbound; Claude's is a rich cross-project incremental search with live preview. |
| input/ctrl-t-toggle-tasks | real (reconfirmed) | `%TEMP%\pi-parity\m2\ctrl-t\out-idle.txt` vs `out-after-ctrl-t.txt` (this pass) | B | M | depends on the todo tool existing first | Same root cause as `tool-output/todo-list-missing`. |
| slash/mcp-missing | real | `discovery/slash-commands/out/claude-mcp2-open.txt` vs absence in pi | B | L | new extension (if pi-coding-agent exposes MCP server lifecycle to extensions) | No `/mcp` command in pi at all; Cuong runs ~10 MCP servers daily. |
| slash/context-missing | real | `discovery/slash-commands/out/claude-tour-context.txt` vs footer-only `ctx N%` in pi | B | L | new extension + possible core patch for per-category usage breakdown | Claude's category grid (system prompt/tools/skills/memory/messages) has no pi equivalent beyond one aggregate percentage. |
| slash/usage-cost-stats-missing | real | `discovery/slash-commands/out/claude-tour-usage.txt` vs absence in pi | B | L | new extension | Session cost/duration/code-change stats and usage-limit bars have no pi equivalent (footer only shows unrelated provider balances). |
| slash/status-thin | real | `discovery/slash-commands/out/claude-tour-status.txt` vs pi's `/session` | B | M | new/extended extension | Claude's `/status` is an account+environment health panel; pi's `/session` is a message/token counter only. |
| slash/resume-picker-structural | real | `discovery/slash-commands/out/claude-tour-resume.txt` vs `pi-resume-resume-open.txt` (live both sides) | B | L | pi's resume-picker extension (real rewrite, not a diff-port) | Different columns, chrome, and keybindings entirely; pi carries extra features (regex search, delete) Claude's doesn't have — needs a product decision on what to keep. |
| lifecycle/light-theme-nocolor | real | `$PI_CODING_AGENT_DIR\themes\` (only `claude-dark.json` exists, this pass) + bundle grep (`grep -c NO_COLOR` = 0) | B | L (theme) + M (`NO_COLOR`) | new theme file + pi-core env check | No light/colour-blind/ANSI-only theme variant exists; `NO_COLOR` has no handling code path anywhere. |
| lifecycle/short-terminal-scrollback | real | `discovery/lifecycle-layout/narrow80b/claude.txt` vs `pi.txt` (live both sides, replay) | B (architectural) — or C if Cuong wants to keep it | L | `patches/pi-coding-agent.patch.mjs` (transcript-region drawing) | Claude's transcript lives entirely inside its own viewport (true alt-screen); pi lets old rows scroll into real terminal scrollback. README's "scrollback left alone for same-height repaints" note suggests this may be a deliberate choice — flag for Cuong to decide keep-as-exception vs close. |

### Exception — class C (document in README, no fix planned)

| id | verdict | evidence | class | size | owner | note |
|---|---|---|---|---|---|---|
| agents-plan-perm/plan-no-claude-counterpart | real, intentional | `discovery/agents-plan-perm/all_rejected.txt` (bundle: no `/plan` slash entry) vs pi's `/plan <description>` | C | S (docs only) | README ledger | pi feature Claude can't reproduce; "fixing" would mean removing it. Recommend adding to README's "Outside the measured set" rather than leaving unlisted. |
| claude-drift/ultracode-notice | not applicable | `discovery/claude-drift/q283u.txt` vs pi routing (never reaches ultracode) | C | — | — | pi's model routing never sets ultracode (Fable caps `high`, Opus `xhigh`); nothing to diverge from. |
| input/history-ctrlp-ctrln-asymmetry | real, additive (not broken) | `discovery/input/` bundle read (Claude has no such binding) vs pi's `keybindings.json` | C (or leave as-is) | S | — | pi binds an extra convenience key Claude doesn't have; not a gap to close, just note it so the `?`-card row referencing it isn't mistaken for a bug. |
| slash/config-persistence-model | real, design difference | `discovery/slash-commands/out/claude-tour-config.txt` (live side-effect: wrote `autoCompactEnabled:false` into real `~/.claude/settings.json`, caught and reverted by the original agent) | C (flag for a product decision, not a port) | S (decide only) | — | Claude's `/config` writes immediately, no confirmation; pi's sibling `/model` dialog is explicitly session-only + explicit-save. Arguably pi's is safer. Plain `/settings`'s own persistence semantics were never tested live (avoided repeating the Claude accident) — still open if Cuong wants it settled on a throwaway settings path. |

### Not a UI finding — tooling gap only

| id | verdict | evidence | class | size | owner | note |
|---|---|---|---|---|---|---|
| agents-plan-perm/mockpy-agent-param-gap | done (M6-F: Agent args filtered by Claude's own schema, subagent transcripts served from the task notification's output file) | `scripts/parity/mock.py`'s `to_claude()` `"Agent"` branch | — | S | `scripts/parity/mock.py` | Only forwards `description`/`prompt`/`subagent_type`; blocks cheap replay of background/steered/error/model-override Agent states for future passes. Worth fixing before the next discovery sweep, not a pi/Claude parity bug itself. |

## Counts

- **Verdict:** real = 40, not real = 4 (`agents-plan-perm/session-wording` headline claim, `agents-plan-perm/editwrite-diff`, `tool-output/ansi-stripping`, `claude-drift/shift-tab-race`), already matched = 3 (`input/image-paste`, `input/hash-quick-add`, `lifecycle/startup-row-match` — plus `agents-plan-perm/editwrite-diff` doubles as already-matched), uncertain/needs-followup = 1 (`tool-output/bash-stdout-stderr-merged`), unmeasured (time-boxed) = 9 (`claude-drift/agent-panel-enter-to-view`, `claude-drift/prompt-tab-cursor`, `claude-drift/queued-messages-position`, `claude-drift/update-diff-redraw-cjk`, `claude-drift/send-now-key`, `input/queued-messages-live`, `slash/compact-success-notice`, `tool-output/read-large-file-notice`, `tool-output/long-line-no-wrap`).
- **Class:** A = 22, B = 20, C = 4, uncertain = 1, tooling = 1.
- **Size:** S = 20, M = 15, L = 12, decide-only = 2.

## Top 10 real class-A items by (frequency × visibility)

1. `input/ctrlc-ctrld-exit-hint` — ctrl+c/ctrl+d are the most-pressed keys in any terminal session; pi gives zero feedback on the exit-confirmation state Claude always shows.
2. `input/help-card-drift` — the single most information-dense, most-consulted static surface; ~5 of 12 cells wrong or stale (dead `ctrl+z` shortcut, wrong mode-cycle wording, missing `/btw`, wrong history hint, `/hotkeys` vs `/keybindings`).
3. `slash/unknown-command-burns-turn` — any mistyped slash command costs a real model turn and latency in pi, for free in Claude; happens constantly during normal use.
4. `slash/typo-silent-execute` — low frequency but real risk: a near-miss typo can silently fire `/model`/`/clear`/`/compact` with zero confirmation.
5. `input/ctrl-l-model-picker` — hijacks every subsequent keystroke into the wrong dialog; trivial to fix (remap) once the actual pi binding owner is found.
6. `input/paste-placeholder-wording` — triggers on every multi-line paste, one of the most common interactions there is.
7. `tool-output/parallel-fail-row-shape` — the "something broke while running two things" scenario is extremely common; pi's `✗ exit 7` even contradicts its own documented "no ✗" rule (looks like a real, uncovered regression).
8. `lifecycle/resume-notice-placement` — visible on literally every `--session` resume; cosmetic but constant.
9. `slash/compact-wording` — pi's real (newly-confirmed) compaction spinner says "Compacting context... (escape to cancel)" vs Claude's "Compacting conversation…"; every long session eventually hits this.
10. `lifecycle/narrow-footer-truncation` — footer/mode-row truncation style (char-by-char `…` vs whole-clause-drop) affects every session run under ~80 columns.
