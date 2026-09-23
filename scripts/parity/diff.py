import argparse, difflib, json, os, re, sys

ap = argparse.ArgumentParser(description="Compare the Claude Code and pi captures of the parity task.")
ap.add_argument("--out", default=os.path.join(os.environ["TEMP"], "pi-parity", "out"))
a = ap.parse_args()

VOLATILE = [
    (re.compile(r"✻ \S+ for .*?· done .*$"), "✻ <verb> for <time> · done <clock>"),
    (re.compile(r"\b\d+(?:\.\d+)?s\b"), "<n>s"),
]


def load(side):
    with open(os.path.join(a.out, f"{side}.json"), encoding="utf-8") as f:
        return json.load(f)


def normalise(text):
    text = text.rstrip()
    for pattern, replacement in VOLATILE:
        text = pattern.sub(replacement, text)
    return text


def regions(lines):
    texts = [line["text"].rstrip() for line in lines]
    start = next((i for i, t in enumerate(texts) if re.match(r"^❯ \S", t)), 0)
    prompt = max((i for i, t in enumerate(texts) if t.strip() == "❯"), default=len(texts))
    rule = prompt - 1 if prompt > 0 and texts[prompt - 1].startswith("─") else prompt
    end = rule
    while end > start and (not texts[end - 1].strip() or texts[end - 1].strip().endswith("/effort")):
        end -= 1
    return lines[:start], lines[start:end], lines[rule:]


def styles(line):
    out = []
    for fg, bg, bold, text in line["runs"]:
        for ch in text:
            if ch.strip():
                out.append((ch, fg, bg, bool(bold)))
    return out


def colour_diff(c, p):
    sc, sp = styles(c), styles(p)
    for i, (x, y) in enumerate(zip(sc, sp)):
        if x[1:] != y[1:]:
            return f"char {i} {x[0]!r}: claude fg={x[1]} bg={x[2]} bold={x[3]} | pi fg={y[1]} bg={y[2]} bold={y[3]}"
    return None


def compare(name, claude, pi):
    ct = [normalise(l["text"]) for l in claude]
    pt = [normalise(l["text"]) for l in pi]
    text_diffs, colour_diffs = [], []
    matcher = difflib.SequenceMatcher(a=ct, b=pt, autojunk=False)
    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                d = colour_diff(claude[i1 + k], pi[j1 + k])
                if d and ct[i1 + k].strip():
                    colour_diffs.append(f"`{ct[i1 + k][:90]}` — {d}")
        else:
            text_diffs.append((op, ct[i1:i2], pt[j1:j2]))
    return text_diffs, colour_diffs


claude, pi = load("claude"), load("pi")
_, c_body, c_foot = regions(claude)
_, p_body, p_foot = regions(pi)

report = ["# pi vs Claude Code parity report", ""]
total = 0
for name, c, p in (("Transcript", c_body, p_body), ("Prompt and footer", c_foot, p_foot)):
    text_diffs, colour_diffs = compare(name, c, p)
    total += len(text_diffs) + len(colour_diffs)
    report += [f"## {name}: {len(text_diffs)} text hunks, {len(colour_diffs)} colour differences", ""]
    for op, left, right in text_diffs:
        report.append(f"### {op}")
        report.append("```diff")
        report += [f"- {line}" for line in left] + [f"+ {line}" for line in right]
        report.append("```")
    for line in colour_diffs:
        report.append(f"- {line}")
    report.append("")

report.insert(1, f"**{total} differences** (claude = `-`, pi = `+`). Header rows above the first prompt are not compared.")
path = os.path.join(a.out, "report.md")
with open(path, "w", encoding="utf-8") as f:
    f.write("\n".join(report) + "\n")
print(f"{total} differences -> {path}")
sys.exit(0 if total == 0 else 1)
