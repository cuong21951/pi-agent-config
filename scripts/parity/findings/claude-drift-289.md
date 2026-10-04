# claude-drift-289: 2.1.283 -> 2.1.289 terminal-UI change inventory

Method: `mmap` + regex over `claude-2.1.283.exe` and `versions/2.1.{287,288,289}`
(scratch: `%TEMP%\pi-parity\discovery\claude-drift-289\`). The 2.1.289 binary embeds
Claude's release notes as one single-quoted JS string (function `wgr()`, byte
offset ~221,579,425) with per-version headers `## 2.1.287` ... `## 2.1.282`.
That gives the notes for **2.1.284, 285, 286, 287 verbatim** (430 bullets:
287 = 106, 286 = 88, 285 = 136, 284 = 100; saved as `c284_287.txt`).
**2.1.288 and 2.1.289 have no entry in their own binary's changelog** (newest
header is 2.1.287 in both, and the 288/289 bundles are byte-for-byte the same
note string), so nothing is known about 288/289 from release notes; the three
binaries share the same text. Literal-string corroboration below counts
occurrences in the JS region (offset >= 150 MB) of the 283 vs 289 binaries; the
changelog text itself adds one hit to each count in 289, which is noted where it
matters. Raw literal diffing is not used (minifier renaming, see claude-drift.md).

Evidence tags: **literal** = a non-templated string exists in 289 and not in 283;
**changelog only** = release note, no literal could be isolated (template/UI
logic); **contradicted** = code literal still shows the old form in 289.

## Items (ranked by severity x how often a user hits it)

### 286/287 Permission prompts: command / tool call shown between dashed lines
- Claude old evidence: 2.1.283 Edit prompts already have the dashed block (README line 75, measured byte-for-byte); Bash/PowerShell/Monitor/MCP/fetch/skill prompts did not.
- Claude new evidence (changelog only): 286 "Improved Bash, PowerShell and Monitor permission prompts to show the command between dashed lines, matching file edit prompts" and "fetch, skill, file read, sandbox network, Claude in Chrome, workflow script and notebook edit permission prompts to match the look of file edit prompts"; 287 "MCP and other tool permission prompts to show the tool call between dashed lines" and "prompt for a held message from another session ... between dashed lines". Glyph literals `╌`/`┄` counts are unchanged (3/5 vs 3/4), so the dash char is not newly introduced.
- pi now: `extensions/claude-modes/dialog.ts` draws `Do you want to proceed?` (line 31, 250, 299) with the bash command as plain text; the only dashed rule is the plan box (`insetRule(..., "╌")`, line 162). README line 75: MCP/web-fetch/Skill asks belong to `@gotgenes/pi-permission-system` and "were not measured".
- Difference: differs now (Bash) / not covered (MCP, fetch, skill, other tools). Exact box geometry (rule width, blank rows) needs a capture.
- Severity: high (every Bash permission prompt).
- Feasible in pi: yes for Bash/Edit-style in `claude-modes/dialog.ts`; MCP/fetch/skill need the `pi-permission-system.patch`.
- Test to lock it: scenarios `permission` and a new MCP/WebFetch permission scenario; `diff.py` against a 2.1.289 capture.

### 286 Permission prompt shows "N of M" when requests stack
- Claude old: none. Claude new (changelog only): 286 "Added a count such as \"2 of 5\" to the permission prompt when several permission requests stack up"; 287 "waiting permission prompts ... show oldest first, so a new prompt no longer covers the one you're reading (prompts with a countdown still open on top)". No isolated literal (template).
- pi now: not covered (`grep "of 5\|oldest" extensions patches README.md` has no hit; pi shows one dialog at a time).
- Difference: new header count and queue order; only visible with parallel tool calls needing approval.
- Severity: medium. Feasible: partial (needs a permission queue in `claude-modes`; pi's permission system is per call). Test: mock replay with two parallel Bash calls requiring approval.

### 286 List overflow rows `↑ N more` / `↓ N more`, scrollbar arrows, clickable "N more" rows
- Claude old (literal, 283): `[Z.arrowUp," ",D.start," more above"]` and `...," more below"]` in list renderers; a helper `T$=(h,k)=>[h>0?\`↑ ${h} more\`...]`; mouse buttons `↑ ${n} more above`.
- Claude new (literal, 289): the **same** `"more above"` / `"more below"` renderers are still present (9 vs 8 hits for ` more above`, the +1 is the changelog line), and `f$=(h,E)=>[h>0?\`↑ ${h} more\`...]` is the 283 helper renamed. Changelog (286): "Changed the overflow rows of lists to read \"↑ N more\" / \"↓ N more\" instead of \"N more above\" / \"N more below\"", "list scrollbars ... now has ↑/↓ arrows you can click or hold", "mouse support for the \"N more\" rows ... click one to jump to that end".
- Status: changelog only and partly **contradicted**: a `↑ N more` helper already existed in 283, and the old wording survives in some 289 renderers. Which list uses which form cannot be told from strings.
- pi now: `↑ N more` already used by the main-row agent hint (`patches/pi-subagents.selftest.ts:43`) and README line 112 (`↑ 1 more` in pi's editor). No scrollbar arrows or mouse "N more" in any extension.
- Difference: scrollbar arrows and mouse jump are new interaction pi lacks; text form is probably already matched.
- Severity: medium (fullscreen lists only). Feasible: text yes, mouse partial (`claude-scroll`). Test: capture `/resume` with 30 sessions at 18 rows on 289.

### 286 Prompts sent while idle appear in the normal text colour immediately (not gray)
- Claude old: 2.1.282 "sent and queued messages show in gray until the model receives them" (claude-drift.md). Claude new (changelog only): 286 "Changed prompts sent while nothing is running or queued to show in the normal text color right away instead of gray".
- pi now: README line 104 documents the queued layout (`Steering: …` above the tool vs Claude's grey `❯` row); no mention of the idle-send colour.
- Difference: every submitted prompt, first frame only. Severity: medium (every turn, but one frame). Feasible: yes, `extensions/claude-messages`. Test: snapshot immediately after Enter (before the first model chunk) and diff the `❯` row colour.

### 287 Light-theme prompt border and `❯` before earlier messages: contrast improved
- Claude new (changelog only): "Improved the contrast of the prompt input border in light themes and of the ❯ before your earlier messages". Hex values are not literals in the binary (see claude-drift.md), so the new colour is unmeasured.
- pi now: README ledger measures dark-daltonized colours only; `themes/` holds pi's themes. Not covered for light themes; the dark `❯` colour is unaffected as far as the note says.
- Severity: low (light theme only). Feasible: yes once measured. Test: capture the light theme on 289 and compare SGR on the border and the `❯` row.

### 286 List screens align details in one column; `/hooks`, theme picker, output style picker restructured
- Claude new (changelog only): 284 "Improved lists such as /tasks, /copy and /hooks: details ... line up in one column when they fit, otherwise sit at the right edge"; 286 "Changed list screens (/artifacts, /mcp, /skills, /hooks ...) to always line up each row's details in one column after the names"; "/hooks opens on one list ... grouped by event"; "theme picker ... scrolling list ... number keys no longer pick a theme"; "output style picker opens on your current style ... description on the line under its name; number keys no longer pick a style"; 284 "/artifacts filter tabs beside the title (All, Mine, Shared)"; 284 "/model picker ... '+1 model' count covers only models below the visible rows"; 284 "tab bars ... a tab that doesn't fit moves to the next line whole".
- pi now: `extensions/claude-tasks/index.ts` (listRows), `claude-slash-menu`, `claude-resume`, `claude-panels/tabs.ts` exist; `/hooks`, `/config`, theme and output-style pickers, `/artifacts` are not in the README ledger (grep no hit). `/tasks` row layout was measured on 283.
- Difference: not covered (pickers) / differs now (`/tasks`, `/mcp` column alignment, measured on 283).
- Severity: medium. Feasible: yes per screen. Test: `slash/tasks`, `slash/mcp-missing` re-captured on 289.

### 287 `/config` row editing and `/memory` toggles
- Claude new (changelog only): "Improved /config: settings that cycle show ‹ › and step both ways with ←/→, narrow terminals stack each value under its label, and PgUp/PgDn page the list"; "/memory: left and right arrow keys flip its on/off settings". Literal `‹` 11 -> 12, `›` 21 -> 24 (counts include the changelog line).
- pi now: not covered (`grep "/config\|/memory" README.md` nothing; `claude-memory` is a memory extension, not this dialog).
- Severity: low-medium. Feasible: yes where pi renders `/config`. Test: capture `/config` at 80 and 40 columns.

### 287 Agents view `n:<text>` filter; replies and slash commands queue
- Claude new: changelog + literal: "Added an `n:<text>` filter to the agents view that matches session names and tasks"; `n:<` literal 5 -> 6 hits (the +1 is the changelog line). 287 "Changed replies from `claude agents` to arrive as queued messages; slash commands other than /stop sent while a turn is running now run when it ends".
- pi now: README line 85 documents the agent view (M6-F) with `↑/↓ to select`, no filter row.
- Severity: low (needs the background-session agents view). Feasible: partial. Test: m6f-view with a typed `n:` prefix.

### 285 `/tasks` folds Claude's own background work under one "System tasks" row
- Claude old: no literal. Claude new (literal): `e1="System tasks"` in 289 (2 hits: code + changelog), 0 in 283; Enter on it shows the tasks.
- pi now: `extensions/claude-tasks/index.ts` lists running/completed tasks flat (lines 140-145); no System tasks row. Not covered; pi has no equivalent internal tasks (memory import, MCP task) so a row would be empty and Claude hides it then.
- Severity: low. Feasible: n/a (no system tasks in pi). Test: none needed.

### 284 Ultracode is its own toggle in `/effort`; new keybinding actions
- Claude new (literal): `toggleUltracode` 0 -> 5 hits, `effortSlider` 3 -> 17. Changelog: "Changed Ultracode into its own toggle in /effort (Tab, or /effort ultracode [on|off]): it no longer forces xhigh effort and stays on at any effort level"; "Added effortSlider:decreaseEffort, increaseEffort and toggleUltracode keybinding actions".
- pi now: `extensions/claude-effort` renders the effort row; no ultracode concept (see claude-drift.md "Effort row"); README `grep -i ultracode` nothing.
- Severity: low (n/a for Cuong's routing). Feasible: no. Test: none; note as out of scope.

### 284 Auto mode default; auto-mode read prompt gets "Yes, but ask again next time"
- Claude old: 283 literal has `ask_again:"No, and ask again next time"` (2 hits of `ask again next time`). Claude new (literal): `allow_once:"Yes, but ask again next time"` is new (0 -> 2 hits of the full phrase), next to `"No, and ask again next time"` and the sentence "Auto mode and the sandbox read outside the working directories without ask...". Changelog 284/285: interactive sessions and VS Code start in auto mode when no permission mode is configured, on every plan and provider.
- pi now: `extensions/claude-modes/modes.ts:11` has `⏵⏵ auto mode on` footer text and `AUTO_UNAVAILABLE_NOTICE`; the read-outside-cwd dialog and its three options are absent (grep `ask again` no hit). pi's start mode is its own setting.
- Severity: low-medium (only if the read-outside prompt appears). Feasible: partial. Test: n/a until pi has the classifier prompt.

### 284 Usage-limit wait block, `/rate-limit-options`, `/mcp reconnect all`, Monitor rows
- Claude new: changelog + literal. `/mcp reconnect all` exists in 283 for the remote reply path and is now also an interactive-terminal action (2 -> 4 hits). `Continue automatically at usage limit` 1 -> 2 hits (changelog). `rate-limit-options` 12 -> 12 (already in 283 code; only the `/help` entry is new). Changelog: "usage-limit wait ... countdown with the usage-credits option now show as one block under the prompt"; "Monitor event rows ... show what each event printed instead of repeating the description, and stopped repeating an unchanged `Waiting for N … to finish` line after every event".
- pi now: no usage-limit wait, no `/mcp reconnect all` (`grep` no hit), Monitor rows not in README (`✻ Waiting for N background agent(s)` is matched, line 44).
- Severity: low (Claude-account features). Feasible: usage-limit no; `/mcp reconnect all` partial via `pi-mcp-adapter.patch`; Monitor rows unknown. Test: n/a.

### 286 Send-now in a subagent's view / on a skill's shell command moves the command to the background
- Claude old: 2.1.282 send-now (README line 46 matched for main-row bash; line 104: send-now screen not in the suite). Claude new (changelog only): 286 "send now (ctrl+enter) in a subagent's view moves the subagent's running command to the background"; "move a skill's own shell command to the background instead of ending it". Literal `Send now` appears only in SDK schema text (`send_now:M().optional()...`), not a TUI string.
- pi now: `extensions/intent-tools/index.ts:243` (ctrl+enter / ctrl+s chord) and `shells.ts:181` implement main-row send-now with Claude's notice. The subagent-view case and skill shell commands are not handled (README line 85: running bash in the agent view offers no `(ctrl+b ...)`).
- Severity: low. Feasible: partial. Test: m6f-view plus ctrl+enter on a running bash inside the agent view.

### 286 `/compact`, `/clear`, `/rewind` typed while viewing a background agent: confirmation dialog
- Claude new (changelog only): "a dialog now names the target and asks first". pi now: not covered (README agent view section does not mention it; pi's agent view says `/command` still runs as a command, line 85).
- Severity: low-medium (a destructive action lands on the wrong transcript in pi). Feasible: yes, `claude-tasks`/`claude-commands`. Test: m6f-view typing `/clear`.

### 287 Bash permission prompts: no internal parser names
- Claude old (literal): `simple_expansion` 25 hits in 283; new 289: 29 (still present in code; they are identifiers/maps). Changelog: "Fixed Bash permission prompts showing internal parser names such as \"Contains simple_expansion\" instead of a plain explanation".
- pi now: pi's permission dialog never prints that reason. Already matched (no equivalent text). Severity: n/a.

### 287 Reduce motion also freezes the running-tool dot and three spinners
- Claude new: changelog + literal count `Reduce motion` 1 -> 2 (changelog). pi now: README line 37 notes Claude's `reducedMotion` for streaming text only; pi has no reduce-motion switch for the blinking group dot (README line 39). Not covered; severity low; feasible yes in `claude-working`/`claude-tools`.

### 285 `&nbsp;` rendering, 286 collapsed-row click, 287 right-click paste on release, 286 Ctrl+G line number
- Claude new (changelog only): `&nbsp;` no longer literal in markdown; click on gap of a collapsed row ("Thought for 4s") expands in fullscreen; right-click paste on Windows/Linux happens on button release; Ctrl+G opens the editor on the prompt's cursor line.
- pi now: markdown is `claude-messages` (not checked for entities); `Thought for` rows exist (`claude-bottom-input/index.ts:17`) but are not clickable; right-click paste and Ctrl+G line number not covered.
- Severity: low. Feasible: yes except mouse (needs pi-tui). Test: markdown reply with `&nbsp;` in a table.

### 284 Fullscreen scroll fixes and 285 transcript freeze fix
- Changelog only: 284 "fullscreen scroll position jumping ... when a reply finished streaming while scrolled up", "`[` in transcript mode ... erasing terminal output above"; 285 "fullscreen ctrl+o transcript freezing briefly ... hundreds of file reads"; 287 "fullscreen sessions ... unrecoverable interface error while a scroll key was held". pi now: M6b screen model measured on 283 (README line 114); these are bug fixes in behaviours pi already copies, so pi should not copy the old bugs. Severity low; no test beyond M6b scroll scenarios re-run.

### 286 Model fallback / autocompact-thrashing notice names the 1M -> 200K drop
- Claude new (literal): `1M to 200K` 0 -> 1 hit (changelog). pi: no fallback notice of this kind (auto-fallback.json is pi's own). Not covered; severity low; n/a to pi.

## Could not measure
- 2.1.288 and 2.1.289: no release notes in the binaries; any UI change made only in those two builds is invisible to this method. 2.1.284-286 binaries are not on disk, so their literals were not diffed individually (the 287 binary was not mined separately; its changelog is the same set).
- Colours (light-theme border, `❯`) are not hex literals; need a live capture on 289.
- Overflow wording: the old `more above` renderers remain in 289 beside the helper that already produced `↑ N more`; which screen changed needs a live capture.
- Dashed prompt boxes and the "N of M" header are template-driven; geometry needs a capture.
- No `claude.exe` was run (constraint), so nothing was observed on screen.

## Counts
- Bullets in 2.1.284-287 notes: 430 (287: 106, 286: 88, 285: 136, 284: 100).
- Kept (TUI-visible, grouped into the 19 entries above): 41 bullets.
- Dropped: 389 (VS Code about 70, cloud sessions/Remote Control/Claude Tag/Code Review about 70, API/SDK/MCP-protocol/hooks/plugins/marketplace/auth/Bedrock/Vertex/gateway/`/ultrareview`/`claude-api`/artifact tool/enterprise about 235, screen-reader mode 12).
- Of the kept entries: already matched 1 (parser names), differs now 3 (dashed prompt boxes, idle prompt colour, `/tasks` list layout), not covered 15.

## Verdicts (M8, 2026-10-04, measured on the pinned 2.1.289 with the suite and the measuring scenarios)

The first full run against 2.1.289 was 8/74. Every difference fell into one of these, each re-measured on screen or read from the bundle:

| Item | Verdict | Evidence |
| --- | --- | --- |
| `❯` before earlier messages (287) | ported: `999999` on every transcript prompt row, the sticky copy keeps `505050` | 164 rows `999999`, 17 sticky rows `505050` in the 2.1.289 captures; `claude-messages/gutter.ts`, `claude-tasks` |
| Prompts sent while idle in the normal colour (286) | ported: an idle send is `ffffff` at once; only a message joining a running turn stays grey | `retry-live` `retrying` snapshot |
| Permission prompts between dashed lines (286/287) | ported for Bash, Edit and Write (one frame for all three); MCP, Fetch and Skill dialogs stay with M10 (pi asks nothing there) | `permission`, `m2-edit-permission` |
| Session-start row (not in the notes, 288 or 289) | ported: the `agents-md` notice goes to the debug log, so Claude draws no row; pi's `Ponytail loaded` row removed and the header ends in two blank rows | bundle `s.ui.log(…, {to:"debug"})`; 0 of 74 captures |
| A ready notification joins the turn (not in the notes) | harness: 2.1.289 runs a notification that is already queued when the turn ends without a done line between (2.1.283 drew `✻ … for 0s · done` first); pi holds a notification about 300 ms, which only a scripted instant reply can beat, so the scripted `asked` reply now takes 1.5 s | `m6g-resume` (3 of 3 before, clean 2 of 2 after) |
| `sonnet` alias (not in the notes) | harness: the alias is Sonnet 5.5 in 2.1.289 and pi's cases run Copilot's Sonnet 5, so the four Sonnet cases pin `claude-sonnet-5` | `modes`, `modes-default`, `plan` |
| Fullscreen scroll fixes (284/285/287) | matched: the `screen-*` cases are clean once the header heights agree | `screen-scroll-replay`, `screen-sticky-replay`, `screen-newmsg`, `screen-size-*` |
| List details in one column, `/tasks` (284/286) | matched for `/tasks` (the `m6f-view` `tasks` snapshot is clean); `/hooks`, `/config`, the theme and output-style pickers and `/artifacts` have no pi counterpart | `m6f-view` |
| Parser names in Bash prompts (287) | already matched | pi never printed them |
| "N of M" on stacked permission prompts (286/287) | deferred to M10 (needs a prompt queue) | changelog only |
| Auto-mode read prompt, auto as the start mode (284/285) | deferred to M10 (pi has no classifier prompt) | literal only |
| `/compact`, `/clear`, `/rewind` confirmation while viewing an agent (286) | deferred to M10 | changelog only |
| Send-now inside an agent view or on a skill's command (286) | deferred to M9 with the queued-message layout | changelog only |
| `↑ N more` rows, scrollbar arrows, clickable rows (286) | deferred to M9 (panels); the wording is contradicted by the bundle | literal counts |
| Agents view `n:` filter (287) | deferred to M10 | literal |
| Reduce motion freezes the dot and spinners (287) | not ported: pi has no reduce-motion switch | changelog |
| `&nbsp;`, click on a collapsed row, right-click paste, Ctrl+G line (285-287) | deferred to M9 or M10, unmeasured | changelog only |
| Light-theme border contrast (287) | M12 | changelog only |
| System tasks row, Ultracode toggle, usage-limit wait, model fallback notice, `/mcp reconnect all` | not applicable: no pi counterpart (account or Claude-internal) | literals |
