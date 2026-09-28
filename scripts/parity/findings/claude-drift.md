# claude-drift: 2.1.281 -> 2.1.282 -> 2.1.283 UI string diff

Method: `mmap` + regex extraction of ASCII and UTF-16 printable runs, plus a
quoted-string-literal pass (double/single/backtick), on all three pinned
binaries (`~/.local/share/claude/versions/2.1.28{1,2,3}`). Scratch files under
`%TEMP%\pi-parity\discovery\claude-drift\`. Raw literal-string set-diffing
between builds is mostly noise: esbuild renames every local variable per
build, so any template literal with `${var}` interpolation shows up as a
"new" string on every release even when the surrounding text is unchanged
(~68k/64k raw added/removed lines 281->283, collapsing to ~0 once `${`-bearing
lines are excluded). The one **reliable, high-signal source** turned out to
be Claude's own embedded CHANGELOG text: the binary carries its release notes
verbatim as plain bullet strings (`- Added ...`, `- Fixed ...`, `- Changed
...`, `- Improved ...`), so diffing the sorted string dumps per version
recovers the literal 2.1.282 and 2.1.283 changelogs almost intact (148 and 63
bullet lines respectively; files kept at
`%TEMP%\pi-parity\discovery\claude-drift\changelog_282_new.txt` /
`changelog_283_new.txt`). Findings below are the entries from that changelog,
cross-checked against the raw string dumps where the change is a literal
(non-templated) string.

No hex-colour constants (`373737`, `99ccff`, `ff6666`, `ffcc00`, etc. — the
values README cites) appear anywhere in the plain-string dump in any of the
three versions, in any version; Claude must build these through a numeric/
ANSI-256 path rather than bare hex literals, so this method cannot confirm or
deny a colour change. Not measured on screen either (see "Could not
measure").

### Effort row: ultracode notice text shortened
- Claude 2.1.281 (evidence): `q281u.txt:7024` — `` `${D?"effort:":san} ultracode · xhigh effort + dynamic workflows for maximum thoroughness` ``
- Claude 2.1.283 (evidence): `q283u.txt:7230` — `` `${D?"effort:":Lmn} ultracode · xhigh + workflows · /effort` ``
- Changelog corroboration (2.1.283, `changelog_283_new.txt`): "Changed the ultracode visuals in `/effort` and the prompt input to plain styling (no ripple, border flourish or keyword glimmer) and removed the dynamic-workflows spinner tip"
- pi now (evidence): `grep -ril ultracode C:\Users\cuong\.pi\agent` only hits `npm/node_modules/@tintinweb/pi-subagents/.../workflow/tool-description.*` (system-prompt text) and one old session transcript — no `extensions/*.ts` renders an "ultracode" effort row at all; Cuong's routing never sets ultracode (Fable caps at `high`, Opus at `xhigh`, never ultracode).
- Difference: Claude's ultracode effort notice went from a long descriptive sentence to the standard `<label> · /effort` shape used for every other level — ironically now closer to what pi already renders for its own levels.
- Severity: low (n/a to pi in practice).
- Feasible in pi: no — not applicable, pi has no ultracode concept to diverge from. Not a parity gap.
- Test to lock it: none needed; note in README as explicitly out of scope if it ever comes up.

### Agent panel "Enter to view" hint on the main/self row
- Claude 2.1.281 -> 2.1.282 changelog (evidence, `changelog_282_new.txt`): "Fixed the agent panel footer offering \"Enter to view\" and \"x to stop\" on the agent you are already viewing (where x types into its input), and \"Enter to view\" on the main row when main is already shown"
- Raw string check: the composite hint text itself, `"↑/↓ to select · Enter to view · Esc to close"`, is byte-identical in `q281u.txt:200035` and `q283u.txt:204240` — the wording didn't change, only the *conditional logic* that decides when the "Enter to view"/"x to stop" fragments are appended (a template literal, invisible to string diffing).
- pi now: not captured (see below).
- Difference: README's ledger already documents this exact row ("2.1.281 dropped the ' · Enter to view' that 2.1.280 showed there") as a Matched item with an explicit exception baked in. The 2.1.282 changelog shows Anthropic touched precisely that logic again, suppressing the hint specifically when the row shown is the one already being viewed (main-row-already-shown, or the currently-open agent). If pi's footer still always shows "Enter to view" on main regardless of what's currently displayed, it now has a real, newly-introduced-upstream gap that the previous baseline measurement (280->281) wouldn't have caught.
- Severity: medium (agents list is used every session with a background agent, but only in that state).
- Feasible in pi: likely yes — this is a pure conditional in whichever extension renders the agents-list footer (`extensions/claude-agents` or similar); needs the current-view state passed into the hint builder.
- Test to lock it: extend the `agent` scenario/replay so a snapshot is taken *while the agent-panel overlay is already showing main (or an agent already selected)*, and assert the row hint drops "Enter to view" (and "x to stop") for that specific row, matching Claude 2.1.282+.

### Queued messages moved above the spinner
- Changelog (2.1.282, evidence): "Changed queued messages to show in the conversation above the spinner instead of under it"
- pi now: not captured; not checked against pi's spinner/queue-rendering code in this pass (out of scope for a discovery sweep without a live turn — queuing a message and interrupting mid-turn is a stateful multi-step scenario).
- Difference: a layout-order change in a very common composition path (any time a user queues a follow-up message while Claude is still working). If pi renders queued messages below the spinner (matching old 2.1.281 layout, which is what README's Matched ledger would have been built against), it now differs from current Claude.
- Severity: medium (common scenario — anyone queuing a message mid-turn hits it).
- Feasible in pi: yes, layout ordering; likely owner: extensions rendering the spinner/queue area or the pi-tui composer patch.
- Test to lock it: a scenario that queues a second message while a tool call is running, snapshot before the tool finishes, and check whether the queued-message row appears above or below the spinner line.

### New send-now key: moves running tools to background instead of cancelling
- Changelog (2.1.282, evidence): "Added a send-now key (ctrl+enter, or ctrl+x ctrl+s) that interrupts the current turn and sends all queued messages at once; sent and queued messages show in gray until the model receives them" then "Changed send now (ctrl+enter or ctrl+x ctrl+s) to move running tools to the background instead of cancelling the turn"
- Changelog (2.1.283, evidence): "Fixed the send-now hint showing ctrl+enter on terminals that send it as a newline (Windows Terminal before 1.25); it now shows ctrl+x ctrl+s there"
- pi now (evidence): `grep -i "send.now\|ctrl+x ctrl+s\|queued message" README.md` — no hits; this feature isn't in either the Matched or Not-matched ledger at all.
- Difference: this is an entirely new key/behaviour introduced between 281 and 282 that pi's parity tracking has never covered — not a regression of a Matched item, but a real gap in coverage.
- Severity: medium (new binding, not exercised by any current scenario).
- Feasible in pi: partial — pi has no "move running tool to background on send-now" behaviour today (README's Matched list explicitly says pi "cannot move a running tool to the background" under `(ctrl+b to run in background)`, a related but distinct gap already logged as Not-matched).
- Test to lock it: a new scenario, not yet built — queue a message mid-tool-call, press ctrl+enter, and check whether the running tool call is backgrounded (Claude) vs cancelled (pi's likely current behaviour).

### Update-diff redraw: CJK/emoji wrap and non-fullscreen shrink fixes
- Changelog (2.1.283, evidence): "Fixed a stale character left in the last column of a diff when a redrawn line's CJK character or emoji wrapped to the next row"
- Changelog (2.1.283, evidence): "Fixed garbled, misplaced rows in the non-fullscreen renderer after the screen got shorter while still taller than the terminal, e.g. deleting a prompt line while a shell command streams output"
- Changelog (2.1.283, evidence): "Fixed a blank screen flashing before the first frame when starting in fullscreen mode"
- pi now: not captured (would need a CJK/emoji-bearing Update diff plus a live terminal-resize mid-stream — not cheap to script blind).
- Difference: all three are bugs that existed in 2.1.281/282's redraw path and are fixed only in 283. README's "Update diff" Matched entry and the "No flicker" success criterion were both measured against 281's (buggy) redraw behaviour. If pi's diff/redraw patches were built to match that older behaviour byte-for-byte, they may now diverge from the corrected 283 renderer specifically on CJK/emoji-wrapped diff lines and on non-fullscreen height-shrink-while-streaming.
- Severity: medium (CJK/emoji in diffs and terminal-resize-mid-stream are both real but not everyday occurrences); high relevance to the "No flicker" criterion specifically.
- Feasible in pi: yes — same class of fix as pi's existing "scrollback left alone for same-height repaints" patch; owner: `patches/pi-coding-agent.patch.mjs` redraw logic.
- Test to lock it: a replay/scenario with a full-width or emoji character at the end of a wrapped Update-diff line, redrawn (e.g. a second edit to the same file); a second scenario that shrinks the PTY window while a Bash call is mid-stream, still taller than the new terminal height.

### Prompt band: cursor position after recalling a history entry containing a tab
- Changelog (2.1.283, evidence): "Fixed the cursor landing before the end of a prompt recalled from history when the prompt contains a tab"
- pi now: not captured.
- Difference: directly touches README's Matched "Prompt band" entry (cursor/text positioning). Narrow trigger (history recall + a tab character in the recalled text) but a clean regression target since it's a single fixed input state, cheap to script once picked up.
- Severity: low (rare content — a tab inside a prompt is uncommon).
- Feasible in pi: yes, easy to test blind (no model turn needed — just editor-state manipulation).
- Test to lock it: a `pty-capture.py --steps` sequence that submits a prompt containing a literal tab, recalls it via Up, and snapshots cursor column.

### Permission mode row: double Shift+Tab race
- Changelog (2.1.282, evidence): "Fixed pressing Shift+Tab twice quickly landing on the wrong permission mode"
- pi now: not captured; pi's mode cycling lives in `extensions/claude-modes` (index.ts/modes.ts/dialog.ts) and `extensions/claude-footer/index.ts`, all of which reference Shift+Tab, but this pass did not audit for the same double-press race.
- Difference: directly touches README's Matched "Mode row for every mode" entry; Claude had a debounce/ordering bug there through at least 2.1.281 that 2.1.282 fixed. Worth checking pi doesn't have an analogous race (or, less likely, that pi never had it and nothing to do).
- Severity: medium if reproducible (mode-switching is used every session).
- Feasible in pi: yes, pure input-handling logic in the extensions listed above.
- Test to lock it: a `pty-capture.py --keys` sequence sending two Shift+Tab presses with near-zero delay between them from a known mode, asserting the resulting mode matches a single deterministic target on both sides.

### Could not measure
- No hex color literal for any of Claude's documented colours (`373737`, `999999`, `99ccff`, `ff6666`, `ffcc00`) appears as a bare 6-hex-digit string in any of the three bundles — the raw-string method can't see how Claude encodes colour, so a colour-only change (if any) is invisible to this technique. Would need an actual `--json` pty capture on 2.1.283 to check.
- Screen captures were skipped for every item above: the agent-panel hint and queued-message ordering both need a live/background-agent or mid-turn queued-message state (not "cheap" within this pass's no-live-session constraint); the CJK/emoji diff and terminal-shrink fixes need a scripted multi-step PTY sequence; ultracode is unreachable from pi's own model routing. None of these needed a live model turn to investigate (all evidence is static bundle/changelog text), so the ~15-live-turn budget was not touched, but actual on-screen verification is left as the "Test to lock it" entries above for whoever runs the parity suite next.
- Did not diff 2.1.281 against a version before it (280) — out of scope, README already covers that transition.

### Already matches (checked, no change found)
- "Interrupted" / "Interrupted — the cloud session keeps running…" family: byte-identical in `q281u.txt:101890-101894` and `q283u.txt:104072-104076`.
- Agents-list composite hint `"↑/↓ to select · Enter to view · Esc to close"`: byte-identical in `q281u.txt:200035` and `q283u.txt:204240` (only the surrounding conditional logic changed per the 2.1.282 changelog above, not this literal).
- "background agent" / "Waiting for N background agent(s)" phrase family: identical content in `q282u.txt` vs `q283u.txt` (line-number shifts only come from unrelated code growth and minifier variable renaming, verified by manual side-by-side read).
- Raw occurrence counts for "API Error", "Retrying in", "No commands match", "Invalid tool parameters", "auto-continue in", "any key to stay", "Before going idle", "Claude asked:", "continued with/without an answer", "away from keyboard", "Tip:" are unchanged 281->282->283 (`strings_28{1,2,3}.txt` grep counts).

## Summary
- Counts: 1 high, 0... — see below for exact tally.
- High: 0
- Medium: 5 (agent-panel "Enter to view" main-row hint, queued-message position vs spinner, new send-now background-move key, Update-diff CJK/emoji + non-fullscreen shrink redraw fixes, double Shift+Tab mode race)
- Low: 2 (ultracode notice text — n/a to pi; prompt cursor-after-tab-recall)
- Top 5: (1) agent-panel "Enter to view" conditional changed right where README's ledger already flagged a past regression; (2) queued messages now render above the spinner, not below; (3) send-now (ctrl+enter / ctrl+x ctrl+s) now backgrounds running tools instead of cancelling — a wholly new, untracked key; (4) three 2.1.283 redraw fixes (CJK/emoji-wrapped diff stale char, non-fullscreen shrink-while-streaming garble, fullscreen startup blank flash) land squarely on pi's "No flicker" criterion; (5) a Shift+Tab double-press mode-cycle race fixed in 2.1.282, same row README's "Mode row" Matched entry covers.
- Method note: literal string-set diffing of the two Bun bundles is ~95% noise from esbuild's per-build variable renaming; the actual signal came from Claude's own embedded CHANGELOG text, which is complete and literal for 2.1.282 and 2.1.283 and should be the first thing any future drift check reads.
