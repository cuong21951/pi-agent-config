import { basename } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionMode } from "@earendil-works/pi-coding-agent";
import { SettingsManager, VERSION } from "@earendil-works/pi-coding-agent";
import type { Component, KeybindingsManager, TUI, Theme } from "@earendil-works/pi-tui";
import { matchesKey } from "@earendil-works/pi-tui";
import { hex } from "./colors.ts";
import { TAB_BAR_TABS, tabBarRow } from "./tabs.ts";

const LABEL_WIDTH = 19;

export interface McpStatusServerLike {
	status: string;
}

export interface McpStatusSnapshotLike {
	servers: readonly McpStatusServerLike[];
	connectedCount: number;
}

export function sessionKindLabel(mode: ExtensionMode): string {
	if (mode === "tui") return "interactive";
	if (mode === "print") return "print";
	if (mode === "json") return "json";
	return "rpc";
}

export interface McpServerCounts {
	connected: number;
	needsAuth: number;
}

export function mcpServerCounts(snapshot: McpStatusSnapshotLike | undefined): McpServerCounts | undefined {
	if (!snapshot || snapshot.servers.length === 0) return undefined;
	const needsAuth = snapshot.servers.filter((server) => server.status === "needs-auth").length;
	return { connected: snapshot.connectedCount, needsAuth };
}

export function mcpSummaryLine(counts: McpServerCounts | undefined, paint: (color: string, text: string) => string): string | undefined {
	if (!counts) return undefined;
	const connected = paint("3399ff", `${counts.connected} connected`);
	const hint = paint("999999", "\xB7 /mcp");
	return counts.needsAuth > 0 ? `${connected}, ${paint("ffcc00", `${counts.needsAuth} need auth`)} ${hint}` : `${connected} ${hint}`;
}

export function memoryFilesSummary(paths: string[]): string {
	if (paths.length === 0) return "No memory files loaded";
	return `${paths.length} loaded \xB7 ${paths.map((path) => basename(path)).join(", ")}`;
}

export function labelRow(label: string, value: string, paint: (color: string, text: string) => string, bold: (text: string) => string): string {
	return `${bold(`${label}:`.padEnd(LABEL_WIDTH))}${value}`;
}

export interface StatusPanelData {
	version: string;
	sessionId: string;
	sessionKind: string;
	cwd: string;
	provider: string;
	modelLabel: string;
	mcpServers: McpServerCounts | undefined;
	memoryFiles: string;
	settingsSources: string;
}

export function statusPanelRows(data: StatusPanelData, width: number, paint: (color: string, text: string) => string, bold: (text: string) => string): string[] {
	const rows: string[] = [
		paint("99ccff", "\u2594".repeat(width)),
		"",
		`  ${tabBarRow(TAB_BAR_TABS, "Status", paint, bold)}`,
		"",
		`  ${labelRow("Version", data.version, paint, bold)}`,
		`  ${labelRow("Session ID", data.sessionId, paint, bold)}`,
		`  ${labelRow("Session kind", data.sessionKind, paint, bold)}`,
		`  ${labelRow("cwd", data.cwd, paint, bold)}`,
		"",
		`  ${labelRow("Provider", data.provider, paint, bold)}`,
		`  ${labelRow("Model", data.modelLabel, paint, bold)}`,
	];
	const mcpSummary = mcpSummaryLine(data.mcpServers, paint);
	if (mcpSummary) rows.push(`  ${labelRow("MCP servers", mcpSummary, paint, bold)}`);
	rows.push(`  ${labelRow("Memory files", data.memoryFiles, paint, bold)}`);
	rows.push(`  ${labelRow("Settings sources", data.settingsSources, paint, bold)}`);
	rows.push("");
	rows.push(`  ${paint("999999", "Esc to cancel")}`);
	return rows;
}

export function gatherStatusData(ctx: ExtensionCommandContext, mcpSnapshot: McpStatusSnapshotLike | undefined): StatusPanelData {
	const settingsManager = SettingsManager.create(ctx.cwd, process.env.PI_CODING_AGENT_DIR);
	const hasProjectSettings = Object.keys(settingsManager.getProjectSettings() ?? {}).length > 0;
	const promptOptions = ctx.getSystemPromptOptions();
	const memoryPaths = (promptOptions.contextFiles ?? []).map((file) => file.path);
	return {
		version: VERSION,
		sessionId: ctx.sessionManager.getSessionId(),
		sessionKind: sessionKindLabel(ctx.mode),
		cwd: ctx.cwd,
		provider: ctx.model?.provider ?? "no model",
		modelLabel: ctx.model?.name ?? ctx.model?.id ?? "no model",
		mcpServers: mcpServerCounts(mcpSnapshot),
		memoryFiles: memoryFilesSummary(memoryPaths),
		settingsSources: hasProjectSettings ? "User settings, Project settings" : "User settings",
	};
}

function statusComponent(data: StatusPanelData, theme: Theme, keybindings: KeybindingsManager, done: (result: void) => void, tui: TUI): Component {
	const paint = (color: string, text: string) => hex(color, text);
	const bold = (text: string) => theme.bold(text);
	return {
		render(width: number): string[] {
			return statusPanelRows(data, width, paint, bold);
		},
		invalidate(): void {},
		handleInput(input: string): void {
			if (keybindings.matches(input, "tui.select.cancel") || matchesKey(input, "escape")) done(undefined);
		},
	};
}

export function registerStatusPanel(pi: ExtensionAPI, getMcpSnapshot: () => McpStatusSnapshotLike | undefined): void {
	pi.registerCommand("status", {
		description: "Show pi's status including version, model, account, and MCP servers",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;
			const data = gatherStatusData(ctx, getMcpSnapshot());
			await ctx.ui.custom<void>((tui, theme, keybindings, done) => statusComponent(data, theme, keybindings, done, tui), {
				overlay: true,
				overlayOptions: { anchor: "bottom-left", width: "100%", margin: 0 },
			});
		},
	});
}

if (process.env.CLAUDE_PANELS_STATUS_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain = (_color: string, text: string) => text;
	const bold = (text: string) => `[${text}]`;

	check(sessionKindLabel("tui") === "interactive", "pi's tui mode reads as Claude's interactive session kind");
	check(sessionKindLabel("print") === "print" && sessionKindLabel("rpc") === "rpc" && sessionKindLabel("json") === "json", "the other run modes keep their own name, since Claude has no equivalent for them");

	check(mcpServerCounts(undefined) === undefined, "no snapshot yet (MCP still initializing) hides the row instead of showing a false zero");
	check(mcpServerCounts({ servers: [], connectedCount: 0 }) === undefined, "zero configured servers hides the row the same way");
	check(mcpSummaryLine(mcpServerCounts({ servers: [{ status: "connected" }, { status: "connected" }], connectedCount: 2 }), plain) === "2 connected \xB7 /mcp", "all connected reads like Claude's row without a needs-auth clause");
	check(mcpSummaryLine(mcpServerCounts({ servers: [{ status: "connected" }, { status: "needs-auth" }], connectedCount: 1 }), plain) === "1 connected, 1 need auth \xB7 /mcp", "Claude's exact wording, connected count then a needs-auth clause");
	check(mcpSummaryLine(mcpServerCounts({ servers: [{ status: "connected" }, { status: "needs-auth" }], connectedCount: 1 }), (color, text) => `<${color}>${text}`).startsWith("<3399ff>1 connected"), "the connected count carries Claude's exact borderAccent blue (3399ff)");
	check(mcpSummaryLine(mcpServerCounts({ servers: [{ status: "needs-auth" }], connectedCount: 0 }), (color, text) => `<${color}>${text}`).includes("<ffcc00>1 need auth"), "the needs-auth count carries Claude's exact warning yellow (ffcc00)");

	check(memoryFilesSummary([]) === "No memory files loaded", "no context files loaded reads plainly, not as a blank list");
	check(memoryFilesSummary(["C:\\Users\\cuong\\AGENTS.md"]) === "1 loaded \xB7 AGENTS.md", "matches pi's own header notice basename for a single memory file");
	check(memoryFilesSummary(["/a/CLAUDE.md", "/a/AGENTS.md"]) === "2 loaded \xB7 CLAUDE.md, AGENTS.md", "multiple memory files list every basename");

	check(labelRow("Version", "2.1.283", plain, bold) === `[${"Version:".padEnd(19)}]2.1.283`, "labels pad to Claude's 19-column field width before the value");
	check(labelRow("cwd", "C:\\x", plain, bold) === `[${"cwd:".padEnd(19)}]C:\\x`, "a short label still pads to the same 19-column width as a long one");

	const data: StatusPanelData = {
		version: "0.85.1",
		sessionId: "abc-123",
		sessionKind: "interactive",
		cwd: "C:\\work",
		provider: "github-copilot",
		modelLabel: "Haiku 4.5",
		mcpServers: { connected: 1, needsAuth: 0 },
		memoryFiles: "1 loaded \xB7 AGENTS.md",
		settingsSources: "User settings",
	};
	const rows = statusPanelRows(data, 80, plain, bold);
	check(rows[0]!.length === 80, "the top rule spans the full panel width, like Claude's status/usage dialogs");
	check(rows.some((row) => row.includes(`[${"Settings sources:".padEnd(19)}]User settings`)), "settings sources row is present");
	check(rows[rows.length - 1]!.trim() === "Esc to cancel", "the panel ends with Claude's dismissal hint");
	check(rows.some((row) => row.includes("0.85.1")), "the real pi VERSION constant is shown instead of Claude's own version number");

	console.log("\nAll claude-panels status checks passed.");
}
