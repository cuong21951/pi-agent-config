import argparse, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CAPTURE = os.path.join(HERE, "..", "pty-capture.py")
FIXTURE = os.path.join(HERE, "fixture")
WORKDIR = os.path.join(os.environ["TEMP"], "pi-parity", "work")
PROMPT = "Follow the instructions in TASK.md exactly."
DONE = r"✻ \S+ for [^\n]*· done"

ap = argparse.ArgumentParser(description="Run the parity task in Claude Code and in pi and capture both screens.")
ap.add_argument("--out", default=os.path.join(os.environ["TEMP"], "pi-parity", "out"))
ap.add_argument("--only", choices=["claude", "pi"], default=None)
ap.add_argument("--claude", default=os.path.join(os.environ["USERPROFILE"], ".local", "bin", "claude.exe"))
ap.add_argument("--claude-model", default="haiku")
ap.add_argument("--pi-model", default="github-copilot/claude-haiku-4.5")
ap.add_argument("--rows", type=int, default=60)
ap.add_argument("--cols", type=int, default=132)
ap.add_argument("--timeout", type=float, default=300)
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)


def fresh_workdir():
    shutil.rmtree(WORKDIR, ignore_errors=True)
    shutil.copytree(FIXTURE, WORKDIR)


def capture(side, cmd_args):
    fresh_workdir()
    keys = f"[(10, {PROMPT!r}), (11.5, '\\r')]"
    base = [sys.executable, CAPTURE, "--cwd", WORKDIR, "--rows", str(a.rows), "--cols", str(a.cols),
            "--wait", str(a.timeout), "--until", DONE, "--settle", "4", "--keys", keys,
            "--out", os.path.join(a.out, f"{side}.txt"), "--json", os.path.join(a.out, f"{side}.json"),
            "--drop-env-prefix", "CLAUDE_CODE_", "--drop-env-prefix", "CLAUDECODE"]
    result = subprocess.run(base + cmd_args, capture_output=True, text=True)
    sys.stdout.write(f"{side}: {result.stdout.strip() or result.stderr.strip()[-400:]}\n")


if a.only in (None, "claude"):
    capture("claude", ["--cmd", f'"{a.claude.replace(chr(92), "/")}" --model {a.claude_model} --dangerously-skip-permissions'])

if a.only in (None, "pi"):
    permission = os.path.join(a.out, "perm-throwaway.json")
    with open(permission, "w", encoding="utf-8") as f:
        json.dump({"yoloMode": True}, f)
    capture("pi", ["--args", f"--model {a.pi_model}"])

home = os.environ["USERPROFILE"]
drive, rest = os.path.splitdrive(WORKDIR)
for leftover in (
    os.path.join(home, ".pi", "agent", "sessions", f"--{drive.rstrip(':')}--{rest.strip(os.sep).replace(os.sep, '-')}--"),
    os.path.join(home, ".claude", "projects", f"{drive.rstrip(':')}-{rest.replace(os.sep, '-')}"),
):
    shutil.rmtree(leftover, ignore_errors=True)
