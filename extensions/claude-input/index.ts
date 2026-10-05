import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { invocableNames } from "../claude-slash-menu/index.ts";

const ANSI = /\x1b\[[0-9;]*m/g;
const PROMPT = "❯ ";
const COMMAND_OPEN = "\x1b[38;2;153;204;255m";
const COMMAND_CLOSE = "\x1b[39m";

type Paint = (text: string) => string;
type CommandColour = { names: readonly string[]; paint: Paint };

const NO_COMMANDS: CommandColour = { names: [], paint: (text) => text };
const commandPaint: Paint = (text) => `${COMMAND_OPEN}${text}${COMMAND_CLOSE}`;
const BUILTIN_COMMAND_NAMES = [
	"settings", "model", "tree", "thinking", "scoped-models", "export", "import", "share", "copy", "name",
	"session", "changelog", "hotkeys", "fork", "clone", "trust", "login", "logout", "new", "clear", "compact",
	"resume", "reload", "quit",
];

// ponytail: Claude Code (2.1.260) draws a flat rule above and below the text and a "❯ " prompt, no side
// borders; its dim `Try "..."` example shows only before the first prompt (2.1.283). pi's editor already draws the rules, so the inner editor is rendered
// PROMPT.length columns narrower, its rules are stretched back to full width and its text rows
const isRule = (line: string) => line.replace(ANSI, "").startsWith("─");

export function commandMatchLength(text: string, names: readonly string[]): number {
	let best = 0;
	for (const name of names) {
		const candidate = `/${name}`;
		if (text.startsWith(candidate) && candidate.length > best) best = candidate.length;
	}
	return best;
}

const ESCAPE = /^(?:\x1b\[[0-9;?]*[A-Za-z]|\x1b_[^\x07]*\x07)/;

function rawIndexAfter(line: string, visible: number): number {
	let i = 0;
	let seen = 0;
	while (i < line.length && seen < visible) {
		const escape = ESCAPE.exec(line.slice(i));
		if (escape) {
			i += escape[0].length;
			continue;
		}
		i += (line.codePointAt(i) ?? 0) > 0xffff ? 2 : 1;
		seen++;
	}
	return i;
}

export function colourCommand(line: string, command: CommandColour): string {
	const len = commandMatchLength(line.replace(ANSI, ""), command.names);
	if (len === 0) return line;
	const cut = rawIndexAfter(line, len);
	return command.paint(line.slice(0, cut)) + line.slice(cut);
}

const COMMAND_TOKEN = /^\/[a-zA-Z0-9.:\-_]+$/;

export function noMatchRow(text: string, muted: Paint, names: readonly string[] = []): string[] {
	const known = names.some((name) => `/${name}`.startsWith(text));
	return COMMAND_TOKEN.test(text) && !known ? [muted(`  No commands match "${text}"`)] : [];
}

const VISIBLE_ESCAPES = /\x1b\[[0-9;?]*[A-Za-z]|\x1b_[^\x07]*\x07/g;
const APC = /\x1b_[^\x07]*\x07/g;
const DIM_OPEN = "\x1b[2m";
const DIM_CLOSE = "\x1b[22m";

export function stringHash(text: string): number {
	let hash = 0;
	for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
	return hash;
}

export function placeholderText(sessionId: string, file = "<filepath>"): string {
	const examples = ["fix lint errors", "fix typecheck errors", `how does ${file} work?`, `refactor ${file}`, "how do I log an error?", `edit ${file} to...`, `write a test for ${file}`, "create a util logging.py that..."];
	return `Try "${examples[(Math.abs(stringHash(sessionId)) >>> 8) % examples.length]}"`;
}

export function withPlaceholder(lines: string[], placeholder: string): string[] {
	const topRuleIndex = lines.findIndex(isRule);
	const row = lines[topRuleIndex + 1];
	if (topRuleIndex === -1) return lines;
	const width = row.replace(VISIBLE_ESCAPES, "").length;
	const markers = (row.match(APC) ?? []).join("");
	const filled = `${markers}${DIM_OPEN}${placeholder}${DIM_CLOSE}${" ".repeat(Math.max(0, width - placeholder.length))}`;
	return lines.map((line, i) => (i === topRuleIndex + 1 ? filled : line));
}

const EDITOR_NAMES: Readonly<Record<string, string>> = {
	code: "VS Code", cursor: "Cursor", windsurf: "Devin Desktop", antigravity: "Antigravity", vi: "Vim", vim: "Vim", nano: "nano",
	notepad: "Notepad", "start /wait notepad": "Notepad", emacs: "Emacs", subl: "Sublime Text", atom: "Atom",
};

export function editorName(command: string): string {
	const key = command.toLowerCase().trim();
	return EDITOR_NAMES[key] ?? EDITOR_NAMES[key.split(" ")[0]] ?? command;
}

export function externalEditorCommand(env: Readonly<Record<string, string | undefined>>, platform: string): string {
	return env.VISUAL || env.EDITOR || (platform === "win32" ? "notepad" : "nano");
}

export const HINT_MS = 5000;
const HINT_MARGIN = 2;

export type Hint = { since: number | null; dismissed: boolean };

export const NO_HINT: Hint = { since: null, dismissed: false };

export function stepHint(hint: Hint, multiline: boolean, now: number): Hint {
	if (!multiline) return NO_HINT;
	return hint.since === null ? { since: now, dismissed: false } : hint;
}

export function hintShowing(hint: Hint, now: number): boolean {
	return hint.since !== null && !hint.dismissed && now - hint.since < HINT_MS;
}

export function hintRow(editor: string, width: number, muted: Paint): string {
	const text = `ctrl+g to edit in ${editorName(editor)}`;
	return " ".repeat(Math.max(0, width - text.length - HINT_MARGIN)) + muted(text);
}

type Margin = { render: (width: number) => string[]; hinted?: boolean };

function viewportMargin(): Margin | undefined {
	const root = (globalThis as { __claudeViewport?: { root: { entries: { component: { entries?: { component: Margin }[] } }[] } } }).__claudeViewport?.root;
	return root?.entries[1]?.component.entries?.[0]?.component;
}

export const QUEUED_PLACEHOLDER = "Press up to edit queued messages";

type Queued = { count: number; restore: () => number };

const queued = () => (globalThis as { __claudeQueued?: Queued }).__claudeQueued;

export function pullsQueued(count: number, text: string): boolean {
	return count > 0 && !text.startsWith("/");
}

export const CLAUDE_ARGUMENT_HINTS: Readonly<Record<string, string>> = {
	clear: "[name]",
	compact: "<optional custom summarization instructions>",
	effort: "[low|medium|high|xhigh|max|auto]",
	export: "[filename]",
	fork: "[prompt]",
	model: "[model]",
	name: "[name]",
	new: "[name]",
	plan: "[open|<description>]",
	resume: "[conversation id or search term]",
};

export function argumentHint(text: string, hints: Readonly<Record<string, string>> = CLAUDE_ARGUMENT_HINTS): string | undefined {
	const match = /^\/([^\s]+) $/.exec(text);
	return match && Object.hasOwn(hints, match[1]) ? hints[match[1]] : undefined;
}

export function withArgumentHint(lines: string[], text: string, muted: Paint, hints: Readonly<Record<string, string>> = CLAUDE_ARGUMENT_HINTS): string[] {
	const hint = argumentHint(text, hints);
	const topRuleIndex = lines.findIndex(isRule);
	if (hint === undefined || topRuleIndex === -1 || topRuleIndex + 1 >= lines.length) return lines;
	const row = lines[topRuleIndex + 1];
	const width = row.replace(VISIBLE_ESCAPES, "").length;
	const start = text.length + 1;
	const room = width - start;
	if (room <= 0) return lines;
	const shown = hint.length <= room ? hint : `${hint.slice(0, Math.max(0, room - 1))}…`;
	const filled = row.slice(0, rawIndexAfter(row, start)) + muted(shown) + " ".repeat(room - shown.length);
	return lines.map((line, i) => (i === topRuleIndex + 1 ? filled : line));
}

export function promptLines(lines: string[], paint: Paint, promptMark: string = PROMPT, command: CommandColour = NO_COMMANDS, emptyMenu: string[] = []): string[] {
	const topRuleIndex = lines.findIndex(isRule);
	if (topRuleIndex === -1) return lines;
	const bottomRuleIndex = lines.findIndex((line, i) => i > topRuleIndex && isRule(line));
	if (bottomRuleIndex === -1) return lines;
	const listed = lines.slice(bottomRuleIndex + 1);
	const menu = listed.length === 0 ? emptyMenu : listed;
	const box: string[] = [];
	lines.slice(0, bottomRuleIndex + 1).forEach((line, i) => {
		if (i === topRuleIndex || i === bottomRuleIndex) {
			box.push(line + paint("─".repeat(PROMPT.length)));
			return;
		}
		const first = box.length === 1;
		box.push((first ? promptMark : " ".repeat(PROMPT.length)) + (first ? colourCommand(line, command) : line));
	});
	return [...menu, ...box];
}

export type AgentView = { label: string; name: string; color: string };

export function agentViewPlaceholder(name: string): string {
	return `Message @${name.length > 20 ? `${name.slice(0, 19)}…` : name}…`;
}

function hexPaint(hex: string, background = false): Paint {
	const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
	return background ? (text) => `\x1b[38;2;0;0;0m\x1b[48;2;${r};${g};${b}m${text}\x1b[49m\x1b[39m` : (text) => `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

export function agentViewRules(lines: string[], view: AgentView): string[] {
	const rule = hexPaint(view.color);
	const badge = hexPaint(view.color, true);
	let first = true;
	return lines.map((line) => {
		if (!isRule(line)) return line;
		const width = line.replace(VISIBLE_ESCAPES, "").length;
		if (!first) return rule("─".repeat(width));
		first = false;
		const label = ` ${view.label} `;
		const lead = width - label.length - 1;
		return lead < 1 ? rule("─".repeat(width)) : rule("─".repeat(lead)) + badge(label) + rule("─");
	});
}

function viewedAgent(): AgentView | undefined {
	const registry = (globalThis as Record<symbol, { agentView?: () => AgentView | undefined } | undefined>)[Symbol.for("pi-subagents:manager")];
	return registry?.agentView?.();
}

const prompted = ((globalThis as { __claudeInputPrompted?: { submitted: boolean } }).__claudeInputPrompted ??= { submitted: false });

export default function (pi: ExtensionAPI) {
	let busy = false;
	let hint = NO_HINT;
	let marginRow: (width: number) => string[] | undefined = () => undefined;
	const hintInMargin = (tui: { requestRender: () => void }) => {
		const margin = viewportMargin();
		if (!margin || margin.hinted) return;
		const base = margin.render.bind(margin);
		margin.hinted = true;
		margin.render = (width) => marginRow(width) ?? base(width);
		tui.requestRender();
	};
	pi.on("input", () => {
		prompted.submitted = true;
		return { action: "continue" as const };
	});
	pi.on("agent_start", () => {
		busy = true;
		prompted.submitted = true;
	});
	pi.on("agent_settled", () => {
		busy = false;
	});
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		void import("@earendil-works/pi-tui").then(({ matchesKey }) =>
			ctx.ui.onTerminalInput((data: string) => {
				if (matchesKey(data, "escape") && ctx.ui.getEditorText() && ctx.isIdle()) hint = { ...hint, dismissed: true };
				const pending = queued();
				if (!matchesKey(data, "up") || !pending || !pullsQueued(pending.count, ctx.ui.getEditorText())) return undefined;
				pending.restore();
				return { consume: true };
			}),
		);
		const previous = ctx.ui.getEditorComponent();
		const mutedPrompt = ctx.ui.theme.fg("muted" as never, PROMPT);
		const command: CommandColour = { names: [...BUILTIN_COMMAND_NAMES, ...invocableNames(pi.getCommands())], paint: commandPaint };
		const hasMessages = (ctx.sessionManager?.getEntries() ?? []).some((entry) => entry.type === "message");
		const placeholder = placeholderText(ctx.sessionManager?.getSessionId() ?? "");
		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			const editor = previous ? previous(tui, theme, keybindings) : new CustomEditor(tui, theme, keybindings);
			(globalThis as { __claudeEditor?: unknown }).__claudeEditor = editor;
			const paint: Paint = (text) => theme.borderColor(text);
			const render = editor.render.bind(editor);
			const muted: Paint = (text) => ctx.ui.theme.fg("muted" as never, text);
			marginRow = (width) => {
				const now = Date.now();
				const started = hint.since === null;
				hint = stepHint(hint, editor.getText().includes("\n"), now);
				if (started && hint.since !== null) setTimeout(() => tui.requestRender(), HINT_MS + 50).unref?.();
				return hintShowing(hint, now) ? [hintRow(externalEditorCommand(process.env, process.platform), width, muted)] : undefined;
			};
			hintInMargin(tui);
			const inner = (width: number) => {
				const lines = render(width);
				const text = editor.getText();
				const view = viewedAgent();
				if (view && text === "") return withPlaceholder(lines, agentViewPlaceholder(view.name));
				if (text === "" && (queued()?.count ?? 0) > 0) return withPlaceholder(lines, QUEUED_PLACEHOLDER);
				return text === "" && !prompted.submitted && !hasMessages ? withPlaceholder(lines, placeholder) : withArgumentHint(lines, text, muted);
			};
			editor.render = (width: number) => {
				hintInMargin(tui);
				const rows = promptLines(inner(width - PROMPT.length), paint, busy ? mutedPrompt : PROMPT, command, noMatchRow(editor.getText(), muted, command.names));
				const view = viewedAgent();
				return view ? agentViewRules(rows, view) : rows;
			};
			return editor;
		});
	});
}
