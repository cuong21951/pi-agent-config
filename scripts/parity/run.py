import argparse, glob, json, os, re, shutil, socket, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
CAPTURE = os.path.join(HERE, "..", "pty-capture.py")
MOCK = os.path.join(HERE, "mock.py")
PROMPT = "Follow the instructions in TASK.md exactly."
DONE = r"✻ \S+ for [^\n]*· done"
SUBMITTED = r"(?m)^❯\s*$"

ap = argparse.ArgumentParser(description="Play a parity scenario live in pi (Copilot), replay pi's replies to Claude Code through mock.py, capture both screens.")
ap.add_argument("--out", default=os.path.join(os.environ["TEMP"], "pi-parity", "out"))
ap.add_argument("--only", choices=["claude", "pi"], default=None)
ap.add_argument("--scenario", default=None, help="scripts/parity/scenarios/<name>.json: prompt, steps, end, fixture, args")
ap.add_argument("--session", default=None, help="replay this pi session to Claude instead of the one pi just wrote")
ap.add_argument("--replay", default=None, help="no model at all: pi re-renders this saved session and Claude replays it")
ap.add_argument("--prompt", default=None)
ap.add_argument("--claude", default=os.path.join(os.environ["USERPROFILE"], ".local", "bin", "claude.exe"))
ap.add_argument("--claude-model", default="haiku")
ap.add_argument("--pi-model", default="github-copilot/claude-haiku-4.5")
ap.add_argument("--rows", type=int, default=100)
ap.add_argument("--cols", type=int, default=132)
ap.add_argument("--timeout", type=float, default=300)
ap.add_argument("--port", type=int, default=18471)
ap.add_argument("--pi-env", action="append", default=[], help="NAME=VALUE for the pi process, e.g. PI_TUI_DEBUG_REDRAW=1")
ap.add_argument("--raw", action="store_true", help="also save each side's raw terminal output as <side>.raw")
ap.add_argument("--dump-requests", action="store_true", help="save every main-loop request Claude sends as <out>/request-<n>.json")
ap.add_argument("--keep-claude-session", action="store_true", help="leave Claude's transcript of the replay in ~/.claude/projects (delete it yourself)")
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
SESSIONS = os.path.join(a.out, "pi-sessions")
WORKDIR = os.path.join(a.out, "work")
scenario = json.load(open(os.path.join(HERE, "scenarios", f"{a.scenario}.json"), encoding="utf-8")) if a.scenario else {}
prompt = a.prompt or scenario.get("prompt", PROMPT)
bypass = scenario.get("bypass", True)
ready = scenario.get("ready", r"\[PONYTAIL")
end = scenario.get("end", DONE)
fixture = os.path.join(HERE, scenario.get("fixture", "fixture"))
a.pi_model = scenario.get("pi_model", a.pi_model)
a.claude_model = scenario.get("claude_model", a.claude_model)


def fresh_workdir():
    shutil.rmtree(WORKDIR, ignore_errors=True)
    shutil.copytree(fixture, WORKDIR)
    count = scenario.get("search_data", 0)
    if count:
        os.makedirs(os.path.join(WORKDIR, "data"))
    for i in range(count):
        needle = "line three needle-token here" if i % 401 == 0 else "line three"
        with open(os.path.join(WORKDIR, "data", f"f{i}.txt"), "w", encoding="utf-8", newline="\r\n") as f:
            f.write(f"line one\nline two\n{needle}\n")


def steps_for(side):
    steps = [{"until": ready, "timeout": 90}, {"sleep": 1.5}]
    if prompt:
        steps += [{"keys": prompt}, {"sleep": 1.5}, {"keys": "\r"}, {"until": SUBMITTED, "timeout": 6, "retries": 2, "retry_keys": "\r"}]
    for step in scenario.get("steps", []):
        step = dict(step)
        if isinstance(step.get("keys"), dict):
            step["keys"] = step["keys"].get(side, "")
        steps.append(step)
    return steps


def capture(side, cmd_args, env=(), steps=None):
    fresh_workdir()
    base = [sys.executable, CAPTURE, "--cwd", WORKDIR, "--rows", str(a.rows), "--cols", str(a.cols),
            "--wait", str(a.timeout), "--until", end if steps else DONE, "--settle", "4",
            "--steps", json.dumps(steps or []),
            "--out", os.path.join(a.out, f"{side}.txt"), "--json", os.path.join(a.out, f"{side}.json"),
            *(["--raw", os.path.join(a.out, f"{side}.raw")] if a.raw else []),
            "--drop-env-prefix", "CLAUDE_CODE_", "--drop-env-prefix", "CLAUDECODE"]
    for pair in env:
        base += ["--env", pair]
    result = subprocess.run(base + cmd_args, capture_output=True, text=True)
    sys.stdout.write(f"{side}: {result.stdout.strip() or result.stderr.strip()[-400:]}\n")


def newest_session():
    files = glob.glob(os.path.join(SESSIONS, "**", "*.jsonl"), recursive=True)
    return max(files, key=os.path.getmtime) if files else None


def wait_port(port, seconds=10):
    deadline = time.time() + seconds
    while time.time() < deadline:
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", port)) == 0:
                return
        time.sleep(0.2)
    raise SystemExit(f"mock.py did not open port {port}")


def claude_project_dir():
    return os.path.join(os.environ["USERPROFILE"], ".claude", "projects", re.sub(r"[^A-Za-z0-9]", "-", WORKDIR))


def slash(path):
    return path.replace(os.sep, "/")


with open(os.path.join(a.out, "perm-throwaway.json"), "w", encoding="utf-8") as f:
    json.dump({"yoloMode": bypass}, f)
for stale in glob.glob(os.path.join(a.out, "claude*.json")) + glob.glob(os.path.join(a.out, "pi*.json")):
    if a.only in (None, os.path.basename(stale).split("-")[0].split(".")[0]):
        os.remove(stale)

if a.replay and a.only in (None, "pi"):
    copy = os.path.join(a.out, "replay.jsonl")
    shutil.copyfile(a.replay, copy)
    capture("pi", ["--args", f"--model {a.pi_model} --session {slash(copy)}"])
elif a.only in (None, "pi"):
    shutil.rmtree(SESSIONS, ignore_errors=True)
    capture("pi", ["--args", f"--model {a.pi_model} --models {a.pi_model} --session-dir {slash(SESSIONS)} {scenario.get('pi_args', '')}"], a.pi_env + scenario.get("pi_env", []), steps=steps_for("pi"))

if a.only in (None, "claude"):
    session = a.replay or a.session or newest_session()
    if not session and not prompt:
        session = os.path.join(a.out, "empty.jsonl")
        open(session, "w").close()
    if not session:
        raise SystemExit("no pi session to replay; run the pi side first")
    with socket.socket() as probe:
        if probe.connect_ex(("127.0.0.1", a.port)) == 0:
            raise SystemExit(f"port {a.port} is already in use; stop the old mock or pass --port")
    mock_log = os.path.join(a.out, "mock.log")
    open(mock_log, "w").close()
    dump = ["--dump", os.path.join(a.out, "request")] if a.dump_requests else []
    mock = subprocess.Popen([sys.executable, MOCK, "--session", session, "--workdir", WORKDIR, "--port", str(a.port), "--log", mock_log] + dump)
    permission = "--dangerously-skip-permissions" if bypass else "--permission-mode default --allow-dangerously-skip-permissions"
    try:
        wait_port(a.port)
        capture("claude", ["--cmd", f'"{slash(a.claude)}" --model {a.claude_model} {permission} {scenario.get("claude_args", "")}'],
                [f"ANTHROPIC_BASE_URL=http://127.0.0.1:{a.port}", "ANTHROPIC_AUTH_TOKEN=parity-mock", "ENABLE_CLAUDEAI_MCP_SERVERS=false", "CLAUDE_CODE_ALWAYS_ENABLE_EFFORT=1"],
                steps=steps_for("claude"))
    finally:
        mock.terminate()
        if not a.keep_claude_session:
            shutil.rmtree(claude_project_dir(), ignore_errors=True)
