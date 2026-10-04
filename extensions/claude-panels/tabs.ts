import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { Component, KeybindingsManager, TUI, Theme } from "@earendil-works/pi-tui";
import { MODAL_EVENT } from "../claude-bottom-input/index.ts";
import { hex, invert } from "./colors.ts";

export const TAB_BAR_TABS = ["Settings", "Status", "Config", "Usage", "Stats"] as const;
export type TabName = (typeof TAB_BAR_TABS)[number];

export function tabBarRow(tabs: readonly string[], active: string, _paint: (color: string, text: string) => string, bold: (text: string) => string): string {
	return tabs
		.map((tab, index) => {
			if (index === 0) return hex("99ccff", bold(tab));
			if (tab === active) return invert("000000", "99ccff", ` ${tab} `);
			return ` ${tab} `;
		})
		.join(" ");
}

export function paneRows(rows: string[], height: number): string[] {
	return [...rows, ...Array<string>(Math.max(0, height - rows.length)).fill("")];
}

export async function openPanel(pi: ExtensionAPI, ctx: ExtensionCommandContext, panel: (tui: TUI, theme: Theme, keybindings: KeybindingsManager, done: (result: void) => void) => Component): Promise<void> {
	pi.events.emit(MODAL_EVENT, true);
	try {
		await ctx.ui.custom<void>(panel, { overlay: true, overlayOptions: { anchor: "bottom-left", width: "100%", margin: 0 } });
	} finally {
		pi.events.emit(MODAL_EVENT, false);
	}
}

if (process.env.CLAUDE_PANELS_TABS_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain = (_color: string, text: string) => text;
	const bold = (text: string) => text;

	const row = tabBarRow(TAB_BAR_TABS, "Usage", plain, bold);
	const bare = row.replace(/\x1b\[[0-9;]*m/g, "").trimEnd();
	check(bare === "Settings  Status   Config   Usage   Stats" && tabBarRow(TAB_BAR_TABS, "Status", plain, bold).replace(/\x1b\[[0-9;]*m/g, "").trimEnd() === bare, "the five tab names appear in Claude's order with its spacing: Settings, then each tab padded by one space and joined by one more (measured on 2.1.289 m6d-panels: `   Settings  Status   Config   Usage   Stats`)");
	check(paneRows(["a"], 3).join("|") === "a||" && paneRows(["a", "b", "c"], 2).length === 3, "a card is padded with blank rows down to the pane height and never cut (Claude's Settings card owns the rest of the screen)");
	check(row.includes("\x1b[38;2;153;204;255m"), "Settings always carries Claude's accent colour, regardless of the active tab");
	check(row.includes("\x1b[1m\x1b[38;2;0;0;0m\x1b[48;2;153;204;255m Usage "), "the active tab is black-on-accent, padded with one space on each side, like Claude's highlighted chip");
	check(!tabBarRow(TAB_BAR_TABS, "Status", plain, bold).includes("\x1b[48;2;153;204;255m Usage "), "only the requested tab gets the highlighted chip");

	console.log("\nAll claude-panels tabs checks passed.");
}
