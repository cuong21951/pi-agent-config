import { execFileSync } from "node:child_process";
import type { ExtensionAPI, ExtensionCommandContext, Theme } from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { matchesKey, type Component, type KeybindingsManager, type TUI } from "@earendil-works/pi-tui";
import {
	displayTitle,
	emptyRow,
	entryRows,
	filterResumeEntries,
	footerRows,
	metaLine,
	modalRule,
	projectHeaderRow,
	scopeHint,
	scopeSwitchHintRow,
	searchBoxRows,
	titleRow,
	type ResumeEntry,
	type ResumeScope,
} from "./store.ts";

const RESUME_COMMAND = "claude-resume-open";

function gitBranch(cwd: string): string {
	try {
		return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "HEAD";
	} catch {
		return "HEAD";
	}
}

function projectLabel(cwd: string): string {
	const parts = cwd.split(/[\\/]/).filter(Boolean);
	return parts[parts.length - 1] ?? cwd;
}

function resumeComponent(
	tui: TUI,
	theme: Theme,
	_keybindings: KeybindingsManager,
	done: (result: string | undefined) => void,
	projectEntries: readonly ResumeEntry[],
	everywhereEntries: readonly ResumeEntry[],
	cwd: string,
): Component {
	const paint = (role: string, text: string) => theme.fg(role as never, text);
	let query = "";
	let scope: ResumeScope = "project";
	let selected = 0;
	const branchCache = new Map<string, string>();
	const branchFor = (dir: string) => {
		if (!branchCache.has(dir)) branchCache.set(dir, gitBranch(dir));
		return branchCache.get(dir)!;
	};

	const source = () => (scope === "project" ? projectEntries : everywhereEntries);
	const filtered = () => filterResumeEntries(source(), query);
	const redraw = () => {
		const count = filtered().length;
		selected = count === 0 ? 0 : Math.min(selected, count - 1);
		tui.requestRender();
	};

	return {
		render(width: number): string[] {
			const matches = filtered();
			const now = Date.now();
			const rows: string[] = [modalRule(width), titleRow(), ...searchBoxRows(query, width - 6, paint)];
			if (scope === "project") rows.push(projectHeaderRow(projectLabel(cwd), paint));
			rows.push("");
			if (matches.length === 0) {
				rows.push(emptyRow(paint));
				if (scope === "project") rows.push(scopeSwitchHintRow(paint));
			} else {
				matches.forEach((entry, i) => {
					rows.push(...entryRows(displayTitle(entry), metaLine(entry, now, branchFor(entry.cwd), Buffer.byteLength(entry.allMessagesText, "utf8")), i === selected, paint));
					if (i < matches.length - 1) rows.push("");
				});
			}
			rows.push("", ...footerRows(scopeHint(scope, matches.length > 0), paint));
			const height = Math.max(rows.length, tui.terminal.rows - 3);
			return [...Array<string>(height - rows.length).fill(""), ...rows];
		},
		invalidate() {},
		handleInput(data: string) {
			if (matchesKey(data, "escape")) return done(undefined);
			if (matchesKey(data, "enter")) return done(filtered()[selected]?.path);
			if (matchesKey(data, "ctrl+a")) {
				scope = scope === "project" ? "everywhere" : "project";
				return redraw();
			}
			if (matchesKey(data, "up")) {
				selected = Math.max(0, selected - 1);
				return redraw();
			}
			if (matchesKey(data, "down")) {
				const count = filtered().length;
				selected = count === 0 ? 0 : Math.min(count - 1, selected + 1);
				return redraw();
			}
			if (matchesKey(data, "backspace")) {
				query = query.slice(0, -1);
				return redraw();
			}
			if (!/[\x00-\x1f\x7f]/.test(data)) {
				query += data;
				return redraw();
			}
		},
	};
}

async function openResumePicker(ctx: ExtensionCommandContext): Promise<void> {
	if (!ctx.hasUI) return;
	const cwd = ctx.cwd;
	const sessionDir = ctx.sessionManager?.getSessionDir?.();
	const [projectInfos, everywhereInfos] = await Promise.all([SessionManager.list(cwd, sessionDir), SessionManager.listAll(sessionDir)]);
	const toEntry = (info: (typeof projectInfos)[number]): ResumeEntry => ({
		path: info.path,
		cwd: info.cwd,
		created: info.created,
		modified: info.modified,
		messageCount: info.messageCount,
		firstMessage: info.firstMessage,
		allMessagesText: info.allMessagesText,
	});
	const path = await ctx.ui.custom<string | undefined>(
		(tui, theme, keybindings, done) => resumeComponent(tui, theme, keybindings, done, projectInfos.map(toEntry), everywhereInfos.map(toEntry), cwd),
		{ overlay: true, overlayOptions: { anchor: "bottom-left", width: "100%", margin: 0 } },
	);
	if (path) await ctx.switchSession(path);
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand(RESUME_COMMAND, {
		handler: async (_args, ctx) => openResumePicker(ctx),
	});

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.onTerminalInput((data: string) => {
			if (!matchesKey(data, "enter")) return undefined;
			if (!ctx.isIdle()) return undefined;
			const text = ctx.ui.getEditorText();
			if (text !== "/resume" && !text.startsWith("/resume ")) return undefined;
			ctx.ui.setEditorText("");
			pi.sendUserMessage(`/${RESUME_COMMAND}`, { expandPromptTemplates: true });
			return { consume: true };
		});
	});
}
