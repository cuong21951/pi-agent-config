// ponytail: shared between claude-tools and intent-tools. Claude Code 2.1.261 draws a running tool as a
// blinking grey dot + "Reading a.txt", and a finished read-only tool as one grey line without a dot; only
// Write and Update keep the blue dot and show their content. Consecutive finished read-only calls merge
// into one line, "Searched for 1 pattern, read 2 files, listed 1 directory, ran 1 shell command" (the
// order and words are Claude's own, lifted from its bundle; counts bold), broken by assistant text, a
// new prompt, a reply that ended in an error or any tool that keeps its row. pi cannot merge blocks, so every member but
// the last draws zero lines (pi then adds no spacer) and the last draws the group line. Measured from a
// pywinpty capture of the dark-daltonized theme, quarter-second frames. A call counts as running until
// its result exists, so a call waiting for permission still blinks; replayed sessions are seeded from
// the session entries. pi loads every extension through its own module cache, so this file exists once
// per importer; the state lives on globalThis so claude-tools and intent-tools see the same thing.
type Kind = "search" | "read" | "list" | "bash" | "write" | "own" | "other" | `mcp:${string}`;

const shared = ((globalThis as any).__claudeRows ??= {
	finished: new Set<string>(),
	failed: new Set<string>(),
	order: [] as string[],
	kind: new Map<string, Kind>(),
	breaks: new Set<string>(),
	pendingBreak: true,
	repaint: new Map<string, () => void>(),
}) as {
	finished: Set<string>;
	failed: Set<string>;
	order: string[];
	kind: Map<string, Kind>;
	breaks: Set<string>;
	pendingBreak: boolean;
	repaint: Map<string, () => void>;
	dropped?: Set<string>;
};
export const finished = shared.finished;
export const failed = shared.failed;
const dropped = (shared.dropped ??= new Set<string>());

export const BLINK_MS = 500;

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
};
const OWN_ROW: ReadonlySet<Kind> = new Set(["write", "own"]);
const LIST_COMMAND = /^\s*(?:rtk\s+)?(?:ls|dir)\b/;
const EXIT_CODE = /exit(?:ed with)? code:? ([1-9]\d*)/;

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
	if (toolName === "bash" && LIST_COMMAND.test(String(args?.command ?? ""))) return "list";
	return KIND[toolName] ?? "other";
}

// ponytail: pi repaints a block only when that block changes, so a member that must vanish once a
// later call joins its group is repainted by hand through the render context it handed us.
export function watch(id: string, invalidate: () => void): void {
	shared.repaint.set(id, invalidate);
}

function repaintAll(): void {
	for (const invalidate of shared.repaint.values()) invalidate();
}

function place(id: string, kind: Kind): void {
	if (shared.kind.has(id)) return;
	shared.order.push(id);
	shared.kind.set(id, kind);
	if (shared.pendingBreak) shared.breaks.add(id);
	shared.pendingBreak = false;
}

function note(id: string, toolName: string, args?: { command?: unknown }): void {
	place(id, kindOf(toolName, args));
}

// ponytail: Claude merges consecutive calls to one MCP server into "Called dse 2 times" (measured). The
// pi-mcp-adapter patch reports the server when it draws the row; the call was placed as "other" before.
export function noteServer(id: string, server: string): void {
	if (dropped.has(id)) return;
	place(id, `mcp:${server}`);
	shared.kind.set(id, `mcp:${server}`);
}

// ponytail: only a write keeps its own row — its "● Update(path)" block and diff are the point of it.
// Everything else, known tool or not, folds into the one grey sentence.
function collapsible(id: string): boolean {
	const kind = shared.kind.get(id);
	return kind !== undefined && !OWN_ROW.has(kind) && finished.has(id);
}

export function groupOf(id: string): string[] | null {
	const at = shared.order.indexOf(id);
	if (at < 0 || !collapsible(id)) return null;
	let start = at;
	while (start > 0 && !shared.breaks.has(shared.order[start]) && collapsible(shared.order[start - 1])) start--;
	let end = at;
	while (end + 1 < shared.order.length && !shared.breaks.has(shared.order[end + 1]) && collapsible(shared.order[end + 1])) end++;
	return shared.order.slice(start, end + 1);
}

// ponytail: the clause order is Claude's own, read off the 2.1.261 summary builder: search, read, list,
// then the MCP servers, then bash last. The reconstructed sources on GitHub say "queried" for MCP; the
// binary says "called", so "called" it is.
const LEADING: Array<[Kind, string, string, string]> = [
	["search", "searched for", "pattern", "patterns"],
	["read", "read", "file", "files"],
	["list", "listed", "directory", "directories"],
];
const TRAILING: Array<[Kind, string, string, string]> = [["bash", "ran", "shell command", "shell commands"]];

const GUTTER = "  ";

// ponytail: null = not part of a group (draw the tool's own row); "" = a hidden member (draw nothing).
export function summaryFor(id: string, bold: (text: string) => string = (text) => text): string | null {
	if (dropped.has(id)) return "";
	const group = groupOf(id);
	if (!group) return null;
	if (group[group.length - 1] !== id) return "";
	const count = (kind: Kind) => group.filter((member) => shared.kind.get(member) === kind).length;
	const clauses = (phrases: Array<[Kind, string, string, string]>) =>
		phrases
			.map(([kind, verb, one, many]) => [count(kind), verb, one, many] as const)
			.filter(([n]) => n > 0)
			.map(([n, verb, one, many]) => `${verb} ${bold(String(n))} ${n === 1 ? one : many}`);
	const servers = [...new Set(group.map((member) => shared.kind.get(member) ?? "").filter((kind) => kind.startsWith("mcp:")))];
	const called = servers.map((kind) => {
		const n = count(kind);
		return n === 1 ? `called ${kind.slice(4)}` : `called ${kind.slice(4)} ${bold(String(n))} times`;
	});
	const others = count("other");
	if (others > 0) called.push(`called ${bold(String(others))} ${others === 1 ? "tool" : "tools"}`);
	return GUTTER + [...clauses(LEADING), ...called, ...clauses(TRAILING)].join(", ").replace(/^./, (first) => first.toUpperCase());
}

type Block = { type: string; id?: string; name?: string; arguments?: unknown; text?: string };
type Entry = { type?: string; message?: { role?: string; toolCallId?: string; isError?: boolean; stopReason?: string; content?: Block[] | string } };

function hasText(content: Block[] | string | undefined): boolean {
	if (typeof content === "string") return content.trim() !== "";
	return (content ?? []).some((block) => block.type === "text" && (block.text ?? "").trim() !== "");
}

function neverRan(message: { stopReason?: string }): boolean {
	return message.stopReason === "error" || message.stopReason === "aborted";
}

function closesGroup(message: { content?: Block[] | string; stopReason?: string }): boolean {
	return hasText(message.content) || neverRan(message);
}

function toolCalls(content: Block[] | string | undefined): Block[] {
	return typeof content === "string" ? [] : (content ?? []).filter((block) => block.type === "toolCall" && block.id);
}

function drop(content: Block[] | string | undefined): void {
	for (const block of toolCalls(content)) {
		dropped.add(block.id!);
		finished.add(block.id!);
	}
}

export function seed(entries: Iterable<Entry>): void {
	for (const entry of entries) {
		const message = entry.type === "message" ? entry.message : undefined;
		if (!message) continue;
		if (message.role === "user") shared.pendingBreak = true;
		if (message.role === "assistant") {
			if (closesGroup(message)) shared.pendingBreak = true;
			if (neverRan(message)) drop(message.content);
			else for (const block of toolCalls(message.content)) note(block.id!, block.name ?? "", block.arguments as { command?: unknown });
		}
		if (message.role === "toolResult" && message.toolCallId) {
			finished.add(message.toolCallId);
			if (message.isError) failed.add(message.toolCallId);
		}
	}
}

function resultText(result: { content?: Array<{ type: string; text?: string }> } | undefined): string {
	return (result?.content ?? []).map((block) => (block.type === "text" ? block.text ?? "" : "")).join("\n");
}

// ponytail: the pi-mcp-adapter patch lives in node_modules and cannot import this file, so it reaches
// the same functions through the shared object.
Object.assign(shared, { summaryFor, noteServer, watch });

export function track(pi: { on: (event: string, handler: (event: any, ctx: any) => void) => void }): void {
	pi.on("session_start", (_event, ctx) => seed(ctx.sessionManager.getEntries()));
	pi.on("agent_start", () => {
		shared.pendingBreak = true;
	});
	pi.on("message_end", (event) => {
		if (event.message?.role !== "assistant") return;
		if (closesGroup(event.message)) shared.pendingBreak = true;
		if (neverRan(event.message)) drop(event.message.content);
	});
	pi.on("tool_execution_start", (event) => {
		finished.delete(event.toolCallId);
		failed.delete(event.toolCallId);
		note(event.toolCallId, event.toolName, event.args);
	});
	pi.on("tool_execution_end", (event) => {
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
	check(blinkOn(0) && !blinkOn(500) && blinkOn(1000), "dot blinks every 500 ms");
	const calls: Record<string, (e: any, ctx: any) => void> = {};
	track({ on: (name, handler) => (calls[name] = handler) });
	calls.tool_execution_start({ toolCallId: "a", toolName: "read", args: {} }, {});
	check(!finished.has("a") && summaryFor("a") === null, "a running call is not finished and has no group");
	calls.tool_execution_end({ toolCallId: "a", isError: true }, {});
	check(finished.has("a") && failed.has("a") && summaryFor("a") === "  Read 1 file", "end marks finished; a failed call folds into the group like Claude 2.1.280's failed bash and MCP calls");
	calls.agent_start({}, {});
	calls.tool_execution_start({ toolCallId: "b", toolName: "grep", args: {} }, {});
	calls.tool_execution_end({ toolCallId: "b" }, {});
	calls.tool_execution_start({ toolCallId: "c", toolName: "read", args: {} }, {});
	calls.tool_execution_end({ toolCallId: "c" }, {});
	calls.tool_execution_start({ toolCallId: "d", toolName: "read", args: {} }, {});
	calls.tool_execution_end({ toolCallId: "d" }, {});
	check(summaryFor("b") === "" && summaryFor("c") === "", "earlier members of a group draw nothing");
	check(summaryFor("d", (t) => `<b>${t}</b>`) === "  Searched for <b>1</b> pattern, read <b>2</b> files", "last member draws Claude's group line, counts bold");
	calls.message_end({ message: { role: "assistant", content: [{ type: "text", text: "Now the shell." }] } }, {});
	calls.tool_execution_start({ toolCallId: "e", toolName: "bash", args: { command: "ls -la" } }, {});
	calls.tool_execution_end({ toolCallId: "e", result: { content: [{ type: "text", text: "a\nb" }] } }, {});
	calls.tool_execution_start({ toolCallId: "f", toolName: "bash", args: { command: "git status" } }, {});
	calls.tool_execution_end({ toolCallId: "f", result: { content: [{ type: "text", text: "ok" }] } }, {});
	check(summaryFor("d") === "  Searched for 1 pattern, read 2 files", "assistant text closes the group");
	check(summaryFor("e") === "" && summaryFor("f") === "  Listed 1 directory, ran 1 shell command", "ls counts as a listing like Claude's");
	calls.tool_execution_start({ toolCallId: "g", toolName: "bash", args: { command: "false" } }, {});
	calls.tool_execution_end({ toolCallId: "g", result: { content: [{ type: "text", text: "Command exited with code 1" }] } }, {});
	check(failed.has("g") && summaryFor("f") === "" && summaryFor("g") === "  Listed 1 directory, ran 2 shell commands", "a non-zero exit folds into the group like Claude 2.1.280");
	calls.tool_execution_start({ toolCallId: "h", toolName: "edit", args: {} }, {});
	calls.tool_execution_end({ toolCallId: "h" }, {});
	calls.tool_execution_start({ toolCallId: "i", toolName: "read", args: {} }, {});
	calls.tool_execution_end({ toolCallId: "i" }, {});
	check(summaryFor("h") === null && summaryFor("i") === "  Read 1 file", "an edit breaks the group");
	calls.agent_start({}, {});
	calls.tool_execution_start({ toolCallId: "j", toolName: "read", args: {} }, {});
	calls.tool_execution_end({ toolCallId: "j" }, {});
	check(summaryFor("i") === "  Read 1 file" && summaryFor("j") === "  Read 1 file", "a new prompt starts a new group");
	let repainted = 0;
	watch("j", () => repainted++);
	calls.tool_execution_start({ toolCallId: "k", toolName: "read", args: {} }, {});
	calls.tool_execution_end({ toolCallId: "k" }, {});
	check(repainted === 1 && summaryFor("j") === "" && summaryFor("k") === "  Read 2 files", "a finished call repaints the members it hides");
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
		{ type: "message", message: { role: "assistant", stopReason: "error", content: [] } },
		{ type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: "err2", name: "read", arguments: {} }] } },
		{ type: "message", message: { role: "toolResult", toolCallId: "err2", isError: false } },
	]);
	check(summaryFor("err1") === "  Read 1 file" && summaryFor("err2") === "  Read 1 file", "a reply that ended in an error closes the group like assistant text");
	calls.agent_start({}, {});
	for (const [id, toolName] of [["s1", "read"], ["s2", "skill"], ["s3", "read"]]) {
		calls.tool_execution_start({ toolCallId: id, toolName, args: {} }, {});
		calls.tool_execution_end({ toolCallId: id }, {});
	}
	check(summaryFor("s2") === null && summaryFor("s1") === "  Read 1 file" && summaryFor("s3") === "  Read 1 file", "a skill keeps its own row, splits the group and is not counted — Claude's \"● Skill(pr)\" then \"  Pushed to …\"");
	seed([
		{ type: "message", message: { role: "assistant", stopReason: "error", content: [{ type: "toolCall", id: "cut1", name: "ls", arguments: {} }] } },
	]);
	check(finished.has("cut1") && summaryFor("cut1") === "", "a call streamed into a reply that failed never ran: no running dot, no row");
	calls.message_end({ message: { role: "assistant", stopReason: "aborted", content: [{ type: "toolCall", id: "cut2", name: "grep", arguments: {} }] } }, {});
	check(finished.has("cut2") && summaryFor("cut2") === "", "the same when it happens live");
	calls.agent_start({}, {});
	calls.tool_execution_start({ toolCallId: "m1", toolName: "dse_get_ticket", args: {} }, {});
	calls.tool_execution_end({ toolCallId: "m1" }, {});
	noteServer("m1", "dse");
	calls.tool_execution_start({ toolCallId: "m2", toolName: "dse_list_tickets", args: {} }, {});
	calls.tool_execution_end({ toolCallId: "m2" }, {});
	noteServer("m2", "dse");
	check(summaryFor("m1") === "" && summaryFor("m2", (t) => `<b>${t}</b>`) === "  Called dse <b>2</b> times", "consecutive calls to one MCP server merge like Claude's");
	calls.tool_execution_start({ toolCallId: "m3", toolName: "read", args: {} }, {});
	calls.tool_execution_end({ toolCallId: "m3" }, {});
	check(summaryFor("m3") === "  Read 1 file, called dse 2 times", "a read after MCP calls joins the line");
	calls.tool_execution_start({ toolCallId: "m4", toolName: "bash", args: { command: "git status" } }, {});
	calls.tool_execution_end({ toolCallId: "m4", result: { content: [{ type: "text", text: "ok" }] } }, {});
	check(summaryFor("m4") === "  Read 1 file, called dse 2 times, ran 1 shell command", "Claude's clause order puts the servers before bash");
	calls.agent_start({}, {});
	calls.tool_execution_start({ toolCallId: "o1", toolName: "grep", args: {} }, {});
	calls.tool_execution_end({ toolCallId: "o1" }, {});
	calls.tool_execution_start({ toolCallId: "o2", toolName: "mcp", args: {} }, {});
	calls.tool_execution_end({ toolCallId: "o2" }, {});
	calls.tool_execution_start({ toolCallId: "o3", toolName: "bash", args: { command: "git status" } }, {});
	calls.tool_execution_end({ toolCallId: "o3", result: { content: [{ type: "text", text: "ok" }] } }, {});
	check(
		summaryFor("o3") === "  Searched for 1 pattern, called 1 tool, ran 1 shell command",
		"a tool nobody renders folds into the same sentence as 'called 1 tool' instead of splitting the group",
	);
	calls.tool_execution_start({ toolCallId: "o4", toolName: "todo", args: {} }, {});
	calls.tool_execution_end({ toolCallId: "o4" }, {});
	check(summaryFor("o4") === "  Searched for 1 pattern, called 2 tools, ran 1 shell command", "two unknown tools pluralise");
	check((globalThis as any).__claudeRows.summaryFor === summaryFor, "the MCP patch can reach summaryFor through globalThis");
	check(!isAbort("boom") && isAbort("Operation aborted\n") && isAbort("Command aborted") && isAbort("This operation was aborted") && !isAbort(undefined), "abort text");
	console.log("ok - claude-tools rows");
}
