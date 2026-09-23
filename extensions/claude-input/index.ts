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
// borders (its placeholder tip was dropped on request). pi's editor already draws the rules, so the inner editor is rendered
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

export default function (pi: ExtensionAPI) {
	let busy = false;
	pi.on("agent_start", () => {
		busy = true;
	});
	pi.on("agent_settled", () => {
		busy = false;
	});
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		const previous = ctx.ui.getEditorComponent();
		const mutedPrompt = ctx.ui.theme.fg("muted" as never, PROMPT);
		const command: CommandColour = { names: [...BUILTIN_COMMAND_NAMES, ...pi.getCommands().map((c) => c.name)], paint: commandPaint };
		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			const editor = previous ? previous(tui, theme, keybindings) : new CustomEditor(tui, theme, keybindings);
			const paint: Paint = (text) => theme.borderColor(text);
			const render = editor.render.bind(editor);
			const muted: Paint = (text) => ctx.ui.theme.fg("muted" as never, text);
			editor.render = (width: number) => promptLines(render(width - PROMPT.length), paint, busy ? mutedPrompt : PROMPT, command, noMatchRow(editor.getText(), muted, command.names));
			return editor;
		});
	});
}
