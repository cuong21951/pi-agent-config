import { isAbort } from "./rows.ts";

export type Paint = (role: string, text: string) => string;
export interface Roots {
	home: string;
	cwd: string;
}
export interface Style extends Roots {
	fg: Paint;
	bold: (text: string) => string;
	code?: (text: string, path: string) => string;
}

export interface ToolOutcome {
	text: string;
	isError: boolean;
	details: unknown;
}

export interface ResultView {
	expanded: boolean;
	isPartial: boolean;
	hint: string;
}

export type RowKind = "plain" | "muted" | "context" | "code" | "added" | "removed";
export type Span = [number, number];
export type Tint = [number, number, string];
export type Highlight = (code: string) => string;
export interface Row {
	kind: RowKind;
	text: string;
	hi?: Span[];
	fg?: Tint[];
}

const LABEL: Record<string, string> = { write: "Write", edit: "Update" };
const VERB: Record<string, string> = { read: "Reading", grep: "Searching", find: "Searching", ls: "Listing" };
const PAST: Record<string, string> = { read: "Read", grep: "Searched", find: "Searched", ls: "Listed" };
export const WRITE_TOOLS = new Set(["write", "edit"]);
const ELBOW = "  ⎿  ";
const WRITE_PREVIEW_LINES = 10;
const EXPANDED_OUTPUT_LINES = 20;

const SEP = /[\\/]/g;
const asKey = (path: string) => path.replace(SEP, "/").toLowerCase();

// ponytail: Claude names a file relative to the working directory when it sits inside it and ~-prefixed
// otherwise, with the platform's own separator — measured: "Update(~\.pi\agent\extensions\...)". pi hands
// us forward slashes even on Windows, so comparing raw against os.homedir() never matched and every row
// showed the whole absolute path.
function shortPath(value: unknown, s: Roots): string {
	const raw = typeof value === "string" ? value : "";
	if (raw === "") return "";
	const sep = s.home.includes("\\") ? "\\" : "/";
	const native = (text: string) => text.replace(SEP, sep);
	for (const [base, prefix] of [
		[s.cwd, ""],
		[s.home, `~${sep}`],
	] as const) {
		const root = asKey(base).replace(/\/$/, "");
		if (root !== "" && asKey(raw).startsWith(`${root}/`)) return prefix + native(raw.slice(root.length + 1));
	}
	return native(raw);
}

// ponytail: Claude names the thing, not the tool: "Reading a.txt", "Searched "foo"".
export function target(tool: string, args: Record<string, unknown>, s: Roots): string {
	switch (tool) {
		case "grep":
		case "find":
			return `"${String(args.pattern ?? "")}"`;
		default:
			return shortPath(args.path, s) || ".";
	}
}

export function runningLine(tool: string, args: Record<string, unknown>, blink: boolean, s: Style): string {
	return (blink ? s.fg("muted", "● ") : "  ") + `${VERB[tool] ?? "Running"} ${target(tool, args, s)}`;
}

export function doneLine(tool: string, args: Record<string, unknown>, s: Style): string {
	return s.fg("muted", `${PAST[tool] ?? "Ran"} ${target(tool, args, s)}`);
}

export function writeCallLine(tool: string, args: Record<string, unknown>, s: Style): string {
	return s.fg("borderAccent", "● ") + s.bold(LABEL[tool] ?? tool) + `(${shortPath(args.path, s)})`;
}

function lineCount(text: string): number {
	const body = text.replace(/\n$/, "");
	return body === "" || /^(No |\(empty)/.test(body) ? 0 : body.split("\n").length;
}

function plural(n: number, one: string, many = `${one}s`, bold: (t: string) => string = (t) => t): string {
	return `${bold(String(n))} ${n === 1 ? one : many}`;
}

function diffLines(details: unknown): string[] {
	const diff = (details as { diff?: unknown } | undefined)?.diff;
	return typeof diff === "string" && diff !== "" ? diff.split("\n") : [];
}

export function summary(tool: string, args: Record<string, unknown>, outcome: ToolOutcome, s: Style): string {
	switch (tool) {
		case "read":
			return `Read ${plural(lineCount(outcome.text), "line")}`;
		case "write":
			return `Wrote ${plural(lineCount(String(args.content ?? "")), "line", undefined, s.bold)} to ${s.bold(shortPath(args.path, s))}`;
		case "edit": {
			const lines = diffLines(outcome.details);
			const added = lines.filter((line) => line.startsWith("+")).length;
			const removed = lines.filter((line) => line.startsWith("-")).length;
			// ponytail: a missing diff is not a zero-change edit; saying so would misreport the tool.
			if (added === 0 && removed === 0) return `Updated ${s.bold(shortPath(args.path, s))}`;
			const counts = [
				[added, "added"],
				[removed, "removed"],
			] as const;
			return counts
				.filter(([n]) => n > 0)
				.map(([n, verb]) => `${verb} ${plural(n, "line", undefined, s.bold)}`)
				.join(", ")
				.replace(/^./, (first) => first.toUpperCase());
		}
		case "grep":
			return `Found ${plural(lineCount(outcome.text), "line")}`;
		case "find":
			return `Found ${plural(lineCount(outcome.text), "file")}`;
		default:
			return `Listed ${plural(lineCount(outcome.text), "entry", "entries")}`;
	}
}

const DIFF_LINE = /^([ +-])\s*(\d+) (.*)$/;
const WORD = /\s+|\S+/g;
const WORD_DIFF_LIMIT = 0.4;

function words(text: string): string[] {
	return text.match(WORD) ?? [];
}

interface Part {
	text: string;
	from: boolean;
	to: boolean;
}

// ponytail: the word diff Claude runs over a removed/added pair. A word is kept when it survives in both
// lines, so a change scattered across the line yields several separate runs rather than one wide one.
function wordDiff(a: string[], b: string[]): Part[] {
	const common: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			common[i][j] = a[i] === b[j] ? common[i + 1][j + 1] + 1 : Math.max(common[i + 1][j], common[i][j + 1]);
		}
	}
	const parts: Part[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) parts.push({ text: a[i++], from: true, to: (j++, true) });
		else if (common[i + 1][j] >= common[i][j + 1]) parts.push({ text: a[i++], from: true, to: false });
		else parts.push({ text: b[j++], from: false, to: true });
	}
	while (i < a.length) parts.push({ text: a[i++], from: true, to: false });
	while (j < b.length) parts.push({ text: b[j++], from: false, to: true });
	return parts;
}

// ponytail: spans of `side` that the other line does not have, in that line's own coordinates, merged
// where they touch so a run of changed words is one background instead of several abutting ones.
function changedSpans(parts: Part[], side: "from" | "to"): Span[] {
	const spans: Span[] = [];
	let at = 0;
	for (const part of parts) {
		if (!part[side]) continue;
		const end = at + part.text.length;
		if (!(part.from && part.to)) {
			const last = spans[spans.length - 1];
			if (last && last[1] === at) last[1] = end;
			else spans.push([at, end]);
		}
		at = end;
	}
	return spans;
}

// ponytail: Claude drops the word diff and colours the whole pair when more than 40% of it changed —
// past that the highlight stops telling you anything. The ratio is its own, measured from the bundle.
function markPair(removed: Row, added: Row, gutter: number): void {
	const from = removed.text.slice(gutter);
	const to = added.text.slice(gutter);
	const parts = wordDiff(words(from), words(to));
	const changed = parts.filter((part) => !(part.from && part.to)).reduce((total, part) => total + part.text.length, 0);
	if (from.length + to.length === 0 || changed / (from.length + to.length) > WORD_DIFF_LIMIT) return;
	const shift = (spans: Span[]) => spans.map(([start, end]) => [gutter + start, gutter + end] as Span);
	const fromSpans = shift(changedSpans(parts, "from"));
	const toSpans = shift(changedSpans(parts, "to"));
	if (fromSpans.length > 0) removed.hi = fromSpans;
	if (toSpans.length > 0) added.hi = toSpans;
}

const ANSI = /\x1b\[[0-9;]*m/g;
const CLEARS_FG = new Set(["\x1b[39m", "\x1b[0m", "\x1b[m"]);

// ponytail: Claude splits highlight.js's one "keyword" scope in two — these sixteen words take a cyan of
// their own, everything else keyword stays pink. Its rule is `scope === "keyword" && de.has(text.trim())`
// with this exact word list, both read out of the 2.1.261 bundle. pi's highlighter has no such bucket, so
// the swap happens here, on an exact token match: a run reading `"const"` with its quotes is a string and
// keeps the string colour.
const STORAGE = new Set([
	"const", "let", "var", "function", "class", "type", "interface", "enum",
	"namespace", "module", "def", "fn", "func", "struct", "trait", "impl",
]);
const STORAGE_FG = "\x1b[38;2;102;217;239m";

// ponytail: a syntax highlighter writes foreground escapes and clears them with 39m/0m — and 0m would
// drop the diff background with them. So its output is read back into plain-text colour runs and the row
// is re-emitted from scratch, background and all. Runs are the only thing that survives wrapping, since
// a wrapped piece keeps character offsets rather than escape sequences.
export function tints(highlighted: string, offset: number): Tint[] {
	const runs: Tint[] = [];
	let plain = 0;
	let at = 0;
	let colour = "";
	for (const match of highlighted.matchAll(ANSI)) {
		const text = highlighted.slice(at, match.index);
		if (text !== "") {
			if (colour !== "") runs.push([offset + plain, offset + plain + text.length, colour]);
			plain += text.length;
		}
		colour = CLEARS_FG.has(match[0]) ? "" : match[0];
		at = (match.index ?? 0) + match[0].length;
	}
	const tail = highlighted.slice(at);
	if (tail !== "" && colour !== "") runs.push([offset + plain, offset + plain + tail.length, colour]);
	return runs;
}

// ponytail: a highlighter that changes the text is a highlighter we cannot map back onto the row, so the
// colours are dropped rather than shifted onto the wrong characters.
function tintsFor(code: string, offset: number, highlight?: Highlight): Tint[] | undefined {
	if (!highlight || code === "") return undefined;
	let painted: string;
	try {
		painted = highlight(code);
	} catch {
		return undefined;
	}
	if (painted.replace(ANSI, "") !== code) return undefined;
	const runs = tints(painted, offset).map(([start, end, colour]) =>
		STORAGE.has(code.slice(start - offset, end - offset)) ? ([start, end, STORAGE_FG] as Tint) : ([start, end, colour] as Tint),
	);
	return runs.length > 0 ? runs : undefined;
}

// ponytail: Claude's diff row is the line number right-aligned in (widest digits + 1) columns, a space,
// the sign, then the code with nothing between: " 12 -two". pi's diff string puts the sign first, so it
// is re-shaped here. Lines that are not diff rows (the "..." gap) pass through muted.
export function diffRows(lines: string[], highlight?: Highlight): Row[] {
	const parsed = lines.map((line) => line.match(DIFF_LINE));
	const width = Math.max(1, ...parsed.map((m) => (m ? m[2].length : 0)));
	const gutter = width + 3;
	const rows: Row[] = lines.map((line, i) => {
		const m = parsed[i];
		if (!m) return { kind: "muted", text: line };
		const [, sign, num, text] = m;
		const kind: RowKind = sign === "+" ? "added" : sign === "-" ? "removed" : "context";
		// ponytail: a removed line is never syntax-highlighted — it renders in the plain foreground while
		// added and context lines keep their tokens. Measured three ways: the 2.1.261 bundle branches on the
		// marker before it tokenises, and both published reconstructions carry the same branch.
		return { kind, text: ` ${num.padStart(width)} ${sign}${text}`, fg: kind === "removed" ? undefined : tintsFor(text, gutter, highlight) };
	});
	for (let i = 0; i < rows.length; ) {
		if (rows[i].kind !== "removed") {
			i++;
			continue;
		}
		let mid = i;
		while (mid < rows.length && rows[mid].kind === "removed") mid++;
		let end = mid;
		while (end < rows.length && rows[end].kind === "added") end++;
		for (let n = 0; n < Math.min(mid - i, end - mid); n++) markPair(rows[i + n], rows[mid + n], gutter);
		i = Math.max(end, mid);
	}
	return rows;
}

// ponytail: sampled from a screenshot of Claude and of pi side by side in the same terminal. Claude does
// NOT emit its palette value for a diff background: dark-daltonized says diffRemoved 660000 / diffAdded
// 004466, but what lands on screen is 3d0100 / 001b29, and the word colours b30000 / 0077b3 land as
// 5c0200 / 003047. pi emitted the palette values verbatim in that same terminal, so the attenuation is
// Claude-side, not the terminal. The measured values win — the point is to look identical.
const CODE = "\x1b[38;2;248;248;242m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const LINE_BG: Partial<Record<RowKind, string>> = { removed: "\x1b[48;2;61;1;0m", added: "\x1b[48;2;0;27;41m" };
const WORD_BG: Partial<Record<RowKind, string>> = { removed: "\x1b[48;2;92;2;0m", added: "\x1b[48;2;0;48;71m" };
const GUTTER_FG: Partial<Record<RowKind, string>> = { removed: "\x1b[38;2;220;90;90m", added: "\x1b[38;2;81;160;200m" };
const SIGN_GUTTER = /^ *\d* ?[-+ ]/;
const CODE_GUTTER = /^ *\d+ /;

// ponytail: three layers land on one row — the line background, the brighter background on the words that
// changed, and the syntax colour per token. Cutting the row at every boundary of all three and emitting
// each piece with only the escapes that changed is the one composition that survives all three at once.
export function paint(row: Row, text: string, pad: number): string {
	if (row.kind === "plain") return text;
	if (row.kind === "muted") return DIM + text + RESET;
	const bg = LINE_BG[row.kind] ?? "";
	const word = WORD_BG[row.kind] ?? "";
	const gutterEnd = Math.min(text.length, text.match(row.kind === "code" ? CODE_GUTTER : SIGN_GUTTER)?.[0].length ?? 0);
	const clamp = (n: number) => Math.max(0, Math.min(n, text.length));
	const cuts = new Set<number>([0, gutterEnd, text.length]);
	for (const [start, end] of row.hi ?? []) cuts.add(clamp(start)), cuts.add(clamp(end));
	for (const [start, end] of row.fg ?? []) cuts.add(clamp(start)), cuts.add(clamp(end));
	const marks = [...cuts].sort((a, b) => a - b);
	const changed = (at: number) => (row.hi ?? []).some(([start, end]) => at >= start && at < end);
	const tint = (at: number) =>
		at < gutterEnd ? (GUTTER_FG[row.kind] ?? CODE) : (row.fg?.find(([start, end]) => at >= start && at < end)?.[2] ?? CODE);
	let out = "";
	let shownBg = "";
	let shownFg = "";
	for (let i = 0; i < marks.length - 1; i++) {
		const from = marks[i];
		const to = marks[i + 1];
		if (from >= to) continue;
		const nextBg = bg === "" ? "" : changed(from) ? word : bg;
		const nextFg = tint(from);
		if (nextBg !== shownBg) out += (shownBg = nextBg);
		if (nextFg !== shownFg) out += (shownFg = nextFg);
		out += text.slice(from, to);
	}
	if (bg !== "") out += (shownBg === bg ? "" : bg) + " ".repeat(pad);
	return out + RESET;
}

const ROW_GUTTER = /^( *\d+ [-+ ])/;

// ponytail: break at the last space that still fits, keeping that space at the end of the piece so no
// character is lost and every offset after it stays where the word diff put it. A token wider than the
// room is cut, which is what Claude's own wrap does with an unbroken path or string.
function wrapPoints(code: string, room: number): Span[] {
	const pieces: Span[] = [];
	let at = 0;
	while (at < code.length) {
		if (code.length - at <= room) {
			pieces.push([at, code.length]);
			break;
		}
		const gap = code.slice(at, at + room).lastIndexOf(" ");
		const end = gap > 0 ? at + gap + 1 : at + room;
		pieces.push([at, end]);
		at = end;
	}
	return pieces;
}

// ponytail: Claude wraps a diff line that outruns the terminal instead of cutting it: the line number
// column goes blank on the continuation rows but the sign is repeated, and the background still runs to
// the right edge. Measuring in characters rather than display width is the shortcut here — a row of
// double-width text would overhang by a column.
export function wrapRow(row: Row, width: number): Row[] {
	const m = row.kind === "code" ? row.text.match(CODE_GUTTER) : LINE_BG[row.kind] || row.kind === "context" ? row.text.match(ROW_GUTTER) : null;
	if (!m) return [row];
	const gutter = m[0];
	const code = row.text.slice(gutter.length);
	const room = width - gutter.length;
	if (room < 1 || code.length <= room) return [row];
	const blank = " ".repeat(gutter.length - 1) + gutter.slice(-1);
	const carry = <T extends Span | Tint>(list: T[] | undefined, from: number, to: number): T[] =>
		(list ?? [])
			.map((run) => [Math.max(run[0] - gutter.length, from), Math.min(run[1] - gutter.length, to), run[2]] as unknown as T)
			.filter((run) => run[0] < run[1])
			.map((run) => [gutter.length + run[0] - from, gutter.length + run[1] - from, run[2]] as unknown as T);
	return wrapPoints(code, room).map(([from, to], index) => {
		const spans = carry(row.hi, from, to).map(([start, end]) => [start, end] as Span);
		const paints = carry(row.fg, from, to);
		return {
			kind: row.kind,
			text: (index === 0 ? gutter : blank) + code.slice(from, to),
			...(spans.length > 0 ? { hi: spans } : {}),
			...(paints.length > 0 ? { fg: paints } : {}),
		};
	});
}

export function contentRows(content: string, highlight?: Highlight): Row[] {
	const lines = content.replace(/\n$/, "").split("\n");
	const width = String(lines.length).length;
	return lines.map((text, i) => ({
		kind: "code",
		text: `${String(i + 1).padStart(width)} ${text}`,
		fg: tintsFor(text, width + 1, highlight),
	}));
}

function more(hidden: number, hint?: string): Row[] {
	return hidden > 0 ? [{ kind: "muted", text: `… +${hidden} ${hidden === 1 ? "line" : "lines"}${hint ? ` (${hint})` : ""}` }] : [];
}

function writeBody(tool: string, args: Record<string, unknown>, outcome: ToolOutcome, view: ResultView, s: Style): Row[] {
	// ponytail: Claude syntax-highlights the code inside a diff row, so the file's own path picks the
	// language; a tool without one just renders plain.
	const path = String(args.path ?? "");
	const highlight = s.code && path !== "" ? (code: string) => s.code!(code, path) : undefined;
	// ponytail: an edit shows its whole diff, however long - only a write truncates its preview. pi already
	// cuts the diff down to the changed lines plus context, with a "..." row where it skipped a stretch.
	if (tool === "edit") return diffRows(diffLines(outcome.details), highlight);
	const all = contentRows(String(args.content ?? ""), highlight);
	const shown = view.expanded ? all : all.slice(0, WRITE_PREVIEW_LINES);
	return [...shown, ...more(all.length - shown.length)];
}

function outputRows(text: string, hint: string): Row[] {
	const lines = text.replace(/\n$/, "").split("\n");
	const shown = lines.slice(0, EXPANDED_OUTPUT_LINES);
	return [...shown.map((line) => ({ kind: "muted" as RowKind, text: `    ${line}` })), ...more(lines.length - shown.length, hint)];
}

export interface Result {
	head: string;
	rows: Row[];
	indent: number;
}

// ponytail: null means the row draws nothing. A finished read-only tool is only its grey call line, like
// Claude's collapsed "Read 1 file"; ctrl+o brings the elbow and the output back.
export function resultRows(tool: string, args: Record<string, unknown>, outcome: ToolOutcome, view: ResultView, s: Style): Result | null {
	const elbow = s.fg("muted", ELBOW);
	const write = WRITE_TOOLS.has(tool);
	if (view.isPartial) return { head: elbow + s.fg("muted", write ? "…" : target(tool, args, s)), rows: [], indent: 0 };
	if (outcome.isError && isAbort(outcome.text)) return null;
	if (!write && !view.expanded) return null;
	if (outcome.isError) {
		const [first, ...rest] = outcome.text.split("\n");
		const rows = view.expanded ? rest.map((line) => ({ kind: "muted" as RowKind, text: `    ${s.fg("error", line)}` })) : [];
		// ponytail: no ✗. Claude puts the error text straight under the elbow in the error colour — the only
		// ✗ in the 2.1.261 bundle belongs to the session picker's one-line preview, not to a tool row.
		return { head: elbow + s.fg("error", first), rows, indent: 0 };
	}
	if (write) return { head: elbow + summary(tool, args, outcome, s), rows: writeBody(tool, args, outcome, view, s), indent: ELBOW.length };
	return { head: elbow + summary(tool, args, outcome, s), rows: outputRows(outcome.text, view.hint), indent: 0 };
}

if (process.env.CLAUDE_TOOLS_SELFTEST) {
	const plain: Style = { fg: (_role, text) => text, bold: (text) => text, home: "/home/me", cwd: "/home/me/proj" };
	const tagged: Style = { fg: (role, text) => `<${role}>${text}</${role}>`, bold: (text) => `<b>${text}</b>`, home: "/home/me", cwd: "/home/me/proj" };
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const view = (expanded = false): ResultView => ({ expanded, isPartial: false, hint: "ctrl+o to expand" });
	const ok = (text: string, details?: unknown): ToolOutcome => ({ text, isError: false, details });

	check(runningLine("read", { path: "/home/me/a.ts" }, true, tagged) === "<muted>● </muted>Reading ~/a.ts", "running read: grey dot, plain text");
	check(runningLine("read", { path: "a.ts" }, false, plain) === "  Reading a.ts", "blink off hides the dot, keeps the column");
	check(runningLine("grep", { pattern: "foo" }, true, plain) === '● Searching "foo"', "running grep names the pattern");
	check(doneLine("read", { path: "/home/me/a.ts" }, tagged) === "<muted>Read ~/a.ts</muted>", "finished read is one grey line without a dot");
	check(doneLine("ls", {}, plain) === "Listed .", "ls defaults to cwd");
	check(doneLine("find", { pattern: "**/*.ts" }, plain) === 'Searched "**/*.ts"', "find is a search");
	check(writeCallLine("edit", { path: "/home/me/x.ts" }, tagged) === "<borderAccent>● </borderAccent><b>Update</b>(~/x.ts)", "update call: blue dot, bold label, plain path");
	check(writeCallLine("write", { path: "n.ts" }, plain) === "● Write(n.ts)", "write call");
	check(writeCallLine("write", { path: "/home/me/proj/src/a.ts" }, plain) === "● Write(src/a.ts)", "a file inside the working directory is named relative to it");
	const win: Style = { ...plain, home: "C:\\Users\\me", cwd: "C:\\Work" };
	check(writeCallLine("edit", { path: "C:/Users/me/.pi/x.ts" }, win) === "● Update(~\\.pi\\x.ts)", "Windows: pi's forward slashes still match home, and the row uses backslashes");
	check(writeCallLine("edit", { path: "C:/Work/src/b.ts" }, win) === "● Update(src\\b.ts)", "Windows: inside the working directory wins over ~");

	check(resultRows("read", { path: "a" }, ok("l1\nl2\nl3\n"), view(), plain) === null, "collapsed read result draws nothing");
	check(resultRows("read", { path: "a" }, { text: "Operation aborted", isError: true }, view(), plain) === null, "an aborted tool draws no error row (pi core prints Interrupted)");
	const expanded = resultRows("read", { path: "a" }, ok("l1\nl2"), view(true), plain)!;
	check(expanded.head === "  ⎿  Read 2 lines" && expanded.rows.map((r) => r.text).join("|") === "    l1|    l2", "expanded read shows elbow, summary and output");
	check(resultRows("read", { path: "a" }, ok(""), { ...view(), isPartial: true }, tagged)!.head === "<muted>  ⎿  </muted><muted>a</muted>", "partial read shows the target under the elbow");
	check(resultRows("read", {}, { text: "ENOENT\nmore", isError: true, details: undefined }, view(), tagged) === null, "a failed read folds into the group like any other call; its row draws nothing");
	check(resultRows("read", {}, { text: "ENOENT\nmore", isError: true, details: undefined }, view(true), tagged)!.head === "<muted>  ⎿  </muted><error>ENOENT</error>", "ctrl+o shows the error red under the elbow, with no glyph of its own");
	check(resultRows("edit", { path: "x.ts" }, { text: "String not found", isError: true, details: undefined }, view(), plain)!.head === "  ⎿  String not found", "a failed edit keeps its own error row");

	const wrote = resultRows("write", { path: "/home/me/n.ts", content: "a\nb" }, ok("Successfully wrote"), view(), tagged)!;
	check(wrote.head === "<muted>  ⎿  </muted>Wrote <b>2</b> lines to <b>~/n.ts</b>", "write summary bolds the count and the path");
	check(wrote.rows.map((r) => `${r.kind}:${r.text}`).join("|") === "code:1 a|code:2 b" && wrote.indent === 5, "write preview numbers the content, the block sits under the elbow's text");
	const long = Array.from({ length: 14 }, (_, i) => `l${i + 1}`).join("\n");
	const preview = resultRows("write", { path: "n.ts", content: long }, ok(""), view(), plain)!.rows;
	check(preview.length === 11 && preview[10].text === "… +4 lines" && preview[9].text === "10 l10" && preview[0].text === " 1 l1", "write shows ten lines, numbers right-aligned, then a bare count");
	check(resultRows("write", { path: "n.ts", content: long }, ok(""), view(true), plain)!.rows.length === 14, "expanded write shows everything");

	const diff = " 1 one\n-2 two\n+2 2\n 3 three";
	const updated = resultRows("edit", { path: "x.ts" }, ok("done", { diff }), view(), tagged)!;
	check(updated.head === "<muted>  ⎿  </muted>Added <b>1</b> line, removed <b>1</b> line", "update summary matches Claude's wording");
	check(resultRows("edit", { path: "x.ts" }, ok("done", { diff: " 1 one\n+2 two\n+3 three" }), view(), plain)!.head === "  ⎿  Added 2 lines", "a pure addition names no removed count");
	check(resultRows("edit", { path: "x.ts" }, ok("done", { diff: "-2 two" }), view(), plain)!.head === "  ⎿  Removed 1 line", "a pure removal names no added count");
	check(updated.indent === 5, "the diff sits under the elbow's text");
	check(
		updated.rows.map((r) => `${r.kind}:${r.text}`).join("|") === "context: 1  one|removed: 2 -two|added: 2 +2|context: 3  three",
		"diff rows: number first, sign column, Claude's spacing",
	);
	check(diffRows(["-  9 a", "+ 10 b", "     ..."]).map((r) => r.text).join("|") === "  9 -a| 10 +b|     ...", "numbers right-align to the widest, gaps pass through");
	check(updated.rows.every((row) => row.hi === undefined), "a line rewritten end to end trips Claude's 40% guard and keeps no word span");
	const swap = diffRows(["-1 const total = a + b;", "+1 const total = a - b;"]);
	check(
		JSON.stringify([swap[0].hi, swap[1].hi]) === "[[[20,21]],[[20,21]]]",
		"one changed token is marked on both rows, shared head and tail trimmed",
	);
	const scattered = diffRows(["-1 the cat sat on the mat", "+1 the dog sat on the rug"]);
	check(
		JSON.stringify(scattered[0].hi) === "[[8,11],[23,26]]" && JSON.stringify(scattered[1].hi) === "[[8,11],[23,26]]",
		"two words changed far apart give two spans, not one block over the middle",
	);
	check(diffRows(["-1 one two", "+1 six ten"]).every((row) => row.hi === undefined), "a pair past the 40% guard keeps no spans at all");
	check(resultRows("edit", { path: "x.ts" }, ok("done", {}), view(), plain)!.head === "  ⎿  Updated x.ts", "edit without diff details omits counts");
	const shown = (row: Row, width: number) => paint(row, row.text, width - row.text.length).replace(/\x1b\[/g, "^");
	check(
		shown(swap[0], 27) === "^48;2;61;1;0m^38;2;220;90;90m 1 -^38;2;248;248;242mconst total = a ^48;2;92;2;0m+^48;2;61;1;0m b;   ^0m",
		"a removed row: red number and sign, line colour to the edge, the changed word brighter (Claude 2.1.280)",
	);
	check(
		shown(swap[1], 26) === "^48;2;0;27;41m^38;2;81;160;200m 1 +^38;2;248;248;242mconst total = a ^48;2;0;48;71m-^48;2;0;27;41m b;  ^0m",
		"an added row: blue number and sign on the added pair of colours",
	);
	check(shown({ kind: "context", text: " 1  one" }, 7) === "^38;2;248;248;242m 1  one^0m", "a context row has no background; number and code share the code colour");
	check(
		JSON.stringify(wrapRow({ kind: "code", text: " 4 aaaa bbbb cccc" }, 10).map((row) => row.text)) === JSON.stringify([" 4 aaaa ", "   bbbb ", "   cccc"]),
		"a written line wraps under its code, like Claude's Write preview",
	);
	check(shown(wrapRow({ kind: "removed", text: " 7 -aaaabbbbcccc" }, 12)[1], 12) === "^48;2;61;1;0m^38;2;220;90;90m   -^38;2;248;248;242mcccc    ^0m", "a wrapped row repeats the sign in the gutter colour");

	const YELLOW = "\x1b[38;2;230;219;116m";
	const paintCode: Highlight = (code) => code.replace(/"[^"]*"/g, (text) => `${YELLOW}${text}\x1b[39m`);
	check(
		JSON.stringify(tints(`a ${YELLOW}"b"\x1b[39m c`, 4)) === JSON.stringify([[6, 9, YELLOW]]),
		"a highlighter's escapes are read back as plain-text colour runs",
	);
	const lit = diffRows(['-1 const s = "old";', '+1 const s = "new";', ' 2 const t = "keep";'], paintCode);
	check(lit[0].fg === undefined, "a removed line is never syntax-highlighted — Claude branches on the marker before tokenising");
	check(JSON.stringify(lit[1].fg) === JSON.stringify([[14, 19, YELLOW]]), "the added line is tinted, offset past the gutter");
	check(JSON.stringify(lit[2].fg) === JSON.stringify([[14, 20, YELLOW]]), "a context line keeps its tokens too");
	const PINK = "\x1b[38;2;249;38;114m";
	const asKeyword: Highlight = (code) => code.replace(/\b(const|for|return)\b/g, (word) => `${PINK}${word}\x1b[39m`);
	const kw = diffRows(["+1 const x = 1;", "+2 for (;;) return;"], asKeyword);
	check(
		JSON.stringify(kw[0].fg) === JSON.stringify([[4, 9, "\x1b[38;2;102;217;239m"]]),
		"const takes Claude's storage cyan, not the keyword pink",
	);
	check(
		JSON.stringify(kw[1].fg) === JSON.stringify([[4, 7, PINK], [13, 19, PINK]]),
		"for and return stay pink — only the sixteen storage words move",
	);
	check(
		JSON.stringify(diffRows(['+1 s = "const";'], (code) => code.replace(/"const"/, (t) => `${PINK}${t}\x1b[39m`))[0].fg) ===
			JSON.stringify([[8, 15, PINK]]),
		"a run reading \"const\" with its quotes is a string and is left alone",
	);
	const litRow = shown(lit[1], 24);
	check(
		litRow.includes("^38;2;230;219;116m") && litRow.includes("^48;2;0;48;71m") && litRow.startsWith("^48;2;0;27;41m"),
		"one row carries all three: line background, changed-word background and the token colour",
	);
	check(
		diffRows(["-1 a", "+1 b"], () => "different text")[0].fg === undefined,
		"a highlighter that rewrites the text is ignored rather than shifting colours onto the wrong characters",
	);
	const wrappedTint = wrapRow({ kind: "added", text: " 7 +aaaa bbbb", fg: [[6, 12, YELLOW]] }, 9);
	check(
		JSON.stringify(wrappedTint.map((row) => row.fg)) === JSON.stringify([[[6, 9, YELLOW]], [[4, 7, YELLOW]]]),
		"a token colour crossing the wrap is cut and re-based like a changed-word span",
	);

	const wide: Row = { kind: "added", text: " 7 +aaaabbbbccccdddd" };
	const wrapped = wrapRow(wide, 12);
	check(
		wrapped.map((row) => row.text).join("|") === " 7 +aaaabbbb|   +ccccdddd",
		"a long line wraps: the number column blanks out but the sign repeats",
	);
	check(wrapRow({ kind: "added", text: " 7 +short" }, 40).length === 1, "a line that fits is not split");
	check(wrapRow({ kind: "code", text: "3 aaaa bbbb cc" }, 11).every((row) => row.text.length <= 11), "a space right at the edge stays inside the width, so no piece gets cut with an ellipsis");
	check(wrapRow({ kind: "muted", text: "     ..." }, 4).length === 1, "the gap row is never wrapped");
	check(
		wrapRow({ kind: "context", text: " 7  const total = a + b;" }, 16).map((row) => row.text).join("|") === " 7  const total |    = a + b;",
		"the break lands on a space and keeps it, so nothing shifts",
	);
	const carried = wrapRow({ kind: "removed", text: " 7 -aaaabbbbcccc", hi: [[6, 14]] }, 12);
	check(
		JSON.stringify(carried.map((row) => row.hi)) === "[[[6,12]],[[4,6]]]",
		"a span crossing the wrap is cut and re-based onto both rows",
	);
	const longDiff = Array.from({ length: 25 }, (_, i) => `+${i} x`).join("\n");
	const rows = resultRows("edit", { path: "x" }, ok("", { diff: longDiff }), view(), plain)!.rows;
	check(rows.length === 25, "an edit shows its whole diff — only a write truncates");
	check(more(1, "ctrl+o to expand")[0].text === "… +1 line (ctrl+o to expand)", "the hint says one line, not one lines");
	console.log("\nAll claude-tools checks passed.");
}
