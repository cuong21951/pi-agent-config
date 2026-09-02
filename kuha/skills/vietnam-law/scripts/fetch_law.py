#!/usr/bin/env python
"""
fetch_law.py - fetch a legal document page from a Vietnamese legal database
and extract the main text plus its effectiveness status into a markdown file.

Usage:
    py -3.12 fetch_law.py <url> [--out file.md]
    py -3.12 fetch_law.py --search "<query>"

Supported sites (best-effort content extraction, falls back to largest text
block on any other site): vbpl.vn, thuvienphapluat.vn, luatvietnam.vn,
congbao.chinhphu.vn.

Known limits (see references/sources.md for the manual workaround):
  - vbpl.vn and thuvienphapluat.vn return HTTP 403 to this script's plain
    requests fetch (bot blocking). Use the agent's own fetch/browse tool on
    those URLs instead; this script will report the failure and say so.
  - luatvietnam.vn often renders but the full text is behind a paywall
    ("Please log in to your Advanced Package") for many documents.
  - congbao.chinhphu.vn pages usually expose ban hanh/hieu luc dates and
    metadata in the page, but the actual article-by-article text is only in
    a linked .pdf/.doc file, not in the page HTML - open that download link
    separately when the extracted body is mostly navigation text.

--search does not scrape search result pages (most legal sites block or
JS-render their search), it only prints ready-to-open search URLs for the
supported sites so the calling agent can open them with its own fetch tool.
"""

import argparse
import datetime
import re
import sys
import urllib.parse

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    sys.stderr.write(
        "Missing dependency. Install with:\n"
        "  py -3.12 -m pip install requests beautifulsoup4\n"
    )
    sys.exit(1)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# Known main-content containers per site, tried in order.
CONTENT_SELECTORS = [
    ("div", {"class": "toanvancontent"}),   # vbpl.vn
    ("div", {"id": "toanvancontent"}),      # vbpl.vn variant
    ("div", {"class": "content1"}),         # thuvienphapluat.vn
    ("div", {"class": "vb-content"}),       # thuvienphapluat.vn variant
    ("div", {"class": "content-noidung"}),  # luatvietnam.vn
    ("div", {"class": "article-content"}),  # luatvietnam.vn variant
    ("div", {"id": "divContentDoc"}),       # congbao.chinhphu.vn
    ("article", {}),
]

STATUS_LABELS = [
    "Tình trạng hiệu lực",
    "Ngày có hiệu lực",
    "Ngày ban hành",
    "Số hiệu",
    "Loại văn bản",
    "Cơ quan ban hành",
    "Văn bản thay thế",
    "Người ký",
]


def fetch(url: str) -> "requests.Response | None":
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "vi,en;q=0.8"}
    try:
        resp = requests.get(url, headers=headers, timeout=20)
    except requests.RequestException as exc:
        sys.stderr.write(f"Request failed: {exc}\n")
        return None
    if resp.status_code != 200:
        sys.stderr.write(f"HTTP {resp.status_code} for {url}\n")
        return None
    resp.encoding = resp.apparent_encoding or "utf-8"
    return resp


def find_title(soup: "BeautifulSoup") -> str:
    if soup.title and soup.title.string:
        return soup.title.string.strip()
    h1 = soup.find("h1")
    if h1:
        return h1.get_text(strip=True)
    return "(khong tim thay tieu de)"


def find_main_content(soup: "BeautifulSoup"):
    for tag, attrs in CONTENT_SELECTORS:
        node = soup.find(tag, attrs=attrs) if attrs else soup.find(tag)
        if node and len(node.get_text(strip=True)) > 200:
            return node
    candidates = soup.find_all(["div", "article", "section"])
    best = None
    best_len = 0
    for node in candidates:
        text_len = len(node.get_text(strip=True))
        if text_len > best_len:
            best = node
            best_len = text_len
    return best


def find_status_fields(soup: "BeautifulSoup") -> dict:
    found = {}
    full_text = soup.get_text("\n", strip=True)
    lines = full_text.split("\n")
    for i, line in enumerate(lines):
        for label in STATUS_LABELS:
            if label in found:
                continue
            if line.strip().rstrip(":").strip() == label:
                for j in range(i + 1, min(i + 3, len(lines))):
                    val = lines[j].strip()
                    if val:
                        found[label] = val
                        break
            elif line.strip().startswith(label + ":"):
                val = line.strip()[len(label) + 1:].strip()
                if val:
                    found[label] = val
    label_pattern = re.compile(
        r"(" + "|".join(re.escape(l) for l in STATUS_LABELS) + r")\s*[:：]\s*([^\n]{2,200})"
    )
    for match in label_pattern.finditer(full_text):
        label, val = match.group(1), match.group(2).strip()
        if label not in found and val:
            found[label] = val
    return found


def to_markdown(url: str, title: str, status: dict, body_text: str) -> str:
    fetched_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [f"# {title}", ""]
    lines.append("## Thong tin van ban")
    lines.append("")
    for label in STATUS_LABELS:
        val = status.get(label, "[khong tim thay tren trang]")
        lines.append(f"- **{label}**: {val}")
    lines.append(f"- **URL nguon**: {url}")
    lines.append(f"- **Da fetch luc**: {fetched_at}")
    lines.append("")
    lines.append("## Noi dung")
    lines.append("")
    lines.append(body_text)
    return "\n".join(lines)


def clean_text(node) -> str:
    for bad in node.find_all(["script", "style", "nav", "header", "footer"]):
        bad.decompose()
    text = node.get_text("\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text


def do_fetch(url: str, out_path: str | None):
    resp = fetch(url)
    if resp is None:
        print(
            "FAILED: could not retrieve the page (site may block automated "
            "requests, or require JavaScript / a login). Fallback: use the "
            "agent's own fetch_url / web browsing tool on this URL instead, "
            "or open it manually and copy the relevant article text."
        )
        sys.exit(2)

    soup = BeautifulSoup(resp.text, "html.parser")
    title = find_title(soup)
    status = find_status_fields(soup)
    main = find_main_content(soup)

    if main is None or len(clean_text(main)) < 100:
        print(
            "WARNING: could not confidently locate the main content block; "
            "the page may be JavaScript-rendered or blocked. Falling back "
            "to whole-page text extraction (may include menus/navigation)."
        )
        body_text = clean_text(soup.body) if soup.body else resp.text
    else:
        body_text = clean_text(main)

    md = to_markdown(url, title, status, body_text)

    if out_path:
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(md)
        print(f"Written to {out_path}")
        header_end = md.find("## Noi dung")
        print("\n--- Header block ---")
        print(md[:header_end].strip())
    else:
        print(md)


def do_search(query: str):
    q = urllib.parse.quote(query)
    print("Search URLs (open these with the agent's own fetch/browse tool):")
    print(f"- thuvienphapluat.vn : https://thuvienphapluat.vn/tim-van-ban.aspx?keyword={q}")
    print(f"- vbpl.vn            : https://vbpl.vn/pages/portal.aspx?s=1&Keyword={q}")
    print(f"- luatvietnam.vn     : https://luatvietnam.vn/tim-van-ban.html?SearchText={q}")
    print(f"- congbao.chinhphu.vn: https://congbao.chinhphu.vn/tim-kiem-van-ban?keyword={q}")
    print(
        "\nNote: scraping the search RESULT pages themselves is unreliable "
        "(JS rendering / anti-bot), so this script only builds the URLs. "
        "Use the agent's web fetch tool to open one, find the exact "
        "document link, then run:\n"
        "  py -3.12 fetch_law.py <document url> --out <file>.md"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", nargs="?", help="URL of the legal document page to fetch")
    parser.add_argument("--out", help="output markdown file path")
    parser.add_argument("--search", help="build search URLs instead of fetching a document")
    args = parser.parse_args()

    if args.search:
        do_search(args.search)
        return

    if not args.url:
        parser.print_help()
        sys.exit(1)

    do_fetch(args.url, args.out)


if __name__ == "__main__":
    main()
