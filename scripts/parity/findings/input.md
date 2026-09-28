# Input parity findings (area: input)

Measured against Claude Code 2.1.283 (`C:\Users\cuong\.local\bin\claude.exe`, same 244,960,928-byte
binary as the pinned `versions\2.1.283`) and pi 0.85.1 (`...\@earendil-works\pi-coding-agent`,
bundle `dist\bundle\chunks\chunk-JVUZSMYM.js`). Evidence combines: (a) `mmap`+regex reads of the
Claude Bun binary and the pi bundle (helper scripts in `%TEMP%\pi-parity\discovery\input\bundle_grep.py`
/ `pi_grep.py`), and (b) live `scripts/pty-capture.py` captures of both, idle (no prompt sent, so
these cost 0 live model turns except the one bash-mode-submit test on pi, which spent 1 Copilot
Haiku turn — the only live-model turn used in this whole sweep). All scratch output is under
`%TEMP%\pi-parity\discovery\input\`. No real pi/Claude session was touched; two stray `notepad.exe`
windows opened by testing `ctrl+g` (external editor) were killed immediately after (confirmed no
orphans remain).

### ctrl+r — history search

- Claude (evidence): `claude-explore-11-ctrl-r.txt`. `ctrl+r` opens a full two-pane incremental
  search: `Search prompts · everywhere`, a left list of past prompts across **all projects** with
  relative ages (`19m ago`, `4d ago`, …), a bordered live-preview pane on the right showing the
  full text of the selected entry, a bottom `⌕ <query>` search box seeded with the current editor
  text, and a footer `↑/↓ to navigate · Enter to use · Esc to cancel · ctrl+s to scope`. Bundle
  confirms the binding (`"ctrl+r":"history:search"`, Global context, offset 207595083) and a whole
  `HistorySearch` keybinding context (`historySearch:next/accept/cancel/execute/cycleScope`, offset
  207597608).
- pi now (evidence): `pi-misc2-b-ctrl-r.txt`. `ctrl+r` does nothing at all — screen unchanged, no
  dialog, no notice. `keybindings.json` only binds `ctrl+p`/`ctrl+n` to `historyPrevious`/`historyNext`
  (linear paging of the current session's own submitted prompts); pi has no incremental-search
  feature, no cross-project scope, no live preview.
- Difference: total feature gap. Claude's ctrl+r is a rich, cross-project, previewed incremental
  search; pi's ctrl+r is unbound.
- Severity: high (a documented, discoverable shortcut — shown on Claude's own `?` card — that
  silently no-ops in pi).
- Feasible in pi: partial. A basic reverse-search over `pi`'s own per-session prompt list is
  buildable as an extension (`ctx.ui.setWidget` + a filtered list), but the cross-project "everywhere"
  scope needs a persisted history store like Claude's `~/.claude/history.jsonl`
  (`{"display","pastedContents","timestamp","project","sessionId"}`, 7705 lines observed) — pi has
  no equivalent file at all (checked `~/.pi` for any `*histor*` file: none). Likely owner:
  pi core patch (needs a persisted cross-session prompt log) + new extension for the UI.
- Test to lock it: replay fixture that seeds a fake `history.jsonl` and asserts pi's `ctrl+r` opens
  *some* search UI (currently: assert it stays a no-op, i.e. this is a still-open gap, not a
  regression target for `diff.py`'s exception list).

### `!` bash mode — glyph, border colour, and how output lands

- Claude (evidence): `claude-bang-submit-before-submit.txt` colours. Before submit: the whole
  top+bottom box rule is `3399ff`, the leading prompt glyph is replaced (`❯` → `!`, itself `3399ff`),
  the command text after it is default colour, and the footer/mode row is replaced by `! for shell
  mode` in `3399ff` (bundle: `"! for shell mode"` painted with theme colour `bashBorder`, offsets
  217753530 / 228862354). After Enter (`claude-bang-submit-after-submit.txt`): the line renders as
  a **background-highlighted block** (`bg=413c41`), `!` in `3399ff`, the command in bold `ffffff`,
  followed by `  ⎿  Running…` in muted grey — i.e. it goes through the same async
  tool-call/`⎿` pipeline as a normal Bash tool call, not a synchronous shell echo.
- pi now (evidence): `pi-bang-submit-before-submit.txt` / `-after-submit.txt`. Before submit: the
  top+bottom rule is *also* `3399ff` (this part already matches), but the prompt glyph stays plain
  `❯` (default colour) and `!` is inserted as ordinary default-coloured text right after it; the
  footer stays the normal mode line (`⏸ manual mode on`), no `! for shell mode` hint anywhere. After
  Enter, pi runs the command synchronously (no model round-trip) and draws a **bordered block**
  distinct from its own Bash-tool rendering: `3399ff` top/bottom rule, bold `3399ff` `$ echo …`,
  muted (`999999`) output, `3399ff` closing rule — a custom `$`-prompt box, not the `● Bash(...)`/`⎿`
  shape pi uses for a real Bash tool call.
- Difference: three separate mismatches — (1) glyph replacement (`!` vs `❯`) missing in pi, (2) the
  `! for shell mode` footer hint missing in pi, (3) the *submitted-command* rendering shape differs
  entirely (Claude reuses the tool-call/`⎿ Running…` pipeline; pi draws a bespoke `$ cmd` box). The
  live box-border colour (`3399ff`) already matches.
- Severity: high (visible every single bash-mode use, both entering and after Enter).
- Feasible in pi: yes for (1)/(2) — this is exactly what `claude-help`'s "! for shell mode" text
  already claims should exist; owner: extension (probably `claude-input`/`claude-bottom-input`,
  which already colours the editor rules and could also swap the glyph and set a footer widget).
  (3) requires re-routing the shell-mode result through `claude-tools`' Bash rendering rather than a
  bespoke block; likely owner: pi core patch (wherever pi's built-in `!`-mode result renderer lives)
  or a new small extension that intercepts it.
- Test to lock it: `scripts/pty-capture.py --keys` sequence `!echo hi`, `sleep`, `snap`, then `\r`,
  `snap` — compare glyph colour, footer line, and the after-submit block shape/colours (already
  captured above as `pi-bang-submit-*` / `claude-bang-submit-*`, reusable as a scenario).

### `@` file-mention menu — contents and ordering on an empty query

- Claude (evidence): `claude-explore-02-at.txt`. Bare `@` on an empty prompt lists, in order:
  local files (`+ README.md`), then this account's MCP resources (`◇ dse:dse://workflows/ – …`),
  then agents (`* claude (agent) – …`), all in one flat uniform-`999999` list with no visible
  selection highlight on the top row.
- pi now (evidence): `pi-explore-02-at.txt`. Bare `@` lists **only pi-subagents**
  (`@general-purpose`, `@explore`, `@plan`, `@planner`, `@reviewer`, paginated `(1/8)`) — no files
  at all, even though the cwd has a `README.md`. The first row is pre-selected and painted `87afd7`
  with a `→` marker; Claude's list has no such highlight. Typing a query (`@READ`,
  `pi-misc2-e-at-read.txt`) does correctly narrow to `README.md`, so file-mention matching works,
  it's just not shown (or not prioritized) on the *empty* query.
- Difference: on an empty `@`, Claude shows files first (then other resource kinds, then agents);
  pi shows only agents, no files, until a query narrows it. Selection-highlight styling also differs
  (pi highlights row 1 by default; Claude showed no highlighted row in this capture).
- Severity: medium (real content gap, but recoverable by typing a filename right away).
- Feasible in pi: yes — ordering/merge logic in whatever pi-subagents-provided `@`-completer
  contributes to the shared mention list; likely owner: `pi-subagents` package patch or a small
  claude-input-side extension that re-orders the merged completion list (files before agents).
- Test to lock it: replay fixture with a cwd containing 1 file + subagents enabled; snapshot bare
  `@` and assert file entries precede agent entries.

### `?` shortcuts card — content drift

- Claude (evidence): `claude-explore-04-help.txt` (verified live, matches `claude_grep` bundle
  strings at offsets 98221434/228862354/228875310 etc.):
  ```
  ! for shell mode        double tap esc to clear input      ctrl + shift + _ to undo
  / for commands          shift + tab to auto-accept edits   alt + v to paste images
  @ for file paths        ctrl + o for verbose output        alt + p to switch model
  /btw for side question  ctrl + t to toggle tasks           ctrl + s to stash prompt
                          shift + ⏎ for newline              ctrl + g to edit in $EDITOR
                                                              /keybindings to customize
  ```
- pi now (evidence): `pi-explore-04-help.txt` (`extensions/claude-help/index.ts` `CARD` constant):
  ```
  ! for shell mode        double tap esc to clear input      ctrl + z to undo
  / for commands          shift + tab to cycle modes         alt + v to paste images
  @ for file paths        ctrl + o for verbose output        alt + p to switch model
  /effort for thinking    shift + enter for newline          ctrl + s to stash prompt
                          ctrl + p / ctrl + n for history    ctrl + g to edit in $EDITOR
                                                              /hotkeys to customize
  ```
- Difference (cell by cell):
  - `ctrl+z to undo` (pi) vs `ctrl+shift+_ to undo` (Claude) — **and pi's own `ctrl+z` is unbound
    on Windows** (`"app.suspend":{defaultKeys:process.platform==="win32"?[]:"ctrl+z", …}`, pi bundle
    offset 3421044), so the pi card advertises a shortcut that does nothing on this platform at all.
  - `shift+tab to cycle modes` (pi) vs `shift+tab to auto-accept edits` (Claude) — wording only.
  - `/effort for thinking` (pi) vs `/btw for side question` (Claude) — pi has no `/btw`
    ("side question") feature at all; conversely Claude's card doesn't mention `/effort` even
    though `/effort` is a real Claude command (shown separately as the `◐ medium · /effort` footer
    widget, confirmed live) — so this slot's *content*, not just wording, differs.
  - `ctrl+p / ctrl+n for history` (pi) vs `ctrl+t to toggle tasks` (Claude) — pi advertises a
    feature (history paging hotkey) Claude's card doesn't mention there at all, and is missing
    Claude's real `ctrl+t` row entirely (see next finding).
  - `shift + enter for newline` (pi, static word "enter") vs `shift + ⏎ for newline` (Claude, glyph
    ⏎, and *dynamic* — see multiline finding below).
  - `/hotkeys to customize` (pi) vs `/keybindings to customize` (Claude) — different command name
    (pi's actual customization command really is `/hotkeys`, so this one is arguably "correct for
    pi", just not textually identical).
- Severity: high (this card is the single most information-dense, most-consulted surface in this
  whole area, and roughly half its cells differ).
- Feasible in pi: yes — it's a static `CARD` constant in `extensions/claude-help/index.ts`; the
  ctrl+t/toggle-tasks and ctrl+shift+_-undo rows depend on the fixes below existing first.
- Test to lock it: `extensions/claude-help/selftest.ts`-style literal-string compare against the
  rows captured here (or against a small `replays/help-card.jsonl`).

### ctrl+t — toggle tasks (todo list)

- Claude (evidence): bundle offsets 207595027 (`"ctrl+t":"app:toggleTodos"`, Global) and
  228861763/228874859 (`Oc("app:toggleTodos","Global","ctrl+t")`); `?` card row `ctrl+t to toggle
  tasks`. Live: `claude-explore-07-ctrl-t.txt` — pressing it on a task-less fresh session left the
  screen unchanged (no visible panel, presumably because there are no todos yet — not fully
  measurable without an active TodoWrite-populated task list; see "could not measure" below).
- pi now (evidence): `pi-ctrl-t-b-after-ctrl-t.txt` (isolated test) — `ctrl+t` does **nothing**;
  screen is byte-identical to idle. Confirmed pi leaves `ctrl+t` completely unbound (README:
  "ctrl+shift+t is pi's thinking toggle so a Claude-trained ctrl+t cannot flip it by accident" — it
  is inert, not remapped to an equivalent feature).
- Difference: Claude has a real todo/task-list toggle on `ctrl+t`; pi has no todo-list feature
  bound to any key that mirrors it (pi does have a `todo.ts` example extension loaded in
  `settings.json`, but it does not bind `ctrl+t`).
- Severity: medium (real feature gap, but only visible once a task list exists — most turns won't
  have one).
- Feasible in pi: partial — would need the `todo.ts` example extension (or a similar todo view) to
  register a `ctrl+t` shortcut; likely owner: extension (todo.ts or a new one), not pi core.
- Test to lock it: a replay fixture with an assistant turn that used `TodoWrite`/an equivalent tool
  first, then `ctrl+t`, snapshotted on both sides.

### ctrl+l — Claude: inert here; pi: opens the model picker

- Claude (evidence): bundle `"ctrl+l":"chat:clearInput"` (Chat context, offset 207595434). Live,
  isolated: `claude-explore-08-ctrl-l-empty.txt` (empty box, no-op) and
  `claude-explore-10-ctrl-l-with-text.txt` (box had `hello world`, ctrl+l pressed, **text
  unchanged** — `❯ hello world` still shown). So whatever `chat:clearInput` does, it is not a
  visible "erase the typed text" action in this build/scenario.
- pi now (evidence): `pi-ctrl-l-b-after-ctrl-l.txt` — `ctrl+l` opens pi's **model picker** dialog
  (`Scope: all | scoped`, `✓ claude-haiku-4.5 [github-copilot]`, `Enter to select · Ctrl+Alt+S to
  set as default · Escape/Ctrl+C to cancel`), unconditionally, hijacking all further keystrokes
  (confirmed: typing `hello world` afterward landed in the picker's own filter box, not the editor).
- Difference: pi's `ctrl+l` opens an unrelated dialog Claude does not open on this key at all; real,
  clean input-hijack difference regardless of Claude's exact internal semantics for the key.
- Severity: high (silently swallows the next several keystrokes into the wrong UI).
- Feasible in pi: yes — find what pi core/extension binds `ctrl+l` to open the model picker (not
  found in `keybindings.json`, so likely a pi-core default or a package default from one of the
  installed packages) and free it up, the same way `ctrl+alt+s`/`ctrl+alt+v` were used to free
  `ctrl+s`/`alt+v` for claude-keys/claude-images. Likely owner: `keybindings.json` (add an explicit
  remap) once the exact pi action bound to `ctrl+l` is identified.
- Test to lock it: isolated key-only replay (`ctrl+l` on idle, then on a box with text) asserting no
  dialog opens.

### ctrl+c / ctrl+d — exit confirmation has no hint text in pi, and pi clears text instead

- Claude (evidence): bundle `Wr()`/`c()` helpers (offset 222912488) produce `Press Ctrl-C again to
  exit` / `Press Ctrl-C again to cancel` / `Press Ctrl-D again to exit`, shown in the footer row.
  Live: `claude-ctrlc-b-ctrlc1.txt` — first `ctrl+c` on an idle, empty box shows `Press Ctrl-C again
  to exit` in the footer for ~2s (`claude-ctrlc-c-after-wait.txt` confirms it reverts), and the
  editor text is never touched by `ctrl+c`. `ctrl+d` (`app:exit`) is bundle-confirmed to only act
  when the editor is empty (`Wnr(Mt)===""?wr():!1`) and uses the same "press again" hint pattern.
- pi now (evidence): `pi-ctrlc-a-ctrlc-with-text.txt` — with `hello world` typed, one `ctrl+c`
  **immediately clears the box** (matches pi's own `"app.clear":{defaultKeys:"ctrl+c",
  description:"Clear editor"}`), no hint shown at all. `pi-ctrlc-b-ctrlc-empty-first.txt` /
  `-c-after-wait.txt` — a *second* `ctrl+c` on the now-empty box shows nothing either (no "press
  again to exit" text anywhere, footer stays the normal mode line the whole time), even though pi's
  own startup banner claims `app.clear twice to exit`. `pi-ctrld-a-ctrld-empty-first.txt` — same
  silence for `ctrl+d` on an empty box (no hint, and it did not exit within 2s).
  the whole 3-tap (or however many) sequence to actually exit is completely silent in pi.
- Difference: (1) pi's `ctrl+c` clears the input text on a non-empty box; Claude's never does. (2)
  Claude gives explicit, timed visual feedback ("Press Ctrl-X again to exit") for the exit
  confirmation; pi gives none at all, on either key.
- Severity: high (this is one of the most commonly pressed key combos in any terminal session).
- Feasible in pi: yes — the double/triple-tap tracking already exists internally (the startup hint
  proves it); it just needs a visible footer notice, mirroring what `claude-keys`' `ctrl+s` stash
  notice already does (`ctx.ui.notify(...)`). Likely owner: pi core (since `app.clear`/`app.exit`
  are core actions) or a small extension that listens for the pending-exit state and renders the
  hint claude-style. The "ctrl+c clears text" behaviour is a deliberate pi default
  (`description:"Clear editor"`) and would need an explicit decision to drop for parity.
- Test to lock it: `pty-capture` steps `ctrl+c` → snapshot footer text → sleep past window →
  snapshot again, on both sides (already captured above, reusable as a scenario).

### esc / esc-esc — double-tap window is shorter in Claude, and Claude shows a hint pi doesn't

- Claude (evidence): `claude-esc-b-esc1.txt` — single `esc` leaves text untouched but shows `Esc
  again to clear` in the footer (bundle: generic `Wr()`/"again to ..." pattern, offset 222928720
  area). Window size: `claude-esc2-immediate-double.txt` (~0ms gap) and `claude-esc3-gap150.txt` /
  `claude-esc3-gap300.txt` (150ms/300ms gaps) all **cleared** the text; `claude-esc.txt` /
  `claude-esc-c-esc2-cleared.txt` (400ms gap, via a `sleep 0.4` between key sends) did **not**
  clear. So Claude's double-tap window is roughly 300–400ms.
- pi now (evidence): `pi-esc-b-esc1.txt` (single esc, text untouched, matches) /
  `pi-esc-c-esc2-cleared.txt` (double esc at a 400ms gap, **cleared** — pi's window is a fixed
  `DOUBLE_TAP_WINDOW_MS = 600` in `extensions/claude-keys/index.ts`). No hint text is ever shown by
  pi on the first `esc` (confirmed across all captures — footer/mode row never changes).
- Difference: (1) pi has no "Esc again to clear" hint at all (same gap as ctrl+c/ctrl+d above). (2)
  pi's window (600ms) is measurably longer than Claude's (~300–400ms), so a slow double-esc that
  fails to clear in real Claude would still clear in pi.
- Severity: medium (the underlying clear-on-double-esc behaviour matches; it's the feedback and
  exact timing that differ).
- Feasible in pi: yes — add the notify() hint in `claude-keys`, and tighten
  `DOUBLE_TAP_WINDOW_MS` toward ~350ms (re-measure a few more gap points before picking an exact
  value; 300ms confirmed-clears, 400ms confirmed-fails in this sweep, so the true cutoff needs one
  or two more bisection captures for precision).
- Test to lock it: `claude-keys/selftest.ts` already has a `secondTap` unit test; add a case at the
  new threshold, and a `pty-capture` gap-sweep replay (150/250/300/350/400ms) to pin the exact ms.

### Multiline hint text — Claude is dynamic (3 variants), pi is a static string

- Claude (evidence): bundle function `sQn()` (offset 217520102): `if (Ube()) return "shift + ⏎ for
  newline"; return Aer() ? "\⏎ for newline" : "backslash (\\) + return (⏎) for newline";` — i.e.
  Claude picks between three renderings of the multiline hint depending on detected terminal
  capability (full Kitty/CSI-u support → `shift + ⏎`; a middle tier → the compact `\⏎`; plain
  terminals → the fully spelled-out `backslash (\) + return (⏎) for newline`). Confirmed live on
  the `?` card: `shift + ⏎ for newline` (glyph, not the word "enter") — `claude-explore-04-help.txt`.
- pi now (evidence): `extensions/claude-help/index.ts` `CARD` constant hardcodes `"shift + enter for
  newline"` — the word "enter", always, regardless of terminal capability.
- Difference: wording (glyph vs word) and, more importantly, pi never shows the backslash-based
  fallback text at all, so a user on a terminal that doesn't support shift+enter (where Claude would
  say `backslash (\) + return (⏎) for newline`) gets no correct instruction from pi's card.
- Severity: medium (cosmetic in the common case; a real correctness gap on terminals without
  shift+enter support). Did not live-test the actual backslash+enter *keystroke* behaviour itself
  (submitting a bare `\` + Enter risks accidentally sending a live prompt to the real model on
  either side if it's misdetected as a newline vs a submit — skipped for cost/safety; the bundle
  logic above is taken as suf`ficient evidence that the feature and its 3 text variants are real).
- Feasible in pi: yes — port the same three-branch logic into `claude-help`'s card renderer
  (detecting the same capability pi's own multiline-insert binding already reacts to, since pi must
  already know whether shift+enter is usable to bind it).
- Test to lock it: unit test in `claude-help`'s selftest with the 3 branches stubbed, run under each
  simulated capability.

### Large paste placeholder — wording and off-by-one differ

- Claude (evidence): bundle `v9(e,n)` (offset 206552555): `n===0 ? "[Pasted text #${e}]" :
  "[Pasted text #${e} +${n} lines]"`, where `n` = newline-character count (i.e. total lines − 1).
  Live, pasting 11 lines via a real bracketed-paste (`\x1b[200~…\x1b[201~`):
  `claude-paste-paste-result.txt` → `❯ [Pasted text #1 +10 lines]`, footer `paste again to expand`.
- pi now (evidence): same 11-line bracketed paste → `pi-paste-paste-result.txt` → `❯ [paste #1 +11
  lines]` — different capitalization/wording (`paste` vs `Pasted text`) **and** a different counting
  convention (`+11` = total line count, vs Claude's `+10` = extra-lines-beyond-first). No `paste
  again to expand` (or any) footer hint appears in pi.
- Difference: text format, counting convention, and the missing "expand" affordance/hint.
- Severity: high (this exact placeholder format is explicitly named in the brief and is one of the
  most common interactions — any paste of >1 line triggers it).
- Feasible in pi: yes — pi already implements the placeholder-collapse mechanism at all (this one is
  not a "missing feature", just wrong text); fix the label string and the count (use newline-count,
  not line-count) and add a footer hint on "paste again" (needs a real "expand" behaviour to justify
  the hint — verify pi's paste-again-to-expand actually works before adding the text, not confirmed
  in this sweep).
- Test to lock it: unit test for the placeholder-builder function with `n=0` and `n>0` cases;
  compare exact string against `[Pasted text #{id} +{n} lines]`.

### Image paste placeholder — already matches

- Claude (evidence): bundle `yIt(e){return "[Image #${e}]"}` (offset 206552583), and
  `we=I==="windows"||I==="wsl", xe=we?"alt+v":"ctrl+v"` (offset near 207594900) — **Claude Code
  itself uses `alt+v` for image paste on Windows/WSL**, not `ctrl+v`.
- pi now (evidence): `extensions/claude-images/index.ts` — binds `alt+v`, inserts `[Image #${n}] `
  (note pi's has a trailing space; not checked whether Claude's chip also gets a trailing space
  before more text — minor, unverified).
- Difference: none found — pi's choice of `alt+v` on Windows and the `[Image #N]` chip format both
  match Claude's own Windows behaviour (the extension's code comment slightly overstates the
  platform reasoning, but the resulting key and format are correct).
- Already matches; evidence: `extensions/claude-images/index.ts:1-44`, Claude bundle offsets
  206552583 / near 207594900.

### `#` — no special behaviour on either side; already matches

- Claude (evidence): `claude-explore-03-hash.txt` / `-03b-hash-text.txt` — `#` and `# something to
  remember` are inserted as plain literal text in the box (`❯ #`, `❯ # something to remember`); no
  menu, no colour change, no memory-file prompt appeared. (Note: `#` is Claude's `/memory`-style
  quick-add on **claude.ai**'s web/desktop client in some builds, but not observed as a distinct
  prompt-box feature in this CLI build.)
- pi now (evidence): `pi-misc2-c-hash.txt` / `-d-hash-text.txt` — identical: plain literal text,
  no special handling.
- Already matches; evidence as above. No `remember`-tool auto-trigger on `#` on either side.

### Placeholder text in an empty box — Claude has contextual suggestions, pi has none

- Claude (evidence): `claude-ready.txt` / `claude-explore-00-idle.txt` — empty box shows a rotating
  contextual suggestion, e.g. `Try "write a test for <filepath>"`, `Try "edit <filepath> to..."`,
  `Try "create a util logging.py that..."`, `Try "how does <filepath> work?"` (different each
  session start), rendered in default colour with SGR **dim** (not the `999999` muted colour used
  elsewhere).
- pi now (evidence): every idle capture (`pi-ready.txt`, `pi-explore-00-idle.txt`, etc.) — box is
  simply `❯` with nothing else, no placeholder text of any kind.
- Difference: total feature gap.
- Severity: medium (cosmetic, but present on literally every fresh session and explicitly named in
  the brief).
- Feasible in pi: yes — a static or small-rotating-pool placeholder string is straightforward to add
  via the same editor-render hook `claude-input` already uses; matching Claude's *file-aware*
  suggestions (`<filepath>` filled from the actual repo) would need a directory scan, lower priority
  than just having *some* dim placeholder text.
- Test to lock it: snapshot an empty idle box and assert a non-empty dim placeholder row exists.

### Up/down history and ctrl+p/ctrl+n — mostly matches, one asymmetry

- Already matches (per README + re-confirmed via bundle): Claude's real Global/Chat bindings are
  `up:"history:previous", down:"history:next"` only (bundle offset 207595821) — no `ctrl+p`/`ctrl+n`
  binding for history in Claude at all. pi's `keybindings.json` comment ("Up/Down do it at the edges
  of the prompt like Claude Code") plus pi core's `tui.editor.cursorUp` documented in the README
  ("Up on the first line recalls the previous prompt") reproduces this edge-triggered behaviour.
  Not independently re-verified live in this sweep (would need pre-seeded history — see below) but
  no contradicting evidence found; keeping this out of the diff list per the brief ("do not
  re-report items... unless you measure they regressed").
- Difference/asymmetry (not a regression, but worth flagging): pi *additionally* binds `ctrl+p` /
  `ctrl+n` to history paging; Claude has no such binding at all (confirmed absent from both the
  Global and Chat binding blocks). This makes pi's own `?`-card row `ctrl + p / ctrl + n for history`
  something Claude's card never shows (also listed under the `?`-card finding above).
- Severity: low (additive, not a broken feature).
- Not fully measured: did not seed `~/.claude/history.jsonl`-equivalent state and press bare Up/Down
  live on both sides in this sweep (time/cost trade-off); the existing README claim is taken as
  already-verified per its own commit history.

### Queued messages while the model is running — could not measure

- Not measured. Testing this properly needs an actual in-flight turn (a real model call with
  several seconds of "thinking"/tool time) on both sides, which the brief's cost/turn budget makes
  expensive to set up carefully (avoiding an accidental extra submit that spends unplanned turns).
  Left for a future scenario-based pass using `scripts/parity/run.py` with a scenario whose fixture
  includes an intentionally slow bash call (the existing `slow-search` scenario's pattern), typing a
  second prompt mid-turn and observing whether/how it's queued and when it's sent, on both engines.

## Summary of the sweep

- High severity (6): ctrl+r history search (total gap), `!` bash-mode glyph/footer/output-shape
  (3 sub-issues), `?` card content drift (~5 wrong/missing cells), ctrl+l hijack to model picker,
  ctrl+c/ctrl+d silent exit-confirmation + ctrl+c wrongly clearing text, large-paste placeholder
  wording/off-by-one.
- Medium severity (5): `@` bare-mention ordering (files vs agents-only), ctrl+t toggle-tasks gap,
  esc/esc-esc hint text + shorter Claude window, multiline hint dynamic-text gap, empty-box
  placeholder text gap.
- Low severity (1): pi's extra ctrl+p/ctrl+n history binding not present in Claude (additive, not
  broken).
- Already matches (3): image paste (`alt+v` + `[Image #N]`), `#` (no special behaviour either
  side), esc-esc's core clear mechanic (timing/hint differ, but the clear-on-double-tap itself is
  correct).
- Could not measure (2): queued messages while the model is running (needs a live in-flight-turn
  scenario); exact Claude double-esc window ms (bounded 300–400ms, not pinned to the exact
  constant) and Claude's bare Up/Down history recall with pre-seeded state (not independently
  re-verified live, relying on existing README claim).
