import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

export const TOOL_NAME = "todo_write";
export const CLAUDE_TOOL_NAME = "TodoWrite";

export const RESULT_TEXT =
	"Todos have been modified successfully. Ensure that you continue to use the todo list to track your progress. Please proceed with the current tasks if applicable";

export const DESCRIPTION = `Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user. It also helps the user understand the progress of the task and overall progress of their requests.

Use this tool proactively when: a task requires 3 or more distinct steps; the task is non-trivial and needs careful planning; the user explicitly requests a todo list; the user provides multiple tasks; right after receiving new instructions; when starting work on a task (mark it in_progress first); after completing a task (mark it completed and add any follow-ups discovered).

Skip this tool when there is only one straightforward, trivial task, or the request is purely conversational.

Each todo has \`content\` (imperative form, e.g. "Run tests"), \`status\` ("pending" | "in_progress" | "completed"), and \`activeForm\` (present-tense label shown while in progress, e.g. "Running tests"). Send the full list each call; it replaces the previous one. Keep one item in_progress at a time and mark it completed when done.`;

export type TodoStatus = "pending" | "in_progress" | "completed";
export interface TodoItem {
	content: string;
	status: TodoStatus;
	activeForm: string;
}

export const TodoParams = Type.Object({
	todos: Type.Array(
		Type.Object({
			content: Type.String({ description: "The todo item in imperative form, e.g. \"Fix authentication bug\"" }),
			status: StringEnum(["pending", "in_progress", "completed"] as const),
			activeForm: Type.String({ description: "Present-tense label shown while this item is in_progress, e.g. \"Fixing authentication bug\"" }),
		}),
	),
});

export function glyphFor(status: TodoStatus): string {
	return status === "completed" ? "☒" : "☐";
}

type Paint = Pick<Theme, "fg" | "bold" | "strikethrough">;

export function todoLine(todo: TodoItem, paint: Paint): string {
	const glyph = glyphFor(todo.status);
	if (todo.status === "completed") return paint.fg("dim", paint.strikethrough(`${glyph} ${todo.content}`));
	if (todo.status === "in_progress") return paint.bold(paint.fg("text", `${glyph} ${todo.activeForm}`));
	return paint.fg("muted", `${glyph} ${todo.content}`);
}

export function summaryLine(todos: TodoItem[]): string {
	const done = todos.filter((t) => t.status === "completed").length;
	return `☐ ${done}/${todos.length} tasks (ctrl+t to expand)`;
}

export function renderChecklist(todos: TodoItem[], expanded: boolean, paint: Paint): string {
	if (todos.length === 0) return "";
	if (!expanded) return summaryLine(todos);
	return todos.map((t) => todoLine(t, paint)).join("\n");
}

export default function (pi: ExtensionAPI) {
	let todos: TodoItem[] = [];
	let expanded = true;
	const invalidators = new Set<() => void>();

	const reconstruct = (ctx: ExtensionContext) => {
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "message") continue;
			const message = entry.message;
			if (message.role !== "toolResult" || message.toolName !== TOOL_NAME) continue;
			const details = message.details as { todos?: TodoItem[] } | undefined;
			if (details?.todos) todos = details.todos;
		}
	};
	pi.on("session_start", async (_event, ctx) => reconstruct(ctx));
	pi.on("session_tree", async (_event, ctx) => reconstruct(ctx));

	pi.registerTool({
		name: TOOL_NAME,
		label: "Update Todos",
		description: DESCRIPTION,
		promptSnippet: "todo_write(todos) - replace the session's todo checklist",
		parameters: TodoParams,
		async execute(_toolCallId, params) {
			todos = params.todos;
			return { content: [{ type: "text", text: RESULT_TEXT }], details: { todos: params.todos } };
		},
		renderCall(_args, theme) {
			return new Text(theme.fg("toolTitle", theme.bold("Update Todos")), 0, 0);
		},
		renderResult(result, _options, theme, context) {
			invalidators.add(context.invalidate);
			const details = result.details as { todos?: TodoItem[] } | undefined;
			const list = details?.todos ?? [];
			return new Text(renderChecklist(list, expanded, theme), 0, 0);
		},
	});

	pi.registerShortcut("ctrl+t", {
		description: "Toggle the todo checklist",
		handler: () => {
			expanded = !expanded;
			for (const invalidate of [...invalidators]) invalidate();
		},
	});
}

if (process.env.CLAUDE_TODOS_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain: Paint = { fg: (_role, text) => text, bold: (t) => `**${t}**`, strikethrough: (t) => `~~${t}~~` };

	check(glyphFor("pending") === "☐", "pending uses the ballot-box glyph, matching Claude's terminal glyph-support probe string");
	check(glyphFor("in_progress") === "☐", "in_progress is not yet done, same open box as pending");
	check(glyphFor("completed") === "☒", "completed uses the crossed ballot-box glyph");

	const todos: TodoItem[] = [
		{ content: "Read the file", status: "completed", activeForm: "Reading the file" },
		{ content: "Fix the bug", status: "in_progress", activeForm: "Fixing the bug" },
		{ content: "Write a test", status: "pending", activeForm: "Writing a test" },
	];
	check(todoLine(todos[0], plain) === "~~☒ Read the file~~", "completed items are struck through");
	check(todoLine(todos[1], plain) === "**☐ Fixing the bug**", "in_progress items show the activeForm, bolded");
	check(todoLine(todos[2], plain) === "☐ Write a test", "pending items show content plainly");

	check(summaryLine(todos) === "☐ 1/3 tasks (ctrl+t to expand)", "collapsed form is a done/total count with the ctrl+t hint");
	check(renderChecklist([], true, plain) === "", "no todos yet means no row, like Claude before the first TodoWrite");
	check(renderChecklist(todos, false, plain) === summaryLine(todos), "collapsed shows the summary line");
	check(renderChecklist(todos, true, plain) === todos.map((t) => todoLine(t, plain)).join("\n"), "expanded shows every line");

	const invalidators = new Set<() => void>();
	let calls = 0;
	invalidators.add(() => {
		calls++;
		invalidators.add(() => calls++);
	});
	for (const invalidate of [...invalidators]) invalidate();
	check(calls === 1, "snapshotting invalidators before the ctrl+t loop keeps a re-render's own invalidate() from re-entering the same pass (measured: without the snapshot, pi hung on ctrl+t after a real todo_write call)");

	console.log("claude-todos selftest OK");
}
