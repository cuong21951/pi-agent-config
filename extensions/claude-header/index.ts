import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { VERSION, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Paint = (role: string, text: string) => string;
type Info = {
	model: string;
	provider: string;
	contextFiles: number;
	extensions: number;
	skills: number;
	promptTemplates: number;
	initialTokens: number | null;
	recent: { name: string; timeAgo: string }[];
};

const LEFT = 26;
const FRAMES = 6;

// ponytail: three moving parts (eyes blink, tail wags, a heart pops) is enough cat.
export function catFrame(frame: number): string[] {
	const eyes = frame % FRAMES === 4 ? "-.-" : "o.o";
	const tail = ["~  ", " ~ ", "  ~", " ~ ", "~  ", " ~ "][frame % FRAMES];
	const heart = frame % FRAMES === 2 ? "♥" : " ";
	return [
		`   /\\_/\\   ${heart}`,
		`  ( ${eyes} )   `,
		`   > ^ <  ${tail}`,
		`  /     \\     `,
		` (_______)    `,
	];
}

function width(text: string): number {
	return [...text.replace(/\x1b\[[0-9;]*m/g, "")].length;
}

function fit(text: string, cols: number): string {
	const w = width(text);
	return w >= cols ? [...text].slice(0, cols).join("") : text + " ".repeat(cols - w);
}

function center(text: string, cols: number): string {
	const pad = Math.max(0, Math.floor((cols - width(text)) / 2));
	return fit(" ".repeat(pad) + text, cols);
}

function tokens(n: number): string {
	return n < 1000 ? `${n}` : n < 10000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n / 1000)}k`;
}

export function composeHeader(info: Info, frame: number, termWidth: number, fg: Paint): string[] {
	if (termWidth < 44) return [];
	const boxWidth = Math.min(termWidth, Math.max(76, Math.min(termWidth - 2, 96)));
	const right = boxWidth - LEFT - 3;
	const cat = catFrame(frame).map((l) => fg("warning", l));
	const left = [
		center(fg("text", "Welcome back!"), LEFT),
		"",
		...cat.map((l) => center(l, LEFT)),
		"",
		center(fg("accent", info.model), LEFT),
		center(fg("muted", info.provider), LEFT),
	];
	const rule = fg("dim", "─".repeat(Math.min(right, 34)));
	const rightLines = [
		fg("warning", "Tips"),
		`${fg("muted", "/")} for commands`,
		`${fg("muted", "!")} to run bash`,
		`${fg("muted", "Ctrl+O")} expand tools · ${fg("muted", "PageUp/Down")} scroll`,
		rule,
		fg("warning", "Loaded"),
		fg("success", `- ${info.contextFiles} context file${info.contextFiles === 1 ? "" : "s"}`),
		fg("success", `- ${info.extensions} extensions`),
		fg("success", `- ${info.skills} skills · ${info.promptTemplates} prompts`),
		...(info.initialTokens ? [fg("success", `- ≈ ${tokens(info.initialTokens)} initial prompt tokens`)] : []),
		rule,
		fg("warning", "Recent sessions"),
		...(info.recent.length
			? info.recent.map((s) => `${fg("accent", "•")} ${fg("accent", s.name)} ${fg("muted", `(${s.timeAgo})`)}`)
			: [fg("muted", "No recent sessions")]),
	];
	const rows = Math.max(left.length, rightLines.length);
	const bar = fg("dim", "│");
	const title = fg("accent", " pi agent ");
	const top = `${fg("dim", "┌─")}${title}${fg("dim", "─".repeat(Math.max(0, LEFT - 1 - width(title))))}${fg("dim", "┬")}${fg("dim", "─".repeat(right))}${fg("dim", "┐")}`;
	const bottom = `${fg("dim", "└")}${fg("dim", "─".repeat(LEFT))}${fg("dim", "┴")}${fg("dim", "─".repeat(right))}${fg("dim", "┘")}`;
	const body = Array.from({ length: rows }, (_, i) => `${bar}${fit(left[i] ?? "", LEFT)}${bar} ${fit(rightLines[i] ?? "", right - 1)}${bar}`);
	return ["", ` pi ${VERSION}`, top, ...body, bottom, ""];
}

async function loadInfo(ctx: { model?: { name?: string; id?: string; provider?: string }; getSystemPrompt?: () => string }): Promise<Info> {
	const base: Info = {
		model: ctx.model?.name ?? ctx.model?.id ?? "No model",
		provider: ctx.model?.provider ?? "",
		contextFiles: 0,
		extensions: 0,
		skills: 0,
		promptTemplates: 0,
		initialTokens: null,
		recent: [],
	};
	const dir = path.join(process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".pi", "agent"), "npm", "node_modules", "pi-powerline-footer");
	if (!fs.existsSync(path.join(dir, "welcome.ts"))) return base;
	try {
		const welcome = await import(pathToFileURL(path.join(dir, "welcome.ts")).href);
		const usage = await import(pathToFileURL(path.join(dir, "context-usage.ts")).href);
		return { ...base, ...welcome.discoverLoadedCounts(), initialTokens: usage.estimateInitialContextTokens(ctx), recent: welcome.getRecentSessions(3) };
	} catch {
		return base;
	}
}

export default function (pi: ExtensionAPI) {
	let timer: ReturnType<typeof setInterval> | undefined;

	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		const info = await loadInfo(ctx);
		let frame = 0;
		clearInterval(timer);
		ctx.ui.setHeader((tui, theme) => {
			timer = setInterval(() => {
				frame++;
				tui.requestRender();
			}, 700);
			return {
				render: (termWidth: number) => composeHeader(info, frame, termWidth, (role, text) => theme.fg(role as never, text)),
				invalidate() {},
			};
		});
	});

	pi.on("session_shutdown", () => clearInterval(timer));
}

if (process.env.CLAUDE_HEADER_SELFTEST) {
	const info: Info = { model: "GLM 5.3 Flash", provider: "commandcode", contextFiles: 1, extensions: 16, skills: 5, promptTemplates: 6, initialTokens: 11000, recent: [{ name: "Global Computer", timeAgo: "2m ago" }] };
	const plain: Paint = (_role, text) => text;
	const lines = composeHeader(info, 0, 120, plain);
	const widths = new Set(lines.slice(2, -1).map(width));
	if (widths.size !== 1) throw new Error(`FAIL: box rows differ in width: ${[...widths]}`);
	if (catFrame(4)[1] !== catFrame(0)[1] && !catFrame(4)[1].includes("-.-")) throw new Error("FAIL: blink frame");
	if (catFrame(0)[2] === catFrame(1)[2]) throw new Error("FAIL: tail must wag");
	if (composeHeader(info, 0, 40, plain).length !== 0) throw new Error("FAIL: narrow terminal hides header");
	console.log(lines.join("\n"));
	console.log("ok - cat header is a rectangle and animates");
}
