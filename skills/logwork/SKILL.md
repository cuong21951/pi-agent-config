---
name: logwork
description: Log Cuong's daily TimeBlockr timesheet into the monthly Google Sheet (tab Cuong, one ADO work-item URL + 8h per workday) through the timesheet-api Apps Script web app that runs as cuong.nguyen@nscsoftware.com - no browser, no MCP, no sharing. Use when the user says logwork, log work, timesheet, điền timesheet, chấm công, "log hôm qua", "backfill", or asks which days are still open.
---

# logwork

Tool: `py -3.12 C:\Users\cuong\.claude\scripts\logwork.py` (PYTHONUTF8 is set globally; if Vietnamese output crashes, prefix `PYTHONUTF8=1`).
Backend: Apps Script project `timesheet-api` in the work account, deployed as web app (execute as Cuong, token-guarded). Config `~/.secrets/timesheet-api.json`. It finds `Timesheet_TimeBlockr_Core_<MMM>_<yyyy>` in Cuong's Drive by name, so a new month needs nothing.

## Flow

1. `logwork.py status` → rows marked `OPEN` need logging (`OFF` = holiday from `vn-holidays.txt`, never log; `done` = leave alone).
2. For each OPEN date, oldest first: `powershell -NoProfile -File C:\Users\cuong\.claude\scripts\trace-day.ps1 -Date yyyy-MM-dd`.
3. Pick the ADO work item that dominated the day. Rank breadth AND volume together: commits naming a ticket (count them), PRs created/pushed, ticket-investigation file volume and time span, Claude session mention counts, ADO items changed. Rules:
   - One commit never outranks the ticket owning the day's file volume, sessions and mentions.
   - A lone ADO state change is the weakest signal, never the tiebreaker.
   - Build artifacts (.cache, .dll, obj/, bin/) are noise, not volume.
   - 00:00-04:00 activity belongs to the previous workday; post-21:00 evidence counts for less.
   - No evidence at all → leave the row empty and report `NO EVIDENCE - ask Cuong`. Never invent a ticket.
4. `logwork.py log yyyy-MM-dd <workitem-id>` → prints `total X -> Y`; Y must be X+8. The script refuses already-filled rows and holiday rows (`--force` only when Cuong explicitly asks to overwrite).
5. Report one line per date: date, row, work item, alternatives passed over and why.

## Day off

Add `yyyy-MM-dd  # reason` to `C:\Users\cuong\.claude\scripts\vn-holidays.txt`; the loop and the script both skip it. A deleted row is otherwise indistinguishable from an unfilled one.

## Failures

- `SHEET MISSING: <name>` → Chau Tran has not created the month's file yet; stop and tell Cuong.
- `bad token` → `~/.secrets/timesheet-api.json` token differs from the TOKEN script property (script.google.com → timesheet-api → Project Settings).
- Code changes to `~/.claude/scripts/timesheet-api.gs` need a new deployment version (Deploy → Manage deployments → edit → New version); the URL stays.
