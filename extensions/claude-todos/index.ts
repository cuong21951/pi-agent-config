import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { matchesKey, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

export type TaskStatus = "pending" | "in_progress" | "completed";

export interface Task {
	id: string;
	subject: string;
	description: string;
	activeForm?: string;
	status: TaskStatus;
	owner?: string;
	blocks: string[];
	blockedBy: string[];
	metadata?: Record<string, unknown>;
}

const TaskCreateParams = Type.Object({
	subject: Type.String({ description: "A brief title for the task" }),
	description: Type.String({ description: "What needs to be done" }),
	activeForm: Type.Optional(Type.String({ description: 'Present continuous form shown in spinner when in_progress (e.g., "Running tests")' })),
	metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Arbitrary metadata to attach to the task" })),
});

const TaskGetParams = Type.Object({
	taskId: Type.String({ description: "The ID of the task to retrieve" }),
});

const TaskListParams = Type.Object({});

const TaskUpdateParams = Type.Object({
	taskId: Type.String({ description: "The ID of the task to update" }),
	subject: Type.Optional(Type.String({ description: "New subject for the task" })),
	description: Type.Optional(Type.String({ description: "New description for the task" })),
	activeForm: Type.Optional(Type.String({ description: 'Present continuous form shown in spinner when in_progress (e.g., "Running tests")' })),
	status: Type.Optional(StringEnum(["pending", "in_progress", "completed", "deleted"] as const)),
	addBlocks: Type.Optional(Type.Array(Type.String(), { description: "Task IDs that this task blocks" })),
	addBlockedBy: Type.Optional(Type.Array(Type.String(), { description: "Task IDs that block this task" })),
	owner: Type.Optional(Type.String({ description: "New owner for the task" })),
	metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Metadata keys to merge into the task. Set a key to null to delete it." })),
});

const TASK_CREATE_DESCRIPTION = `Use this tool to create a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.
It also helps the user understand the progress of the task and overall progress of their requests.

## When to Use This Tool

Use this tool proactively in these scenarios:

- Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
- Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
- Plan mode - When using plan mode, create a task list to track the work
- User explicitly requests todo list - When the user directly asks you to use the todo list
- User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
- After receiving new instructions - Immediately capture user requirements as tasks
- When you start working on a task - Mark it as in_progress BEFORE beginning work
- After completing a task - Mark it as completed and add any new follow-up tasks discovered during implementation

## When NOT to Use This Tool

Skip using this tool when:
- There is only a single, straightforward task
- The task is trivial and tracking it provides no organizational benefit
- The task can be completed in less than 3 trivial steps
- The task is purely conversational or informational

NOTE that you should not use this tool if there is only one trivial task to do. In this case you are better off just doing the task directly.

## Task Fields

- **subject**: A brief, actionable title in imperative form (e.g., "Fix authentication bug in login flow")
- **description**: What needs to be done
- **activeForm** (optional): Present continuous form shown in the spinner when the task is in_progress (e.g., "Fixing authentication bug"). If omitted, the spinner shows the subject instead.

All tasks are created with status \`pending\`.

## Tips

- Create tasks with clear, specific subjects that describe the outcome
- After creating tasks, use TaskUpdate to set up dependencies (blocks/blockedBy) if needed
- Check TaskList first to avoid creating duplicate tasks
`;

const TASK_GET_DESCRIPTION = `Use this tool to retrieve a task by its ID from the task list.

## When to Use This Tool

- When you need the full description and context before starting work on a task
- To understand task dependencies (what it blocks, what blocks it)
- After being assigned a task, to get complete requirements

## Output

Returns full task details:
- **subject**: Task title
- **description**: Detailed requirements and context
- **status**: 'pending', 'in_progress', or 'completed'
- **blocks**: Tasks waiting on this one to complete
- **blockedBy**: Tasks that must complete before this one can start

## Tips

- After fetching a task, verify its blockedBy list is empty before beginning work.
- Use TaskList to see all tasks in summary form.
`;

const TASK_LIST_DESCRIPTION = `Use this tool to list all tasks in the task list.

## When to Use This Tool

- To see what tasks are available to work on (status: 'pending', no owner, not blocked)
- To check overall progress on the project
- To find tasks that are blocked and need dependencies resolved
- After completing a task, to check for newly unblocked work or claim the next available task
- **Prefer working on tasks in ID order** (lowest ID first) when multiple tasks are available, as earlier tasks often set up context for later ones

## Output

Returns a summary of each task:
- **id**: Task identifier (use with TaskGet, TaskUpdate)
- **subject**: Brief description of the task
- **status**: 'pending', 'in_progress', or 'completed'
- **owner**: Agent ID if assigned, empty if available
- **blockedBy**: List of open task IDs that must be resolved first (tasks with blockedBy cannot be claimed until dependencies resolve)

Use TaskGet with a specific task ID to view full details including description and comments.
`;

const TASK_UPDATE_DESCRIPTION = `Use this tool to update a task in the task list.

## When to Use This Tool

**Mark tasks as resolved:**
- When you have completed the work described in a task
- When a task is no longer needed or has been superseded
- IMPORTANT: Always mark your assigned tasks as resolved when you finish them
- After resolving, call TaskList to find your next task

- ONLY mark a task as completed when you have FULLY accomplished it
- If you encounter errors, blockers, or cannot finish, keep the task as in_progress
- When blocked, create a new task describing what needs to be resolved
- Never mark a task as completed if:
  - Tests are failing
  - Implementation is partial
  - You encountered unresolved errors
  - You couldn't find necessary files or dependencies

**Delete tasks:**
- When a task is no longer relevant or was created in error
- Setting status to \`deleted\` permanently removes the task

**Update task details:**
- When requirements change or become clearer
- When establishing dependencies between tasks

## Fields You Can Update

- **status**: The task status (see Status Workflow below)
- **subject**: Change the task title (imperative form, e.g., "Run tests")
- **description**: Change the task description
- **activeForm**: Present continuous form shown in spinner when in_progress (e.g., "Running tests")
- **owner**: Change the task owner (agent name)
- **metadata**: Merge metadata keys into the task (set a key to null to delete it)
- **addBlocks**: Mark tasks that cannot start until this one completes
- **addBlockedBy**: Mark tasks that must complete before this one can start

## Status Workflow

Status progresses: \`pending\` → \`in_progress\` → \`completed\`

Use \`deleted\` to permanently remove a task.

## Staleness

Make sure to read a task's latest state using \`TaskGet\` before updating it.
`;

type Paint = Pick<Theme, "fg" | "bold" | "strikethrough">;

export function glyphFor(status: TaskStatus): string {
	return status === "completed" ? "☒" : "☐";
}

export function taskLine(task: Task, paint: Paint): string {
	const glyph = glyphFor(task.status);
	const owner = task.owner ? ` (${task.owner})` : "";
	const blocked = task.blockedBy.length > 0 ? ` [blocked by ${task.blockedBy.map((b) => `#${b}`).join(", ")}]` : "";
	const label = task.status === "in_progress" ? task.activeForm || task.subject : task.subject;
	const line = `${glyph} #${task.id} ${label}${owner}${blocked}`;
	if (task.status === "completed") return paint.fg("dim", paint.strikethrough(line));
	if (task.status === "in_progress") return paint.bold(paint.fg("text", line));
	return paint.fg("muted", line);
}

export function summaryLine(tasks: Task[]): string {
	const done = tasks.filter((t) => t.status === "completed").length;
	return `☐ ${done}/${tasks.length} tasks (ctrl+t to expand)`;
}

export function renderTasks(tasks: Task[], expanded: boolean, paint: Paint): string {
	if (tasks.length === 0) return "";
	if (!expanded) return summaryLine(tasks);
	return tasks.map((t) => taskLine(t, paint)).join("\n");
}

export function taskListText(tasks: Task[]): string {
	if (tasks.length === 0) return "No tasks found";
	const completedIds = new Set(tasks.filter((t) => t.status === "completed").map((t) => t.id));
	return tasks
		.map((t) => {
			const owner = t.owner ? ` (${t.owner})` : "";
			const blockedBy = t.blockedBy.filter((b) => !completedIds.has(b));
			const blocked = blockedBy.length > 0 ? ` [blocked by ${blockedBy.map((b) => `#${b}`).join(", ")}]` : "";
			return `#${t.id} [${t.status}] ${t.subject}${owner}${blocked}`;
		})
		.join("\n");
}

export function taskGetText(task: Task | undefined): string {
	if (!task) return "Task not found";
	const lines = [`Task #${task.id}: ${task.subject}`, `Status: ${task.status}`, `Description: ${task.description}`];
	if (task.blockedBy.length > 0) lines.push(`Blocked by: ${task.blockedBy.map((b) => `#${b}`).join(", ")}`);
	if (task.blocks.length > 0) lines.push(`Blocks: ${task.blocks.map((b) => `#${b}`).join(", ")}`);
	return lines.join("\n");
}

declare global {
	var __claudeTasks: { stop(taskId: string): boolean } | undefined;
}

export default function (pi: ExtensionAPI) {
	let tasks = new Map<string, Task>();
	let nextId = 1;
	let expanded = true;
	const invalidators = new Set<() => void>();

	const snapshot = () => [...tasks.values()];

	const reconstruct = (ctx: ExtensionContext) => {
		tasks = new Map();
		nextId = 1;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== "message") continue;
			const message = entry.message;
			if (message.role !== "toolResult") continue;
			if (message.toolName !== "task_create" && message.toolName !== "task_update") continue;
			const details = message.details as { tasks?: Task[]; nextId?: number } | undefined;
			if (details?.tasks) {
				tasks = new Map(details.tasks.map((t) => [t.id, t]));
				nextId = details.nextId ?? nextId;
			}
		}
	};
	pi.on("session_start", async (_event, ctx) => reconstruct(ctx));
	pi.on("session_tree", async (_event, ctx) => reconstruct(ctx));

	const redraw = () => {
		for (const invalidate of [...invalidators]) invalidate();
	};

	const stopTask = (taskId: string): boolean => {
		const task = tasks.get(taskId);
		if (!task || task.status === "completed") return false;
		tasks.delete(taskId);
		expanded = true;
		redraw();
		return true;
	};
	globalThis.__claudeTasks = { stop: stopTask };

	pi.registerTool({
		name: "task_create",
		label: "TaskCreate",
		description: TASK_CREATE_DESCRIPTION,
		promptSnippet: "task_create(subject, description) - add a task to the task list",
		parameters: TaskCreateParams,
		renderShell: "self",
		async execute(_toolCallId, params) {
			const id = String(nextId++);
			const task: Task = { id, subject: params.subject, description: params.description, activeForm: params.activeForm, status: "pending", blocks: [], blockedBy: [], metadata: params.metadata };
			tasks.set(id, task);
			expanded = true;
			return { content: [{ type: "text", text: `Task #${id} created successfully: ${params.subject}` }], details: { tasks: snapshot(), nextId } };
		},
		renderCall() {
			return new Text("", 0, 0);
		},
		renderResult(result, _options, theme, context) {
			invalidators.add(context.invalidate);
			const details = result.details as { tasks?: Task[] } | undefined;
			return new Text(renderTasks(details?.tasks ?? [], expanded, theme), 0, 0);
		},
	});

	pi.registerTool({
		name: "task_get",
		label: "TaskGet",
		description: TASK_GET_DESCRIPTION,
		promptSnippet: "task_get(taskId) - retrieve a task by ID",
		parameters: TaskGetParams,
		renderShell: "self",
		async execute(_toolCallId, params) {
			return { content: [{ type: "text", text: taskGetText(tasks.get(params.taskId)) }], details: {} };
		},
		renderCall() {
			return new Text("", 0, 0);
		},
		renderResult() {
			return new Text("", 0, 0);
		},
	});

	pi.registerTool({
		name: "task_list",
		label: "TaskList",
		description: TASK_LIST_DESCRIPTION,
		promptSnippet: "task_list() - list all tasks",
		parameters: TaskListParams,
		renderShell: "self",
		async execute() {
			return { content: [{ type: "text", text: taskListText(snapshot()) }], details: {} };
		},
		renderCall() {
			return new Text("", 0, 0);
		},
		renderResult() {
			return new Text("", 0, 0);
		},
	});

	pi.registerTool({
		name: "task_update",
		label: "TaskUpdate",
		description: TASK_UPDATE_DESCRIPTION,
		promptSnippet: "task_update(taskId, ...) - update a task's status, fields or dependencies",
		parameters: TaskUpdateParams,
		renderShell: "self",
		async execute(_toolCallId, params) {
			const task = tasks.get(params.taskId);
			if (!task) return { content: [{ type: "text", text: "Task not found" }], details: {} };
			expanded = true;
			const updated: string[] = [];
			if (params.status === "deleted") {
				tasks.delete(params.taskId);
				return { content: [{ type: "text", text: `Updated task #${params.taskId} deleted` }], details: { tasks: snapshot(), nextId } };
			}
			const next: Task = { ...task };
			if (params.subject !== undefined && params.subject !== task.subject) {
				next.subject = params.subject;
				updated.push("subject");
			}
			if (params.description !== undefined && params.description !== task.description) {
				next.description = params.description;
				updated.push("description");
			}
			if (params.activeForm !== undefined && params.activeForm !== task.activeForm) {
				next.activeForm = params.activeForm;
				updated.push("activeForm");
			}
			if (params.owner !== undefined && params.owner !== task.owner) {
				next.owner = params.owner;
				updated.push("owner");
			}
			if (params.metadata !== undefined) {
				const merged = { ...(task.metadata ?? {}) };
				for (const [key, value] of Object.entries(params.metadata)) {
					if (value === null) delete merged[key];
					else merged[key] = value;
				}
				next.metadata = merged;
				updated.push("metadata");
			}
			if (params.status !== undefined && params.status !== task.status) {
				next.status = params.status;
				updated.push("status");
			}
			if (params.addBlocks && params.addBlocks.length > 0) {
				const added = params.addBlocks.filter((id) => !next.blocks.includes(id));
				next.blocks = [...next.blocks, ...added];
				for (const id of added) {
					const other = tasks.get(id);
					if (other && !other.blockedBy.includes(params.taskId)) tasks.set(id, { ...other, blockedBy: [...other.blockedBy, params.taskId] });
				}
				if (added.length > 0) updated.push("blocks");
			}
			if (params.addBlockedBy && params.addBlockedBy.length > 0) {
				const added = params.addBlockedBy.filter((id) => !next.blockedBy.includes(id));
				next.blockedBy = [...next.blockedBy, ...added];
				for (const id of added) {
					const other = tasks.get(id);
					if (other && !other.blocks.includes(params.taskId)) tasks.set(id, { ...other, blocks: [...other.blocks, params.taskId] });
				}
				if (added.length > 0) updated.push("blockedBy");
			}
			tasks.set(params.taskId, next);
			return { content: [{ type: "text", text: `Updated task #${params.taskId} ${updated.join(", ")}` }], details: { tasks: snapshot(), nextId } };
		},
		renderCall() {
			return new Text("", 0, 0);
		},
		renderResult(result, _options, theme, context) {
			invalidators.add(context.invalidate);
			const details = result.details as { tasks?: Task[] } | undefined;
			return new Text(renderTasks(details?.tasks ?? [], expanded, theme), 0, 0);
		},
	});

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.onTerminalInput((data: string) => {
			if (!matchesKey(data, "ctrl+t")) return undefined;
			expanded = !expanded;
			redraw();
			return { consume: true };
		});
	});
}

if (process.env.CLAUDE_TODOS_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain: Paint = { fg: (_role, text) => text, bold: (t) => `**${t}**`, strikethrough: (t) => `~~${t}~~` };

	const tasks: Task[] = [
		{ id: "1", subject: "Read the file", description: "d", activeForm: "Reading the file", status: "completed", blocks: [], blockedBy: [] },
		{ id: "2", subject: "Fix the bug", description: "d", activeForm: "Fixing the bug", status: "in_progress", owner: "agent-a", blocks: [], blockedBy: ["1"] },
		{ id: "3", subject: "Write a test", description: "d", status: "pending", blocks: [], blockedBy: [] },
	];

	check(glyphFor("pending") === "☐", "pending uses the ballot-box glyph, matching Claude's terminal glyph-support probe string");
	check(glyphFor("in_progress") === "☐", "in_progress is not yet done, same open box as pending");
	check(glyphFor("completed") === "☒", "completed uses the crossed ballot-box glyph");

	check(taskLine(tasks[0], plain) === "~~☒ #1 Read the file~~", "completed tasks are struck through");
	check(taskLine(tasks[1], plain) === "**☐ #2 Fixing the bug (agent-a) [blocked by #1]**", "in_progress shows activeForm, owner and blockedBy, bolded");
	check(taskLine(tasks[2], plain) === "☐ #3 Write a test", "pending tasks show the subject plainly");

	check(summaryLine(tasks) === "☐ 1/3 tasks (ctrl+t to expand)", "collapsed form is a done/total count with the ctrl+t hint");
	check(renderTasks([], true, plain) === "", "no tasks yet means no row");
	check(renderTasks(tasks, false, plain) === summaryLine(tasks), "collapsed shows the summary line");
	check(renderTasks(tasks, true, plain) === tasks.map((t) => taskLine(t, plain)).join("\n"), "expanded shows every line");

	check(taskListText([]) === "No tasks found", "Claude's exact empty-list text");
	check(taskListText(tasks) === "#1 [completed] Read the file\n#2 [in_progress] Fix the bug (agent-a)\n#3 [pending] Write a test", "TaskList's summary format, resolved blockedBy dropped once the blocker is completed");
	check(taskGetText(undefined) === "Task not found", "Claude's exact not-found text");
	check(taskGetText(tasks[1]) === "Task #2: Fix the bug\nStatus: in_progress\nDescription: d\nBlocked by: #1", "TaskGet's field order, Blocked by only when non-empty");

	const invalidators = new Set<() => void>();
	let calls = 0;
	invalidators.add(() => {
		calls++;
		invalidators.add(() => calls++);
	});
	for (const invalidate of [...invalidators]) invalidate();
	check(calls === 1, "snapshotting invalidators before the ctrl+t loop keeps a re-render's own invalidate() from re-entering the same pass (measured: without the snapshot, pi hung on ctrl+t after a real task_update call)");

	console.log("claude-todos selftest OK");
}
