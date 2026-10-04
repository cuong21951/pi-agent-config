import { createBashTool, createLocalBashOperations, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import { Type } from "typebox";
import { describeTool, dynamic, failed, finished, groupRow, joinOnExecute, watch } from "../claude-tools/rows.ts";
import { detailRows, OUTPUT_READ_BYTES, type Paint, pill, type ShellView } from "./details.ts";
import { backgroundLines, CLAUDE_BASH_MAX_CHARS, DEFAULT_TIMEOUT_SECONDS, describeBash, displayOutput, exitCodeOf, rejectedLines, resultLines, stopCallLine, stopResultLine, timedOutError, verboseCallLine, withDefaultTimeout } from "./render.ts";
import {
	adopt,
	autoBackgrounds,
	BACKGROUND_HINT_AFTER_MS,
	BASH_BACKGROUND_GUIDANCE,
	backgroundNotice,
	completionSummary,
	outputPath,
	type Reason,
	RUN_IN_BACKGROUND_DESCRIPTION,
	registry,
	type Run,
	type Shell,
	STOP_DESCRIPTION,
	STOP_TOOL,
	startRun,
	stopAgentResult,
	stopResult,
	taskId,
	taskNotification,
} from "./shells.ts";

const heads = new Map<string, string | undefined>();

function readHead(path: string): string | undefined {
	if (!heads.has(path)) heads.set(path, readFileHead(path));
	return heads.get(path);
}

function readFileHead(path: string): string | undefined {
	try {
		const fd = openSync(path, "r");
		try {
			const buffer = Buffer.alloc(CLAUDE_BASH_MAX_CHARS * 4);
			return buffer.subarray(0, readSync(fd, buffer, 0, buffer.length, 0)).toString("utf8");
		} finally {
			closeSync(fd);
		}
	} catch {
		return undefined;
	}
}

function readTail(path: string): { output: string; bytesTotal: number } {
	try {
		const fd = openSync(path, "r");
		try {
			const total = fstatSync(fd).size;
			const buffer = Buffer.alloc(Math.min(total, OUTPUT_READ_BYTES));
			const read = readSync(fd, buffer, 0, buffer.length, Math.max(0, total - buffer.length));
			return { output: buffer.subarray(0, read).toString("utf8"), bytesTotal: total };
		} finally {
			closeSync(fd);
		}
	} catch {
		return { output: "", bytesTotal: 0 };
	}
}

function viewOf(shell: Shell): ShellView {
	return { status: shell.status, exitCode: shell.exitCode, command: shell.command, startedAt: shell.startedAt, endedAt: shell.endedAt, ...readTail(shell.path) };
}

function backgroundAgents(): number {
	const fleet = (globalThis as Record<symbol, unknown>)[Symbol.for("pi-subagents:manager")] as { backgroundRunningCount?: () => number } | undefined;
	return typeof fleet?.backgroundRunningCount === "function" ? fleet.backgroundRunningCount() : 0;
}

const hexPaint = (bold: (text: string) => string): Paint => ({
	bold,
	hex: (color, text) => `\x1b[38;2;${parseInt(color.slice(0, 2), 16)};${parseInt(color.slice(2, 4), 16)};${parseInt(color.slice(4, 6), 16)}m${text}\x1b[39m`,
	italic: (text) => `\x1b[3m${text}\x1b[23m`,
});

type BashParams = { command: string; description?: string; timeout?: number; run_in_background?: boolean };
type Result = { content: Array<{ type: "text"; text: string }>; details: { backgroundTaskId: string } };
type Foreground = { run?: Run; move: (reason: Reason, timeoutMs?: number) => boolean };

const NOTIFICATION = "bash-notification";
const MODAL_EVENT = "claude-modes:modal";
const SHELL_STATUS = "shells";
const SEND_NOW_CHORD_MS = 1500;

export default function (pi: ExtensionAPI) {
	const cwd = process.cwd();
	const originalBash = createBashTool(cwd);
	const exec = createLocalBashOperations().exec;
	const params = originalBash.parameters as Record<string, any>;
	const foreground = new Map<string, Foreground>();
	let sessionId = "session";
	let refreshStatus = () => {};

	const notify = (shell: Shell) => {
		refreshStatus();
		if (shell.stoppedByModel) return;
		pi.sendMessage(
			{ customType: NOTIFICATION, content: taskNotification(shell), display: true, details: { summary: completionSummary(shell.description, shell.status, shell.exitCode) } },
			{ deliverAs: "followUp", triggerTurn: true },
		);
	};

	const background = (run: Run, toolCallId: string, p: BashParams, reason: Reason, timeoutMs?: number): Result => {
		const id = taskId();
		const path = outputPath(cwd, sessionId, id);
		adopt(run, { id, command: p.command, description: p.description || p.command, toolCallId, path }, notify);
		refreshStatus();
		return { content: [{ type: "text", text: backgroundNotice(id, path, reason, timeoutMs) }], details: { backgroundTaskId: id } };
	};

	const runForeground = (toolCallId: string, p: BashParams, signal?: AbortSignal, onUpdate?: any) => {
		let moved: (result: Result) => void = () => {};
		const movedResult = new Promise<Result>((resolve) => (moved = resolve));
		const call: Foreground = {
			move(reason, timeoutMs) {
				if (!call.run || call.run.backgrounded) return false;
				moved(background(call.run, toolCallId, p, reason, timeoutMs));
				return true;
			},
		};
		foreground.set(toolCallId, call);
		const operations = {
			exec: (command: string, execCwd: string, options: { onData: (data: Buffer) => void; signal?: AbortSignal; timeout?: number; env?: NodeJS.ProcessEnv }) => {
				const run = startRun(exec, command, execCwd, options.env);
				run.sink = options.onData;
				call.run = run;
				let timedOut = false;
				const onAbort = () => {
					if (!run.backgrounded) run.abort();
				};
				options.signal?.addEventListener("abort", onAbort, { once: true });
				const timeoutMs = options.timeout ? options.timeout * 1000 : undefined;
				const timer =
					timeoutMs === undefined
						? undefined
						: setTimeout(() => {
								if (run.backgrounded) return;
								if (autoBackgrounds(command)) call.move("timeout", timeoutMs);
								else {
									timedOut = true;
									run.abort();
								}
							}, timeoutMs);
				return run.done
					.finally(() => {
						if (timer) clearTimeout(timer);
						options.signal?.removeEventListener("abort", onAbort);
						foreground.delete(toolCallId);
					})
					.then((result) => {
						if (result === "aborted") throw new Error(timedOut ? `timeout:${options.timeout}` : "aborted");
						return result;
					});
			},
		};
		const running = createBashTool(cwd, { operations }).execute(toolCallId, withDefaultTimeout(p), signal, onUpdate).catch((error: Error) => {
			throw timedOutError(error);
		});
		running.catch(() => {});
		return Promise.race([running, movedResult]);
	};

	const run = joinOnExecute("bash", (toolCallId: string, p: BashParams, signal?: AbortSignal, onUpdate?: any) => {
		if (p.run_in_background === true) return Promise.resolve(background(startRun(exec, p.command, cwd), toolCallId, p, "run"));
		return runForeground(toolCallId, p, signal, onUpdate);
	});
	describeTool("bash", describeBash);

	const moveAll = (reason: Reason): boolean => {
		let movedAny = false;
		for (const call of foreground.values()) {
			if (call.run && Date.now() - call.run.startedAt >= (reason === "user" ? BACKGROUND_HINT_AFTER_MS : 0)) movedAny = call.move(reason) || movedAny;
		}
		return movedAny;
	};

	pi.on("session_start", (_event, ctx) => {
		sessionId = ctx.sessionManager.getSessionId();
		if (!ctx.hasUI) return;
		let focused = false;
		refreshStatus = () => {
			const count = registry.runningCount();
			if (count === 0) focused = false;
			ctx.ui.setStatus(SHELL_STATUS, pill(count, focused));
		};
		const focus = (on: boolean) => {
			focused = on;
			refreshStatus();
		};
		const openDetails = () => {
			const shell = [...registry.shells.values()].filter((s) => s.status === "running").at(-1);
			if (!shell) return;
			pi.events.emit(MODAL_EVENT, true);
			void ctx.ui.custom<void>(
				(tui, theme, _keybindings, done) => {
					const timer = setInterval(() => tui.requestRender(), 1000);
					const close = () => {
						clearInterval(timer);
						done(undefined);
					};
					const paint = hexPaint((text) => theme.bold(text));
					return {
						render: (width: number) => detailRows(viewOf(shell), width, Date.now(), paint),
						invalidate() {},
						handleInput(input: string) {
							if (input === "x" && shell.status === "running") {
								shell.stop();
								close();
							} else if (matchesKey(input, "escape") || matchesKey(input, "enter") || input === " " || matchesKey(input, "left")) close();
						},
					};
				},
				{ overlay: true, overlayOptions: { anchor: "bottom-left", width: "100%", margin: 0 } },
			).finally(() => pi.events.emit(MODAL_EVENT, false));
		};
		refreshStatus();
		let chordAt = 0;
		ctx.ui.onTerminalInput((data: string) => {
			if (focused) {
				focus(false);
				if (matchesKey(data, "down") || matchesKey(data, "enter")) {
					openDetails();
					return { consume: true };
				}
				if (matchesKey(data, "up") || matchesKey(data, "escape")) return { consume: true };
				return undefined;
			}
			if (matchesKey(data, "down") && registry.runningCount() > 0 && ctx.ui.getEditorText() === "" && backgroundAgents() === 0) {
				focus(true);
				return { consume: true };
			}
			if (matchesKey(data, "ctrl+b")) return moveAll("user") ? { consume: true } : undefined;
			if (matchesKey(data, "ctrl+x")) {
				chordAt = Date.now();
				return foreground.size > 0 ? { consume: true } : undefined;
			}
			const sendNow = matchesKey(data, "ctrl+enter") || (matchesKey(data, "ctrl+s") && Date.now() - chordAt < SEND_NOW_CHORD_MS);
			chordAt = 0;
			if (sendNow && ctx.hasPendingMessages()) return moveAll("message") ? { consume: true } : undefined;
			return undefined;
		});
	});

	pi.on("session_shutdown", () => {
		for (const shell of registry.shells.values()) {
			if (shell.status !== "running") continue;
			shell.stoppedByModel = true;
			shell.stop();
		}
		for (const run of registry.runs) run.abort();
	});

	pi.registerMessageRenderer<{ summary?: string }>(NOTIFICATION, (message, _options, theme) => {
		const summary = message.details?.summary ?? "";
		return dynamic((width) => [truncateToWidth(theme.fg("borderAccent", "● ") + summary, width)]);
	});

	pi.registerTool({
		name: "bash",
		label: "bash",
		description:
			originalBash.description +
			"\nWhen you call bash, also provide a short `description` field stating in plain language what the command does (e.g. \"Check git status\"). The transcript shows this as the label." +
			`\nA command is stopped after ${DEFAULT_TIMEOUT_SECONDS} seconds unless you pass a longer \`timeout\` (seconds) — do that for builds, test suites and other known-slow work.` +
			BASH_BACKGROUND_GUIDANCE,
		renderShell: "self",
		parameters: {
			...params,
			properties: {
				...(params.properties ?? {}),
				description: { type: "string", description: "Short human-readable label of what the command does." },
				timeout: { type: "number", description: `Timeout in seconds (default ${DEFAULT_TIMEOUT_SECONDS}).` },
				run_in_background: { type: "boolean", description: RUN_IN_BACKGROUND_DESCRIPTION },
			},
		},

		async execute(toolCallId, params, signal, onUpdate) {
			return run(toolCallId, params as BashParams, signal, onUpdate);
		},

		renderCall(_args, theme, context) {
			const id = (context as { toolCallId?: string })?.toolCallId ?? "";
			const invalidate = (context as { invalidate?: () => void })?.invalidate;
			if (id && invalidate) watch(id, invalidate);
			const expanded = (context as { expanded?: boolean })?.expanded === true;
			return dynamic((width) => (expanded && finished.has(id) ? [] : groupRow(id, width, theme).map((line) => truncateToWidth(line, width))));
		},

		renderResult(result, { expanded, isPartial }, theme, context) {
			const content = result.content[0];
			const output = content?.type === "text" ? content.text : "";
			const rejected = isPartial ? null : rejectedLines(output, theme);
			if (rejected) return dynamic((width) => rejected.map((line) => truncateToWidth(line, width)));
			if (isPartial || !expanded) return dynamic(() => []);
			const args = (context as { args?: { command?: unknown; description?: unknown } })?.args ?? {};
			const command = String(args.command ?? "");
			if ((result.details as { backgroundTaskId?: string } | undefined)?.backgroundTaskId) return dynamic((width) => backgroundLines(command, theme).map((line) => truncateToWidth(line, width)));
			const id = (context as { toolCallId?: string })?.toolCallId ?? "";
			const exitCode = exitCodeOf(output) ?? (failed.has(id) ? 1 : null);
			const lines = resultLines(displayOutput(output, readHead), exitCode, expanded, theme);
			const failedCall = exitCode !== 0 && exitCode !== null;
			return dynamic((width) => [verboseCallLine(command, failedCall, theme), ...(lines ?? [])].map((line) => truncateToWidth(line, width)));
		},
	});

	pi.registerTool({
		name: STOP_TOOL,
		label: STOP_TOOL,
		description: STOP_DESCRIPTION,
		renderShell: "self",
		parameters: Type.Object({
			task_id: Type.Optional(Type.String({ description: "The ID of the background task to stop. Agent-team teammates and named background agents are also accepted by agent ID or name." })),
			shell_id: Type.Optional(Type.String({ description: "Deprecated: use task_id instead" })),
		}),

		async execute(_toolCallId, params) {
			const key = (params as { task_id?: string; shell_id?: string }).task_id ?? (params as { shell_id?: string }).shell_id;
			if (!key) throw new Error("Missing required parameter: task_id");
			const claudeTasks = (globalThis as { __claudeTasks?: { stop(id: string): boolean } }).__claudeTasks;
			if (claudeTasks?.stop(key)) return { content: [{ type: "text", text: `Updated task #${key} deleted` }], details: {} };
			const agents = (globalThis as Record<symbol, { stopByModel?(ref: string): { id: string; description: string; status: string; stopped: boolean } | undefined } | undefined>)[Symbol.for("pi-subagents:manager")];
			const agent = registry.shells.has(key) ? undefined : agents?.stopByModel?.(key);
			if (agent) {
				if (!agent.stopped) throw new Error(`Task ${agent.id} is not running (status: ${agent.status})`);
				return { content: [{ type: "text", text: stopAgentResult(agent) }], details: { command: agent.description } };
			}
			const shell = registry.shells.get(key);
			if (!shell) throw new Error(`No task found with ID: ${key}`);
			shell.stoppedByModel = true;
			shell.stop();
			return { content: [{ type: "text", text: stopResult(shell) }], details: { command: shell.command } };
		},

		renderCall(_args, theme, context) {
			const id = (context as { toolCallId?: string })?.toolCallId ?? "";
			return dynamic((width) => [truncateToWidth(stopCallLine(failed.has(id), theme), width)]);
		},

		renderResult(result, { isPartial }, theme, context) {
			if (isPartial) return dynamic(() => []);
			const command = (result.details as { command?: string } | undefined)?.command;
			const content = result.content[0];
			const error = (context as { isError?: boolean })?.isError === true ? (content?.type === "text" ? content.text : "") : undefined;
			return dynamic((width) => [truncateToWidth(stopResultLine(command, error, theme), width)]);
		},
	});
}
