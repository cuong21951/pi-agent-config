import argparse, glob, json, os, re, shutil, socket, subprocess, sys, time, uuid

HERE = os.path.dirname(os.path.abspath(__file__))
CAPTURE = os.path.join(HERE, "..", "pty-capture.py")
MOCK = os.path.join(HERE, "mock.py")
PI_MOCK_PROVIDER = os.path.join(HERE, "pi-mock-provider.ts")
PI_MOCK_PROVIDER_NAME = "parity-mock"
PI_MOCK_MODEL_ID = "claude-haiku-4-5"
PROMPT = "Follow the instructions in TASK.md exactly."
DONE = r"✻ \S+ for [^\n]*· done"
SUBMITTED = r"(?m)^❯\s*$"
PI_SANDBOX_ENV = [f"{name}={os.environ[name]}" for name in ("PI_CODING_AGENT_DIR", "PI_CLI") if os.environ.get(name)]

ap = argparse.ArgumentParser(description="Play a parity scenario live in pi (Copilot), replay pi's replies to Claude Code through mock.py, capture both screens.")
ap.add_argument("--out", default=os.path.join(os.environ["TEMP"], "pi-parity", "out"))
ap.add_argument("--only", choices=["claude", "pi"], default=None)
ap.add_argument("--scenario", default=None, help="scripts/parity/scenarios/<name>.json: prompt, steps, end, fixture, args")
ap.add_argument("--session", default=None, help="replay this pi session to Claude instead of the one pi just wrote")
ap.add_argument("--replay", default=None, help="no model at all: pi re-renders this saved session and Claude replays it")
ap.add_argument("--prompt", default=None)
ap.add_argument("--claude", default=os.environ.get("PARITY_CLAUDE") or os.path.join(os.environ["USERPROFILE"], ".local", "bin", "claude.exe"))
ap.add_argument("--claude-model", default="haiku")
ap.add_argument("--pi-model", default="github-copilot/claude-haiku-4.5")
ap.add_argument("--rows", type=int, default=100)
ap.add_argument("--cols", type=int, default=132)
ap.add_argument("--timeout", type=float, default=300)
ap.add_argument("--port", type=int, default=18471)
ap.add_argument("--pi-env", action="append", default=[], help="NAME=VALUE for the pi process, e.g. PI_TUI_DEBUG_REDRAW=1")
ap.add_argument("--raw", action="store_true", help="also save each side's raw terminal output as <side>.raw")
ap.add_argument("--dump-requests", action="store_true", help="save every main-loop request Claude sends as <out>/request-<n>.json")
ap.add_argument("--pi-mock", action="store_true", help="pi talks to mock.py too (scenario key pi_mock): both sides replay --session, both dump their requests as <out>/req-<side>-<n>.json")
ap.add_argument("--keep-claude-session", action="store_true", help="leave Claude's transcript of the replay in ~/.claude/projects (delete it yourself)")
ap.add_argument("--fresh-claude", action="store_true", help="with --replay, capture Claude's live replay instead of resuming a copy of it (pi's side is always a resume)")
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
SESSIONS = os.path.join(a.out, "pi-sessions")
WORKDIR = os.path.join(a.out, "work")
scenario = json.loads(open(os.path.join(HERE, "scenarios", f"{a.scenario}.json"), encoding="utf-8").read().replace("{parity}", HERE.replace(os.sep, "/"))) if a.scenario else {}
prompt = a.prompt or scenario.get("prompt", PROMPT)
bypass = scenario.get("bypass", True)
ready = scenario.get("ready", r"\[PONYTAIL")
end = scenario.get("end", DONE)
fixture = os.path.join(HERE, scenario.get("fixture", "fixture"))
a.pi_model = scenario.get("pi_model", a.pi_model)
a.claude_model = scenario.get("claude_model", a.claude_model)
a.rows = scenario.get("rows", a.rows)
pi_mock = a.pi_mock or scenario.get("pi_mock", False)
scripted = a.session or (os.path.join(HERE, scenario["session"]) if scenario.get("session") else None)
if pi_mock:
    a.pi_model = f"{PI_MOCK_PROVIDER_NAME}/{scenario.get('pi_mock_model', PI_MOCK_MODEL_ID)}"
    a.dump_requests = True
a.cols = scenario.get("cols", a.cols)


def fresh_workdir():
    deadline = time.time() + 30
    shutil.rmtree(WORKDIR, ignore_errors=True)
    while os.path.exists(WORKDIR) and time.time() < deadline:
        time.sleep(0.5)
        shutil.rmtree(WORKDIR, ignore_errors=True)
    if os.path.exists(WORKDIR):
        raise SystemExit(f"{WORKDIR} is still held open 30 s after the pi run; a child process outlived pi")
    shutil.copytree(fixture, WORKDIR)
    count = scenario.get("search_data", 0)
    if count:
        os.makedirs(os.path.join(WORKDIR, "data"))
    for i in range(count):
        needle = "line three needle-token here" if i % 401 == 0 else "line three"
        with open(os.path.join(WORKDIR, "data", f"f{i}.txt"), "w", encoding="utf-8", newline="\r\n") as f:
            f.write(f"line one\nline two\n{needle}\n")


def steps_for(side, typed=True):
    steps = [{"until": ready, "timeout": 90}, {"sleep": 1.5}]
    if prompt and typed:
        steps += [{"keys": prompt}, {"sleep": 1.5}, {"keys": "\r"}, {"until": SUBMITTED, "timeout": 6, "retries": 2, "retry_keys": "\r"}]
    for step in scenario.get("steps", []):
        step = dict(step)
        if isinstance(step.get("keys"), dict):
            step["keys"] = step["keys"].get(side, "")
        steps.append(step)
    return steps


def capture(side, cmd_args, env=(), steps=None, until=None, out=None):
    fresh_workdir()
    out = out or a.out
    os.makedirs(out, exist_ok=True)
    base = [sys.executable, CAPTURE, "--cwd", WORKDIR, "--rows", str(a.rows), "--cols", str(a.cols),
            "--wait", str(a.timeout), "--until", until or (end if steps else DONE), "--settle", "4",
            "--steps", json.dumps(steps or []),
            "--out", os.path.join(out, f"{side}.txt"), "--json", os.path.join(out, f"{side}.json"),
            *(["--raw", os.path.join(out, f"{side}.raw")] if a.raw else []),
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


def start_mock(session, prefix, log_name, extra=()):
    with socket.socket() as probe:
        if probe.connect_ex(("127.0.0.1", a.port)) == 0:
            raise SystemExit(f"port {a.port} is already in use; stop the old mock or pass --port")
    mock_log = os.path.join(a.out, log_name)
    open(mock_log, "w").close()
    dump = ["--dump", os.path.join(a.out, prefix)] if a.dump_requests else []
    mock = subprocess.Popen([sys.executable, MOCK, "--session", session, "--workdir", WORKDIR, "--port", str(a.port), "--log", mock_log, *extra] + dump)
    wait_port(a.port)
    return mock


def stop_mock(mock):
    mock.terminate()
    mock.wait(10)
    deadline = time.time() + 10
    while time.time() < deadline:
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", a.port)) != 0:
                return
        time.sleep(0.2)


def claude_project_dir():
    return os.path.join(os.environ["CLAUDE_CONFIG_DIR"], "projects", re.sub(r"[^A-Za-z0-9]", "-", WORKDIR))


def slash(path):
    return path.replace(os.sep, "/")


def resumable_copy():
    files = glob.glob(os.path.join(claude_project_dir(), "*.jsonl"))
    if not files:
        raise SystemExit("Claude wrote no transcript to resume")
    source = max(files, key=os.path.getmtime)
    old, new = os.path.basename(source)[:-len(".jsonl")], str(uuid.uuid4())
    with open(source, encoding="utf-8") as f:
        text = f.read().replace(old, new)
    with open(os.path.join(claude_project_dir(), f"{new}.jsonl"), "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    return new


with open(os.path.join(a.out, "reqdiff.json"), "w", encoding="utf-8") as f:
    json.dump({"prompt": prompt, "checks": scenario.get("reqdiff", []) if pi_mock else []}, f)
with open(os.path.join(a.out, "checks.json"), "w", encoding="utf-8") as f:
    json.dump({"gap": scenario.get("gap")}, f)
with open(os.path.join(a.out, "perm-throwaway.json"), "w", encoding="utf-8") as f:
    json.dump({"yoloMode": bypass}, f)
CHEAP_MODELS_MOCK = os.path.join(a.out, "cheap-models-mock.json")
with open(CHEAP_MODELS_MOCK, "w", encoding="utf-8") as f:
    json.dump({"maxInputPerM": -1, "maxOutputPerM": -1, "subscriptions": [f"{PI_MOCK_PROVIDER_NAME}/*"], "allow": [], "deny": []}, f)
for stale in glob.glob(os.path.join(a.out, "claude*.json")) + glob.glob(os.path.join(a.out, "pi*.json")) + glob.glob(os.path.join(a.out, "request-*.json")):
    if a.only in (None, os.path.basename(stale).split("-")[0].split(".")[0]):
        os.remove(stale)
for side in ("claude", "pi"):
    if a.only in (None, side):
        for stale in glob.glob(os.path.join(a.out, f"req-{side}-*.json")):
            os.remove(stale)

if a.replay and a.only in (None, "pi"):
    copy = os.path.join(a.out, "replay.jsonl")
    with open(a.replay, encoding="utf-8") as f:
        header, *entries = f.read().splitlines(keepends=True)
    session_header = json.loads(header)
    if session_header.get("type") == "session" and session_header.get("cwd"):
        header = json.dumps({**session_header, "cwd": WORKDIR}) + "\n"
    with open(copy, "w", encoding="utf-8", newline="\n") as f:
        f.write(header + "".join(entries))
    capture("pi", ["--args", f"--model {a.pi_model} --session {slash(copy)}"], PI_SANDBOX_ENV + a.pi_env, steps=steps_for("pi", typed=False) if scenario.get("steps") else None)
elif a.only in (None, "pi"):
    shutil.rmtree(SESSIONS, ignore_errors=True)
    pi_args = f"--model {a.pi_model} --models {a.pi_model} --session-dir {slash(SESSIONS)} {scenario.get('pi_args', '')}"
    if pi_mock:
        if not scripted:
            raise SystemExit("pi_mock needs --session or a scenario session")
        mock = start_mock(scripted, "req-pi", "pi-mock.log", ["--pi"])
        try:
            capture("pi", ["--args", f"-e {slash(PI_MOCK_PROVIDER)} {pi_args}"], PI_SANDBOX_ENV + a.pi_env + scenario.get("pi_env", []) + [f"PARITY_MOCK_URL=http://127.0.0.1:{a.port}", f"CHEAP_MODELS_CONFIG={CHEAP_MODELS_MOCK}"], steps=steps_for("pi"))
        finally:
            stop_mock(mock)
    else:
        capture("pi", ["--args", pi_args], PI_SANDBOX_ENV + a.pi_env + scenario.get("pi_env", []), steps=steps_for("pi"))

if a.only in (None, "claude"):
    if not os.environ.get("CLAUDE_CONFIG_DIR"):
        raise SystemExit("set CLAUDE_CONFIG_DIR to a throwaway Claude config (source ~/.pi/sandbox/env.sh): a killed Claude launch records a fullscreen boot strike in the real ~/.claude.json, and two strikes turn Cuong's fullscreen renderer off")
    session = a.replay or scripted or newest_session()
    if not session and not prompt:
        session = os.path.join(a.out, "empty.jsonl")
        open(session, "w").close()
    if not session:
        raise SystemExit("no pi session to replay; run the pi side first")
    mock = start_mock(session, "req-claude" if pi_mock else "request", "mock.log")
    permission = "--dangerously-skip-permissions" if bypass else "--permission-mode default --allow-dangerously-skip-permissions"
    try:
        command = f'"{slash(a.claude)}" --model {a.claude_model} {permission} {scenario.get("claude_args", "")}'
        claude_env = [f"ANTHROPIC_BASE_URL=http://127.0.0.1:{a.port}", "ANTHROPIC_AUTH_TOKEN=parity-mock", "ENABLE_CLAUDEAI_MCP_SERVERS=false", "CLAUDE_CODE_ALWAYS_ENABLE_EFFORT=1", "DISABLE_AUTOUPDATER=1", f"CLAUDE_CONFIG_DIR={os.environ['CLAUDE_CONFIG_DIR']}", *scenario.get("claude_env", [])]
        if a.replay and not a.fresh_claude:
            capture("claude", ["--cmd", command], claude_env, steps=[{"until": ready, "timeout": 90}, {"sleep": 1.5}, {"keys": prompt}, {"sleep": 1.5}, {"keys": "\r"}, {"until": SUBMITTED, "timeout": 6, "retries": 2, "retry_keys": "\r"}], until=DONE, out=os.path.join(a.out, "claude-live"))
            resumed = steps_for("claude", typed=False) if scenario.get("steps") else [{"until": ready, "timeout": 90}, {"sleep": 1.5}]
            capture("claude", ["--cmd", f"{command} --resume {resumable_copy()}"], claude_env, steps=resumed, until=None if scenario.get("steps") else ready)
        else:
            capture("claude", ["--cmd", command], claude_env, steps=steps_for("claude"))
    finally:
        stop_mock(mock)
        if not a.keep_claude_session:
            shutil.rmtree(claude_project_dir(), ignore_errors=True)
