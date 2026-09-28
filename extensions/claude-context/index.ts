import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { SettingsManager, shouldCompact } from "@earendil-works/pi-coding-agent";
import { contextPercent } from "../claude-footer/index.ts";

const NOTICE_MARGIN = 2;
export const WARN_AT_PERCENT = 20;
export const COMPACT_HINT = "Run /compact to compact & continue";

export type ContextLowState = "none" | "warning" | "critical";

export function untilAutoCompactPercent(tokens: number | null, contextWindow: number | undefined, reserveTokens: number): number | null {
	if (tokens === null || !contextWindow) return null;
	const effectiveWindow = Math.max(1, contextWindow - reserveTokens);
	const usedOfEffective = contextPercent({ input: tokens }, effectiveWindow);
	return usedOfEffective === null ? null : Math.max(0, 100 - usedOfEffective);
}

export function contextLowState(untilPercent: number | null, compactionEnabled: boolean): ContextLowState {
	if (untilPercent === null || untilPercent > WARN_AT_PERCENT) return "none";
	return compactionEnabled ? "warning" : "critical";
}

export function contextLowText(state: ContextLowState, untilPercent: number): string {
	if (state === "warning") return `${untilPercent}% until auto-compact`;
	if (state === "critical") return `Context low (${untilPercent}% remaining) \xB7 ${COMPACT_HINT}`;
	return "";
}

export function noticeRow(text: string, width: number, paint: (text: string) => string): string {
	return " ".repeat(Math.max(0, width - text.length - NOTICE_MARGIN)) + paint(text);
}

export default function (pi: ExtensionAPI) {
	let requestRender = () => {};
	pi.on("message_end", () => requestRender());
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		const settingsManager = SettingsManager.create(ctx.cwd, process.env.PI_CODING_AGENT_DIR);
		ctx.ui.setWidget("claude-context", (tui, theme) => {
			requestRender = () => tui.requestRender();
			return {
				render(width: number) {
					const usage = ctx.getContextUsage();
					const settings = settingsManager.getCompactionSettings();
					const untilPercent = untilAutoCompactPercent(usage?.tokens ?? null, usage?.contextWindow, settings.reserveTokens);
					const state = contextLowState(untilPercent, settings.enabled);
					if (state === "none" || untilPercent === null) return [];
					const role = state === "critical" ? "error" : "muted";
					return [noticeRow(contextLowText(state, untilPercent), width, (text) => theme.fg(role as never, text))];
				},
				invalidate() {},
			};
		});
	});
}

if (process.env.CLAUDE_CONTEXT_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};

	check(untilAutoCompactPercent(null, 200_000, 16_384) === null, "no usage yet = no row, like Claude before the first reply");
	check(untilAutoCompactPercent(100_000, undefined, 16_384) === null, "no model context window = no row");

	const window = 200_000;
	const reserve = 33_334;
	check(untilAutoCompactPercent(100_000, window, reserve) === 40, "40% headroom left of the reserve-adjusted window at half the raw window");
	check(untilAutoCompactPercent(148_000, window, reserve) === 11, "Claude 2.1.283 showed \"11% until auto-compact\" at 148000/200000 tokens with this reserve");
	check(untilAutoCompactPercent(150_000, window, reserve) === 10, "Claude showed \"10% until auto-compact\" at 150000/200000 tokens");
	check(untilAutoCompactPercent(500_000, window, reserve) === 0, "clamped at 0, never negative, once usage passes the effective window");

	const defaultSettings = { enabled: true, reserveTokens: 16_384, keepRecentTokens: 20_000 };
	check(shouldCompact(window - reserve + 1, window, { ...defaultSettings, reserveTokens: reserve }) === true, "pi's real shouldCompact() agrees the trigger has fired exactly where our percent clamps to 0");
	check(shouldCompact(window - reserve - 1, window, { ...defaultSettings, reserveTokens: reserve }) === false, "one token short of the real trigger, shouldCompact still says no");

	check(contextLowState(null, true) === "none", "no usage = none");
	check(contextLowState(25, true) === "none", "above the warning band = none");
	check(contextLowState(20, true) === "warning", "at the warning band, compaction enabled = warning");
	check(contextLowState(0, true) === "warning", "compaction will fire any moment, still enabled = warning, not critical");
	check(contextLowState(20, false) === "critical", "same band with compaction.enabled=false = critical, mirroring Claude's DISABLE_COMPACT capture");

	check(contextLowText("warning", 11) === "11% until auto-compact", "Claude's exact dim wording, measured 2026-09-28");
	check(contextLowText("critical", 0) === "Context low (0% remaining) \xB7 Run /compact to compact & continue", "Claude's DISABLE_COMPACT capture had no hint (the command itself was dead); pi's manual /compact still works with compaction.enabled=false (agent-session.js compact() never checks settings.enabled), so pi keeps the hint");
	check(contextLowText("none", 50) === "", "nothing to draw once the state is none");

	check(noticeRow("10% until auto-compact", 132, (t) => t) === " ".repeat(108) + "10% until auto-compact", "right-aligned two columns in, like claude-keys' Esc notice and Claude's own row (measured indent 108 at 132 columns)");
	check(noticeRow("x", 132, (t) => `[${t}]`)[131] === "]", "paint wraps the text without shifting the margin");

	console.log("claude-context selftest OK");
}
