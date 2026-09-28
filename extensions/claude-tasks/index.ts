import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { dynamic } from "../claude-tools/rows.ts";

const RULE = "99ccff";
const TITLE = "00cccc";
const GREY = "999999";
const DONE = "3399ff";
const SELECTED = "99ccff";
const MODAL_EVENT = "claude-modes:modal";
const RECENT = 5;
const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1, minimumFractionDigits: 1 });

export type Paint = { bold(text: string): string; hex(color: string, text: string): string; italic(text: string): string };

export type Task = {
	id: string;
	type: string;
	label: string;
	status: "running" | "completed" | "failed" | "stopped";
	model: string;
	elapsedMs: number;
	tokens: number;
	tools: number;
	prompt: string;
	activities: string[];
	error?: string;
};

type Registry = {
	taskRecords?: () => Record[];
	viewAgent?: (id: string) => boolean;
	stopAgent?: (id: string) => boolean;
};

type Message = { role: string; content?: unknown; usage?: { input: number; output: number; cacheRead: number; cacheWrite: number } };
type Record = {
	id: string;
	type: string;
	alias?: string;
	description: string;
	status: string;
	toolUses: number;
	startedAt: number;
	completedAt?: number;
	error?: string;
	lifetimeUsage: { output: number };
	session?: { messages: Message[]; model?: { name?: string; id?: string } };
};

function registry(): Registry | undefined {
	return (globalThis as { [key: symbol]: Registry | undefined })[Symbol.for("pi-subagents:manager")];
}

export function shortModel(name: string): string {
	return name.replace(/^Claude\s+/, "").replace(/\s*\(latest\)$/, "");
}

export function formatElapsed(ms: number): string {
	if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
	const total = Math.round(ms / 1000);
	const [hours, minutes, seconds] = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
	return hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;
}

export function formatTokens(count: number): string {
	return count >= 1000 ? COMPACT.format(count).toLowerCase() : String(count);
}

export function activity(name: string, args: { [key: string]: unknown }): string {
	const arg = (key: string) => (typeof args[key] === "string" ? (args[key] as string) : "");
	const title: { [key: string]: [string, string] } = {
		read: ["Read", "path"], bash: ["Bash", "command"], edit: ["Update", "path"], write: ["Write", "path"],
		grep: ["Search", "pattern"], find: ["Search", "pattern"], ls: ["List", "path"], Agent: ["Agent", "description"],
	};
	if (name === "grep" || name === "find") return `Search(pattern: "${arg("pattern")}"${arg("path") ? `, path: "${arg("path")}"` : ""})`;
	const [shown, key] = title[name] ?? [name, ""];
	const value = key ? arg(key).replace(/\s+/g, " ").trim() : "";
	return value ? `${shown}(${value})` : shown;
}

function statusOf(status: string): Task["status"] {
	if (status === "running" || status === "queued") return "running";
	if (status === "completed" || status === "steered") return "completed";
	if (status === "error") return "failed";
	return "stopped";
}

function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	return Array.isArray(content) ? content.filter((c) => c?.type === "text").map((c) => c.text).join("\n") : "";
}

export function taskOf(record: Record, now: number): Task {
	const messages = record.session?.messages ?? [];
	const last = messages.findLast((m) => m.role === "assistant" && m.usage);
	const context = last?.usage ? last.usage.input + last.usage.cacheRead + last.usage.cacheWrite : 0;
	const calls = messages.flatMap((m) => (m.role === "assistant" && Array.isArray(m.content) ? m.content.filter((c) => c?.type === "toolCall") : []));
	const status = statusOf(record.status);
	return {
		id: record.id,
		type: record.alias ?? record.type,
		label: record.description,
		status,
		model: shortModel(record.session?.model?.name ?? record.session?.model?.id ?? ""),
		elapsedMs: Math.max(0, (status === "running" ? now : (record.completedAt ?? now)) - record.startedAt),
		tokens: context + record.lifetimeUsage.output,
		tools: record.toolUses,
		prompt: textOf(messages.find((m) => m.role === "user")?.content).trim(),
		activities: calls.slice(-RECENT).map((c) => activity(c.name, c.arguments ?? {})),
		...(record.error ? { error: record.error } : {}),
	};
}

export function viewingRows(command: string): string[] {
	return [`\x1b[48;2;55;55;55m\x1b[38;2;80;80;80m❯ \x1b[38;2;255;255;255m${command} \x1b[39m\x1b[49m`, "\x1b[38;2;153;153;153m  ⎿  \x1b[39mViewing agent"];
}

const hint = (p: Paint, parts: string[]) => `   ${p.italic(p.hex(GREY, parts.join(" · ")))}`;
const rule = (p: Paint, width: number) => p.hex(RULE, "▔".repeat(width));

export function listHint(selected: Task | undefined, runningCount: number): string[] {
	const running = selected?.status === "running";
	return ["↑/↓ to select", "Enter to view", ...(running ? ["f to foreground", "x to stop"] : []), ...(running && runningCount > 1 ? ["ctrl+x ctrl+k to stop all agents"] : []), "Esc to close"];
}

function taskRow(task: Task, selected: boolean, p: Paint): string {
	const bullet = task.status === "running" ? p.hex(GREY, "●") : task.status === "completed" ? p.hex(DONE, "✔") : p.hex("ff6b80", "✘");
	const word = task.status === "running" ? "running" : task.status === "completed" ? "done" : task.status;
	const tail = `${p.hex(GREY, word)}${task.model ? p.hex(GREY, ` · ${task.model}`) : ""}`;
	return `   ${selected ? p.hex(SELECTED, "❯") : " "} ${bullet} ${selected ? p.hex(SELECTED, task.label) : task.label}   ${tail}`;
}

export function listRows(tasks: Task[], selected: number, width: number, p: Paint): string[] {
	const running = tasks.filter((t) => t.status === "running");
	const done = tasks.filter((t) => t.status !== "running");
	const head = [rule(p, width), `   ${p.bold(p.hex(TITLE, "Background"))}`];
	if (running.length > 0) head.push(`   ${p.hex(GREY, `${running.length} active ${running.length === 1 ? "agent" : "agents"}`)}`);
	if (tasks.length === 0) return [...head, "", `   ${p.hex(GREY, "No tasks currently running")}`, "", hint(p, listHint(undefined, 0))];
	const ordered = [...running, ...done];
	const section = (title: string, items: Task[]) =>
		items.length === 0 ? [] : [`     ${p.bold(p.hex(GREY, title))}${p.hex(GREY, ` (${items.length})`)}`, ...items.map((t) => taskRow(t, ordered.indexOf(t) === selected, p))];
	const sections = [section("Local agents", running), section("Completed", done)].filter((s) => s.length > 0);
	return [...head, "", ...sections.flatMap((s, i) => (i > 0 ? ["", ...s] : s)), "", hint(p, listHint(ordered[selected], running.length))].map((line) => truncateToWidth(line, width));
}

export function detailRows(task: Task, width: number, p: Paint, runningCount = 1): string[] {
	const facts = [formatElapsed(task.elapsedMs), ...(task.tokens > 0 ? [`${formatTokens(task.tokens)} tokens`] : []), ...(task.tools > 0 ? [`${task.tools} ${task.tools === 1 ? "tool" : "tools"}`] : []), ...(task.model ? [task.model] : [])].join(" · ");
	const state = task.status === "running" ? "" : task.status === "completed" ? p.hex(DONE, "✔ Completed · ") : p.hex("ff6b80", `✘ ${task.status === "failed" ? "Failed" : "Stopped"} · `);
	const progress = task.status === "running" && task.activities.length > 0
		? ["", `   ${p.bold(p.hex(GREY, "Progress"))}`, ...task.activities.map((a, i) => (i === task.activities.length - 1 ? `   › ${a}` : `   ${p.hex(GREY, `  ${a}`)}`))]
		: [];
	const prompt = wrapTextWithAnsi(task.prompt, Math.max(1, width - 3)).map((line) => `   ${line}`);
	const error = task.status === "failed" && task.error ? ["", `   ${p.bold(p.hex("ff6b80", "Error"))}`, `   ${p.hex("ff6b80", task.error)}`] : [];
	const keys = ["← to go back", "Esc/Enter/Space to close", ...(task.status === "running" ? ["x to stop", "f to foreground"] : []), ...(task.status === "running" && runningCount > 1 ? ["ctrl+x ctrl+k to stop all agents"] : [])];
	return [
		rule(p, width),
		`   ${p.bold(p.hex(TITLE, `${task.type} › ${task.label}`))}`,
		`   ${state}${p.hex(GREY, facts)}`,
		...progress,
		"",
		`   ${p.bold(p.hex(GREY, "Prompt"))}`,
		...prompt,
		...error,
		"",
		hint(p, keys),
	].map((line) => truncateToWidth(line, width));
}

const ansiPaint = (bold: (text: string) => string): Paint => ({
	bold,
	hex: (color, text) => `\x1b[38;2;${parseInt(color.slice(0, 2), 16)};${parseInt(color.slice(2, 4), 16)};${parseInt(color.slice(4, 6), 16)}m${text}\x1b[39m`,
	italic: (text) => `\x1b[3m${text}\x1b[23m`,
});

export default function (pi: ExtensionAPI) {
	pi.registerEntryRenderer("claude-tasks-viewing", () => dynamic(() => viewingRows("/tasks")));
	pi.registerCommand("tasks", {
		description: "List and manage background tasks",
		handler: async (_args, ctx) => {
			const agents = registry();
			if (!ctx.hasUI || !agents?.taskRecords) return;
			const tasks = () => (agents.taskRecords?.() ?? []).map((r) => taskOf(r, Date.now()));
			const first = tasks();
			let selected = 0;
			let detail: string | undefined = first.length === 1 ? first[0].id : undefined;
			const openedOnDetail = detail !== undefined;
			let chord = 0;
			pi.events.emit(MODAL_EVENT, true);
			await ctx.ui.custom<void>(
				(tui, theme, _keybindings, done) => {
					const timer = setInterval(() => tui.requestRender(), 1000);
					const paint = ansiPaint((text) => theme.bold(text));
					const close = () => {
						clearInterval(timer);
						done(undefined);
					};
					const ordered = () => {
						const all = tasks();
						return [...all.filter((t) => t.status === "running"), ...all.filter((t) => t.status !== "running")];
					};
					const current = () => ordered().find((t) => t.id === detail);
					const stopAll = () => {
						for (const t of ordered()) if (t.status === "running") agents.stopAgent?.(t.id);
					};
					const foreground = (task: Task | undefined) => {
						if (task?.status !== "running") return;
						close();
						pi.appendEntry("claude-tasks-viewing", {});
						agents.viewAgent?.(task.id);
					};
					return {
						render: (width: number) => {
							const task = current();
							return task ? detailRows(task, width, paint, ordered().filter((t) => t.status === "running").length) : listRows(ordered(), selected, width, paint);
						},
						invalidate() {},
						handleInput(input: string) {
							if (matchesKey(input, "ctrl+x")) {
								chord = Date.now();
								return;
							}
							if (matchesKey(input, "ctrl+k") && Date.now() - chord < 1500) {
								stopAll();
								tui.requestRender();
								return;
							}
							const list = ordered();
							const task = current();
							if (task) {
								if (matchesKey(input, "left")) {
									if (openedOnDetail) close();
									else detail = undefined;
								} else if (matchesKey(input, "escape") || matchesKey(input, "enter") || input === " ") close();
								else if (input === "x" && task.status === "running") agents.stopAgent?.(task.id);
								else if (input === "f") foreground(task);
								tui.requestRender();
								return;
							}
							if (matchesKey(input, "escape")) close();
							else if (matchesKey(input, "up")) selected = Math.max(0, selected - 1);
							else if (matchesKey(input, "down")) selected = Math.min(Math.max(0, list.length - 1), selected + 1);
							else if (matchesKey(input, "enter") && list[selected]) detail = list[selected].id;
							else if (input === "f") foreground(list[selected]);
							else if (input === "x" && list[selected]?.status === "running") agents.stopAgent?.(list[selected].id);
							tui.requestRender();
						},
					};
				},
			);
			pi.events.emit(MODAL_EVENT, false);
		},
	});
}

if (process.env.CLAUDE_TASKS_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain: Paint = { bold: (t) => t, hex: (_c, t) => t, italic: (t) => t };
	const tagged: Paint = { bold: (t) => `<b>${t}</b>`, hex: (c, t) => `<${c}>${t}</${c}>`, italic: (t) => `<i>${t}</i>` };
	const base: Task = { id: "a", type: "general-purpose", label: "Plan review", status: "running", model: "Haiku 4.5", elapsedMs: 6000, tokens: 1000, tools: 2, prompt: "Spawn a helper agent that runs sleep 30, then report.", activities: ["Agent(Helper sleep)", 'Bash(python -c "import time; time.sleep(35)")'] };
	const running = [{ ...base, id: "h", label: "Helper sleep" }, base, { ...base, id: "c", label: "Check files" }];
	check(listRows(running, 0, 132, plain).join("\n") === ["▔".repeat(132), "   Background", "   3 active agents", "", "     Local agents (3)", "   ❯ ● Helper sleep   running · Haiku 4.5", "     ● Plan review   running · Haiku 4.5", "     ● Check files   running · Haiku 4.5", "", "   ↑/↓ to select · Enter to view · f to foreground · x to stop · ctrl+x ctrl+k to stop all agents · Esc to close"].join("\n"), "three running agents draw Claude 2.1.283's Background list (m6f-measure4 tasks)");
	const tags = listRows(running, 0, 200, tagged);
	check(tags[0].startsWith("<99ccff>▔") && tags[1] === "   <b><00cccc>Background</00cccc></b>" && tags[4] === "     <b><999999>Local agents</999999></b><999999> (3)</999999>", "blue ▔ rule, bold cyan title, bold grey section with a grey count");
	const done = running.map((t) => ({ ...t, status: "completed" as const }));
	check(listRows(done, 1, 132, plain).slice(2).join("\n") === ["", "     Completed (3)", "     ✔ Helper sleep   done · Haiku 4.5", "   ❯ ✔ Plan review   done · Haiku 4.5", "     ✔ Check files   done · Haiku 4.5", "", "   ↑/↓ to select · Enter to view · Esc to close"].join("\n"), "finished agents list under Completed (N) with a blue ✔ and a shorter hint (m6f-measure3 tasks)");
	check(listRows([], 0, 132, plain).slice(1).join("\n") === ["   Background", "", "   No tasks currently running", "", "   ↑/↓ to select · Enter to view · Esc to close"].join("\n"), "an empty dialog says No tasks currently running (m6f-measure tasks)");
	check(detailRows(base, 132, plain, 3).join("\n") === ["▔".repeat(132), "   general-purpose › Plan review", "   6s · 1.0k tokens · 2 tools · Haiku 4.5", "", "   Progress", "     Agent(Helper sleep)", '   › Bash(python -c "import time; time.sleep(35)")', "", "   Prompt", "   Spawn a helper agent that runs sleep 30, then report.", "", "   ← to go back · Esc/Enter/Space to close · x to stop · f to foreground · ctrl+x ctrl+k to stop all agents"].join("\n"), "a running agent's detail draws Claude's Progress/Prompt card (m6f-measure4 tasks-detail)");
	check(detailRows({ ...base, status: "completed" }, 132, plain).slice(1, 4).join("\n") === ["   general-purpose › Plan review", "   ✔ Completed · 6s · 1.0k tokens · 2 tools · Haiku 4.5", ""].join("\n") && detailRows({ ...base, status: "completed" }, 132, plain).at(-1) === "   ← to go back · Esc/Enter/Space to close", "a finished agent's card leads with its state and drops Progress and the stop keys");
	check(activity("read", { path: "TASK.md" }) === "Read(TASK.md)" && activity("bash", { command: "sleep 6" }) === "Bash(sleep 6)" && activity("Agent", { description: "Helper sleep" }) === "Agent(Helper sleep)" && activity("grep", { pattern: "export", path: "src" }) === 'Search(pattern: "export", path: "src")', "activities read like Claude's Progress rows");
	check(shortModel("Claude Haiku 4.5 (latest)") === "Haiku 4.5" && formatTokens(1000) === "1.0k" && formatElapsed(53000) === "53s", "model, tokens and elapsed use Claude's short forms");
}
