import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

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

export default function (pi: ExtensionAPI) {
	let shown = false;
	let card: string[] = [];
	const filter: FooterFilter = (rows) => (shown ? card : rows);
	const filters = footerFilters();
	if (!filters.includes(filter)) filters.push(filter);
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		shown = false;
		const commands = new Set(pi.getCommands().map((c) => c.name));
		const features: Features = { btw: commands.has("btw"), tasks: pi.getActiveTools().includes("todo_write"), keybindings: commands.has("keybindings") };
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
	console.log(full.join("\n"));
	console.log("ok - claude-help");
}
