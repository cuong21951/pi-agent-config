"""Find Vietnamese subtitles on subf2m.co and place .srt files next to matching .mkv.

Usage:
  subf2m_vie.py --title "the last of us" --season 1 --dir <episodes dir> --list
  subf2m_vie.py --slug <season-slug> --id <entry-id> --dir <episodes dir>

--list shows candidate entries; --id downloads one entry and places its .srt files.
"""
import argparse, io, os, re, requests, sys, zipfile

BASE = "https://subf2m.co"
UA = {"User-Agent": "Mozilla/5.0"}


def get(url):
    r = requests.get(url, headers=UA, timeout=30)
    r.raise_for_status()
    return r.text


def find_slug(title, season):
    html = get(f"{BASE}/subtitles/searchbytitle?query={requests.utils.quote(title)}")
    links = set(re.findall(r'href="(/subtitles/[a-z0-9-]+)"', html))
    best, best_score = None, 0
    for l in links:
        low = l.lower()
        score = 0
        if season == 1 and ("first-season" in low or "season-one" in low):
            score += 3
        if f"season-{season}" in low:
            score += 3
        if "season" in low:
            score += 1
        if score > best_score:
            best, best_score = l, score
    if not best:
        print("No season slug found; candidates:", sorted(links))
        sys.exit("pass --slug explicitly")
    return best.split("/subtitles/")[-1]


def list_entries(slug):
    html = get(f"{BASE}/subtitles/{slug}/vietnamese")
    out = []
    for b in re.split(r"class='item ", html)[1:]:
        m = re.search(r"href='(/subtitles/[^']*vietnamese/(\d+))'", b)
        if not m:
            continue
        files = re.findall(r"<li>([^<]+)</li>", b)
        eps = sorted(set(re.findall(r"S\d+E(\d+)", " ".join(files))))
        by = re.search(r"<b>By\s*<a[^>]*>\s*([^<]+?)\s*</a>", b, re.S)
        out.append({"id": m.group(2), "eps": eps, "files": files[:2],
                    "by": by.group(1) if by else ""})
    return out


def download_and_place(slug, eid, outdir):
    url = f"{BASE}/subtitles/{slug}/vietnamese/{eid}/download"
    r = requests.get(url, headers=UA, timeout=60, allow_redirects=True)
    r.raise_for_status()
    zf = zipfile.ZipFile(io.BytesIO(r.content))

    vids = []
    for dp, _, fn in os.walk(outdir):
        for f in fn:
            if f.lower().endswith(".mkv") and not f.lower().endswith(".parts"):
                vids.append(os.path.join(dp, f))
    if not vids:
        print("No .mkv files under", outdir)
        return 0

    placed, skipped = [], []
    for name in zf.namelist():
        if not name.lower().endswith(".srt"):
            continue
        m = re.search(r"S\d+E(\d+)", name)
        if not m:
            skipped.append(name)
            continue
        ep = m.group(1)
        vid = next((v for v in vids if re.search(rf"S\d+E{ep}(?!\d)", os.path.basename(v))), None)
        if not vid:
            skipped.append(name)
            continue
        target = os.path.splitext(vid)[0] + ".srt"
        with open(target, "wb") as f:
            f.write(zf.read(name))
        placed.append((ep, os.path.basename(target)))
    for ep, t in sorted(placed):
        print("placed:", ep, "->", t)
    for s in skipped:
        print("skipped (no matching episode file):", s)
    return len(placed)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", help="show title for slug auto-discovery")
    ap.add_argument("--season", type=int, help="season number for slug heuristic")
    ap.add_argument("--slug", help="season page slug, e.g. the-last-of-us-first-season")
    ap.add_argument("--id", help="entry id to download")
    ap.add_argument("--dir", help="episodes dir; without it, entries are only listed")
    ap.add_argument("--list", action="store_true", help="list entries and exit")
    a = ap.parse_args()

    if not a.slug:
        if not a.title:
            sys.exit("need --slug or --title")
        a.slug = find_slug(a.title, a.season or 1)

    entries = list_entries(a.slug)
    print(f"entries on /subtitles/{a.slug}/vietnamese:")
    for e in entries:
        print(f"  id={e['id']} eps={','.join(e['eps']) or '?'} by={e['by']}")
        for f in e["files"]:
            print(f"      {f}")
    if a.list or not a.id:
        return

    if not a.dir:
        sys.exit("--dir required to place .srt files")
    n = download_and_place(a.slug, a.id, a.dir)
    print(f"placed {n} subtitle files")


if __name__ == "__main__":
    main()
