import * as os from "node:os";
import { VERSION, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Paint = (role: string, text: string) => string;
type Bold = (text: string) => string;

const FRAMES = 6;

// ponytail: Claude's header is mascot + three lines; the mascot here is a cat that blinks,
// wags its tail and drops a heart. Nothing else animates, so the transcript never repaints.
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
	let timer: ReturnType<typeof setInterval> | undefined;

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		let frame = 0;
		clearInterval(timer);
		ctx.ui.setHeader((tui, theme) => {
			timer = setInterval(() => {
				frame++;
				tui.requestRender();
			}, 700);
			return {
				render: () =>
					composeHeader(
						ctx.model?.name ?? ctx.model?.id ?? "no model",
						ctx.model?.provider ?? "",
						ctx.thinkingLevel ?? "off",
						ctx.cwd,
						frame,
						(role, text) => theme.fg(role as never, text),
						(text) => theme.bold(text),
					),
				invalidate() {},
			};
		});
	});

	pi.on("session_shutdown", () => clearInterval(timer));
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
