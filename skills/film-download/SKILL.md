---
name: film-download
description: Download 4K/2160p TV series episodes via Torrentio + libtorrent (anti_piracy_verifier.py), install Vietnamese subtitles from subf2m.co, play in Kodi or MPC-HC. Use when the user asks to download/tải/kiếm a TV series episode or season in 4K/2160p, resume stalled downloads, add Vietnamese subs to downloaded episodes, or open a downloaded episode in Kodi/MPC-HC.
---

# film-download

Pipeline: Torrentio → pick 2160p release → .torrent with HTTP trackers → libtorrent download → verify → Vietnamese subs (subf2m) → play (Kodi).

## Environment (Cuong's machine, fixed)

- Python 3.12 + libtorrent: `py -3.12` (`C:\Users\cuong\AppData\Local\Programs\Python\Python312\python.exe`)
- Download tool: `C:\Users\cuong\Downloads\Telegram Desktop\anti_piracy_verifier.py`
- Torrents/logs dir: `C:\Users\cuong\Downloads\torrents\`
- Videos root: `C:\Users\cuong\Videos\`
- Skill scripts: `scripts\` in this skill dir — always run with `PYTHONIOENCODING=utf-8 py -3.12 <script>` (Unicode release names crash the cp1252 console otherwise)

## Step 1 — IMDb ID

Web-search if unknown (e.g. The Last of Us = `tt3581920`).

## Step 2 — Find release

```
PYTHONIOENCODING=utf-8 py -3.12 scripts\torrentio.py --imdb tt3581920 --s 1 --e 6
```

Pick the 2160p stream with the most peers. Preferences:
- Per-episode WEB-DL releases (NTb/eztv family) over season packs when both exist.
- Avoid RARBG-era season packs with no HTTP-tracker peers — they stall at 0% (e.g. SMURF pack).
- REMUX = best quality but 3-4x the size; fine when the user wants the best.
- Always print the `hash` (infoHash) for the next step.

## Step 3 — .torrent from hash

```
PYTHONIOENCODING=utf-8 py -3.12 scripts\magnet_to_torrent.py <40-char-hash> <out.torrent>
```

Adds opentrackr/dler/bt4g HTTP (TCP) trackers — the ISP throttles UDP to P2P ports; TCP trackers bypass the filter. The tool itself does NOT add trackers, so they must be in the .torrent.

## Step 4 — Download (detached!)

```
powershell Start-Process <py-3.12-path> -ArgumentList ('"C:\Users\cuong\Downloads\Telegram Desktop\anti_piracy_verifier.py"'),'--torrent-file','C:\Users\cuong\Downloads\torrents\<x>.torrent','--download','--file-pattern','S01E06','--output','C:/Users/cuong/Videos/<Show>/S01' -RedirectStandardOutput <log> -RedirectStandardError <err> -WindowStyle Hidden
```

- MUST launch via Start-Process (detached): background processes die when the launching session ends.
- Season packs need `--file-pattern` to pick the episode file; single-file torrents don't.
- Log to `C:\Users\cuong\Downloads\torrents\`.
- Check the log's `Target file:` line right after launch — a failed pattern silently falls back to the largest file (this wasted a full E01 download before). Stop and re-run with a correct pattern if it picked the wrong file.
- Parallel sessions (one per episode) beat sequential on thin swarms; ISP throttle is cyclic (fast 5-8 MB/s, slow 0.4 MB/s) — patience.

## Step 5 — Verify

The tool prints `[+] Verification OK` on completion. Check the log tail. Only episode files (`S01E0\d`) count; screenshots/.txt are priority-0 and never downloaded.

## Step 6 — Vietnamese subtitles

```
PYTHONIOENCODING=utf-8 py -3.12 scripts\subf2m_vie.py --title "the last of us" --season 1 --dir "C:\Users\cuong\Videos\TheLastOfUs\S01" --list
```

- `--list` shows entries (id, episode coverage, uploader, sample files). Prefer entries whose filenames match the release type (HMAX WEB-DL for WEB-DL downloads, BluRay Remux for REMUX).
- Then download+place: `--id <id>` (drop `--list`). Place = each .srt copied next to its matching .mkv (same base name) — players auto-load same-name subs. Files land in subfolders; the script matches recursively.
- Timing note: WEB-DL subs ≈ WEB-DL videos; BluRay Remux subs ≈ REMUX videos.

## Step 7 — Play

- Kodi: `Start-Process 'C:\Program Files\Kodi\kodi.exe' -ArgumentList '"<mkv path>"'`
- MPC-HC: `Start-Process 'C:\Program Files (x86)\K-Lite Codec Pack\MPC-HC64\mpc-hc64.exe' -ArgumentList '"<mkv path>"'`
- 4K HEVC 10-bit needs Kodi or MPC-HC+LAV (hardware decode); Windows Media Player stutters.

## Memory

Full history and gotchas: `C:\Users\cuong\.claude\projects\C--Users-cuong-OneDrive-Documents-Global-Computer\memory\torrent-4k-pipeline.md`
