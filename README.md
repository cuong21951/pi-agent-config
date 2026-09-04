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
| `keybindings.json` | `ctrl+p`/`ctrl+n` also browse prompt history; Up/Down do it at the edges of the prompt like Claude Code. `ctrl+alt+v` is pi's own image paste so `alt+v` is free for claude-images. `ctrl+shift+t` is pi's thinking toggle so a Claude-trained `ctrl+t` cannot flip it by accident; `ctrl+alt+s` saves the model picker default so `ctrl+s` is free for claude-keys. |
| `agents/`, `prompts/` | scout / planner / worker / reviewer for `@tintinweb/pi-subagents`, and the `/implement`, `/implement-and-review`, `/scout-and-plan` chains. |
| `themes/claude-dark.json` | Dark theme with daltonized diff colours and Claude orange accents. |
| `skills/` | Local skills (browser-tools patched for Windows, film-download, research helpers). |
| `kuha/` | The Kuha pack: 9 skills, 6 slash prompts, Vietnamese AGENTS.md, README and installer. See `kuha/README.md`. |

## Claude parity

What the harness matches today, and what it does not, so the next pass starts from a ledger instead of a guess.

**Matched**

- Colours measured on screen, not guessed: Claude Code 2.1.260 in `dark-daltonized` was driven in a pseudo-terminal and every run of characters read back with its colour. Tool dot `5fafff`, grey `949494`, separators `585858`, model `87afd7`, green `87af87`, spinner `ffaf5f` with `ffd787` shimmer, diff backgrounds `5f0000` / `00005f`, user message `3a3a3a`. The theme carries these values.
- Tool rows behave like Claude's. A running tool is a blinking grey dot plus "Reading a.txt" or the bash description, with `⎿ $ cmd` under it. A finished read-only tool (read, search, list, bash) collapses to one grey line: `Read a.txt`, `Ran Check git status`; ctrl+o brings the elbow and the output back, and a failed command keeps its red row. Write and Update keep the blue dot, a grey `⎿`, bold counts, and show the written lines or the diff with line numbers and Claude's backgrounds. Claude merges consecutive read-only tools into "Read 1 file, ran 2 shell commands"; pi keeps one block per tool, so it is one grey line per tool.
- A turn ends with Claude's grey `✻ Churned for 13s · done 12:58 AM`, the spinner verb in the past tense.
- No coloured block behind a tool row, because Claude never draws one.
- Modes on `shift+tab`, with the plan-mode offer when you ask for a plan, and the "Plan ready. Proceed?" question (accept edits / bypass / keep planning) when a plan-mode turn ends. Accepting continues the same conversation.
- Footer rows: line one is `[PONYTAIL] · model · think · ctx · $cost · branch · statuses`, line two is Claude's mode row (`⏵⏵ accept edits on`, `⏸ plan mode on`, `⏵⏵ bypass permissions on`) with `? for shortcuts` on the right. Overflow drops the trailing statuses first, so ctx and cost survive at 120 columns.
- Prompt: `❯ `, `● high · /effort` right-aligned above it, `?` card on an empty prompt. Claude's placeholder tip was dropped on request.
- Keys: double-tap esc clears the prompt, ctrl+s stashes it, ctrl+shift+t is the thinking toggle. `\` + enter for a newline is not possible (pi has no key chords), use shift+enter.
- Startup: the `pi` wrapper sets `PI_SKIP_VERSION_CHECK=1`, so the update box is gone. The ponytail and MCP notices are printed by their packages and stay.
- Done notification via `pi-notify`, herdr pane state via `herdr-state`.
- Subagent progress: the live widget (spinner per agent, tick or cross when it lands) and the fleet list are both on.

**Not matched yet**

- Markdown inside messages. Link, inline-code and heading colours are still pi's own; Claude's were never measured, so they were left alone rather than guessed.
- `auto` is enforced by this harness, not by the permission extension, which exposes no runtime API for a narrower auto-approve. If your own permission policy also asks for bash, you will see two prompts.
- Yolo takes effect from your next message, not mid-turn, because the permission extension re-reads its config at the start of each turn.
- Only the bypass colour of the mode row was measured (256-colour 210). Plan and accept edits use the nearest theme roles.
- Rewind (esc esc restoring files) does not exist; `/tree` and `/fork` restore the conversation only.
- `auto` judges a bash command by an allowlist that looks through `rtk`, `rtk proxy`, `command`, `time` and `nice`. Anything outside the allowlist raises a confirm, so an unusual but harmless command will still ask.
- Assistant body text is the terminal's default foreground, not `#ffffff`. pi's markdown renderer paints headings, links and code from the theme but leaves paragraph text uncoloured, and the theme has no key for it, so matching Claude's pure white would take a patch to pi itself.
- The header cat keeps its own orange (`d97757`); Claude's logo is `d78787`. The `warning` role was deliberately left on the cat's colour.
- Hidden thinking blocks between tool calls leave pi's own blank lines (up to three); the tool rows themselves add none.

## Testing

Renderers and mode logic are pure functions with their own self-checks, so `node scripts/selftest.mjs` covers them without a model.

Anything that only appears in a real terminal is tested by driving pi inside a pseudo-terminal with `pywinpty` and reading the screen back with `pyte`, which reports each run of characters with its colour. Two ways to use it:

- Replay a saved session with `--session <absolute path>` and no model at all. This is how row colours, diff colours, the error row and the thinking placeholder are checked. Session files are trees, so chain each `toolResult` to the previous one; two results sharing a parent are sibling branches and only one renders.
- Drive a live session by sending keystrokes, for what needs a model to call a tool: plan mode refusing a write, auto mode confirming a command, the plan-mode offer.

Two traps worth knowing. Session paths must be absolute, because pi is spawned with the home folder as its working directory and a relative path silently starts an empty session. And point `CLAUDE_MODES_PERMISSION_CONFIG` at a throwaway file, or the mode cycle will rewrite your real permission config.

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
    $real = Get-Command pi -CommandType Application | Select-Object -First 1
    if (-not [Console]::IsOutputRedirected) { [Console]::Write("$([char]27)[2J$([char]27)[3J$([char]27)[H") }
    if ($env:HERDR_ENV -eq '1' -and -not $env:TMUX) { $env:TMUX = '1'; try { & $real.Source @args } finally { Remove-Item Env:TMUX -ErrorAction SilentlyContinue } }
    else { & $real.Source @args }
}
```
