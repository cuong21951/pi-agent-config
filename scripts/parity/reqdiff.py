import argparse, difflib, glob, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))

ap = argparse.ArgumentParser(description="Compare the model-facing requests Claude Code and pi sent to mock.py (req-claude-<n>.json vs req-pi-<n>.json): tool schemas, tool results, task notifications, subagent system prompts and first messages.")
ap.add_argument("--out", default=None, help="a run.py --pi-mock output folder; reads reqdiff.json for the checks")
ap.add_argument("--claude", default=None, help="dump prefix or folder for the Claude side")
ap.add_argument("--pi", default=None, help="dump prefix or folder for the pi side")
ap.add_argument("--check", action="append", default=[])
ap.add_argument("--prompt", default=None, help="the scenario prompt: requests whose first user message holds it are the main loop")
ap.add_argument("--selftest", action="store_true", help="compare the saved m6g Claude dumps against themselves")
a = ap.parse_args()

TOTAL_TOKENS = re.compile(r"\n*<system-reminder>\n<total_tokens>\d+ tokens left</total_tokens>\n</system-reminder>\n*")
NORMALISE = [
    (re.compile(r"<output-file>[^<]*</output-file>"), "<output-file><path></output-file>"),
    (re.compile(r"(output_file: )\S+"), r"\1<path>"),
    (re.compile(r"\ba[0-9a-f]{16}\b"), "<agent-id>"),
    (re.compile(r"(Resuming agent )a[0-9a-f]{6}\b"), r"\1<agent-id7>"),
    (re.compile(r"\btoolu_\w+"), "<toolu>"),
    (re.compile(r"<(duration_ms|subagent_tokens|tool_uses)>\d+</"), r"<\1><n></"),
    (re.compile(r"\b(duration_ms|subagent_tokens|tool_uses): \d+"), r"\1: <n>"),
    (re.compile(r"started \d+[smh] ago"), "started <n>s ago"),
    (re.compile(r"<total_tokens>\d+ tokens left</total_tokens>"), "<total_tokens><n> tokens left</total_tokens>"),
    (re.compile(r"(?m)^(Primary working directory|Working directory|cwd): .*$"), r"\1: <cwd>"),
    (re.compile(r"[A-Za-z]:[\\/][^\s'\"<>]*?[\\/]pi-parity[\\/][^\s'\"<>]*"), "<tmp-path>"),
    (re.compile(r"\r\n"), "\n"),
]


def normalise(text):
    text = TOTAL_TOKENS.sub("", text) if not text.lstrip().startswith("<system-reminder>\n<total_tokens>") else text
    for pattern, replacement in NORMALISE:
        text = pattern.sub(replacement, text)
    return text.rstrip()


def load(where):
    files = glob.glob(os.path.join(where, "*.json")) if os.path.isdir(where) else glob.glob(f"{where}-*.json")
    number = lambda f: int(re.search(r"-(\d+)\.json$", f).group(1))
    return [json.load(open(f, encoding="utf-8")) for f in sorted(files, key=number)]


def blocks(content):
    if isinstance(content, str):
        return [{"type": "text", "text": content}]
    return content or []


def texts(content):
    return [b.get("text", "") for b in blocks(content) if b.get("type") == "text"]


def first_user_text(body):
    for message in body.get("messages", []):
        if message.get("role") == "user":
            return "\n".join(texts(message["content"]))
    return ""


def is_side(body):
    last = json.dumps((body.get("messages") or [{}])[-1].get("content"), ensure_ascii=False)
    return "Describe your most recent action in 3-5 words" in last or "[SUGGESTION MODE:" in last


def main_requests(bodies, prompt):
    return [b for b in bodies if not is_side(b) and (prompt is None or prompt in first_user_text(b))]


def sub_requests(bodies, key):
    return [b for b in bodies if not is_side(b) and key in first_user_text(b)]


def canonical(value, key=None):
    if isinstance(value, dict):
        items = value.items() if key == "properties" else sorted(value.items())
        return {k: canonical(v, k) for k, v in items if k not in ("$schema", "cache_control")}
    if isinstance(value, list):
        return [canonical(v) for v in value]
    return value


def tool(bodies, name):
    for body in reversed(bodies):
        for t in body.get("tools", []):
            if t.get("name") == name:
                return f"description:\n{normalise(t.get('description', ''))}\n\ninput_schema:\n{json.dumps(canonical(t.get('input_schema')), indent=1, ensure_ascii=False)}"
    return None


def result_text(content):
    if isinstance(content, str):
        return content
    return "\n".join(b.get("text", "") for b in content or [] if b.get("type") == "text")


def tool_results(bodies, name):
    body = bodies[-1] if bodies else {}
    ids = [b["id"] for m in body.get("messages", []) if m.get("role") == "assistant" for b in blocks(m["content"]) if b.get("type") == "tool_use" and b.get("name") == name]
    found = {b["tool_use_id"]: b for m in body.get("messages", []) if m.get("role") == "user" for b in blocks(m["content"]) if b.get("type") == "tool_result"}
    return [("[error] " if found[i].get("is_error") else "") + normalise(result_text(found[i].get("content"))) for i in ids if i in found]


def notifications(bodies):
    body = bodies[-1] if bodies else {}
    out = []
    for message in body.get("messages", []):
        if message.get("role") != "user":
            continue
        for text in texts(message["content"]):
            if "<task-notification>" in text:
                out.append(normalise(text))
    return out


def reminder(bodies, start):
    body = bodies[0] if bodies else {}
    for message in body.get("messages", []):
        if message.get("role") == "user":
            for text in texts(message["content"]):
                if text.startswith(f"<system-reminder>\n{start}"):
                    return normalise(text)
            return None
    return None


def system_text(body):
    system = body.get("system")
    parts = [system] if isinstance(system, str) else [b.get("text", "") for b in system or []]
    return "\n\n".join(normalise(p) for p in parts if not p.startswith("x-anthropic-billing-header"))


def extract(bodies, check, prompt):
    kind, _, arg = check.partition(":")
    main = main_requests(bodies, prompt)
    if kind == "tool":
        return tool(main, arg)
    if kind == "result":
        name, _, index = arg.partition("#")
        found = tool_results(main, name)
        if index:
            found = found[int(index) - 1:int(index)]
        return "\n\n----\n\n".join(found) if found else None
    if kind == "notifications":
        found = notifications(main)
        return "\n\n----block----\n\n".join(found) if found else None
    if kind == "reminder":
        return reminder(main, arg)
    if kind == "sub":
        key, _, part = arg.rpartition(":")
        subs = sub_requests(bodies, key)
        if not subs:
            return None
        first = subs[0]
        if part == "system":
            return system_text(first)
        if part == "first":
            user = next(m for m in first["messages"] if m["role"] == "user")
            return "\n\n----block----\n\n".join(normalise(t) for t in texts(user["content"]))
        if part == "tools":
            return "\n".join(sorted(t["name"] for t in first.get("tools", [])))
        if part == "model":
            return json.dumps({k: first.get(k) for k in ("model", "max_tokens")})
    raise SystemExit(f"unknown check {check}")


def compare(claude, pi, checks, prompt):
    report, total = [], 0
    for check in checks:
        c, p = extract(claude, check, prompt), extract(pi, check, prompt)
        if c == p and c is not None:
            report.append(f"- ok `{check}`")
            continue
        total += 1
        report.append(f"### DIFF `{check}`" + (" (missing on the Claude side)" if c is None else "") + (" (missing on the pi side)" if p is None else ""))
        report.append("```diff")
        report += list(difflib.unified_diff((c or "").splitlines(), (p or "").splitlines(), "claude", "pi", lineterm="", n=2))
        report.append("```")
    return total, report


def run(claude_where, pi_where, checks, prompt):
    claude, pi = load(claude_where), load(pi_where)
    if not claude or not pi:
        return 1, [f"no requests: claude {len(claude)}, pi {len(pi)}"]
    return compare(claude, pi, checks, prompt)


if a.selftest:
    root = os.path.join(os.environ["TEMP"], "pi-parity")
    cases = [("m6g-bg", "M6G background run.", ["tool:Agent", "tool:SendMessage", "tool:ListAgents", "tool:TaskStop", "result:Agent", "result:SendMessage", "notifications", "reminder:Available agent types", "sub:M6G-SUB-BG:system", "sub:M6G-SUB-BG:first", "sub:M6G-SUB-BG:tools"]),
             ("m6g-types", "M6G types run.", ["notifications", "sub:M6G-SUB-EX:system", "sub:M6G-SUB-PL:system", "sub:M6G-SUB-CU:system", "sub:M6G-SUB-CU:tools", "sub:M6G-SUB-CU:model"])]
    failed = 0
    for name, prompt, checks in cases:
        where = os.path.join(root, name)
        if not os.path.isdir(where):
            print(f"skip {name}: {where} missing")
            continue
        bodies = load(os.path.join(where, "request"))
        total, report = compare(bodies, bodies, checks, prompt)
        missing = [check for check in checks if extract(bodies, check, prompt) is None]
        failed += total + len(missing)
        print(f"{name}: {total} differences, {len(missing)} empty checks {missing}")
    sys.exit(1 if failed else 0)

if a.out:
    config = json.load(open(os.path.join(a.out, "reqdiff.json"), encoding="utf-8"))
    checks, prompt = config.get("checks", []), config.get("prompt")
    if not checks:
        print("0 request differences (no checks)")
        sys.exit(0)
    total, report = run(os.path.join(a.out, "req-claude"), os.path.join(a.out, "req-pi"), checks, prompt)
    with open(os.path.join(a.out, "reqdiff.md"), "w", encoding="utf-8") as f:
        f.write("\n".join([f"## Model-facing requests: {total} differences", ""] + report) + "\n")
    print(f"{total} request differences -> {os.path.join(a.out, 'reqdiff.md')}")
    sys.exit(1 if total else 0)

total, report = run(a.claude, a.pi, a.check, a.prompt)
print("\n".join(report))
print(f"{total} request differences")
sys.exit(1 if total else 0)
