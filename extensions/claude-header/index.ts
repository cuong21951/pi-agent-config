import * as os from "node:os";
import { VERSION, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

type Paint = (role: string, text: string) => string;
type Bold = (text: string) => string;

const FRAMES = 6;

// ponytail: Claude's header is mascot + three lines; the mascot here is a cat.
export function catFrame(frame: number): string[] {
	const eyes = frame % FRAMES === 4 ? "-.-" : "o.o";
	const tail = ["~ ", " ~", "~ ", " ~", "~ ", " ~"][frame % FRAMES];
	const heart = frame % FRAMES === 2 ? "♥" : " ";
	return [` /\\_/\\ ${heart}`, `( ${eyes} ) `, ` > ^ < ${tail}`];
}

function homeRelative(dir: string): string {
	const home = os.homedir();
	return dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir;
}

export function composeHeader(
	model: string,
	provider: string,
	thinking: string,
	cwd: string,
	frame: number,
	fg: Paint,
	bold: Bold,
): string[] {
	const cat = catFrame(frame).map((line) => fg("warning", line));
	const effort = thinking && thinking !== "off" ? ` with ${thinking} effort` : "";
	const right = [
		`${bold("pi")} ${fg("muted", `v${VERSION}`)}`,
		fg("muted", `${model}${effort} · ${provider}`),
		fg("muted", homeRelative(cwd)),
	];
	return ["", ...cat.map((line, i) => ` ${line}   ${right[i]}`), ""];
}

export default function (pi: ExtensionAPI) {
	// ponytail: the cat used to animate on a 700 ms timer; in regular TUI mode the header lives in scrollback,
	// so every frame forced a full repaint and the screen flickered. One still frame now.
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setHeader((_tui, theme) => ({
			render: (width: number) =>
				composeHeader(
					ctx.model?.name ?? ctx.model?.id ?? "no model",
					ctx.model?.provider ?? "",
					ctx.thinkingLevel ?? "off",
					ctx.cwd,
					0,
					(role, text) => theme.fg(role as never, text),
					(text) => theme.bold(text),
				).map((line) => truncateToWidth(line, width)),
			invalidate() {},
		}));
	});
}

if (process.env.CLAUDE_HEADER_SELFTEST) {
	const plain: Paint = (_r, t) => t;
	const lines = composeHeader("GLM 5.3 Flash (multimodal)", "commandcode", "high", `${os.homedir()}/Documents/Kuha`, 0, plain, (t) => t);
	if (lines.length !== 5) throw new Error("FAIL: blank, three rows, blank");
	if (!lines[1].includes("pi v")) throw new Error("FAIL: title row");
	if (!lines[2].includes("with high effort · commandcode")) throw new Error("FAIL: model row");
	if (!lines[3].includes("~")) throw new Error("FAIL: cwd row is home-relative");
	if (catFrame(0)[2] === catFrame(1)[2]) throw new Error("FAIL: tail must wag");
	if (!catFrame(4)[1].includes("-.-")) throw new Error("FAIL: blink frame");
	console.log(lines.join("\n"));
	console.log("ok - claude layout with a cat");
}
