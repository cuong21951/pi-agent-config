import argparse, os, shlex, shutil, time, threading
import pyte, winpty

PI = os.path.join(os.environ["LOCALAPPDATA"], "Volta/tools/image/packages/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js")

ap = argparse.ArgumentParser()
ap.add_argument("--cmd", default=None)
ap.add_argument("--args", default="")
ap.add_argument("--cwd", default=r"C:\TimeBlock")
ap.add_argument("--rows", type=int, default=120)
ap.add_argument("--cols", type=int, default=132)
ap.add_argument("--wait", type=float, default=12)
ap.add_argument("--keys", default="", help="python-literal list of (delay, text)")
ap.add_argument("--out", required=True)
ap.add_argument("--raw", default=None)
a = ap.parse_args()

env = dict(os.environ)
env["PI_SKIP_VERSION_CHECK"] = "1"
env["CLAUDE_MODES_PERMISSION_CONFIG"] = os.path.join(os.path.dirname(a.out), "perm-throwaway.json")
env.pop("TMUX", None)
env.pop("HERDR_ENV", None)
env.pop("CLAUDECODE", None)
env.pop("CLAUDE_CODE_ENTRYPOINT", None)

cmd = shlex.split(a.cmd) if a.cmd else [shutil.which("node"), PI] + shlex.split(a.args)
p = winpty.PtyProcess.spawn(cmd, cwd=a.cwd, env=env, dimensions=(a.rows, a.cols))
screen = pyte.HistoryScreen(a.cols, a.rows, history=5000, ratio=0.5)
screen.set_mode(pyte.modes.LNM)
stream = pyte.Stream(screen)
raw = []
lock = threading.Lock()

def reader():
    while True:
        try:
            data = p.read(65536)
        except EOFError:
            return
        except Exception:
            return
        if not data:
            continue
        with lock:
            raw.append(data)
            stream.feed(data)
            if "\x1b[c" in data or "\x1b[0c" in data:
                p.write("\x1b[?62;22c")
            if "\x1b[6n" in data:
                p.write(f"\x1b[{screen.cursor.y + 1};{screen.cursor.x + 1}R")

t = threading.Thread(target=reader, daemon=True)
t.start()

start = time.time()
keys = eval(a.keys) if a.keys else []
for delay, text in keys:
    while time.time() - start < delay:
        time.sleep(0.1)
    p.write(text)
while time.time() - start < a.wait:
    time.sleep(0.2)

def hexcolor(c):
    if c == "default":
        return "-"
    return c

def render_line(chars, width):
    text, runs, cur, buf = [], [], None, ""
    for x in range(width):
        ch = chars[x] if isinstance(chars, dict) and x in chars else (chars[x] if not isinstance(chars, dict) else None)
        if ch is None:
            ch = screen.default_char
        key = (hexcolor(ch.fg), hexcolor(ch.bg), ch.bold)
        text.append(ch.data)
        if key != cur:
            if buf:
                runs.append((cur, buf))
            cur, buf = key, ch.data
        else:
            buf += ch.data
    if buf:
        runs.append((cur, buf))
    return "".join(text).rstrip(), runs

with lock:
    hist = list(screen.history.top)
    lines = [render_line(l, a.cols) for l in hist] + [render_line(screen.buffer[y], a.cols) for y in range(a.rows)]
    if a.raw:
        open(a.raw, "w", encoding="utf-8").write("".join(raw))

with open(a.out, "w", encoding="utf-8") as f:
    f.write("=== TEXT ===\n")
    for i, (txt, _) in enumerate(lines):
        f.write(f"{i:4d}|{txt}\n")
    f.write("\n=== COLORS (non-blank lines) ===\n")
    for i, (txt, runs) in enumerate(lines):
        if not txt.strip():
            bgs = {bg for (fg, bg, bold), s in runs if bg != "-"}
            if bgs:
                f.write(f"{i:4d}| (blank row, bg={','.join(sorted(bgs))})\n")
            continue
        lead = len(txt) - len(txt.lstrip(" "))
        if lead:
            f.write(f"{i:4d}| (indent {lead})\n")
        parts = []
        for (fg, bg, bold), s in runs:
            if not s.strip() and bg == "-":
                continue
            tag = f"fg={fg}" + (f",bg={bg}" if bg != "-" else "") + (",b" if bold else "")
            parts.append(f"[{tag}]{s.rstrip() if bg == '-' else s}")
        f.write(f"{i:4d}| " + " ".join(parts) + "\n")

try:
    p.write("\x03")
    time.sleep(0.3)
    p.write("\x03")
    time.sleep(0.5)
    p.terminate(force=True)
except Exception:
    pass
print("wrote", a.out, len(lines), "lines")
