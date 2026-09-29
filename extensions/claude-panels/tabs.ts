import { hex, invert } from "./colors.ts";

export const TAB_BAR_TABS = ["Settings", "Status", "Config", "Usage", "Stats"] as const;
export type TabName = (typeof TAB_BAR_TABS)[number];

export function tabBarRow(tabs: readonly string[], active: string, _paint: (color: string, text: string) => string, bold: (text: string) => string): string {
	return tabs
		.map((tab, index) => {
			if (index === 0) return hex("99ccff", bold(tab));
			if (tab === active) return invert("000000", "99ccff", ` ${tab} `);
			return tab;
		})
		.join("  ");
}

if (process.env.CLAUDE_PANELS_TABS_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain = (_color: string, text: string) => text;
	const bold = (text: string) => text;

	const row = tabBarRow(TAB_BAR_TABS, "Usage", plain, bold);
	const bare = row.replace(/\x1b\[[0-9;]*m/g, "");
	check(bare === "Settings  Status  Config   Usage   Stats", "the five tab names appear in Claude's order, the active one padded by its own highlight chip");
	check(row.includes("\x1b[38;2;153;204;255m"), "Settings always carries Claude's accent colour, regardless of the active tab");
	check(row.includes("\x1b[1m\x1b[38;2;0;0;0m\x1b[48;2;153;204;255m Usage "), "the active tab is black-on-accent, padded with one space on each side, like Claude's highlighted chip");
	check(!tabBarRow(TAB_BAR_TABS, "Status", plain, bold).includes("\x1b[48;2;153;204;255m Usage "), "only the requested tab gets the highlighted chip");

	console.log("\nAll claude-panels tabs checks passed.");
}
