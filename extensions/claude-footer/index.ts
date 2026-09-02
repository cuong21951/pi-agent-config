import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ANSI = /\x1b\[[0-9;]*m/g;

export type FooterFacts = {
	statuses: string[];
	model: string;
	thinking: string;
	contextPercent: number | null;
	cost: number;
	branch?: string;
};

// ponytail: Claude Code's footer is one muted line of " · " separated facts; pi has no session/week
// meters, so cost takes that slot. Extension statuses come first so the ponytail badge leads like Claude's.
export function composeFooter(f: FooterFacts): string {
	const parts = [...f.statuses, f.model];
	if (f.thinking && f.thinking !== "off") parts.push(`think ${f.thinking}`);
	parts.push(f.contextPercent === null ? "ctx ?" : `ctx ${Math.round(f.contextPercent)}%`);
	if (f.cost > 0) parts.push(`$${f.cost.toFixed(2)}`);
	if (f.branch) parts.push(f.branch);
	return parts.join(" · ");
}

export function badge(status: string): string {
	const plain = status.replace(ANSI, "").trim();
	return /ponytail/i.test(plain) ? "[PONYTAIL]" : plain;
}

function sessionCost(entries: Iterable<unknown>): number {
	let total = 0;
	for (const entry of entries as Iterable<{ message?: { usage?: { cost?: number | { total?: number } } }; usage?: { cost?: number | { total?: number } } }>) {
		const cost = entry.message?.usage?.cost ?? entry.usage?.cost;
		total += typeof cost === "number" ? cost : (cost?.total ?? 0);
	}
	return total;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setFooter((_tui, theme, footerData) => ({
			render(width: number) {
				const line = composeFooter({
					statuses: [...footerData.getExtensionStatuses().values()].map(badge),
					model: ctx.model?.name ?? ctx.model?.id ?? "no model",
					thinking: ctx.thinkingLevel ?? "off",
					contextPercent: ctx.getContextUsage()?.percent ?? null,
					cost: sessionCost(ctx.sessionManager.getEntries()),
					branch: footerData.getGitBranch() ?? undefined,
				});
				return [theme.fg("muted", line.length > width ? `${line.slice(0, Math.max(0, width - 1))}…` : line)];
			},
			invalidate() {},
		}));
	});
}

if (process.env.CLAUDE_FOOTER_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const base: FooterFacts = { statuses: ["[PONYTAIL]"], model: "GLM 5.3 Flash", thinking: "high", contextPercent: 22.4, cost: 0.284 };
	check(composeFooter(base) === "[PONYTAIL] · GLM 5.3 Flash · think high · ctx 22% · $0.28", "full line");
	check(composeFooter({ ...base, statuses: [], thinking: "off", cost: 0, contextPercent: null }) === "GLM 5.3 Flash · ctx ?", "minimal line");
	check(composeFooter({ ...base, branch: "master" }).endsWith(" · master"), "branch last");
	check(badge("\x1b[32m● ponytail: ⚡ FULL\x1b[0m") === "[PONYTAIL]", "ponytail status becomes the badge");
	check(badge("\x1b[2mMCP: 3 connected\x1b[0m") === "MCP: 3 connected", "other statuses lose colour only");
	check(sessionCost([{ message: { usage: { cost: { total: 0.1 } } } }, { usage: { cost: 0.2 } }, {}]) === 0.30000000000000004, "cost sums both shapes");
}
