import type { ExtensionAPI, ExtensionCommandContext, SourceInfo } from "@earendil-works/pi-coding-agent";
import { SettingsManager, formatSkillsForPrompt } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { hex } from "./colors.ts";

export const ENTRY_TYPE = "claude-panels-context";
const GRID_ROWS = 10;
const GRID_COLS = 10;
const GRID_CELLS = GRID_ROWS * GRID_COLS;
const FULL_GLYPH = "⛁";
const SLIVER_GLYPH = "⛀";
const FREE_GLYPH = "⛶";
const AUTOCOMPACT_GLYPH = "⛝";
const FREE_COLOR = "999999";
const AUTOCOMPACT_COLOR = "999999";

export type CategoryKey = "systemPrompt" | "tools" | "mcpTools" | "memoryFiles" | "skills" | "messages";

export const CATEGORY_ORDER: CategoryKey[] = ["systemPrompt", "tools", "mcpTools", "memoryFiles", "skills", "messages"];

export const CATEGORY_LABEL: Record<CategoryKey, string> = {
	systemPrompt: "System prompt",
	tools: "Tools",
	mcpTools: "MCP tools",
	memoryFiles: "Memory files",
	skills: "Skills",
	messages: "Messages",
};

export const CATEGORY_COLOR: Record<CategoryKey, string> = {
	systemPrompt: "888888",
	tools: "999999",
	mcpTools: "66cccc",
	memoryFiles: "ff9933",
	skills: "ffcc00",
	messages: "b266ff",
};

export function fmtK(tokens: number): string {
	if (tokens < 1000) return String(Math.round(tokens));
	const rounded = Math.round((tokens / 1000) * 10) / 10;
	return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}k`;
}

export function fmtPercent1(percent: number): string {
	return `${percent.toFixed(1)}%`;
}

export function fmtPercentRound(percent: number): string {
	return `${Math.round(percent)}%`;
}

export function distributeUsedTokens(usedTokens: number, weights: Record<CategoryKey, number>): Record<CategoryKey, number> {
	const weighted = CATEGORY_ORDER.filter((key) => key !== "messages");
	const totalWeight = weighted.reduce((sum, key) => sum + weights[key], 0);
	const result = {} as Record<CategoryKey, number>;
	if (totalWeight <= 0 || usedTokens <= 0) {
		for (const key of weighted) result[key] = 0;
		result.messages = Math.max(0, usedTokens);
		return result;
	}
	const exact: Record<string, number> = {};
	let assigned = 0;
	for (const key of weighted) {
		const share = (weights[key] / totalWeight) * usedTokens;
		exact[key] = share;
		result[key] = Math.floor(share);
		assigned += result[key];
	}
	let remainder = usedTokens - assigned;
	const byRemainder = [...weighted].sort((a, b) => (exact[b]! % 1) - (exact[a]! % 1));
	for (const key of byRemainder) {
		if (remainder <= 0) break;
		result[key] += 1;
		remainder -= 1;
	}
	result.messages = Math.max(0, usedTokens - weighted.reduce((sum, key) => sum + result[key], 0));
	return result;
}

export function cellsForCategory(tokens: number, tokensPerCell: number): { count: number; sliver: boolean } {
	if (tokens <= 0 || tokensPerCell <= 0) return { count: 0, sliver: false };
	const exact = tokens / tokensPerCell;
	if (exact < 1) return { count: 1, sliver: true };
	return { count: Math.max(1, Math.round(exact)), sliver: false };
}

export interface GridCell {
	glyph: string;
	color: string;
}

export function buildGridCells(
	categories: Array<{ key: CategoryKey; tokens: number }>,
	autocompactTokens: number,
	contextWindow: number,
	totalCells: number = GRID_CELLS,
): GridCell[] {
	const tokensPerCell = contextWindow / totalCells;
	const cells: GridCell[] = [];
	for (const category of categories) {
		const { count, sliver } = cellsForCategory(category.tokens, tokensPerCell);
		for (let i = 0; i < count; i++) cells.push({ glyph: sliver ? SLIVER_GLYPH : FULL_GLYPH, color: CATEGORY_COLOR[category.key] });
	}
	const usedCount = Math.min(cells.length, totalCells);
	const autocompactCount = autocompactTokens > 0 ? Math.max(1, Math.round((autocompactTokens / contextWindow) * totalCells)) : 0;
	const freeCount = Math.max(0, totalCells - usedCount - autocompactCount);
	for (let i = 0; i < freeCount; i++) cells.push({ glyph: FREE_GLYPH, color: FREE_COLOR });
	for (let i = 0; i < autocompactCount; i++) cells.push({ glyph: AUTOCOMPACT_GLYPH, color: AUTOCOMPACT_COLOR });
	return cells.slice(0, totalCells);
}

export function gridRows(cells: GridCell[], cols: number, paint: (color: string, text: string) => string): string[] {
	const rows: string[] = [];
	for (let start = 0; start < cells.length; start += cols) {
		rows.push(cells.slice(start, start + cols).map((cell) => paint(cell.color, cell.glyph)).join(" "));
	}
	return rows;
}

export function categoryLegendLine(
	label: string,
	color: string,
	tokens: number,
	percent: number,
	paint: (color: string, text: string) => string,
	unit: "tokens" | "" = "tokens",
): string {
	const amount = unit === "tokens" ? `${fmtK(tokens)} tokens` : fmtK(tokens);
	return `${paint(color, FULL_GLYPH)} ${label}: ${amount} (${fmtPercent1(percent)})`;
}

export interface ContextPanelData {
	modelLabel: string;
	usedTokens: number;
	contextWindow: number;
	categories: Record<CategoryKey, number>;
	freeTokens: number;
	autocompactTokens: number;
	mcpToolCount: number;
	skillCount: number;
}

export function contextPanelLines(data: ContextPanelData, paint: (color: string, text: string) => string, bold: (text: string) => string): { grid: string[]; right: string[] } {
	const categories = CATEGORY_ORDER.map((key) => ({ key, tokens: data.categories[key] }));
	const cells = buildGridCells(categories, data.autocompactTokens, data.contextWindow);
	const grid = gridRows(cells, GRID_COLS, paint);

	const percentOf = (tokens: number) => (data.contextWindow > 0 ? (tokens / data.contextWindow) * 100 : 0);
	const usedPercent = percentOf(data.usedTokens);
	const right: string[] = [
		bold(data.modelLabel),
		`${fmtK(data.usedTokens)}/${fmtK(data.contextWindow)} tokens (${fmtPercentRound(usedPercent)})`,
		"",
		paint("999999", "Estimated usage by category"),
		...CATEGORY_ORDER.map((key) => categoryLegendLine(CATEGORY_LABEL[key], CATEGORY_COLOR[key], data.categories[key], percentOf(data.categories[key]), paint)),
		categoryLegendLine("Free space", FREE_COLOR, data.freeTokens, percentOf(data.freeTokens), paint, ""),
		categoryLegendLine("Autocompact buffer", AUTOCOMPACT_COLOR, data.autocompactTokens, percentOf(data.autocompactTokens), paint),
	];
	return { grid, right };
}

export function contextEntryRows(data: ContextPanelData, paint: (color: string, text: string) => string, bold: (text: string) => string): string[] {
	const { grid, right } = contextPanelLines(data, paint, bold);
	const rowCount = Math.max(grid.length, right.length);
	const rows: string[] = [];
	for (let i = 0; i < rowCount; i++) {
		const left = grid[i];
		const label = right[i] ?? "";
		rows.push(left === undefined ? `${" ".repeat(21)}${label}` : `${left}   ${label}`);
	}
	rows.push("");
	rows.push(bold(`Auto-compact window: ${fmtK(data.contextWindow)} tokens`));
	rows.push("");
	rows.push(bold(`MCP tools ${paint("999999", "· /mcp (loaded on-demand)")}`));
	rows.push(paint("999999", `└ ${data.mcpToolCount} tools · ${fmtK(data.categories.mcpTools)} tokens`));
	rows.push("");
	rows.push(bold(`Skills ${paint("999999", "· /skills")}`));
	rows.push(paint("999999", `└ ${data.skillCount} skills · ${fmtK(data.categories.skills)} tokens`));
	rows.push("");
	rows.push(paint("999999", "/context all to expand"));
	return rows;
}

function isMcpSourceInfo(sourceInfo: SourceInfo | undefined): boolean {
	return sourceInfo !== undefined && sourceInfo.origin === "package" && /mcp/i.test(sourceInfo.source);
}

export function gatherContextData(ctx: ExtensionCommandContext, pi: ExtensionAPI): ContextPanelData | undefined {
	const usage = ctx.getContextUsage();
	if (!usage || usage.tokens === null || !usage.contextWindow) return undefined;

	const settingsManager = SettingsManager.create(ctx.cwd, process.env.PI_CODING_AGENT_DIR);
	const settings = settingsManager.getCompactionSettings();
	const reserveTokens = settings.enabled ? settings.reserveTokens : 0;

	const promptOptions = ctx.getSystemPromptOptions();
	const memoryFilesText = (promptOptions.contextFiles ?? []).map((file) => file.content).join("");
	const skills = promptOptions.skills ?? [];
	const skillsText = skills.length > 0 ? formatSkillsForPrompt(skills) : "";
	const fullPrompt = ctx.getSystemPrompt();
	const systemPromptBytes = Math.max(0, fullPrompt.length - memoryFilesText.length - skillsText.length);

	let mcpToolBytes = 0;
	let systemToolBytes = 0;
	let mcpToolCount = 0;
	for (const tool of pi.getAllTools()) {
		const bytes = JSON.stringify({ name: tool.name, description: tool.description, parameters: tool.parameters }).length;
		if (isMcpSourceInfo(tool.sourceInfo)) {
			mcpToolBytes += bytes;
			mcpToolCount++;
		} else {
			systemToolBytes += bytes;
		}
	}

	const weights: Record<CategoryKey, number> = {
		systemPrompt: systemPromptBytes,
		tools: systemToolBytes,
		mcpTools: mcpToolBytes,
		memoryFiles: memoryFilesText.length,
		skills: skillsText.length,
		messages: 0,
	};
	const categories = distributeUsedTokens(usage.tokens, weights);
	const freeTokens = Math.max(0, usage.contextWindow - reserveTokens - usage.tokens);

	return {
		modelLabel: ctx.model?.name ?? ctx.model?.id ?? "model",
		usedTokens: usage.tokens,
		contextWindow: usage.contextWindow,
		categories,
		freeTokens,
		autocompactTokens: reserveTokens,
		mcpToolCount,
		skillCount: skills.length,
	};
}

function view(render: (width: number) => string[]): Component {
	return { render, invalidate() {} };
}

export function registerContextPanel(pi: ExtensionAPI): void {
	pi.registerEntryRenderer<ContextPanelData>(ENTRY_TYPE, (entry, _options, theme) => {
		const paint = (color: string, text: string) => hex(color, text);
		const bold = (text: string) => theme.bold(text);
		return view(() => contextEntryRows(entry.data, paint, bold));
	});

	pi.registerCommand("context", {
		description: "Visualize current context usage as a colored grid",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;
			const data = gatherContextData(ctx, pi);
			if (!data) {
				ctx.ui.notify("Context usage isn't available yet", "info");
				return;
			}
			pi.appendEntry(ENTRY_TYPE, data);
		},
	});
}

if (process.env.CLAUDE_PANELS_CONTEXT_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain = (_color: string, text: string) => text;

	check(fmtK(8) === "8", "sub-1000 counts print raw, like Claude's Messages: 8 tokens");
	check(fmtK(496) === "496", "496 stays raw, like Claude's MCP tools count");
	check(fmtK(2000) === "2k", "a round thousand drops the decimal, like Claude's Skills: 2k tokens");
	check(fmtK(7500) === "7.5k", "Claude's exact System prompt reading, 7500 tokens");
	check(fmtK(24300) === "24.3k", "Claude's exact System tools reading");
	check(fmtK(33000) === "33k", "Claude's exact Autocompact buffer reading, no trailing .0");
	check(fmtK(129500) === "129.5k", "Claude's exact Free space reading");
	check(fmtPercent1(3.7) === "3.7%" && fmtPercent1(0) === "0.0%", "one decimal place, like Claude's category percentages");
	check(fmtPercentRound(18.75) === "19%", "the headline percent rounds to a whole number, like Claude's 19%");

	const claudeWeights: Record<CategoryKey, number> = { systemPrompt: 7500, tools: 24300, mcpTools: 496, memoryFiles: 2200, skills: 2000, messages: 0 };
	const distributed = distributeUsedTokens(36496, claudeWeights);
	check(distributed.systemPrompt === 7500 && distributed.tools === 24300 && distributed.mcpTools === 496 && distributed.memoryFiles === 2200 && distributed.skills === 2000, "exact category weights pass through unchanged when they already sum to the used total");
	check(distributed.messages === 0, "nothing left over for Messages once the named categories account for the whole used total");
	const scaled = distributeUsedTokens(36504, claudeWeights);
	const scaledSum = CATEGORY_ORDER.reduce((sum, key) => sum + scaled[key], 0);
	check(scaledSum === 36504, "a used-token total that doesn't match the raw byte weights still gets split so every category (plus Messages) sums back to it exactly");
	const empty = distributeUsedTokens(500, { systemPrompt: 0, tools: 0, mcpTools: 0, memoryFiles: 0, skills: 0, messages: 0 });
	check(empty.messages === 500 && empty.systemPrompt === 0, "no prompt pieces at all (a bare session) puts every used token in Messages instead of dividing by zero");

	const tokensPerCell = 200_000 / 100;
	check(cellsForCategory(7500, tokensPerCell).count === 4 && !cellsForCategory(7500, tokensPerCell).sliver, "Claude's System prompt (7.5k/200k, 100 cells) filled exactly 4 grey cells");
	check(cellsForCategory(24300, tokensPerCell).count === 12, "Claude's System tools filled exactly 12 cells");
	const mcpCell = cellsForCategory(496, tokensPerCell);
	check(mcpCell.count === 1 && mcpCell.sliver, "Claude drew a single half-glyph sliver for MCP tools' 0.25-cell share, not zero cells");
	check(cellsForCategory(2200, tokensPerCell).count === 1 && !cellsForCategory(2200, tokensPerCell).sliver, "Memory files' 1.1-cell share rounds to one full cell");
	check(cellsForCategory(0, tokensPerCell).count === 0, "a category with no tokens draws no cell at all");

	const categories: Array<{ key: CategoryKey; tokens: number }> = [
		{ key: "systemPrompt", tokens: 7500 },
		{ key: "tools", tokens: 24300 },
		{ key: "mcpTools", tokens: 496 },
		{ key: "memoryFiles", tokens: 2200 },
		{ key: "skills", tokens: 2000 },
		{ key: "messages", tokens: 8 },
	];
	const cells = buildGridCells(categories, 33_000, 200_000);
	check(cells.length === 100, "the grid is always a fixed 10x10=100 cells, like Claude's");
	check(cells.slice(0, 4).every((c) => c.color === "888888" && c.glyph === "⛁"), "the first 4 cells are System prompt's grey");
	check(cells[19]!.color === "b266ff" && cells[19]!.glyph === "⛀", "Messages' single token still earns a visible purple sliver, the 20th cell after 4+12+1+1+1 System prompt/Tools/MCP tools/Memory files/Skills cells");
	const tailAutocompact = cells.slice(-17);
	check(tailAutocompact.every((c) => c.glyph === "⛝"), "the last 17 cells are the autocompact buffer (round(16.5%) of 100 cells)");
	check(cells[cells.length - 18]!.glyph === "⛶", "free space sits between the used cells and the autocompact tail");

	const rows = gridRows(cells, 10, plain);
	check(rows.length === 10 && rows[0]!.split(" ").length === 10, "10 rows of 10 space-separated glyphs, like Claude's grid");

	check(categoryLegendLine("System prompt", "888888", 7500, 3.75, plain) === "⛁ System prompt: 7.5k tokens (3.8%)", "legend line matches Claude's wording (rounding differs slightly from Claude's own 3.7% because pi derives the percent from its own token split)");
	check(categoryLegendLine("Free space", "999999", 129_500, 64.75, plain, "") === "⛁ Free space: 129.5k (64.8%)", "Free space drops the word tokens, like Claude's own row");

	const data: ContextPanelData = {
		modelLabel: "Haiku 4.5",
		usedTokens: 37_500,
		contextWindow: 200_000,
		categories: { systemPrompt: 7500, tools: 24300, mcpTools: 496, memoryFiles: 2200, skills: 2000, messages: 8 },
		freeTokens: 129_500,
		autocompactTokens: 33_000,
		mcpToolCount: 219,
		skillCount: 39,
	};
	const bold = (text: string) => `[${text}]`;
	const { grid, right } = contextPanelLines(data, plain, bold);
	check(grid.length === 10, "one grid row per 10 cells, matching Claude's 10-row panel");
	check(right[0] === "[Haiku 4.5]", "the model name heads the right column, bolded like Claude's");
	check(right[1] === "37.5k/200k tokens (19%)", "the headline usage line matches Claude's exact reading");
	check(right.length === 12, "6 categories plus Free space and Autocompact buffer, plus the model line, the totals line and a blank = 12 lines");

	const entryRows = contextEntryRows(data, plain, bold);
	check(entryRows.some((row) => row.includes("Auto-compact window: 200k tokens")), "the footer names the auto-compact window size, like Claude's");
	check(entryRows.some((row) => row.includes("219 tools")), "the MCP tools summary line carries the real tool count");
	check(entryRows[entryRows.length - 1] === "/context all to expand", "the panel ends with Claude's own expand hint");

	console.log("\nAll claude-panels context checks passed.");
}
