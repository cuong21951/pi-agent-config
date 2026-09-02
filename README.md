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
| `settings.json` | Model, packages, skills, prompts, fullscreen TUI, theme. Paths are absolute to this machine. |
| `mcp.example.json` | MCP servers with direct tools. Copy to `mcp.json` and fill in the Azure DevOps PAT; `mcp.json` is gitignored. |
| `extensions/` | claude-memory (shared memory index + `remember` tool), claude-working (Claude-style sparkle spinner, shimmering verb, elapsed/tokens line), claude-tools (read/write/edit/grep/find/ls rendered as `● Read(path)` / `⎿ Read N lines`, `● Update(path)` + diff, `● Search(pattern: …)`), claude-messages (`● ` before assistant text, `✻ Thinking…` label), intent-tools (labelled compact bash rows), claude-header, cheap-models, claude-mcp-render, rtk-bash, deepseek-guards, no-code-comments. |
| `keybindings.json` | `ctrl+p`/`ctrl+n` browse prompt history (Up/Down on an empty prompt scroll the transcript instead, see herdr-wheel). |
| `agents/`, `prompts/` | scout / planner / worker / reviewer for `@tintinweb/pi-subagents`, and the `/implement`, `/implement-and-review`, `/scout-and-plan` chains. |
| `themes/claude-dark.json` | Dark theme with daltonized diff colours and Claude orange accents. |
| `skills/` | Local skills (browser-tools patched for Windows, film-download, research helpers). |
| `kuha/` | The Kuha pack: 9 skills, 6 slash prompts, Vietnamese AGENTS.md, README and installer. See `kuha/README.md`. |

## Restore on a new machine

```powershell
npm install -g @earendil-works/pi-coding-agent
pi install git:github.com/cuong21951/pi-agent-config
```

The root `package.json` declares the pi manifest (Kuha skills and prompts, the two UI extensions). For the full personal setup, clone this repo into `~/.pi/agent`, restore `auth.json` and `mcp.json` by hand, then run `pi install` once so the npm packages listed in `settings.json` are fetched.

## Not in git

`auth.json`, `mcp.json`, `sessions/`, model and MCP caches, `npm/node_modules`, cloned git packages, `*.bak`.

## Running pi inside herdr

herdr on native Windows never forwards mouse events to a mouse-reporting pane ([herdr #1528](https://github.com/herdrdev/herdr/issues/1528), closed as not planned), so the wheel always arrives as Up/Down keys, whatever mouse mode pi requests. The `herdr-wheel` extension swaps in a `CustomEditor` subclass: with an empty prompt and no autocomplete open, Up/Down scroll the transcript; with text, or inside selectors, autocomplete and workflow pickers, the keys behave as stock (a global `up`/`down` keybinding would steal them from those lists). Prompt history moves to `ctrl+p`/`ctrl+n`. The `TMUX=1` wrapper below is kept so pi asks for button-motion mode only (cheaper for the multiplexer), but it does not fix the wheel on its own. PowerShell profile:

```powershell
function pi {
    $real = Get-Command pi -CommandType Application | Select-Object -First 1
    if ($env:HERDR_ENV -eq '1' -and -not $env:TMUX) { $env:TMUX = '1'; try { & $real.Source @args } finally { Remove-Item Env:TMUX -ErrorAction SilentlyContinue } }
    else { & $real.Source @args }
}
```
