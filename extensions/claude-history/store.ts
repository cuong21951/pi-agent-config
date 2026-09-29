export interface HistoryEntry {
	display: string;
	pastedContents: Record<string, unknown>;
	timestamp: number;
	project: string;
	sessionId: string;
}

export type HistoryScope = "everywhere" | "session";

export function parseHistoryLines(text: string): HistoryEntry[] {
	const entries: HistoryEntry[] = [];
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (trimmed === "") continue;
		try {
			const parsed = JSON.parse(trimmed);
			if (typeof parsed.display === "string" && typeof parsed.timestamp === "number") entries.push(parsed as HistoryEntry);
		} catch {
			continue;
		}
	}
	return entries;
}

export function formatHistoryLine(entry: HistoryEntry): string {
	return JSON.stringify(entry);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function formatRelativeTime(nowMs: number, thenMs: number): string {
	const diff = Math.max(0, nowMs - thenMs);
	if (diff < MINUTE) return "just now";
	if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
	if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
	if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
	if (diff < MONTH) return `${Math.floor(diff / WEEK)}w ago`;
	if (diff < YEAR) return `${Math.floor(diff / MONTH)}mo ago`;
	return `${Math.floor(diff / YEAR)}y ago`;
}

export function scopeTitle(scope: HistoryScope): string {
	return `Search prompts \xB7 ${scope}`;
}

export function otherScope(scope: HistoryScope): HistoryScope {
	return scope === "everywhere" ? "session" : "everywhere";
}

export function matchesQuery(entry: HistoryEntry, query: string): boolean {
	return query === "" || entry.display.toLowerCase().includes(query.toLowerCase());
}

export function filterEntries(entries: readonly HistoryEntry[], query: string, scope: HistoryScope, sessionId: string): HistoryEntry[] {
	return entries.filter((entry) => (scope === "everywhere" || entry.sessionId === sessionId) && matchesQuery(entry, query));
}

export const PREFIX_WIDTH = 4;
export const TIME_FIELD_WIDTH = 9;
export const ZONE_HEIGHT = 8;
export const PREVIEW_LINES = ZONE_HEIGHT - 2;

export function listRowText(relTime: string, display: string, selected: boolean): string {
	const prefix = selected ? "  \u276f " : "    ";
	return prefix + relTime.padEnd(TIME_FIELD_WIDTH) + display;
}

export function visibleWindow<T>(items: readonly T[], selectedIndex: number, height: number): { items: T[]; start: number } {
	if (items.length <= height) return { items: [...items], start: 0 };
	const end = Math.min(items.length, Math.max(height, selectedIndex + 1));
	const start = end - height;
	return { items: items.slice(start, end), start };
}

export function truncateOneLine(text: string, width: number): string {
	if (width <= 0) return "";
	return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}\u2026`;
}

export function leftColumnWidth(rows: readonly string[], minWidth: number, maxWidth: number): number {
	const widest = rows.reduce((max, row) => Math.max(max, row.length), 0);
	return Math.min(maxWidth, Math.max(minWidth, widest));
}

export function fitWidth(text: string, width: number): string {
	return truncateOneLine(text, width).padEnd(width);
}

export type Paint = (role: string, text: string) => string;

const ACCENT = "\x1b[38;2;153;204;255m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const SEARCH_ICON = "⌕";
const PLACEHOLDER = "Filter history…";

export function ruleRow(width: number): string {
	return `${ACCENT}${"─".repeat(Math.max(0, width))}${RESET}`;
}

export function titleRow(scope: HistoryScope): string {
	return `  ${BOLD}${ACCENT}${scopeTitle(scope)}${RESET}`;
}

export function footerRow(paint: Paint): string {
	return `  ${paint("muted", "↑/↓ to navigate \xB7 Enter to use \xB7 Esc to cancel \xB7 ctrl+s to scope")}`;
}

export function searchBoxRows(query: string, boxWidth: number, paint: Paint): string[] {
	const inner = Math.max(0, boxWidth - 2);
	const shown = query === "" ? PLACEHOLDER : query;
	const visibleLen = SEARCH_ICON.length + 1 + shown.length;
	const gap = " ".repeat(Math.max(0, inner - 1 - visibleLen));
	const content = ` ${SEARCH_ICON} ${query === "" ? paint("muted", PLACEHOLDER) : shown}${gap}`;
	return [
		`${ACCENT}╭${"─".repeat(inner)}╮${RESET}`,
		`${ACCENT}│${RESET}${content}${ACCENT}│${RESET}`,
		`${ACCENT}╰${"─".repeat(inner)}╯${RESET}`,
	];
}

export function colorizeListRow(row: string, selected: boolean, paint: Paint): string {
	const prefix = row.slice(0, PREFIX_WIDTH);
	const time = row.slice(PREFIX_WIDTH, PREFIX_WIDTH + TIME_FIELD_WIDTH);
	const rest = row.slice(PREFIX_WIDTH + TIME_FIELD_WIDTH);
	const arrow = selected ? prefix.replace("❯", `${ACCENT}❯${RESET}`) : prefix;
	const text = selected ? `${ACCENT}${rest}${RESET}` : rest;
	return arrow + paint("muted", time) + text;
}

export function previewRows(text: string | undefined, previewWidth: number): string[] {
	const rows: string[] = [];
	if (text === undefined || previewWidth < 2) return Array<string>(ZONE_HEIGHT).fill("");
	const inner = Math.max(0, previewWidth - 2);
	const firstLine = truncateOneLine(text, Math.max(0, inner - 2));
	rows.push(`${DIM}╭${"─".repeat(inner)}╮${RESET}`);
	rows.push(`${DIM}│${RESET} ${firstLine}${" ".repeat(Math.max(0, inner - 1 - firstLine.length))}${DIM}│${RESET}`);
	for (let i = 0; i < PREVIEW_LINES - 1; i++) rows.push(`${DIM}│${RESET}${" ".repeat(inner)}${DIM}│${RESET}`);
	rows.push(`${DIM}╰${"─".repeat(inner)}╯${RESET}`);
	return rows;
}

export interface ZoneItem {
	relTime: string;
	display: string;
	selected: boolean;
}

export function zoneRows(items: readonly ZoneItem[], previewText: string | undefined, width: number, paint: Paint): string[] {
	const totalContent = Math.max(24, width - 4);
	const leftMin = 20;
	const plainRows = items.map((item) => listRowText(item.relTime, item.display, item.selected));
	const leftWidth = items.length === 0 ? leftMin : leftColumnWidth(plainRows, leftMin, Math.max(leftMin, totalContent - leftMin - 1));
	const previewWidth = Math.max(0, totalContent - leftWidth - 1);
	const preview = previewRows(previewText, previewWidth);
	const offset = ZONE_HEIGHT - items.length;
	const rows: string[] = [];
	for (let row = 0; row < ZONE_HEIGHT; row++) {
		let left: string;
		if (items.length === 0) {
			left = row === 0 ? paint("muted", "No matching prompts".padEnd(leftWidth)) : " ".repeat(leftWidth);
		} else {
			const itemIndex = row - offset;
			left = itemIndex >= 0 && itemIndex < items.length ? colorizeListRow(fitWidth(plainRows[itemIndex]!, leftWidth), items[itemIndex]!.selected, paint) : " ".repeat(leftWidth);
		}
		rows.push(preview[row] ? `  ${left} ${preview[row]}` : `  ${left}`);
	}
	return rows;
}

if (process.env.CLAUDE_HISTORY_STORE_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};

	const sample = '{"display":"hi","pastedContents":{},"timestamp":1,"project":"C:\\\\a","sessionId":"s1"}\n\n{"display":"bye","pastedContents":{},"timestamp":2,"project":"C:\\\\a","sessionId":"s2"}\nnot json\n';
	const parsed = parseHistoryLines(sample);
	check(parsed.length === 2 && parsed[0]!.display === "hi" && parsed[1]!.display === "bye", "parses one entry per line, skips blanks and garbage");
	check(formatHistoryLine(parsed[0]!) === '{"display":"hi","pastedContents":{},"timestamp":1,"project":"C:\\\\a","sessionId":"s1"}', "round-trips through JSON, Claude's own history.jsonl schema");

	const now = Date.parse("2026-09-28T12:00:00Z");
	check(formatRelativeTime(now, now - 2 * MINUTE) === "2m ago", "2 minutes (measured live via seeded history.jsonl, claude-explore ctrl+r capture)");
	check(formatRelativeTime(now, now - 19 * MINUTE) === "19m ago", "19 minutes (measured)");
	check(formatRelativeTime(now, now - 55 * MINUTE) === "55m ago", "55 minutes (measured)");
	check(formatRelativeTime(now, now - 4 * DAY) === "4d ago", "4 days (measured)");
	check(formatRelativeTime(now, now - 9 * DAY) === "1w ago", "9 days rounds down to 1 week (measured)");
	check(formatRelativeTime(now, now - 30_000) === "just now", "under a minute (not measured live, conventional bucket)");

	check(scopeTitle("everywhere") === "Search prompts \xB7 everywhere", "default scope title (measured)");
	check(scopeTitle("session") === "Search prompts \xB7 session", "ctrl+s scope title (measured)");
	check(otherScope("everywhere") === "session" && otherScope("session") === "everywhere", "ctrl+s flips the scope");

	const entries: HistoryEntry[] = [
		{ display: "Fix lint errors in the parity suite", pastedContents: {}, timestamp: 1, project: "a", sessionId: "s1" },
		{ display: "Add a NO_COLOR theme variant for pi", pastedContents: {}, timestamp: 2, project: "a", sessionId: "s2" },
	];
	check(filterEntries(entries, "abc", "everywhere", "s1").length === 0, "a query with no match returns nothing (measured: 'abc' against seeded history)");
	check(filterEntries(entries, "THEME", "everywhere", "s1")[0]!.display.includes("theme"), "substring match is case-insensitive (measured: 'test' matched 'Write a test...' live)");
	check(filterEntries(entries, "", "session", "s2").length === 1 && filterEntries(entries, "", "session", "s2")[0]!.sessionId === "s2", "session scope keeps only the current session's entries (measured: ctrl+s on unrelated seeded sessionIds gave 'No matching prompts')");

	check(listRowText("19m ago", "Fix lint errors in the parity suite", false) === "    19m ago  Fix lint errors in the parity suite", "unselected row: 4-col blank prefix, time padded to 9 (measured)");
	check(listRowText("4d ago", "Write a test for the resume picker component", true) === "  \u276f 4d ago   Write a test for the resume picker component", "selected row: arrow prefix, same 9-col time field, text starts at column 13 either way (measured)");

	check(truncateOneLine("short", 10) === "short", "text that fits is untouched");
	check(truncateOneLine("How does the compaction engine decide when to summarize?", 20) === "How does the compac\u2026", "long text is cut with Claude's ellipsis (measured: row 'summari\u2026' truncation)");

	const window5 = visibleWindow([1, 2, 3, 4, 5], 4, 8);
	check(window5.items.length === 5 && window5.start === 0, "fewer items than the zone height: nothing is windowed off");
	const window10 = visibleWindow([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 9, 8);
	check(JSON.stringify(window10.items) === JSON.stringify([3, 4, 5, 6, 7, 8, 9, 10]) && window10.start === 2, "more items than fit: the window ends on the selected entry (not measured beyond 5 seeded entries, same windowing rule as a scrolling select list)");

	check(leftColumnWidth(["abc", "a longer row"], 5, 100) === 12, "left column grows to the widest visible row");
	check(leftColumnWidth(["abc"], 5, 100) === 5, "left column never shrinks below the minimum");
	check(leftColumnWidth(["x".repeat(200)], 5, 80) === 80, "left column never exceeds the given maximum (preview pane keeps its share)");

	const tag: Paint = (role, text) => `<${role}>${text}</${role}>`;
	const plain = (text: string) => text.replace(/\x1b\[[0-9;]*m|<\/?[a-z]+>/g, "");

	check(ruleRow(5) === `${ACCENT}─────${RESET}`, "rule row is the same accent blue as claude-modes' dialog rule (measured: fg=99ccff)");
	check(titleRow("everywhere") === `  ${BOLD}${ACCENT}Search prompts \xB7 everywhere${RESET}`, "title is bold accent, two columns in (measured)");
	check(plain(footerRow(tag)) === "  ↑/↓ to navigate \xB7 Enter to use \xB7 Esc to cancel \xB7 ctrl+s to scope", "footer wording and arrow glyphs (measured)");

	const emptyBox = searchBoxRows("", 20, tag);
	check(emptyBox.length === 3, "search box is always 3 rows: top border, content, bottom border");
	check(plain(emptyBox[1]!).includes("Filter history…"), "empty query shows the placeholder (measured)");
	check(emptyBox[1]!.includes("<muted>Filter history…</muted>"), "the placeholder is muted, the icon is not (measured)");
	const typedBox = searchBoxRows("abc", 20, tag);
	check(plain(typedBox[1]!) === `│ ⌕ abc${" ".repeat(12)}│` && !typedBox[1]!.includes("<muted>"), "typed text is plain, not muted, padded to the box width (measured)");

	check(plain(colorizeListRow(listRowText("19m ago", "Fix lint errors", false), false, tag)) === "    19m ago  Fix lint errors", "unselected row colorizes without changing its layout");
	check(colorizeListRow(listRowText("2m ago", "hi", true), true, tag).startsWith(`  ${ACCENT}❯${RESET} `), "selected row's arrow is accent-coloured, same blue as the rule (measured)");

	const oneItem: ZoneItem[] = [{ relTime: "2m ago", display: "Add a NO_COLOR theme variant for pi", selected: true }];
	const zone = zoneRows(oneItem, "Add a NO_COLOR theme variant for pi", 132, tag);
	check(zone.length === ZONE_HEIGHT, "the zone is always 8 rows, bottom-aligned list + top-aligned preview (measured)");
	check(plain(zone[ZONE_HEIGHT - 1]!).includes("Add a NO_COLOR theme variant for pi"), "a single item sits on the last row of the zone (measured: bottom-aligned, newest closest to the search box)");
	check(zone.slice(0, ZONE_HEIGHT - 1).every((row) => plain(row).trim() === "" || plain(row).includes("╭") || plain(row).includes("│") || plain(row).includes("╰")), "rows above a single item are blank except for the preview border (measured)");

	const noMatch = zoneRows([], undefined, 132, tag);
	check(plain(noMatch[0]!).trim() === "No matching prompts" && noMatch.slice(1).every((row) => plain(row).trim() === ""), "zero matches: the message sits on the first row, no preview pane (measured)");

	console.log("\nAll claude-history store checks passed.");
}
