import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const VERBS = [
	"Accomplishing", "Actualizing", "Baking", "Brewing", "Calculating", "Cerebrating", "Churning", "Coalescing",
	"Cogitating", "Computing", "Conjuring", "Considering", "Cooking", "Crafting", "Crunching", "Deliberating",
	"Determining", "Finagling", "Forging", "Generating", "Hatching", "Herding", "Honking", "Hustling", "Ideating",
	"Inferring", "Manifesting", "Marinating", "Moseying", "Mulling", "Mustering", "Musing", "Noodling",
	"Percolating", "Pondering", "Processing", "Puttering", "Reticulating", "Ruminating", "Schlepping", "Shimmying",
	"Simmering", "Smooshing", "Spinning", "Stewing", "Swirling", "Synthesizing", "Thinking", "Tinkering",
	"Transmuting", "Vibing", "Wibbling", "Working", "Wrangling",
];

// ponytail: Claude's set also has ✳ (U+2733), but Windows Terminal draws that one as a green emoji box.
const SPARKLE = ["·", "✢", "✶", "✻", "✽", "✻", "✶", "✢"];
const ORANGE = "\x1b[38;2;217;119;87m";
const GLOW = "\x1b[38;2;252;236;222m";
const RESET_FG = "\x1b[39m";
const SHIMMER_WIDTH = 3;
const FRAME_MS = 100;

export function elapsed(ms: number): string {
	const s = Math.floor(ms / 1000);
	return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function tokens(n: number): string {
	return n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`;
}

export function detail(output: number, thinking: string | undefined): string {
	if (output > 0) return `↓ ${tokens(output)} tokens`;
	return thinking && thinking !== "off" ? `thinking with ${thinking} effort` : "thinking";
}

export function shimmer(text: string, frame: number): string {
	const chars = Array.from(text);
	const start = (frame % (chars.length + SHIMMER_WIDTH)) - SHIMMER_WIDTH;
	let out = "";
	for (let i = 0; i < chars.length; i++) {
		const lit = i >= start && i < start + SHIMMER_WIDTH;
		out += (lit ? GLOW : ORANGE) + chars[i];
	}
	return out + RESET_FG;
}

function pickVerb(previous: string): string {
	let verb = previous;
	while (verb === previous) verb = VERBS[Math.floor(Math.random() * VERBS.length)];
	return verb;
}

export default function (pi: ExtensionAPI) {
	let started = 0;
	let output = 0;
	let verb = "";
	let frame = 0;
	let timer: ReturnType<typeof setInterval> | undefined;

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setWorkingIndicator({
			frames: SPARKLE.map((glyph) => ctx.ui.theme.fg("warning", glyph)),
			intervalMs: 120,
		});
	});

	pi.on("agent_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		started = Date.now();
		output = 0;
		frame = 0;
		verb = pickVerb(verb);
		clearInterval(timer);
		const paint = () => {
			const timing = `(${elapsed(Date.now() - started)} · ${detail(output, ctx.thinkingLevel)} · esc to interrupt)`;
			ctx.ui.setWorkingMessage(`${shimmer(`${verb}…`, frame++)} ${ctx.ui.theme.fg("dim", timing)}`);
		};
		paint();
		timer = setInterval(paint, FRAME_MS);
	});

	pi.on("message_end", (event) => {
		if (event.message.role === "assistant") output += event.message.usage?.output ?? 0;
	});

	pi.on("agent_end", (_event, ctx) => {
		clearInterval(timer);
		timer = undefined;
		if (ctx.hasUI) ctx.ui.setWorkingMessage();
	});
}

if (process.env.CLAUDE_WORKING_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const visible = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
	check(elapsed(4000) === "4s", "seconds only");
	check(elapsed(289000) === "4m 49s", "minutes and seconds");
	check(elapsed(65000) === "1m 5s", "no zero padding, like Claude Code");
	check(tokens(950) === "950", "small token count");
	check(tokens(14500) === "14.5k", "thousands");
	check(detail(0, "high") === "thinking with high effort", "effort shown before first tokens");
	check(detail(0, "off") === "thinking", "no effort label when thinking is off");
	check(detail(213, "high") === "↓ 213 tokens", "tokens once output flows");
	check(pickVerb("Swirling") !== "Swirling", "verb changes between turns");
	check(visible(shimmer("Percolating…", 5)) === "Percolating…", "shimmer keeps the text");
	check(shimmer("abc", 0) !== shimmer("abc", 1), "shimmer moves between frames");
	check(shimmer("abc", 0) === shimmer("abc", 6), "shimmer wraps around");
	check(SPARKLE.every((g) => Array.from(g).length === 1), "sparkle glyphs are one cell");
}
