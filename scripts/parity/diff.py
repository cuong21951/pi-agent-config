import argparse, difflib, glob, json, os, re, sys

ap = argparse.ArgumentParser(description="Compare the Claude Code and pi captures of a parity run (final screen and every snapshot).")
ap.add_argument("--out", default=os.path.join(os.environ["TEMP"], "pi-parity", "out"))
a = ap.parse_args()

PLACEHOLDER = re.compile(r'^❯\s+Try "(?:fix lint errors|fix typecheck errors|how does \S+ work\?|refactor \S+|how do I log an error\?|edit \S+ to\.\.\.|write a test for \S+|create a util logging\.py that\.\.\.)"$')

AGENT_PLACEHOLDER = re.compile(r"^❯\s+Message @\S+…$")

VOLATILE = [
    (PLACEHOLDER, '❯ Try "<example>"'),
    (re.compile(r"✻ \S+ for .*?· done .*$"), "✻ <verb> for <time> · done <clock>"),
    (re.compile(r"^[·✢*✶✻✽] \S+…"), "<spinner> <verb>…"),
    (DURATION := re.compile(r"\b(?:\d+d )?(?:\d+h )?(?:\d+m )?\d+(?:\.\d+)?s\b"), "<n>s"),
    (re.compile(r"↓ \d+(?:\.\d+)?k? tokens"), "↓ <n> tokens"),
    (re.compile(r"(?<=\S) {2,}(?=<n>s · ↓ <n> tokens$)"), "  "),
    (re.compile(r"(?<= · )\d+(?:\.\d+)?k? tokens · \d+ tools?(?= · )"), "<n> tokens · <n> tools"),
    (re.compile(r"^(<spinner> <verb>…)(?: \(.*\))?$"), r"\1 <status>"),
    (re.compile(r"\b\d{2}:\d{2} [AP]M(?= \S+$)"), "<clock>"),
    (re.compile(r"\ba[0-9a-f]{16}\b"), "<agent-id>"),
    (re.compile(r"(?<=Resuming agent )a[0-9a-f]{6}\b"), "<agent-id7>"),
]

BLINK = re.compile(r"^[● ] (?=[^\s⎿].*(?:…| · (?:\d+[hm] )*\d+s)$)")

GLUED = ("tool gap: Claude draws the SendMessage result row directly under the previous tool block, pi keeps its one-row gap between tool rows",
         re.compile(r"^  ⎿[  ]{2}(?:Message queued for delivery to |Resuming agent )"))


EXCEPTIONS = [
    ("status-line meters: Claude's subscription meters vs pi's provider balances",
     re.compile(r"(?: · [A-Z][\w .]* █+ \d+%(?: ↻ \S+)?)+…?$"), re.compile(r"(?:(?: · [a-z][\w-]* \$\d+(?:\.\d+)?)+(?: · [a-z][\w-]*(?: \$\d*(?:\.\d*)?)?…)?|(?: · [a-z][\w-]*…))$")),
    ("agents view count: other Claude Code sessions on this machine (`← for agents` when there are none)",
     re.compile(r" · ← (?:\d+ ?a?g?e?n?t?s?|f?o?r? ?a?g?e?n?t?s?)…?$"), None),
    ("retry cap: Claude's built-in 10 vs Cuong's settings.json retry.maxRetries 3",
     re.compile(r"(?<=· attempt \d)/10$"), re.compile(r"(?<=· attempt \d)/3$")),
    ("plugin update notice: Claude's marketplace auto-update toast; pi has no plugin marketplace",
     re.compile(r"^ +Plugin updated: .* · Run /reload-plugins to apply$"), None),
]

ANYWHERE = [
    ("plan file: each harness keeps its plans in its own folder with a random name (Claude ~/.claude/plans, pi ~/.pi/agent/plans)",
     re.compile(r"[^\s(]*(?:\.claude|claude-config)[\\/]plans[\\/][\w.-]+\.md"), re.compile(r"[^\s(]*\.pi[\\/](?:sandbox[\\/])?agent[\\/]plans[\\/][\w.-]+\.md")),
    ("plugin update notice: Claude's marketplace auto-update toast; pi has no plugin marketplace",
     re.compile(r"(?<=▔) Plugin updated: [^▔]* · Run /reload-plugins to apply (?=▔)"), None),
]


ROWS = [
    ("spinner tips: Claude's context-aware catalogue of Claude-feature advice, shown by per-user cooldown history",
     re.compile(r"^  ⎿[  ]{2}Tip: "), None, re.compile(r"^ {5}\S")),
    ("out-of-scope model warning: the harness pins Haiku 4.5, which is outside Cuong's enabledModels",
     None, re.compile(r"^ Warning: Agent \".*\" using out-of-scope model "), re.compile(r"^\s*$")),
    ("slash-menu inventory: Claude's built-ins (/code-review, /doctor) vs Cuong's pi skills fuzzy-matching the same query; the blank rows above an open menu follow its height and are not compared",
     re.compile(r"^  /(?:code-review|doctor) "), re.compile(r"^  /skill:\S+ "), re.compile(r"^ {32}\S")),
    ("session-start notice: each harness's own SessionStart line (Claude's agents-md hook, pi's Ponytail loader), drawn after the history on a resume",
     re.compile(r"^● agents-md: "), re.compile(r"^● Ponytail loaded: "), None),
]


TIPS_NAME = ROWS[0][0]


def row_exception(text, side):
    for name, claude_row, pi_row, follower in ROWS:
        row = claude_row if side == "claude" else pi_row
        if row and row.search(text):
            return name, follower
    return None, None


def raw(name):
    with open(os.path.join(a.out, f"{name}.json"), encoding="utf-8") as f:
        return json.load(f)


def load(name, side, applied, keep=None):
    lines = raw(name)
    lines = lines[-keep:] if keep else lines
    kept, follower, padded = [], None, False
    for line in lines:
        if follower and follower.search(line["text"]):
            if padded:
                kept.insert(max(0, len(kept) - 1), {"text": "", "runs": []})
            continue
        if side == "pi" and GLUED[1].search(line["text"]) and kept and not kept[-1]["text"].strip():
            kept.pop()
            applied.add(GLUED[0])
        exception, follower = row_exception(line["text"], side)
        padded = exception == TIPS_NAME
        if exception:
            applied.add(exception)
            if padded:
                kept.insert(max(0, len(kept) - 1), {"text": "", "runs": []})
            continue
        kept.append(line)
    return without_menu_filler(kept)


MENU_ROW = re.compile(r"^  /[a-z]")


def without_menu_filler(lines):
    menu = next((i for i, line in enumerate(lines) if MENU_ROW.match(line["text"])), None)
    if menu is None:
        return lines
    top = menu
    while top > 0 and not lines[top - 1]["text"].strip():
        top -= 1
    return lines[:top] + lines[menu:]


def normalise(text, transcript=False):
    text = BLINK.sub("<blink> ", text.rstrip()) if transcript else text.rstrip()
    for pattern, replacement in VOLATILE:
        text = pattern.sub(replacement, text)
    return text


def regions(lines, cut=False):
    texts = [line["text"].rstrip() for line in lines]
    boxed = any(t.startswith("❯") and i > 0 and texts[i - 1].startswith("─") for i, t in enumerate(texts))
    prompt = max((i for i, t in enumerate(texts) if t.strip() == "❯" or PLACEHOLDER.match(t) or AGENT_PLACEHOLDER.match(t)), default=len(texts))
    start = next((i for i, t in enumerate(texts[:prompt]) if re.match(r"^❯ \S", t)), prompt if boxed and not cut else 0)
    start = max((i for i, t in enumerate(texts[:prompt]) if t.startswith("▔")), default=start)
    rule = prompt - 1 if prompt > 0 and texts[prompt - 1].startswith("─") else prompt
    above = max(start, rule - 2)
    end = above
    while end > start and not texts[end - 1].strip():
        end -= 1
    return lines[:start], lines[start:end], lines[above:]


def gap_above_box(lines):
    texts = [line["text"].rstrip() for line in lines]
    top = max((i for i in range(len(texts) - 1) if texts[i].startswith("─") and texts[i + 1].startswith("❯")), default=None)
    if top is None:
        return None
    blank = 0
    while blank < top and not texts[top - 1 - blank].strip():
        blank += 1
    return blank


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


def blinking(line):
    return 1 if BLINK.match(line["text"]) and line["text"].startswith("●") else 0


def colour_diff(c, p, limit=None):
    if animated(c) and animated(p):
        sc, sp = styles(c)[animated(c):], styles(p)[animated(p):]
    else:
        skip = limit is None
        sc, sp = styles(c)[skip and blinking(c):limit], styles(p)[skip and blinking(p):limit]
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
                text = pattern.sub(lambda m: "▔" * len(m.group(0)) if m.string[m.start() - 1:m.start()] == "▔" else "", text)
                applied.add(name)
        out.append(text)
    return out


def compare(claude, pi, applied, footer=False):
    ct = [normalise(l["text"], not footer) for l in claude]
    pt = [normalise(l["text"], not footer) for l in pi]
    before = ct
    ct, pt = excepted(ct, "claude", applied, ANYWHERE), excepted(pt, "pi", applied, ANYWHERE)
    rewritten = {i for i, (x, y) in enumerate(zip(before, ct)) if x != y}
    if footer:
        ct, pt = excepted(ct, "claude", applied), excepted(pt, "pi", applied)
    text_diffs, colour_diffs = [], []
    matcher = difflib.SequenceMatcher(a=ct, b=pt, autojunk=False)
    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                kept = len(ct[i1 + k].replace(" ", "")) if footer else None
                d = None if i1 + k in rewritten else colour_diff(claude[i1 + k], pi[j1 + k], kept)
                if d and ct[i1 + k].strip():
                    colour_diffs.append(f"`{ct[i1 + k][:90]}` — {d}")
        else:
            text_diffs.append((op, ct[i1:i2], pt[j1:j2]))
    return text_diffs, colour_diffs


snaps = sorted(os.path.basename(p)[len("claude-"):-len(".json")] for p in glob.glob(os.path.join(a.out, "claude-*.json")))
screens = [("final", "claude", "pi")] + [(s, f"claude-{s}", f"pi-{s}") for s in snaps if os.path.exists(os.path.join(a.out, f"pi-{s}.json"))]

checks_path = os.path.join(a.out, "checks.json")
gap = json.load(open(checks_path, encoding="utf-8")).get("gap") if os.path.exists(checks_path) else None
report = ["# pi vs Claude Code parity report", ""]
total = 0
applied = set()
for screen, claude_name, pi_name in screens:
    c_raw, p_raw = raw(claude_name), raw(pi_name)
    viewport = len(c_raw) if len(p_raw) > len(c_raw) else None
    if len(p_raw) != len(c_raw):
        total += 1
        report += [f"## {screen} · scrollback: Claude's capture is {len(c_raw)} rows, pi's {len(p_raw)} (both keep the overflow inside the screen, none in terminal scrollback)", ""]
    if gap is not None:
        gaps = (gap_above_box(c_raw), gap_above_box(p_raw))
        if gaps != (gap, gap):
            total += 1
            report += [f"## {screen} · gap: {gaps[0]} blank row(s) above the prompt box on Claude's side, {gaps[1]} on pi's (the case wants {gap})", ""]
    _, c_body, c_foot = regions(load(claude_name, "claude", applied), bool(viewport))
    _, p_body, p_foot = regions(load(pi_name, "pi", applied, viewport), bool(viewport))
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

reqdiff_config = os.path.join(a.out, "reqdiff.json")
if os.path.exists(reqdiff_config) and json.load(open(reqdiff_config, encoding="utf-8")).get("checks"):
    import subprocess
    requests = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "reqdiff.py"), "--out", a.out], capture_output=True, text=True)
    found = re.match(r"(\d+) request differences", requests.stdout.strip())
    total += int(found.group(1)) if found else 1
    reqdiff_report = os.path.join(a.out, "reqdiff.md")
    report += (open(reqdiff_report, encoding="utf-8").read().splitlines() if os.path.exists(reqdiff_report) else [f"## Model-facing requests: reqdiff failed: {requests.stderr.strip()[-300:]}"]) + [""]

if applied:
    report += ["## Accepted exceptions (README ledger, \"Not matched: pi cannot produce\")", ""] + [f"- {name}" for name in sorted(applied)] + [""]
report.insert(1, f"**{total} differences** over {len(screens)} screen(s) (claude = `-`, pi = `+`). Header rows above the first prompt are not compared.")
path = os.path.join(a.out, "report.md")
with open(path, "w", encoding="utf-8") as f:
    f.write("\n".join(report) + "\n")
print(f"{total} differences -> {path}")
sys.exit(0 if total == 0 else 1)
