# Worker brief (agents share the sandbox worktree)

Read: `scripts/parity/MILESTONES.md`, `GOAL.md`, README § Claude parity + § Testing (incl. the sandbox Claude-config traps M3 added), `patches/README.md`, `findings/BACKLOG.md` (your rows' evidence), the discovery file for each row.

## Environment
- Every bash call starts with `source /c/Users/cuong/.pi/sandbox/env.sh >/dev/null`. cwd `C:\Users\cuong\.pi\sandbox\agent`, branch `parity-sandbox`.
- Never edit `C:\Users\cuong\.pi\agent`, the Volta install, `~/.claude/settings.json`, `~/.claude.json`, Cuong's untracked `agents/*.md`. Never touch processes you didn't start (running pi PIDs 55416, 55732). Pi-core patches go through `patches/pi-coding-agent.patch.mjs` applied to the SANDBOX install (`PI_INSTALL_DIR`), package patches through `patches/<pkg>.patch` + `apply.mjs` against the sandbox agent dir.
- Claude only via run.py/mock (CLAUDE_CONFIG_DIR is set by env.sh; never launch Claude without it; never open Claude's /config). No live Claude model calls. pi live runs on Copilot Haiku; budget 15 live turns.
- Shell: commands are rewritten through `rtk` (use `rtk proxy` if output looks filtered); write Python helpers to files; `py -3.12`; keep bundles/patched package files LF; no new code comments (a hook blocks them) — measurements go in the README ledger.

## Sharing the worktree with two other agents
- Touch only the files your rows own (listed in your prompt). If a row needs a file another agent owns, skip the row and say so.
- Commit with explicit paths (`git add <your files>`; never `git add -A`/`.`), retry if `index.lock` exists. README ledger edits: add your bullets in one small commit at the end, rebase-free (just edit and commit your hunk).
- Run only your own scenarios/replays and `selfchecks.py`; suite runs are the coordinator's. Use `--jobs 1` if you run several.

## Per row
1. Measure Claude (bundle + capture) and pi before changing anything; if the row turns out not real, mark it so and move on.
2. Smallest change that matches, in the owner file; self-check next to pure logic.
3. Lock it: new `scripts/parity/scenarios/<name>.json` or `specs/`+`replays/` case, clean in `diff.py`; add it to `suite.py` LIVE/REPLAYED.
4. `node patches/apply.mjs --check` no NEEDS PORT, `selfchecks.py` green.
5. Commit: message names what changed and how it was measured; end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. No push.

Stop rule: 3 hours wall clock, or a row that eats 45 minutes without a measured result → mark it `blocked: <reason>` and move on. Reply ≤12 lines: per row done/not-real/blocked with commit hash and the case that locks it.

## Safety overrides (learned in M4, binding)
- `patches/apply.mjs` has NO check mode: it applies. Never run it or `patches/pi-coding-agent.patch.mjs` unless `PI_INSTALL_DIR` is set in that same shell (env.sh sets it); since aecd875 the scripts then patch only the sandbox install. Print `piInstalls()` once before your first patch run to confirm.
- `selfchecks.py`: run as `LOCALAPPDATA=C:/nonexistent APPDATA=C:/nonexistent py -3.12 scripts/selfchecks.py`.
- Claude wording can differ per dialog/tool kind: measure the exact kind you change (M4 applied a network-dialog string to the bash dialog and the suite caught it).
- Never use `git revert`/`git checkout <rev> -- <file>` on shared files; edit your own hunks.
