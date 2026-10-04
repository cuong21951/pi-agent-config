import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { generateDiffString } from "@earendil-works/pi-coding-agent";
import type { Component, KeybindingsManager, TUI, Theme } from "@earendil-works/pi-tui";
import { matchesKey } from "@earendil-works/pi-tui";
import { hex } from "./colors.ts";
import { TAB_BAR_TABS, openPanel, paneRows, tabBarRow } from "./tabs.ts";

const SESSION_LABEL_WIDTH = 23;
const INDENT = "   ";

export interface UsageLike {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: { total: number };
}

export interface UsageTotals {
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	costUsd: number;
}

export function emptyUsageTotals(): UsageTotals {
	return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 };
}

export function addUsage(totals: UsageTotals, usage: UsageLike): UsageTotals {
	return {
		inputTokens: totals.inputTokens + usage.input,
		outputTokens: totals.outputTokens + usage.output,
		cacheReadTokens: totals.cacheReadTokens + usage.cacheRead,
		cacheWriteTokens: totals.cacheWriteTokens + usage.cacheWrite,
		costUsd: totals.costUsd + usage.cost.total,
	};
}

export interface ModelBreakdownEntry {
	key: string;
	tokens: number;
	cost: number;
}

export interface UsageEntryLike {
	type: string;
	message?: { role: string; provider?: string; responseModel?: string; model?: string; usage?: UsageLike };
	usage?: UsageLike;
}

export function usageCostBreakdown(entries: UsageEntryLike[]): ModelBreakdownEntry[] {
	const totals = new Map<string, { tokens: number; cost: number }>();
	const record = (key: string | undefined, usage: UsageLike | undefined) => {
		if (!key || !usage) return;
		const current = totals.get(key) ?? { tokens: 0, cost: 0 };
		current.tokens += usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
		current.cost += usage.cost.total;
		totals.set(key, current);
	};
	for (const entry of entries) {
		if (entry.type === "message" && entry.message?.role === "assistant") {
			record(`${entry.message.provider}/${entry.message.responseModel ?? entry.message.model}`, entry.message.usage);
		} else if (entry.type === "message" && entry.message?.role === "toolResult" && entry.message.usage) {
			record("Tools/summaries", entry.message.usage);
		} else if ((entry.type === "branch_summary" || entry.type === "compaction") && entry.usage) {
			record("Tools/summaries", entry.usage);
		}
	}
	return [...totals.entries()]
		.map(([key, totalsForKey]) => ({ key, ...totalsForKey }))
		.filter((row) => row.cost > 0 || row.tokens > 0)
		.sort((a, b) => b.cost - a.cost);
}

export function diffLineCounts(diffText: string): { added: number; removed: number } {
	let added = 0;
	let removed = 0;
	for (const line of diffText.split("\n")) {
		if (line.startsWith("+++") || line.startsWith("---")) continue;
		if (line.startsWith("+")) added++;
		else if (line.startsWith("-")) removed++;
	}
	return { added, removed };
}

export function editLineCounts(oldContent: string, newContent: string): { added: number; removed: number } {
	return diffLineCounts(generateDiffString(oldContent, newContent).diff);
}

export function writeLineCounts(content: string): { added: number; removed: number } {
	return { added: content === "" ? 0 : content.split("\n").length, removed: 0 };
}

export interface UsageTracker {
	recordAgentStart(nowMs: number): void;
	recordAgentEnd(nowMs: number): void;
	recordCodeChange(added: number, removed: number): void;
	snapshot(sessionStartMs: number, nowMs: number): { wallMs: number; apiMs: number; linesAdded: number; linesRemoved: number };
}

export function createUsageTracker(): UsageTracker {
	let apiMs = 0;
	let pendingStartMs: number | undefined;
	let linesAdded = 0;
	let linesRemoved = 0;
	return {
		recordAgentStart(nowMs) {
			pendingStartMs = nowMs;
		},
		recordAgentEnd(nowMs) {
			if (pendingStartMs === undefined) return;
			apiMs += Math.max(0, nowMs - pendingStartMs);
			pendingStartMs = undefined;
		},
		recordCodeChange(added, removed) {
			linesAdded += added;
			linesRemoved += removed;
		},
		snapshot(sessionStartMs, nowMs) {
			return { wallMs: Math.max(0, nowMs - sessionStartMs), apiMs, linesAdded, linesRemoved };
		},
	};
}

export function fmtDuration(ms: number): string {
	const totalSeconds = Math.round(ms / 1000);
	if (totalSeconds < 60) return `${totalSeconds}s`;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}m${seconds}s`;
}

export function fmtCost(usd: number): string {
	return `$${usd.toFixed(4)}`;
}

export function sessionBlockRows(
	data: { costUsd: number; apiMs: number; wallMs: number; linesAdded: number; linesRemoved: number; totals: UsageTotals },
	paint: (color: string, text: string) => string,
	bold: (text: string) => string,
): string[] {
	const field = (label: string, value: string) => paint("999999", `${`${label}:`.padEnd(SESSION_LABEL_WIDTH)}${value}`);
	return [
		bold("Session"),
		"",
		field("Total cost", fmtCost(data.costUsd)),
		field("Total duration (API)", fmtDuration(data.apiMs)),
		field("Total duration (wall)", fmtDuration(data.wallMs)),
		field("Total code changes", `${data.linesAdded} lines added, ${data.linesRemoved} lines removed`),
		field("Usage", `${data.totals.inputTokens} input, ${data.totals.outputTokens} output, ${data.totals.cacheReadTokens} cache read, ${data.totals.cacheWriteTokens} cache write`),
	];
}

export interface ProviderBalance {
	provider: string;
	text: string;
}

export function balanceRows(balances: ProviderBalance[], paint: (color: string, text: string) => string, bold: (text: string) => string): string[] {
	if (balances.length === 0) return [bold("Provider balances"), "", paint("999999", "no provider balance sources configured")];
	return [bold("Provider balances"), "", ...balances.map((balance) => paint("999999", balance.text))];
}

export function modelBreakdownRows(entries: ModelBreakdownEntry[], bold: (text: string) => string, paint: (color: string, text: string) => string): string[] {
	if (entries.length === 0) return [];
	return ["", bold("Per-model tokens"), "", ...entries.map((entry) => paint("999999", `${entry.key}: ${entry.tokens} tokens (${fmtCost(entry.cost)})`))];
}

export interface UsagePanelData {
	session: { costUsd: number; apiMs: number; wallMs: number; linesAdded: number; linesRemoved: number; totals: UsageTotals };
	balances: ProviderBalance[];
	modelBreakdown: ModelBreakdownEntry[];
}

export function usagePanelRows(data: UsagePanelData, width: number, paint: (color: string, text: string) => string, bold: (text: string) => string): string[] {
	return [
		paint("99ccff", "▔".repeat(width)),
		`${INDENT}${tabBarRow(TAB_BAR_TABS, "Usage", paint, bold)}`,
		"",
		...sessionBlockRows(data.session, paint, bold).map((row) => `${INDENT}${row}`),
		"",
		...balanceRows(data.balances, paint, bold).map((row) => `${INDENT}${row}`),
		...modelBreakdownRows(data.modelBreakdown, bold, paint).map((row) => (row === "" ? "" : `${INDENT}${row}`)),
		"",
		`${INDENT}${paint("999999", "Esc to cancel")}`,
	];
}

function usageComponent(data: UsagePanelData, theme: Theme, keybindings: KeybindingsManager, done: (result: void) => void, tui: TUI): Component {
	const paint = (color: string, text: string) => hex(color, text);
	const bold = (text: string) => theme.bold(text);
	return {
		render(width: number): string[] {
			return paneRows(usagePanelRows(data, width, paint, bold), tui.terminal.rows - 2);
		},
		invalidate(): void {},
		handleInput(input: string): void {
			if (keybindings.matches(input, "tui.select.cancel") || matchesKey(input, "escape")) done(undefined);
		},
	};
}

async function fetchProviderBalances(getApiKey: (provider: string) => Promise<string | undefined>): Promise<ProviderBalance[]> {
	const fetchers: Record<string, (key: string) => Promise<ProviderBalance>> = {
		deepseek: async (key) => {
			const res = await fetch("https://api.deepseek.com/user/balance", { headers: { Authorization: `Bearer ${key}` } });
			const info = (await res.json()).balance_infos?.[0];
			return { provider: "deepseek", text: `deepseek $${Number(info?.total_balance ?? 0).toFixed(2)}` };
		},
		openrouter: async (key) => {
			const res = await fetch("https://openrouter.ai/api/v1/credits", { headers: { Authorization: `Bearer ${key}` } });
			const info = (await res.json()).data;
			return { provider: "openrouter", text: `openrouter $${(Number(info.total_credits) - Number(info.total_usage)).toFixed(2)}` };
		},
	};
	const balances: ProviderBalance[] = [];
	for (const [provider, fetchBalance] of Object.entries(fetchers)) {
		const key = await getApiKey(provider);
		if (!key) continue;
		try {
			balances.push(await fetchBalance(key));
		} catch {
			balances.push({ provider, text: `${provider} ?` });
		}
	}
	return balances;
}

export function registerUsagePanel(pi: ExtensionAPI, tracker: UsageTracker, getSessionStartMs: () => number): void {
	const handler = async (_args: string, ctx: ExtensionCommandContext) => {
		if (!ctx.hasUI) return;
		const entries = ctx.sessionManager.getEntries() as unknown as UsageEntryLike[];
		const totals = entries.reduce((acc, entry) => {
			const usage = entry.type === "message" && entry.message?.role === "assistant" ? entry.message.usage : entry.type === "message" && entry.message?.role === "toolResult" ? entry.message.usage : (entry.type === "branch_summary" || entry.type === "compaction") ? entry.usage : undefined;
			return usage ? addUsage(acc, usage) : acc;
		}, emptyUsageTotals());
		const { apiMs, wallMs, linesAdded, linesRemoved } = tracker.snapshot(getSessionStartMs(), Date.now());
		const balances = await fetchProviderBalances((provider) => ctx.modelRegistry.getApiKeyForProvider(provider));
		const data: UsagePanelData = {
			session: { costUsd: totals.costUsd, apiMs, wallMs, linesAdded, linesRemoved, totals },
			balances,
			modelBreakdown: usageCostBreakdown(entries),
		};
		await openPanel(pi, ctx, (tui, theme, keybindings, done) => usageComponent(data, theme, keybindings, done, tui));
	};
	pi.registerCommand("usage", { description: "Show session cost, plan usage, and activity stats", handler });
	pi.registerCommand("cost", { description: "Show session cost, plan usage, and activity stats", handler });
	pi.registerCommand("stats", { description: "Show session cost, plan usage, and activity stats", handler });
}

if (process.env.CLAUDE_PANELS_USAGE_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain = (_color: string, text: string) => text;
	const bold = (text: string) => text;

	const usage = (input: number, output: number, cacheRead: number, cacheWrite: number, cost: number): UsageLike => ({ input, output, cacheRead, cacheWrite, cost: { total: cost } });

	let totals = emptyUsageTotals();
	totals = addUsage(totals, usage(3, 41_000, 0, 0, 0.0123));
	totals = addUsage(totals, usage(10, 5, 100, 0, 0.0005));
	check(totals.inputTokens === 13 && totals.outputTokens === 41_005 && totals.cacheReadTokens === 100 && totals.costUsd.toFixed(4) === "0.0128", "usage accumulates across every assistant reply, tokens and cost together");

	const breakdown = usageCostBreakdown([
		{ type: "message", message: { role: "assistant", provider: "github-copilot", model: "claude-haiku-4.5", usage: usage(3, 41_000, 0, 0, 0.01) } },
		{ type: "message", message: { role: "assistant", provider: "github-copilot", model: "claude-haiku-4.5", usage: usage(2, 100, 0, 0, 0.001) } },
		{ type: "message", message: { role: "assistant", provider: "deepseek", responseModel: "deepseek-v4", model: "deepseek-v4", usage: usage(1, 50, 0, 0, 0.02) } },
		{ type: "message", message: { role: "user" } },
		{ type: "message", message: { role: "assistant", provider: "x", model: "y", usage: usage(0, 0, 0, 0, 0) } },
	]);
	check(breakdown.length === 2, "user turns and zero-usage replies drop out of the per-model breakdown, like pi's own getUsageCostBreakdown");
	check(breakdown[0]!.key === "deepseek/deepseek-v4" && breakdown[0]!.cost === 0.02, "sorted by cost descending, most expensive model first");
	check(breakdown[1]!.key === "github-copilot/claude-haiku-4.5" && breakdown[1]!.tokens === 3 + 41_000 + 2 + 100, "same provider/model pair across two replies merges into one row");

	check(diffLineCounts("--- a/f\n+++ b/f\n@@ -1,2 +1,3 @@\n line\n-old\n+new\n+added").added === 2 && diffLineCounts("--- a/f\n+++ b/f\n@@ -1,2 +1,3 @@\n line\n-old\n+new\n+added").removed === 1, "unified diff +/- lines count as added/removed, the --- and +++ file headers excluded");
	check(writeLineCounts("a\nb\nc").added === 3 && writeLineCounts("").added === 0, "a fresh Write counts every line as added, an empty file adds nothing");

	const tracker = createUsageTracker();
	tracker.recordAgentStart(1_000);
	tracker.recordAgentEnd(1_500);
	tracker.recordAgentStart(2_000);
	tracker.recordAgentEnd(2_200);
	tracker.recordCodeChange(5, 2);
	tracker.recordCodeChange(1, 0);
	const snap = tracker.snapshot(500, 3_000);
	check(snap.apiMs === 700, "API duration only counts time actually inside an agent turn (500ms + 200ms across two turns), not the gaps between them");
	check(snap.wallMs === 2_500, "wall duration is the whole session span regardless of how much of it was spent waiting on the model");
	check(snap.linesAdded === 6 && snap.linesRemoved === 2, "code changes accumulate across every edit/write in the session");

	check(fmtDuration(0) === "0s" && fmtDuration(14_000) === "14s", "Claude's exact captured readings for a near-empty session");
	check(fmtDuration(90_000) === "1m30s", "past a minute it switches to the XmYs form");
	check(fmtCost(0) === "$0.0000" && fmtCost(0.012345) === "$0.0123", "four decimal places, matching Claude's $0.0000 reading on an empty session");

	const sessionRows = sessionBlockRows({ costUsd: 0, apiMs: 0, wallMs: 14_000, linesAdded: 0, linesRemoved: 0, totals: emptyUsageTotals() }, plain, bold);
	check(sessionRows.includes(`${"Total cost:".padEnd(23)}$0.0000`), "matches Claude's captured Total cost row exactly, including the 23-column field width");
	check(sessionBlockRows({ costUsd: 0, apiMs: 0, wallMs: 14_000, linesAdded: 0, linesRemoved: 0, totals: emptyUsageTotals() }, (color, text) => `<${color}>${text}`, bold)[2] === `<999999>${"Total cost:".padEnd(23)}$0.0000`, "the whole row, value included, is one grey run (999999) on Claude 2.1.289 m6d-panels rows 7-11; 2.1.283 greyed only the label");
	check(sessionRows.includes(`${"Total duration (wall):".padEnd(23)}14s`), "matches Claude's captured wall-duration row exactly");
	check(sessionRows.includes(`${"Usage:".padEnd(23)}0 input, 0 output, 0 cache read, 0 cache write`), "matches Claude's captured Usage row exactly");

	check(balanceRows([], plain, bold).some((row) => row.includes("no provider balance")), "no configured provider keys shows an honest empty state instead of a blank section");
	check(balanceRows([{ provider: "deepseek", text: "deepseek $11.61" }], plain, bold).includes("deepseek $11.61"), "Claude's plan-limit-bar slot shows pi's own provider balances instead, per Cuong's footer choice");

	check(modelBreakdownRows([], bold, plain).length === 0, "an empty breakdown (single-model session) adds no extra section");
	check(modelBreakdownRows([{ key: "a/b", tokens: 10, cost: 0.01 }], bold, plain).some((row) => row.includes("a/b: 10 tokens ($0.0100)")), "a real breakdown lists each provider/model pair with its own token and cost total");

	const panel: UsagePanelData = {
		session: { costUsd: 0, apiMs: 0, wallMs: 14_000, linesAdded: 0, linesRemoved: 0, totals: emptyUsageTotals() },
		balances: [{ provider: "deepseek", text: "deepseek $11.61" }],
		modelBreakdown: [],
	};
	const rows = usagePanelRows(panel, 80, plain, bold);
	check(rows[0]!.length === 80, "the top rule spans the full panel width");
	check(rows[1]!.startsWith("   ") && rows[1]!.replace(/\x1b\[[0-9;]*m/g, "").trim() === "Settings  Status   Config   Usage   Stats" && rows[2] === "" && rows[3] === "   Session", "the tab row sits directly under the rule, then one blank row, and every row is three columns in (Claude 2.1.289 m6d-panels rows 2-5)");
	check(rows[rows.length - 1]!.trim() === "Esc to cancel", "the panel ends with Claude's dismissal hint");
	check(rows.some((row) => row.trim() === "Session"), "the Session heading is present");

	console.log("\nAll claude-panels usage checks passed.");
}
