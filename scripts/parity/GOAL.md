# Goal: pi looks and behaves exactly like Claude Code

Run this session with `C:\Users\cuong\.pi\agent` as the working directory, not `C:\TimeBlock`: the TimeBlock project hooks (push gate, ticket folders) do not belong here. Cuong has approved committing and pushing to `origin main` for this goal.

You are working in `C:\Users\cuong\.pi\agent` (git `github.com/cuong21951/pi-agent-config`, branch `main`). It is Cuong's pi harness: extensions, package patches and a theme whose only purpose is to make pi indistinguishable from Claude Code in the terminal. Every element matters — layout, columns, blank lines, glyphs, wording, colours, animation, timing lines, footer, prompt box, notices, errors. Do not stop at "close enough".

## Read first

1. `README.md` — the Claude parity ledger (Matched / Not matched yet), Testing, Updating pi.
2. `patches/README.md` — how package and pi-core patches are made, applied and checked.
3. `scripts/parity/` — `TASK.md` fixture scenario, `run.py`, `diff.py` (this file's tools).

## Tools

- `py -3.12 scripts/parity/run.py` runs the fixture scenario (`scripts/parity/fixture/TASK.md`) in Claude Code (`--model haiku`, bypass mode) and in pi (`github-copilot/claude-haiku-4.5`, bypass mode), each in the same freshly copied folder, 132x60, and saves both screens (text + every colour run) to `%TEMP%\pi-parity\out`.
- `py -3.12 scripts/parity/diff.py` normalises the volatile parts (spinner verb, durations, clock) and compares the transcript and the prompt/footer line by line and colour by colour. It writes `report.md` and exits 0 only when nothing differs.
- `py -3.12 scripts/pty-capture.py` is the underlying capture tool: `--session <abs path>` replays a pi session with no model, `--cmd "claude.exe --resume <id>"` replays a Claude transcript (always resume a COPY saved under a new session id and delete it afterwards), `--keys` types, `--until` waits for a regex, `--json` dumps colour runs.
- `PI_TUI_DEBUG_REDRAW=1` makes pi log every full-screen redraw to `~/.pi/agent/pi-tui-debug.log`.

## Success criteria (all of them)

1. `run.py` + `diff.py` exit 0 on two consecutive runs.
2. Coverage: every element below is exercised by `TASK.md` or by a replay fixture, measured on Claude Code first, and matches in pi: prompt band and wrapping; assistant text with heading, bold, inline code, bullet and numbered lists, table, fenced code block; hidden thinking; running tool row and its blink; grouped tool sentence; Read/Search/List/Bash (ok and failing); Update diff; Write preview; MCP call (ok and failing); Skill; background Agent row, its finished notice and the agents list under the footer; web search and fetch; interrupt (`⎿ Interrupted · What should Claude do instead?`); API error and automatic retry; spinner line and its status text; done line (including the weekday/date form of older turns); effort row; prompt box; mode row for every mode; footer/status line; `/new` vs `/clear`; plan mode; permission prompt; ask-user question.
3. No flicker: a live run with `PI_TUI_DEBUG_REDRAW=1` logs no `firstChanged < viewportTop` redraw.
4. Nothing regresses: `node patches/apply.mjs` reports no `NEEDS PORT`, and every extension self-check listed in README Testing passes.

A difference may be left only if pi cannot produce it at all (for example Claude's subscription usage meters in the status line). Every such exception goes in the README ledger with the measurement that proves it, never silently into the diff normaliser.

## Loop

1. Run `run.py` and `diff.py`; read `report.md`.
2. For each difference, find who draws the row: `extensions/*` for pi-side rendering, `npm/node_modules/<pkg>` for package tools (patched through `patches/<pkg>.patch`), pi core and pi-tui through the anchored edits in `patches/pi-coding-agent.patch.mjs`.
3. If you are not sure what Claude draws, measure it (capture Claude, never guess), then write down the rule.
4. Make the smallest change that matches, add or update the self-check next to it, re-run the self-checks.
5. For elements `TASK.md` cannot reach, extend `TASK.md` or build a replay fixture (a pi session jsonl plus a copied Claude transcript) and compare those captures the same way.
6. Repeat until the success criteria hold.

## Rules

- Measure Claude before changing pi. Record measurements in the README ledger, not in code comments: the TimeBlock `no-code-comments` hook blocks new comments (existing `ponytail:` comments may be corrected, not multiplied).
- Package patches: keep a pristine copy, edit in place, regenerate the diff with `diff -u --label a/<file> --label b/<file>`, check it with `git apply --check` in both directions, add it to `patches/apply.mjs`.
- Never run tests against Cuong's real pi or Claude sessions; work on copies and delete the test sessions you create.
- Keep test cost low (Haiku). Do not change model routing, auth, `mcp.json` or the permission config.
- Changes to pi only show after pi restarts; say so when you report.

## When the criteria hold

Update the README ledger (move items to Matched, list the justified exceptions), commit with a message that names what changed and how it was measured, `git push origin main`, then report to Cuong in Vietnamese in at most 8 lines: what now matches, what remains and why, the commit hashes.
