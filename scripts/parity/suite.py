import argparse, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
RUN = os.path.join(HERE, "run.py")
DIFF = os.path.join(HERE, "diff.py")
REPLAYS = os.path.join(HERE, "replays")

LIVE = ["task", "interrupt", "mcp", "skill", "question", "question-multi", "question-chat", "permission", "clear", "web", "agent", "modes", "modes-default", "retry-live", "plan",
        "spinner-states", "bash-no-thinking", "group-second-running", "parallel-calls", "slow-search", "stream-lines", "highlight", "slash-colour", "question-afk", "m4a-keys", "m4a-exit",
        "m4b-unknown-command", "m4b-typo-command", "slash-nearest", "slash-skill", "m4b-narrow-footer", "m4b-queued-message", "m2-permission-decline",
        "m4c-long-line", "m4d-bash-rows", "m5a-parallel-fail", "m4d-decline-edit", "m6c-resume-empty", "m6d-panels", "m6e-mcp-panel",
        "m6a-bg", "m6a-timeout", "m6a-ctrlb", "m6a-sendnow", "m6a-stop", "m6a-details", "m6f-view",
        "m6g-notify", "m6g-types", "m6g-sendrun", "m6g-resume", "m6g-stop", "m6g-cap", "m6g-fable", "m6g-fork", "m6g-nest", "m6g-nofork", "m6j-input-clear",
        "screen-newmsg", "screen-size-132x60", "screen-size-80x24", "screen-size-60x40", "screen-resize-tool"]
REPLAYED = {
    "thinking.jsonl": "Thinking sample.",
    "markdown.jsonl": "Show the markdown sample.",
    "markdown-langs.jsonl": "Show the markdown langs sample.",
    "markdown-tight.jsonl": "Show the markdown tight sample.",
    "error.jsonl": "Error sample.",
    "error-width.jsonl": "Error width sample.",
    "wrap.jsonl": "Wrap sample.",
    "shell-credit.jsonl": "Shell credit sample.",
    "edit-create.jsonl": "Edit create sample.",
    "question-invalid.jsonl": "Question invalid sample.",
    "m5b-context-low.jsonl": "keep going",
}
REPLAYED_SCENARIOS = {
    "m6b-todos": "m6b-todos.jsonl",
    "m6b-midturn": "m6b-midturn.jsonl",
    "screen-scroll": "markdown.jsonl",
    "screen-sticky": "markdown.jsonl",
    "thinking-md": "thinking-md.jsonl",
}

ap = argparse.ArgumentParser(description="Run every parity scenario (live pi on Copilot, Claude replaying it) and every replay fixture, diff each, exit 0 only when all are clean.")
ap.add_argument("--out", default=os.path.join(os.environ["TEMP"], "pi-parity", "suite"))
ap.add_argument("--only", nargs="*", default=None, help="subset of case names")
ap.add_argument("--jobs", type=int, default=3)
ap.add_argument("--port", type=int, default=18700)
a = ap.parse_args()


def cases():
    for name in LIVE:
        yield name, [] if name == "task" else ["--scenario", name]
    for file, prompt in REPLAYED.items():
        yield file.removesuffix(".jsonl") + "-replay", ["--replay", os.path.join(REPLAYS, file), "--prompt", prompt]
    for scenario, file in REPLAYED_SCENARIOS.items():
        yield scenario + "-replay", ["--replay", os.path.join(REPLAYS, file), "--scenario", scenario]


def run(index, name, args):
    out = os.path.join(a.out, name)
    captured = subprocess.run([sys.executable, RUN, "--out", out, "--port", str(a.port + index)] + args, capture_output=True, text=True, encoding="utf-8", errors="replace")
    with open(os.path.join(out, "run.log"), "w", encoding="utf-8") as f:
        f.write(captured.stdout + captured.stderr)
    result = subprocess.run([sys.executable, DIFF, "--out", out], capture_output=True, text=True)
    return name, result.returncode, result.stdout.strip().splitlines()[-1] if result.stdout.strip() else result.stderr.strip()[-200:]


selected = [(name, args) for name, args in cases() if a.only is None or name in a.only]
with ThreadPoolExecutor(max_workers=a.jobs) as pool:
    results = list(pool.map(lambda item: run(*item), [(i, name, args) for i, (name, args) in enumerate(selected)]))
failed = [name for name, code, _ in results if code != 0]
for name, code, line in results:
    print(f"{'ok  ' if code == 0 else 'DIFF'} {name}: {line}")
print(f"{len(results) - len(failed)}/{len(results)} clean" + (f"; differing: {', '.join(failed)}" if failed else ""))
sys.exit(1 if failed else 0)
