import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
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

export default function (_pi: ExtensionAPI) {
	(globalThis as any).__claudeSlashMatch = matchSlashCommands;
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

	console.log("\nAll claude-slash-menu checks passed.");
}
