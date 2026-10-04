import type { ExtensionAPI, ExtensionCommandContext, ExtensionMode } from "@earendil-works/pi-coding-agent";
import { SettingsManager, VERSION } from "@earendil-works/pi-coding-agent";
import type { Component, KeybindingsManager, TUI, Theme } from "@earendil-works/pi-tui";
import { matchesKey } from "@earendil-works/pi-tui";
import { hex } from "./colors.ts";
import { TAB_BAR_TABS, openPanel, paneRows, tabBarRow } from "./tabs.ts";

const LABEL_GAP = 2;
const INDENT = "   ";

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

export function labelRow(label: string, value: string, width: number, bold: (text: string) => string): string {
	return `${bold(`${label}:`)}${" ".repeat(width - label.length - 1)}${value}`;
}

export interface StatusPanelData {
	version: string;
	sessionName: string | undefined;
	sessionId: string;
	sessionKind: string;
	cwd: string;
	provider: string;
	modelLabel: string;
	mcpServers: McpServerCounts | undefined;
	settingsSources: string;
}

export function statusPanelRows(data: StatusPanelData, width: number, paint: (color: string, text: string) => string, bold: (text: string) => string): string[] {
	const rows: Array<[string, string] | undefined> = [
		["Version", data.version],
		["Session name", data.sessionName ?? paint("999999", "/rename to add a name")],
		["Session ID", data.sessionId],
		["Session kind", data.sessionKind],
		["cwd", data.cwd],
		undefined,
		["Provider", data.provider],
		["Model", data.modelLabel],
	];
	const mcpSummary = mcpSummaryLine(data.mcpServers, paint);
	if (mcpSummary) rows.push(["MCP servers", mcpSummary]);
	rows.push(["Setting sources", data.settingsSources]);
	const labelWidth = Math.max(...rows.map((row) => (row ? row[0].length + 1 : 0))) + LABEL_GAP;
	return [
		paint("99ccff", "▔".repeat(width)),
		`${INDENT}${tabBarRow(TAB_BAR_TABS, "Status", paint, bold)}`,
		"",
		...rows.map((row) => (row ? `${INDENT}${labelRow(row[0], row[1], labelWidth, bold)}` : "")),
		"",
		`${INDENT}${paint("999999", "Esc to cancel")}`,
	];
}

export function gatherStatusData(ctx: ExtensionCommandContext, mcpSnapshot: McpStatusSnapshotLike | undefined): StatusPanelData {
	const settingsManager = SettingsManager.create(ctx.cwd, process.env.PI_CODING_AGENT_DIR);
	const hasProjectSettings = Object.keys(settingsManager.getProjectSettings() ?? {}).length > 0;
	return {
		version: VERSION,
		sessionName: ctx.sessionManager.getSessionName(),
		sessionId: ctx.sessionManager.getSessionId(),
		sessionKind: sessionKindLabel(ctx.mode),
		cwd: ctx.cwd,
		provider: ctx.model?.provider ?? "no model",
		modelLabel: ctx.model ? `${ctx.model.name} (${ctx.model.id})` : "no model",
		mcpServers: mcpServerCounts(mcpSnapshot),
		settingsSources: hasProjectSettings ? "User settings, Project settings" : "User settings",
	};
}

function statusComponent(data: StatusPanelData, theme: Theme, keybindings: KeybindingsManager, done: (result: void) => void, tui: TUI): Component {
	const paint = (color: string, text: string) => hex(color, text);
	const bold = (text: string) => theme.bold(text);
	return {
		render(width: number): string[] {
			return paneRows(statusPanelRows(data, width, paint, bold), tui.terminal.rows - 2);
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
			await openPanel(pi, ctx, (tui, theme, keybindings, done) => statusComponent(data, theme, keybindings, done, tui));
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

	check(labelRow("Version", "2.1.289", 28, bold) === `[Version:]${" ".repeat(20)}2.1.289`, "the value column is the longest label plus two spaces, not a fixed width: Claude 2.1.289 m6d-panels puts Version's value 28 columns after the label start because `Managed settings (remote):` is 26 wide");
	check(labelRow("cwd", "C:\\x", 28, bold) === `[cwd:]${" ".repeat(24)}C:\\x`, "a short label pads to the same value column as a long one, and only the label itself is bold");

	const data: StatusPanelData = {
		version: "0.85.1",
		sessionName: undefined,
		sessionId: "abc-123",
		sessionKind: "interactive",
		cwd: "C:\\work",
		provider: "github-copilot",
		modelLabel: "Haiku 4.5 (claude-haiku-4.5)",
		mcpServers: { connected: 1, needsAuth: 0 },
		settingsSources: "User settings",
	};
	const rows = statusPanelRows(data, 80, plain, bold);
	check(rows[0]!.length === 80, "the top rule spans the full panel width, like Claude's status/usage dialogs");
	check(rows[1] === `   ${tabBarRow(TAB_BAR_TABS, "Status", plain, bold)}` && rows[2] === "", "the tab row sits directly under the rule, three columns in, followed by one blank row (Claude 2.1.289 m6d-panels rows 2-4)");
	check(rows.slice(3, 10).map((row) => row.replace(/\] +/, "] ").trimEnd()).join("|") === "   [Version:] 0.85.1|   [Session name:] /rename to add a name|   [Session ID:] abc-123|   [Session kind:] interactive|   [cwd:] C:\\work||   [Provider:] github-copilot", "rows follow Claude's order Version, Session name, Session ID, Session kind, cwd, then a blank row; an unnamed session reads `/rename to add a name`");
	check(rows.some((row) => row === `   [Setting sources:]${" ".repeat(2)}User settings`) && rows.some((row) => row.startsWith("   [MCP servers:]")), "Setting sources (not Settings) is the last row and the longest label sets the value column");
	check(rows[rows.length - 2] === "" && rows[rows.length - 1] === "   Esc to cancel", "a blank row, then Esc to cancel three columns in, ends the card");
	check(!rows.some((row) => row.includes("Memory files")), "Claude's /status has no Memory files row, so pi draws none");
	check(rows.some((row) => row.includes("0.85.1")), "the real pi VERSION constant is shown instead of Claude's own version number");
	check(statusPanelRows({ ...data, sessionName: "my name" }, 80, plain, bold).some((row) => /] +my name$/.test(row)), "a named session shows its name in place of the hint");

	console.log("\nAll claude-panels status checks passed.");
}
