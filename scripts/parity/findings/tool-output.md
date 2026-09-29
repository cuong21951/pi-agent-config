# tool-output parity findings

Area: tool rendering details beyond the README Matched list — bash truncation/ANSI/stderr/timeout/background,
ctrl+o expanded transcript layout, Read of large file/image/PDF, Grep/Glob with many results, Write preview cut,
multi-file Update, todo list tool, parallel calls with one failing, long single-line wrapping.

Claude measured: bundle `C:\Users\cuong\.local\share\claude\versions\2.1.283` (mmap+regex, `bgrep.py` in scratch
dir) plus one live-replay capture pair built with `scripts/parity/session.py` + `run.py --replay` / direct
`pty-capture.py` (zero model cost: pi replayed a session file, Claude drove `mock.py` on `127.0.0.1:19042`,
real bundled `claude.exe --model haiku`, port range 19040-19042). pi measured from
`C:\Users\cuong\AppData\Roaming\npm\node_modules\@earendil-works\pi-coding-agent\dist\core\tools\*.js`
(the real global npm install pi's shim resolves to — NOT the stale Volta copy at
`...\Volta\tools\image\packages\@earendil-works\pi-coding-agent`, which has no `dist/bundle`) and
`C:\Users\cuong\.pi\agent\extensions\claude-tools\*.ts`. Scratch files under
`%TEMP%\pi-parity\discovery\tool-output\`.

### Todo list tool has no pi counterpart at all
- Claude (evidence): bundle strings — `app:toggleTodos` bound to `ctrl+t`, `showExpandedTodos`/`expandedView`
  state, tool result text `"Todos have been modified successfully. Ensure that you continue to use the todo
  list to track your progress..."`, nudge text `"The TodoWrite tool hasn't been used recently..."`,
  `turnsSinceLastTodoWrite`. A full stateful tool with its own keybinding and persistent expand/collapse view.
- pi now (evidence): `dist/core/tools/index.js` `allToolNames = new Set(["read","bash","powershell","edit",
  "write","grep","find","ls"])` — the complete built-in tool roster. No todo/task tool exists anywhere in pi
  core or in `extensions/*` (grepped `todo|Todo` across `extensions/`; only hits are the unrelated example
  filename `todo.md` used in Create/plan tests).
- Difference: Claude has a whole tool (TodoWrite) with a live checklist rendered under the spinner while
  working and a `ctrl+t`-toggleable expanded view; pi has nothing that produces this row, this keybinding, or
  this behavior.
- Severity: high (any session using TODO tracking, which Claude nudges toward, has zero pi equivalent).
- Feasible in pi: partial — needs a new built-in tool (schema + state + renderer + keybinding), not just a
  rendering tweak. Likely owner: new `extensions/claude-todos` + a pi core tool registration, unlike anything
  patches/README's "port a diff" recipe covers.
- Test to lock it: a `session.py` spec with a `todo_write`-shaped toolCall is not renderable until the tool
  exists; first build needs the real tool, then a replay fixture recording pending/in_progress/completed rows
  and the ctrl+t toggle.

### run_in_background bash and its later notice: pi has no such tool call at all
- Claude (evidence): bundle function `OLn({backgroundTaskId,outputPath,backgroundedByUser,
  backgroundedToDeliverMessage,timedOutAfterMs,reapedAtFinalResponse,readToolName})` builds four distinct
  notices: manual background (ctrl+b) → `"Command was manually backgrounded by user with ID: {id}. Output is
  being written to: {path}."`; a message arrived while running → `"Command was moved to the background (ID:
  {id}) so that a message that arrived while it was running can reach you; it was not interrupted. Output is
  being written to: {path}. You will be notified when it completes. To check interim output, use {tool} on
  that file path."`; timeout-without-kill → `"Command did not complete within its {N}s timeout and was moved
  to the background (ID: {id})..."` + the same two trailers; plain `run_in_background:true` from the start →
  `"Command running in background with ID: {id}. Output is being written to: {path}. You will be notified when
  it completes. To check interim output, use {tool} on that file path."`. Backing tools: `BashOutputTool` →
  user-facing `BashOutput`, and `KillShell`/`KillBash` aliased to the current name `TaskStop`
  (`var i={Task:"Agent",KillShell:"TaskStop",KillBash:"TaskStop",...}`, `backgrounding:"never"` on the kill
  tool itself, `searchHint:"kill a running background task"`).
- pi now (evidence): `dist/core/tools/bash.js` — `bashSchema = Type.Object({command, timeout})`, no
  `run_in_background` field, no `description` param even (that's added by a patch per README). `allToolNames`
  (above) has no BashOutput/TaskStop/KillBash equivalent. Grepped `run_in_background|runInBackground` across
  the whole npm install's `dist/bundle/cli.js`: zero hits.
- Difference: the entire feature (start-backgrounded, auto-background-on-timeout, check-output tool, kill
  tool, all four notice strings) does not exist in pi.
- Severity: high (silent capability gap — pi can never produce this even by accident, and a session recipe
  ported from Claude's system prompt referencing `run_in_background` would just fail).
- Feasible in pi: partial — real engineering (detached process + output-file polling + two new tools), not a
  rendering port; likely owner: pi core patch (`patches/pi-coding-agent.patch.mjs`) plus a new renderer
  extension, well beyond the usual "port a diff" pattern.
- Test to lock it: not buildable as a pure replay fixture since it needs the tool to exist first; once it
  does, a `session.py` spec with a `bash` toolCall carrying `run_in_background:true` and a later
  `BashOutput`/`TaskStop` call, replayed both sides.

### Bash timeout: Claude can background instead of killing; pi always kills
- Claude (evidence): two live code paths found. (1) `OLn(...)` above — when `timedOutAfterMs !== undefined`,
  the command is *not* killed, it is moved to background and the agent is told to poll `BashOutput`. (2) A
  separate kill path (`this.#e==="killed"` after `SIGTERM`/`SIGKILL`) appends `` `Command timed out after
  ${Zt(this.#p)}` `` to **stderr** specifically, keeping stdout separate.
- pi now (evidence): `dist/core/tools/bash.js` line ~255 — on timeout the child is always
  `killProcessTree(child.pid)`'d, then `throw new Error(appendStatus(text, \`Command timed out after
  ${timeoutSecs} seconds\`))` — the whole result becomes a thrown Error with the status text appended to the
  single merged output blob (no stdout/stderr split, see next finding), and there is no backgrounding branch
  at all.
- Difference: Claude's Bash tool sometimes survives a timeout (auto-backgrounds, still checkable); pi's Bash
  tool always dies on timeout and the call is drawn as a failed/error result. Wording is superficially close
  ("Command timed out after N seconds/s") but pi has no analog to the background-and-continue path.
- Severity: medium (only visible on long-running commands that hit `timeout`, but changes agent behavior, not
  just cosmetics — a real timeout scenario in Claude may keep working in the background while pi's turn ends
  in an error).
- Feasible in pi: partial — the wording match is easy; the backgrounding behavior needs the run_in_background
  infrastructure above.
- Test to lock it: `session.py` spec with a bash toolCall + `isError:true` result text ending in `Command timed
  out after N seconds`, replayed both sides to compare the failed-row rendering (should already match via the
  generic error-row path); a *live* scenario (`timeout 2 sleep 30`) proves pi's real kill-on-timeout wording
  against Claude's real kill-branch wording character for character.

### Bash stdout/stderr are never separated in pi
- Claude (evidence): internal exec result keeps them distinct — `` s={code:e,stdout:r,
  stderr:this.taskOutput.getStderr(),...} `` (bundle offset ~207930600) — stdout and stderr are two separate
  fields all the way through, and the timeout-kill message above is appended to `stderr` specifically, not to
  the combined text.
- pi now (evidence): `dist/core/bash-executor.js` — `child.stdout?.on("data", onData); child.stderr?.on("data",
  onData);` both streams feed the *same* handler, which does
  `sanitizeBinaryOutput(stripAnsi(decoder.decode(data))).replace(/\r/g,"")` and pushes into one interleaved
  `outputChunks` array. There is no `stderr` field anywhere in pi's bash result type.
- Difference: pi cannot represent "this command wrote to stderr but exited 0" or "stdout was empty, only
  stderr fired" as distinguishable data — it's one merged stream, forever. Whether this is *visible* in
  Claude's transcript (vs. only in the tool's returned text to the model) was not confirmed from the bundle in
  the time available.
- Severity: medium (affects any bash-heavy workflow where stdout/stderr separation matters for a downstream
  tool or for the model's own reasoning about what happened).
- Feasible in pi: partial — would need `bash-executor.js`/`bash.js` to track two buffers; a package patch, not
  a pure extension change.
- Test to lock it: a live scenario `bash: node -e "console.log(1);console.error(2)"`, capturing both harnesses'
  raw JSON tool-result payload (not just the rendered row) via `--dump-requests` on the Claude side and a
  session dump on the pi side.
- Could not measure: whether real Claude's *rendered transcript row* visibly separates stdout/stderr text (e.g.
  a `<stderr>` label) or just concatenates them for display — no such tag string was found in the bundle
  (searched `<stderr>`, `STDERR`, `stderr:` in UI-string ranges), so this may only be an internal-data
  difference with no visible row difference. Needs a live capture of a stderr-writing command on real Claude
  to settle, which I did not spend a model turn on.

### Long bash output truncation: opposite ends of the output are kept, and the marker text differs
- Claude (evidence): `Lst(e)` (bundle ~208684486) is head-truncation: keeps the **first** `$ae()` characters
  (`$ae()` reads `bashOutputMaxChars`/env `BASH_MAX_OUTPUT_LENGTH`, clamped `[4000, 128000]`, default constant
  `M1=50000`) and appends `` `\n\n... [${g} lines truncated] ...` `` where `g` is the newline count of the kept
  head — i.e. you see the **beginning** of a huge command's output, the **end** is cut.
- pi now (evidence): `dist/core/tools/truncate.js` `truncateTail()` used by `bash.js` — explicit doc comment:
  "Truncate content from the tail (keep last N lines/bytes)... Suitable for bash output where you want to see
  the end (errors, final results)." Default `DEFAULT_MAX_LINES=2000`, `DEFAULT_MAX_BYTES=50*1024` (≈51200B,
  nearly identical size budget to Claude's 50000-char default). Marker (from `bash.js` `formatOutput`):
  `` `\n\n[Showing lines ${startLine}-${endLine} of ${total}. Full output: ${path}]` `` (or the bytes variant),
  appended after the **kept tail**.
- Difference: with a huge bash output, Claude shows you the head and silently drops the tail; pi shows you the
  tail and drops the head. For anything that fails at the end of a long run (build errors, stack traces at the
  bottom of a log), pi's tail-keep actually preserves the useful part while Claude's head-keep would cut it off
  — a real behavioral divergence, not just a wording one. Marker wording also differs completely (Claude's is
  terse/model-facing "[N lines truncated]"; pi's is actionable "[Showing lines X-Y of Z. Full output: path]").
- Severity: high (very common — any verbose build/test run will hit this, and which half of the log survives
  differs by design between the two).
- Feasible in pi: yes, if a head/tail policy match were ever desired — `truncateHead` already exists in the
  same file and is used by pi's Read tool; swapping bash to head-truncation is a one-line change. But note this
  may be an intentional, better design in pi (tail is normally more useful for bash) — flag for a design call,
  not just "port it."
- Test to lock it: live scenario `bash: python -c "for i in range(5000): print(i)"`, diff which numbers survive
  truncation on each side plus the exact marker text.

### Read of a large file: truncation notice is a hidden system-reminder in Claude, a visible inline bracket in pi
- Claude (evidence): `fMt=2000` (bundle ~207367128) is the Read tool's line cap, matching pi's
  `DEFAULT_MAX_LINES=2000` exactly. The truncation text: `` `Note: The file ${filename} was too large and has
  been truncated to the first ${fMt} lines. No need to mention the truncation. Use ${readToolName} to read more
  of the file if you need.` `` is wrapped in a `<system-reminder>` tag and constructed with `isMeta:!0`
  (bundle ~102988463 / 211702332) — Claude's well-known pattern for text sent to the model but not rendered in
  the visible transcript.
- pi now (evidence): `dist/core/tools/read.js` line ~128 — `` outputText += `\n\n[Showing lines
  ${startLineDisplay}-${endLineDisplay} of ${totalFileLines}. Use offset=${nextOffset} to continue.]` `` is
  appended directly into the tool result's plain content, i.e. it is visible in the ctrl+o-expanded output
  alongside the file content (there is no `isMeta`/hidden-reminder concept in pi's tool result type at all).
- Difference: reading a >2000-line file in real Claude shows the model a hidden note the user never sees in the
  transcript; in pi the same note is a plain visible bracket line mixed into the file content the user *does*
  see on ctrl+o.
- Severity: medium (cosmetic for the common case, but changes what "ctrl+o to expand a Read" looks like, and
  the wording is completely different — no "Use offset=N" continuation hint in Claude's user-facing message at
  all since it's hidden).
- Feasible in pi: yes — pi's tool-result type would need an `isMeta`/hidden-text channel threaded through to
  the renderer to fully match; short of that, at least the wording could be changed to Claude's, still visible.
- Test to lock it: `session.py` spec with a `read` toolCall whose result text is >2000 lines, diff whether the
  truncation marker appears in each side's ctrl+o-expanded rows.

### Glob (find): pi never prints the "Found N files" header
- Claude (evidence): non-empty result format `` `Found ${n} ${n===1?"file":"files"}${paginationNote}\n${paths
  joined}` `` (bundle ~208737506); empty result is exactly `"No files found"` (bundle ~208732362).
- pi now (evidence): `dist/core/tools/find.js` — non-empty result is just the raw relativized path list, no
  header line at all (only an optional trailing `[N results limit reached]` bracket); empty result is
  `"No files found matching pattern"` — extra words vs Claude's plain `"No files found"`.
- Difference: two wording gaps — no "Found N files" header ever, and a longer empty-result string.
- Severity: low (doesn't change what the model can do, but shows up in every ctrl+o-expanded Glob call and
  every empty Glob).
- Feasible in pi: yes — trivial string change in `find.js` (or the `claude-tools` renderer if the header is
  meant to be display-only).
- Test to lock it: `session.py` spec with a `find` toolCall/result text using pi's current wording, then a
  version updated to Claude's `Found N files\n...` and a no-match case, replay-diffed.

### Grep many-results truncation wording differs from Claude's three variants
- Claude (evidence, bundle ~208729629, function `lIn`): three distinct messages depending on what's known —
  unknown total: `"(Results are truncated. Consider using a more specific path or pattern.)"`; known complete
  count: `` `(Showing ${n} of ${total} matching files; ${remaining} more are not listed. Narrow the pattern or
  path to see the rest.)` ``; known incomplete/estimated count: `` `(Showing the first ${n} files; there are
  more than ${total} matches. Narrow the pattern or path to see the rest.)` ``. Empty case: `"No matches
  found"` (bundle ~211493813) — this one **matches pi exactly**, see Already matches below.
- pi now (evidence): `dist/core/tools/grep.js` line ~221 — `` `${effectiveLimit} matches limit reached. Use
  limit=${effectiveLimit+N} to see more results.` `` (single form, no distinction between a known/unknown/
  partial total).
- Difference: pi has one truncation message shape; Claude has three, chosen by what it actually knows about
  the true total match count. Wording never overlaps.
- Severity: low-medium (visible on every over-limit Grep, i.e. common in a large repo search).
- Feasible in pi: yes — wording/branching change in `grep.js`.
- Test to lock it: `session.py` spec with a `grep` toolCall/result hitting the limit, replay-diff the trailing
  bracket text.

### ctrl+o is a whole "detailed transcript" mode switch in Claude, not an inline per-row toggle in pi
- Claude (evidence, live capture `out/claude-ctrlo-collapsed.txt` → `out/claude-ctrlo-expanded.txt`, replay of
  `parallel-fail.jsonl` through real `claude.exe 2.1.283 --model haiku` against local `mock.py`): before
  ctrl+o, the footer is the normal `[PONYTAIL] · Haiku 4.5 · ctx 1% · Fable ██████████ 0% ↻ 4d1h` /
  `⏵⏵ bypass permissions on (shift+tab to cycle) · ← 7 agents` two-line footer. After ctrl+o the **entire
  footer is replaced** by `Showing detailed transcript · ctrl+o to toggle · ↑↓ scroll · v to open in notepad ·
  ? for shortcuts` with a right-aligned `verbose` label — a completely different, dedicated footer bar for as
  long as the mode is on.
- pi now (evidence, live capture `out/pi-ctrlo-collapsed.txt` → `out/pi-ctrlo-expanded.txt`, same session
  replayed in `pi v0.85.1`): before and after ctrl+o the footer is **unchanged**
  (`[PONYTAIL] · Haiku 4.5 · ctx 1% · deepseek $11.61 · openrouter $16.37` /
  `⏵⏵ bypass permissions on (shift+tab to cycle)` both times); instead a one-line transient toast
  `● Tool output: expanded` is inserted into the transcript itself.
- Difference: real Claude's ctrl+o is a persistent mode with its own footer/instructions (scroll hints, "open
  in notepad", explicit toggle-back hint); pi's ctrl+o is an inline expand of the tool rows with no mode
  indicator beyond a transcript toast, and the normal footer/status line never changes.
- Severity: high (ctrl+o is used constantly to inspect any tool call; the footer/mode framing is completely
  different every time).
- Feasible in pi: partial — pi's footer extension would need a "detailed transcript" state to render this
  alternate footer; likely owner: `extensions/claude-footer` + whatever holds the ctrl+o toggle state today
  (`claude-tools`/core keybinding).
- Test to lock it: `replays/parallel-fail.jsonl` (built this session, see below) is exactly this fixture; lock
  the footer text and the presence/absence of the toast as an assertion in `diff.py`.

### Parallel calls, one failing: per-call row shape is different once expanded, including a mystery metadata line
Same live capture as above (`parallel-fail.jsonl`: bash `echo good` + bash `exit 7` in one reply).
- Claude expanded rows (evidence, `out/claude-ctrlo-expanded.txt`):
  ```
  ● Bash(echo good)              [blue/accent dot]
    ⎿  good
  ● Bash(exit 7)                 [RED dot: fg=ff6666]
    ⎿  Error: Exit code 7        [red text]
  <90-col-indent>02:49 PM claude-haiku-4-5-20251001
  ● Done.
  ```
- pi expanded rows (evidence, `out/pi-ctrlo-expanded.txt`):
  ```
  Ran Print success line          [no dot at all, plain grey]
    ⎿
      good
  Ran Fail with code 7
    ⎿  ✗ exit 7                  [pi's OWN "no ✗" rule, from format.ts's selftest, is contradicted here]
      Command exited with code 7
  ● Done.
  ```
- Differences, three stacked in one fixture:
  1. Per-call header: Claude re-shows `● Bash(<command>)` (dot colored by outcome, command echoed) even inside
     the expanded multi-call view; pi shows `Ran <description>` (no dot, no command, just the tool
     `description` argument prefixed with "Ran") — a completely different template from the single-call one.
  2. Failed-result line: Claude says `Error: Exit code 7` in one line under the elbow; pi says `✗ exit 7` (glyph
     + the raw command) on the elbow line, then a *second* line `Command exited with code 7` below it — this
     directly contradicts `extensions/claude-tools/format.ts`'s own documented rule ("no ✗ ... Claude puts the
     error text straight under the elbow") which was measured for the single-call Read/Edit error path, not
     this grouped/expanded-bash path — i.e. the ✗ glyph here looks like a real regression/uncovered branch, not
     an intentional design choice.
  3. A right-aligned `02:49 PM claude-haiku-4-5-20251001` line appears in Claude's expanded transcript between
     the tool results and the `● Done.` text, with no pi counterpart anywhere — likely metadata Claude's
     detailed-transcript mode attaches per assistant message (timestamp + model id), not tied to bash
     specifically, but only visible in this expanded mode so it belongs here.
- Severity: high (three independent, stacked rendering differences in the single most common "something broke
  while running two things" scenario).
- Feasible in pi: yes for (1) and (2) (wording/template fix in `claude-tools/format.ts`/`generic.ts`'s grouped
  expanded-row renderer); (3) needs the ctrl+o "detailed transcript" mode above to exist first, since it's a
  property of that mode, not of the tool row.
- Test to lock it: `%TEMP%\pi-parity\discovery\tool-output\parallel-fail.json`/`.jsonl` (already built, see
  Reproduction below) is a ready `session.py` spec/replay; promote it into `scripts/parity/specs/` +
  `scripts/parity/replays/` and add the three assertions above to `diff.py`.

### ANSI colour in bash output: pi strips unconditionally; Claude not confirmed
- pi now (evidence): `dist/core/bash-executor.js` line 44 — every chunk of stdout/stderr goes through
  `stripAnsi(decoder.decode(data,{stream:true}))` before it is buffered, streamed, or ever reaches the model.
  There is no configuration to keep it; a colourised `ls --color`/`grep --color` etc. arrives at the model and
  the UI with zero escape codes, always.
- Could not measure: whether real Claude's Bash tool preserves raw ANSI in the `tool_result` content sent back
  to the model (letting a colour-heavy command's escape codes reach the model as literal bytes) or also strips
  it. The bundle does contain a generic `ansi-regex`-shaped stripper (`[\u001B\u009B][[\]()#;?]*...`, multiple
  hits, e.g. bundle ~90763404/~227760420) but its call sites are Ink's own width-measurement utilities, not
  isolated to the Bash tool path in the time available. This needs a live capture (`bash: printf
  '\033[31mred\033[0m\n'`) on real Claude to settle — flagging rather than guessing.
- Severity if confirmed as a real difference: medium (visible whenever a colourised command is run; also would
  affect the "very long single-line wrapping" item below since ANSI-heavy lines interact with width math).
- Test to lock it: live scenario `bash: printf '\033[31mred\033[0m plain\n'`, compare raw JSON dump
  (`run.py --dump-requests`) on the Claude side vs. pi's session content for the same call.

### Very long single-line bash/grep/read output: pi truncates (cuts), never wraps
- pi now (evidence): `extensions/claude-tools/format.ts` `wrapRow()` only re-wraps rows whose `kind` matches a
  known diff/code gutter (`"code"`, `"context"`, `"added"`, `"removed"`); for `"muted"` (the kind used by every
  bash/grep/read output line and by error text, see `outputRows`/`resultRows` in the same file) `wrapRow`
  returns the row unchanged. `paintRows()` (`extensions/claude-tools/index.ts` line 51) then calls
  `truncateToWidth(piece.text, width)` on that single unwrapped row — i.e. a bash/grep/read output line longer
  than the terminal width is hard-cut at the edge, with no continuation row and no visible ellipsis marker of
  pi's own (whatever `truncateToWidth` from `@earendil-works/pi-tui` does internally).
- Could not measure: whether real Claude wraps such a line (consistent with the already-Matched "Word wrap is
  Ink's wrap-ansi" rule, which the README states for assistant text/markdown) or also truncates it for raw tool
  output specifically. Not verified live in the time available.
- Severity if Claude wraps and pi truncates: high (silent data loss in the visible transcript for any command
  that emits one very long line — e.g. a minified JSON blob, a long `find` path, a long compiler diagnostic).
- Feasible in pi: yes — `wrapRow` would need a plain-wrap branch for `"muted"` rows (reuse the same
  `wrapWords`/Ink `wrap-ansi` machinery `rows.ts` already imports for assistant text).
- Test to lock it: live scenario `bash: python -c "print('x'*400)"`, capture both sides at 132 cols, check
  whether the transcript shows one truncated row or multiple wrapped rows.

## Already matches (checked, evidence path)

- Grep empty-result wording: pi's `grep.js` `"No matches found"` == Claude's bundle string at ~211493813
  (`tZo=new Map([["grep",pT("No matches found")], ["rg",pT("No matches found")], ...])`) and ~102831732.
- Parallel-calls collapsed sentence: live capture, both `out/pi.txt`/`out/claude-ctrlo-collapsed.txt` for the
  same `echo good` + `exit 7` fixture show the byte-identical grey line `  Ran 2 shell commands` (pi) /
  `Ran 2 shell commands` (Claude) followed by `● Done.` before ctrl+o is pressed — extends the README's
  existing generic "grouped tool sentence" match to the specific one-success-one-failure case.
- Read/Bash/Grep/Write share Claude's general "truncate by a line-count-or-byte-count cap, whichever hits
  first, append a bracketed note" architecture: pi's `truncate.js` (`DEFAULT_MAX_LINES=2000`,
  `DEFAULT_MAX_BYTES=50*1024`) lines up almost exactly with Claude's Read cap (`fMt=2000`) and Bash cap
  (`M1=50000` chars ≈ pi's 51200 bytes) — the *policy shape* matches even where wording/direction differs (see
  findings above for the concrete wording/direction gaps).

## Could not measure (and why)

- Real Claude's ANSI handling for Bash tool output (stripped or preserved) — needs a live capture, not spent
  here to stay inside the shared 15-live-turn budget; static bundle search was inconclusive (see finding).
- Real Claude's wrap-vs-truncate behavior for one very long bash/grep/read line — same reason.
- Write preview cut for a long file, and multi-file Update in one turn — not independently re-verified; the
  existing `extensions/claude-tools/format.ts` selftest (`WRITE_PREVIEW_LINES=10`, "an edit shows its whole
  diff — only a write truncates") already carries a `ponytail:` note that this was measured against Claude
  previously, so I did not re-spend budget on it absent a reason to suspect regression.
- Read of an actual image/PDF file's rendered row (as opposed to the tool's internal image/pdf branch names
  found in the bundle, `case"notebook"`/`case"pdf"` at ~211702332) — not captured live.
- Whether Claude's Bash tool result visibly labels stdout vs stderr in the rendered row (vs. only internally) —
  see the stdout/stderr finding's "could not measure" note.

## Reproduction / artifacts left for whoever picks this up

- `%TEMP%\pi-parity\discovery\tool-output\bgrep.py` — mmap literal-substring bundle search helper (both utf-8
  and utf-16-le), reusable for other areas.
- `%TEMP%\pi-parity\discovery\tool-output\parallel-fail.json` / `.jsonl` — the two-bash-calls-one-failing
  `session.py` spec/session used for the ctrl+o and parallel-failure findings; promote into
  `scripts/parity/specs/` + `scripts/parity/replays/` if adopted.
- `%TEMP%\pi-parity\discovery\tool-output\out\{pi,claude}-ctrlo-{collapsed,expanded}.{txt,json}` — the raw
  captures backing the ctrl+o and parallel-failure findings.
- Cleanup done: killed the manually-started `mock.py` (was PID on port 19042), deleted the Claude project
  transcript it created (`~/.claude/projects/...-tool-output-work-claude`). Ports used: 19040 (run.py
  --replay, both sides, wrong-prompt attempt, discarded), 19041 (claude-only rerun with correct prompt),
  19042 (direct pty-capture.py claude run for ctrl+o pair) — all within the assigned 19040-19059 range, all
  torn down.

## Summary (counts and top 5)

Counts: 12 differences total — 5 high, 5 medium, 2 low. Plus 3 confirmed matches and 5 explicitly
could-not-measure items (each with the reason and the live test that would settle it).

Top 5 by impact:
1. ctrl+o is a full "detailed transcript" mode switch (dedicated footer, scroll/notepad hints) in Claude vs.
   an inline per-row toggle with no mode indicator in pi — affects every ctrl+o use.
2. run_in_background bash (and BashOutput/TaskStop) does not exist in pi at all — no schema field, no tools.
3. Long bash output truncation keeps opposite halves: Claude keeps the head (cuts the end), pi keeps the tail
   (cuts the beginning) — a real behavioral difference, not just wording, and arguably pi's choice is better
   for real-world error logs.
4. Parallel calls with one failing: three stacked differences in one fixture — per-call header template
   (`● Bash(cmd)` + red dot vs `Ran <description>` no dot), failed-result wording (`Error: Exit code 7` vs
   `✗ exit 7` + separate line, the latter contradicting pi's own documented "no ✗" rule), and an unexplained
   right-aligned timestamp+model line in Claude's expanded view with zero pi counterpart.
5. TodoWrite has zero pi equivalent — no tool, no ctrl+t, no live checklist under the spinner.
