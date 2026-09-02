"""List Torrentio streams for a series episode, sorted by peers, filtered by resolution."""
import argparse, json, re, requests

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--imdb", required=True, help="IMDb ID, e.g. tt3581920")
    ap.add_argument("--s", type=int, required=True)
    ap.add_argument("--e", type=int, required=True)
    ap.add_argument("--res", default="2160p", help="resolution filter (default 2160p; use any for all)")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    url = f"https://torrentio.strem.fun/sort=qualitysize/stream/series/{a.imdb}:{a.s}:{a.e}.json"
    d = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"}).json()

    out = []
    for s in d.get("streams", []):
        t = s.get("title", "")
        if a.res != "any" and not re.search(r"2160|4K", t, re.I):
            continue
        m = re.search(r"\U0001F464 (\d+)", t)
        out.append({
            "peers": int(m.group(1)) if m else 0,
            "title": t,
            "hash": s.get("infoHash", ""),
        })
    out.sort(key=lambda x: -x["peers"])

    if a.json:
        print(json.dumps(out, ensure_ascii=False, indent=1))
    else:
        for i, o in enumerate(out):
            print(f"[{i}] peers={o['peers']:>3}  {o['title'][:110]}")
            print(f"    hash={o['hash']}")
    if not out:
        print("(no streams at this resolution — retry with --res any)")

if __name__ == "__main__":
    main()
