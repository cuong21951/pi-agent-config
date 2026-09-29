# Parity discovery brief (read-only fan-out)

Goal: find every visible/behavioural difference between pi (Cuong's harness at `C:\Users\cuong\.pi\agent`) and Claude Code 2.1.283 in YOUR assigned area. Discovery only — you fix nothing.

## Read first
- `C:\Users\cuong\.pi\agent\scripts\parity\GOAL.md`
- `C:\Users\cuong\.pi\agent\README.md` § Claude parity (already Matched / Not matched lists — do not re-report items listed there as Matched unless you measure they regressed) and § Testing (tools, traps).

## Hard rules
- Do NOT edit anything under `C:\Users\cuong\.pi\agent`, `C:\Users\cuong\.pi\sandbox`, the pi install under `%LOCALAPPDATA%\Volta`, or `~/.claude/settings*.json`. Do not run `pi update`, `npm install`, `patches/apply.mjs` without `--check`.
- Two pi sessions are running (node PIDs 55416, 55732). Never touch them, their session files, or any process you did not start. Never resume a real pi or Claude session; replay COPIES only (see README trap list), and delete Claude transcript copies / test sessions you create.
- Put every scratch file under `%TEMP%\pi-parity\discovery\<your-area>\`. Use ONLY your assigned port range for mock.py / run.py `--port`.
- A parity suite is running concurrently (ports 18700-18740): timing noise is possible; re-measure before calling a timing difference real.
- Keep cost low: pi `github-copilot/claude-haiku-4.5`, Claude `--model haiku`, or better no model at all (pi `--session` replay of a session built with `scripts/parity/session.py`, Claude via `run.py --replay` / mock.py). Budget: at most ~15 live model turns total.
- Shell: a hook rewrites commands through `rtk`; use `rtk proxy <cmd>` when output looks filtered; write Python helper scripts to files in your scratch dir (no inline heredocs with backslashes). Python is `py -3.12`.
- Measure, never guess: read Claude's bundle (`~/.local/share/claude/versions/2.1.283` is a Bun binary; grep it with Python mmap + regex, UI strings may be UTF-16) and capture both screens with `scripts/pty-capture.py` (`--cmd`, `--args`, `--keys`, `--steps`, `--until`, `--json` for colours). Launch Claude as the pinned binary `C:\Users\cuong\.local\share\claude\versions\2.1.283` (it may need copying to a `.exe` name in your scratch dir) in a fresh temp working folder.

## Output
Write `C:\Users\cuong\.pi\parity-findings\<your-area>.md` with one entry per difference:

```
### <short name>
- Claude (evidence): exact rows/colours/keys, capture file path or bundle symbol
- pi now (evidence): same
- Difference: ...
- Severity: high (seen every session) / medium / low (rare)
- Feasible in pi: yes / partial / no (why) ; likely owner: extensions/<x> | patches/<pkg> | pi core patch
- Test to lock it: scenario idea for scripts/parity/scenarios or a replay spec
```

Also list at the end: elements in your area you checked that ALREADY match (one line each, with evidence path), and anything you could not measure and why. Then reply with a 10-line summary: counts by severity and the top 5 differences.
