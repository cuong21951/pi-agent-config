# claude-drift-310: 2.1.289 -> 2.1.310 terminal-UI change inventory

Method: `mmap` + regex over `claude-2.1.289.exe` and `claude-2.1.310.exe`
(scratch: `%TEMP%\pi-parity\discovery\claude-drift-310\`; `versions/2.1.308` and
`2.1.309` were not mined separately, 2.1.310's own bundle already holds their
notes). The 2.1.310 binary embeds Claude's release notes as one double-quoted JS
string (`Ddo()`, byte offsets 262,753,590 to 262,849,191) with headers
`## 2.1.309` ... `## 2.1.299`: **eleven versions, 632 bullets, verbatim**
(309 = 79, 308 = 1, 307 = 43, 306 = 2, 305 = 38, 304 = 76, 303 = 1, 302 = 63,
301 = 51, 300 = 88, 299 = 190; saved as `notes_raw.txt`). The window starts at
2.1.299, so **2.1.290-2.1.298 have no entry in this binary, and 2.1.310 has none
in its own binary** (newest header is 309, the same pattern as 288/289 in
`claude-drift-289.md`). 2.1.303 and 2.1.308 are the one-line "Bug fixes and
reliability improvements" entries.

To cover the hole I also read GitHub's public `CHANGELOG.md` through WebFetch.
That tool returns a small model's paraphrase, not the text, so those rows are
tagged **web** and are weaker than binary evidence: 290, 292, 293, 295, 296 and
310 were readable (290 about 180 bullets, 292 about 91, 293 about 56, 295 about
143, 296 79, 310 26; counts are the summariser's hand tallies), 291 and 294 are
two-bullet entries with nothing visible, and **297 and 298 are absent from that
text** (unknown). 288 and 289 appear there too but are already inside the 289
baseline, so they are not drift.

Literal-string corroboration counts occurrences of a distinctive UI string in the
JS region (offset >= 150 MB) of the 289 and 310 binaries, with the release-note
string itself excluded (so no "+1 from the changelog" correction is needed). I
also diffed the sets of quoted string literals of 10-200 characters
(112,380 in 289, 126,232 in 310; 90,088 only in 310): mostly minifier fragments
and model-facing text, so only the UI-looking ones were read (`str_new.txt`).
Strings built by templates have no literal and count 0 in both; raw literal
diffing of colours or layout is not used (minifier renaming, see claude-drift.md).

Evidence tags: **literal** = a non-templated string is new in 310; **changelog
only** = release note, no literal isolated; **contradicted** = code literal
unchanged in 310 despite the note; **web** = paraphrase from the public changelog;
**literal-only** = string found, no release note.

Verdicts: `port` changes an element pi matches (README "Claude parity" ledger),
`new` is a feature pi lacks, `n/a` is not visible, account-only or not our
platform, `measure` needs an on-screen capture of 2.1.310 to know.

## Items (notes-verified 2.1.299-2.1.309)

| # | Ver | Bullet (shortened) | Evidence | pi surface (README) | Verdict |
| --- | --- | --- | --- | --- | --- |
| 1 | 307 | Fork subagents launched together: each is told which launch is its own | changelog only | `<fork-boilerplate>` directive ported byte for byte, README 97, `m6g-fork` and `reqdiff` `sub:<key>:fork` | port |
| 2 | 309 | ctrl+o shows messages from other agents and sessions still waiting to be delivered, in full under the transcript, marked waiting | literal: `Waiting to be delivered` 0 -> 1, `transcript_waiting_messages` 0 -> 2; code is a dim row with a blank row above, then the messages | ctrl+o detailed transcript, README 70 | port |
| 3 | 302 | `← for agents` footer hint hides 10 s after a session opens (count of agents waiting on you stays) | literal: ` for agents` 2 -> 3 | mode row; README 105 excepts `· ← N agents`, a capture later than 10 s may differ | measure |
| 4 | 307 | `/help` and the `/` menu show short descriptions for bundled skills such as `/claude-api`, not the long model-facing text | changelog only | slash menu rows and skills, README 52, 65, 66 (Cuong's skill list holds `claude-api`) | measure |
| 5 | 304 | Write results and rejected edits show a file outside the working directory as `~/…` or the full path, not `../../…` | changelog only | Update/Write rows and `User rejected update to <path>`, README 40, 41, 68; `● Updated plan` already special-cased | measure |
| 6 | 300, 301 | Dim text on the dark ANSI theme and 16-colour terminals: faint inside filled boxes, not faint under selection and search highlights, list descriptions dimmed like other secondary text | changelog only | prompt band `373737` is a filled box, slash menu descriptions `999999`; ledger measured dark-daltonized truecolour, which may be untouched | measure |
| 7 | 309 | ctrl+enter (send now) queued only before the response started; with hooks running it restarted them and left the message queued | changelog only | send-now, README 46 and 88 (`intent-tools` ctrl+enter / ctrl+x ctrl+s) | measure |
| 8 | 301 | Tool call cut off by a message sent mid-turn during its permission check was reported to the model as rejected by the user | changelog only | queued messages and merged tool result text, README 88-89; model-facing, needs a request dump | measure |
| 9 | 299, 301, 302 | Wrapping: CJK or emoji mixed with Latin words lost a last line or left a blank row; wide characters cut beside a colour change; emoji at a link start wrapped one column too wide; nested bold/italic ran over table borders or was lost on wrapped rows; header-only table drew nothing when too wide; keycap emoji cut permission reasons | changelog only | wrap-ansi wrap and GFM tables, README 36, 38 (ASCII text in the suite, so most likely unaffected) | measure |
| 10 | 300, 302, 304 | Agents view and `/tasks`: messaged subagents no longer vanish from `/tasks` after finishing; completed parent stays in the breadcrumb while viewing a child; typed words such as "up" no longer act as keys; rows no longer blank after scrolling a long list | changelog only | agent view and `/tasks`, README 87 (m6f-view) | measure |
| 11 | 301 | Compaction row in a resumed session no longer offers ctrl+o for unloaded history, says where earlier messages are saved, also shows in fullscreen | literal: `ctrl+o to see full summary` 0 -> 0 (template) | `Compacted (ctrl+o to see full summary)`, README 74 | measure |
| 12 | 299 | Background agent notifications say when an agent only waits on its own background work, got a message too late for its result, or was stopped by a usage limit | changelog only | task-notification text byte for byte, README 44, 96 | measure |
| 13 | 299 | One-time note when plan mode will not ask before most edits because bypass permissions is available | literal: `bypass permissions is available` 0 -> 0 (template) | plan mode end to end, README 55 | measure |
| 14 | 299 | Enter no longer answers a question or permission prompt that was held back while an unsent message was typed | changelog only | ask-user-question and permission dialogs, README 55, 75 | measure |
| 15 | 299, 302 | `idleCompaction` setting, idle compaction after about 54 min, `Idle compaction` row in `/config`, notices after it say how to turn it off | literal: `Idle compaction` 0 -> 1, `idleCompaction` 0 -> 13 | no idle compaction, no `/config` (README 74 covers manual and auto compaction only) | new |
| 16 | 299, 301 | Fullscreen "Update installed" notice sits beside the idle `new task? /clear to save tokens` hint; the hint no longer returns right after an interrupt | literal: `new task?` 1 -> 1, `Update installed` 3 -> 3 (template, the 289 hint exists) | pi draws neither hint | new |
| 17 | 299 | `/effort` and `/fast` in agent view; bare `/model`, `/effort`, `/fast` there open a picker | changelog only | agent view exists (README 87), no pickers | new |
| 18 | 299, 304 | ScheduleWakeup, `/loop`, scheduled tasks: next-run times, DST, 1-hour wakeups | literal-only: `Pending wakeup cancelled` 0 -> 1, `loop-wakeup-cancelled` 0 -> 1 | Cron/ScheduleWakeup not built, README 110 | new |
| 19 | 304 | Compaction summary in the ctrl+o view lists the tools called earlier | changelog only | README 93 already lists `● Compact summary` as unported | new |
| 20 | 304 | `/auto-mode-setup` guided setup | changelog only | no counterpart | new |
| 21 | 305 | MCP consent dialogs: an Enter meant for the prompt is less likely taken as Accept | changelog only | pi asks nothing for MCP, README 94 | new |
| 22 | 299-305 | Workflow tool fixes (resume from journal, agent skipping its step, scripts after `cd`) | changelog only | Workflow not built, README 110 | new |
| 23 | 299 | Agents view peek panel `safe mode` line | literal: `safe mode` 31 -> 34 | background sessions only | n/a |
| 24 | 299, 304, 305 | `/usage`: warnings (max effort, workflows, always-on context, large results), when a rate limit ends, one-line fixes applied with `f`, rows cut off in narrow terminals | literal: `max effort` 0 -> 1 | pi `/usage` shows the Session block and its own balances; the contributing-to-limits section is excluded, README 78, 79, 103 | n/a |
| 25 | 299 | Exit resume command names the session by id; a worktree session uses `-w`/`-r` | literal: `Resume this session with` 1 -> 2, ` -w ` 2 -> 4 | pi already prints an id command, README 63, 113 | n/a |
| 26 | 299, 305 | Unrecognized-model startup warning is one line under the banner; other startup warnings go to the debug log, rules that restrict nothing show as warning rows | literal: `Unrecognized model` 0 -> 0 | header height matched, README 112; rows appear only on a misconfigured start | n/a |
| 27 | 300 | `/sandbox` options read "Sandbox commands" instead of "Sandbox BashTool" | literal: 0 -> 3 and 3 -> 0 | no `/sandbox` | n/a |
| 28 | 309 | `sed -i` gets the standard Bash prompt and runs as written, not a simulated file-edit preview | changelog only | pi's Bash dialog is already the standard one, README 75: pi matches 310, not 289 | n/a |
| 29 | 309, 305, 304 | Disk-full wording for Bash and startup (`disk is full`, "nothing ran") | literal: `disk is full` 0 -> 2 | pi's bash tool is its own | n/a |
| 30 | 309 | `/rewind` list "No code changes" fix; `/artifacts` delete keys 1/2/Esc (304, 305, 306) | literal: `No code changes` 2 -> 2 | no `/rewind` or Artifact tool in pi | n/a |
| 31 | 304 | Removed "(research preview)" from the `/fast` dialog title on Opus 5.5 | **contradicted**: `(research preview)` 1 -> 1, the removal is model-conditional | no `/fast` | n/a |
| 32 | 304 | Notes typed into a question with previews cut with `…` under about 100 columns | changelog only | question dialog, README 55; suite runs at 132 columns | n/a |
| 33 | 299, 301 | Vim mode (`%` motion, Esc and AskUserQuestion fixes) | changelog only | pi editor is not vim | n/a |
| 34 | 301 | Stray `>0q` and `GOK` text in VTE and iTerm2 | changelog only | not our terminal | n/a |
| 35 | 304 | Transcript `{`/`}` landing row; fullscreen double-click on an expanded row; `/btw` scroll jump; hovered-link underline (296) | literal-only: `hoveredLink` 0 -> 16 | README 100 (transcript keys not matched), no mouse tracking | n/a |
| 36 | 307, 309 | Unparseable tool calls retried twice; background command stopped by a connected app named in the notice | changelog only | model-facing, app-only path | n/a |
| 37 | 299, 302, 307 | Read/Write non-UTF-8 refusals, binary reads, image size limits, WebSearch budget notice | changelog only | pi's own tools | n/a |
| 38 | 309 | Key-bound slash commands no longer run in the shell from `!` mode | changelog only | bash mode, README 90 (pi has no key-bound commands there) | n/a |
| 39 | 309 | "Waiting for API response" hint no longer flickers behind gateways (45 s off Anthropic's backend) | literal: 1 -> 1 | gateway path only, pi talks to other providers | n/a |

## Items (web-sourced, 2.1.290-2.1.296 and 2.1.310, paraphrased)

| # | Ver | Bullet (paraphrase) | Evidence | pi surface (README) | Verdict |
| --- | --- | --- | --- | --- | --- |
| 40 | 290 | A `❯` pointer marks the selected row in `/` and `@` suggestion lists | web; glyph is not countable | slash menu: selected row `99ccff` throughout, no pointer recorded, README 52, 65, 66 | measure |
| 41 | 292 | Ctrl+C draft recovery: the cleared prompt stays reachable with Up (288 added Up on an empty prompt) | web; literal `restoreDraft` 6 -> 6 | ctrl+c clears typed text with no recovery, README 59, 89 | port |
| 42 | 310 | A question's auto-continue timeout no longer fires right after the external editor closes | web | `question-afk` clock and `ctrl+g` editor, README 57 | port |
| 43 | 293 | Agent detail title keeps the agent type after the agent finishes | web | `/tasks` card `type › description`, README 87 | measure |
| 44 | 292 | Write, Edit, NotebookEdit and LSP rows no longer hide why a denial happened | web | Edit decline rows, README 68 | measure |
| 45 | 295 | Tab stops count from where the text starts, not the screen edge | web | tool-output rows and diffs with tabs, README 40 | measure |
| 46 | 292, 293 | Fast typing dropped while a footer row is selected; `!` left the row selected | web | footer pill focus, README 45 | measure |
| 47 | 290 | `ctrl+x ctrl+k` hint on background-agent permission prompts | web; literal `ctrl+x ctrl+k` 5 -> 7 | agent permission prompts not matched, README 109 | new |
| 48 | 292 | `/focus` tips: "Just want the answer? Run /focus now to hide the steps along the way", "Focus view is on and the steps are hidden. Run /focus to show them" | web; literal 0 -> 1 each | no `/focus`, no tips, README 107 | new |
| 49 | 293 | Bash edit diff note says listed files may have changed during the command | web | no equivalent | new |
| 50 | 295 | `/copy` picker can copy quoted text without the `>` markers | web | `/copy` is pi's builtin | new |
| 51 | 296 | Auto mode's unrun tool calls draw a dim `Not run` row (`Not run` plus "auto mode's check had no usable answer") instead of a red error | web; literal `Not run` 15 -> 36 | no classifier, README 84 area (deferred) | new |
| 52 | 310 | Auto mode's prompt before the first read outside the working directories says when blocking reads makes shell commands ask | web | deferred in 289 verdicts (no classifier prompt) | new |
| 53 | 310 | Monitor tool and plugin monitors on Bedrock, Vertex, Foundry | web | Monitor not built, README 108 | new |
| 54 | 295 | Program Status Protocol: terminal learns working, waiting, done | web; no literal found | invisible to the screen model, raw bytes only | n/a |
| 55 | 295 | "Backgrounding cancelled" notices for the agents `←` key | web; **contradicted**: literal 3 -> 3 | `claude agents` only | n/a |
| 56 | 310 | File read permission prompts show where a symlink leads; `/sandbox` AppArmor wording | web; literal `AppArmor` 0 -> 3 | pi asks nothing for reads, no `/sandbox` | n/a |
| 57 | 290, 292, 293, 295, 296 | Agents-view-only, `claude agents`, `/permissions`, `/plugin`, hook, vim, `--debug`, cost-pricing bullets | web | no counterpart | n/a |

## Found only in the binary (no release note)

| # | Evidence | Finding | Verdict |
| --- | --- | --- | --- |
| 58 | literal-only | New dialog: `We recommend compacting earlier` with `↑/↓ choose · ←/→ change size · enter confirm · esc not now` and `More text above: scroll up, or enlarge the terminal`; `Autocompact unchanged · /autocompact to change it` 0 -> 3 | new |
| 59 | literal-only | `Send now isn't available here · esc to interrupt and send` 0 -> 1 (remote mode only) | n/a |
| 60 | literal-only | `Waiting for you in the chat`, `Can't group a session that's running in another terminal`, `Esc to close` 2 -> 3 (agent view) | n/a |
| 61 | literal-only | Error strings `Couldn't save Theme` 0 -> 3, `Could not compact` 0 -> 1, `Turn failed` 0 -> 1, `Disk quota exceeded` 0 -> 1 | n/a |
| 62 | not drift | `Ctrl+Y to paste deleted text` (`kill-paste-hint`, row above the box after ctrl+u clears 3+ characters from an empty-ended line) and `Clear the input to edit this queued shell command` are 1 -> 1: already in 289, pi lacks both | new (baseline gap) |

## Could not measure
- 2.1.290-2.1.298 and 2.1.310 have no notes in any binary on disk; rows 40-57 rest on a model's paraphrase of the public changelog and must be re-checked against the binaries and a capture. 2.1.297 and 2.1.298 are unknown (not in the public text either).
- Colours (dim handling, `❯` pointer colour) are not hex literals: need a live capture on 2.1.310. Template-built strings (`Waiting to be delivered` header row spacing, the `← for agents` timing, outside-cwd path form) need a capture to fix geometry.
- No `claude.exe` was run (constraint), so nothing was observed on screen.

## Counts
- Bullets in the 2.1.299-2.1.309 notes: 632 (309: 79, 308: 1, 307: 43, 306: 2, 305: 38, 304: 76, 303: 1, 302: 63, 301: 51, 300: 88, 299: 190).
- Covered by the table rows above (TUI-visible or nearly so): 78 bullets, in rows 1-39.
- Dropped as having no terminal effect: 554 = 424 in named classes (VS Code 52, Claude Tag 37, Cloud sessions 26, Code Review 12, Remote Control 4, self-hosted runner 17, Windows/macOS/Linux 9, mods API 54, OpenTelemetry 16, hooks/plugins/marketplace 44, sandbox and Bash safety 26, MCP/auth/gateway/provider/SDK/headless 74, worktree/git 17, claude-api/skills/artifact/dataviz 26, `claude` subcommands 10) plus 130 plain fixes and model-facing changes with no visible effect (see `other_bullets.txt`).
- Rows by verdict (62 rows): port 4 (rows 1, 2, 41, 42), measure 17 (rows 3-14, 40, 43-46), new 17 (rows 15-22, 47-53, 58, 62), n/a 24 (rows 23-39, 54-57, 59-61).
- Rows resting on the binary's own notes: 1-39 (notes) and 58-62 (literals only); rows 40-57 are web paraphrase.

## Prioritised list (port and measure)

1. Row 1, fork directive (port): rerun `m6g-fork` with `reqdiff` against 2.1.310; the only `port` with a model-facing diff that is certain to exist.
2. Row 40, `❯` pointer in `/` and `@` lists (measure, web only): type `/` and capture; every slash-menu scenario is affected if true.
3. Row 41, Up recovers the Ctrl+C-cleared prompt (port): `claude-keys` has no editor handle today, README 59.
4. Row 3, `← for agents` hint hidden after 10 s (measure): the mode row is in every capture; check at 5 s and 15 s.
5. Row 4, bundled skill descriptions in the menu (measure): `/claude-api` row in `slash-skill`.
6. Row 5, outside-cwd paths (measure): Write and a declined Edit to a file under `%TEMP%`.
7. Row 6, dim text in filled boxes (measure): queued row `❯` band and slash description SGR on 310.
8. Row 2, waiting messages under ctrl+o (port): ctrl+o while a notification is queued.
9. Row 42, question auto-continue after the editor closes (port): `question-afk` plus ctrl+g.
10. Row 7, send-now timing (measure): ctrl+enter after the first response bytes, then `m6a-sendnow`.
Then rows 9, 10, 43 (wrap/tables, agents view, `/tasks` title), 11, 12, 13, 14.

## Verdicts (not yet measured on 2.1.310)

| Item | Verdict | Evidence |
| --- | --- | --- |
| Fork directive (307) | port | changelog |
| `Waiting to be delivered` under ctrl+o (309) | port | literal |
| Up recovers Ctrl+C-cleared prompt (292) | port | web |
| Question auto-continue after editor close (310) | port | web |
| `❯` pointer, `← for agents`, bundled skill descriptions, outside-cwd paths, dim text, send-now, wrap/tables, agents view, compaction row, notifications, plan-mode note, held-prompt Enter, `/tasks` title, denial reason, tab stops, footer pill | measure | see rows 3-14, 40, 43-46 |
| Idle compaction, hints, wakeups, MCP consent, Workflow, `/focus`, Monitor, auto-mode rows, compaction-size dialog | new | rows 15-22, 47-53, 58, 62 |
| Account, platform, remote, hook, mod, vim and error-string bullets | n/a | rows 23-39, 54-57, 59-61 |
