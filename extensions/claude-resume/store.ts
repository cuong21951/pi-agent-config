export interface ResumeEntry {
	path: string;
	cwd: string;
	created: Date;
	modified: Date;
	messageCount: number;
	firstMessage: string;
	allMessagesText: string;
	name?: string;
	parentSessionPath?: string;
}

export type ResumeScope = "project" | "everywhere";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

function plural(n: number, unit: string): string {
	return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

export function formatRelativeTimeLong(nowMs: number, thenMs: number): string {
	const diff = Math.max(0, nowMs - thenMs);
	if (diff < MINUTE) return "just now";
	if (diff < HOUR) return plural(Math.floor(diff / MINUTE), "minute");
	if (diff < DAY) return plural(Math.floor(diff / HOUR), "hour");
	if (diff < WEEK) return plural(Math.floor(diff / DAY), "day");
	if (diff < MONTH) return plural(Math.floor(diff / WEEK), "week");
	if (diff < YEAR) return plural(Math.floor(diff / MONTH), "month");
	return plural(Math.floor(diff / YEAR), "year");
}

export function formatSize(bytes: number): string {
	return `${(bytes / 1024).toFixed(1)}KB`;
}

const SYSTEM_REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g;
const SUBAGENT_NAME = /#[0-9a-f]{8}$/;

export function displayTitle(entry: Pick<ResumeEntry, "firstMessage">): string {
	const title = entry.firstMessage.replace(SYSTEM_REMINDER, " ").replace(/\s+/g, " ").trim();
	return title === "" ? "(no messages)" : title;
}

export function isSubagentSession(entry: Pick<ResumeEntry, "name" | "parentSessionPath">): boolean {
	return entry.parentSessionPath !== undefined && SUBAGENT_NAME.test(entry.name ?? "");
}

export const ENTRY_HEIGHT = 3;

export function visibleEntryCount(listRows: number): number {
	return Math.max(1, Math.floor((listRows + 1) / ENTRY_HEIGHT));
}

export function windowStart(top: number, selected: number, visible: number): number {
	if (selected < top) return selected;
	if (selected >= top + visible) return selected - visible + 1;
	return top;
}

export function metaLine(entry: ResumeEntry, now: number, branch: string, sizeBytes: number): string {
	return `${formatRelativeTimeLong(now, entry.modified.getTime())} \xB7 ${branch} \xB7 ${formatSize(sizeBytes)} \xB7 ${entry.cwd}`;
}

export function matchesSearch(entry: ResumeEntry, query: string): boolean {
	return query === "" || entry.allMessagesText.toLowerCase().includes(query.toLowerCase());
}

export function filterResumeEntries(entries: readonly ResumeEntry[], query: string): ResumeEntry[] {
	return entries.filter((entry) => matchesSearch(entry, query));
}

export function scopeHint(scope: ResumeScope, hasResults: boolean): string {
	const a = scope === "project" ? "Ctrl+A to show all projects" : "Ctrl+A to only show current repo";
	const rest = hasResults ? ["Ctrl+B to only show current branch", "Space to preview", "Ctrl+R to rename", "Type to search"] : ["Ctrl+B to only show current branch", "Type to search"];
	return [a, ...rest, "Esc to cancel"].join(" \xB7 ");
}

export type Paint = (role: string, text: string) => string;

const ACCENT = "\x1b[38;2;153;204;255m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

export function modalRule(width: number): string {
	return `${ACCENT}${"\u2594".repeat(Math.max(0, width))}${RESET}`;
}

export function titleRow(): string {
	return `   ${BOLD}${ACCENT}Resume session${RESET}`;
}

export function searchBoxRows(query: string, boxWidth: number, paint: Paint): string[] {
	const inner = Math.max(0, boxWidth - 2);
	const shown = query === "" ? paint("muted", "\u2315 Search\u2026") : `\u2315 ${query}`;
	const visibleLen = query === "" ? "\u2315 Search\u2026".length : 2 + query.length;
	const gap = " ".repeat(Math.max(0, inner - 1 - visibleLen));
	return [
		`   ${DIM}\u256d${"\u2500".repeat(inner)}\u256e${RESET}`,
		`   ${DIM}\u2502${RESET} ${shown}${gap}${DIM}\u2502${RESET}`,
		`   ${DIM}\u2570${"\u2500".repeat(inner)}\u256f${RESET}`,
	];
}

export function projectHeaderRow(projectLabel: string, paint: Paint): string {
	return `     ${paint("muted", projectLabel)}`;
}

export function emptyRow(paint: Paint): string {
	return `    ${paint("muted", "No conversations found in this project.")}`;
}

export function scopeSwitchHintRow(paint: Paint): string {
	return `    ${paint("muted", "Ctrl+A to show all projects")}`;
}

export function entryRows(title: string, meta: string, selected: boolean, paint: Paint): string[] {
	const arrow = selected ? `${ACCENT}\u276f${RESET} ` : "  ";
	const titleText = selected ? `${ACCENT}${title}${RESET}` : title;
	return [`   ${arrow}${titleText}`, `     ${paint("muted", meta)}`];
}

export function footerRows(text: string, paint: Paint): string[] {
	return [`     ${paint("muted", text)}`];
}

if (process.env.CLAUDE_RESUME_STORE_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const tag: Paint = (role, text) => `<${role}>${text}</${role}>`;
	const plain = (text: string) => text.replace(/\x1b\[[0-9;]*m|<\/?[a-z]+>/g, "");

	const now = Date.parse("2026-09-28T12:00:00Z");
	check(formatRelativeTimeLong(now, now - 3 * HOUR) === "3 hours ago", "3 hours (measured live via claude-resume2-all-projects capture)");
	check(formatRelativeTimeLong(now, now - 1 * HOUR) === "1 hour ago", "singular hour (not measured, conventional pluralization)");
	check(formatRelativeTimeLong(now, now - 1 * MINUTE) === "1 minute ago", "singular minute (not measured)");
	check(formatRelativeTimeLong(now, now - 30_000) === "just now", "under a minute (not measured)");

	check(formatSize(412365) === "402.7KB", "KB with one decimal, same as Claude's measured 402.7KB");
	check(formatSize(1024) === "1.0KB", "exact KB boundary");

	check(displayTitle({ firstMessage: "hi" }) === "hi", "title is the session's first message (measured)");
	check(displayTitle({ firstMessage: "" }) === "(no messages)", "an empty session gets a placeholder title, not measured live but never left blank");
	check(displayTitle({ firstMessage: "fix\n\n  the\tbug" }) === "fix the bug", "a multi-line first message is one title row (a row holding a newline broke the frame, 2026-10-01 screenshot)");
	check(
		displayTitle({ firstMessage: "<system-reminder>\n# Environment\nYou have been invoked\n</system-reminder>\n<system-reminder>\nmodel\n</system-reminder>\nResearch the harness" }) === "Research the harness",
		"injected system-reminder blocks are not the title (sessions 2026-09-30T15-35-01-* start with four of them)",
	);

	check(isSubagentSession({ name: "general-purpose#a9353f6f", parentSessionPath: "p.jsonl" }), "a subagent's own session (parent + <type>#<id> name, 68 of 175 in --C--TimeBlock--) is not a conversation to resume");
	check(!isSubagentSession({ name: undefined, parentSessionPath: "p.jsonl" }), "a fork the user made keeps its place in the list");
	check(!isSubagentSession({ name: "general-purpose#a9353f6f", parentSessionPath: undefined }), "a root session is listed whatever its name");

	check(visibleEntryCount(8) === 3 && visibleEntryCount(9) === 3 && visibleEntryCount(11) === 4, "an entry is two rows plus a gap, the last one needs no gap");
	check(visibleEntryCount(0) === 1, "the selected entry is always drawn");
	check(windowStart(0, 2, 3) === 0 && windowStart(0, 3, 3) === 1 && windowStart(4, 2, 3) === 2, "the window moves only when the selection leaves it");

	const entry: ResumeEntry = { path: "p", cwd: "C:\\work", created: new Date(now), modified: new Date(now - 3 * HOUR), messageCount: 1, firstMessage: "hi", allMessagesText: "hi" };
	check(metaLine(entry, now, "HEAD", 412365) === "3 hours ago \xB7 HEAD \xB7 402.7KB \xB7 C:\\work", "meta line field order: time, branch, size, cwd (measured)");

	check(filterResumeEntries([entry], "HI").length === 1, "search is case-insensitive, matches the full transcript text not just the title");
	check(filterResumeEntries([entry], "nope").length === 0, "no match returns nothing");

	check(scopeHint("project", false) === "Ctrl+A to show all projects \xB7 Ctrl+B to only show current branch \xB7 Type to search \xB7 Esc to cancel", "empty current-project footer (measured)");
	check(
		scopeHint("everywhere", true) ===
			"Ctrl+A to only show current repo \xB7 Ctrl+B to only show current branch \xB7 Space to preview \xB7 Ctrl+R to rename \xB7 Type to search \xB7 Esc to cancel",
		"all-projects footer with results shows preview/rename hints (measured)",
	);

	check(modalRule(5) === `${ACCENT}\u2594\u2594\u2594\u2594\u2594${RESET}`, "the modal's top rule is Claude's upper-eighth-block glyph (measured, same as claude-modes' plan modal)");
	check(titleRow() === `   ${BOLD}${ACCENT}Resume session${RESET}`, "title sits 3 columns in, bold accent (measured)");

	const box = searchBoxRows("", 20, tag);
	check(plain(box[1]!).includes("Search\u2026"), "empty query shows the placeholder");
	check(box.every((row) => row.startsWith("   ") && row.includes(DIM)), "the search box sits 3 columns in, dim border, not accent (measured: unlike ctrl+r's search box)");

	const rows = entryRows("hi", "3 hours ago \xB7 HEAD \xB7 402.7KB \xB7 C:\\work", true, tag);
	check(plain(rows[0]!) === "   \u276f hi" && plain(rows[1]!) === "     3 hours ago \xB7 HEAD \xB7 402.7KB \xB7 C:\\work", "selected entry: arrow + title, meta line hangs two columns further in (measured)");
	const unselected = entryRows("hi", "x", false, tag);
	check(plain(unselected[0]!) === "     hi", "unselected entry keeps the same text column as the arrow row (measured)");

	check(plain(projectHeaderRow("work", tag)) === "     work" && projectHeaderRow("work", tag).includes("<muted>"), "the current-project label sits 5 columns in, muted (measured)");
	check(plain(emptyRow(tag)) === "    No conversations found in this project.", "the empty-state message sits 4 columns in (measured)");
	check(plain(scopeSwitchHintRow(tag)) === "    Ctrl+A to show all projects", "an inline hint repeats the ctrl+a wording right under the empty message, 4 columns in, separate from the real footer (measured)");
	check(plain(footerRows("x", tag)[0]!) === "     x", "the real footer sits 5 columns in, one column past the inline hint (measured)");

	console.log("\nAll claude-resume store checks passed.");
}
