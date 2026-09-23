# patches

Packages that draw their own tool rows have no render hook, so their renderers are patched in place to the Claude Code 2.1.261 look (every row below was measured live with a pywinpty capture of the dark-daltonized theme).

pi-mcp-adapter: a running call is a blinking grey dot + `Calling server…`, a finished call is one grey `Called server` line; consecutive calls to one server merge into Claude's `Called server 3 times` (and join a read-only group: `Read 1 file, called dse 2 times`) through claude-tools' shared grouping on `globalThis.__claudeRows`, earlier rows drawing nothing; ctrl+o expands to `● server - tool (MCP)(args)` + the result rows. An error keeps its row: `● server - tool (MCP)(args)` + red `  ⎿  Error: …` (Claude's error look is unmeasured). The call block never prints in compact mode, so the JSON args dump that used to appear on errors is gone. 2.33.0 added `mcpScript` without a `renderShell`, so pi boxed every call in three rows of `0c0c0c` padding; the patch gives it the same shell as the other MCP tools. A call with no server (`mcpScript`, `mcp` search) joins the group as Claude's catch-all `called N tools` instead of printing its own title row. A failed call inside a group folds into the sentence too (Claude 2.1.280, measured); the error row only shows outside a group or on ctrl+o. A result without `details` (a running `mcpScript`) used to throw inside render and take pi down with an uncaughtException; the compact renderer now reads `details` optionally.

pi-deepseek-search owns the `web_search` tool and renders `web_search "query"` plus a 6-line dump of the answer, inside pi's default tool box. Patched to the Claude Code look (`● Web Search("query")` + `  └ Did 1 search in 12s (3 sources)`), with `renderShell: "self"` to drop the box and `durationMs` in the result details.

pi-web-access owns `fetch_content` and rendered `fetch <url>` / `mode: raw` / a green title with `(962 chars)` and a 200-char preview. Patched to Claude's `● Fetch(url)` (grey dot blinking while it runs, blue once done) + `  ⎿  Fetching…` / `  ⎿  Received 559 chars` (Claude says `559 bytes (200 OK)`; the package has no HTTP status), red `  ⎿  Error: …` on failure, ctrl+o shows the first 20 lines. The finished set is claude-tools' (`globalThis.__claudeRows`).

rpiv-ask-user-question dumped its tool result (`User has answered your questions: "Q"="A" …`) in pi's default box. Patched to Claude's `● User answered Claude's questions:` + one grey `  ⎿  · question → answer` row per answer (`● User declined to answer questions` when cancelled), nothing drawn while the questionnaire overlay is open. Regenerated against 2.10.0 (2026-09-23); the 2.x import block moved, the hunks did not change.

pi-coding-agent itself (minified bundle, so a script instead of a diff, applied to every installed copy: Roaming npm and Volta): a hidden thinking block draws nothing, so tool rows sit one blank line apart instead of three; an interrupted reply ends with grey `  ⎿  Interrupted · What should Claude do instead?` instead of red `Operation aborted`. The tool-side half of the interrupt (an aborted tool result) is handled by claude-tools / intent-tools, and claude-working prints no `✻ … · done` line after an interrupt. `PI_SKIP_VERSION_CHECK` (the `pi` wrapper sets it) also skips the "Package Updates Available" box, which pi gates on `PI_OFFLINE` only; that box is also the one that talks you into `pi update --extensions`, which wipes every patch here. A status notice (`MCP: 1 servers connected`, `Model: x`) draws as Claude's grey `● notice` at column 0 instead of a dim line one column in. pi 0.85.1 renamed `message2` to `message` in the stop-reason branch; the script was ported on 2026-09-23 and asserts every anchor, so the next rename fails loudly again.

pi-subagents loads `src/index.ts` (its `pi.extensions` entry), not `dist/`, so the patch is on the source. The Agent tool drew `▸ Agent  desc` inside pi's default box, which put two or three blank padding rows between consecutive agents, and a backgrounded one said `⎿  Running in background (ID: …)`. Patched to Claude Code 2.1.280 (measured): `● Agent(desc)` with the blue tool dot and no box, `  ⎿  Backgrounded agent (↓ to manage · ctrl+o to expand)` (↓ at an empty prompt really does open pi-subagents' fleet list), and the finished-agent notification collapsed to `● Agent "desc" finished · 50s` (ctrl+o keeps the stats and preview; a failed agent keeps its old block, Claude's is unmeasured). SubagentWorkflow gets `renderShell: "self"` for the same padding reason. `get_subagent_result` has no renderer of its own; claude-tools' fallback now takes over any tool whose definition has no renderCall/renderResult (pi 0.85.1 counts a bare definition as "has renderer"), so it folds into the group instead of dumping the agent's whole report.

The `pi` PowerShell wrapper runs `node patches/apply.mjs --if-changed` before every launch and the full `node patches/apply.mjs` after `pi update …`, which does all of the below (skip what is applied, apply what still fits, report `NEEDS PORT` for what does not, run the self-checks). By hand:

Apply (after `pi install` / `pi update`):

    git -c core.autocrlf=false apply --directory=npm/node_modules/pi-mcp-adapter patches/pi-mcp-adapter.patch
    git -c core.autocrlf=false apply --directory=npm/node_modules/pi-deepseek-search patches/pi-deepseek-search.patch
    git -c core.autocrlf=false apply --directory=npm/node_modules/pi-web-access patches/pi-web-access.patch
    git -c core.autocrlf=false apply --directory=npm/node_modules/@juicesharp/rpiv-ask-user-question patches/rpiv-ask-user-question.patch
    git -c core.autocrlf=false apply --directory=npm/node_modules/@tintinweb/pi-subagents patches/pi-subagents.patch
    node patches/pi-coding-agent.patch.mjs

Verify:

    node patches/pi-mcp-adapter.selftest.ts
    node patches/pi-deepseek-search.selftest.ts
    node patches/pi-web-access.selftest.ts
    node patches/rpiv-ask-user-question.selftest.ts
    node patches/pi-coding-agent.patch.mjs --check

Regenerate a diff patch after editing a package in place: keep a pristine copy of the file (reverse-apply the old patch onto a copy), then `diff -u --label a/<file> --label b/<file> pristine live > patches/<pkg>.patch` (git diff --no-index quotes Windows paths and drops the second file). The pi-coding-agent script asserts each edit matches exactly once, so a pi update that changes the surrounding code fails loudly instead of half-applying.

Note: pi-web-access also registers a `web_search` tool (rendered as `search "query"`). It loses the name to pi-deepseek-search, which registers on `session_start`, after every extension has loaded. Nothing renders that one, so it is left unpatched.
