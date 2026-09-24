# pi-agent-config

> **Gửi Phương**
>
> Bộ trợ lý này anh làm riêng cho em. Anh yêu em, kể cả những lúc em ngốc nghếch một cách rất
> đáng yêu. Anh bỏ thời gian gom đủ kỹ năng vào đây để em tự đọc được báo cáo tài chính, tra
> được luật, ghi được biên bản họp và làm được slide mà không phải chờ chồng. Mục tiêu của anh:
> em thành **corgi tài chính** của dự án Kuha, chân ngắn nhưng chạy số rất nhanh. Không hiểu gì
> thì hỏi trợ lý trước, hỏi anh sau. Anh yêu em.
>
> Hướng dẫn cài đặt cho em ở đây: [kuha/README.md](kuha/README.md)

Cuong's [pi](https://pi.dev) harness, kept in git so it can be restored on any machine, plus the **Kuha** business pack: the skills I built so my wife Phương can become the finance corgi of the Kuha project (see `kuha/README.md`).

## What is here

| Path | Purpose |
|---|---|
| `AGENTS.md` | Global rules for every pi session (finish the job, verify before claiming, model routing, output shape, Azure DevOps facts). |
| `settings.json` | Model, packages, skills, prompts, regular (non-alt-screen) TUI so the terminal keeps its scrollback, theme. Paths are absolute to this machine. |
| `mcp.example.json` | MCP servers with direct tools. Copy to `mcp.json` and fill in the Azure DevOps PAT; `mcp.json` is gitignored. |
| `extensions/` | claude-memory (shared memory index + `remember` tool), claude-working (Claude-style sparkle spinner, shimmering verb, elapsed/tokens line), claude-tools (read/write/edit/grep/find/ls rendered as `● Read(path)` / `⎿ Read N lines`, `● Update(path)` + diff, `● Search(pattern: …)`), claude-messages (`● ` before assistant text, `✻ Thinking…` label), intent-tools (labelled compact bash rows), claude-header, cheap-models, claude-mcp-render, rtk-bash, deepseek-guards, no-code-comments., claude-bottom-input (pads above the editor so prompt and footer sit on the bottom rows in regular mode), claude-skills (`skill` tool the model calls instead of reading SKILL.md with `read`, rendered as `● Skill(name)` / `⎿ Successfully loaded skill` like Claude Code; also repoints pi's built-in skill instruction at the tool), claude-modes (manual / accept edits / plan / bypass / auto on shift+tab, and Claude's plan mode: the plan file under `~/.pi/agent/plans`, the `enter_plan_mode` / `exit_plan_mode` tools, the "Ready to code?" approval dialog, `/plan`), claude-effort (the `/effort` command; claude-working shows Claude's 10 s `● high · /effort` notice when the effort changes), claude-slash-menu (Claude's Fuse.js slash-command matcher for pi's menu), claude-help (`?` on an empty prompt shows the shortcut card), claude-keys (double-tap esc clears the prompt, ctrl+s stashes and restores it), herdr-state (reports session and working/idle state to herdr like the Claude Code hook) |
| `keybindings.json` | `ctrl+p`/`ctrl+n` also browse prompt history; Up/Down do it at the edges of the prompt like Claude Code. `ctrl+alt+v` is pi's own image paste so `alt+v` is free for claude-images. `ctrl+shift+t` is pi's thinking toggle so a Claude-trained `ctrl+t` cannot flip it by accident; `ctrl+alt+s` saves the model and thinking picker defaults so `ctrl+s` is free for claude-keys. |
| `agents/`, `prompts/` | scout / planner / worker / reviewer for `@tintinweb/pi-subagents`, and the `/implement`, `/implement-and-review`, `/scout-and-plan` chains. |
| `themes/claude-dark.json` | Dark theme with daltonized diff colours and Claude orange accents. |
| `skills/` | Local skills (browser-tools patched for Windows, film-download, research helpers). |
| `kuha/` | The Kuha pack: 9 skills, 6 slash prompts, Vietnamese AGENTS.md, README and installer. See `kuha/README.md`. |

## Claude parity

The target is Claude Code 2.1.281 (it auto-updated from 2.1.280 on 2026-09-24; the full suite against 2.1.281 differed only on the agents list hint below), dark theme, 132 columns, measured on screen and read out of its bundle. Each item was measured on Claude first; the parity suite (see Testing) holds a scenario or replay that compares it with pi. An item is either matched or listed under **Not matched: pi cannot produce** with the measurement that shows why. The diff script reports those exceptions by name on every run; nothing else is normalised away.

**Matched**

- Prompt band: `❯` + space in the gutter on `373737`, text 129 columns wide at 132 (Claude's wrapped prompt rows reach column 131, never 132), wrapped rows hanging two columns in. The text stays `999999` until the model's first bytes arrive (Claude's `promptsAwaitingModel`), a retry wait included; `❯` above the input is `999999` for the whole turn.
- Word wrap is Ink's `wrap-ansi` with `trim: false`, which Claude renders every text through: a row after one that is exactly full holds one column less. 26 of 27 captured paragraphs follow it; plain greedy wrap fits 24.
- A text or thinking block appears only once it is complete. Claude 2.1.280 never shows streaming text (`isStreamingTextVisible()` is `!reducedMotion && !cct()`, and `cct()` returns true); a three-paragraph reply lands in one frame.
- Markdown: headings without `#` (h1 bold, italic, underlined), bold, inline code, lists nested two columns per level, GFM tables with alignment and a plain header, `▎` quotes with a dim bar, a thematic break as its own text, links in SGR 94, code fences without fence lines coloured by Claude's own algorithm on highlight.js 11.12 (ANSI-16 scope map, each node in its own scope's colour, an untagged fence in `99ccff`).
- Hidden thinking and the collapsed tool group, in every state. A thought joins the open group; text or an own-row tool closes it. While the group is active (a member running, or the turn loading with nothing after it): a blinking dot; the task summary (the question, the bash description through Claude's own verb tables `BHr`/`idn`, 40/40 phrases identical, or the activity text) or the active sentence with `…`; ` · Ns` once a running member is 2 s old; a hint row with the thought (faint italic, held 3 s) or the command, path or pattern, and `(Ns)` on a bash that has run 3 s (Claude's first `bash_progress` tick, `j6t` = 2000 ms plus one poll). Finished, it is the grey past sentence in Claude's clause order. Each call lands in one bucket, as in Claude's aggregator (`gtr`): a bash made only of search, read or list words (`U2r` word sets, `rtk` not stripped) counts in that clause, any other bash is one shell command however many `||`/`;`/`&&` segments it chains. Claude's renderer never lowers a count while the group lives (`Math.max(be.X, Me.X)`), and a streaming tool call has no input yet, so a classified bash (or pi's `ls`, which reaches Claude as `Bash ls`) that joins after the first member is briefly one more shell command; the sentence shows that peak. `replays/shell-credit.jsonl` measures five orders of it. The classifier reads the model's own command, not the copy rtk-bash rewrites before execute. While a call waits for permission, the thought hint holds for its 3 s and then gives way to the waiting call's `$ command`.
- Read / Search / List / Bash, ok and failing (folded into the sentence); the Update diff (3 context lines, no gap row before the first or after the last hunk, tabs as 2 columns, word-level highlight with Claude's tokenizer and 40% limit, dim gutter on context rows); the Write preview (dim gutter); MCP calls, ok and failing (`Called server N times`); Skill; `● Updated plan` for a write to the plan file.
- Edit with an empty old text is Claude's Create (bundle `_le`, `validateInput`; `replays/edit-create.jsonl`): a single edit whose `oldText` is `""` writes the file through pi's own write when it is missing or blank, and draws `● Create(path)` + `⎿ Added N lines` with the all-added diff; a file with content is refused with Claude's `Cannot create new file - file already exists.`. A failed edit draws Claude's Edit error row (`ie`): red `Error editing file`, `File not found` for pi's `ENOENT`, pi's own text only on ctrl+o; the dot of a failed Write/Update row is `ff6666`. Before this, Sonnet's empty-oldText edit of a new plan file failed in pi and succeeded in Claude (the `plan` scenario).
- A new plan file's slug is drawn again while a file of that name already exists, up to 10 draws (Claude's `getPlanSlug` checks the plans listing, `oe = 10`). Before, pi could hand a plan-mode turn someone else's stale plan when the first four prompt words matched: the `plan` scenario drew one of the 19 test plans left in `plans/` and its Create was refused.
- A tool component whose first row is an elbow hangs from the row above with no gap, like Claude's null tool-use row; no row in the suite had an elbow after a blank on either side before the change.
- Background Agent: `● Agent(desc)` bold in the default colour, `⎿ Backgrounded agent (↓ to manage · ctrl+o to expand)`, `● Agent "desc" finished · Ns`, `✻ Waiting for N background agent(s) to finish`, and the agents list under the footer (`● main`, `◯ type  desc  Ns`, ↓ selection with `↑/↓ to select` on main — 2.1.281 dropped the ` · Enter to view` that 2.1.280 showed there, measured by replaying last night's clean session into both — `x` to stop or clear, `/tasks to see subagents`).
- Web Search and Fetch rows.
- Interrupt: `⎿ Interrupted · What should Claude do instead?`, no done line.
- API error `● API Error: …` in `ffcc00`, wrapped 8 columns short; automatic retry `✻ API error · Retrying in Ns · attempt n/max`, whose label becomes the error message from attempt min(3, max).
- Spinner: Claude's verbs, frames, shimmer, flash, stall and thinking colours, `(Ns · ↓ N tokens · thinking / thought for Ns)` with its 2 s windows; the done line `✻ Verb for Ns · done 4:39 PM`, with `Friday 6:52 PM` or `Tuesday, Sep 15, 7:48 PM` for older turns.
- Effort: Claude posts `● high · /effort` as a 10 s notice when the effort or the model changes, never at startup (real Claude on Sonnet 5 "with high effort" showed none at 2 s and 13 s); pi shows it the same way in the row under the spinner.
- Prompt box: flat rules, `❯` + no-break space on the input row, `99ccff` on a typed `/<known command>`, the slash menu above the box (Claude's Fuse.js 7.0.0 matcher and ranking, 32-column names, two-line descriptions), `No commands match "/x"` when nothing matches.
- Mode row for every mode and both starts (bypass → auto → manual → accept edits → plan; auto only for a model that has it).
- Footer: `[PONYTAIL] · model · ctx N%` in the status-line colours, `ctx` only after the first response and computed Claude's way (`round((input + cache_creation + cache_read) / window × 100)`); hidden while a dialog is open.
- `/new` and `/clear` (the command stays as a prompt row); plan mode end to end; the permission prompt; the ask-user-question dialog (tabs, multiSelect, review step, Chat about this, decline summary, `ctrl+g to edit in <editor>`), both drawn right under the transcript.
- A question call the schema rejects draws Claude's `  ⎿  Invalid tool parameters` (`ff6666`, bundle `wp`) right under the row above, not the decline rows (`replays/question-invalid.jsonl`).
- Question auto-continue (bundle `Gue`/`cme`/`Hh`, measured with `CLAUDE_AFK_TIMEOUT_MS=12000 CLAUDE_AFK_COUNTDOWN_MS=8000`, scenario `question-afk`): pi reads `askUserQuestionTimeout` from `~/.claude/settings.json` (`60s`/`5m`/`10m`; `never` or unset is off) and Claude's two env knobs. While it is on, the dialog ends in one extra row; in the last 20 s it holds `auto-continue in Ns · any key to stay` right-aligned in `999999`; a key restarts the idle time; a focused terminal holds the clock at zero (pi turns on focus reporting `?1004` at the first agent turn, since a question only comes inside one; turned on during pi's startup render it doubled the header in 1 of 18 replays, 0 of 18 with it off; an unknown focus lets the clock run, same as Claude). On timeout the model gets Claude's own text (`No response after 60s — the user may be away from keyboard…` + `Before going idle the user had selected: …`) and the transcript shows `● Claude asked:`, the picks (or each question with its options) under the elbow, and `● No response after 60s — continued with the answers selected so far` / `continued without an answer`.
- No flicker: `PI_TUI_DEBUG_REDRAW=1` logs no redraw for lines above the viewport (only the first render, at 40 and 20 rows).

**Not matched: pi cannot produce** (the diff script names each one when it applies)

- Status-line meters: Claude's subscription meters (`Fable ██ 68% ↻ 2d23h`) have no pi source; pi shows its provider balances in that slot (Cuong's choice).
- `· ← N agents` on the mode row counts other Claude Code sessions on the machine; pi has no such registry.
- Retry cap: Claude retries 10 times, pi `retry.maxRetries` times (3 in Cuong's settings since the first commit); the row prints whatever cap is configured.
- Spinner tips (`⎿ Tip: …`): picked at turn end from a catalogue of Claude-feature advice with per-user cooldowns (`MDr`/`DDr`/`pickDue`); nothing true to show in pi.
- `(ctrl+b to run in background)` under a running bash: pi cannot move a running tool to the background.
- The agents list's Enter swaps Claude's whole transcript to the agent (pi opens its overlay); no `ctrl+x ctrl+k` chord (pi has no key chords); nested agents are not drawn as a tree.
- Plan mode swaps Claude's Haiku to Sonnet; pi's model routing is Cuong's and stays.
- Header rows (logo, version, account line) and SessionStart hook lines belong to each harness; the diff does not compare the rows above the first prompt.
- Harness artefacts, not rendering: the out-of-scope-model warning (the harness pins Haiku, outside Cuong's `enabledModels`); Claude's `Plugin updated: <name> · Run /reload-plugins to apply` toast (its marketplace auto-update, which pi has no counterpart for); the slash menu's other entries (Claude's `/code-review`, `/doctor` vs Cuong's skills); each harness's plan folder; the subagent token column (the mock answers Claude's subagent once, at the end); the mid-turn spinner status (elapsed, tokens and the 2 s thinking windows are timers, and the mock paces Claude from pi's timestamps, so snapshots compare the spinner row up to the verb; the status rules are pinned to Claude's constants in claude-working's self-test).

**Suite state (2026-09-24, Claude Code 2.1.281)**

- Two consecutive full runs clean: 33/33 and 33/33 (runs D and E, 24 live scenarios + 9 replays). What stood between the 2026-09-23 runs and that, each read out of the captures: `plan` was pi's edit refusing an empty `oldText` (now Claude's Create) and later a reused stale plan file (now a fresh slug); `question`, `question-multi`, `agent` and `question-afk` had snapshots taken while the model was still replying or the turn was settling, so those mid-turn snapshots are gone (the final screen still compares every row they held); `question-multi` fell off script when Haiku left out the descriptions Claude's schema requires too, so the prompt pins empty ones and the rejection has its own replay; `slow-search` snapped inside the 3 s thought hold, so its grep now runs past it and the snapshot waits for the pattern hint; `agent` also changed with the 2.1.281 update (main-row hint) and its agent now sleeps 20 s so the key presses cannot land after it finishes.

**Outside the measured set** (behaviour notes, each with its reason)

- `auto` is enforced by this harness, not by the permission extension, which exposes no runtime API for a narrower auto-approve; if your own permission policy also asks for bash, you see two prompts. It judges a command by an allowlist that looks through `rtk`, `rtk proxy`, `command`, `time` and `nice`, so an unusual but harmless command still asks.
- Yolo takes effect from your next message, because the permission extension re-reads its config at the start of each turn.
- "Yes, and always allow access to …" allows the one call, same as "Yes": persisting a rule means writing the permission config, which this work leaves alone. "Tab to amend" refills the editor for a bash command only.
- Rewind (esc esc restoring files) does not exist; `/tree` and `/fork` restore the conversation only.
- Auto-continue with a typed but unsent "Type something." answer: Claude's result builder (`U2`) passes that text to the model as notes (`"Q"=(no option selected) notes: …`); pi's auto-continue sends only the picks. Read from the bundle, not measured on screen, not ported.
- Not measured, so left as pi-subagents or this harness draws them: the `SubagentWorkflow` row and viewer, the ctrl+o view of a bash call, a plan taller than the approval modal, shift+tab's "approve with this feedback" text, `/plan <description>`.
- Scrollback is left alone for same-height repaints (see patches/README.md): a blinking dot or a ticking timer above the viewport no longer clears screen and scrollback; a change that moves lines above the viewport still redraws once.

## Testing

`py -3.12 scripts/selfchecks.py` runs every self-check: each `*_SELFTEST` block in `extensions/*/*.ts` (renderers and mode logic are pure functions), each `extensions/*/selftest.ts`, each `patches/*.selftest.ts`, and `node patches/pi-coding-agent.patch.mjs --check`. It loads files through `scripts/pi-resolve.mjs`, which resolves `@earendil-works/*` to pi's own install and aliases `@sinclair/typebox` to `typebox`, so extension code runs outside pi. A single file: `CLAUDE_ROWS_SELFTEST=1 node --import ./scripts/pi-resolve.mjs extensions/claude-tools/rows.ts`.

Anything that only appears in a real terminal is checked by driving it in a pseudo-terminal with `pywinpty` and reading the screen back with `pyte`, which reports every run of characters with its colour, bold, italic and dim (SGR 2 is rewritten to strikethrough before pyte sees it, since pyte drops dim). `scripts/pty-capture.py` does that for one program; `--steps` takes a JSON list of `{"until": regex}`, `{"sleep": s}`, `{"keys": text}` and `{"snap": name}`.

`scripts/parity/` compares pi with the installed Claude Code (2.1.281) side by side:

- `run.py --scenario <name>` plays `scenarios/<name>.json` live in pi (Copilot Haiku 4.5 unless the scenario names another model; Sonnet runs use Claude's `sonnet[1m]`, because Copilot's Sonnet has a 1M window) from a fresh copy of the fixture folder, then replays pi's exact replies to Claude Code through `mock.py`, a local Anthropic Messages endpoint (`ANTHROPIC_BASE_URL`), paced from pi's timestamps. Tools are mapped to Claude's (read→Read, grep→Grep, bash→Bash, the MCP server, web search, AskUserQuestion, ExitPlanMode…), and a retried error is served once as a 529. `--replay <session.jsonl>` skips the model: pi re-renders a saved session. Claude runs with `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT=1` (its effort check otherwise fails for a non-first-party base URL), and a scenario without bypass starts Claude with `--allow-dangerously-skip-permissions`, because bypass is always in pi's cycle.
- `diff.py --out <dir>` compares the final screen and every snapshot, transcript and prompt/footer separately, text and colour, and writes `report.md` (exit 0 when clean). It normalises only volatile values: the spinner verb and glyph animation, the spinner status in mid-turn snapshots, durations, token counts and the clock. Accepted exceptions are named rules and listed at the end of every report (see Not matched above).
- `suite.py` runs every live scenario and replay, three at a time, and exits 0 only when all are clean. Two consecutive clean runs is the bar. Scenario snapshots wait for a visible state (`until`), not a time, because the two sides reach a moment at different speeds.
- `session.py` turns a small JSON spec (`specs/`) into a replayable pi session (`replays/`). The done-line date forms need a transcript from other days, so they are checked by resuming a copy of `replays/olddays.jsonl` in both harnesses (`claude --resume` on a copied transcript) rather than in the suite.

Traps worth knowing:

- Session paths must be absolute: pi starts in the home folder, and a relative path silently starts an empty session.
- Point `CLAUDE_MODES_PERMISSION_CONFIG` at a throwaway file, or the mode cycle rewrites your real permission config (run.py does).
- ConPTY asks for device attributes (`ESC[c`) and stalls until answered; the capture answers.
- pyte prints the final `u` of Claude's kitty keyboard-protocol sequences (`CSI > 1 u`, `CSI < u`) as text; the capture strips them.
- Launch `dist/bundle/cli.js` (what the `pi` shim runs); `dist/cli.js` is unbundled and never sees the pi-coding-agent patch.
- Line endings: the repo has `core.autocrlf=true`, and Python on Windows writes CRLF unless told to write LF (`newline` set to a bare LF). A CRLF pi bundle breaks its template literals and every patch anchor, and a CRLF package file makes its patch report `NEEDS PORT`. Keep the bundles and patched package files LF.
- Never write debug code into an installed pi bundle; every running pi loads it. Change it only through the patch script.
- Claude's own PreToolUse hooks (Cuong's settings) delay its tool starts; snapshots that show a bash's `(Ns)` wait for it on both sides. `disableAllHooks` is no way out: it also removes the custom status line.

## Cloud sessions

Claude Code cloud sessions (`claude --cloud`, or claude.ai/code on `cuong21951/pi-agent-config`) run on a fresh Ubuntu VM that clones this repo. Set the environment's setup script to `bash scripts/cloud-setup.sh`: it moves Node to 24 when the VM has less (the `.ts` self-checks run through Node's type stripping), installs pi 0.85.1 globally and the patched packages at the versions the patches were made against into `npm/`, then runs `patches/apply.mjs`. `scripts/pi-installs.mjs` finds pi there (`/usr/local/lib/node_modules`, else `npm root -g`, or `PI_CODING_AGENT_DIR`), the same finder the Windows side uses for Volta and the npm prefix. The default Trusted network covers npm and GitHub; if the Node download is blocked, add `nodejs.org` to a Custom allowlist.

What a cloud session can do: read Claude Code's bundle (grep the binary of the version Cuong runs, see `claude --version` on his machine), change extensions and patches, regenerate patch diffs, run `python3 scripts/selfchecks.py`, and push a `claude/*` branch. What it cannot: `scripts/pty-capture.py`, `run.py` and `suite.py` drive a Windows pseudo-console through pywinpty, compare Windows rendering (backslash paths, ConPTY), and need pi's GitHub Copilot login for the live side, so the suite stays on the Windows machine: fetch the branch, `node patches/apply.mjs`, `py -3.12 scripts/selfchecks.py`, then `py -3.12 scripts/parity/suite.py` twice. The suite spends no Claude usage (Claude answers from `mock.py`, pi uses Copilot Haiku).

## Updating pi without losing the patches

`pi update` (pi itself or `--extensions`) reinstalls the packages clean, and every patch in `patches/` is gone with them: tool rows fall back to raw `server_tool {json} → {` rows, hidden thinking blocks leave three blank lines, subagents get their padded boxes back. `patches/apply.mjs` puts them back: a diff that is already applied is skipped, one that still applies is applied, and one whose package moved under it is reported as `NEEDS PORT` (exit 1) instead of half-applied; then the self-checks run.

The PowerShell wrapper below runs `node patches/apply.mjs --if-changed` before every launch. It compares the patched packages' `package.json` files and the patch files against `patches/.applied-stamp` and returns in about 250 ms when nothing changed, so a plain `pi update --extensions` followed by `pi` re-patches on its own. `pi update …` through the wrapper also runs the full apply right after the update and prints the result. When a line says `NEEDS PORT`, port that patch the way `patches/README.md` describes (keep a pristine copy, edit in place, regenerate the diff).

## Restore on a new machine

```powershell
npm install -g @earendil-works/pi-coding-agent
pi install git:github.com/cuong21951/pi-agent-config
```

The root `package.json` declares the pi manifest (Kuha skills and prompts, the UI extensions) and two pinned libraries the extensions import, `highlight.js` 11.12.0 and `fuse.js` 7.0.0; run `npm install` in the repo root once after cloning. For the full personal setup, clone this repo into `~/.pi/agent`, restore `auth.json` and `mcp.json` by hand, then run `pi install` once so the npm packages listed in `settings.json` are fetched.

## Not in git

`auth.json`, `mcp.json`, `sessions/`, `plans/` (plan-mode plan files), model and MCP caches, `npm/node_modules`, cloned git packages, `*.bak`.

## Running pi inside herdr

herdr on native Windows never forwards mouse events to a mouse-reporting pane ([herdr #1528](https://github.com/herdrdev/herdr/issues/1528), closed as not planned), so the wheel arrives as Up/Down keys, the same bytes as the arrow keys. The `herdr-wheel` extension used to turn those into transcript scrolling, which also swallowed Up/Down in the input box, so prompt history could not be recalled with the arrows the way Claude Code does. It was removed on 2026-09-03: Up on the first line recalls the previous prompt (pi's default `tui.editor.cursorUp`), so `tuiMode` stays `regular`: outside the alt screen herdr owns the scrollback and the wheel moves the pane scrollbar exactly like Claude Code; in `fullscreen` the wheel only recalls history. `ctrl+p`/`ctrl+n` stay bound to history as well. The `TMUX=1` wrapper below only makes pi ask for button-motion mouse mode (cheaper for the multiplexer). The wrapper also clears the screen and scrollback before launching, as Claude Code does at startup: in regular mode nothing else does, so each relaunch would stack the previous header, prompt and footer in the pane. PowerShell profile:
```powershell
function pi {
    $real = Get-Command pi -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $real) { Write-Error "pi not found on PATH"; return }
    $patches = Join-Path $HOME '.pi\agent\patches\apply.mjs'
    if ($args.Count -gt 0 -and $args[0] -eq 'update') {
        & $real.Source @args
        & node $patches
        return
    }
    if (-not [Console]::IsOutputRedirected) { [Console]::Write("$([char]27)[2J$([char]27)[3J$([char]27)[H") }
    & node $patches --if-changed
    $env:PI_SKIP_VERSION_CHECK = '1'
    if ($env:HERDR_ENV -eq '1' -and -not $env:TMUX) {
        $env:TMUX = '1'
        try { & $real.Source @args } finally { Remove-Item Env:TMUX -ErrorAction SilentlyContinue }
    } else { & $real.Source @args }
}
```
