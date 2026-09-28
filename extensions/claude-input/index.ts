import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

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

const prompted = ((globalThis as { __claudeInputPrompted?: { submitted: boolean } }).__claudeInputPrompted ??= { submitted: false });

export default function (pi: ExtensionAPI) {
	let busy = false;
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
		const previous = ctx.ui.getEditorComponent();
		const mutedPrompt = ctx.ui.theme.fg("muted" as never, PROMPT);
		const command: CommandColour = { names: [...BUILTIN_COMMAND_NAMES, ...pi.getCommands().map((c) => c.name)], paint: commandPaint };
		const hasMessages = (ctx.sessionManager?.getEntries() ?? []).some((entry) => entry.type === "message");
		const placeholder = placeholderText(ctx.sessionManager?.getSessionId() ?? "");
		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			const editor = previous ? previous(tui, theme, keybindings) : new CustomEditor(tui, theme, keybindings);
			const paint: Paint = (text) => theme.borderColor(text);
			const render = editor.render.bind(editor);
			const muted: Paint = (text) => ctx.ui.theme.fg("muted" as never, text);
			const inner = (width: number) => {
				const lines = render(width);
				const text = editor.getText();
				return text === "" && !prompted.submitted && !hasMessages ? withPlaceholder(lines, placeholder) : withArgumentHint(lines, text, muted);
			};
			editor.render = (width: number) => promptLines(inner(width - PROMPT.length), paint, busy ? mutedPrompt : PROMPT, command, noMatchRow(editor.getText(), muted, command.names));
			return editor;
		});
	});
}
