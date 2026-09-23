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
| `extensions/` | claude-memory (shared memory index + `remember` tool), claude-working (Claude-style sparkle spinner, shimmering verb, elapsed/tokens line), claude-tools (read/write/edit/grep/find/ls rendered as `● Read(path)` / `⎿ Read N lines`, `● Update(path)` + diff, `● Search(pattern: …)`), claude-messages (`● ` before assistant text, `✻ Thinking…` label), intent-tools (labelled compact bash rows), claude-header, cheap-models, claude-mcp-render, rtk-bash, deepseek-guards, no-code-comments., claude-bottom-input (pads above the editor so prompt and footer sit on the bottom rows in regular mode), claude-skills (`skill` tool the model calls instead of reading SKILL.md with `read`, rendered as `● Skill(name)` / `⎿ Successfully loaded skill` like Claude Code; also repoints pi's built-in skill instruction at the tool), claude-modes (plan / accept edits / bypass on shift+tab, the plan-mode offer, the "Plan ready. Proceed?" question when a plan-mode turn ends), claude-effort (`● high · /effort` above the prompt and the `/effort` command), claude-help (`?` on an empty prompt shows the shortcut card), claude-keys (double-tap esc clears the prompt, ctrl+s stashes and restores it), herdr-state (reports session and working/idle state to herdr like the Claude Code hook) |
| `keybindings.json` | `ctrl+p`/`ctrl+n` also browse prompt history; Up/Down do it at the edges of the prompt like Claude Code. `ctrl+alt+v` is pi's own image paste so `alt+v` is free for claude-images. `ctrl+shift+t` is pi's thinking toggle so a Claude-trained `ctrl+t` cannot flip it by accident; `ctrl+alt+s` saves the model and thinking picker defaults so `ctrl+s` is free for claude-keys. |
| `agents/`, `prompts/` | scout / planner / worker / reviewer for `@tintinweb/pi-subagents`, and the `/implement`, `/implement-and-review`, `/scout-and-plan` chains. |
| `themes/claude-dark.json` | Dark theme with daltonized diff colours and Claude orange accents. |
| `skills/` | Local skills (browser-tools patched for Windows, film-download, research helpers). |
| `kuha/` | The Kuha pack: 9 skills, 6 slash prompts, Vietnamese AGENTS.md, README and installer. See `kuha/README.md`. |

## Claude parity

What the harness matches today, and what it does not, so the next pass starts from a ledger instead of a guess.

**Matched**

- Colours measured on screen, not guessed: Claude Code 2.1.280 in its `dark` theme was driven in a pseudo-terminal (a resumed transcript and a live haiku turn) and every run of characters read back with its colour. Tool dot `3399ff`, grey `999999`, subtle `505050`, prompt rules `888888`, user message `373737` with white text, warning `ffcc00`, error `ff6666`, logo `d77757`. The theme carries these values.
- Tool rows behave like Claude's. A running tool is a blinking grey dot plus "Reading a.txt" or the bash description, with `⎿ $ cmd` under it. Consecutive finished tools collapse into one grey line two columns in, with Claude's own wording and order, `  Searched for 1 pattern, read 2 files, listed 1 directory, called azure-devops 2 times, ran 1 shell command` (counts bold; an `ls` command counts as a listing; a tool nobody names, `mcpScript` and `mcp` included, counts as "called N tools"). A failed call folds in too: Claude 2.1.280 draws `ls` of a missing folder as `  Listed 1 directory` and a rejected `wit_work_item_write` inside `  Called azure-devops 4 times`, with no red row either time. Assistant text, a new prompt, a reply that ended in an error or a Write/Update starts a new group. Tool calls streamed into a reply that then failed never run, so they draw nothing. ctrl+o brings every tool's own line, elbow and output back, errors included. Write and Update keep the blue dot, a grey `⎿`, bold counts (`Added 2 lines` names only the non-zero counts), and show the written lines or the diff under the elbow's text: Write rows are the line number right-aligned to the file's line count at column 5, Update rows a space plus the number at column 5, then the sign. Numbers and signs are `dc5a5a` on removed rows, `51a0c8` on added rows, code `f8f8f2`; backgrounds `3d0100` / `001b29`; long lines wrap under the code; a Write preview ends with a bare `… +N lines`. `● Skill(name)` has the same blue dot and `  ⎿  Successfully loaded skill`. pi cannot merge blocks, so every member but the last draws nothing and the last draws the group line; the earlier blocks are repainted through the render context they hand us.
- Messages: the prompt is `❯ ` (subtle) in a two-column gutter on the `373737` band with no padding row above or below it, wrapped lines hanging two columns in. Every assistant text block starts with a white `●` in the same gutter and hangs its other lines two columns in; the body text is the terminal's default foreground, as in Claude. `claude-messages` does this by patching pi's exported `UserMessageComponent` / `AssistantMessageComponent`, so no markdown is rewritten.
- A turn ends with Claude's grey `✻ Churned for 13s · done 12:58 AM`, the spinner verb in the past tense.
- No coloured block behind a tool row, because Claude never draws one.
- Modes on `shift+tab`, with the plan-mode offer when you ask for a plan, and the "Plan ready. Proceed?" question (accept edits / bypass / keep planning) when a plan-mode turn ends. Accepting continues the same conversation.
- Footer rows, both two columns in like Claude's: line one is `model · think · ctx · $cost · branch · statuses`, line two is Claude's mode row (`⏵⏵ accept edits on`, `⏸ plan mode on`, `⏵⏵ bypass permissions on`) alone. Claude 2.1.280 draws no `? for shortcuts` next to a mode (measured in bypass and manual mode), so the right side is only used by the voice slot. Overflow drops the trailing statuses first, so ctx and cost survive at 120 columns.
- Prompt: `❯ `, `● high · /effort` right-aligned above it, `?` card on an empty prompt. Claude's placeholder tip was dropped on request.
- Keys: double-tap esc clears the prompt, ctrl+s stashes it, ctrl+shift+t is the thinking toggle. `\` + enter for a newline is not possible (pi has no key chords), use shift+enter.
- Startup: the `pi` wrapper sets `PI_SKIP_VERSION_CHECK=1`, and the pi-coding-agent patch makes that skip the "Package Updates Available" box as well as the version box. Status notices (`Ponytail loaded`, `MCP: 1 servers connected`, `Model: x`) draw as Claude draws a hook message: a grey `● notice` at column 0. The header cat is Claude's logo orange `d77757`.
- Done notification via `pi-notify`, herdr pane state via `herdr-state`.
- Subagent progress: the live widget (spinner per agent, tick or cross when it lands) and the fleet list are both on.

**Not matched yet**

- Markdown inside messages. Link, inline-code and heading colours are still pi's own; Claude's were never measured, so they were left alone rather than guessed.
- `auto` is enforced by this harness, not by the permission extension, which exposes no runtime API for a narrower auto-approve. If your own permission policy also asks for bash, you will see two prompts.
- Yolo takes effect from your next message, not mid-turn, because the permission extension re-reads its config at the start of each turn.
- Only the bypass colour of the mode row was measured (256-colour 210). Plan and accept edits use the nearest theme roles.
- Rewind (esc esc restoring files) does not exist; `/tree` and `/fork` restore the conversation only.
- `auto` judges a bash command by an allowlist that looks through `rtk`, `rtk proxy`, `command`, `time` and `nice`. Anything outside the allowlist raises a confirm, so an unusual but harmless command will still ask.
- The `● high · /effort` row above the prompt was measured on 2.1.260. Claude 2.1.280 showed none at idle in three captures (Fable at xhigh, Haiku, bypass and manual mode); the rule that shows it is unknown, so the row stays.
- API errors: a reply that pi retries by itself now leaves the transcript (A/B tested against a fake provider that answers 503 then succeeds), and the `✻ … · done` line waits for `agent_settled`. A final failure still prints pi's own red `Error: …` one column in; Claude's final-error look was not measured.
- Claude 2.1.280 writes the date into an old turn's done line (`done Friday 6:52 PM` five days back, `done Tuesday, Sep 15, 7:48 PM` eight days back); this harness prints the time only.
- The `SubagentWorkflow` row and its viewer (a centred overlay, 90% wide) are pi-subagents' own; Claude's Workflow rows were not measured. Agent rows are matched (see patches/README.md), and pi-subagents' `● Agents` widget above the prompt is off (`subagents.json` `widgetMode: "off"`): Claude shows running agents only in the list under the footer, which pi-subagents' fleet view already draws.
- Scrollback is left alone for same-height repaints (see patches/README.md): a blinking dot or a ticking timer that has scrolled above the viewport used to trigger a full clear-and-redraw of screen and scrollback on every tick (18 redraws in 10 s of typing in a measured replay, 0 after). A change that moves lines above the viewport (a row collapsing into its group after it scrolled away) still redraws once.
- The ctrl+o view of a bash call is this harness's `Ran <description>` + `⎿ ✗ exit 2` + output, not Claude's expanded row; not measured.

## Testing

Renderers and mode logic are pure functions with their own self-checks, run per file with its flag, e.g. `CLAUDE_ROWS_SELFTEST=1 node extensions/claude-tools/rows.ts` or `CLAUDE_MESSAGES_SELFTEST=1 node extensions/claude-messages/gutter.ts`. The patched packages have `node patches/<pkg>.selftest.ts` and `node patches/pi-coding-agent.patch.mjs --check`.

Anything that only appears in a real terminal is tested by driving pi inside a pseudo-terminal with `pywinpty` and reading the screen back with `pyte`, which reports each run of characters with its colour. `py -3.12 scripts/pty-capture.py --args "--session <abs path>" --out screen.txt` writes the screen text (scrollback included) and every coloured run; `--keys "[(10,'prompt'),(11,'\r')]"` types into a live session, `--cmd "claude.exe --resume <id>"` captures Claude Code itself for the reference (resume a copy of a transcript under a new session id; nothing is sent to a model). Two ways to use it:

- Replay a saved session with `--session <absolute path>` and no model at all. This is how row colours, diff colours, the error row and the thinking placeholder are checked. Session files are trees, so chain each `toolResult` to the previous one; two results sharing a parent are sibling branches and only one renders.
- Drive a live session by sending keystrokes, for what needs a model to call a tool: plan mode refusing a write, auto mode confirming a command, the plan-mode offer.

`scripts/parity/` turns that into a side-by-side check: `run.py` plays the fixture scenario in `scripts/parity/fixture/TASK.md` in Claude Code (Haiku, bypass) and in pi (Copilot Haiku 4.5, bypass) from the same freshly copied folder, `diff.py` normalises the spinner verb, durations and clock and reports every text and colour difference in the transcript and the footer (`report.md`, exit 0 when there are none). `scripts/parity/GOAL.md` is the brief for a fresh Claude session that loops on it until pi and Claude are identical.

Traps worth knowing. Session paths must be absolute, because pi is spawned with the home folder as its working directory and a relative path silently starts an empty session. Point `CLAUDE_MODES_PERMISSION_CONFIG` at a throwaway file, or the mode cycle will rewrite your real permission config (the script does). ConPTY asks the terminal for its device attributes (`ESC[c`) and stalls with a blank screen until something answers; the script answers. Launch `dist/bundle/cli.js`, which is what the `pi` shim runs: `dist/cli.js` is the unbundled build, so the pi-coding-agent patch never reaches it and the screen looks unpatched.

## Updating pi without losing the patches

`pi update` (pi itself or `--extensions`) reinstalls the packages clean, and every patch in `patches/` is gone with them: tool rows fall back to raw `server_tool {json} → {` rows, hidden thinking blocks leave three blank lines, subagents get their padded boxes back. `patches/apply.mjs` puts them back: a diff that is already applied is skipped, one that still applies is applied, and one whose package moved under it is reported as `NEEDS PORT` (exit 1) instead of half-applied; then the self-checks run.

The PowerShell wrapper below runs `node patches/apply.mjs --if-changed` before every launch. It compares the patched packages' `package.json` files and the patch files against `patches/.applied-stamp` and returns in about 250 ms when nothing changed, so a plain `pi update --extensions` followed by `pi` re-patches on its own. `pi update …` through the wrapper also runs the full apply right after the update and prints the result. When a line says `NEEDS PORT`, port that patch the way `patches/README.md` describes (keep a pristine copy, edit in place, regenerate the diff).

## Restore on a new machine

```powershell
npm install -g @earendil-works/pi-coding-agent
pi install git:github.com/cuong21951/pi-agent-config
```

The root `package.json` declares the pi manifest (Kuha skills and prompts, the two UI extensions). For the full personal setup, clone this repo into `~/.pi/agent`, restore `auth.json` and `mcp.json` by hand, then run `pi install` once so the npm packages listed in `settings.json` are fetched.

## Not in git

`auth.json`, `mcp.json`, `sessions/`, model and MCP caches, `npm/node_modules`, cloned git packages, `*.bak`.

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
