# m15-bundle: Claude 2.1.310 bundle reading for M15

Method: `mmap` + `re` over `C:\Users\cuong\.pi\sandbox\claude-2.1.310.exe` (scratch: `%TEMP%\pi-parity\discovery\m15\`, `ctx.py` = anchor + context dump, `off.py` = absolute offset slice). Offsets are byte offsets in the exe. Minified names (`vG`, `AB`, `Mre`...) are local to that bundle chunk and collide across chunks, so every excerpt below is anchored by a unique string. Nothing here was captured live; "needs capture" marks what code alone does not settle.

## 1. ctrl+o transcript view keys

Anchors: `Showing detailed transcript` (offset 280412696), `"Transcript",bindings:` (247589588), `scroll:halfPageDown`, `Pasted` none.

### Key bindings (context `Transcript`, offset ~247589588)

```
{context:"Transcript",bindings:{"ctrl+e":"transcript:toggleShowAll","ctrl+c":"transcript:exit",escape:"transcript:exit",q:"transcript:exit",
"ctrl+u":"scroll:halfPageUp","ctrl+d":"scroll:halfPageDown","ctrl+b":"scroll:fullPageUp","ctrl+f":"scroll:fullPageDown",
"ctrl+n":"scroll:lineDown","ctrl+p":"scroll:lineUp",g:"scroll:top","shift+g":"scroll:bottom",j:"scroll:lineDown",k:"scroll:lineUp",
space:"scroll:fullPageDown",b:"scroll:fullPageUp",up:"scroll:lineUp",down:"scroll:lineDown",home:"scroll:top",end:"scroll:bottom"}}
```

Plus global context: `app:toggleTranscript` = `ctrl+o` (toggles in and out). `Scroll` context adds pageup/pagedown (`scroll:pageUp/pageDown`, half a viewport: `max(1, floor(viewportHeight/2))`), wheel, `ctrl+home`/`ctrl+end`.

Rule: j/k and up/down and ctrl+n/ctrl+p = one line; ctrl+u/ctrl+d = half page; space/ctrl+f = full page down, b/ctrl+b = full page up; g/home = top; G (shift+g)/end = bottom; q, esc, ctrl+c leave the view; ctrl+e toggles show-all (only when virtual scroll is off, `isActive: !virtualScrollActive`).

### Letter keys handled by the view itself (`Er(Dn)` in the transcript component, offset ~280420231)

```
if(!nr||!$e)return; if(Dn.ctrl||Dn.meta)return;
Dn.key==="?" && !dumpMode  -> toggle help card
Dn.key==="/" && !dumpMode  -> jumpRef.setAnchor(); open search bar; close help card
(n|N) repeated, !dumpMode, matchCount>0 -> nextMatch()/prevMatch() (N times for key "nnn")
({|}) repeated, !dumpMode -> prevMessage()/nextMessage()  ("}" = next)
"[" && !dumpMode && !embedded -> onDumpToScrollback(); close card
"v" -> render transcript to $TMPDIR/cc-transcript-<ms>.txt and open in $VISUAL/$EDITOR
```

`v` status text (shown in the footer right side, cleared after 4000 ms): `rendering N messages…`, then `opening <path>` or `wrote <path> · no $VISUAL/$EDITOR set`, or `render failed: <msg>`.

### Footer bar (`AB`, offset 280412696; one row, dim, `wrap: truncate-end`, top border `single` dim, marginTop 1, paddingLeft 2)

Left text pieces joined as `Showing detailed transcript` + `ctrl+o to toggle` (the two are plain `Text`, not dim-overridden but inside a dim parent) then a variable tail:

- search badge active: `n/N to navigate`
- virtual scroll on (the usual alt-screen case): if `2 + width(["dialog waiting"?, "Showing detailed transcript", "ctrl+o to toggle", "↑↓ scroll · v to open in <editor> · ? for shortcuts"].join(" · ")) + width(status || "verbose ") < columns` then the tail is `↑↓ scroll · v to open in editor · ? for shortcuts` (note: when there is room the whole string is `St`; otherwise only the short `? for shortcuts`). Editor name comes from `u4()`; text is `open in editor` when none, `open in <name>` otherwise.
- virtual scroll off, `suppressShowAll`: `v to open in editor`
- else `ctrl+e to show all` / `ctrl+e to collapse`
- `dialog waiting` in colour key `permission` is prefixed when a dialog is parked.

Right side (`Are`): `status` text if set (e.g. the `v` messages), else `current/count  ` (dim, two trailing spaces) when a search badge is active, else dim `verbose ` (literal, trailing space).

### `?` key card (`Mre`, offset 280412696 + ~1500; replaces the footer bar)

Box: `borderStyle:"single"`, only top border, `borderTopDimColor`, `marginTop:1`, `paddingLeft:2`, `width:100%`, `flexDirection:"row"`, `gap:4`, `noSelect`. Three columns, every line `dimColor`:

Column 1 (labels padded to 9):
```
↑↓ j/k   scroll
ctrl+u/d half page
space b  page
g/G      top/bottom
{/}      prev/next prompt
```
Column 2 (labels padded to 5):
```
/    search
n/N  next/prev match
[    print to scrollback
v    open in <editor or "editor">
```
Column 3 (labels padded to 7; the toggle key and exit key are looked up from the keymap):
```
ctrl+o  toggle transcript
q       exit
?       close help
```
`↑↓` is `ne.arrowUp + ne.arrowDown`. Column 1 text above is `["↑↓ j/k".padEnd(9), "scroll"]` etc., so "ctrl+u/d" exactly fills the 9 and gets no extra gap other than the single flex gap of 4.

### Search bar (`tFe`, offset 280423834 region)

Replaces the footer: top border single dim, `marginTop:1`, `paddingLeft:2`, `noSelect`, auto-focus. Row content: `/` + query text with an inverse-video cursor cell (`inverse` on the char under the cursor, or a space at end) + `flexGrow` spacer + right-side status from `OIt`:

- while the index is building: dim `indexing… `
- afterwards if building took >= 20 ms: dim `indexed in <ms>ms ` for 2000 ms
- no match and non-empty query: colour key `error`, `no matches `
- matches: dim `<current>/<count>  `

Behaviour: Enter (`onExit`) commits (`onClose(query)`: keeps the query only if count>0, then the footer shows `n/N to navigate` and `cur/count`); Esc (`onCancel`) closes and restores the previous query; typing searches live (`setSearchQuery`). `/` first calls `setAnchor()` so Esc can scroll back to the pre-search position. Case-insensitive substring (`indexOf` on lowercased text). Terminal resize while searching clears the search.

### Match highlight (renderer, offset 260279113 and 260397874)

- all matches: SGR 7 (inverse) added to the cell style (`withInverse`)
- current match (`withCurrentMatch`): drops fg-default / bg-default resets and adds SGR 33 (yellow fg) + 1 (bold) + 7 (inverse) + 4 (underline)

Result: all hits inverse, the current one inverse + bold + underline + yellow foreground. Not a theme colour key; fixed ANSI codes.

Confidence: high on keys, wording and layout; high on SGR codes. Needs capture: exact on-screen alignment of the three card columns (gap math) and whether the yellow resolves against the theme palette (it is raw SGR 33, so the terminal's yellow).

## 2. Background shells list dialog and `x` in Shell details

Anchors: `No tasks currently running` (281014937), `Shell details` (280973687), `function ef(` (280938765), `function B2({onClose` (280189908).

### List dialog (title `Background`)

`we` dialog frame: `title:"Background"`, `subtitle` = summary string, `color:"background"` (becomes `permission` when the compact line list `es` is active), `onCancel` = Esc (in action mode goes back to the list, otherwise closes with `Background dialog dismissed`, display skip).

Subtitle: joined summary of `N agent(s)` (teammates), `N active shell(s)` (singular `1 active shell`), `N active agent(s)`.

Rows are grouped, each group with a heading `cm({label, size})` rendered as `<Label> (<n>)` and a blank gap line between groups. Group order (first non-empty ones only): Agents, Shells, Monitors, MCP tasks, Cloud agents, Local agents, Completed, Dynamic workflows, then dream / auto-mode-scan / memory-import (no heading), self-managed, subagent history. The `Shells` heading is shown only if another group is also non-empty (`(agents||cloud||local||completed) non-empty`); with shells alone there is no heading. Row for a shell (`local_bash`): label = the command (or description for a monitor), icon `wv(status)`, meta `[gzt(status)]`. Empty list: `No tasks currently running`.

Footer key guide (inputGuide, order): `↑/↓ select` · `enter view` (when a viewable item is focused) · `f foreground` (agents only) · `x stop` (focused item can be stopped: running shell/agent/monitor) · `esc close` (or `go back` in actions mode).

### Shell details (`LY`, title `Shell details`, or `Monitor details` for monitors)

Frame `we` with `color:"background"`. Guide (`ef`): `left go back` (only when opened from a list) · `escape/enter/space close` · `x stop` (only when status is running and an `onKill` exists). Body: a 2-column table with bold labels:
```
Status:   running  (colour background) | completed (success) | other (error); " (exit code: N)" appended when code known
Runtime:  <duration>   (live, endTime ?? now)
Command:  <command, cut to 280 chars>      (Monitor: "Script:")
```
then bold `Output:` and a box (`borderStyle:"round"`, paddingX 1, height 12, last up to 10 lines each truncate-end) followed by dim italic `Showing N lines` (+ ` of <size>` when truncated); `No output available` / dim `Loading output…`. Output re-polled every 1000 ms while running.

Key handler (`B2`): `x` (no ctrl/meta) with an `onKill` calls it immediately: no confirm dialog. Space closes, left goes back, Enter closes via `confirm:yes`.

Confidence: high on titles, headings, guides, status wording and keys. Needs capture: the exact glyph/meta strings of a shell row (`wv`, `gzt`), what the dialog does right after `x` (stay open with status killed, or close), and the width of the table label column.

## 3. Paste numbering

Anchors: `Yne(e,n,r="Pasted text")` (251488437), `class gCt{next=1` (253228547), `mintTextPaste` (264968611), paste handler `_g` (281155725).

```
function Yne(e,n,r="Pasted text"){if(n===0)return`[${r} #${e}]`;return`[${r} #${e} +${n} lines]`}
class gCt{next=1;minted=new Set;advancePast(e){...if(e>=this.next)this.next=e+1}
  advancePastText(e){for(let n of pu(e))this.advancePast(n.id)}
  startEpoch(e){this.minted=new Set;this.flooredSessionId=e}
  mint(){...let e=this.next++;this.minted.add(e);return e}}
function HR(e,n){return kCt(n9(),e,n)}   // advancePastText(query) + advancePast(each pastedContents key) + mint()
```

Rule: the number comes from one process-wide counter that only moves forward. Minting first advances it past every `#N` still in the prompt text and past every key of `pastedContents`, then hands out `next++`. Clearing a paste from the prompt never lowers it, `startEpoch` only resets the `minted` set, so the next paste after clearing gets a higher number (#1, clear, paste again gives #2). The counter is shared with `[Image #N]`. `+M lines` is the newline count (`$1` counts `\r\n|\r|\n`), so 11 lines shows `+10 lines`; zero newlines shows no `+M`.

Trigger (prompt, offset 281155725): text longer than 800 chars (`p5=800`) or more newlines than `max(0, min(rows-10, 2))` (normally > 2, so 4+ lines). Pasting the same text again immediately while the placeholder is still there expands it back to the real text (`op()` branch, `paste again to expand` hint for 8000 ms when length <= `NQe`).

Confidence: high on the monotonic counter within a process. Medium that `/clear` or a new session also keeps counting (the singleton is `Ydo.of(U())`, tied to a state object; not checked what `U()` is across `/clear`). Needs capture only for that corner.

## 4. `Ctrl+Y to paste deleted text` kill-paste hint

Anchor: `Ctrl+Y to paste deleted text` (264256955).

```
function Tt(){let{cursor:c,killed:C}=w.deleteToLineStart(...),v=ve(C,"prepend");
 if(B===""&&v.length>=3)Ge({key:"kill-paste-hint",kind:"hint",text:"Ctrl+Y to paste deleted text",
   row1Hint:"ctrl+y to undo delete",priority:"immediate",timeoutMs:5000});return c}
...["u",Tt]...   // the ctrl+u binding in the readline table
```

Rule: only on `ctrl+u` (delete to line start), not on ctrl+k, ctrl+w or alt+d. Fires when the prompt is not a masked (password) input (`mask===""`) and the killed text, minus any leading pill prefix, is at least 3 characters. It is a notification (`addNotification`) with `kind:"hint"`, `priority:"immediate"` (replaces whatever notification is up), `timeoutMs:5000`, and the compact one-row form `ctrl+y to undo delete` (`row1Hint`). Position is the normal prompt notification slot (same slot as `Esc again to clear`, the `thinking-toggle-hint`, etc.). Same key repeats the same `key`, so a second ctrl+u refreshes rather than stacks.

ctrl+y yanks the kill ring (`er`), alt+y cycles it (`tr`).

Confidence: high on trigger, text, duration. Needs capture: the colour (hint notifications with plain `text` carry no colour field here, so it is the default footer style, almost certainly dim, but the renderer for `text` notifications was not read) and the slot (footer right vs row below the prompt).

## 5. Compaction screen

Anchors: `Compacting conversation` (264158637, 279776842), `Conversation compacted` (279543592), `text:"Compacted"` (`nu`, 279412000 region), `Earlier messages are saved in`, `Referenced file` (279491098).

- User row: the ordinary echoed command row `❯ /compact` (same as any slash command; nothing compaction-specific found).
- Spinner line while compacting (`Hl`): `Compacting conversation…` (message passed through `Vg(L,"…")`, the single-char ellipsis is added), drawn by the shimmer component `Lxt` with `tone:"dim"` (not the normal coloured spinner), inside a column with `marginTop:1`, `width:100%`. `compactingHintText` from the `compact_start` event (`hintText`) replaces the text when the generic message is unchanged. Sibling messages: `Running PreCompact hooks…`, `Running PostCompact hooks…`. While compacting, the CLI-activity key is `compacting-line`.
- Result row, two renderings of the compact_boundary system message (component `yd`):
  - transcript-v2 row mode (`ru(compactMetadata, ...)` true, i.e. not a manual compaction in the fullscreen-hidden case): a dim line row with text `Compacted` and detail
    - `N messages summarized (ctrl+o to see them)` when `messagesSummarized > 0` (`1 message`), else `N tokens summarized (…)` when `preTokens > 0` (`yr()` = short number format), with the parenthesis part `(<ctrl+o key> to see them)` before the summary is known / `(… for the summary)` once it is; plus subLine `Earlier messages are saved in <path>` when the summary transcript path exists.
  - classic row (`marginY:1`, dim): `✻ Conversation compacted (ctrl+o for history)`, becoming `(ctrl+o for the summary)` once the summary is attached (empty parenthesis when none); beneath it, `paddingLeft:2`: `Earlier messages are saved in <file>` (file as a link). `✻` is `\u273B`. The key name comes from the keymap for `app:toggleTranscript`.
  - Rule of thumb for 2.1.310 pins: check which of the two the replayed captures show; the code allows both.
- Re-attached files after compaction: file attachments of type `file` render as `Read <bold displayPath> (N lines)` (`N+ lines` when truncated, `unchanged` for a deduplicated read, `N cells` for notebooks, byte size otherwise); files too big to re-include (`compact_file_reference`) render `Referenced file <bold displayPath>`. Directory attachments: `Listed directory <bold path/>`. Row prefix glyph is the shared attachment row component (`Me`), not resolved here (name collision).

Confidence: high on strings and which component draws what; medium on which of the two result renderings applies in the pinned setup. Needs capture: the glyph and indent in front of `Compacted` and the attachment `Read …` rows, exact detail separator between `Compacted` and its detail, and whether `✻` path is seen at all in the pinned 2.1.310 default mode.

## 6. Loose markdown lists

Anchors: `case"list":` / `case"list_item":` in the markdown renderer (`uF`, offsets 259732900 to 259737200). No `loose` property is read anywhere in it (only zod `.loose()` hits elsewhere).

```
case"list": return e.items.map((u,f)=>uF(u,t,{listDepth:r,orderedListNumber:e.ordered?e.start+f:null,...})).join("");
case"list_item": ... tokens after the first non-space: for each token x:
   code|blockquote|hr|table|list|space -> returned as rendered (space renders m = "\n")
   otherwise -> bullet/number prefix on the first line, indentation `h` on the rest
case"paragraph": ...+m     case"space": return m
```

Rule: items are joined with the empty string and no separator is added for a loose list, so Claude drops the blank line between the items of a loose list (each item is its own line group of the text plus one newline). The only way a blank line survives is an explicit `space` token inside an item (the renderer returns one `\n` for it), which marked emits only when the item text ends with two or more newlines; in the usual `- a\n\n- b` shape the single blank line is folded into the previous token's `raw`, so no `space` token and no blank line. Nested content inside an item (second paragraph, code block, sub-list) keeps its own line breaks.

Confidence: medium-high. Reasoning from the renderer plus marked's lexer behaviour, not a live render. Needs capture: one loose list (`- a\n\n- b\n\n- c`), one with a second paragraph per item, and one nested loose list, to confirm that no blank line shows and to see what a two-blank-line gap does.
