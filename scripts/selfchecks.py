import glob, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FLAG = re.compile(r"process\.env\.([A-Z_]+_SELFTEST)")


def runs():
    for path in sorted(glob.glob(os.path.join(ROOT, "extensions", "*", "*.ts"))):
        for flag in sorted(set(ENV_FLAG.findall(open(path, encoding="utf-8").read()))):
            yield os.path.relpath(path, ROOT), [path], {flag: "1"}
    for path in sorted(glob.glob(os.path.join(ROOT, "extensions", "*", "selftest.ts")) + glob.glob(os.path.join(ROOT, "patches", "*.selftest.ts"))):
        yield os.path.relpath(path, ROOT), [path], {}
    yield "patches/pi-coding-agent.patch.mjs --check", [os.path.join(ROOT, "patches", "pi-coding-agent.patch.mjs"), "--check"], {}


failed = []
for name, args, env in runs():
    result = subprocess.run(["node", "--no-warnings", "--import", "./scripts/pi-resolve.mjs", *args], cwd=ROOT, env={**os.environ, **env}, capture_output=True, text=True, encoding="utf-8", errors="replace")
    ok = result.returncode == 0
    print(f"{'ok  ' if ok else 'FAIL'} {name} {' '.join(env)}")
    if not ok:
        failed.append(name)
        print("\n".join((result.stdout + result.stderr).strip().splitlines()[-15:]))
print(f"{len(failed)} failed" if failed else "all self-checks passed")
sys.exit(1 if failed else 0)
