import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { cardLines } from "../claude-help/index.ts";

const BUILTIN_COMMAND_NAMES = [
	"settings", "model", "tree", "thinking", "scoped-models", "export", "import", "share", "copy", "name",
	"session", "changelog", "hotkeys", "fork", "clone", "trust", "login", "logout", "new", "clear", "compact",
	"resume", "reload", "quit",
];

const MAX_SUGGEST_DISTANCE = 2;
const UNKNOWN_COMMAND_ENTRY = "claude-commands-unknown";
const HELP_ENTRY = "claude-commands-help";

type Paint = (role: string, text: string) => string;

function view(render: (width: number) => string[]): Component {
	return { render, invalidate() {} };
}

function paintOf(theme: Theme): Paint {
	return (role, text) => theme.fg(role as never, text);
}

export function levenshtein(a: string, b: string): number {
	const rows = a.length + 1;
	const cols = b.length + 1;
	const d: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
	for (let i = 0; i < rows; i++) d[i][0] = i;
	for (let j = 0; j < cols; j++) d[0][j] = j;
	for (let i = 1; i < rows; i++) {
		for (let j = 1; j < cols; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			d[i][j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
		}
	}
	return d[rows - 1]![cols - 1]!;
}

export function suggestCommand(commandName: string, knownNames: string[]): string | undefined {
	const name = commandName.toLowerCase();
	let best: string | undefined;
	let bestDistance = MAX_SUGGEST_DISTANCE + 1;
	for (const known of [...new Set(knownNames)].sort()) {
		const distance = levenshtein(name, known.toLowerCase());
		if (distance < bestDistance) {
			bestDistance = distance;
			best = known;
		}
	}
	return bestDistance <= MAX_SUGGEST_DISTANCE ? best : undefined;
}

export type SlashSubmitOutcome = { kind: "pass" } | { kind: "unknown"; command: string; suggestion?: string };

export function resolveSlashSubmit(text: string, knownNames: string[]): SlashSubmitOutcome {
	if (!text.startsWith("/")) return { kind: "pass" };
	const rest = text.slice(1);
	const spaceIndex = rest.indexOf(" ");
	const commandName = spaceIndex === -1 ? rest : rest.slice(0, spaceIndex);
	if (commandName === "") return { kind: "pass" };
	const lower = commandName.toLowerCase();
	if (knownNames.some((n) => n.toLowerCase() === lower)) return { kind: "pass" };
	return { kind: "unknown", command: commandName, suggestion: suggestCommand(commandName, knownNames) };
}

export function unknownCommandText(data: { command: string; suggestion?: string }): string {
	return data.suggestion ? `Unknown command: /${data.command}. Did you mean /${data.suggestion}?` : `Unknown command: /${data.command}`;
}

const prompted = ((globalThis as { __claudeInputPrompted?: { submitted: boolean } }).__claudeInputPrompted ??= { submitted: false });

export default function (pi: ExtensionAPI) {
	pi.registerEntryRenderer(UNKNOWN_COMMAND_ENTRY, (entry, _options, theme) => {
		const paint = paintOf(theme);
		const data = entry.data as { command: string; suggestion?: string };
		return view(() => [paint("warning", `● ${unknownCommandText(data)}`)]);
	});

	pi.registerEntryRenderer(HELP_ENTRY, (_entry, _options, theme) => {
		const paint = paintOf(theme);
		return view(() => cardLines((role, text) => paint(role, text)));
	});

	pi.registerCommand("help", {
		description: "Show pi's shortcut card",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;
			pi.appendEntry(HELP_ENTRY, {});
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		const { matchesKey } = await import("@earendil-works/pi-tui");
		ctx.ui.onTerminalInput((data: string) => {
			if (!matchesKey(data, "enter")) return undefined;
			if (!ctx.isIdle()) return undefined;
			const text = ctx.ui.getEditorText();
			if (!text.startsWith("/")) return undefined;
			const known = [...BUILTIN_COMMAND_NAMES, ...pi.getCommands().map((c) => c.name)];
			const outcome = resolveSlashSubmit(text, known);
			if (outcome.kind === "pass") return undefined;
			ctx.ui.setEditorText("");
			prompted.submitted = true;
			pi.appendEntry(UNKNOWN_COMMAND_ENTRY, { command: outcome.command, suggestion: outcome.suggestion });
			return { consume: true };
		});
	});
}

if (process.env.CLAUDE_COMMANDS_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};

	check(levenshtein("model", "model") === 0, "identical strings have distance 0");
	check(levenshtein("modle", "model") <= 2, "'modle' is within 2 edits of 'model' (adjacent transposition)");
	check(levenshtein("resme", "resume") === 1, "'resme' is 1 edit from 'resume' (single deletion)");

	check(suggestCommand("modle", BUILTIN_COMMAND_NAMES) === "model", "'modle' suggests 'model'");
	check(suggestCommand("resme", BUILTIN_COMMAND_NAMES) === "resume", "'resme' suggests 'resume'");
	check(suggestCommand("totallynotacommand123", BUILTIN_COMMAND_NAMES) === undefined, "a garbage command has no suggestion");

	const pass = resolveSlashSubmit("/model gpt-4", BUILTIN_COMMAND_NAMES);
	check(pass.kind === "pass", "an exact command name (with arguments) passes through");

	const unknown = resolveSlashSubmit("/totallynotacommand123", BUILTIN_COMMAND_NAMES);
	check(unknown.kind === "unknown" && unknown.command === "totallynotacommand123" && unknown.suggestion === undefined, "a garbage command is unknown with no suggestion");

	const typo = resolveSlashSubmit("/modle", BUILTIN_COMMAND_NAMES);
	check(typo.kind === "unknown" && typo.kind === "unknown" && typo.command === "modle" && typo.suggestion === "model", "a close typo is unknown with a suggestion");

	check(resolveSlashSubmit("not a command", BUILTIN_COMMAND_NAMES).kind === "pass", "plain text (no leading slash) passes through untouched");
	check(resolveSlashSubmit("/", BUILTIN_COMMAND_NAMES).kind === "pass", "a bare slash passes through untouched");

	check(unknownCommandText({ command: "totallynotacommand123" }) === "Unknown command: /totallynotacommand123", "no-suggestion wording matches Claude's");
	check(unknownCommandText({ command: "modle", suggestion: "model" }) === "Unknown command: /modle. Did you mean /model?", "with-suggestion wording matches Claude's");

	console.log("\nAll claude-commands checks passed.");
}
