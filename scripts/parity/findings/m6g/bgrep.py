import mmap, os, sys

path = os.environ.get("PARITY_CLAUDE") or sys.exit("PARITY_CLAUDE unset")
needle, before, after, limit = sys.argv[1].encode(), int(sys.argv[2]) if len(sys.argv) > 2 else 200, int(sys.argv[3]) if len(sys.argv) > 3 else 400, int(sys.argv[4]) if len(sys.argv) > 4 else 5
with open(path, "rb") as f:
    m = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
    at, n = m.find(needle), 0
    while at >= 0 and n < limit:
        text = m[max(0, at - before):at + len(needle) + after].decode("utf-8", "replace")
        sys.stdout.write(f"@{at}\n{text}\n-----\n")
        at, n = m.find(needle, at + 1), n + 1
