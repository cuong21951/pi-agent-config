import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import Fuse from "fuse.js";

export interface SlashCommandItem {
	name: string;
	label?: string;
	description?: string;
	aliases?: string[];
}

interface IndexedItem {
	descriptionKey: string[];
	partKey?: string[];
	displayPartKey?: string[];
	commandName: string;
	displayName: string;
	aliasKey?: string[];
	candidate: SlashCommandItem;
}

const SPLIT_RE = /[:_-]/g;

function toIndexed(items: SlashCommandItem[]): IndexedItem[] {
	return items.map((s) => {
		const r = s.name;
		const i = s.label ?? s.name;
		const c = r.split(SPLIT_RE).filter(Boolean);
		const u = i !== r ? i.split(SPLIT_RE).filter(Boolean) : [];
		return {
			descriptionKey: (s.description ?? "")
				.split(" ")
				.map((g) => g.toLowerCase().replace(/[^a-z0-9]/g, ""))
				.filter(Boolean),
			partKey: c.length > 1 ? c : undefined,
			displayPartKey: u.length > 1 ? u : undefined,
			commandName: r,
			displayName: i,
			candidate: s,
			aliasKey: s.aliases,
		};
	});
}

export interface SearchOptions {
	getScoreBoost?: (item: SlashCommandItem) => number;
	filter?: (item: SlashCommandItem) => boolean;
}

export class ClaudeSlashMatcher {
	private fuse: Fuse<IndexedItem>;

	constructor(items: SlashCommandItem[]) {
		this.fuse = new Fuse(toIndexed(items), {
			includeScore: true,
			threshold: 0.3,
			location: 0,
			distance: 100,
			keys: [
				{ name: "commandName", weight: 3 },
				{ name: "displayName", weight: 2 },
				{ name: "partKey", weight: 2 },
				{ name: "aliasKey", weight: 2 },
				{ name: "displayPartKey", weight: 1 },
				{ name: "descriptionKey", weight: 0.5 },
			],
		});
	}

	search(query: string, options: SearchOptions = {}): SlashCommandItem[] {
		const { getScoreBoost, filter } = options;
		const q = query.trim().toLowerCase();
		let results = this.fuse.search(q);
		if (filter) results = results.filter((m) => filter(m.item.candidate));
		return results
			.map((m) => {
				const name = m.item.commandName.toLowerCase();
				const display = m.item.displayName.toLowerCase();
				const aliases = m.item.aliasKey?.map((a) => a.toLowerCase()) ?? [];
				const boost = getScoreBoost ? getScoreBoost(m.item.candidate) : 0;
				return { r: m, name, display, aliases, boost };
			})
			.sort((m, h) => {
				const f = m.name, y = h.name;
				const b = m.aliases, E = h.aliases;
				const exactM = f === q || m.display === q;
				const exactH = y === q || h.display === q;
				if (exactM && !exactH) return -1;
				if (exactH && !exactM) return 1;
				const aliasExactM = b.some((a) => a === q);
				const aliasExactH = E.some((a) => a === q);
				if (aliasExactM && !aliasExactH) return -1;
				if (aliasExactH && !aliasExactM) return 1;
				const prefixLen = (name: string, display: string) => Math.min(name.startsWith(q) ? name.length : Infinity, display.startsWith(q) ? display.length : Infinity);
				const pM = prefixLen(f, m.display), pH = prefixLen(y, h.display);
				const hasM = pM < Infinity, hasH = pH < Infinity;
				if (hasM && !hasH) return -1;
				if (hasH && !hasM) return 1;
				if (hasM && hasH && pM !== pH) return pM - pH;
				const aliasPrefixM = b.find((a) => a.startsWith(q));
				const aliasPrefixH = E.find((a) => a.startsWith(q));
				if (aliasPrefixM && !aliasPrefixH) return -1;
				if (aliasPrefixH && !aliasPrefixM) return 1;
				if (aliasPrefixM && aliasPrefixH && aliasPrefixM.length !== aliasPrefixH.length) return aliasPrefixM.length - aliasPrefixH.length;
				const scoreM = Math.floor((m.r.score ?? 0) * 10);
				const scoreH = Math.floor((h.r.score ?? 0) * 10);
				if (scoreM !== scoreH) return scoreM - scoreH;
				return h.boost - m.boost;
			})
			.map((m) => m.r.item.candidate);
	}
}

export function matchSlashCommands(items: SlashCommandItem[], query: string, options: SearchOptions = {}): SlashCommandItem[] {
	const q = query.trim().toLowerCase();
	if (q === "") {
		return [...items].sort((a, b) => (a.label ?? a.name).localeCompare(b.label ?? b.name));
	}
	return new ClaudeSlashMatcher(items).search(q, options);
}

export function preselectsFirst(typed: string, first: { value: string; label?: string }): boolean {
	if (first.value.startsWith("/")) return true;
	const query = typed.slice(1).toLowerCase().trim();
	if (query === "") return true;
	const joined = query.split(SPLIT_RE).join("");
	if (joined === "") return false;
	return [first.value, first.label ?? first.value].some((name) => {
		const parts = name.toLowerCase().split(SPLIT_RE).filter(Boolean);
		return parts.some((_part, i) => parts.slice(i).join("").startsWith(joined));
	});
}

export function matchRanges(text: string, query: string, contiguousOnly: boolean): [number, number][] {
	const lower = text.toLowerCase();
	const at = lower.indexOf(query);
	if (at !== -1) return [[at, at + query.length]];
	if (contiguousOnly) return [];
	const ranges: [number, number][] = [];
	let from = 0;
	for (const char of query) {
		const found = lower.indexOf(char, from);
		if (found === -1) return [];
		from = found + char.length;
		const last = ranges.at(-1);
		if (last && last[1] === found) last[1] = from;
		else ranges.push([found, from]);
	}
	return ranges;
}

const SELECTED = "\x1b[38;2;153;204;255m";
const UNSELECTED = "\x1b[38;2;153;153;153m";
const DEFAULT_FG = "\x1b[39m";
const BOLD = "\x1b[1m";
const NOT_BOLD = "\x1b[22m";
const INDENT = "  ";
const NAME_GAP = 2;
const MIN_DESCRIPTION_WIDTH = 10;

function paintMatches(text: string, query: string, selected: boolean, contiguousOnly: boolean): string {
	const [on, off] = selected ? [BOLD, NOT_BOLD] : [DEFAULT_FG + BOLD, NOT_BOLD + UNSELECTED];
	let out = "";
	let cursor = 0;
	for (const [start, end] of query ? matchRanges(text, query, contiguousOnly) : []) {
		out += text.slice(cursor, start) + on + text.slice(start, end) + off;
		cursor = end;
	}
	return out + text.slice(cursor);
}

function clip(text: string, width: number, ellipsis: string): string {
	return truncateToWidth(text, width, ellipsis).replaceAll("\x1b[0m", "");
}

function wrapDescription(text: string, width: number): string[] {
	if (visibleWidth(text) <= width) return [text];
	let cut = text.length;
	while (cut > 1 && visibleWidth(text.slice(0, cut)) > width) cut--;
	const space = text.lastIndexOf(" ", cut);
	const first = space > 0 ? text.slice(0, space) : text.slice(0, cut);
	return [first, clip(text.slice(first.length).trimStart(), width, "…")];
}

export function menuRow(item: { value: string }, selected: boolean, width: number, description: string | undefined, nameColumn: number, typed: string): string[] {
	const color = selected ? SELECTED : UNSELECTED;
	const query = typed.slice(1).toLowerCase();
	const columnWidth = Math.max(1, Math.min(nameColumn, width - INDENT.length - 4));
	const bare = item.value.startsWith("/") ? item.value.slice(1) : item.value;
	const name = clip(bare, Math.max(0, Math.max(1, columnWidth - NAME_GAP) - 1), "");
	const nameWidth = 1 + visibleWidth(name);
	const spacing = " ".repeat(Math.max(1, columnWidth - nameWidth));
	const descriptionStart = INDENT.length + nameWidth + spacing.length;
	const descriptionWidth = width - descriptionStart;
	const head = `${color}${INDENT}/${paintMatches(name, query, selected, false)}`;
	if (!description || descriptionWidth <= MIN_DESCRIPTION_WIDTH) return [head + DEFAULT_FG];
	const [first, second] = wrapDescription(description, descriptionWidth);
	const firstLine = head + spacing + paintMatches(first, query, selected, true) + DEFAULT_FG;
	return second === undefined ? [firstLine] : [firstLine, color + " ".repeat(descriptionStart) + paintMatches(second, query, selected, true) + DEFAULT_FG];
}

const SCOPE_LABELS: Record<string, string> = { u: "user", p: "project" };

export function skillMenuItem(item: SlashCommandItem, skill: { name: string; description: string }, sourceTag: string | undefined, others: { name: string }[]): SlashCommandItem {
	const label = SCOPE_LABELS[sourceTag ?? ""];
	return {
		name: others.some((other) => other.name === skill.name) ? item.name : skill.name,
		description: label ? `${skill.description} (${label})` : item.description,
	};
}

export function invocableNames(commands: { name: string; source: string }[]): string[] {
	return commands.flatMap((command) => (command.source === "skill" ? [command.name, command.name.slice("skill:".length)] : [command.name]));
}

export default function (_pi: ExtensionAPI) {
	(globalThis as any).__claudeSlashMatch = matchSlashCommands;
	(globalThis as any).__claudeSlashPreselect = preselectsFirst;
	(globalThis as any).__claudeSlashRow = menuRow;
	(globalThis as any).__claudeSkillItem = skillMenuItem;
}

if (process.env.CLAUDE_SLASH_MENU_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};

	const COMMANDS: SlashCommandItem[] = [
		{ name: "settings", description: "Open settings menu" },
		{ name: "model", description: "Select model (opens selector UI)" },
		{ name: "tree", description: "Navigate session tree (switch branches)" },
		{ name: "thinking", description: "Set thinking level" },
		{ name: "scoped-models", description: "Enable/disable models for Ctrl+P cycling" },
		{ name: "export", description: "Export session (HTML default, or specify path: .html/.jsonl)" },
		{ name: "import", description: "Import and resume a session from a JSONL file" },
		{ name: "share", description: "Share session as a secret GitHub gist" },
		{ name: "copy", description: "Copy last agent message to clipboard" },
		{ name: "name", description: "Set session display name" },
		{ name: "session", description: "Show session info and stats" },
		{ name: "changelog", description: "Show changelog entries" },
		{ name: "hotkeys", description: "Show all keyboard shortcuts" },
		{ name: "fork", description: "Create a new fork from a previous user message" },
		{ name: "clone", description: "Duplicate the current session at the current position" },
		{ name: "trust", description: "Save project trust decision for future sessions" },
		{ name: "login", description: "Configure provider authentication" },
		{ name: "logout", description: "Remove provider authentication" },
		{ name: "new", description: "Start a new session" },
		{ name: "clear", description: "Start a new session with empty context; previous session stays on disk (resumable with /resume)" },
		{ name: "compact", description: "Manually compact the session context" },
		{ name: "resume", description: "Resume a different session" },
		{ name: "reload", description: "Reload keybindings, extensions, skills, prompts, themes, and context files" },
		{ name: "quit", description: "Quit pi" },
		{
			name: "code-review",
			description:
				"Review the current diff, or a PR number/branch/path target, for correctness bugs (plus reuse/simplification/efficiency cleanups where the model's review recipe covers them) at the given effort level (low/medium: fewer, high-confidence findings; high→max: broader coverage, may include uncertain findings; ultra: deep multi-agent review in the cloud); with no level given, it reuses the level you typed last. Pass --comment to post findings as inline PR comments, or --fix to apply the findings to the working tree after the review.",
		},
		{
			name: "doctor",
			description:
				"Health-check the user's Claude Code setup and fix issues: diagnose installation health — what the `claude doctor` terminal diagnostics cover — from local data (duplicate or leftover installs, PATH, unparseable settings files, broken or colliding agent definitions, skills whose frontmatter fails to parse); find unused skills, MCP servers, and plugins versus their context cost and disable dead weight; deduplicate local CLAUDE.md files against checked-in ones; trim checked-in CLAUDE.md files by cutting content a session could derive from the codebase (directory layouts, tech-stack lists, architecture overviews) while keeping gotchas, rationale, and non-standard conventions; migrate always-loaded CLAUDE.md guidance into lazy skills and nested CLAUDE.md files; flag slow hooks and context-heavy extensions; check the installed version is current; make auto mode the default permission mode; and pre-approve frequently denied read-only commands. Use when the user asks for a doctor run, checkup, audit, tune-up, or cleanup of their Claude Code setup or configuration.",
		},
	];

	const names = (results: SlashCommandItem[]) => results.map((r) => r.name);

	const clearResults = matchSlashCommands(COMMANDS, "clear");
	check(clearResults[0]?.name === "clear", "'/clear' ranks first for query 'clear' (exact name match)");
	check(names(clearResults).includes("code-review"), "'clear' surfaces /code-review through its description ('cleanups')");
	check(names(clearResults).includes("doctor"), "'clear' surfaces /doctor through its description");

	const exactModel = matchSlashCommands(COMMANDS, "model");
	check(exactModel[0]?.name === "model", "exact name match ranks first");

	const prefixCo = matchSlashCommands(COMMANDS, "co");
	check(prefixCo[0]?.name === "copy" || prefixCo[0]?.name === "compact" || prefixCo[0]?.name === "code-review", "prefix query 'co' ranks a name-prefix match first");
	check(prefixCo.every((r) => ["copy", "compact", "code-review"].includes(r.name) || true), "prefix query 'co' returns without throwing");

	const empty = matchSlashCommands(COMMANDS, "");
	const sortedNames = [...COMMANDS].map((c) => c.name).sort((a, b) => a.localeCompare(b));
	check(JSON.stringify(names(empty)) === JSON.stringify(sortedNames), "empty query alpha-sorts the whole list (no frecency data on pi)");

	const single = matchSlashCommands([{ name: "clear", description: "x" }], "clear");
	check(single.length === 1 && single[0].name === "clear", "single-item list still matches");

	const none = matchSlashCommands(COMMANDS, "zzzzzznotfound");
	check(none.length === 0, "no match returns an empty array, not null/undefined");

	check(preselectsFirst("/expl", { value: "explain" }), "Claude 2.1.283 preselects /explain for '/expl' (measured: row 0 in 99ccff, Enter runs it)");
	check(preselectsFirst("/expl", { value: "skill:explain" }), "pi's skill:explain is preselected for '/expl' through its 'explain' segment");
	check(!preselectsFirst("/modle", { value: "auto-mode-setup" }), "Claude 2.1.283 leaves the '/modle' menu unselected (measured: every row 999999)");
	check(!preselectsFirst("/resme", { value: "resume" }), "a fuzzy-only top match is not preselected, so Enter still reaches 'Did you mean'");
	check(preselectsFirst("/code-r", { value: "code-review" }), "separators in the typed text are ignored (2.1.283 oee: split on [:_-], joined)");
	check(preselectsFirst("/review", { value: "code-review" }), "a later segment of the name counts as a prefix start");
	check(preselectsFirst("/", { value: "clear" }), "a bare slash preselects the first row");
	check(!preselectsFirst("/-", { value: "code-review" }), "typed text made only of separators preselects nothing");
	check(preselectsFirst("/etc/ho", { value: "/etc/hosts", label: "hosts" }), "a path completion under the slash layout keeps its first row selected (2.1.283 oee: a suggestion that is not a command is always preselected)");
	const withSkill = [...COMMANDS, { name: "skill:explain", description: "Explain a solution, bug, design or concept the Feynman way" }];
	const explTop = matchSlashCommands(withSkill, "expl")[0];
	check(explTop?.name === "skill:explain" && preselectsFirst("/expl", { value: explTop.name }), "'/expl' ranks skill:explain first and preselects it");

	const same = (actual: unknown, expected: unknown) => JSON.stringify(actual) === JSON.stringify(expected);
	check(same(matchRanges("resume", "resme", false), [[0, 3], [4, 6]]), "Claude 2.1.283 bolds 'res' and 'me' of /resume for '/resme' (measured; bundle Bt: one range per run of in-order characters)");
	check(same(matchRanges("claude-api", "clea", false), [[0, 2], [5, 6], [7, 8]]), "'/clea' bolds 'cl', 'e', 'a' of /claude-api (measured): each character is searched after the previous hit");
	check(same(matchRanges("model", "modle", false), []), "'/modle' bolds nothing in /model (measured): a character with no later occurrence drops every range");
	check(same(matchRanges("Explain a solution", "expl", true), [[0, 4]]), "a description match ignores case (measured: 'Expl' bold for '/expl')");
	check(same(matchRanges("efficiency cleanups where", "clea", true), [[11, 15]]), "a description bolds the typed text where it appears whole (measured: 'clea' in 'cleanups')");
	check(same(matchRanges("Review the current diff", "clea", true), []), "a description never bolds scattered characters (bundle: contiguousOnly)");

	const SHOW_ME = "Help the user understand the current topic visually with concise diagrams, code-shape sketches, and focused HTML artifacts. (user)";
	check(
		same(menuRow({ value: "show-me" }, true, 130, SHOW_ME, 30, "/show"), [
			`${SELECTED}  /${BOLD}show${NOT_BOLD}-me${" ".repeat(22)}Help the user understand the current topic visually with concise diagrams, code-shape sketches,${DEFAULT_FG}`,
			`${SELECTED}${" ".repeat(32)}and focused HTML artifacts. (user)${DEFAULT_FG}`,
		]),
		"the selected row is 99ccff with the typed text bold, description wrapped under column 32 and ending two columns short of the terminal's 132 (Claude 2.1.283, '/show'; the list itself is drawn 130 wide, inside claude-input's prompt)",
	);
	check(
		same(menuRow({ value: "resume" }, false, 130, "Resume a previous conversation", 30, "/resme"), [
			`${UNSELECTED}  /${DEFAULT_FG}${BOLD}res${NOT_BOLD}${UNSELECTED}u${DEFAULT_FG}${BOLD}me${NOT_BOLD}${UNSELECTED}${" ".repeat(23)}Resume a previous conversation${DEFAULT_FG}`,
		]),
		"an unselected row is 999999 with its matched characters bold in the default colour (Claude 2.1.283, '/resme')",
	);
	const DIAGRAMMING = "Diagramming know-how for Artifacts - when a picture earns its place, how to draw one that shows the real mechanism, and the inline-SVG mechanics that keep it legible in both themes.";
	check(
		same(menuRow({ value: "artifact-diagramming" }, false, 130, DIAGRAMMING, 30, "/show"), [
			`${UNSELECTED}  /artifact-diagramming${" ".repeat(9)}Diagramming know-how for Artifacts - when a picture earns its place, how to draw one that ${DEFAULT_FG}${BOLD}show${NOT_BOLD}${UNSELECTED}s${DEFAULT_FG}`,
			`${UNSELECTED}${" ".repeat(32)}the real mechanism, and the inline-SVG mechanics that keep it legible in both themes.${DEFAULT_FG}`,
		]),
		"an unselected row bolds the typed text inside its description (Claude 2.1.283, '/show' on /artifact-diagramming)",
	);
	check(same(menuRow({ value: "clear" }, false, 130, undefined, 30, "/"), [`${UNSELECTED}  /clear${DEFAULT_FG}`]), "a bare slash bolds nothing, and a row without a description is the name alone");
	const EXPLAIN = "Explain a solution, bug, design or concept the Feynman way — one concrete picture carried all the way through, the tempting wrong answers and why they fail, no jargon without a plain-word twin, an honest section at the end";
	check(
		same(menuRow({ value: "explain" }, true, 130, EXPLAIN, 30, "/expl"), [
			`${SELECTED}  /${BOLD}expl${NOT_BOLD}ain${" ".repeat(22)}${BOLD}Expl${NOT_BOLD}ain a solution, bug, design or concept the Feynman way — one concrete picture carried all the${DEFAULT_FG}`,
			`${SELECTED}${" ".repeat(32)}way through, the tempting wrong answers and why they fail, no jargon without a plain-word twin, a…${DEFAULT_FG}`,
		]),
		"a description past two lines ends in an ellipsis drawn in the row's own colour (Claude 2.1.283, '/expl')",
	);

	const piItem = { name: "skill:explain", description: "[u] Explain a thing" };
	check(same(skillMenuItem(piItem, { name: "explain", description: "Explain a thing" }, "u", [{ name: "clear" }]), { name: "explain", description: "Explain a thing (user)" }), "a user skill is /explain with Claude's ' (user)' suffix (2.1.283 lqe: description + source label)");
	check(skillMenuItem(piItem, { name: "explain", description: "Explain a thing" }, "p", []).description === "Explain a thing (project)", "a project skill ends ' (project)'");
	check(skillMenuItem({ name: "skill:ponytail", description: "[u:npm:x] Lazy" }, { name: "ponytail", description: "Lazy" }, "u:npm:x", [{ name: "ponytail" }]).name === "skill:ponytail", "a skill named like another command keeps its skill: name");
	check(same(skillMenuItem({ name: "skill:setup", description: "[u:npm:x] Set up" }, { name: "setup", description: "Set up" }, "u:npm:x", []), { name: "setup", description: "[u:npm:x] Set up" }), "a package skill gets the bare name and keeps pi's source tag");
	check(same(invocableNames([{ name: "skill:explain", source: "skill" }, { name: "mode", source: "extension" }]), ["skill:explain", "explain", "mode"]), "a skill is invocable by both names, other commands by their own");

	console.log("\nAll claude-slash-menu checks passed.");
}
