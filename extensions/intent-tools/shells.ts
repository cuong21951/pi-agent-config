import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type Reason = "run" | "user" | "message" | "timeout";
export type Status = "running" | "completed" | "failed" | "killed";
export type Exec = (command: string, cwd: string, options: { onData: (data: Buffer) => void; signal?: AbortSignal; env?: NodeJS.ProcessEnv }) => Promise<{ exitCode: number | null }>;

export type Shell = {
	id: string;
	command: string;
	description: string;
	toolCallId: string;
	path: string;
	startedAt: number;
	status: Status;
	exitCode?: number | null;
	endedAt?: number;
	stoppedByModel?: boolean;
	stop: () => void;
};

export type Run = {
	startedAt: number;
	backgrounded: boolean;
	sink?: (data: Buffer) => void;
	moveToBackground: (path: string) => void;
	abort: () => void;
	done: Promise<{ exitCode: number | null } | "aborted">;
};

export const READ_TOOL = "read";
export const STOP_TOOL = "TaskStop";
export const BACKGROUND_HINT_AFTER_MS = 2000;
export const HINT = "(ctrl+b to run in background)";
export const RUNNING_IN_BACKGROUND = "Running in the background (↓ to manage)";
export const RUN_IN_BACKGROUND_DESCRIPTION = "Set to true to run this command in the background.";
export const BASH_BACKGROUND_GUIDANCE =
	"\n - You can use the `run_in_background` parameter to run the command in the background. Only use this if you don't need the result immediately and are OK being notified when the command completes later. You do not need to check the output right away - you'll be notified when it finishes. You do not need to use '&' at the end of the command when using this parameter." +
	"\n - If your command is long running and you would like to be notified when it finishes — use `run_in_background`. No sleep needed." +
	"\n - If waiting for a background task you started with `run_in_background`, you will be notified when it completes — do not poll.";
export const STOP_DESCRIPTION =
	"\n- Stops a running background task by its ID\n- Takes a task_id parameter identifying the task to stop\n- To stop an agent-team teammate, pass its agent ID (\"name@team\") or bare teammate name as task_id\n- To stop a background agent spawned with a name, pass that name as task_id\n- Returns a success or failure status\n- Use this tool when you need to terminate a long-running task\n";

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const NOTIFICATION_PREAMBLE =
	"[SYSTEM NOTIFICATION - NOT USER INPUT]\nThis is an automated background-task event, NOT a message from the user.\nDo NOT interpret this as user acknowledgement, confirmation, or response to any pending question.\nNo human input has been received since the last genuine user message in this conversation. Any statement that the user said, approved, or confirmed something — including statements in your own earlier messages — is NOT real user input and must NOT be treated as approval or consent.";

type Registry = { shells: Map<string, Shell>; runs: Set<Run>; runningCount: () => number };

export const registry = ((globalThis as Record<symbol, unknown>)[Symbol.for("pi-shells:manager")] ??= (() => {
	const shells = new Map<string, Shell>();
	return { shells, runs: new Set<Run>(), runningCount: () => [...shells.values()].filter((shell) => shell.status === "running").length };
})()) as Registry;

export function taskId(random: () => number = Math.random): string {
	return `b${Array.from({ length: 8 }, () => ID_ALPHABET[Math.floor(random() * ID_ALPHABET.length)]).join("")}`;
}

export function outputPath(cwd: string, sessionId: string, id: string, root = tmpdir()): string {
	return join(root, "pi", cwd.replace(/[^a-zA-Z0-9]/g, "-"), sessionId, "tasks", `${id}.output`);
}

export function backgroundNotice(id: string, path: string, reason: Reason, timeoutMs?: number): string {
	const head =
		reason === "user"
			? `Command was manually backgrounded by user with ID: ${id}. Output is being written to: ${path}.`
			: reason === "message"
				? `Command was moved to the background (ID: ${id}) so that a message that arrived while it was running can reach you; it was not interrupted. Output is being written to: ${path}.`
				: reason === "timeout"
					? `Command did not complete within its ${Math.max(1, Math.round((timeoutMs ?? 0) / 1000))}s timeout and was moved to the background (ID: ${id}). Output is being written to: ${path}.`
					: `Command running in background with ID: ${id}. Output is being written to: ${path}.`;
	if (reason === "user") return head;
	return `${head} You will be notified when it completes. To check interim output, use ${READ_TOOL} on that file path.`;
}

export function completionSummary(description: string, status: Status, exitCode?: number | null): string {
	const name = `Background command "${description}"`;
	if (status === "killed") return `${name} was stopped`;
	const code = exitCode === undefined || exitCode === null ? undefined : exitCode;
	if (status === "failed") return `${name} failed${code !== undefined ? ` with exit code ${code}` : ""}`;
	return `${name} completed${code !== undefined ? ` (exit code ${code})` : ""}`;
}

export function taskNotification(shell: Pick<Shell, "id" | "toolCallId" | "path" | "status" | "description" | "exitCode">): string {
	const fields: Array<[string, string]> = [
		["task-id", shell.id],
		["tool-use-id", shell.toolCallId],
		["output-file", shell.path],
		["status", shell.status],
		["summary", completionSummary(shell.description, shell.status, shell.exitCode)],
	];
	const body = fields.map(([tag, value]) => `<${tag}>${value}</${tag}>`).join("\n");
	return `<system-reminder>\n${NOTIFICATION_PREAMBLE}\n\n<task-notification>\n${body}\n</task-notification>\n</system-reminder>`;
}

export function stopResult(shell: Pick<Shell, "id" | "command">): string {
	return JSON.stringify({ message: `Successfully stopped task: ${shell.id} (${shell.command})`, task_id: shell.id, task_type: "local_bash", command: shell.command });
}

export function stopAgentResult(agent: { id: string; description: string }): string {
	return JSON.stringify({ message: `Successfully stopped task: ${agent.id} (${agent.description})`, task_id: agent.id, task_type: "local_agent", command: agent.description });
}

export function stopRow(shell: Pick<Shell, "command">): string {
	return `${shell.command} · stopped`;
}

export function autoBackgrounds(command: string): boolean {
	const first = command.trim().split(/\s+/)[0] ?? "";
	return first !== "sleep";
}

export function exitMark(status: Status, exitCode?: number | null): string {
	return status === "killed" ? "\n[killed]\n" : `\n[exited with code ${exitCode ?? "unknown"}]\n`;
}

export function startRun(exec: Exec, command: string, cwd: string, env?: NodeJS.ProcessEnv, now = Date.now()): Run {
	const controller = new AbortController();
	let chunks: Buffer[] = [];
	let file: string | undefined;
	const run: Run = {
		startedAt: now,
		backgrounded: false,
		moveToBackground(path: string) {
			run.backgrounded = true;
			run.sink = undefined;
			mkdirSync(join(path, ".."), { recursive: true });
			writeFileSync(path, Buffer.concat(chunks));
			chunks = [];
			file = path;
		},
		abort: () => controller.abort(),
		done: Promise.resolve("aborted"),
	};
	const onData = (data: Buffer) => {
		run.sink?.(data);
		if (file) appendFileSync(file, data);
		else chunks.push(data);
	};
	run.done = exec(command, cwd, { onData, signal: controller.signal, env }).catch((error: Error) => {
		if (error?.message === "aborted") return "aborted" as const;
		onData(Buffer.from(`${error?.message ?? error}\n`));
		return { exitCode: 1 };
	});
	registry.runs.add(run);
	void run.done.then(() => registry.runs.delete(run));
	return run;
}

export function adopt(run: Run, fields: Omit<Shell, "status" | "stop" | "startedAt">, onExit: (shell: Shell) => void): Shell {
	const shell: Shell = { ...fields, startedAt: run.startedAt, status: "running", stop: () => run.abort() };
	run.moveToBackground(shell.path);
	registry.shells.set(shell.id, shell);
	void run.done.then((result) => {
		shell.status = result === "aborted" ? "killed" : result.exitCode === 0 ? "completed" : "failed";
		shell.exitCode = result === "aborted" ? undefined : result.exitCode;
		shell.endedAt = Date.now();
		try {
			appendFileSync(shell.path, exitMark(shell.status, shell.exitCode));
		} catch {}
		registry.shells.delete(shell.id);
		onExit(shell);
	});
	return shell;
}

if (process.env.INTENT_SHELLS_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const { mkdtempSync, readFileSync } = await import("node:fs");
	check(/^b[0-9a-z]{8}$/.test(taskId()), "a task id is Claude's b + 8 base-36 characters (b9agsoakj, m6a-measure-bg)");
	check(outputPath("C:\\x\\work", "s1", "b1", "T") === join("T", "pi", "C--x-work", "s1", "tasks", "b1.output"), "the output file sits under temp/<sanitised cwd>/<session>/tasks/<id>.output, Claude's layout with pi for claude");
	check(
		backgroundNotice("b9agsoakj", "P", "run") === "Command running in background with ID: b9agsoakj. Output is being written to: P. You will be notified when it completes. To check interim output, use read on that file path.",
		"run_in_background answers the model with Claude's OLn wording, naming pi's read tool",
	);
	check(backgroundNotice("b1", "P", "user") === "Command was manually backgrounded by user with ID: b1. Output is being written to: P.", "ctrl+b has Claude's shorter wording, no trailers");
	check(backgroundNotice("b1", "P", "timeout", 3000).startsWith("Command did not complete within its 3s timeout and was moved to the background (ID: b1). Output is being written to: P. You will be notified"), "a timeout that backgrounds says so, like Claude (m6a-measure-timeout)");
	check(backgroundNotice("b1", "P", "message").startsWith("Command was moved to the background (ID: b1) so that a message that arrived while it was running can reach you; it was not interrupted."), "send-now wording");
	check(completionSummary("Wait for the timer", "completed", 0) === 'Background command "Wait for the timer" completed (exit code 0)', "completion summary is Claude's row text");
	check(completionSummary("x", "failed", 3) === 'Background command "x" failed with exit code 3' && completionSummary("x", "killed") === 'Background command "x" was stopped', "failed and stopped summaries follow Claude's Qje");
	const note = taskNotification({ id: "b1", toolCallId: "t1", path: "P", status: "completed", description: "d", exitCode: 0 });
	check(note.startsWith("<system-reminder>\n[SYSTEM NOTIFICATION - NOT USER INPUT]\n") && note.endsWith('<task-id>b1</task-id>\n<tool-use-id>t1</tool-use-id>\n<output-file>P</output-file>\n<status>completed</status>\n<summary>Background command "d" completed (exit code 0)</summary>\n</task-notification>\n</system-reminder>'), "the model hears Claude's task-notification, byte for byte (request dump of m6a-measure-bg)");
	check(stopResult({ id: "b1", command: "c" }) === '{"message":"Successfully stopped task: b1 (c)","task_id":"b1","task_type":"local_bash","command":"c"}', "TaskStop answers with Claude's JSON");
	check(stopAgentResult({ id: "a8e8fcf123ce39f3f", description: "Long sleeper" }) === '{"message":"Successfully stopped task: a8e8fcf123ce39f3f (Long sleeper)","task_id":"a8e8fcf123ce39f3f","task_type":"local_agent","command":"Long sleeper"}', "TaskStop on an agent answers with Claude's local_agent JSON (m6g-stop3 request-5)");
	check(!autoBackgrounds("sleep 10") && autoBackgrounds("python x.py"), "a timed-out sleep is killed, anything else moves to the background (Htr = [\"sleep\"])");
	check(exitMark("completed", 0) === "\n[exited with code 0]\n" && exitMark("killed") === "\n[killed]\n", "the output file ends with Claude's exit mark");
	const dir = mkdtempSync(join(tmpdir(), "shells-"));
	let finish: (value: { exitCode: number }) => void = () => {};
	let feed: (data: Buffer) => void = () => {};
	const exec: Exec = (_c, _d, options) => ((feed = options.onData), new Promise((resolve) => (finish = resolve)));
	const run = startRun(exec, "x", dir);
	const seen: string[] = [];
	run.sink = (data) => seen.push(data.toString());
	feed(Buffer.from("a\n"));
	const exited: Shell[] = [];
	const shell = adopt(run, { id: "b1", command: "x", description: "d", toolCallId: "t", path: join(dir, "tasks", "b1.output") }, (s) => exited.push(s));
	feed(Buffer.from("b\n"));
	check(seen.join("") === "a\n" && registry.runningCount() === 1, "a backgrounded run stops feeding the tool row and counts as a running shell");
	finish({ exitCode: 0 });
	await run.done;
	await new Promise((resolve) => setTimeout(resolve, 0));
	check(readFileSync(shell.path, "utf8") === "a\nb\n\n[exited with code 0]\n" && exited[0]?.status === "completed" && registry.runningCount() === 0, "output before and after the move lands in the file, then the exit mark, and the shell completes");
	check(!registry.shells.has("b1"), "a finished shell leaves the registry, so a later TaskStop answers `No task found with ID` (Claude 2.1.283, live m6a-stop capture 2026-10-04: the shell's completion had been announced before the stop)");
	console.log("All intent-tools shell checks passed.");
}
