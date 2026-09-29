# Slash-commands parity — findings

Measured Claude Code 2.1.283 (pinned binary, copied to `%TEMP%\pi-parity\discovery\slash-commands\claude2.1.283.exe`) against pi 0.85.1 (`C:\Users\cuong\.pi\agent`, github-copilot/claude-haiku-4.5). All captures under `%TEMP%\pi-parity\discovery\slash-commands\out\*.txt` (+ matching `.json` colour dumps). Bundle evidence pulled with a small mmap/regex script (`grep_bundle.py` / `grep_pi.py` in the same folder) against `C:\Users\cuong\.local\share\claude\versions\2.1.283` and pi's `chunks\chunk-JVUZSMYM.js`.

**Safety note (read this first):** a live `/config` probe on real Claude flipped `autoCompactEnabled` to `false` in Cuong's real `~/.claude/settings.json` (Claude's settings dialog writes to disk immediately, no confirmation — see finding below). Caught via mtime check and reverted (key removed, restoring the prior "unset = default" state) before continuing. No other real config was touched; pi's `~/.pi/agent/settings.json` mtime was checked and is unchanged.

---

### Unknown command, no fuzzy match — Claude rejects free; pi burns a real turn

- Claude (evidence): `out/claude-unknown-unknown.txt` — typing `/totallynotacommand123` + Enter draws `● Unknown command: /totallynotacommand123` in `ffcc00`, instantly, no API call (no spinner, no ctx% change). Bundle: `chunk` offset 227910885, `` `Unknown command: /${ke}. Did you mean /${_e}?`:`Unknown command: /${ke}` ``.
- pi now (evidence): `out/pi-unknown-result.txt` — the same text is submitted as a normal chat line (`❯ /totallynotacommand123`), pi actually calls the model ("Thought for 3s", real reply "That's not a recognized command..."), footer `ctx` goes from absent to `21%`. Root cause in pi core: `prompt(text, options)` only special-cases `/` via `_tryExecuteExtensionCommand`, which looks up *extension-registered* commands only; if that misses, execution falls straight through to `_runAgentPrompt(messages)` with the literal text — pi core has no "unknown command" rejection path at all (`grep_pi.py "not a recognized"` / `"not a valid command"` / `"no such command"` all 0 hits).
- Difference: Claude never spends a token on a typo; pi always does (and shows the model apologizing for not being a command).
- Severity: medium (only on a genuinely unmatched command, but happens whenever a slash command is mistyped badly and costs a real turn + latency).
- Feasible in pi: partial — an extension can intercept `session_start`'s `onTerminalInput`/pre-submit hook to check the text against the full known-command list (builtin + extension + skill) before it reaches `prompt()`, and short-circuit with a local message; can't remove pi core's fallback without a pi-core patch, but can pre-empt it from an extension. Likely owner: new extension (e.g. extend `claude-input`) + `patches/pi-coding-agent.patch.mjs` if the extension hook can't run early enough.
- Test to lock it: replay/scenario that submits a garbage `/xyz` and asserts no model turn happened (mock.py request count stays 0) and a local `Unknown command: /xyz` row is drawn.

### Unknown command, close typo — Claude asks; pi silently executes the guessed command

- Claude (evidence): `out/claude-typo-unknown.txt` — `/modle` + Enter draws `● Unknown command: /modle. Did you mean /model?`, nothing executes.
- pi now (evidence): `out/pi-typo-result.txt` — `/modle` + Enter actually **opens the Model Configuration picker** (pi's real `/model` UI), with zero confirmation and no "did you mean" text. The dropdown shown while composing (`out/pi-typo-menu.txt`) even highlights a *different* row (`/scoped-models`, `fg=99ccff`) than the one that ends up executing, so the highlighted row and the actually-dispatched command disagree — this isn't "Enter accepts the highlighted item", it's a separate fuzzy resolution at submit time landing on `/model`.
- Difference: Claude always asks before running anything on an ambiguous command; pi can silently execute a different builtin command than the one you typed. Depending on which real command a typo lands near (`/clear`, `/new`, `/quit`, `/compact` are all single builtin words a short typo could plausibly fuzzy-match), this is a real "did the wrong thing with no warning" risk, not just cosmetic.
- Severity: medium (frequency = only on typos near a real command name), but flag the impact as high since it can execute state-changing commands unprompted.
- Feasible in pi: yes — same interception point as above; before falling through, resolve slash text against `ClaudeSlashMatcher` and require an exact/prefix match to auto-run; anything resolved only through fuzzy scoring should show Claude's "Unknown command: /x. Did you mean /y?" and refuse to execute. Likely owner: pi core submit path (a patch) or an extension hook if one fires early enough to preempt pi's own dispatch.
- Test to lock it: scenario typing a known typo (`/modle`, `/resme`) + Enter; assert the *transcript* shows a "did you mean" refusal and no side effect (no dialog opened, no session mutated).

### `/mcp` — Claude has a full manager; pi has no such command at all

- Claude (evidence): `out/claude-mcp2-open.txt` — "Manage MCP servers", "10 servers", grouped `User MCPs (C:\Users\cuong\.claude.json)` / `claude.ai` / `Built-in MCPs (always available)`, each row `✔/⚠ name  N tools` (colours: `3399ff` check, `ffcc00` warn, `999999` count), footer `https://code.claude.com/docs/en/mcp for help` and `↑/↓ to navigate · Enter to confirm · Esc to cancel`. Bundle: `name:"mcp"`, `description:"Manage MCP servers"`, two variants with `argumentHint:"[reconnect|enable|disable [<server>|all]]"` (headless) and `"[reconnect <server>|enable|disable [<server>|all]]"` (interactive).
- pi now (evidence): `extensions/claude-mcp-render/index.ts` only strips a schema dump from MCP tool *results*; `grep -ril "/mcp"` across `extensions/` and the pi bundle's `BUILTIN_SLASH_COMMANDS` array (`grep_pi.py "BUILTIN_SLASH_COMMANDS="`) show no `mcp` command registered anywhere.
- Difference: no way in pi to list, reconnect, enable or disable an MCP server from the prompt; you'd have to know pi's own mechanism (if any) outside the slash UI.
- Severity: high (Cuong runs ~10 direct-tool MCP servers day to day; this is the command he'd reach for whenever one misbehaves).
- Feasible in pi: yes, with real work — pi-coding-agent exposes MCP server state somewhere (used to render tool calls); a new extension could register `pi.registerCommand("mcp", …)` rendering a similar grouped list with reconnect/enable/disable actions. Likely owner: new extension, or ask upstream `@earendil-works/pi-coding-agent` for an API if server lifecycle isn't exposed to extensions today.
- Test to lock it: a replay fixture with 2+ MCP servers configured (one ok, one erroring) driving `/mcp`, comparing row layout/colours against a captured Claude replay.

### `/context` — Claude draws a coloured usage grid inline; pi only has a footer percentage

- Claude (evidence): `out/claude-tour-context.txt` — `❯ /context` / `⎿ Context Usage`, a 10×5 grid of `⛁`(used, blue-ish)/`⛶`(free)/`⛝`(autocompact buffer) glyphs per model row, `37.5k/200k tokens (19%)`, then "Estimated usage by category" broken into System prompt / System tools / MCP tools / MCP server instructions / Memory files / Skills / Messages / Free space / Autocompact buffer with per-category %, "Auto-compact window: 200k tokens", "MCP tools · /mcp (loaded on-demand)" and "Skills · /skills" sub-lines, and `/context all to expand`. Bundle: `name:"context"`, `description:"Visualize current context usage as a colored grid"`, `argumentHint:"[all]"`.
- pi now (evidence): footer only shows `ctx N%` (already documented as Matched for the number itself); `grep_pi.py` for `"context"` command name / a grid renderer returns nothing — there is no `/context` command in `BUILTIN_SLASH_COMMANDS`.
- Difference: Claude gives a full category breakdown (what's eating context: system prompt vs tools vs skills vs memory vs messages); pi gives one aggregate percentage and no way to see what's inside it.
- Severity: high (this is the command people reach for specifically to debug "why is my context already at 80%", which happens often on long sessions).
- Feasible in pi: partial — pi would need per-category token accounting (system prompt, tool defs, skills, memory files, messages) to build the same breakdown; the footer already computes a total ctx%, so the raw pieces likely exist somewhere in pi core's usage tracking, but exposing them to an extension (or via a pi-core patch) is real work. Likely owner: extension consuming a new/expanded usage API from pi core, possibly a pi-core patch if the breakdown isn't already computed internally.
- Test to lock it: a replay fixture with known token counts per category (system prompt X, N skills loaded, M memory files) and assert the grid values.

### `/usage` (`/cost`, `/stats`) — Claude's full breakdown vs pi's raw balances

- Claude (evidence): `out/claude-tour-usage.txt` — tabbed panel (`Settings Status Config Usage Stats`), "Session" block (Total cost, Total duration API/wall, Total code changes, Usage input/output/cache read/write), then usage-limit bars for Current session / Current week (all models) / Current week (Fable) each with a reset time, then "What's contributing to your limits usage?" with %-based observations ("91% of your usage came from subagent-heavy sessions", "44% ... was at >150k context", etc, each with a one-line tip). Bundle: `name:"usage"`, `aliases:["cost","stats"]`, `description:"Show session cost, plan usage, and activity stats"` — **`/cost` is now just an alias of `/usage`, not its own command.**
- pi now (evidence): footer shows raw external-provider dollar balances (`deepseek $11.61 · openrouter $16.37`, Cuong's own choice per README's Not-matched list); `grep_pi.py "name:\"usage\""` / `"cost"` / `"stats"` all return nothing — no such command exists in pi.
- Difference: Claude shows session cost, duration, code-change stats, per-scope usage-limit bars and behavioural cost analysis; pi has none of this reachable from a command (only the footer's provider balances, which measure something different — provider account balance, not this-session cost).
- Severity: high (checked often to know how close to a limit / how expensive a session got).
- Feasible in pi: partial — session-scoped cost/duration/token counts are things pi already tracks for the footer math and `/session`'s "Tokens" block (see below), so a `/usage`-style command summarizing those is plausible as a new extension command; the "contributing to your limits" analysis is Anthropic-account-specific telemetry pi has no source for (would go in the Not-matched ledger like the subscription meters).
- Test to lock it: replay with known token/cost totals, assert a new pi `/usage` (once built) prints matching Session cost/duration lines.

### `/status` — Claude's full panel vs pi's thinner `/session`

- Claude (evidence): `out/claude-tour-status.txt` — same tabbed dialog, Status tab: Version, Session name (`/rename to add a name`), Session ID, Session kind, Peer address, cwd, Login method, Organization, Email, Cloud sessions, Model, `MCP servers: 9 connected, 1 need auth · /mcp`, Setting sources, Auto mode server, footer `Esc to cancel`. Bundle: `name:"status"`, `description:"Show Claude Code status including version, model, account, API connectivity, and tool statuses"`.
- pi now (evidence): `out/pi-settings-session-open.txt` — pi's closest command, `/session`, shows only "Session Info": File path, ID, Messages (Total/User/Assistant/Tools calls&results), Tokens (Input/Output/Total). No version, no login/org/email, no MCP connection count, no cwd, no permission-mode line.
- Difference: Claude's `/status` is an account+environment health panel; pi's `/session` is a message/token counter for the current session only — different purpose, and none of Claude's account/version/MCP-count fields exist anywhere in pi's slash commands.
- Severity: medium (checked less often than usage/context, but is the standard "is everything wired up" command).
- Feasible in pi: partial — version/model/cwd/MCP-count are all derivable locally; login/org/email don't apply the same way to pi's multi-provider model. A `/status`-named command could show pi's own equivalent fields without pretending to match Claude's account model.
- Test to lock it: none needed beyond documenting the gap unless a `/status` command is built in pi, then compare field-by-field against `claude-tour-status.txt`.

### `/help` — Claude's real command vs pi's `?`-card

- Claude (evidence): `out/claude-tour-help.txt` — tabbed "Help  General  Commands  Custom commands", intro paragraph, "New here? Run /powerup to learn the features most people miss.", a Shortcuts 3-column table (`! for shell mode`, `/ for commands`, `@ for file paths`, `/btw for side question` | `double tap esc to clear input`, `shift + tab to auto-accept edits`, `ctrl + o for verbose output`, `ctrl + t to toggle tasks`, `shift + ⏎ for newline` | `ctrl + shift + _ to undo`, `alt + v to paste images`, `alt + p to switch model`, `ctrl + s to stash prompt`, `ctrl + g to edit in $EDITOR`, `/keybindings to customize`), "For more help: https://code.claude.com/docs/en/overview", "Something else? Use /feedback to report bugs or request features."
- pi now (evidence): `extensions/claude-help/index.ts` — `?` on an empty prompt toggles a static 6-row/3-column card (README already lists this as its own, deliberately-approximate thing, not a `/help` command). Typing literally `/help` is **not** a registered pi command (`grep_pi.py "name:\"help\""` only matches Claude's own bundle, not pi's), so it falls into the same "unmatched slash → sent to the model as literal text" path as the first finding above.
- Difference: pi has no `/help` command at all; `?` is a different (narrower, keys-only) surface, and typing `/help` burns a real model turn instead of showing anything.
- Severity: medium (new/returning users reach for `/help`, not `?`, out of Claude Code habit).
- Feasible in pi: yes — register a `help` command in `claude-slash-menu`'s `BUILTIN_COMMAND_NAMES`/an extension that renders a similar card (content can reuse `claude-help`'s CARD data) so at minimum `/help` doesn't fall through to the model.
- Test to lock it: scenario typing `/help`, assert a local card renders and no model call happens.

### `/config` (`/settings`) — same shape, different persistence model

- Claude (evidence): `out/claude-tour-config.txt` (Config tab: `Auto-compact`, `Continue automatically at usage limit`, `Switch models when a message is flagged`, `Show tips`, … ~40 rows, boolean/enum values, `⌕ Search settings…` box, `↓ 12 more below`). **Live-verified side effect:** pressing Enter with a row highlighted in this dialog wrote `"autoCompactEnabled": false` straight into `~/.claude/settings.json` immediately — no save step, no confirmation, no "session only" notice anywhere in the dialog.
- pi now (evidence): `out/pi-settings-settings-open.txt` — pi's `/settings` shows the same shape (search box, `Type to search · Enter/Space to change · Esc to cancel`, ~30 rows: `Auto-compact`, `Auto-resize images`, `Block images`, …). Pi's `/model` picker (a related settings-style list, `out/pi-typo-result.txt`) explicitly labels itself `Session-only. Ctrl+Alt+S to save to settings.` — i.e. pi's convention (at least for `/model`) is changes don't persist until you explicitly save. Whether plain `/settings` toggles are session-only or immediate was **not verified live** (no row was actually toggled, to avoid a repeat of the Claude accident before confirming pi's save semantics); `~/.pi/agent/settings.json` mtime was unchanged after the whole probe, which is at least consistent with "not written on open/Esc" but doesn't prove what an actual Enter/Space toggle would do.
- Difference: confirmed Claude writes immediately; pi's related `/model` dialog explicitly does not (needs `Ctrl+Alt+S`). If `/settings` behaves like `/model`, this is a real, opposite-direction design difference (arguably pi's is safer) rather than a gap to close.
- Severity: medium — real behavioural difference, but direction/impact needs one more careful measurement.
- Feasible in pi: n/a (this is Claude that could be argued to want pi's "session-only + explicit save" model rather than the other way around) — flag for a product decision rather than a "port this" item.
- Test to lock it: on a throwaway `~/.pi` settings copy (never Cuong's real file), toggle one `/settings` row, press Esc without saving, diff the file — confirms session-only or not.

### `/resume` — structurally different pickers

- Claude (evidence): `out/claude-tour-resume.txt` — "Resume session" title, `⌕ Search…` box, sessions grouped by project folder (`work-claude`), each row = first-transcript-line-as-name + `7 minutes ago · HEAD · 2.4KB`, footer `Ctrl+A to show all projects · Ctrl+B to only show current branch · Space to preview · Ctrl+R to rename · Type to search ·`.
- pi now (evidence): `out/pi-resume-resume-open.txt` — "Resume Session (Current Folder)" title with an inline scope toggle `◉ Current Folder | ○ All`, `Name: All`, `Sort: Threaded`, hint rows `tab scope · re:<pattern> regex · "phrase" exact` and `ctrl+alt+s sort · ctrl+n named · ctrl+d delete · ctrl+p path (off) · ctrl+r rename`, bare `>` search prompt, empty state `No sessions in current folder. Press Tab to view all.`
- Difference: different title casing, different search-box chrome (icon+placeholder vs bare prompt), different columns (Claude: relative time/branch/size; pi: scope/sort/named-only/regex), completely different keybindings (Ctrl+A/B/Space/R vs Tab/ctrl+alt+s/ctrl+n/ctrl+d/ctrl+p/ctrl+r).
- Severity: high (used every time you switch sessions — one of the most common commands).
- Feasible in pi: partial — matching Claude's exact column layout and keybindings is a real rewrite of pi's resume picker, which also carries pi-specific features (regex search, delete, path toggle) Claude's doesn't have; a straight port would need to decide whether to drop pi's extra features or keep them alongside Claude's layout.
- Test to lock it: replay fixture with 2+ named/unnamed sessions across 2 projects, snapshot both pickers, diff columns/labels/keys.

### `/agents` — both sides are effectively empty now, but for different reasons

- Claude (evidence): `out/claude-tour-agents.txt` — `❯ /agents` / `⎿ The /agents wizard has been removed.` followed by "Ask Claude to create or update subagents for you (e.g. \"create a code-reviewer subagent that ...\"), or edit the files directly: • .claude/agents/ (this project) • ~/.claude/agents/ (all projects)" and a docs link. Bundle: `name:"agents"`, `isHidden:true`, `description:"(removed) Ask Claude to create/manage subagents, or edit .claude/agents/"` — confirms this is deliberately hidden from the menu/help list in 2.1.283, only dispatchable if typed exactly.
- pi now (evidence): no `agents` entry anywhere in `BUILTIN_SLASH_COMMANDS` or `extensions/`; typing `/agents` falls into the same "unmatched → sent to model" path as any other unknown command.
- Difference: Claude's `/agents`, even removed, still gives a real (free, local) informational reply; pi's `/agents` silently becomes a live model turn instead.
- Severity: low (neither side has real subagent-management UI here, so the practical gap is small — but the "typing it burns a turn in pi" part is the same class of bug as the general unknown-command finding).
- Feasible in pi: trivial once the general unknown-command fix lands (finding #1) — `/agents` could just be added to a small table of "known-but-removed" commands that print a static explainer.
- Test to lock it: covered by the general unknown-command scenario; add `/agents` as one of the probed names.

### `/compact` — spinner/notice confirmed on Claude; pi's guard blocked the same test

- Claude (evidence): live transcript `~/.claude/projects/...work-claude2/b95e590d-....jsonl` + `out/claude-compact-compact-spinner.txt` / `-spinner2` / `-done` and `out/claude-resumeview-final.txt`. Spinner: `· Compacting conversation… (0s)` → `(2s)` → `(12s · ↓ 558 tokens)`, with a tip row shown *during* compaction: `⎿ Tip: Name your conversations with /rename to find them easily in /resume later`. Final row (confirmed via the resumed transcript's real render): `⎿  Compacted (ctrl+o to see full summary)` in default-fg **dim**, muted `⎿` in `999999`. `compactMetadata` in the transcript: `trigger:"manual", preTokens:44811, postTokens:6927, cumulativeDroppedTokens:37884, durationMs:13730` for a conversation that was just one "Say OK" exchange — Claude has no minimum-size floor; the ~45k preTokens is System-prompt/tool-definition overhead, not conversation content.
- pi now (evidence): `out/pi-compact-compact-spinner.txt` and `out/pi-compact2-compact-done.txt` — both a bare "Say OK" exchange and a 7-tool-call fixture (`replays/task.jsonl` copy, resumed live) hit the same guard: `Error: Compaction failed: Nothing to compact (session too small)` in `ff6666`, drawn instantly with **no model call**.
- Difference: could not observe pi's actual compact-success spinner/summary/"Compacted"-style notice in this pass — pi's size floor is higher than either test conversation reached. This is itself notable: Claude compacts unconditionally (even when there's nothing worth summarizing), pi refuses below a threshold. Whether pi's *successful* path visually matches Claude's spinner/notice remains unmeasured.
- Severity: medium (compact is used often on long sessions, but the *refusal* behaviour on tiny sessions is a real, own-right difference, not just missing coverage).
- Feasible in pi: n/a for the refusal itself (arguably reasonable behaviour, unlike Claude's willingness to "compact" a 2-message exchange) — but the pi-success-path rendering vs Claude's still needs measuring once a big-enough fixture is built.
- Test to lock it: build a `replays/compact-big.jsonl` fixture large enough to clear pi's floor (need to find the actual threshold — not in scope here) and diff both sides' spinner/notice rows.

### Argument hints in the slash menu — inline placeholder vs none

- Claude (evidence): `out/claude-tour-model-arg.txt`, colours: `[fg=-]❯ [fg=99ccff]/model [fg=999999][model]` — once a command name is typed exactly + a space, Claude shows the `argumentHint` (`[model]`, and per the bundle also e.g. `[key=value]` for `/config`, `[reconnect|enable|disable [<server>|all]]` for `/mcp`, `<level>` for `/thinking`) as a **muted placeholder appended directly in the input row itself**, not in a dropdown.
- pi now (evidence): `out/pi-settings-model-space.txt` — typing `/model ` opens a **value-completion dropdown** (`→ claude-haiku-4.5   github-copilot`) instead; the input row itself just shows `❯ /model` with no trailing placeholder text. Pi's own `argumentHint` strings (`<provider/model>`, `<level>`, `<provider>` — from `grep_pi.py "BUILTIN_SLASH_COMMANDS="`) are only ever shown inside the dropdown's description column while the command name is still a *partial* match, never inline in the prompt row once the name is exact.
- Difference: two different mechanisms — Claude's is a static ghost-text hint that appears regardless of whether the command supports live completions; pi's is a live-filtered completion list that only exists for commands that implement `getArgumentCompletions` (`model`, `thinking`, `login`), and shows nothing for the others.
- Severity: low (cosmetic, but visible every time a known command is typed with a trailing space).
- Feasible in pi: yes — `claude-input`'s `promptLines`/`colourCommand` already knows the matched command; extend it to append the muted `argumentHint` text after the command+space when the typed text doesn't yet include arguments, independent of whether a completion dropdown also opens.
- Test to lock it: self-test in `claude-input`'s existing suite: given `/model ` and a command table with `argumentHint:"<provider/model>"`, `promptLines` should append the muted hint after the command.

---

## Already matches (no new finding)

- `No commands match "/x"` menu hint while composing an unmatched command — `out/claude-unknown-menu.txt` vs pi's `noMatchRow` in `extensions/claude-input/index.ts` (already in README's Matched list; re-verified live, unchanged).
- Two-line description wrapping with a trailing `…` in the slash dropdown — seen in both `out/claude-typo-menu.txt` (`/code-review`) and `out/pi-typo-menu.txt` / `out/pi-compact-compact-menu.txt` (`/skill:ponytail-gain`, `/skill:ponytail-help`); consistent with README's "two-line descriptions" Matched item.
- `/model`/`/modle` fuzzy ranking putting a "model"-ish result second rather than first for a near-miss query — both harnesses show comparable (not identical, but structurally similar) ranking behaviour for the same query; not re-flagging since the *matching* logic itself is the ported `ClaudeSlashMatcher` (README already covers this as Matched machinery) — the divergence is only in what Enter does with the result (see finding #2).

## Could not measure

- Exact colours/rows for `/exit` and `/quit` (Claude's bundle shows a dynamic description — `"Detach from this background session (it keeps running)"` vs `"Exit the CLI"` depending on `vt()`, i.e. whether the session is a background/headless one) were read from the bundle only, not exercised live — didn't want to repeatedly kill/relaunch the pinned Claude binary mid-investigation. pi's `/quit` description is static (`"Quit pi"`, `chunk-JVUZSMYM.js` `BUILTIN_SLASH_COMMANDS`), so the two are already known to differ in at least the "static vs dynamic wording" sense, but the actual exit *confirmation flow* (if any) on both sides is unmeasured.
- Whether pi's plain `/settings` (as opposed to `/model`'s Model Configuration) toggles are session-only or write immediately — avoided testing this live after the Claude `/config` accident, to not risk mutating Cuong's real `~/.pi/agent/settings.json`; needs a throwaway-settings-path test first (see that finding's "Test to lock it").
- pi's actual compact-success spinner/summary/notice rendering — both test conversations (a bare "Say OK" and a 7-tool-call fixture) were below pi's "session too small" floor; the real threshold and the success-path UI are unmeasured.
- `/status`'s "Auto mode server" and "Setting sources" rows, and the `/usage` "What's contributing to your limits" section beyond the first few lines (screen/terminal height cut the capture off at 43 rows) — have the visible portion, not the full scroll.

---

## Summary

11 real differences found (2 high-risk behavioural: silent-execute-on-typo, unknown-command-burns-a-turn; 5 "Claude has a whole command/panel, pi has nothing": `/mcp`, `/context`, `/usage`+`/cost`+`/stats`, `/status`, `/help`; 1 structural: `/resume` picker; 1 low-impact: `/agents`; 1 mechanism-only: argument-hint placement; 1 opposite-direction design/persistence difference: `/config` save semantics; 1 partially-blocked measurement: `/compact` success path). Severity: 0 high (by strict "every session" reading), 6 medium, 2 low, plus the `/mcp`/`/context`/`/usage`/`/resume` "whole feature missing" items I'd flag as practically high given how often Cuong reaches for them even though they're not literally every-session.

Top 5 by impact:
1. pi silently executes a different builtin command when Enter is pressed on a near-miss typo (no confirmation) — real risk of unintended `/clear`/`/new`/`/quit`/`/compact`.
2. `/mcp` doesn't exist in pi at all (Cuong runs ~10 MCP servers daily).
3. `/context`'s coloured category breakdown doesn't exist in pi (only a bare footer %).
4. `/usage`/`/cost` (session cost, duration, limit bars) doesn't exist in pi (only unrelated provider-balance numbers in the footer).
5. `/resume` picker is structurally unrelated between the two (columns, keybindings, search syntax all differ).

Also fixed one unintended side effect during testing: a live `/config` probe wrote `autoCompactEnabled: false` into Cuong's real `~/.claude/settings.json`; caught via mtime check and the key was removed (restoring "unset/default").
