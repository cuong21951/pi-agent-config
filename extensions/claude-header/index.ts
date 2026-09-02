import * as os from "node:os";
import * as path from "node:path";
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

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setHeader((_tui, theme) => ({
			render(): string[] {
				const lines = headerLines(
					ctx.model?.name ?? ctx.model?.id ?? "no model",
					ctx.model?.provider ?? "",
					ctx.cwd,
				);
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
			invalidate() {},
		}));
	});
}

if (process.env.CLAUDE_HEADER_SELFTEST) {
	const lines = headerLines("GLM 5.3 Flash", "commandcode", path.join(os.homedir(), "Documents", "Kuha"));
	if (lines.length !== 5) throw new Error("FAIL: five header rows");
	if (!lines[1].includes("GLM 5.3 Flash · commandcode")) throw new Error("FAIL: model row");
	if (!lines[2].includes("~")) throw new Error("FAIL: home-relative cwd");
	console.log(lines.join("\n"));
	console.log("ok - header renders");
}
