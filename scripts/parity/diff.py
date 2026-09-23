import argparse, difflib, glob, json, os, re, sys

ap = argparse.ArgumentParser(description="Compare the Claude Code and pi captures of a parity run (final screen and every snapshot).")
ap.add_argument("--out", default=os.path.join(os.environ["TEMP"], "pi-parity", "out"))
a = ap.parse_args()

VOLATILE = [
    (re.compile(r"✻ \S+ for .*?· done .*$"), "✻ <verb> for <time> · done <clock>"),
    (re.compile(r"^[·✢*✶✻✽] \S+…"), "<spinner> <verb>…"),
    (DURATION := re.compile(r"\b(?:\d+d )?(?:\d+h )?(?:\d+m )?\d+(?:\.\d+)?s\b"), "<n>s"),
    (re.compile(r"↓ \d+(?:\.\d+)?k? tokens"), "↓ <n> tokens"),
    (re.compile(r"^(<spinner> <verb>…)(?: \(.*\))?$"), r"\1 <status>"),
]


EXCEPTIONS = [
    ("status-line meters: Claude's subscription meters vs pi's provider balances",
     re.compile(r"(?: · [A-Z][\w .]* █+ \d+%(?: ↻ \S+)?)+$"), re.compile(r"(?: · [a-z][\w-]* \$\d+(?:\.\d+)?)+$")),
    ("agents view count: other Claude Code sessions on this machine",
     re.compile(r" · ← \d+ agents?$"), None),
    ("retry cap: Claude's built-in 10 vs Cuong's settings.json retry.maxRetries 3",
     re.compile(r"(?<=· attempt \d)/10$"), re.compile(r"(?<=· attempt \d)/3$")),
    ("plugin update notice: Claude's marketplace auto-update toast; pi has no plugin marketplace",
     re.compile(r"^ +Plugin updated: .* · Run /reload-plugins to apply$"), None),
]

ANYWHERE = [
    ("plan file: each harness keeps its plans in its own folder with a random name (Claude ~/.claude/plans, pi ~/.pi/agent/plans)",
     re.compile(r"[^\s(]*\.claude[\\/]plans[\\/][\w.-]+\.md"), re.compile(r"[^\s(]*\.pi[\\/]agent[\\/]plans[\\/][\w.-]+\.md")),
]


ROWS = [
    ("spinner tips: Claude's context-aware catalogue of Claude-feature advice, shown by per-user cooldown history",
     re.compile(r"^  ⎿[  ]{2}Tip: "), None, False),
    ("out-of-scope model warning: the harness pins Haiku 4.5, which is outside Cuong's enabledModels",
     None, re.compile(r"^ Warning: Agent \".*\" using out-of-scope model "), re.compile(r"^\s*$")),
    ("background hint: Claude offers (ctrl+b to run in background) under a running bash; pi cannot move a running tool to the background",
     re.compile(r"^ +\(ctrl\+b to run in background\)$"), None, None),
    ("slash-menu inventory: Claude's built-ins (/code-review, /doctor) vs Cuong's pi skills fuzzy-matching the same query",
     re.compile(r"^  /(?:code-review|doctor) "), re.compile(r"^  /skill:\S+ "), re.compile(r"^ {32}\S")),
]


AGENT_TOKENS_NAME = "subagent tokens in the agents list: the mock answers Claude's subagent once, at the end, so its count stays 0"
AGENT_TOKENS = re.compile(r"◯ .* · [↓↑] \d+(?:\.\d+)?k? tokens$")


def right_aligned_without_tokens(text):
    cut = re.search(r" · [↓↑] \d+(?:\.\d+)?k? tokens$", text)
    head = text[:cut.start()]
    return re.sub(r"(  +)(\S+(?: \S+)*)$", lambda m: m.group(1) + " " * len(cut.group(0)) + m.group(2), head, count=1)


def row_exception(text, side):
    for name, claude_row, pi_row, follower in ROWS:
        row = claude_row if side == "claude" else pi_row
        if row and row.search(text):
            return name, follower
    return None, None


def load(name, side, applied):
    with open(os.path.join(a.out, f"{name}.json"), encoding="utf-8") as f:
        lines = json.load(f)
    kept, follower = [], None
    for line in lines:
        if follower and follower.search(line["text"]):
            continue
        exception, follower = row_exception(line["text"], side)
        if exception:
            applied.add(exception)
            continue
        if side == "pi" and AGENT_TOKENS.search(line["text"]):
            line = {**line, "text": right_aligned_without_tokens(line["text"])}
            applied.add(AGENT_TOKENS_NAME)
        kept.append(line)
    return kept


def normalise(text):
    text = text.rstrip()
    for pattern, replacement in VOLATILE:
        text = pattern.sub(replacement, text)
    return text


def regions(lines):
    texts = [line["text"].rstrip() for line in lines]
    prompt = max((i for i, t in enumerate(texts) if t.strip() == "❯"), default=len(texts))
    start = next((i for i, t in enumerate(texts[:prompt]) if re.match(r"^❯ \S", t)), prompt)
    start = max((i for i, t in enumerate(texts[:prompt]) if t.startswith("▔")), default=start)
    rule = prompt - 1 if prompt > 0 and texts[prompt - 1].startswith("─") else prompt
    above = max(start, rule - 2)
    end = above
    while end > start and not texts[end - 1].strip():
        end -= 1
    return lines[:start], lines[start:end], lines[above:]


def styles(line):
    chars = []
    for fg, bg, bold, text, *flags in line["runs"]:
        italic, dim = (flags + [False, False])[:2]
        chars += [(ch, fg, bg, bool(bold), bool(italic), bool(dim)) for ch in text]
    raw = "".join(c[0] for c in chars)
    folded = {i for m in DURATION.finditer(raw) for i in range(m.start() + 1, m.end())}
    return [c for i, c in enumerate(chars) if c[0].strip() and i not in folded]


def describe(style):
    return f"fg={style[1]} bg={style[2]} bold={style[3]}" + (" italic" if style[4] else "") + (" dim" if style[5] else "")


SPINNER = re.compile(r"^[·✢*✶✻✽] \S+…")


def animated(line):
    return len(line["text"].replace(" ", "")) if SPINNER.match(line["text"]) else 0


def colour_diff(c, p, limit=None):
    if animated(c) and animated(p):
        sc, sp = styles(c)[animated(c):], styles(p)[animated(p):]
    else:
        sc, sp = styles(c)[:limit], styles(p)[:limit]
    for i, (x, y) in enumerate(zip(sc, sp)):
        if x[1:] != y[1:]:
            return f"char {i} {x[0]!r}: claude {describe(x)} | pi {describe(y)}"
    return None


def excepted(texts, side, applied, exceptions=EXCEPTIONS):
    out = []
    for text in texts:
        for name, claude_pattern, pi_pattern in exceptions:
            pattern = claude_pattern if side == "claude" else pi_pattern
            if pattern and pattern.search(text):
                text = pattern.sub("", text)
                applied.add(name)
        out.append(text)
    return out


def compare(claude, pi, applied, footer=False):
    ct = [normalise(l["text"]) for l in claude]
    pt = [normalise(l["text"]) for l in pi]
    ct, pt = excepted(ct, "claude", applied, ANYWHERE), excepted(pt, "pi", applied, ANYWHERE)
    if footer:
        ct, pt = excepted(ct, "claude", applied), excepted(pt, "pi", applied)
    text_diffs, colour_diffs = [], []
    matcher = difflib.SequenceMatcher(a=ct, b=pt, autojunk=False)
    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                kept = len(ct[i1 + k].replace(" ", "")) if footer else None
                d = colour_diff(claude[i1 + k], pi[j1 + k], kept)
                if d and ct[i1 + k].strip():
                    colour_diffs.append(f"`{ct[i1 + k][:90]}` — {d}")
        else:
            text_diffs.append((op, ct[i1:i2], pt[j1:j2]))
    return text_diffs, colour_diffs


snaps = sorted(os.path.basename(p)[len("claude-"):-len(".json")] for p in glob.glob(os.path.join(a.out, "claude-*.json")))
screens = [("final", "claude", "pi")] + [(s, f"claude-{s}", f"pi-{s}") for s in snaps if os.path.exists(os.path.join(a.out, f"pi-{s}.json"))]

report = ["# pi vs Claude Code parity report", ""]
total = 0
applied = set()
for screen, claude_name, pi_name in screens:
    _, c_body, c_foot = regions(load(claude_name, "claude", applied))
    _, p_body, p_foot = regions(load(pi_name, "pi", applied))
    for name, c, p in (("Transcript", c_body, p_body), ("Prompt and footer", c_foot, p_foot)):
        text_diffs, colour_diffs = compare(c, p, applied, name == "Prompt and footer")
        total += len(text_diffs) + len(colour_diffs)
        report += [f"## {screen} · {name}: {len(text_diffs)} text hunks, {len(colour_diffs)} colour differences", ""]
        for op, left, right in text_diffs:
            report.append(f"### {op}")
            report.append("```diff")
            report += [f"- {line}" for line in left] + [f"+ {line}" for line in right]
            report.append("```")
        for line in colour_diffs:
            report.append(f"- {line}")
        report.append("")

if applied:
    report += ["## Accepted exceptions (README ledger, \"Not matched: pi cannot produce\")", ""] + [f"- {name}" for name in sorted(applied)] + [""]
report.insert(1, f"**{total} differences** over {len(screens)} screen(s) (claude = `-`, pi = `+`). Header rows above the first prompt are not compared.")
path = os.path.join(a.out, "report.md")
with open(path, "w", encoding="utf-8") as f:
    f.write("\n".join(report) + "\n")
print(f"{total} differences -> {path}")
sys.exit(0 if total == 0 else 1)
