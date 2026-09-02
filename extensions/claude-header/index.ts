import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { VERSION, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const LOGO = [" ▄▄▄ ", "█   █", "█▀▀▀▀", "█    ", "█    "];

function homeRelative(dir: string): string {
	const home = os.homedir();
	return dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir;
}

export function headerLines(model: string, provider: string, cwd: string): string[] {
	const right = [
		`pi ${VERSION}`,
		`${model} · ${provider}`,
		homeRelative(cwd),
		"/ commands · ! bash · Ctrl+O expand tools",
		"PageUp/PageDown scroll · Ctrl+F search · Ctrl+P model",
	];
	return LOGO.map((glyph, i) => `${glyph}  ${right[i] ?? ""}`);
}

export function powerlineDir(agentDir: string): string | undefined {
	const candidate = path.join(agentDir, "npm", "node_modules", "pi-powerline-footer");
	return fs.existsSync(path.join(candidate, "welcome.ts")) ? candidate : undefined;
}

// ponytail: powerline's own welcome header is richer (logo, tips, loaded counts, recent
// sessions) but powerline removes it on the first keystroke; we mount the same component
// ourselves and never remove it. Falls back to a plain header when powerline is absent.
async function powerlineHeader(ctx: { model?: { name?: string; id?: string; provider?: string }; getSystemPrompt?: () => string }) {
	const dir = powerlineDir(process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".pi", "agent"));
	if (!dir) return undefined;
	const welcome = await import(pathToFileURL(path.join(dir, "welcome.ts")).href);
	const usage = await import(pathToFileURL(path.join(dir, "context-usage.ts")).href);
	return new welcome.WelcomeHeader(
		ctx.model?.name ?? ctx.model?.id ?? "No model",
		ctx.model?.provider ?? "Unknown",
		welcome.getRecentSessions(3),
		welcome.discoverLoadedCounts(),
		usage.estimateInitialContextTokens(ctx),
	);
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		let rich: { render(width: number): string[]; invalidate(): void } | undefined;
		try {
			rich = await powerlineHeader(ctx);
		} catch {
			rich = undefined;
		}
		ctx.ui.setHeader((_tui, theme) => ({
			render(width: number): string[] {
				if (rich) return rich.render(width);
				const lines = headerLines(ctx.model?.name ?? ctx.model?.id ?? "no model", ctx.model?.provider ?? "", ctx.cwd);
				return [
					"",
					...lines.map((line, i) =>
						i === 0
							? `${theme.fg("warning", theme.bold(line.slice(0, 5)))}  ${theme.fg("text", theme.bold(line.slice(7)))}`
							: `${theme.fg("warning", line.slice(0, 5))}  ${theme.fg(i >= 3 ? "dim" : "muted", line.slice(7))}`,
					),
					"",
				];
			},
			invalidate() {
				rich?.invalidate();
			},
		}));
	});
}

if (process.env.CLAUDE_HEADER_SELFTEST) {
	const lines = headerLines("GLM 5.3 Flash", "commandcode", path.join(os.homedir(), "Documents", "Kuha"));
	if (lines.length !== 5) throw new Error("FAIL: five header rows");
	if (!lines[2].includes("~")) throw new Error("FAIL: home-relative cwd");
	if (powerlineDir(path.join(os.homedir(), ".pi", "agent")) === undefined) throw new Error("FAIL: powerline dir not found here");
	if (powerlineDir("C:/nope") !== undefined) throw new Error("FAIL: missing powerline must return undefined");
	console.log("ok - fallback header and powerline lookup");
}
