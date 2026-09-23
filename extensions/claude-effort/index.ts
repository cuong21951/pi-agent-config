import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

const GLYPH: Record<string, string> = {
	minimal: "○",
	low: "○",
	medium: "◐",
	high: "●",
	xhigh: "◉",
	max: "◈",
};

const UNSUPPORTED_MODELS = new Set(["claude-opus-4-0", "claude-opus-4-1", "claude-sonnet-4-0", "claude-sonnet-4-5", "claude-haiku-4-5"]);

const MARGIN = 2;

type Paint = (role: string, text: string) => string;

function bareModelId(modelId: string): string {
	const afterSlash = modelId.includes("/") ? modelId.slice(modelId.lastIndexOf("/") + 1) : modelId;
	return afterSlash.replace(/\./g, "-");
}

export function supportsEffort(modelId: string | undefined): boolean {
	if (!modelId) return true;
	const id = bareModelId(modelId);
	if (id.startsWith("claude-3-")) return false;
	return !UNSUPPORTED_MODELS.has(id);
}

// ponytail: Claude Code prints "● high · /effort" in grey, right-aligned above the prompt rules.
// /effort is registered below so the hint is true for pi too.
export function effortText(level: string, modelId?: string): string | null {
	if (!level || level === "off" || !supportsEffort(modelId)) return null;
	return `${GLYPH[level] ?? "●"} ${level} · /effort`;
}

export function effortLine(level: string, width: number, paint: Paint, modelId?: string): string | null {
	const text = effortText(level, modelId);
	if (text === null) return null;
	const pad = Math.max(0, width - text.length - MARGIN);
	return " ".repeat(pad) + paint("muted", text);
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("effort", {
		description: "Set the thinking effort (off, minimal, low, medium, high, xhigh, max)",
		handler: async (args, ctx) => {
			const wanted = args.trim().toLowerCase();
			const level = LEVELS.includes(wanted) ? wanted : ctx.hasUI ? await ctx.ui.select("Effort", LEVELS) : undefined;
			if (level) pi.setThinkingLevel(level as never);
		},
	});
}

if (process.env.CLAUDE_EFFORT_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain: Paint = (_role, text) => text;
	const line = effortLine("high", 40, plain);
	check(line !== null && line.length === 38 && line.endsWith("● high · /effort"), "right-aligned effort line, 2-column right margin");
	check(effortLine("", 20, plain) === null, "empty level hides the row");
	check(effortLine("off", 20, plain) === null, "off level hides the row");
	const narrow = effortLine("xhigh", 5, plain);
	check(narrow !== null && narrow === "◉ xhigh · /effort", "narrow width never pads negative");
	check(effortLine("minimal", 30, plain)?.includes("○ minimal · /effort") ?? false, "minimal shares the low glyph");
	check(effortLine("low", 30, plain)?.includes("○ low · /effort") ?? false, "low glyph is a hollow circle");
	check(effortLine("medium", 30, plain)?.includes("◐ medium · /effort") ?? false, "medium glyph is a half circle");
	check(effortLine("high", 30, plain)?.includes("● high · /effort") ?? false, "high glyph is a filled circle");
	check(effortLine("xhigh", 30, plain)?.includes("◉ xhigh · /effort") ?? false, "xhigh glyph is a dotted circle");
	check(effortLine("max", 30, plain)?.includes("◈ max · /effort") ?? false, "max glyph is a diamond");
	check(effortLine("high", 30, plain, "claude-haiku-4.5") === null, "effort row hidden for claude-haiku-4.5 (dotted id)");
	check(effortLine("high", 30, plain, "claude-haiku-4-5") === null, "effort row hidden for claude-haiku-4-5 (dashed id)");
	check(effortLine("high", 30, plain, "claude-opus-4-0") === null, "effort row hidden for claude-opus-4-0");
	check(effortLine("high", 30, plain, "claude-opus-4-1") === null, "effort row hidden for claude-opus-4-1");
	check(effortLine("high", 30, plain, "claude-sonnet-4-0") === null, "effort row hidden for claude-sonnet-4-0");
	check(effortLine("high", 30, plain, "claude-sonnet-4-5") === null, "effort row hidden for claude-sonnet-4-5");
	check(effortLine("high", 30, plain, "claude-3-opus-20240229") === null, "effort row hidden for claude-3-*");
	check(effortLine("high", 30, plain, "claude-opus-5") !== null, "effort row shown for opus 5");
	check(effortLine("high", 30, plain, "github-copilot/claude-opus-5") !== null, "provider prefix stripped before the model check");
	console.log("\nAll claude-effort checks passed.");
}
