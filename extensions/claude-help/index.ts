import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const KEYBINDINGS_ENTRY = "claude-help-keybindings";

type KeyBinding = string | string[];
type KeyEntry = [id: string, description: string, defaultKeys: KeyBinding];

const KEY_GROUPS: { title: string; ids: readonly KeyEntry[] }[] = [
	{
		title: "Navigation",
		ids: [
			["tui.editor.cursorUp", "Move cursor up", "up"], ["tui.editor.cursorDown", "Move cursor down", "down"], ["tui.editor.cursorLeft", "Move cursor left", ["left", "ctrl+b"]],
			["tui.editor.cursorRight", "Move cursor right", ["right", "ctrl+f"]], ["tui.editor.cursorWordLeft", "Move cursor word left", ["alt+left", "ctrl+left", "alt+b"]],
			["tui.editor.cursorWordRight", "Move cursor word right", ["alt+right", "ctrl+right", "alt+f"]], ["tui.editor.cursorLineStart", "Move to line start", ["home", "ctrl+home", "ctrl+a"]],
			["tui.editor.cursorLineEnd", "Move to line end", ["end", "ctrl+end", "ctrl+e"]], ["tui.editor.pageUp", "Page up", ["pageUp", "ctrl+pageUp"]], ["tui.editor.pageDown", "Page down", ["pageDown", "ctrl+pageDown"]],
		],
	},
	{
		title: "Editing",
		ids: [
			["tui.input.submit", "Send message", "enter"], ["tui.input.newLine", "New line", ["shift+enter", "ctrl+j"]], ["tui.editor.deleteWordBackward", "Delete word backwards", ["ctrl+w", "alt+backspace"]],
			["tui.editor.deleteWordForward", "Delete word forwards", ["alt+d", "alt+delete"]], ["tui.editor.deleteToLineStart", "Delete to start of line", "ctrl+u"], ["tui.editor.deleteToLineEnd", "Delete to end of line", "ctrl+k"],
			["tui.editor.yank", "Paste the most-recently-deleted text", "ctrl+y"], ["tui.editor.yankPop", "Cycle through the deleted text after pasting", "alt+y"], ["tui.editor.undo", "Undo", ["ctrl+z", "ctrl+-"]],
		],
	},
	{
		title: "App",
		ids: [
			["app.interrupt", "Cancel autocomplete / abort streaming", "escape"], ["app.clear", "Clear editor (first) / exit (second)", "ctrl+c"], ["app.exit", "Exit (when editor is empty)", "ctrl+d"],
			["app.suspend", "Suspend to background", []], ["app.thinking.cycle", "Cycle thinking level", "shift+tab"], ["app.model.cycleForward", "Cycle to next model", "ctrl+p"],
			["app.model.cycleBackward", "Cycle to previous model", ["alt+p", "shift+ctrl+p"]], ["app.model.select", "Open model selector", "ctrl+l"], ["app.tools.expand", "Toggle tool output expansion", "ctrl+o"],
			["app.thinking.toggle", "Toggle thinking block visibility", "ctrl+t"], ["app.editor.external", "Edit message in external editor", "ctrl+g"], ["app.message.copy", "Copy last assistant message", "ctrl+x"],
			["app.message.followUp", "Queue follow-up message", ["alt+enter", "ctrl+q"]], ["app.message.dequeue", "Restore queued messages", ["alt+q", "alt+up"]],
			["app.clipboard.pasteImage", "Paste image or text from clipboard", ["alt+v", "ctrl+v"]], ["app.session.new", "Start a new session", []], ["app.session.tree", "Open session tree", []],
			["app.session.fork", "Fork current session", []], ["app.session.resume", "Resume a session", []],
		],
	},
];

export function formatKeys(keys: unknown): string {
	const list = Array.isArray(keys) ? keys : keys ? [keys] : [];
	if (list.length === 0) return "(unbound)";
	return list.map((key) => String(key).split("+").map((part) => (part.length === 0 ? part : part[0]!.toUpperCase() + part.slice(1))).join("+")).join(" / ");
}

export function keybindingsLines(userBindings: Record<string, KeyBinding> = {}): string[] {
	const lines: string[] = [];
	for (const group of KEY_GROUPS) {
		lines.push(group.title, ...group.ids.map(([id, description, defaultKeys]) => `  ${formatKeys(Object.hasOwn(userBindings, id) ? userBindings[id] : defaultKeys)}  ${description}`), "");
	}
	while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
	return lines;
}

// ponytail: Claude Code's "?" card, three columns, with pi's real keys in place of Claude's.
export type Features = { btw: boolean; tasks: boolean; keybindings: boolean };

export function card(features: Features): string[][] {
	return [
		["! for shell mode", "double tap esc to clear input", "ctrl + shift + _ to undo"],
		["/ for commands", "shift + tab to auto-accept edits", "alt + v to paste images"],
		["@ for file paths", "ctrl + o for verbose output", "alt + p to switch model"],
		[features.btw ? "/btw for side question" : "/effort for thinking", features.tasks ? "ctrl + t to toggle tasks" : "ctrl + p / ctrl + n for history", "ctrl + s to stash prompt"],
		["", "shift + ⏎ for newline", "ctrl + g to edit in $EDITOR"],
		["", "", features.keybindings ? "/keybindings to customize" : "/hotkeys to customize"],
	];
}
const COLUMNS = [24, 35];

type Paint = (role: string, text: string) => string;

export function cardLines(paint: Paint, features: Features = { btw: false, tasks: false, keybindings: false }): string[] {
	return card(features).map((row) => {
		let line = "  ";
		row.forEach((cell, i) => {
			line += paint("muted", cell);
			if (i < COLUMNS.length) line += " ".repeat(Math.max(1, COLUMNS[i] - cell.length));
		});
		return line.trimEnd();
	});
}

// ponytail: "?" only toggles the card while the prompt is empty, so typing a question mark still works.
export function togglesCard(data: string, editorText: string): boolean {
	return data === "?" && editorText.trim() === "";
}

type FooterFilter = (rows: string[], width: number) => string[] | undefined;

export function footerFilters(): FooterFilter[] {
	return ((globalThis as { __claudeFooterRows?: FooterFilter[] }).__claudeFooterRows ??= []);
}

export function readUserKeybindings(agentDir: string): Record<string, KeyBinding> {
	try {
		return JSON.parse(readFileSync(join(agentDir, "keybindings.json"), "utf8"));
	} catch {
		return {};
	}
}

export default function (pi: ExtensionAPI) {
	let shown = false;
	let card: string[] = [];
	const filter: FooterFilter = (rows) => (shown ? card : rows);
	const filters = footerFilters();
	if (!filters.includes(filter)) filters.push(filter);

	pi.registerEntryRenderer(KEYBINDINGS_ENTRY, (_entry, _options, theme) => {
		const lines = keybindingsLines(readUserKeybindings(getAgentDir()));
		return {
			render: () => [
				theme.bold(theme.fg("accent" as never, "Keyboard Shortcuts")),
				"",
				...lines.map((line) => (line !== "" && line.startsWith(" ") ? theme.fg("muted" as never, line) : theme.bold(line))),
			],
			invalidate() {},
		};
	});

	pi.registerCommand("keybindings", {
		description: "Show all keyboard shortcuts",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;
			pi.appendEntry(KEYBINDINGS_ENTRY, {});
		},
	});

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		shown = false;
		const commands = new Set(pi.getCommands().map((c) => c.name));
		const features: Features = { btw: commands.has("btw"), tasks: pi.getActiveTools().includes("task_create"), keybindings: commands.has("keybindings") };
		card = cardLines((role, text) => ctx.ui.theme.fg(role as never, text), features);
		const repaint = () => ctx.ui.setWidget("claude-help", undefined);
		const show = (on: boolean) => {
			shown = on;
			repaint();
		};
		ctx.ui.onTerminalInput((data: string) => {
			if (togglesCard(data, ctx.ui.getEditorText())) {
				show(!shown);
				return { consume: true };
			}
			if (shown) show(false);
			return undefined;
		});
	});
}

if (process.env.CLAUDE_HELP_SELFTEST) {
	const plain = (_role: string, text: string) => text;
	const claude = [
		"  ! for shell mode        double tap esc to clear input      ctrl + shift + _ to undo",
		"  / for commands          shift + tab to auto-accept edits   alt + v to paste images",
		"  @ for file paths        ctrl + o for verbose output        alt + p to switch model",
		"  /btw for side question  ctrl + t to toggle tasks           ctrl + s to stash prompt",
		"                          shift + ⏎ for newline              ctrl + g to edit in $EDITOR",
		"                                                             /keybindings to customize",
	];
	const full = cardLines(plain, { btw: true, tasks: true, keybindings: true });
	full.forEach((line, i) => {
		if (line !== claude[i]) throw new Error(`FAIL: card row ${i + 1} is Claude 2.1.283's\n  want ${JSON.stringify(claude[i])}\n  got  ${JSON.stringify(line)}`);
	});
	const lines = cardLines(plain);
	if (lines[3] !== "  /effort for thinking    ctrl + p / ctrl + n for history    ctrl + s to stash prompt" || lines[5] !== "                                                             /hotkeys to customize") throw new Error("FAIL: a missing feature keeps pi's own cell");
	lines.filter((_, i) => i !== 3 && i !== 5).forEach((line, i) => {
		if (line !== claude.filter((_, j) => j !== 3 && j !== 5)[i]) throw new Error(`FAIL: shared row ${line}`);
	});
	if (!togglesCard("?", "") || togglesCard("?", "what?") || togglesCard("a", "")) throw new Error("FAIL: toggle rule");
	const filters = footerFilters();
	if (filters !== footerFilters()) throw new Error("FAIL: one shared footer filter list");

	if (formatKeys("ctrl+p") !== "Ctrl+P") throw new Error("FAIL: formatKeys capitalizes a single key");
	if (formatKeys(["alt+left", "ctrl+left"]) !== "Alt+Left / Ctrl+Left") throw new Error("FAIL: formatKeys joins multiple bindings with a slash");
	if (formatKeys(undefined) !== "(unbound)") throw new Error("FAIL: formatKeys shows unbound for a missing binding");
	const kbLines = keybindingsLines();
	if (kbLines[0] !== "Navigation" || !kbLines.includes("  Up  Move cursor up")) throw new Error("FAIL: with no user overrides, keybindingsLines groups by section and shows the default key, same data /hotkeys reads");
	if (!kbLines.includes("  Ctrl+L  Open model selector")) throw new Error("FAIL: keybindingsLines falls back to the default app-level key");
	const overridden = keybindingsLines({ "app.model.select": "alt+p" });
	if (!overridden.includes("  Alt+P  Open model selector") || overridden.includes("  Ctrl+L  Open model selector")) throw new Error("FAIL: a user override in keybindings.json replaces the default, same as /hotkeys reading the effective config");

	console.log(full.join("\n"));
	console.log("ok - claude-help");
}
