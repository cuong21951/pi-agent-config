import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ANSI = /\x1b\[[0-9;]*m/g;
const SEPARATOR = " · ";
const MODE_STATUS = "modes";
// ponytail: the permission extension badges yolo with a bare word; the mode row already says it.
const VOICE_STATUS = "voice";
const PONYTAIL_STATUS = "ponytail";
const TASKS_HINT_STATUS = "tasks-hint";
const HIDDEN_STATUSES = new Set([MODE_STATUS, VOICE_STATUS, PONYTAIL_STATUS, TASKS_HINT_STATUS, "mcp", "pi-permission-system"]);
const GUTTER = "  ";

function plainWidth(text: string): number {
	return text.replace(ANSI, "").length;
}

export type Paint = (role: string, text: string) => string;

export type FooterFacts = {
	statuses: string[];
	ponytail?: string;
	model: string;
	contextPercent: number | null;
};

const sgr = (code: string, text: string) => `\x1b[${code}m${text}\x1b[0m`;

function contextCode(percent: number): string {
	return percent >= 85 ? "38;5;167" : percent >= 60 ? "38;5;179" : "38;5;108";
}

export function ponytailBadge(status: string | undefined): string | undefined {
	const mode = status?.replace(ANSI, "").match(/ponytail:\s*\S*\s*([a-z]+)\s*$/i)?.[1]?.toUpperCase();
	if (!mode) return undefined;
	return mode === "FULL" ? "[PONYTAIL]" : `[PONYTAIL:${mode}]`;
}

export function displayName(model: string): string {
	return model.replace(/^Claude\s+/, "").replace(/\s*\(latest\)$/, "");
}

export function composeFooter(f: FooterFacts, _paint: Paint, maxWidth?: number): string {
	let parts = f.ponytail ? [sgr("38;5;108", f.ponytail)] : [];
	parts.push(sgr("38;5;110", displayName(f.model)));
	if (f.contextPercent !== null) parts.push(sgr(contextCode(f.contextPercent), `ctx ${Math.round(f.contextPercent)}%`));
	parts.push(...f.statuses);
	if (maxWidth !== undefined) {
		const kept: string[] = [];
		let used = 0;
		for (const part of parts) {
			const width = plainWidth(part) + (kept.length ? SEPARATOR.length : 0);
			if (used + width > maxWidth) break;
			kept.push(part);
			used += width;
		}
		parts = kept;
	}
	return parts.join(sgr("38;5;240", SEPARATOR));
}

export function composeModeRow(mode: string, width: number, voice?: string, tasksHint?: string): string {
	const left = tasksHint ? `${mode}${sgr("38;2;153;153;153", SEPARATOR)}${tasksHint}` : mode;
	if (!voice) return left;
	const gap = width - plainWidth(left) - plainWidth(voice);
	return gap < 1 ? left : `${left}${" ".repeat(gap)}${voice}`;
}

export function visibleStatuses(statuses: Map<string, string>, _paint: Paint): string[] {
	return [...statuses]
		.filter(([key, text]) => !HIDDEN_STATUSES.has(key) && text.replace(ANSI, "").trim() !== "")
		.map(([, text]) => text.trim());
}

type Usage = { input?: number; cacheRead?: number; cacheWrite?: number };
type Message = { role?: string; usage?: Usage };
type Entry = { type?: string; message?: Message };

function promptTokens(usage: Usage | undefined): number {
	return (usage?.input ?? 0) + (usage?.cacheRead ?? 0) + (usage?.cacheWrite ?? 0);
}

function reportedUsage(message: Message | undefined): Usage | undefined {
	return message?.role === "assistant" && promptTokens(message.usage) > 0 ? message.usage : undefined;
}

export function lastUsage(entries: Entry[]): Usage | undefined {
	for (let i = entries.length - 1; i >= 0; i--) {
		const usage = entries[i].type === "message" ? reportedUsage(entries[i].message) : undefined;
		if (usage) return usage;
	}
	return undefined;
}

export function contextPercent(usage: Usage | undefined, contextWindow: number | undefined): number | null {
	if (!usage || !contextWindow) return null;
	return Math.min(100, Math.max(0, Math.round((promptTokens(usage) / contextWindow) * 100)));
}

type FleetRegistry = { fleetLines?: (width: number, theme: unknown) => string[]; fleetHint?: (theme: unknown) => string | undefined };

export function fleetRegistry(): FleetRegistry | undefined {
	return (globalThis as Record<symbol, unknown>)[Symbol.for("pi-subagents:manager")] as FleetRegistry | undefined;
}

export function footerRows(line: string, modeRow: string | undefined, fleetHint: string | undefined, fleetLines: string[]): string[] {
	const second = fleetHint ?? modeRow;
	return [...(second === undefined ? [line] : [line, second]).map((row) => GUTTER + row), ...fleetLines];
}

export default function (pi: ExtensionAPI) {
	let usage: Usage | undefined;
	let dialogOpen = false;
	pi.on("ui_prompt_start", (event) => {
		if (event.kind === "custom") dialogOpen = true;
	});
	pi.on("ui_prompt_end", (event) => {
		if (event.kind === "custom") dialogOpen = false;
	});
	pi.on("message_end", (event) => {
		usage = reportedUsage(event.message as Message) ?? usage;
	});
	pi.on("session_start", (_event, ctx) => {
		usage = lastUsage(ctx.sessionManager.getBranch() as Entry[]);
		if (!ctx.hasUI) return;
		ctx.ui.setFooter((_tui, theme, footerData) => {
			const paint: Paint = (role, text) => theme.fg(role as never, text);
			return {
				render(fullWidth: number) {
					if (dialogOpen) return [];
					const width = Math.max(1, fullWidth - GUTTER.length);
					const statuses = footerData.getExtensionStatuses();
					const line = composeFooter(
						{
							statuses: visibleStatuses(statuses, paint),
							ponytail: ponytailBadge(statuses.get(PONYTAIL_STATUS)),
							model: ctx.model?.name ?? ctx.model?.id ?? "no model",
							contextPercent: contextPercent(usage, ctx.model?.contextWindow),
						},
						paint,
						width,
					);
					const mode = statuses.get(MODE_STATUS);
					const modeRow = mode ? composeModeRow(mode, width, statuses.get(VOICE_STATUS), statuses.get(TASKS_HINT_STATUS)) : undefined;
					const fleet = fleetRegistry();
					return footerRows(line, modeRow, fleet?.fleetHint?.(theme), fleet?.fleetLines?.(fullWidth, theme) ?? []);
				},
				invalidate() {},
			};
		});
	});
}

if (process.env.CLAUDE_FOOTER_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain: Paint = (_role, text) => text;
	const bare = (text: string) => text.replace(ANSI, "");
	const base: FooterFacts = { statuses: [], ponytail: "[PONYTAIL]", model: "Claude Haiku 4.5 (latest)", contextPercent: 22.4 };
	check(bare(composeFooter(base, plain)) === "[PONYTAIL] · Haiku 4.5 · ctx 22%", "line one is Cuong's Claude status line: badge, display name, context");
	check(bare(composeFooter({ ...base, ponytail: undefined, contextPercent: null }, plain)) === "Haiku 4.5", "no badge while ponytail is off; no ctx before the first reply, like Claude");
	check(displayName("Claude Opus 5.5") === "Opus 5.5" && displayName("GLM 5.3 Flash (OpenRouter)") === "GLM 5.3 Flash (OpenRouter)", "Claude's display name drops the vendor and (latest)");
	const coloured = composeFooter({ ...base, statuses: ["deepseek $24.57"] }, plain);
	check(coloured.startsWith("\x1b[38;5;108m[PONYTAIL]\x1b[0m\x1b[38;5;240m · \x1b[0m\x1b[38;5;110mHaiku 4.5\x1b[0m"), "statusline.ps1 colours: badge 108, separator 240, model 110");
	check(coloured.includes("\x1b[38;5;108mctx 22%") && composeFooter({ ...base, contextPercent: 60 }, plain).includes("\x1b[38;5;179mctx 60%") && composeFooter({ ...base, contextPercent: 85 }, plain).includes("\x1b[38;5;167mctx 85%"), "ctx turns 179 at 60% and 167 at 85%");
	check(bare(coloured).endsWith(" · deepseek $24.57"), "pi's balances take the slot of Claude's usage meters");
	check(ponytailBadge("\x1b[32m● 🐴 ponytail: ⚡ FULL\x1b[0m") === "[PONYTAIL]" && ponytailBadge("○ 🐴 ponytail: 🌿 LITE") === "[PONYTAIL:LITE]" && ponytailBadge(undefined) === undefined, "badge from the ponytail status, like the flag file statusline.ps1 reads");
	check(composeFooter(base, plain) === composeFooter(base, plain, 1000), "no overflow = unchanged");
	const crowded = { ...base, statuses: ["deepseek $24.57", "openrouter $20.38"], model: "DeepSeek V4 Flash Vision Exp" };
	const at60 = bare(composeFooter(crowded, plain, 60));
	check(at60.includes("ctx 22%") && !at60.includes("openrouter") && at60.length <= 60, "overflow drops the trailing balances first");
	check(bare(composeFooter(base, plain, 25)) === "[PONYTAIL] · Haiku 4.5", "overflow drops whole parts");
	check(!/\x1b\[[0-9;]*$/.test(composeFooter(base, plain, 20)), "no cut escape sequence at line end");
	check(bare(composeFooter({ ...base, statuses: ["x".repeat(60)] }, plain, 40)) === "[PONYTAIL] · Haiku 4.5 · ctx 22%", "a status too wide to fit is dropped, not sliced");
	const statuses = new Map([
		["modes", "⏵⏵ accept edits on"],
		["pi-permission-system", "yolo"],
		["ponytail", "● 🐴 ponytail: ⚡ FULL"],
		["mcp", "MCP 1/12"],
		["cheap", ""],
		["api-balance", "deepseek $1.00"],
	]);
	check(visibleStatuses(statuses, plain).join("|") === "deepseek $1.00", "mode row, yolo word, ponytail, MCP count and empty statuses stay out of the balance slot");
	check(composeModeRow("⏵⏵ accept edits on (shift+tab to cycle)", 80) === "⏵⏵ accept edits on (shift+tab to cycle)", "mode row is the mode alone, no shortcuts hint, like Claude 2.1.280");
	const voiceRow = composeModeRow("⏵⏵ accept edits on (shift+tab to cycle)", 80, "\x1b[2mlistening…\x1b[0m");
	check(voiceRow.endsWith("listening…\x1b[0m") && plainWidth(voiceRow) === 80, "voice slot sits on the right at the same width");
	check(composeModeRow("⏵⏵ accept edits on (shift+tab to cycle)", 40, "listening…") === "⏵⏵ accept edits on (shift+tab to cycle)", "too narrow for the voice slot = mode only");
	check(visibleStatuses(new Map([["voice", "listening…"], ["api-balance", "x $1"]]), plain).join("|") === "x $1", "voice status stays out of line one");
	const hintRow = composeModeRow("⏵⏵ bypass permissions on (shift+tab to cycle)", 80, undefined, "\x1b[38;2;153;153;153m/tasks to see subagents\x1b[0m");
	check(bare(hintRow) === "⏵⏵ bypass permissions on (shift+tab to cycle) · /tasks to see subagents", "the tasks-to-see-subagents hint joins the mode with Claude's separator");
	check(hintRow.includes("\x1b[38;2;153;153;153m \xB7 \x1b[0m"), "the separator before the hint is grey 999999, like the rest of that trailing segment in Claude 2.1.280");
	check(composeModeRow("⏵⏵ bypass permissions on (shift+tab to cycle)", 80) === "⏵⏵ bypass permissions on (shift+tab to cycle)", "no tasks-hint status = mode row unchanged");
	const hintAndVoiceRow = composeModeRow("mode", 40, "voice", "hint");
	check(bare(hintAndVoiceRow).startsWith("mode \xB7 hint") && bare(hintAndVoiceRow).endsWith("voice") && plainWidth(hintAndVoiceRow) === 40, "the hint sits left of the mode, voice still flush right at the same width");
	check(visibleStatuses(new Map([["tasks-hint", "/tasks to see subagents"], ["api-balance", "x $1"]]), plain).join("|") === "x $1", "tasks-hint stays out of line one, like modes and voice");
	const prompt = { type: "message", message: { role: "user" } };
	const reply = { type: "message", message: { role: "assistant", usage: { input: 3, cacheRead: 41_000 } } };
	const failed = { type: "message", message: { role: "assistant", usage: { input: 0, cacheRead: 0 } } };
	check(lastUsage([prompt]) === undefined && lastUsage([prompt, failed]) === undefined && lastUsage([prompt, reply, failed]) === reply.message.usage, "a submitted prompt alone shows no ctx: Claude 2.1.280 printed \"[PONYTAIL] · Haiku 4.5\" until its first response, then \"ctx 20%\"");
	check(contextPercent({ input: 3, cacheRead: 40_000, cacheWrite: 1_000 }, 200_000) === 21 && contextPercent({ input: 40_500 }, 200_000) === 20 && contextPercent(undefined, 200_000) === null, "Claude's used_percentage: round((input + cache_creation + cache_read) / window * 100), output tokens left out");
	check(contextPercent({ input: 900_000 }, 200_000) === 100, "clamped to 100 like Claude's");
	check(footerRows("L", "M", undefined, []).join("|") === "  L|  M" && footerRows("L", undefined, undefined, []).join("|") === "  L", "no agents: the footer is the status line and the mode row, unchanged");
	const list = ["", "  ● main", "  ◯ general-purpose  Say ok   0s"];
	check(footerRows("L", "M", undefined, list).join("|") === `  L|  M|${list.join("|")}`, "the agents list sits under the mode row, after a blank row, at column 0 (Claude 2.1.280: \"  ● main\" on row 98 under the mode row on 96)");
	check(footerRows("L", "M", "↑/↓ to select · Enter to view", list)[1] === "  ↑/↓ to select · Enter to view", "with the list focused the key hint replaces the mode row, like Claude's footer tasks selection");
	check(fleetRegistry() === undefined, "no pi-subagents registry = no list and no hint, not a throw");
	(globalThis as Record<symbol, unknown>)[Symbol.for("pi-subagents:manager")] = { fleetLines: (width: number) => [`w${width}`], fleetHint: () => "hint" };
	check(fleetRegistry()?.fleetLines?.(132, {})[0] === "w132" && fleetRegistry()?.fleetHint?.({}) === "hint", "the list and the hint come off the pi-subagents cross-package registry");
	delete (globalThis as Record<symbol, unknown>)[Symbol.for("pi-subagents:manager")];
	console.log("\nAll claude-footer checks passed.");
}
