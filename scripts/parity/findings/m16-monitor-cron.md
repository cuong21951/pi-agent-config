# M16 investigate: Monitor, CronCreate/List/Delete, ScheduleWakeup, /loop (Claude 2.1.310)

Read-only bundle reading of `claude-2.1.310.exe` (Bun bundle, offsets are file offsets; scripts in `%TEMP%\pi-parity\discovery\m16a\`: `ctx.py` anchor+context, `rng.py` raw range, `body.py` range minus imports). No claude/pi/suite was run, so nothing here is a screen capture. "needs capture" = the code names a helper whose output I did not resolve, or a layout the code does not settle.

Prior measurement (README line 110, `m6f-measure5`, 2.1.283): `● CronCreate(*/1 * * * *: say tick)` / `⎿ Scheduled <id> (Every minute)`; CronList `⎿ <id> Every minute (recurring) [session-only]: …`; ScheduleWakeup has no row; fire `✻ Running scheduled task (Sep 29 12:40am)` then the done line. No capture files for these survive in `findings/` or `scenarios/` (only README text). The 2.1.310 code agrees with all of it, and adds the points below.

Minified names are local to a chunk and change per build: `Ws` = Monitor, `Lp` = CronCreate, `Kv` = CronDelete, `X0e` = CronList, `tl` = ScheduleWakeup, `Fd` = TaskStop, `ze` = the `⎿` result wrapper, `ko` = tool dot, `vA`/`Uw`/`kA` = glyphs from chunk-kqre8gz8 (vA is the `✻` of the fire row per the 283 capture; not resolved in code).

## Result-row dispatch table (one place for all of it)

Offset 254850 (chunk of the renderer table `Wf`, source text in `rend_mod.txt`):
```
[Lp]:{renderToolResultMessage:FT},[Kv]:{renderToolResultMessage:jT},[X0e]:{renderToolResultMessage:WT}, ... [Ws]:{renderToolResultMessage:ST}   (ST entry at 255600)
```
Renderers at 279393072-279397900 (`ST` Monitor, `FT` CronCreate, `jT` CronDelete, `WT` CronList, `HT` next-run suffix). ScheduleWakeup (`tl`) has NO entry in the table.

## 1. Monitor (`Ws`, name "Monitor")

Anchors: `Ws="Monitor"` @248843077; tool object `name:Ws` @261204531 (module 261189427-261206677, text in `mon_mod.txt`); prompt builders @252811192 (`mon_prompt.txt`); defaults `O7e=300000, Rcn=3600000` @252810707; `Monitor started` renderer @279393072; event notification text `rYt='Monitor event: "'` @243886130; `sV()` event emitter @261177457; `ZHr` expiry text @252811192.

### Schema the model sees
- name `Monitor`, deferred (`shouldDefer:true`, found through ToolSearch; searchHint "watch, monitor, or keep an eye on a process/log/command or WebSocket — stream each stdout line as a live notification").
- input: `description` (string, "Short human-readable description of what you are monitoring (shown in notifications)."), `timeout_ms` (number, min 1000, default 300000, max 3600000; "Kill the monitor after this deadline. Default 300000ms, max 3600000ms. Ignored when persistent is true."), `persistent` (bool, default false; "Run for the lifetime of the session (no timeout)... Stop with TaskStop."), `command` ("Shell command or script. Each stdout line is an event; exit ends the watch."), `ws` ({url ws:// or wss://, protocols[]}; exactly one of command / ws; refine message `exactly one of command or ws`). Another branch (flag `tengu_breezy_crescent`, default true, fn `Nde`) drops `persistent` and caps `timeout_ms` at 3600000 ("Deadlines above Nms are capped"; "You are notified at expiry and can re-arm").
- description/prompt (`INo()+ONo()`): starts `Start a background monitor that streams events from a long-running script. Each stdout line is an event — you keep working and notifications arrive in the chat.` then "Pick by how many notifications you need" (one: foreground/`run_in_background` Bash with `until grep -q ...`; per occurrence: Monitor with `tail -f`, `inotifywait -m`, `while true`), script quality, coverage ("silence is not success"), output volume ("Monitors that produce too many events are automatically stopped"), "Stdout lines within 200ms are batched into a single notification", "Use TaskStop to cancel early". Full text is in `mon_prompt.txt` (about 6 KB).
- tool_result text to the model: `Monitor started (task <id>, <r>). You will be notified on each event. Keep working — do not poll or sleep. Events may arrive while you are waiting for the user — an event is not their reply.` with `<r>` = `expires in 5m unless the source ends first; you get one notice at expiry — re-arm if you still need the watch` (default branch), `persistent — runs until TaskStop or session end` or `timeout 300000ms`.
- permission: ask via the shell permission path (Bash-like dashed-line dialog since 2.1.286, see claude-drift-289.md); websocket variant asks `Monitor will open a WebSocket to <url>`.

### Call row
- `userFacingName()` = `Monitor`; `renderToolUseMessage(e)` = `e.description` (null when empty). So `● Monitor(errors in deploy.log)`. Activity text `Monitoring: <desc>`; `getToolUseSummary` = description cut to `_A` columns.
- Result row (`ST`): `⎿ Monitor started · task <taskId> · timeout 300s` where `Monitor started` is default colour and everything from `·` is dim; persistent shows `persistent` in place of `timeout Ns` (`m.timeoutMs/1000`).

### Streamed events (task-notification messages)
- Each batch (stdout lines within 200 ms, `he=200`; per-event cap `I=500`/`P=3000` chars) calls `sV(description, text, taskId)` which queues a `task-notification` whose summary is `Monitor event: "<description>"` and body `<event>…</event>`.
- Row (`Hs`→`wp`→`Cp`, 279461800): when the summary starts `Monitor event: "` and ends `"`, `Tp()` parses it; collapsed form is ONE line, `wrap:"truncate-end"`, `marginTop:1` if it follows something:
  `<ko in status colour> Monitor event: <headline><dim ` · <description>`>`.
  - headline = first non-empty line of the event body, cut to 500 chars then to the row width (`Mp`: width - len("Monitor event:") - 1); the ` · description` tail is dropped unless at least 12 columns remain (`fA=12`) and is truncated to fit.
  - dot colour from `Jy(status)`: completed success, failed error, killed warning, anything else (monitor events carry no status) plain `text`.
  - ctrl+o expanded (`isExpanded`): same first line, plus the event body (up to 4000 chars, `gA`) in `paddingLeft:2`, dim.
- Non-event notifications (stopped/ended) use the generic summary row `wp`: `<ko in status colour> <summary>[ · duration]`, expanded shows nothing extra. Texts (`l7n`, 257934202): `Monitor "<desc>" stream ended` (completed, success colour), `Monitor "<desc>" ended without producing output (exit N)`, `Monitor "<desc>" script failed (exit N)` (error colour), `Monitor "<desc>" stopped` (killed, warning colour). TaskStop by the user: `Task "<desc>" was stopped by the user`.
- Expiry / housekeeping notices are sent through the same `sV` as events, so they show as `● Monitor event: [Monitor expired after 5m with 3 events delivered. Re-arm it if you still need the watch.]` (0 events: `[Monitor expired after 5m with no events delivered. Re-arm it if you still need the watch — and widen the filter if silence was unexpected.]`; old branch `[Monitor timed out — re-arm if needed.]`). Rate limit: `[N events suppressed — output rate too high. Consider using TaskStop to restart this monitor with a more selective filter.]`.
- Flag `transcriptV2Rows` (`ino`): a different layout (`je` row component) for the same data; default unknown, needs capture.

### Elsewhere
- Footer pill / task list: monitors count separately, `1 monitor` / `N monitors`, joined with shells as `1 shell, 1 monitor` (@263789418). Tasks dialog row label = the monitor description; detail dialog title `Monitor details` (vs `Shell details`) @280973959, status `running` in `background` colour.
- Needs capture: exact indentation of the expanded body, the pill text in the footer (glyph prefix), the permission dialog wording for Monitor, whether `ctrl+o` collapses consecutive events.

Confidence: schema and strings high (read from source); row layout medium-high; colours by theme key: only `success`/`error`/`warning`/`background` and dim are named in code.

## 2. Cron tools

Anchors: names `Lp="CronCreate",Kv="CronDelete",X0e="CronList"` @252589725 (module text `cron_mod.txt`); tool objects CronCreate @278590000 (`cron_tools.txt`), CronDelete @278601622, CronList @278441846 (`name:X0e`). Feature gate `tengu_kairos_cron` default true, off with `CLAUDE_CODE_DISABLE_CRON`; durable crons gate `tengu_kairos_cron_durable`. All three: `shouldDefer:true` (loaded through ToolSearch), `backgrounding:"never"`.

### CronCreate
- Input: `cron` ("Standard 5-field cron expression in local time: "M H DoM Mon DoW" (e.g. "*/5 * * * *" = every 5 minutes, "30 14 28 2 *" = Feb 28 at 2:30pm local once)."), `prompt` ("The prompt to enqueue at each fire time."), `recurring` (bool, default true; "false = fire once at the next match, then auto-delete"), `durable` (bool; "false (default) = in-memory only... true = persist to .claude/scheduled_tasks.json"). When durable is unavailable the durable text is "Has no effect — durable persistence is not available. All jobs are session-only".
- Description: `Schedule a prompt to run at a future time within this Claude session — either recurring on a cron schedule, or once at a specific time.` Prompt (`ENo`): one-shot vs recurring examples, "Avoid the :00 and :30 minute marks", Session-only/Durability, "Not for live watching ... use the Monitor tool", "Recurring tasks auto-expire after 7 days" (`recurringMaxAgeMs=604800000`), jitter (recurring up to 50% of period late, max 30 min; one-shot on :00/:30 up to 90 s early), "Returns a job ID you can pass to CronDelete".
- Limits and errors: max 50 jobs (`Too many scheduled jobs (max 50). Cancel one first.`), `Invalid cron expression '<x>'. Expected 5 fields: M H DoM Mon DoW.`, `Cron expression '<x>' does not match any calendar date in the next year.`
- Result text to model: `Scheduled recurring job <id> (Every minute). Next run: <Mon D h:mma>. Session-only (not written to disk, dies when Claude exits). Auto-expires after 7 days. Use CronDelete to cancel sooner.` One-shot: `Scheduled one-shot task <id> (<human>). ... It will fire once then auto-delete.`
- Call row: `userFacingName` default = `CronCreate`; `renderToolUseMessage` = `<cron>: <prompt cut to 60 chars with ellipsis>` => `● CronCreate(*/1 * * * *: say tick)` (matches the 283 capture).
- Result row (`FT`): `⎿ Scheduled <bold id> <dim (<humanSchedule>[, next run <date>])>`. `HT` adds `, next run ` + a date formatter (`Y$e`, chunk-zk43qffc, output NOT resolved; the 283 capture shows no next-run part, so either the formatter returns empty or 310 added it). Needs capture.
- humanSchedule (`hx` in cron module): `*/N * * * *` => `Every N minutes` (N=1 `Every minute`), `M * * * *` => `Every hour` / `Every hour at :MM`, `M */N * * *` => `Every N hours[ at :MM]`, `M H * * *` => `Every day at <time>`, `M H * * D` => `Every <Weekday> at <time>`, `1-5` => `Weekdays at <time>`, anything else shows the raw cron.

### CronList
- Input: none. Description `List scheduled cron jobs` / prompt `List all cron jobs scheduled via CronCreate in this session.` Read-only, concurrency-safe.
- Result text to model: `<id> — <human> (recurring|one-shot)[ [session-only]], next run <date>: <prompt cut to 80>` per line, or `No scheduled jobs.`
- Call row: `renderToolUseMessage` returns `""` so `● CronList()` or `● CronList` depending on the empty-args rule (needs capture; 283 not recorded).
- Result row (`WT`): empty => `⎿ No scheduled jobs` (dim via `Lo`). Else one line per job inside a column: `<bold id> <dim `<human> (recurring)|(one-shot)[ [session-only]], next run <date>: <prompt cut to 60>`>`. Matches the 283 capture `<id> Every minute (recurring) [session-only]: …`. Note the id is bold, rest dim; recurring flag text is `(recurring)`/`(one-shot)`, `[session-only]` only when `durable===false`.

### CronDelete
- Input `id` ("Job ID returned by CronCreate."). Description `Cancel a scheduled cron job by ID`. Errors: `No scheduled job with id '<id>'`, `Cannot delete cron job '<id>': owned by another agent`.
- Result text `Cancelled job <id>.`; call row `● CronDelete(<id>)`; result row (`jT`) `⎿ Cancelled <bold id>`.

### Scheduled task fire
- Hook `useScheduledTasks` (module 290735093 region, `he()`): fires only when the REPL is idle; queues the cron `prompt` as a hidden meta user prompt (`isMeta:true`, `modelScheduledOrigin`, `priority:"later"`, `wakeupSource:"schedule_wakeup"`) and, for a normal cron, first appends a system message `EKn("Running scheduled task (<fOe(now)>)", ...)` (subtype `scheduled_task_fire`, @258187831).
- `fOe` (date): `toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})`, comma/"at" replaced by a space, AM/PM lowercased, no space before it => `Sep 29 12:40am`.
- Row: `scheduled_task_fire` system line, dim: `<vA glyph> <content>` (legacy path @279554180: `dimColor`, `marginTop:1` when it follows content, glyph `aria-hidden`); new-rows path (`tu`, @279411171) = `Sn("dim", content, {maxChars:1000})` i.e. a dim system line, extra lines kept up to 5 then `… +N more lines`. 283 capture: `✻ Running scheduled task (Sep 29 12:40am)`. The model's turn then renders as usual (the hidden prompt itself is not drawn).
- Loop-kind crons (`n.kind==="loop"`, created by `/loop 5m ...`) do not append `Running scheduled task`; they replace the transcript via `D()` which appends `Claude resuming /loop wakeup (<date>)`. Empty-prompt loop placeholders render the prompt as `/loop` or `/loop (loop.md)`.
- Missed one-shot tasks while the REPL was closed are surfaced for catch-up (durable only).

Confidence: tool contracts and result texts high; call/result rows high (matches 283 capture); next-run suffix format and CronList empty-args call row need capture.

## 3. ScheduleWakeup (`tl`)

Anchors: tool `name:tl` inside module 261956904-262116503, input schema at `is=p(()=>Ue({delaySeconds` (~262000000; extracted to `sw_tool.txt`), prompt `QVs`/`a,n,i,r,h,u` @251441343 (`sw_prompt.txt`), error class `ScheduleWakeupInputError`, fold logic in useScheduledTasks module (`D()`, `w()`, `A()`) @290735093, cancel notice @280732459.

- Not deferred (`shouldDefer:false`); only meaningful in dynamic /loop. Description: `Schedule when to resume work in /loop dynamic mode (always pass the \`prompt\` arg unless stopping). Call before ending the turn to keep the loop alive; call with \`stop: true\` to end the loop immediately.`
- Input: `delaySeconds` ("Seconds from now to wake up. Clamped to [60, 3600] by the runtime. Required unless `stop` is true."), `reason` ("One short sentence explaining the chosen delay. Goes to telemetry and is shown to the user. Be specific."), `prompt` (the /loop input verbatim, or the sentinel for an autonomous loop), `stop` (bool, ends the loop), `noop` (bool, "true = nothing changed"; consecutive true ticks are collapsed in the terminal view). Errors: "`delaySeconds` and `reason` are required when `stop` is not true.", "`prompt` is required...", "`noop` is required...".
- Prompt text: `Schedule when to resume work in /loop dynamic mode — the user invoked /loop without an interval, asking you to self-pace iterations...`, then "Picking delaySeconds" (cache-window advice: 60-270 s keeps the cache, "Don't pick 300s", idle default 1200-1800 s, runtime clamps to [60, 3600]; three variants chosen by cache TTL), "The reason field", and the noop paragraph (`sw_prompt.txt`).
- Result text to model: `Next wakeup scheduled for HH:MM:SS (in Ns)[ (clamped to Ns from your requested value)]. ...`; stop: `Loop stopped — cancelled N pending wakeup(s); no further dynamic-loop wakeups scheduled. If you armed a Monitor for this loop, TaskStop it now...`; max duration: `Wakeup not scheduled. The loop reached its maximum duration — the loop has ended; do not re-issue.`
- **Call row: none.** `userFacingName()` returns `""` and `renderToolUseMessage()` returns null; there is no result renderer in the table. So the transcript shows no `● ScheduleWakeup(...)` and no `⎿` (README 283 note "no row of its own" holds). The `reason` is "shown to the user" per the description, but I found no renderer that draws it; maybe the status/footer or the wakeup fire message. Needs capture.
- Wakeup fire (dynamic loop): system message `Claude resuming /loop wakeup (<Mon D h:mma>)` (subtype `scheduled_task_fire`, `cronKind:"loop"`, same dim `✻ ` row as above). Hidden prompt queued with `wakeupSource:"loop_wakeup"`.
- No-op fold: if the previous tick ended with `ScheduleWakeup(noop:true)` and nothing foreign happened, the previous fire's span is removed from the view (`Pm()` filters `foldedUuids`) and the new row reads `Claude resuming /loop wakeup (<date>) · N no-op ticks since <date>` (N=1 singular `tick`); a meta line `[N prior /loop wakeups found nothing actionable; loop is healthy.]` goes to the model. Vetoes (tool denial, foreign user input, queued command, compact boundary, `model_reported_work`) show the plain row.
- `Pending wakeup cancelled`: constant `zHt` with key `XWe="loop-wakeup-cancelled"` @280732459. Fired from the Esc/ctrl+c cancel handler (`Bae`): when `Cbr()>0` (pending wakeups cancelled by this press) it posts a transient feedback notification `{key:"loop-wakeup-cancelled", kind:"feedback", text:"Pending wakeup cancelled", priority:"immediate", timeoutMs:8000}` into the notification slot (same slot as `agents-parked`, `● high · /effort`). Colour: none given in the call (default feedback colour); position same as other `feedback` notices. Needs capture for colour and placement.

Confidence: schema, texts, fold logic high; no-row claim high (code); wakeup fire row high (string) / glyph medium; Pending wakeup cancelled colour low.

## 4. /loop slash command

Anchor: skill registration `name:fwt ... menuDescription:"Repeat a prompt or command on an interval (e.g. /loop 5m /foo)"` @283170272 (`loop_skill.txt`). It is a bundled skill, not a built-in command: `aliases:["proactive"]`, `argumentHint:"[interval] [prompt]"`, `userInvocable:true`, `argsMayContainSlashCommands:true`, enabled with the cron gate. Skill description: `Run a prompt or slash command on a recurring interval (e.g. /loop 5m /foo). Omit the interval to let the model self-pace.` whenToUse: `When the user wants to set up a recurring task, poll for status, or run something repeatedly on an interval (e.g. "check the deploy every 5 minutes", "keep running /babysit-prs"). Do NOT invoke for one-off tasks.`

Prompt body (what the model gets; trimmed): `# /loop — schedule a recurring or self-paced prompt` / `Parse the input below into [interval] <prompt…> and schedule it.` Parsing: leading `^\d+[smhd]$` token, trailing `every <N><unit>`, else dynamic. Empty prompt => `show usage \`/loop [interval] <prompt>\``. Fixed interval: convert to cron (`5m` => `*/5 * * * *`, `1h` => `0 * * * *`, `1d` => `0 0 * * *`, `s` rounds up to a minute), call CronCreate with `recurring:true`, confirm (what's scheduled, cron, cadence, 7-day expiry, CronDelete with job ID), then run the prompt immediately. Dynamic (no interval): run the prompt now, optionally arm a Monitor for event-gated waits, then call ScheduleWakeup with 1200-1800 s fallback, `reason`, same `prompt`, `noop`; stop with `stop:true` and TaskStop any Monitor. With no prompt at all it schedules the "autonomous default" (sentinel prompts `P7e` for cron, `eDe` for dynamic) or `loop.md` tasks.

Transcript: a user-invocable skill typed in the prompt draws as the normal slash command user row (`❯ /loop 5m check the deploy` in the user-message background), then the model's turn (CronCreate row, confirmation text, first run). Exact skill-load row (`Skill(loop)`? / `Successfully loaded skill`?) needs capture. The `/loop` entry in the slash menu uses menuDescription above and the `proactive` alias.

Confidence: text high; transcript form for a typed `/loop` needs capture.

## What pi would have to build (for M16 scoping)

- Tools: `Monitor` (command streaming with 200 ms batching, timeout/persistent, TaskStop integration), `CronCreate`/`CronList`/`CronDelete` (in-session timers, idle-only fire, 50 job cap, 7-day expiry, jitter), `ScheduleWakeup` (hidden rows, clamp [60,3600]), `/loop` skill text as above.
- Renderers: four result rows (`Monitor started · task … · timeout Ns`, `Scheduled <id> (<human>…)`, `Cancelled <id>`, the CronList lines), the single-line `● Monitor event: <headline> · <description>` row with ctrl+o body, the `Monitor "<desc>" stream ended/stopped/script failed` rows, the dim `✻ Running scheduled task (<date>)` / `✻ Claude resuming /loop wakeup (<date>) · N no-op ticks since <date>` rows, the `1 monitor` footer pill, and the `Pending wakeup cancelled` 8 s notice.
- Needs capture before building: CronList empty-arg call row, next-run suffix format in `FT`, ScheduleWakeup `reason` display, `Pending wakeup cancelled` colour, expanded Monitor body indent, typed `/loop` row.
