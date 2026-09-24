import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { generateDiffString, getAgentDir, getMarkdownTheme, type ExtensionAPI, type ExtensionContext, type Theme } from "@earendil-works/pi-coding-agent";
import { Markdown, matchesKey, stripTerminalSequences, truncateToWidth, visibleWidth, type Component, type KeybindingsManager, type TUI } from "@earendil-works/pi-tui";
import { MODAL_EVENT } from "../claude-bottom-input/index.ts";
import { contentRows, diffRows, paint as paintRow, trimDiffContext, wrapRow, type Row } from "../claude-tools/format.ts";
import {
	approvedRows,
	bashPreviewRows,
	commandRows,
	dialogRows,
	enteredRows,
	exitedRows,
	exitPlanRows,
	markdownUnescape,
	planDialogRows,
	rejectedRows,
	titleFor,
	type Paint,
	type ToolKind,
} from "./dialog.ts";
import {
	approvalModes,
	approvedResult,
	CYCLE_HINT,
	editorCommand,
	editorName,
	ENTER_DESCRIPTION,
	ENTERED_RESULT,
	EXIT_DESCRIPTION,
	EXITED_RESULT,
	gate,
	isAutoModeAvailable,
	MODE_LINE,
	noticeLine,
	planReminder,
	freshPlanSlug,
	rejectedResult,
	RESET,
	type Mode,
	nextMode,
} from "./modes.ts";

const PERMISSION_CONFIG =
	process.env.CLAUDE_MODES_PERMISSION_CONFIG ?? join(getAgentDir(), "extensions", "pi-permission-system", "config.json");

function readYolo(): boolean {
	try {
		return JSON.parse(readFileSync(PERMISSION_CONFIG, "utf8")).yoloMode === true;
	} catch {
		return false;
	}
}

function writeYolo(on: boolean): void {
	try {
		const config = JSON.parse(readFileSync(PERMISSION_CONFIG, "utf8"));
		if (config.yoloMode === on) return;
		writeFileSync(PERMISSION_CONFIG, `${JSON.stringify({ ...config, yoloMode: on }, null, 2)}\n`);
	} catch {
		// leave the operator's config alone if it cannot be parsed
	}
}

// ponytail: the status text is already painted here so claude-footer can print it as-is on its own row.
function modeRow(mode: Mode, ctx: any): string {
	const line = MODE_LINE[mode];
	const hint = mode === "manual" ? "" : ctx.ui.theme.fg("muted", CYCLE_HINT);
	return line.ansi + line.text + RESET + hint;
}

function noticeWidget(mode: Mode, ctx: any): ((tui: any, theme: any) => { render(width: number): string[]; invalidate(): void }) | undefined {
	if (mode !== "manual" || isAutoModeAvailable(ctx.model?.id)) return undefined;
	return (_tui, theme) => ({
		render(width: number) {
			return [noticeLine(width, (role, text) => theme.fg(role, text))];
		},
		invalidate() {},
	});
}

function renderRows(rows: Row[], width: number): string[] {
	return rows.flatMap((row) =>
		wrapRow(row, width).map((piece) => {
			const text = stripTerminalSequences(truncateToWidth(piece.text, width));
			return paintRow(piece, text, Math.max(0, width - visibleWidth(text)));
		}),
	);
}

function applyEditsPreview(oldContent: string, edits: ReadonlyArray<{ oldText: string; newText: string }>): string {
	let content = oldContent;
	for (const edit of edits) {
		const index = content.indexOf(edit.oldText);
		if (index === -1) continue;
		content = content.slice(0, index) + edit.newText + content.slice(index + edit.oldText.length);
	}
	return content;
}

function readFileSafe(path: string): string {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return "";
	}
}

interface PreviewSpec {
	title: string;
	target: string;
	rowsFor: (width: number) => string[];
}

function buildPreviewSpec(kind: ToolKind, input: Record<string, unknown>, cwd: string, paint: Paint): PreviewSpec {
	if (kind === "bash") {
		const command = String(input.command ?? "");
		const description = String(input.description ?? "");
		return { title: titleFor("bash", false), target: cwd, rowsFor: () => bashPreviewRows(command, description, paint) };
	}
	const path = String(input.path ?? "");
	const exists = existsSync(path);
	const pathRow = `   ${paint("muted", path)}`;
	if (kind === "edit") {
		const edits = Array.isArray(input.edits) ? (input.edits as Array<{ oldText: string; newText: string }>) : [];
		const oldContent = readFileSafe(path);
		const newContent = applyEditsPreview(oldContent, edits);
		const { diff } = generateDiffString(oldContent, newContent);
		const lines = trimDiffContext(diff.split("\n"));
		return { title: titleFor("edit", exists), target: path, rowsFor: (width) => [pathRow, ...renderRows(diffRows(lines), width)] };
	}
	const content = String(input.content ?? "");
	const rows = contentRows(content).slice(0, 10);
	return { title: titleFor("write", exists), target: path, rowsFor: (width) => [pathRow, ...renderRows(rows, width)] };
}

type Outcome = "yes" | "always" | "no" | "amend";

function outcomeFor(index: number): Outcome {
	return index === 0 ? "yes" : index === 1 ? "always" : "no";
}

function buildPermissionComponent(tui: TUI, theme: Theme, keybindings: KeybindingsManager, done: (result: Outcome) => void, spec: PreviewSpec): Component {
	let selectedIndex = 0;
	const paint: Paint = (role, text) => theme.fg(role as never, text);
	const select = (index: number) => done(outcomeFor(index));
	return {
		render(width: number): string[] {
			return dialogRows(spec.title, spec.rowsFor(width), spec.target, selectedIndex, width, paint);
		},
		invalidate(): void {},
		handleInput(data: string): void {
			if (matchesKey(data, "1")) return select(0);
			if (matchesKey(data, "2")) return select(1);
			if (matchesKey(data, "3")) return select(2);
			if (matchesKey(data, "tab")) return done("amend");
			if (keybindings.matches(data, "tui.select.up")) {
				selectedIndex = (selectedIndex + 2) % 3;
				tui.requestRender();
				return;
			}
			if (keybindings.matches(data, "tui.select.down")) {
				selectedIndex = (selectedIndex + 1) % 3;
				tui.requestRender();
				return;
			}
			if (keybindings.matches(data, "tui.select.confirm")) return select(selectedIndex);
			if (keybindings.matches(data, "tui.select.cancel")) return done("no");
		},
	};
}

async function askPermission(ctx: ExtensionContext, kind: ToolKind, input: Record<string, unknown>): Promise<Outcome> {
	const paint: Paint = (role, text) => ctx.ui.theme.fg(role as never, text);
	const spec = buildPreviewSpec(kind, input, ctx.cwd, paint);
	return ctx.ui.custom<Outcome>((tui, theme, keybindings, done) => buildPermissionComponent(tui, theme, keybindings, done, spec));
}

const PLANS_DIR = join(getAgentDir(), "plans");
const PLAN_COMMAND_ENTRY = "claude-modes-plan-command";
const MODAL_PANE = { anchor: "bottom-left", width: "100%", margin: 0 } as const;
const NO_PLAN = "No plan found";

function view(render: (width: number) => string[]): Component {
	return { render, invalidate() {} };
}

const EMPTY = view(() => []);

function paintOf(theme: Theme): Paint {
	return (role, text) => theme.fg(role as never, text);
}

function planMarkdownTheme() {
	const base = getMarkdownTheme();
	return { ...base, underline: (text: string) => base.italic(base.underline(text)) };
}

function markdownRows(text: string, width: number): string[] {
	const lines = new Markdown(text, 0, 0, planMarkdownTheme()).render(Math.max(1, width)).map((line) => line.replace(/\s+$/, ""));
	while (lines.length > 0 && visibleWidth(lines[lines.length - 1]!) === 0) lines.pop();
	return lines;
}

function displayPath(path: string): string {
	const home = homedir();
	return path.toLowerCase().startsWith(home.toLowerCase()) ? `~${path.slice(home.length)}` : path;
}

function samePath(a: string, b: string): boolean {
	return process.platform === "win32" ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b);
}

function openInEditor(tui: TUI, path: string): void {
	tui.stop();
	try {
		spawnSync(`${editorCommand(process.env, process.platform)} "${path}"`, { stdio: "inherit", shell: true });
	} finally {
		tui.start();
		tui.requestRender(true);
	}
}

type Approval = { mode?: Mode; feedback: string };

function planComponent(tui: TUI, theme: Theme, keybindings: KeybindingsManager, done: (result: Approval | undefined) => void, planFile: string, modes: Mode[]): Component {
	const paint = paintOf(theme);
	const editor = editorName(editorCommand(process.env, process.platform));
	let plan = readFileSafe(planFile);
	let selected = 0;
	let feedback = "";
	const onFeedback = () => selected === modes.length;
	const redraw = () => tui.requestRender();
	const move = (step: number) => {
		selected = (selected + step + modes.length + 1) % (modes.length + 1);
		redraw();
	};
	const type = (text: string) => {
		feedback = text;
		redraw();
	};
	const edit = () => {
		openInEditor(tui, planFile);
		plan = readFileSafe(planFile) || plan;
	};
	const confirm = () => {
		if (!onFeedback()) return done({ mode: modes[selected], feedback: "" });
		if (feedback.trim() !== "") done({ feedback: feedback.trim() });
	};
	const pick = (index: number) => {
		if (index < modes.length) return done({ mode: modes[index], feedback: "" });
		if (index === modes.length) move(modes.length - selected);
	};
	return {
		render(width: number): string[] {
			const dialog = { planRows: markdownRows(plan, width - 6), modes, selected, feedback, editor, path: displayPath(planFile) };
			return planDialogRows(dialog, width, Math.max(1, tui.terminal.rows - 2), paint).map((row) => truncateToWidth(row, width));
		},
		invalidate(): void {},
		handleInput(data: string): void {
			if (keybindings.matches(data, "tui.select.cancel")) return done(undefined);
			if (matchesKey(data, "shift+tab")) return done({ mode: modes[0], feedback: feedback.trim() });
			if (matchesKey(data, "ctrl+g")) return edit();
			if (onFeedback() && matchesKey(data, "backspace")) return type(feedback.slice(0, -1));
			if (onFeedback() && !/[\x00-\x1f\x7f]/.test(data)) return type(feedback + data);
			if (keybindings.matches(data, "tui.select.up")) return move(-1);
			if (keybindings.matches(data, "tui.select.down")) return move(1);
			if (keybindings.matches(data, "tui.select.confirm")) return confirm();
			if (/^[1-9]$/.test(data)) return pick(Number(data) - 1);
		},
	};
}

function exitComponent(tui: TUI, theme: Theme, keybindings: KeybindingsManager, done: (yes: boolean) => void): Component {
	const paint = paintOf(theme);
	let selected = 0;
	return {
		render: (width: number) => exitPlanRows(selected, width, paint).map((row) => truncateToWidth(row, width)),
		invalidate(): void {},
		handleInput(data: string): void {
			if (keybindings.matches(data, "tui.select.cancel") || data === "2") return done(false);
			if (data === "1") return done(true);
			if (keybindings.matches(data, "tui.select.confirm")) return done(selected === 0);
			if (keybindings.matches(data, "tui.select.up") || keybindings.matches(data, "tui.select.down")) {
				selected = 1 - selected;
				tui.requestRender();
			}
		},
	};
}

type PlanOutcome = { outcome: "approved" | "rejected" | "exited"; plan: string; path: string };

function planResultRows(details: PlanOutcome | undefined, theme: Theme): Component {
	const paint = paintOf(theme);
	if (details?.outcome === "approved") return view((width) => approvedRows(markdownRows(details.plan, width - 5), displayPath(details.path), paint));
	if (details?.outcome === "rejected") return view((width) => rejectedRows(markdownRows(details.plan, width - 9), visibleWidth, paint));
	if (details?.outcome === "exited") return view(() => exitedRows());
	return EMPTY;
}

function textResult<T>(text: string, details: T, terminate = false) {
	return { content: [{ type: "text" as const, text }], details, terminate };
}

type PlanCommand = { command: string; lines: string[]; plan?: string; tail?: string[] };

function userBand(text: string, width: number, theme: Theme): string {
	const body = `${theme.fg("dim", "❯")} ${theme.fg("userMessageText", text)}`;
	return theme.bg("userMessageBg", body + " ".repeat(Math.max(0, width - visibleWidth(body))));
}

function planCommandRows(data: PlanCommand, width: number, theme: Theme): string[] {
	const plan = data.plan === undefined ? [] : ["", ...markdownRows(data.plan, width - 5), ""];
	const body = commandRows([...data.lines, ...plan, ...(data.tail ?? [])], paintOf(theme));
	return [userBand(data.command, width, theme), ...body].map((row) => truncateToWidth(row, width));
}

export default function (pi: ExtensionAPI) {
	let mode: Mode = "manual";
	let planFile: string | undefined;
	let lastPrompt = "";

	// ponytail: the permission extension re-reads its config at every turn start, so writing the
	// file is enough; reload() exists only on command contexts anyway.
	function setMode(target: Mode, ctx: any) {
		mode = target;
		writeYolo(mode === "bypass");
		syncPlanTools();
		if (!ctx.hasUI) return;
		ctx.ui.setStatus("modes", modeRow(mode, ctx));
		ctx.ui.setWidget("claude-modes-notice", noticeWidget(mode, ctx));
	}

	function syncPlanTools() {
		const active = new Set(pi.getActiveTools());
		active.delete(mode === "plan" ? "enter_plan_mode" : "exit_plan_mode");
		active.add(mode === "plan" ? "exit_plan_mode" : "enter_plan_mode");
		pi.setActiveTools([...active]);
	}

	function ensurePlanFile(): string {
		if (planFile === undefined) {
			mkdirSync(PLANS_DIR, { recursive: true });
			const slug = freshPlanSlug(lastPrompt, (count) => Math.floor(Math.random() * count), (taken) => existsSync(join(PLANS_DIR, `${taken}.md`)));
			planFile = join(PLANS_DIR, `${slug}.md`);
		}
		return planFile;
	}

	async function modal<T>(ctx: ExtensionContext, factory: (tui: TUI, theme: Theme, keybindings: KeybindingsManager, done: (result: T) => void) => Component): Promise<T | undefined> {
		pi.events.emit(MODAL_EVENT, true);
		try {
			return await ctx.ui.custom<T>(factory, { overlay: true, overlayOptions: MODAL_PANE });
		} finally {
			pi.events.emit(MODAL_EVENT, false);
		}
	}

	async function exitEmptyPlan(ctx: ExtensionContext, path: string) {
		const yes = await modal<boolean>(ctx, (tui, theme, keybindings, done) => exitComponent(tui, theme, keybindings, done));
		if (!yes) return textResult(rejectedResult(""), { outcome: "rejected", plan: NO_PLAN, path } as PlanOutcome, true);
		setMode("manual", ctx);
		return textResult(EXITED_RESULT, { outcome: "exited", plan: "", path } as PlanOutcome);
	}

	async function exitPlan(ctx: ExtensionContext) {
		const path = ensurePlanFile();
		if (readFileSafe(path).trim() === "") return exitEmptyPlan(ctx, path);
		const modes = approvalModes(ctx.model?.id);
		const approval = await modal<Approval | undefined>(ctx, (tui, theme, keybindings, done) => planComponent(tui, theme, keybindings, done, path, modes));
		const plan = readFileSafe(path);
		if (!approval?.mode) return textResult(rejectedResult(approval?.feedback ?? ""), { outcome: "rejected", plan, path } as PlanOutcome, approval === undefined);
		setMode(approval.mode, ctx);
		return textResult(approvedResult(path, plan, approval.feedback), { outcome: "approved", plan, path } as PlanOutcome);
	}

	function showPlanCommand(data: PlanCommand) {
		pi.appendEntry(PLAN_COMMAND_ENTRY, data);
	}

	async function openPlan(ctx: ExtensionContext) {
		const path = ensurePlanFile();
		if (!ctx.hasUI) return;
		await ctx.ui.custom<void>((tui, _theme, _keybindings, done) => {
			setImmediate(() => {
				openInEditor(tui, path);
				done();
			});
			return EMPTY;
		});
	}

	pi.on("session_start", async (_event, ctx) => {
		mode = readYolo() ? "bypass" : "manual";
		planFile = undefined;
		syncPlanTools();
		if (ctx.hasUI) ctx.ui.setStatus("modes", modeRow(mode, ctx));
	});

	pi.registerShortcut("shift+tab", {
		description: "Cycle mode (manual / auto / accept edits / plan / bypass)",
		handler: async (ctx) => setMode(nextMode(mode, ctx.model?.id), ctx),
	});

	pi.registerCommand("mode", {
		description: "Cycle mode (manual / auto / accept edits / plan / bypass)",
		handler: async (_args, ctx) => setMode(nextMode(mode, ctx.model?.id), ctx),
	});

	pi.registerEntryRenderer(PLAN_COMMAND_ENTRY, (entry, _options, theme) => view((width) => planCommandRows(entry.data as PlanCommand, width, theme as Theme)));

	pi.registerCommand("plan", {
		description: "Enable plan mode or view the current session plan",
		handler: async (args, ctx) => {
			const request = args.trim();
			if (request === "open") return openPlan(ctx);
			if (mode !== "plan") {
				setMode("plan", ctx);
				showPlanCommand({ command: request ? `/plan ${request}` : "/plan", lines: ["Enabled plan mode"] });
				if (request) pi.sendUserMessage(request);
				return;
			}
			const plan = planFile === undefined ? "" : readFileSafe(planFile);
			if (plan.trim() === "") return showPlanCommand({ command: "/plan", lines: ["Already in plan mode. No plan written yet."] });
			const editor = editorName(editorCommand(process.env, process.platform));
			showPlanCommand({ command: "/plan", lines: ["Current Plan", markdownUnescape(planFile!)], plan, tail: [`"/plan open" to edit this plan in ${editor}`] });
		},
	});

	pi.registerTool({
		name: "enter_plan_mode",
		label: "Enter plan mode",
		description: ENTER_DESCRIPTION,
		parameters: { type: "object", properties: {} },
		renderShell: "self",
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			setMode("plan", ctx);
			const path = ensurePlanFile();
			return textResult(`${ENTERED_RESULT}\n\n${planReminder(path, existsSync(path))}`, {});
		},
		renderCall: () => EMPTY,
		renderResult: (_result: unknown, { isPartial }: { isPartial: boolean }, theme: Theme) => (isPartial ? EMPTY : view(() => enteredRows(paintOf(theme)))),
	});

	pi.registerTool({
		name: "exit_plan_mode",
		label: "Exit plan mode",
		description: EXIT_DESCRIPTION,
		parameters: { type: "object", properties: {} },
		renderShell: "self",
		execute: (_toolCallId, _params, _signal, _onUpdate, ctx) => exitPlan(ctx),
		renderCall: () => EMPTY,
		renderResult: (result: { details?: PlanOutcome }, { isPartial }: { isPartial: boolean }, theme: Theme) => (isPartial ? EMPTY : planResultRows(result.details, theme)),
	});

	pi.on("before_agent_start", async (event) => {
		lastPrompt = String(event.prompt ?? "");
		if (mode !== "plan") return;
		const path = ensurePlanFile();
		return { message: { customType: "claude-modes-plan", content: planReminder(path, existsSync(path)), display: false } };
	});

	pi.on("tool_call", async (event, ctx) => {
		const input = (event.input ?? {}) as Record<string, unknown>;
		const command = String(input.command ?? "");
		const planTarget = planFile !== undefined && typeof input.path === "string" && samePath(resolve(ctx.cwd, input.path), planFile);
		const decision = gate(mode, event.toolName, command, planTarget);
		if (decision.action === "allow") return;
		if (decision.action === "block") return { block: true, reason: decision.reason };
		if (!ctx.hasUI) return;
		const kind = event.toolName as ToolKind;
		const outcome = await askPermission(ctx, kind, input);
		if (outcome === "no") return { block: true, reason: "Declined. Press shift+tab for bypass mode to stop being asked." };
		if (outcome === "amend") {
			if (kind === "bash") ctx.ui.setEditorText(command);
			return { block: true, reason: "Amend the command, then resend it." };
		}
	});
}

