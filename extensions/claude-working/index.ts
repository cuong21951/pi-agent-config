import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { effortLine, effortText, supportsEffort } from "../claude-effort/index.ts";
import { dynamic, isAbort } from "../claude-tools/rows.ts";

// ponytail: the 186 verbs of Claude Code 2.1.261, lifted from its bundle (Clauding included).
const VERBS = [
	"Accomplishing", "Actioning", "Actualizing", "Architecting", "Baking", "Beaming", "Beboppin'", "Befuddling",
	"Billowing", "Blanching", "Bloviating", "Boogieing", "Boondoggling", "Booping", "Bootstrapping", "Brewing",
	"Bunning", "Burrowing", "Calculating", "Canoodling", "Caramelizing", "Cascading", "Catapulting", "Cerebrating",
	"Channeling", "Channelling", "Choreographing", "Churning", "Clauding", "Coalescing", "Cogitating", "Combobulating",
	"Composing", "Computing", "Concocting", "Considering", "Contemplating", "Cooking", "Crafting", "Creating",
	"Crunching", "Crystallizing", "Cultivating", "Deciphering", "Deliberating", "Determining", "Dilly-dallying",
	"Discombobulating", "Doing", "Doodling", "Drizzling", "Ebbing", "Effecting", "Elucidating", "Embellishing",
	"Enchanting", "Envisioning", "Fermenting", "Fiddle-faddling", "Finagling", "Flambéing", "Flibbertigibbeting",
	"Flowing", "Flummoxing", "Fluttering", "Forging", "Forming", "Frolicking", "Frosting", "Gallivanting", "Galloping",
	"Garnishing", "Generating", "Gesticulating", "Germinating", "Gitifying", "Grooving", "Gusting", "Harmonizing",
	"Hashing", "Hatching", "Herding", "Honking", "Hullaballooing", "Hyperspacing", "Ideating", "Imagining",
	"Improvising", "Incubating", "Inferring", "Infusing", "Ionizing", "Jitterbugging", "Julienning", "Kneading",
	"Leavening", "Levitating", "Lollygagging", "Manifesting", "Marinating", "Meandering", "Metamorphosing", "Misting",
	"Moonwalking", "Moseying", "Mulling", "Mustering", "Musing", "Nebulizing", "Nesting", "Newspapering", "Noodling",
	"Nucleating", "Orbiting", "Orchestrating", "Osmosing", "Perambulating", "Percolating", "Perusing", "Philosophising",
	"Photosynthesizing", "Pollinating", "Pondering", "Pontificating", "Pouncing", "Precipitating", "Prestidigitating",
	"Processing", "Proofing", "Propagating", "Puttering", "Puzzling", "Quantumizing", "Razzle-dazzling",
	"Razzmatazzing", "Recombobulating", "Reticulating", "Roosting", "Ruminating", "Sautéing", "Scampering",
	"Schlepping", "Scurrying", "Seasoning", "Shenaniganing", "Shimmying", "Simmering", "Skedaddling", "Sketching",
	"Slithering", "Smooshing", "Sock-hopping", "Spelunking", "Spinning", "Sprouting", "Stewing", "Sublimating",
	"Swirling", "Swooping", "Symbioting", "Synthesizing", "Tempering", "Thinking", "Thundering", "Tinkering",
	"Tomfoolering", "Topsy-turvying", "Transfiguring", "Transmuting", "Twisting", "Undulating", "Unfurling",
	"Unravelling", "Vibing", "Waddling", "Wandering", "Warping", "Whatchamacalliting", "Whirlpooling", "Whirring",
	"Whisking", "Wibbling", "Working", "Wrangling", "Zesting", "Zigzagging",
];

// ponytail: constants below are lifted from Claude Code's spinner (dark theme). Claude itself uses "*"
// instead of ✳ on every terminal but ghostty, so the frame table is verbatim.
const HALF = ["·", "✢", "*", "✶", "✻", "✽"];
const FRAMES = [...HALF, ...HALF.slice().reverse()];
const FRAME_PERIOD_MS = 2000;
const TICK_MS = 100;
const GLIMMER_STEP_MS = 200;
const GLIMMER_WIDTH = 3;
const STALL_AFTER_MS = 10_000;
const STALL_RAMP_MS = 10_000;
const TIMER_ALWAYS_AFTER_MS = 16_000;
const THOUGHT_FOR_MS = 2000;
const EFFORT_NOTICE_MS = 10_000;

type Rgb = { r: number; g: number; b: number };
// ponytail: dark-daltonized values read out of the 2.1.261 bundle (an on-screen capture had quantised
// these to the 256-colour cube): claude ff9933, claudeShimmer ffb765, warning ffcc00, error ff6666.
const CLAUDE: Rgb = { r: 255, g: 153, b: 51 };
const CLAUDE_SHIMMER: Rgb = { r: 255, g: 183, b: 101 };
const WARNING: Rgb = { r: 255, g: 204, b: 0 };
const STALL_RED: Rgb = { r: 255, g: 102, b: 102 };
const GREY: Rgb = { r: 153, g: 153, b: 153 };
const GREY_BRIGHT: Rgb = { r: 185, g: 185, b: 185 };
const STATUS_GREY: Rgb = { r: 153, g: 153, b: 153 };

export type Mode = "requesting" | "thinking" | "text" | "tool-use";

export type StatusKind = "thinking" | "thought-for" | "none";

export interface SpinnerState {
	elapsedMs: number;
	mode: Mode;
	sinceTokenMs: number;
	thinkingMs: number;
	thinkingIntensity: number;
	thoughtForMs: number | null;
	statusKind: StatusKind;
	tokens: number;
	effort: string;
}

export function easeCos(t: number, period: number): number {
	return (1 - Math.cos((2 * Math.PI * t) / period)) / 2;
}

export function quantize(x: number): number {
	return Math.round(Math.min(1, Math.max(0, x)) * 8) / 8;
}

export function lerp(a: Rgb, b: Rgb, n: number): Rgb {
	return { r: Math.round(a.r + (b.r - a.r) * n), g: Math.round(a.g + (b.g - a.g) * n), b: Math.round(a.b + (b.b - a.b) * n) };
}

const fg = (c: Rgb) => `\x1b[38;2;${c.r};${c.g};${c.b}m`;
const RESET_FG = "\x1b[39m";
const BOLD = "\x1b[1m";
const UNBOLD = "\x1b[22m";

export function frameIndex(elapsedMs: number): number {
	return Math.round(easeCos(elapsedMs, FRAME_PERIOD_MS) * (FRAMES.length - 1));
}

export function stalledIntensity(sinceTokenMs: number): number {
	return quantize((sinceTokenMs - STALL_AFTER_MS) / STALL_RAMP_MS);
}

export function toneColor(base: Rgb, s: SpinnerState): { color: Rgb; bold: boolean } {
	const stalled = stalledIntensity(s.sinceTokenMs);
	if (stalled > 0) return { color: lerp(base, STALL_RED, stalled), bold: false };
	if (s.thinkingIntensity > 0) return { color: lerp(base, WARNING, quantize(s.thinkingIntensity)), bold: s.thinkingIntensity >= 0.5 };
	return { color: base, bold: false };
}

export function glyph(s: SpinnerState): string {
	const { color, bold } = toneColor(CLAUDE, s);
	const char = FRAMES[frameIndex(s.elapsedMs)];
	return `${bold ? BOLD : ""}${fg(color)}${char}${RESET_FG}${bold ? UNBOLD : ""}`;
}

export function glimmerIndex(elapsedMs: number, width: number, mode: Mode): number {
	const step = Math.floor(elapsedMs / (mode === "requesting" ? 50 : GLIMMER_STEP_MS));
	const cycle = width + 20;
	return mode === "requesting" ? (step % cycle) - 10 : width + 10 - (step % cycle);
}

export function message(text: string, s: SpinnerState): string {
	const tone = toneColor(CLAUDE, s);
	if (tone.color !== CLAUDE) return `${tone.bold ? BOLD : ""}${fg(tone.color)}${text}${RESET_FG}${tone.bold ? UNBOLD : ""}`;
	if (s.mode === "tool-use") {
		const flash = quantize((Math.sin((s.elapsedMs / 1000) * Math.PI) + 1) / 2);
		return `${fg(lerp(CLAUDE, CLAUDE_SHIMMER, flash))}${text}${RESET_FG}`;
	}
	const chars = Array.from(text);
	const centre = glimmerIndex(s.elapsedMs, chars.length, s.mode);
	const lo = centre - (GLIMMER_WIDTH - 1) / 2;
	const hi = centre + (GLIMMER_WIDTH - 1) / 2;
	let out = "";
	for (let i = 0; i < chars.length; i++) out += fg(i >= lo && i <= hi ? CLAUDE_SHIMMER : CLAUDE) + chars[i];
	return out + RESET_FG;
}

export function thinkingPhase(thinkingMs: number): string {
	if (thinkingMs >= 45_000) return "deep in thought";
	if (thinkingMs >= 30_000) return "thinking some more";
	if (thinkingMs >= 20_000) return "thinking more";
	if (thinkingMs >= 10_000) return "still thinking";
	return "thinking";
}

export function thinkingColor(elapsedMs: number, intensity: number): Rgb {
	const pulse = elapsedMs < 3000 ? 0 : (Math.sin(((elapsedMs - 3000) / 1000) * Math.PI) + 1) / 2;
	const grey = lerp(GREY, GREY_BRIGHT, quantize(pulse));
	return intensity > 0 ? lerp(grey, WARNING, quantize(intensity)) : grey;
}

export function elapsed(ms: number): string {
	if (ms < 60_000) return ms === 0 ? "0s" : `${Math.floor(ms / 1000)}s`;
	let d = Math.floor(ms / 86_400_000);
	let h = Math.floor((ms % 86_400_000) / 3_600_000);
	let m = Math.floor((ms % 3_600_000) / 60_000);
	let s = Math.round((ms % 60_000) / 1000);
	if (s === 60) { s = 0; m++; }
	if (m === 60) { m = 0; h++; }
	if (h === 24) { h = 0; d++; }
	if (d > 0) return `${d}d ${h}h ${m}m`;
	if (h > 0) return `${h}h ${m}m ${s}s`;
	if (m > 0) return `${m}m ${s}s`;
	return `${s}s`;
}

export function tokens(n: number): string {
	return n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`;
}

export function thoughtForWindow(thinkingMs: number): { showAfterMs: number; hideAfterMs: number } {
	const showAfterMs = Math.max(0, THOUGHT_FOR_MS - thinkingMs);
	return { showAfterMs, hideAfterMs: showAfterMs + THOUGHT_FOR_MS };
}

export function thinkingIntensityTarget(thinkingMs: number, isThinking: boolean, hasActiveTools: boolean): number {
	if (!isThinking || hasActiveTools) return 0;
	return Math.min(Math.max((thinkingMs - 10_000) / 10_000, 0), 1);
}

export function statusText(s: SpinnerState): string {
	const parts: string[] = [];
	if (s.statusKind !== "none" || s.tokens > 0 || s.elapsedMs > TIMER_ALWAYS_AFTER_MS) parts.push(elapsed(s.elapsedMs));
	if (s.tokens > 0) parts.push(`↓ ${tokens(s.tokens)} tokens`);
	if (s.statusKind === "thinking") {
		const suffix = s.effort && s.effort !== "off" ? ` with ${s.effort} effort` : "";
		parts.push(`${fg(thinkingColor(s.elapsedMs, s.thinkingIntensity))}${thinkingPhase(s.thinkingMs)}${suffix}${RESET_FG}`);
	} else if (s.statusKind === "thought-for") {
		parts.push(`thought for ${Math.max(1, Math.round((s.thoughtForMs ?? 0) / 1000))}s`);
	}
	if (parts.length === 0) return "";
	return `${fg(STATUS_GREY)}(${parts.join(" · ")})${RESET_FG}`;
}

const PAST: Record<string, string> = { Thinking: "Thought", Spinning: "Spun", Doing: "Did" };

// ponytail: Claude ends a turn with "✻ Churned for 13s · done 12:58 AM" in grey; the verb is the spinner's.
export function pastTense(verb: string): string {
	return PAST[verb] ?? verb.replace(/ying$/, "ied").replace(/ing$/, "ed");
}

function calendarDaysAgo(at: Date, now: Date): number {
	const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	return Math.round((midnight(now) - midnight(at)) / 86_400_000);
}

export function doneWhen(at: Date, now: Date): string {
	const time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
	const days = calendarDaysAgo(at, now);
	if (days === 0) return time;
	if (days >= 1 && days <= 6) return `${at.toLocaleDateString("en-US", { weekday: "long" })} ${time}`;
	return `${new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(at)}, ${time}`;
}

export function doneLine(verb: string, ms: number, at: Date, now: Date = new Date()): string {
	return `${fg(STATUS_GREY)}✻ ${pastTense(verb)} for ${elapsed(ms)} · done ${doneWhen(at, now)}${RESET_FG}`;
}

export function waitingLine(n: number): string {
	return `${fg(STATUS_GREY)}✻ Waiting for ${BOLD}${n}${UNBOLD} background ${n === 1 ? "agent" : "agents"} to finish${RESET_FG}`;
}

export function backgroundAgentCount(): number {
	const registry = (globalThis as Record<symbol, unknown>)[Symbol.for("pi-subagents:manager")] as { backgroundRunningCount?: () => number } | undefined;
	return typeof registry?.backgroundRunningCount === "function" ? registry.backgroundRunningCount() : 0;
}

export type Retry = { attempt: number; maxAttempts: number; deadline: number; errorMessage: string };

export function retryLine(retry: Retry, now: number, width: number): string {
	const wait = elapsed(Math.max(0, Math.ceil((retry.deadline - now) / 1000)) * 1000);
	const tail = ` · Retrying in ${wait} · attempt ${retry.attempt}/${retry.maxAttempts}`;
	const room = Math.max(10, width - 2 - tail.length - 2);
	const label = retry.attempt < Math.min(3, retry.maxAttempts) ? "API error" : retry.errorMessage.length > room ? `${retry.errorMessage.slice(0, room - 1)}…` : retry.errorMessage;
	return `${fg(STALL_RED)}✻ ${label}${RESET_FG}${fg(STATUS_GREY)}${tail}${RESET_FG}`;
}

export function bottomRows(top: string | null, notice: string | null, dialogOpen: boolean): string[] {
	if (dialogOpen) return [];
	return [...(top === null ? [] : [top]), ...(notice !== null ? [notice] : top !== null ? [""] : [])];
}

export function line(verb: string, s: SpinnerState): string {
	const status = statusText(s);
	return status === "" ? `${glyph(s)} ${message(`${verb}…`, s)}` : `${glyph(s)} ${message(`${verb}…`, s)} ${status}`;
}

function pickVerb(previous: string): string {
	let verb = previous;
	while (verb === previous) verb = VERBS[Math.floor(Math.random() * VERBS.length)];
	return verb;
}

type Message = { role?: string; stopReason?: string; errorMessage?: string; content?: Array<{ type: string; text?: string }> };

// ponytail: Claude prints no "✻ … · done" line after an interrupt (measured 2026-09-05).
export function interrupted(messages: Message[] = []): boolean {
	return messages.some((m) => m.stopReason === "aborted" || isAbort(m.errorMessage) || (m.role === "toolResult" && (m.content ?? []).some((c) => c.type === "text" && isAbort(c.text))));
}

export default function claudeWorking(pi: ExtensionAPI) {
	let verb = "";
	let started = 0;
	let lastTokenAt = 0;
	let mode: Mode = "requesting";
	let thinkingStart: number | null = null;
	let thinkingStatus: "thinking" | number | null = null;
	let pendingThoughtMs = 0;
	let thoughtShowAt = 0;
	let thoughtHideAt = 0;
	let thinkingIntensity = 0;
	let finishedTokens = 0;
	let streamedChars = 0;
	let activeTools = 0;
	let timer: ReturnType<typeof setInterval> | undefined;
	let settled = true;
	let lastRun: Message[] = [];

	const state = (now: number): SpinnerState => ({
		elapsedMs: now - started,
		mode,
		sinceTokenMs: activeTools > 0 ? 0 : now - lastTokenAt,
		thinkingMs: thinkingStart === null ? 0 : now - thinkingStart,
		thinkingIntensity,
		thoughtForMs: typeof thinkingStatus === "number" ? thinkingStatus : null,
		statusKind: thinkingStatus === "thinking" ? "thinking" : typeof thinkingStatus === "number" ? "thought-for" : "none",
		tokens: finishedTokens + Math.round(streamedChars / 4),
		effort: "",
	});

	// ponytail: Claude keeps the working line pinned directly above the prompt; pi's own working message
	// lands in the status container, which sits ABOVE claude-bottom-input's pad, so it floated with the
	// transcript and left a hole between it and the prompt. Rendering it as a widget puts it after the
	// pad instead, on the row above the editor. pi's own message is blanked rather than left to draw.
	let current = "";
	let retry: Retry | null = null;
	let retryTimer: ReturnType<typeof setInterval> | undefined;
	let requestRender = () => {};
	const stopRetry = () => {
		clearInterval(retryTimer);
		retryTimer = undefined;
		retry = null;
	};
	(globalThis as any).__claudeRetry = {
		start(event: { attempt: number; maxAttempts: number; delayMs: number; errorMessage?: string }) {
			stopRetry();
			retry = { attempt: event.attempt, maxAttempts: event.maxAttempts, deadline: Date.now() + event.delayMs, errorMessage: event.errorMessage ?? "Unknown error" };
			retryTimer = setInterval(() => requestRender(), TICK_MS);
		},
		end: stopRetry,
	};
	let dialogOpen = false;
	let effortShown: string | null = null;
	let effortUntil = 0;
	const noteEffort = (level: string, modelId: string | undefined) => {
		const text = effortText(level, modelId);
		if (text === effortShown) return;
		effortShown = text;
		effortUntil = text === null ? 0 : Date.now() + EFFORT_NOTICE_MS;
		requestRender();
		if (text !== null) setTimeout(() => requestRender(), EFFORT_NOTICE_MS).unref?.();
	};
	pi.on("thinking_level_select", (event, ctx) => noteEffort(event.level, ctx.model?.id));
	pi.on("model_select", (event, ctx) => noteEffort(ctx.thinkingLevel ?? "off", event.model?.id));
	pi.on("ui_prompt_start", (event, ctx) => {
		if (event.kind !== "custom") return;
		dialogOpen = true;
		if (ctx.hasUI) ctx.ui.setWorkingVisible(false);
	});
	pi.on("ui_prompt_end", (event, ctx) => {
		if (event.kind !== "custom") return;
		dialogOpen = false;
		if (ctx.hasUI) ctx.ui.setWorkingVisible(true);
	});
	pi.on("session_start", (_event, ctx) => {
		effortShown = effortText(ctx.thinkingLevel ?? "off", ctx.model?.id);
		effortUntil = 0;
		if (!ctx.hasUI) return;
		ctx.ui.setWorkingIndicator({ frames: [""], intervalMs: TICK_MS });
		ctx.ui.setWorkingMessage("");
		ctx.ui.setWidget("claude-working", (tui, theme) => {
			requestRender = () => tui.requestRender();
			return {
				render: (width: number) => {
					const top = retry ? retryLine(retry, Date.now(), width) : current === "" ? null : current;
					const effort = Date.now() < effortUntil ? effortLine(ctx.thinkingLevel ?? "off", width, (role, text) => theme.fg(role as never, text), ctx.model?.id) : null;
					return bottomRows(top, effort, dialogOpen);
				},
				invalidate() {},
			};
		});
	});

	pi.on("agent_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		if (settled) {
			verb = pickVerb(verb);
			started = Date.now();
			finishedTokens = 0;
		}
		settled = false;
		stopRetry();
		lastTokenAt = Date.now();
		mode = "requesting";
		thinkingStart = null;
		thinkingStatus = null;
		thoughtShowAt = 0;
		thoughtHideAt = 0;
		thinkingIntensity = 0;
		streamedChars = 0;
		activeTools = 0;
		clearInterval(timer);
		const paint = () => {
			const now = Date.now();
			if (thinkingStatus === "thinking" && thinkingStart === null && now >= thoughtShowAt) thinkingStatus = pendingThoughtMs;
			if (typeof thinkingStatus === "number" && now >= thoughtHideAt) thinkingStatus = null;
			const thinkingMs = thinkingStart === null ? 0 : now - thinkingStart;
			const target = thinkingIntensityTarget(thinkingMs, mode === "thinking", activeTools > 0);
			thinkingIntensity += (target - thinkingIntensity) * 0.2;
			if (Math.abs(target - thinkingIntensity) < 0.02) thinkingIntensity = target;
			const effort = supportsEffort(ctx.model?.id) ? (ctx.thinkingLevel ?? "") : "";
			current = line(verb, { ...state(now), effort });
		};
		paint();
		timer = setInterval(paint, TICK_MS);
	});

	pi.on("message_update", (event) => {
		const kind = event.assistantMessageEvent.type;
		const now = Date.now();
		lastTokenAt = now;
		if (kind === "thinking_start" || kind === "thinking_delta") {
			if (thinkingStart === null) {
				thinkingStart = now;
				thinkingStatus = "thinking";
				thoughtShowAt = 0;
				thoughtHideAt = 0;
			}
			mode = "thinking";
		} else if (kind === "text_start" || kind === "text_delta" || kind.startsWith("toolcall")) {
			if (thinkingStart !== null) {
				pendingThoughtMs = now - thinkingStart;
				const window = thoughtForWindow(pendingThoughtMs);
				thoughtShowAt = now + window.showAfterMs;
				thoughtHideAt = now + window.hideAfterMs;
				thinkingStart = null;
			}
			mode = "text";
		}
		if (kind === "text_delta" || kind === "thinking_delta") streamedChars += event.assistantMessageEvent.delta.length;
	});

	pi.on("message_end", (event) => {
		if (event.message.role !== "assistant") return;
		finishedTokens += event.message.usage?.output ?? Math.round(streamedChars / 4);
		streamedChars = 0;
	});

	pi.on("tool_execution_start", () => {
		activeTools++;
		mode = "tool-use";
	});

	pi.on("tool_execution_end", () => {
		activeTools = Math.max(0, activeTools - 1);
		if (activeTools === 0) {
			mode = "requesting";
			lastTokenAt = Date.now();
		}
	});

	pi.registerEntryRenderer("claude-working-done", (entry, _options, theme) => {
		const data = entry.data as { verb: string; ms: number; at: number };
		return dynamic(() => [doneLine(data.verb, data.ms, new Date(data.at))]);
	});

	pi.registerEntryRenderer("claude-working-waiting", (entry, _options, theme) => {
		const data = entry.data as { n: number };
		return dynamic(() => [waitingLine(data.n)]);
	});

	pi.on("agent_end", (event, ctx) => {
		clearInterval(timer);
		timer = undefined;
		lastRun = (event as { messages?: Message[] }).messages ?? [];
		if (!ctx.hasUI) return;
		current = "";
		ctx.ui.setWorkingMessage("");
	});

	pi.on("agent_settled", (_event, ctx) => {
		if (settled) return;
		if (ctx.hasUI && !interrupted(lastRun)) {
			const waiting = backgroundAgentCount();
			if (waiting > 0) {
				pi.appendEntry("claude-working-waiting", { n: waiting });
				return;
			}
		}
		settled = true;
		if (!ctx.hasUI || interrupted(lastRun)) return;
		pi.appendEntry("claude-working-done", { verb, ms: Date.now() - started, at: Date.now() });
	});
}

if (process.env.CLAUDE_WORKING_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const visible = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
	const base: SpinnerState = { elapsedMs: 0, mode: "text", sinceTokenMs: 0, thinkingMs: 0, thinkingIntensity: 0, thoughtForMs: null, statusKind: "none", tokens: 0, effort: "high" };
	check(FRAMES.length === 12 && FRAMES[2] === "*", "Claude frame table: ✳ replaced by * like Claude does off ghostty");
	check(frameIndex(0) === 0 && frameIndex(1000) === 11 && frameIndex(2000) === 0, "cosine ping-pong over 2 s");
	check(stalledIntensity(5000) === 0 && stalledIntensity(15000) === 0.5 && stalledIntensity(30000) === 1, "stall ramps from 10 s to 20 s");
	check(toneColor(CLAUDE, { ...base, sinceTokenMs: 30000 }).color.r === STALL_RED.r, "fully stalled turns red");
	check(toneColor(CLAUDE, { ...base, thinkingIntensity: 1 }).bold === true, "thinking bursts go bold and warm");
	check(visible(message("Vibing…", base)) === "Vibing…", "glimmer keeps the text");
	check(message("Vibing…", base) === message("Vibing…", { ...base, elapsedMs: 200 }), "glimmer starts off the right edge, like Claude");
	check(message("Vibing…", { ...base, elapsedMs: 2200 }) !== message("Vibing…", { ...base, elapsedMs: 2400 }), "glimmer moves every 200 ms once inside the word");
	check(glimmerIndex(0, 7, "text") === 17 && glimmerIndex(200, 7, "text") === 16, "glimmer sweeps right to left");
	check(glimmerIndex(0, 7, "requesting") === -10 && glimmerIndex(50, 7, "requesting") === -9, "requesting sweeps left to right, faster");
	check(message("Vibing…", { ...base, mode: "tool-use", elapsedMs: 500 }).includes(`${CLAUDE_SHIMMER.r};${CLAUDE_SHIMMER.g};${CLAUDE_SHIMMER.b}`), "tool-use flashes the whole word to the shimmer colour at the sine peak");
	check(thinkingPhase(0) === "thinking" && thinkingPhase(10_000) === "still thinking" && thinkingPhase(20_000) === "thinking more" && thinkingPhase(30_000) === "thinking some more" && thinkingPhase(45_000) === "deep in thought", "thinking phases at 10/20/30/45 s, Claude 2.1.280 wording ('deep in thought', not 'almost done thinking')");
	check(visible(statusText({ ...base, statusKind: "thinking", mode: "thinking", thinkingMs: 46_000, elapsedMs: 50_000, tokens: 46_500 })) === "(50s · ↓ 46.5k tokens · deep in thought with high effort)", "status line matches Claude while thinking");
	check(visible(statusText({ ...base, elapsedMs: 225_000, tokens: 5600 })) === "(3m 45s · ↓ 5.6k tokens)", "no generic 'esc to interrupt' text: Claude's kind:\"none\" renders nothing, that hint lives in a separate input-row component");
	check(visible(statusText({ ...base, elapsedMs: 3000 })) === "", "whole status hidden before 16 s with no tokens and no kind, like Claude (measured: 1.5 s into a fresh turn Claude shows the bare verb, no parens at all)");
	check(visible(statusText({ ...base, statusKind: "thought-for", elapsedMs: 3000, thoughtForMs: 4200 })) === "(3s · thought for 4s)", "elapsed shows alongside thought-for too (Claude's yt gate is kind!==\"none\", not mode===\"thinking\")");
	check(elapsed(0) === "0s" && elapsed(500) === "0s" && elapsed(59_900) === "59s", "under 60 s floors, never rounds up to 60s");
	check(elapsed(65_000) === "1m 5s" && elapsed(65_499) === "1m 5s" && elapsed(65_500) === "1m 6s", "at/after 60 s the seconds round (Claude's Gt), so :499 and :500 land on different sides");
	check(elapsed(3_723_000) === "1h 2m 3s" && elapsed(93_780_000) === "1d 2h 3m", "hours drop nothing, days drop seconds, matching Gt's format tiers");
	check(tokens(14500) === "14.5k", "token formatting");
	check(thoughtForWindow(500).showAfterMs === 1500 && thoughtForWindow(500).hideAfterMs === 3500, "a brief thought delays its 'thought for' onset so the total visible window still reaches 2s of display (measured bug: pi used to show it instantly for a flat 2s and drop it early)");
	check(thoughtForWindow(3000).showAfterMs === 0 && thoughtForWindow(3000).hideAfterMs === 2000, "a thought already ≥ 2s shows its 'thought for' immediately");
	check(thinkingIntensityTarget(3000, true, false) === 0 && thinkingIntensityTarget(9_999, true, false) === 0, "no warm/bold ramp before 10 s of actual thinking (measured: Claude stayed plain ff9933 at 3 s)");
	check(thinkingIntensityTarget(15_000, true, false) === 0.5 && thinkingIntensityTarget(20_000, true, false) === 1, "warm ramp ramps linearly from 10 s to 20 s of thinking, like Claude's Rn()");
	check(thinkingIntensityTarget(15_000, true, true) === 0 && thinkingIntensityTarget(15_000, false, false) === 0, "ramp target is 0 while a tool is active or once thinking has stopped");
	check(!supportsEffort("claude-haiku-4-5") && supportsEffort("claude-opus-5"), "effort suffix reuses claude-effort's own supportsEffort gate instead of reimplementing it");
	check(thinkingColor(3000, 0).r === 169 && thinkingColor(3000, 0).g === 169 && thinkingColor(3000, 0).b === 169, "thinking grey pulse uses the bundle's literal 999999/b9b9b9, not the old screen-guessed 9e9e9e/b2b2b2");
	check(pastTense("Churning") === "Churned" && pastTense("Baking") === "Baked" && pastTense("Thinking") === "Thought" && pastTense("Shimmying") === "Shimmied", "past tense of the spinner verb");
	check(visible(doneLine("Churning", 13_400, new Date(2026, 8, 5, 0, 58), new Date(2026, 8, 5, 23, 0))) === "✻ Churned for 13s · done 12:58 AM", "end-of-turn line matches Claude");
	check(doneWhen(new Date(2026, 8, 5, 0, 58), new Date(2026, 8, 5, 23, 0)) === "12:58 AM", "done-line date bucket: same calendar day shows time only");
	check(doneWhen(new Date(2026, 8, 5, 18, 52), new Date(2026, 8, 10, 9, 0)) === "Saturday 6:52 PM", "done-line date bucket: 1-6 calendar days back shows weekday + time");
	check(doneWhen(new Date(2026, 8, 15, 19, 48), new Date(2026, 8, 23, 9, 0)) === "Tuesday, Sep 15, 7:48 PM", "done-line date bucket: 7+ calendar days back shows weekday, month day, time (measured Claude example)");
	check(doneWhen(new Date(2026, 8, 5, 23, 59), new Date(2026, 8, 6, 0, 1)) === "Saturday 11:59 PM", "calendar-day diff, not a 24h window: 2 minutes after midnight still counts as a day boundary crossed");
	check(visible(waitingLine(1)) === "✻ Waiting for 1 background agent to finish", "waiting line matches Claude's turn_duration message singular wording");
	check(visible(waitingLine(2)) === "✻ Waiting for 2 background agents to finish", "waiting line pluralises like Claude's ${n===1?agent:agents}");
	check(waitingLine(1).startsWith(fg(STATUS_GREY)) && waitingLine(1).includes(`${BOLD}1${UNBOLD}`) && waitingLine(1).endsWith(RESET_FG), "waiting line stays dimColor throughout with only the count bold, like Claude's Me/ie render");
	check(backgroundAgentCount() === 0, "no pi-subagents registry present (e.g. package disabled) reads as zero background agents, not a throw");
	(globalThis as Record<symbol, unknown>)[Symbol.for("pi-subagents:manager")] = { backgroundRunningCount: () => 3 };
	check(backgroundAgentCount() === 3, "reads the live count off the pi-subagents cross-package registry (Symbol.for(\"pi-subagents:manager\"))");
	delete (globalThis as Record<symbol, unknown>)[Symbol.for("pi-subagents:manager")];
	check(pastTense("Shimmying") === "Shimmied" && pastTense("Sautéing") === "Sautéed" && pastTense("Dilly-dallying") === "Dilly-dallied" && pastTense("Thinking") === "Thought", "past tense: measured Shimmied and Sautéed, -ying to -ied");
	check(interrupted([{ role: "assistant", stopReason: "aborted" }]) && interrupted([{ role: "assistant", stopReason: "error", errorMessage: "This operation was aborted" }]) && interrupted([{ role: "toolResult", content: [{ type: "text", text: "Command aborted" }] }]) && !interrupted([{ role: "assistant", stopReason: "error", errorMessage: "boom" }]) && !interrupted(), "interrupt detected from an aborted reply, an abort error or an aborted tool");
	check(pickVerb("Swirling") !== "Swirling", "verb changes between turns");
	const handlers: Record<string, (event: unknown, ctx: unknown) => void> = {};
	const done: unknown[] = [];
	const waits: unknown[] = [];
	const labels: Array<string | undefined> = [];
	const widgets: Record<string, () => { render: () => string[] }> = {};
	const workingVisible: boolean[] = [];
	claudeWorking({
		on: (name: string, handler: (event: unknown, ctx: unknown) => void) => (handlers[name] = handler),
		appendEntry: (type: string, data: unknown) => (type === "claude-working-waiting" ? waits : done).push(data),
		registerEntryRenderer: () => {},
	} as unknown as ExtensionAPI);
	const ctx = {
		hasUI: true,
		thinkingLevel: "high",
		model: { id: "claude-opus-5" },
		ui: {
			setWorkingIndicator() {},
			setWidget: (name: string, factory: () => { render: () => string[] }) => (widgets[name] = factory),
			setWorkingMessage: (label?: string) => labels.push(label),
			setWorkingVisible: (visible: boolean) => workingVisible.push(visible),
		},
	};
	handlers.session_start({}, ctx);
	handlers.agent_start({}, ctx);
	const widget = (widgets["claude-working"] as unknown as (tui: unknown, theme: unknown) => { render: (width: number) => string[] })({ requestRender() {} }, { fg: (_role: string, text: string) => text });
	const firstPaint = widget.render(132);
	check(firstPaint.length === 2 && firstPaint[1] === "", "no effort row at startup: real Claude 2.1.280 on Sonnet 5 (\"with high effort\") showed none at 2 s and 13 s");
	handlers.thinking_level_select({ level: "xhigh", previousLevel: "high" }, ctx);
	ctx.thinkingLevel = "xhigh";
	check(visible(widget.render(132)[1]).trim() === "◉ xhigh · /effort", "a changed effort shows as the notice row under the spinner: Claude posts it as a 10 s feedback notification (key effort-level, timeoutMs 1e4)");
	const realNow = Date.now;
	Date.now = () => realNow() + 10_001;
	check(widget.render(132)[1] === "", "the effort notice is gone after 10 s");
	Date.now = realNow;
	handlers.model_select({ model: { id: "claude-haiku-4-5" } }, ctx);
	check(widget.render(132)[1] === "", "switching to a model without effort clears the notice");
	ctx.thinkingLevel = "high";
	check(bottomRows("spin", null, false).join("|") === "spin|" && bottomRows(null, "effort", false).join("|") === "effort" && bottomRows(null, null, false).length === 0 && bottomRows("spin", "effort", true).length === 0, "the notice row is blank under a spinner, holds the effort row when idle, and everything hides while a dialog is open");
	handlers.ui_prompt_start({ kind: "custom" }, ctx);
	handlers.ui_prompt_end({ kind: "custom" }, ctx);
	handlers.ui_prompt_start({ kind: "select" }, ctx);
	check(workingVisible.join("|") === "false|true", "a permission or question dialog hides the built-in working loader row so it leaves no blank line of its own; a select/input dialog (unpatched editor slot) does not touch it");
	check(!firstPaint[0]?.includes("("), "a fresh turn's first paint has no kind, no tokens and elapsedMs 0: no parenthesised status at all, matching Claude (measured: 1.5 s in Claude showed the bare verb, pi showed '(esc to interrupt)')");
	handlers.agent_end({ messages: [{ role: "assistant", stopReason: "error", errorMessage: "Request timed out." }] }, ctx);
	handlers.agent_start({}, ctx);
	handlers.agent_end({ messages: [{ role: "assistant", stopReason: "stop" }] }, ctx);
	check(done.length === 0, "no done line while pi may still retry the run");
	handlers.agent_settled({}, ctx);
	handlers.agent_settled({}, ctx);
	check(done.length === 1, "a timeout pi retries by itself ends the turn with one done line, not one per attempt");
	check(labels.length > 0 && labels.every((label) => label === ""), "pi's default 'Working' label is never restored");
	const registryKey = Symbol.for("pi-subagents:manager");
	let liveBackgroundCount = 1;
	(globalThis as Record<symbol, unknown>)[registryKey] = { backgroundRunningCount: () => liveBackgroundCount };
	const startedAt = Date.now();
	handlers.agent_start({}, ctx);
	handlers.agent_end({ messages: [{ role: "assistant", stopReason: "stop" }] }, ctx);
	handlers.agent_settled({}, ctx);
	check(done.length === 1, "still one done line total: a background agent still running holds the turn open instead of appending another");
	check(waits.length === 1 && (waits[0] as { n: number }).n === 1, "a transcript entry carries Claude's waiting line (a turn_duration message, not a footer widget)");
	const waitFrom = Date.now();
	while (Date.now() - waitFrom < 30) continue;
	liveBackgroundCount = 0;
	handlers.agent_start({}, ctx);
	handlers.agent_end({ messages: [{ role: "assistant", stopReason: "stop" }] }, ctx);
	handlers.agent_settled({}, ctx);
	check(done.length === 2, "once no background agents remain, the follow-up turn's settle appends the one done line for the whole turn");
	check((done[1] as { ms: number }).ms >= 25 && Math.abs((done[1] as { ms: number }).ms - (Date.now() - startedAt)) < 20, "the done line's elapsed spans the whole wait, timed from the ORIGINAL prompt, not reset at the follow-up agent_start");
	delete (globalThis as Record<symbol, unknown>)[registryKey];
	const retrying: Retry = { attempt: 1, maxAttempts: 10, deadline: 10_500, errorMessage: "503 Service Unavailable" };
	check(visible(retryLine(retrying, 10_000, 132)) === "✻ API error · Retrying in 1s · attempt 1/10", "retry row replaces the spinner: Claude 2.1.280's \"✻ API error · Retrying in 1s · attempt 1/10\"");
	check(visible(retryLine(retrying, 11_000, 132)).includes("Retrying in 0s") && retryLine(retrying, 10_000, 132).startsWith(fg(STALL_RED)), "the countdown rounds up and stops at 0s; glyph and label are red");
	check(visible(retryLine({ ...retrying, attempt: 3, maxAttempts: 3 }, 10_000, 132)).startsWith("✻ 503 Service Unavailable · Retrying"), "from attempt min(3, max) the label is the error itself");
	check(visible(retryLine({ ...retrying, attempt: 3, maxAttempts: 3, errorMessage: "x".repeat(200) }, 10_000, 80)).length <= 80, "a long error is cut to fit the row");
	console.log(line("Vibing", { ...base, elapsedMs: 225_000, tokens: 5600 }));
}
