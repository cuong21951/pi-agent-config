import { runningDescription } from "./verbs.ts";

type Kind = "search" | "read" | "list" | "bash" | "write" | "own" | "other" | "thought" | `mcp:${string}`;
type Args = Record<string, unknown>;
export type Brush = { fg: (role: string, text: string) => string; bold: (text: string) => string };
export type Describe = (args: Args) => { activity?: string; hint?: string };
type Execute = (id: string, params: any, ...rest: any[]) => any;
type Task = { text: string; at: number; call?: { name: string; args: Args } };

const shared = ((globalThis as any).__claudeRows ??= {}) as Record<string, any>;
const slot = <T>(key: string, make: () => T): T => (shared[key] ??= make()) as T;
export const finished = slot("finished", () => new Set<string>());
export const failed = slot("failed", () => new Set<string>());
export const retried = slot("retried", () => new Set<number>());
const order = slot("order", () => [] as string[]);
const position = slot("position", () => new Map<string, number>());
const kinds = slot("kind", () => new Map<string, Kind>());
const breaks = slot("breaks", () => new Set<string>());
const repaint = slot("repaint", () => new Map<string, () => void>());
const dropped = slot("dropped", () => new Set<string>());
const thoughtMs = slot("thoughtMs", () => new Map<string, number>());
const thoughts = slot("thoughts", () => new Map<string, string>());
const joinedAt = slot("joinedAt", () => new Map<string, number>());
const startedAt = slot("startedAt", () => new Map<string, number>());
const born = slot("born", () => new Map<string, number>());
const live = slot("live", () => new Set<string>());
const tools = slot("tools", () => new Map<string, string>());
const inputs = slot("inputs", () => new Map<string, Args>());
const outputLines = slot("outputLines", () => new Map<string, number>());
const servers = slot("servers", () => new Map<string, string>());
const describers = slot("describers", () => new Map<string, Describe>());
const executes = slot("executes", () => new Set<string>());
const ended = slot("ended", () => new Map<number, number>());
const shownHints = slot("shownHints", () => new Map<string, { text?: string; at: number }>());
shared.pendingBreak ??= true;
shared.loading ??= false;
position.clear();
order.forEach((id, at) => position.set(id, at));

const THOUGHT_CAP_MS = 600_000;
const THOUGHT_HINT_HOLD_MS = 3000;
const HINT_THROTTLE_MS = 700;
const ELAPSED_SHOWN_AFTER_MS = 2000;
const PROGRESS_SHOWN_AFTER_MS = 3000;
const ACTIVITY_CHARS = 50;
const THOUGHT_HINT_LINES = 10;
const ELBOW = "  ⎿  ";
const HANG = " ".repeat(ELBOW.length);
const GUTTER = "  ";

export const BLINK_MS = 600;

// ponytail: Claude's own classifier, measured: Read counts as read, Grep and Glob as search, Bash as
// bash, Edit/Write/NotebookEdit are pulled out into an edit bucket that keeps its own row, a Task counts
// as nothing at all, and every remaining tool falls into the catch-all that reads "called N tools".
const KIND: Record<string, Kind> = {
	read: "read",
	grep: "search",
	find: "search",
	ls: "list",
	bash: "bash",
	write: "write",
	edit: "write",
	skill: "own",
	Agent: "own",
	SubagentWorkflow: "own",
	ask_user_question: "own",
	fetch_content: "own",
	web_search: "own",
	exit_plan_mode: "own",
	enter_plan_mode: "own",
};
const OWN_ROW: ReadonlySet<Kind> = new Set(["write", "own"]);
const CLASSIFY_SEPARATOR = /\|\||&&|[;\n|]/;
const SEARCH_WORDS = new Set(["find", "grep", "rg", "ag", "ack", "locate", "which", "whereis"]);
const READ_WORDS = new Set(["cat", "head", "tail", "less", "more", "wc", "stat", "file", "strings", "jq", "awk", "cut", "sort", "uniq", "tr"]);
const LIST_WORDS = new Set(["ls", "tree", "du"]);
const NEUTRAL_WORDS = new Set(["echo", "printf", "true", "false", ":"]);
const READONLY_WORDS = new Set([...SEARCH_WORDS, ...READ_WORDS, ...LIST_WORDS, ...NEUTRAL_WORDS]);
const EXIT_CODE = /exit(?:ed with)? code:? ([1-9]\d*)/;

function topLevelSplit(command: string, separator: RegExp): string[] {
	const sticky = new RegExp(separator.source, "y");
	const parts: string[] = [];
	let depth = 0;
	let quote = "";
	let start = 0;
	let i = 0;
	while (i < command.length) {
		const ch = command[i];
		if (quote) {
			if (ch === "\\" && quote === '"' && i + 1 < command.length) i += 2;
			else {
				if (ch === quote) quote = "";
				i++;
			}
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
			i++;
			continue;
		}
		if (ch === "(") {
			depth++;
			i++;
			continue;
		}
		if (ch === ")") {
			depth = Math.max(0, depth - 1);
			i++;
			continue;
		}
		if (depth === 0) {
			sticky.lastIndex = i;
			const match = sticky.exec(command);
			if (match) {
				parts.push(command.slice(start, i));
				i += match[0].length;
				start = i;
				continue;
			}
		}
		i++;
	}
	parts.push(command.slice(start));
	return parts;
}

function bashReadonlyKind(command: string): Kind | undefined {
	let sawSearch = false;
	let sawRead = false;
	let sawList = false;
	for (const part of topLevelSplit(command, CLASSIFY_SEPARATOR)) {
		const word = part.trim().split(/\s+/)[0];
		if (!word || NEUTRAL_WORDS.has(word)) continue;
		if (!READONLY_WORDS.has(word)) return undefined;
		if (LIST_WORDS.has(word)) sawList = true;
		else if (SEARCH_WORDS.has(word)) sawSearch = true;
		else sawRead = true;
	}
	if (sawList) return "list";
	if (sawSearch) return "search";
	if (sawRead) return "read";
	return undefined;
}

// ponytail: an interrupt reaches a tool as "Operation aborted" / "Command aborted" and the reply that follows
// as the error "This operation was aborted"; Claude draws one grey "⎿ Interrupted · What should Claude do
// instead?" for the turn, which the pi-coding-agent patch prints, so tool rows draw nothing for it.
export function isAbort(text: string | undefined): boolean {
	return /^(Error: )?(This operation was|Operation|Command) aborted\.?$/i.test((text ?? "").trim());
}

export function blinkOn(now = Date.now()): boolean {
	return Math.floor(now / BLINK_MS) % 2 === 0;
}

export type Component = { render(width: number): string[]; invalidate(): void };

export function dynamic(render: (width: number) => string[]): Component {
	return { render, invalidate() {} };
}

export function kindOf(toolName: string, args?: { command?: unknown }): Kind {
	return KIND[toolName] ?? "other";
}

export function clip(text: string, max = ACTIVITY_CHARS): string {
	return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

const FAINT_ITALIC = "\x1b[2m\x1b[3m";
const UPRIGHT = "\x1b[23m\x1b[22m";
const CODE_BLUE = "\x1b[38;2;153;204;255m";

export function thoughtText(line: string): string {
	const parts = line.split("`").map((part, i) => (i % 2 === 1 ? `${CODE_BLUE}${part}\x1b[39m` : part));
	return FAINT_ITALIC + parts.join("") + UPRIGHT;
}

export function wrapWords(text: string, room: number): string[] {
	const words = text.split(/\s+/).filter((word) => word !== "");
	if (room < 1 || words.length === 0) return [text];
	const lines: string[] = [];
	let line = "";
	let limit = room;
	for (const word of words) {
		const next = line === "" ? word : `${line} ${word}`;
		if (next.length > limit && line !== "") {
			lines.push(line);
			limit = line.length >= limit ? room - 1 : room;
			line = word;
		} else line = next;
	}
	lines.push(line);
	return lines;
}

// ponytail: pi repaints a block only when that block changes, so a member that must vanish once a
// later call joins its group is repainted by hand through the render context it handed us.
export function watch(id: string, invalidate: () => void): void {
	repaint.set(id, invalidate);
}

function repaintAll(): void {
	for (const invalidate of repaint.values()) invalidate();
}

export function describeTool(toolName: string, describe: Describe): void {
	describers.set(toolName, describe);
}

function place(id: string, kind: Kind, at: number): void {
	if (kinds.has(id) || dropped.has(id)) return;
	position.set(id, order.length);
	order.push(id);
	kinds.set(id, kind);
	joinedAt.set(id, at);
	if (shared.pendingBreak) breaks.add(id);
	shared.pendingBreak = false;
}

function unplace(id: string): void {
	const at = position.get(id);
	if (at === undefined) return;
	order.splice(at, 1);
	position.delete(id);
	for (let i = at; i < order.length; i++) position.set(order[i], i);
	kinds.delete(id);
	if (breaks.delete(id)) shared.pendingBreak = true;
}

function kindFor(id: string, toolName: string, args: Args): Kind {
	const server = servers.get(id);
	return server === undefined ? kindOf(toolName, args) : `mcp:${server}`;
}

export function join(id: string, toolName: string, args: Args = {}, now = Date.now()): void {
	if (kinds.has(id)) return;
	tools.set(id, toolName);
	if (!inputs.has(id)) inputs.set(id, args);
	place(id, kindFor(id, toolName, args), born.get(id) ?? now);
	live.add(id);
	startedAt.set(id, now);
}

export function joinOnExecute<T extends Execute>(toolName: string, execute: T): T {
	executes.add(toolName);
	return ((id: string, params: Args, ...rest: unknown[]) => {
		join(id, toolName, params ?? {});
		return execute(id, params, ...rest);
	}) as T;
}

// ponytail: Claude merges consecutive calls to one MCP server into "Called dse 2 times" (measured). The
// pi-mcp-adapter patch reports the server when it draws the row; the call was placed as "other" before.
export function noteServer(id: string, server: string): void {
	servers.set(id, server);
	if (kinds.has(id)) kinds.set(id, `mcp:${server}`);
}

// ponytail: only a write keeps its own row — its "● Update(path)" block and diff are the point of it.
// Everything else, known tool or not, folds into the one grey sentence.
function member(id: string): boolean {
	const kind = kinds.get(id);
	return kind !== undefined && !OWN_ROW.has(kind);
}

export function groupOf(id: string): string[] | null {
	const at = position.get(id);
	if (at === undefined || !member(id)) return null;
	let start = at;
	while (start > 0 && !breaks.has(order[start]) && member(order[start - 1])) start--;
	let end = at;
	while (end + 1 < order.length && !breaks.has(order[end + 1]) && member(order[end + 1])) end++;
	return order.slice(start, end + 1);
}

function running(id: string): boolean {
	return live.has(id) && !finished.has(id);
}

function isActive(group: string[]): boolean {
	return group.some(running) || (shared.loading && !shared.pendingBreak && group[group.length - 1] === order[order.length - 1]);
}

// ponytail: the clause order is Claude's own, read off the 2.1.261 summary builder: search, read, list,
// then the MCP servers, then bash last. The reconstructed sources on GitHub say "queried" for MCP; the
// binary says "called", so "called" it is.
const LEADING: Array<[Kind, string, string, string, string]> = [
	["search", "searched for", "searching for", "pattern", "patterns"],
	["read", "read", "reading", "file", "files"],
	["list", "listed", "listing", "directory", "directories"],
];

export function duration(ms: number): string {
	if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
	const seconds = Math.round((ms % 60_000) / 1000);
	const minutes = Math.floor(ms / 60_000) + (seconds === 60 ? 1 : 0);
	const [d, h, m, s] = [Math.floor(minutes / 1440), Math.floor((minutes % 1440) / 60), minutes % 60, seconds % 60];
	if (d > 0) return `${d}d ${h}h ${m}m`;
	if (h > 0) return `${h}h ${m}m ${s}s`;
	return `${m}m ${s}s`;
}

function thoughtTime(group: string[], active: boolean, now: number): number {
	const thought = group.filter((member) => kinds.get(member) === "thought");
	const base = thought.reduce((sum, member) => sum + (thoughtMs.get(member) ?? 0), 0);
	const since = shared.thinkingSince as number | undefined;
	if (!active || since === undefined) return base;
	const last = joinedAt.get(thought[thought.length - 1]) ?? 0;
	return base + Math.min(THOUGHT_CAP_MS, Math.max(0, now - Math.max(since, last)));
}

function shellCount(group: string[], unclassified: (member: string) => boolean, classified: (member: string) => boolean): number {
	let before = 0;
	let peak = 0;
	for (let i = 0; i < group.length; i++) {
		if (i > 0 && classified(group[i])) peak = Math.max(peak, before + 1);
		if (unclassified(group[i])) before++;
	}
	return Math.max(peak, before);
}

function sentence(group: string[], active: boolean, bold: (text: string) => string, now: number): string {
	const bashReadonly = (member: string): Kind | undefined =>
		kinds.get(member) === "bash" ? bashReadonlyKind(String(inputs.get(member)?.command ?? "")) : undefined;
	const unclassifiedBash = (member: string): boolean => kinds.get(member) === "bash" && bashReadonly(member) === undefined;
	const classifiedShell = (member: string): boolean => bashReadonly(member) !== undefined || tools.get(member) === "ls";
	const count = (kind: Kind) =>
		group.filter((member) => kinds.get(member) === kind).length +
		(kind === "search" || kind === "read" || kind === "list" ? group.filter((member) => bashReadonly(member) === kind).length : 0);
	const clauses = (phrases: Array<[Kind, string, string, string, string]>) =>
		phrases
			.map(([kind, past, ing, one, many]) => [count(kind), active ? ing : past, one, many] as const)
			.filter(([n]) => n > 0)
			.map(([n, verb, one, many]) => `${verb} ${bold(String(n))} ${n === 1 ? one : many}`);
	const call = active ? "calling" : "called";
	const named = [...new Set(group.map((member) => kinds.get(member) ?? "").filter((kind) => kind.startsWith("mcp:")))];
	const called = named.map((kind) => {
		const n = count(kind as Kind);
		return n === 1 ? `${call} ${kind.slice(4)}` : `${call} ${kind.slice(4)} ${bold(String(n))} times`;
	});
	const others = count("other");
	if (others > 0) called.push(`${call} ${bold(String(others))} ${others === 1 ? "tool" : "tools"}`);
	const thinking = count("thought") > 0 ? [`${active ? "thinking" : "thought"} for ${bold(duration(Math.max(1000, thoughtTime(group, active, now))))}`] : [];
	const bashCount = shellCount(group, unclassifiedBash, classifiedShell);
	const bash = bashCount > 0 ? [`${active ? "running" : "ran"} ${bold(String(bashCount))} ${bashCount === 1 ? "shell command" : "shell commands"}`] : [];
	return [...thinking, ...clauses(LEADING), ...called, ...bash].join(", ").replace(/^./, (first) => first.toUpperCase());
}

// ponytail: null = not part of a group (draw the tool's own row); "" = a hidden member (draw nothing).
export function summaryFor(id: string, bold: (text: string) => string = (text) => text): string | null {
	if (dropped.has(id)) return "";
	const group = groupOf(id);
	if (!group) return null;
	if (group[group.length - 1] !== id) return "";
	return GUTTER + sentence(group, false, bold, Date.now());
}

function described(id: string): { activity?: string; hint?: string } {
	const args = inputs.get(id) ?? {};
	const own = describers.get(tools.get(id) ?? "");
	if (own) return own(args);
	return kinds.get(id)?.startsWith("mcp:") && typeof args.query === "string" ? { hint: `"${args.query}"` } : {};
}

export function taskOf(toolName: string, args: Args): string {
	const questions = args.questions as Array<{ question?: unknown }> | undefined;
	const question = Array.isArray(questions) && typeof questions[0]?.question === "string" ? (questions[0].question as string) : undefined;
	const description = typeof args.description === "string" ? args.description : "";
	const text = question ?? ((description && runningDescription(description)) || describers.get(toolName)?.(args).activity || "");
	return text.replace(/\s+/g, " ").trim();
}

function taskFor(group: string[]): string | undefined {
	const task = shared.task as Task | undefined;
	return task !== undefined && task.at >= (joinedAt.get(group[0]) ?? Number.POSITIVE_INFINITY) ? task.text : undefined;
}

function runningAnchor(group: string[]): number | undefined {
	for (let i = group.length - 1; i >= 0; i--) if (running(group[i])) return joinedAt.get(group[i]);
	return undefined;
}

function thoughtHint(group: string[], now: number): string | undefined {
	let at = group.length - 1;
	while (at >= 0 && kinds.get(group[at]) !== "thought") at--;
	if (at < 0) return undefined;
	const held = now - (joinedAt.get(group[at]) ?? 0) < THOUGHT_HINT_HOLD_MS;
	return (at === group.length - 1 && pendingHint(group) === undefined) || held ? thoughts.get(group[at]) : undefined;
}

function pendingHint(group: string[]): string | undefined {
	const task = shared.task as Task | undefined;
	const last = group[group.length - 1];
	if (task?.call === undefined || kinds.get(last) !== "thought" || task.at < (joinedAt.get(last) ?? Number.POSITIVE_INFINITY)) return undefined;
	return describers.get(task.call.name)?.(task.call.args).hint || undefined;
}

function displayHint(group: string[], now: number): string | undefined {
	let hint = pendingHint(group);
	for (let i = group.length - 1; i >= 0 && hint === undefined; i--) hint = described(group[i]).hint || undefined;
	const shown = shownHints.get(group[0]);
	if (shown === undefined) shownHints.set(group[0], { text: hint, at: 0 });
	else if (shown.text !== hint && now - shown.at >= HINT_THROTTLE_MS) shownHints.set(group[0], { text: hint, at: now });
	return shownHints.get(group[0])?.text;
}

function progress(group: string[], now: number): string {
	let longest: string | undefined;
	for (const id of group) {
		if (!running(id) || tools.get(id) !== "bash") continue;
		if (longest === undefined || (startedAt.get(id) ?? now) < (startedAt.get(longest) ?? now)) longest = id;
	}
	const ms = longest === undefined ? 0 : now - (startedAt.get(longest) ?? now);
	if (longest === undefined || ms < PROGRESS_SHOWN_AFTER_MS) return "";
	const seconds = duration(Math.floor(ms / 1000) * 1000);
	const lines = outputLines.get(longest) ?? 0;
	return lines > 0 ? ` (${seconds} · ${lines} ${lines === 1 ? "line" : "lines"})` : ` (${seconds})`;
}

function thoughtLines(text: string, room: number): string[] {
	const lines = wrapWords(text, room);
	if (lines.length <= THOUGHT_HINT_LINES) return lines;
	let kept = lines.slice(0, THOUGHT_HINT_LINES).join(" ");
	while (kept.length > 0 && wrapWords(`${kept}…`, room).length > THOUGHT_HINT_LINES) kept = kept.slice(0, -1);
	return wrapWords(`${kept.trimEnd()}…`, room);
}

function hintRows(group: string[], width: number, brush: Brush, now: number): string[] {
	const room = Math.max(1, width - ELBOW.length);
	const display = displayHint(group, now);
	const thought = thoughtHint(group, now);
	if (thought !== undefined) return thoughtLines(thought, room).map((line, i) => (i === 0 ? brush.fg("muted", ELBOW) : HANG) + thoughtText(line));
	if (display === undefined) return [];
	return wrapWords(display + progress(group, now), room).map((line, i) => brush.fg("muted", (i === 0 ? ELBOW : HANG) + line));
}

export function groupRow(id: string, width: number, brush: Brush, now = Date.now()): string[] {
	const group = dropped.has(id) ? null : groupOf(id);
	if (!group || group[group.length - 1] !== id) return [];
	if (!isActive(group)) return [brush.fg("muted", GUTTER + sentence(group, false, brush.bold, now))];
	const task = taskFor(group);
	const anchor = runningAnchor(group);
	const elapsed = anchor !== undefined && now - anchor >= ELAPSED_SHOWN_AFTER_MS ? brush.fg("muted", ` · ${duration(now - anchor)}`) : "";
	const dot = blinkOn(now) || group.some((member) => failed.has(member)) ? brush.fg("muted", "● ") : "  ";
	const head = dot + (task ?? sentence(group, true, brush.bold, now)) + elapsed + (task === undefined ? "…" : "");
	return [head, ...hintRows(group, width, brush, now)];
}

type Block = { type: string; id?: string; name?: string; arguments?: unknown; text?: string; thinking?: string };
type Message = { role?: string; toolCallId?: string; isError?: boolean; stopReason?: string; timestamp?: number; content?: Block[] | string };
type Entry = { type?: string; timestamp?: string; message?: Message };
type Streamed = { type?: string; contentIndex?: number; content?: unknown };

export function thoughtId(message: { timestamp?: number }): string {
	return `thought:${message.timestamp}`;
}

export function hasThought(content: Block[] | string | undefined): boolean {
	return typeof content !== "string" && (content ?? []).some((block) => block.type === "thinking" && (block.thinking ?? "").trim() !== "");
}

function thoughtSummary(content: Block[] | string | undefined): string {
	const blocks = typeof content === "string" ? [] : (content ?? []).filter((block) => block.type === "thinking" && (block.thinking ?? "").trim() !== "");
	return (blocks[blocks.length - 1]?.thinking ?? "").trim().replace(/\s+/g, " ");
}

export function shownContent<T extends { type: string }>(content: T[], timestamp: number | undefined): T[] {
	const last = timestamp === undefined ? -1 : (ended.get(timestamp) ?? -1);
	return content.filter((block, i) => i <= last || (block.type !== "text" && block.type !== "thinking"));
}

function noteThought(message: Message, ms: number, at: number): void {
	if (!hasThought(message.content) || neverRan(message)) return;
	const id = thoughtId(message);
	place(id, "thought", at);
	thoughtMs.set(id, Math.min(THOUGHT_CAP_MS, Math.max(0, ms)));
	thoughts.set(id, thoughtSummary(message.content));
}

function hasText(content: Block[] | string | undefined): boolean {
	if (typeof content === "string") return content.trim() !== "";
	return (content ?? []).some((block) => block.type === "text" && (block.text ?? "").trim() !== "");
}

function neverRan(message: { stopReason?: string }): boolean {
	return message.stopReason === "error" || message.stopReason === "aborted";
}

function toolCalls(content: Block[] | string | undefined): Block[] {
	return typeof content === "string" ? [] : (content ?? []).filter((block) => block.type === "toolCall" && block.id);
}

function drop(content: Block[] | string | undefined): void {
	for (const block of toolCalls(content)) {
		dropped.add(block.id!);
		finished.add(block.id!);
		unplace(block.id!);
	}
}

export function seed(entries: Iterable<Entry>): void {
	let previousAt = Number.NaN;
	let lastError: number | undefined;
	for (const entry of entries) {
		const at = Date.parse(entry.timestamp ?? "");
		const message = entry.type === "message" ? entry.message : undefined;
		if (message?.role === "user") {
			shared.pendingBreak = true;
			lastError = undefined;
		}
		if (message?.role === "assistant") {
			if (lastError !== undefined) retried.add(lastError);
			lastError = message.stopReason === "error" ? message.timestamp : undefined;
			noteThought(message, at - previousAt || 0, at);
			if (hasText(message.content)) shared.pendingBreak = true;
			if (neverRan(message)) drop(message.content);
			else
				for (const block of toolCalls(message.content)) {
					const args = (block.arguments ?? {}) as Args;
					tools.set(block.id!, block.name ?? "");
					inputs.set(block.id!, args);
					place(block.id!, kindFor(block.id!, block.name ?? "", args), at);
				}
		}
		if (message?.role === "toolResult" && message.toolCallId) {
			finished.add(message.toolCallId);
			if (message.isError) failed.add(message.toolCallId);
		}
		if (!Number.isNaN(at)) previousAt = at;
	}
}

function resultText(result: { content?: Array<{ type: string; text?: string }> } | undefined): string {
	return (result?.content ?? []).map((block) => (block.type === "text" ? block.text ?? "" : "")).join("\n");
}

function lineCount(text: string): number {
	const body = text.replace(/\n$/, "");
	return body === "" ? 0 : body.split("\n").length;
}

function streamed(update: Streamed | undefined, message: Message, boundary: number): void {
	const now = Date.now();
	if (update?.type === "thinking_start") shared.thinkingSince = now;
	if (update?.type === "thinking_end") {
		shared.thinkingSince = undefined;
		noteThought(message, now - boundary, now);
	}
	if (update?.type === "text_end" && String(update.content ?? "").trim() !== "") shared.pendingBreak = true;
	if (update?.type?.endsWith("_end") && typeof update.contentIndex === "number" && message.timestamp !== undefined)
		ended.set(message.timestamp, Math.max(ended.get(message.timestamp) ?? -1, update.contentIndex));
}

// ponytail: the pi-mcp-adapter patch lives in node_modules and cannot import this file, so it reaches
// the same functions through the shared object.
Object.assign(shared, { summaryFor, groupRow, noteServer, watch });

export function track(pi: { on: (event: string, handler: (event: any, ctx: any) => void) => void }): void {
	let boundary = Date.now();
	pi.on("session_start", (_event, ctx) => {
		shared.loading = false;
		shared.task = undefined;
		seed(ctx.sessionManager.getEntries());
	});
	pi.on("agent_start", () => {
		shared.pendingBreak = true;
		shared.loading = true;
		shared.task = undefined;
		boundary = Date.now();
	});
	pi.on("agent_end", () => {
		shared.loading = false;
		shared.task = undefined;
		shared.thinkingSince = undefined;
		repaintAll();
	});
	pi.on("message_update", (event) => {
		if (event.message?.role === "assistant") streamed(event.assistantMessageEvent, event.message, boundary);
	});
	pi.on("message_end", (event) => {
		const message = event.message;
		const now = Date.now();
		if (message?.role === "assistant") {
			if (message.timestamp !== undefined) ended.delete(message.timestamp);
			shared.thinkingSince = undefined;
			if (neverRan(message)) {
				drop(message.content);
				unplace(thoughtId(message));
			} else {
				const calls = toolCalls(message.content);
				for (const call of calls) born.set(call.id!, now);
				const last = calls[calls.length - 1];
				const text = last ? taskOf(last.name ?? "", (last.arguments ?? {}) as Args) : "";
				if (last) shared.task = text === "" ? undefined : ({ text, at: now, call: { name: last.name ?? "", args: (last.arguments ?? {}) as Args } } satisfies Task);
			}
		}
		boundary = now;
	});
	pi.on("tool_call", (event) => {
		if (!executes.has(event.toolName)) join(event.toolCallId, event.toolName, event.input ?? {});
	});
	pi.on("tool_execution_start", (event) => {
		finished.delete(event.toolCallId);
		failed.delete(event.toolCallId);
		tools.set(event.toolCallId, event.toolName);
		inputs.set(event.toolCallId, event.args ?? {});
	});
	pi.on("tool_execution_update", (event) => {
		outputLines.set(event.toolCallId, lineCount(resultText(event.partialResult)));
	});
	pi.on("tool_execution_end", (event) => {
		join(event.toolCallId, event.toolName, inputs.get(event.toolCallId) ?? {});
		finished.add(event.toolCallId);
		if (event.isError || EXIT_CODE.test(resultText(event.result))) failed.add(event.toolCallId);
		repaintAll();
	});
}

if (process.env.CLAUDE_ROWS_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain: Brush = { fg: (_role, text) => text, bold: (text) => text };
	const tagged: Brush = { fg: (role, text) => `<${role}>${text}</${role}>`, bold: (text) => `<b>${text}</b>` };
	const bare = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");
	const on = (now: number) => (blinkOn(now) ? now : (Math.floor(now / BLINK_MS) + 1) * BLINK_MS);
	check(blinkOn(0) && !blinkOn(600) && blinkOn(1200), "dot blinks every 600 ms");
	const calls: Record<string, (e: any, ctx: any) => void> = {};
	track({ on: (name, handler) => (calls[name] = handler) });
	const run = (id: string, toolName: string, args: Args = {}, result?: string, isError = false) => {
		calls.tool_execution_start({ toolCallId: id, toolName, args }, {});
		calls.tool_call({ toolCallId: id, toolName, input: args }, {});
		calls.tool_execution_end({ toolCallId: id, toolName, isError, result: result === undefined ? undefined : { content: [{ type: "text", text: result }] } }, {});
	};
	calls.agent_start({}, {});
	calls.tool_execution_start({ toolCallId: "a", toolName: "read", args: {} }, {});
	check(summaryFor("a") === null && groupRow("a", 80, plain).length === 0, "a call that has not started executing is in no group and draws nothing, like Claude before the tool_use joins");
	calls.tool_call({ toolCallId: "a", toolName: "read", input: {} }, {});
	check(!finished.has("a") && summaryFor("a") === "  Read 1 file", "a running call already belongs to its group");
	calls.tool_execution_end({ toolCallId: "a", toolName: "read", isError: true }, {});
	check(finished.has("a") && failed.has("a") && summaryFor("a") === "  Read 1 file", "end marks finished; a failed call folds into the group like Claude 2.1.280's failed bash and MCP calls");
	calls.agent_start({}, {});
	run("b", "grep");
	run("c", "read");
	run("d", "read");
	check(summaryFor("b") === "" && summaryFor("c") === "", "earlier members of a group draw nothing");
	check(summaryFor("d", (t) => `<b>${t}</b>`) === "  Searched for <b>1</b> pattern, read <b>2</b> files", "last member draws Claude's group line, counts bold");
	calls.message_update({ message: { role: "assistant", timestamp: 7 }, assistantMessageEvent: { type: "text_end", contentIndex: 0, content: "Now the shell." } }, {});
	run("e", "bash", { command: "ls -la" }, "a\nb");
	run("f", "bash", { command: "git status" }, "ok");
	check(summaryFor("d") === "  Searched for 1 pattern, read 2 files", "assistant text closes the group the moment the text block ends");
	check(summaryFor("e") === "" && summaryFor("f") === "  Listed 1 directory, ran 1 shell command", "a classified bash call that opens its group earns no shell-command credit (shell-credit replay case A, Claude 2.1.280)");
	run("g", "bash", { command: "false" }, "Command exited with code 1");
	check(failed.has("g") && summaryFor("f") === "" && summaryFor("g") === "  Listed 1 directory, ran 2 shell commands", "a non-zero exit folds into the group like Claude 2.1.280");
	calls.agent_start({}, {});
	run("gitmv", "bash", { command: "git -C . mv src/util.ts src/helpers.ts 2>&1 || mv src/util.ts src/helpers.ts" }, "fatal: not a git repository");
	run("lssrc", "ls", { path: "src" }, "app.ts\nhelpers.ts");
	check(
		summaryFor("lssrc") === "  Listed 1 directory, ran 2 shell commands",
		"a bash call is exactly 1 shell command no matter how many || / ; / && segments it chains, and pi's ls tool (Bash `ls` to Claude) joining after it peaks the count at 2 (shell-credit replay case E, Claude 2.1.280)",
	);
	calls.agent_start({}, {});
	run("buildcheck", "bash", { command: "ls; cat package.json 2>/dev/null; npx tsc --noEmit 2>&1 | head -30" }, "no errors");
	check(
		summaryFor("buildcheck") === "  Ran 1 shell command",
		"a ; chain poisoned by an unrecognized command (npx) never counts as a listing, only as 1 shell command (Claude 2.1.280)",
	);
	calls.agent_start({}, {});
	run("nestedor", "bash", { command: "cd $(dirname $(find . -name tsconfig.json 2>/dev/null | head -1) 2>/dev/null || pwd) 2>/dev/null; ls; npx tsc --noEmit 2>&1 | head -50" }, "no errors");
	check(summaryFor("nestedor") === "  Ran 1 shell command", "an unrecognized leading word (cd) voids classification for the whole call, leaving just 1 shell command (Claude 2.1.280)");
	calls.agent_start({}, {});
	run("catalone", "bash", { command: "cat src/util.ts" }, "export function clamp() {}");
	check(summaryFor("catalone") === "  Read 1 file", "a classified bash call alone in its group (Claude's TASK.md `ls src` / `ls ./missing-folder` steps) shows only its clause, no shell-command credit (Claude 2.1.280)");
	calls.agent_start({}, {});
	run("companiongrep", "grep");
	run("companioncat", "bash", { command: "cat src/util.ts" }, "export function clamp() {}");
	check(
		summaryFor("companioncat") === "  Searched for 1 pattern, read 1 file, ran 1 shell command",
		"the same classified bash call also earns the shell-command credit once it shares its group with anything else (Claude 2.1.280)",
	);
	calls.agent_start({}, {});
	run("listcat", "bash", { command: "ls src/ 2>/dev/null; cat src/util.ts 2>/dev/null" }, "app.ts\nutil.ts\nexport function clamp() {}");
	check(summaryFor("listcat") === "  Listed 1 directory", "a chain mixing list and read words classifies as list only, and alone in its group carries no shell-command credit (Claude 2.1.280)");
	calls.agent_start({}, {});
	run("rtkgrep", "bash", { command: 'rtk grep -rn x src; echo "---"; ls src' }, "src/util.ts:1:x");
	check(summaryFor("rtkgrep") === "  Ran 1 shell command", "rtk is not a recognized word, so the whole call stays unclassified and always carries the shell-command credit, alone or not (Claude 2.1.280)");
	calls.agent_start({}, {});
	calls.tool_execution_start({ toolCallId: "rtkls", toolName: "bash", args: { command: "ls src" } }, {});
	joinOnExecute("bash", (id: string) => id)("rtkls", { command: "rtk ls src" });
	calls.tool_execution_end({ toolCallId: "rtkls", toolName: "bash", result: { content: [{ type: "text", text: "app.ts" }] } }, {});
	check(summaryFor("rtkls") === "  Listed 1 directory", "the model's own command is classified, not the copy rtk-bash rewrote to `rtk ls src` before execute");
	run("h", "edit");
	run("i", "read");
	check(summaryFor("h") === null && summaryFor("i") === "  Read 1 file", "an edit breaks the group");
	calls.agent_start({}, {});
	run("j", "read");
	check(summaryFor("i") === "  Read 1 file" && summaryFor("j") === "  Read 1 file", "a new prompt starts a new group");
	let repainted = 0;
	watch("j", () => repainted++);
	run("k", "read");
	check(repainted === 1 && summaryFor("j") === "" && summaryFor("k") === "  Read 2 files", "a finished call repaints the rows it hid");
	seed([
		{ type: "message", message: { role: "user", content: "hi" } },
		{ type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: "old1", name: "read", arguments: {} }, { type: "toolCall", id: "old2", name: "find", arguments: {} }] } },
		{ type: "message", message: { role: "toolResult", toolCallId: "old1", isError: false } },
		{ type: "message", message: { role: "toolResult", toolCallId: "old2", isError: false } },
	]);
	check(summaryFor("old1") === "" && summaryFor("old2") === "  Searched for 1 pattern, read 1 file", "replayed sessions group from their entries");
	seed([
		{ type: "message", message: { role: "user", content: "again" } },
		{ type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: "err1", name: "read", arguments: {} }] } },
		{ type: "message", message: { role: "toolResult", toolCallId: "err1", isError: false } },
		{ type: "message", message: { role: "assistant", stopReason: "error", timestamp: 42, content: [] } },
		{ type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: "err2", name: "read", arguments: {} }] } },
		{ type: "message", message: { role: "toolResult", toolCallId: "err2", isError: false } },
	]);
	check(summaryFor("err1") === "" && summaryFor("err2") === "  Read 2 files", "a failed reply pi retried by itself leaves the group whole: Claude 2.1.280 never records a retried API error");
	check(retried.has(42), "the retried failure is marked so its error row stays hidden on replay");
	calls.agent_start({}, {});
	for (const [id, toolName] of [["s1", "read"], ["s2", "skill"], ["s3", "read"]]) run(id, toolName);
	check(summaryFor("s2") === null && summaryFor("s1") === "  Read 1 file" && summaryFor("s3") === "  Read 1 file", "a skill keeps its own row, splits the group and is not counted — Claude's \"● Skill(pr)\" then \"  Pushed to …\"");
	seed([
		{ type: "message", message: { role: "assistant", stopReason: "error", content: [{ type: "toolCall", id: "cut1", name: "ls", arguments: {} }] } },
	]);
	check(finished.has("cut1") && summaryFor("cut1") === "", "a call streamed into a reply that failed never ran: no running dot, no row");
	calls.message_end({ message: { role: "assistant", stopReason: "aborted", content: [{ type: "toolCall", id: "cut2", name: "grep", arguments: {} }] } }, {});
	check(finished.has("cut2") && summaryFor("cut2") === "", "the same when it happens live");
	calls.agent_start({}, {});
	run("m1", "dse_get_ticket");
	noteServer("m1", "dse");
	run("m2", "dse_list_tickets");
	noteServer("m2", "dse");
	check(summaryFor("m1") === "" && summaryFor("m2", (t) => `<b>${t}</b>`) === "  Called dse <b>2</b> times", "consecutive calls to one MCP server merge like Claude's");
	run("m3", "read");
	check(summaryFor("m3") === "  Read 1 file, called dse 2 times", "a read after MCP calls joins the line");
	run("m4", "bash", { command: "git status" }, "ok");
	check(summaryFor("m4") === "  Read 1 file, called dse 2 times, ran 1 shell command", "Claude's clause order puts the servers before bash");
	calls.agent_start({}, {});
	run("o1", "grep");
	run("o2", "mcp");
	run("o3", "bash", { command: "git status" }, "ok");
	check(summaryFor("o3") === "  Searched for 1 pattern, called 1 tool, ran 1 shell command", "a tool nobody renders folds into the same sentence as 'called 1 tool' instead of splitting the group");
	run("o4", "todo");
	check(summaryFor("o4") === "  Searched for 1 pattern, called 2 tools, ran 1 shell command", "two unknown tools pluralise");
	check((globalThis as any).__claudeRows.summaryFor === summaryFor && (globalThis as any).__claudeRows.groupRow === groupRow, "the MCP patch can reach summaryFor and groupRow through globalThis");
	check(duration(0) === "0s" && duration(59_999) === "59s" && duration(65_400) === "1m 5s" && duration(119_600) === "2m 0s" && duration(3_723_000) === "1h 2m 3s" && duration(90_061_000) === "1d 1h 1m", "durations use Claude's formatter");
	const at = (s: number) => new Date(Date.UTC(2026, 8, 23, 7, 0, s)).toISOString();
	const thinking = (text: string) => ({ type: "thinking", thinking: text });
	seed([
		{ type: "message", timestamp: at(0), message: { role: "user", content: "think" } },
		{ type: "message", timestamp: at(3), message: { role: "assistant", timestamp: 1, content: [thinking("look"), { type: "toolCall", id: "t1", name: "read", arguments: {} }] } },
		{ type: "message", timestamp: at(3), message: { role: "toolResult", toolCallId: "t1", isError: false } },
		{ type: "message", timestamp: at(7), message: { role: "assistant", timestamp: 2, content: [thinking("next"), { type: "text", text: "Reading on." }, { type: "toolCall", id: "t2", name: "read", arguments: {} }] } },
		{ type: "message", timestamp: at(7), message: { role: "toolResult", toolCallId: "t2", isError: false } },
		{ type: "message", timestamp: at(9), message: { role: "assistant", timestamp: 3, content: [thinking("done"), { type: "text", text: "All done." }] } },
		{ type: "message", timestamp: at(12), message: { role: "assistant", timestamp: 4, content: [thinking("   "), { type: "text", text: "Blank thinking." }] } },
	]);
	check(summaryFor("t1") === "" && summaryFor(thoughtId({ timestamp: 2 }), (t) => `<b>${t}</b>`) === "  Thought for <b>7s</b>, read <b>1</b> file", "a hidden thought joins the open group before its reply's text closes it, times summed, like Claude 2.1.280");
	check(summaryFor(thoughtId({ timestamp: 1 })) === "" && summaryFor("t2") === "" && summaryFor(thoughtId({ timestamp: 3 })) === "  Thought for 2s, read 1 file", "the last member draws the line, even when it is the thought");
	check(summaryFor(thoughtId({ timestamp: 4 })) === null && !hasThought([thinking(" ")]), "a blank thinking block is no thought");
	check(!isAbort("boom") && isAbort("Operation aborted\n") && isAbort("Command aborted") && isAbort("This operation was aborted") && !isAbort(undefined), "abort text");
	const resumed = [
		{ type: "message", timestamp: at(20), message: { role: "user", content: "go" } },
		{ type: "message", timestamp: at(22), message: { role: "assistant", timestamp: 5, content: [thinking("run it"), { type: "toolCall", id: "live1", name: "bash", arguments: { command: "sleep 5" } }] } },
	];
	calls.session_start({}, { sessionManager: { getEntries: () => resumed } });
	check(groupRow("live1", 80, plain).join("|") === "  Thought for 2s, ran 1 shell command", "a resumed session draws every group finished, even one whose last call never got a result");

	const reply = (timestamp: number, content: unknown[], stopReason = "toolUse") => ({ role: "assistant", timestamp, stopReason, content });
	const stream = (message: object, type: string, contentIndex: number, content?: string) => calls.message_update({ message, assistantMessageEvent: { type, contentIndex, content } }, {});
	calls.agent_start({}, {});
	const thoughtOnly = reply(100, [thinking("  Let's check the   timer.  ")]);
	stream(thoughtOnly, "thinking_start", 0);
	check(groupRow(thoughtId(thoughtOnly), 80, plain).length === 0, "a thinking block still streaming draws nothing: Claude shows a block only once it is complete");
	check(shownContent(thoughtOnly.content as Array<{ type: string }>, 100).length === 0, "the streaming reply hides the thinking block until its end");
	stream(thoughtOnly, "thinking_end", 0);
	check(shownContent(thoughtOnly.content as Array<{ type: string }>, 100).length === 1, "the thinking block shows once it ended");
	const t0 = Date.now();
	const thoughtRow = groupRow(thoughtId(thoughtOnly), 80, tagged, on(t0));
	check(bare(thoughtRow[0]) === "<muted>● </muted>Thinking for <b>1s</b>…", "a thought-only active group reads Claude's \"● Thinking for 1s…\": dot, default colour, bold minimum second, ellipsis");
	check(bare(thoughtRow[1]) === "<muted>  ⎿  </muted>Let's check the timer." && thoughtRow[1].includes("\x1b[2m\x1b[3m"), "its hint row is the thought, trimmed, whitespace collapsed, faint italic");
	check(groupRow(thoughtId(thoughtOnly), 80, plain, on(t0) + BLINK_MS)[0].startsWith("  Thinking"), "the dot blinks off without moving the text");
	const textReply = reply(101, [{ type: "text", text: "Here you go." }], "stop");
	stream(textReply, "text_start", 0);
	check(shownContent(textReply.content as Array<{ type: string }>, 101).length === 0 && groupRow(thoughtId(thoughtOnly), 80, plain, t0)[0].includes("Thinking"), "streamed text stays hidden and the group stays active until the text block ends");
	stream(textReply, "text_end", 0, "Here you go.");
	check(shownContent(textReply.content as Array<{ type: string }>, 101).length === 1, "the whole text block shows at its end, in one frame");
	check(groupRow(thoughtId(thoughtOnly), 80, tagged, t0).join("|") === "<muted>  Thought for <b>1s</b></muted>", "the text closes the group: the past sentence, grey, no dot, no hint");
	calls.message_end({ message: textReply }, {});
	calls.agent_end({}, {});

	calls.agent_start({}, {});
	const toolReply = reply(200, [thinking("Run the timer now."), { type: "toolCall", id: "p1", name: "bash", arguments: { command: "sleep 8 && echo ok", description: "Pause a few seconds" } }]);
	stream(toolReply, "thinking_end", 0);
	calls.message_end({ message: toolReply }, {});
	calls.tool_execution_start({ toolCallId: "p1", toolName: "bash", args: { command: "sleep 8 && echo ok", description: "Pause a few seconds" } }, {});
	const t1 = Date.now();
	describeTool("bash", (args) => ({ activity: `Running ${clip(String(args.command ?? ""))}`, hint: `$ ${args.command}` }));
	check(bare(groupRow(thoughtId(toolReply), 80, tagged, t1 + 1000)[1]) === "<muted>  ⎿  </muted>Run the timer now.", "while the call waits for permission the thought hint holds for its 3 s");
	const asking = groupRow(thoughtId(toolReply), 80, tagged, on(t1 + 4000));
	check(bare(asking[0]) === "<muted>● </muted>Pause a few seconds", "while the call waits for permission the thought's group shows the task summary with no elapsed and no ellipsis, as Claude 2.1.280 measured");
	check(bare(asking[1]) === "<muted>  ⎿  $ sleep 8 && echo ok</muted>", "and past the 3 s hold the waiting call's command takes the hint row, as Claude 2.1.280 draws it under its permission prompt (suite-run1 permission capture)");
	check(groupRow("p1", 80, plain).length === 0, "the waiting call draws nothing itself");
	const execute = joinOnExecute("bash", (id: string) => id);
	calls.tool_call({ toolCallId: "p1", toolName: "bash", input: {} }, {});
	check(groupRow("p1", 80, plain).length === 0, "a tool whose execute is wrapped does not join at tool_call, which pi fires before the permission prompt");
	check(execute("p1", { command: "sleep 8 && echo ok", description: "Pause a few seconds" }) === "p1", "the wrapped execute still runs the tool");
	check(groupRow(thoughtId(toolReply), 80, plain).length === 0, "once it executes the call joins and draws the group itself");
	const t2 = Date.now();
	const runningRow = groupRow("p1", 80, tagged, on(t2 + 2000));
	check(bare(runningRow[0]) === "<muted>● </muted>Pause a few seconds<muted> · 2s</muted>", "the task summary gets \" · Ns\" once the running member is 2 s old");
	check(bare(runningRow[1]).startsWith("<muted>  ⎿  </muted>Run the timer now."), "the thought hint holds for 3 s after the thought ended even though a tool joined");
	check(bare(groupRow("p1", 80, tagged, t2 + 3500)[1]) === "<muted>  ⎿  $ sleep 8 && echo ok (3s)</muted>", "then the display hint takes over, with \"(Ns)\" from 3 s on any running bash: Claude's Bash waits 2000 ms (j6t) and then yields bash_progress every poll tick, first reply or not (parallel-calls captured it on a first-reply bash)");
	check(groupRow("p1", 80, plain, t2 + 1000)[0].endsWith("Pause a few seconds"), "no elapsed before 2 s");
	calls.tool_execution_end({ toolCallId: "p1", toolName: "bash", result: { content: [{ type: "text", text: "ok" }] } }, {});
	const t3 = Date.now();
	check(groupRow("p1", 80, plain, on(t3 + 5000)).join("|") === "● Pause a few seconds|  ⎿  $ sleep 8 && echo ok", "a finished tool keeps the group active, no elapsed, until the turn moves on, as Claude 2.1.280 measured");
	calls.agent_end({}, {});
	check(groupRow("p1", 80, plain).join("|") === "  Thought for 1s, ran 1 shell command", "the turn ending flips the row to the past sentence");

	calls.agent_start({}, {});
	const first = reply(300, [{ type: "toolCall", id: "q1", name: "bash", arguments: { command: "ls", description: "List the directory" } }]);
	calls.message_end({ message: first }, {});
	execute("q1", { command: "ls", description: "List the directory" });
	calls.tool_execution_end({ toolCallId: "q1", toolName: "bash", result: { content: [{ type: "text", text: "src" }] } }, {});
	const second = reply(301, [{ type: "toolCall", id: "q2", name: "bash", arguments: { command: "sleep 15 && echo built", description: "Wait for the build" } }]);
	calls.message_end({ message: second }, {});
	execute("q2", { command: "sleep 15 && echo built", description: "Wait for the build" });
	const t4 = Date.now();
	check(groupRow("q1", 80, plain).length === 0, "a finished call in a group with a running one draws nothing");
	check(groupRow("q2", 80, plain, on(t4 + 3000)).join("|") === "● Waiting for the build · 3s|  ⎿  $ sleep 15 && echo built (3s)", "a later reply's running bash appends \"(Ns)\" from 3 s, Claude's first bash_progress tick");
	calls.tool_execution_update({ toolCallId: "q2", toolName: "bash", partialResult: { content: [{ type: "text", text: "one\ntwo\n" }] } }, {});
	check(groupRow("q2", 80, plain, t4 + 4200)[1] === "  ⎿  $ sleep 15 && echo built (4s · 2 lines)", "and counts its output lines once it has some");
	calls.tool_execution_end({ toolCallId: "q2", toolName: "bash", isError: true, result: { content: [{ type: "text", text: "Command exited with code 1" }] } }, {});
	check(groupRow("q2", 80, plain, on(t4) + BLINK_MS)[0].startsWith("● "), "a group with a failed member keeps its dot lit, like Claude's Do with isError");
	calls.agent_end({}, {});

	calls.agent_start({}, {});
	const parallel = reply(400, [
		{ type: "toolCall", id: "r1", name: "bash", arguments: { command: "sleep 15 && echo a", description: "Wait for service A" } },
		{ type: "toolCall", id: "r2", name: "bash", arguments: { command: "sleep 18 && echo b", description: "Wait for service B" } },
	]);
	calls.message_end({ message: parallel }, {});
	execute("r1", {});
	execute("r2", {});
	check(groupRow("r1", 80, plain).length === 0 && groupRow("r2", 80, plain, on(Date.now()))[0] === "● Waiting for service B", "parallel calls: the last one draws, and the summary is the reply's last call");
	calls.agent_end({}, {});

	calls.agent_start({}, {});
	describeTool("grep", (args) => ({ activity: `Searching for ${clip(String(args.pattern ?? ""))}`, hint: `"${args.pattern}"` }));
	const search = reply(500, [thinking("find it"), { type: "toolCall", id: "u1", name: "grep", arguments: { pattern: "needle" } }]);
	stream(search, "thinking_end", 0);
	calls.tool_call({ toolCallId: "u1", toolName: "grep", input: { pattern: "needle" } }, {});
	const t5 = Date.now();
	check(groupRow("u1", 80, tagged, on(t5))[0] === "<muted>● </muted>Thinking for <b>1s</b>, searching for <b>1</b> pattern…", "with no task summary yet the sentence is in its active form, clauses in Claude's order");
	calls.message_end({ message: search }, {});
	check(groupRow("u1", 80, plain, on(Date.now()))[0] === "● Searching for needle", "a call without a description takes its activity description as the task summary");
	check(taskOf("ask_user_question", { questions: [{ question: "Colour?" }], description: "Ask" }) === "Colour?" && taskOf("bash", { command: "x".repeat(80) }) === `Running ${"x".repeat(49)}…` && taskOf("unknown", {}) === "", "task summary: the question, else the conjugated description, else the activity, clipped at Claude's 50 columns");
	calls.agent_end({}, {});

	calls.agent_start({}, {});
	const long = reply(600, [thinking(Array.from({ length: 400 }, (_, i) => `word${i}`).join(" "))]);
	stream(long, "thinking_end", 0);
	const clamped = groupRow(thoughtId(long), 40, plain, on(Date.now()));
	check(clamped.length === 11 && bare(clamped[10]).endsWith("…") && clamped.slice(1).every((line) => bare(line).length <= 40), "a long thought is cut at Claude's ten hint lines with a trailing ellipsis");
	check(bare(clamped[2]).startsWith("     word"), "continuation lines hang five columns in");
	calls.message_end({ message: reply(600, [thinking("x")], "error") }, {});
	check(groupRow(thoughtId(long), 40, plain).length === 0, "the thought of a reply that failed leaves the transcript with it");
	calls.agent_end({}, {});

	calls.agent_start({}, {});
	stream(reply(700, [thinking("a")]), "thinking_start", 0);
	stream(reply(700, [thinking("a")]), "thinking_end", 0);
	const ticking = reply(701, [thinking("b")]);
	stream(ticking, "thinking_start", 0);
	check(groupRow(thoughtId({ timestamp: 700 }), 80, plain, Date.now() + 4000)[0].includes("Thinking for 4s"), "while another thinking block streams the active duration ticks live");
	calls.agent_end({}, {});
	check(thoughtText("Run `ls` now.").includes("\x1b[38;2;153;204;255mls\x1b[39m") && bare(thoughtText("Run `ls` now.")) === "Run ls now.", "inline code in a thought is 99ccff with no backticks, like Claude 2.1.280's raw output");
	check(wrapWords("a bb ccc", 3).join("|") === "a|bb|ccc" && wrapWords("aaaa", 3).join("|") === "aaaa", "wrapWords breaks at spaces and never cuts a single word that overruns the room");
	check(wrapWords("aaaa b cc", 4).join("|") === "aaaa|b|cc" && wrapWords("aaa b cc", 4).join("|") === "aaa|b cc", "a row after an exactly full row holds one column less, Ink's wrap-ansi trim:false (slow-search thought hint: `preamble. The` at 127 of 127 after a full row)");
	console.log("ok - claude-tools rows");
}
