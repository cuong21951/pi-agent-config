import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir, type ExtensionAPI, type ExtensionContext, type Theme } from "@earendil-works/pi-coding-agent";
import { matchesKey, type Component, type KeybindingsManager, type TUI } from "@earendil-works/pi-tui";
import {
	filterEntries,
	footerRow,
	formatHistoryLine,
	formatRelativeTime,
	otherScope,
	ruleRow,
	searchBoxRows,
	titleRow,
	visibleWindow,
	zoneRows,
	type HistoryEntry,
	type HistoryScope,
	ZONE_HEIGHT,
} from "./store.ts";

const HISTORY_FILE = process.env.CLAUDE_HISTORY_FILE ?? join(getAgentDir(), "history.jsonl");

function readEntries(): HistoryEntry[] {
	if (!existsSync(HISTORY_FILE)) return [];
	try {
		const lines = readFileSync(HISTORY_FILE, "utf8").split("\n");
		const entries: HistoryEntry[] = [];
		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed === "") continue;
			try {
				const parsed = JSON.parse(trimmed);
				if (typeof parsed.display === "string" && typeof parsed.timestamp === "number") entries.push(parsed);
			} catch {
				continue;
			}
		}
		return entries;
	} catch {
		return [];
	}
}

function appendEntry(entry: HistoryEntry): void {
	try {
		appendFileSync(HISTORY_FILE, `${formatHistoryLine(entry)}\n`);
	} catch {}
}

function historySearchComponent(
	tui: TUI,
	theme: Theme,
	keybindings: KeybindingsManager,
	done: (result: string | undefined) => void,
	entries: readonly HistoryEntry[],
	sessionId: string,
	seed: string,
): Component {
	const paint = (role: string, text: string) => theme.fg(role as never, text);
	let query = seed;
	let scope: HistoryScope = "everywhere";
	let selected = 0;

	const filtered = () => filterEntries(entries, query, scope, sessionId);
	const clampSelected = () => {
		const count = filtered().length;
		selected = count === 0 ? 0 : Math.min(selected, count - 1);
	};
	const redraw = () => {
		clampSelected();
		tui.requestRender();
	};

	return {
		render(width: number): string[] {
			const matches = filtered();
			const now = Date.now();
			const window = visibleWindow(matches, selected, ZONE_HEIGHT);
			const items = window.items.map((entry, i) => ({
				relTime: formatRelativeTime(now, entry.timestamp),
				display: entry.display,
				selected: window.start + i === selected,
			}));
			const previewText = matches[selected]?.display;
			return [
				ruleRow(width),
				titleRow(scope),
				...zoneRows(items, previewText, width, paint),
				...searchBoxRows(query, Math.max(4, width - 4), paint),
				footerRow(paint),
			];
		},
		invalidate() {},
		handleInput(data: string) {
			if (matchesKey(data, "escape")) return done(undefined);
			if (matchesKey(data, "enter")) {
				const entry = filtered()[selected];
				return done(entry?.display ?? query);
			}
			if (matchesKey(data, "ctrl+s")) {
				scope = otherScope(scope);
				return redraw();
			}
			if (keybindings.matches(data, "tui.select.up")) {
				selected = Math.max(0, selected - 1);
				return redraw();
			}
			if (keybindings.matches(data, "tui.select.down")) {
				const count = filtered().length;
				selected = count === 0 ? 0 : Math.min(count - 1, selected + 1);
				return redraw();
			}
			if (matchesKey(data, "backspace")) {
				query = query.slice(0, -1);
				selected = Math.max(0, filterEntries(entries, query, scope, sessionId).length - 1);
				return redraw();
			}
			if (!/[\x00-\x1f\x7f]/.test(data)) {
				query += data;
				selected = Math.max(0, filterEntries(entries, query, scope, sessionId).length - 1);
				return redraw();
			}
		},
	};
}

async function openHistorySearch(ctx: ExtensionContext): Promise<void> {
	const entries = readEntries();
	const sessionId = ctx.sessionManager?.getSessionId() ?? "";
	const seed = ctx.ui.getEditorText();
	const result = await ctx.ui.custom<string | undefined>(
		(tui, theme, keybindings, done) => historySearchComponent(tui, theme, keybindings, done, entries, sessionId, seed),
		{ overlay: true, overlayOptions: { anchor: "bottom-left", width: "100%", margin: 0 } },
	);
	if (result !== undefined) ctx.ui.setEditorText(result);
}

export default function (pi: ExtensionAPI) {
	pi.on("input", (event, ctx) => {
		if (event.source !== "interactive" || event.text.trim() === "") return;
		appendEntry({
			display: event.text,
			pastedContents: {},
			timestamp: Date.now(),
			project: ctx.cwd,
			sessionId: ctx.sessionManager?.getSessionId() ?? "",
		});
	});

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.onTerminalInput((data: string) => {
			if (!matchesKey(data, "ctrl+r")) return undefined;
			void openHistorySearch(ctx);
			return { consume: true };
		});
	});
}
