import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const VERBS = ["Swirling", "Wibbling", "Pondering", "Musing", "Brewing", "Percolating", "Noodling", "Tinkering"];

function elapsed(ms: number): string {
	const s = Math.floor(ms / 1000);
	return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function tokens(n: number): string {
	return n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`;
}

export default function (pi: ExtensionAPI) {
	let started = 0;
	let output = 0;
	let verb = VERBS[0];
	let timer: ReturnType<typeof setInterval> | undefined;

	pi.on("agent_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		started = Date.now();
		output = 0;
		verb = VERBS[Math.floor(Math.random() * VERBS.length)];
		clearInterval(timer);
		timer = setInterval(() => {
			ctx.ui.setWorkingMessage(
				`${ctx.ui.theme.fg("warning", ctx.ui.theme.bold(`${verb}…`))} ${ctx.ui.theme.fg("dim", `(${elapsed(Date.now() - started)} · ↓ ${tokens(output)} tokens)`)}`,
			);
		}, 1000);
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
	check(elapsed(4000) === "4s", "seconds only");
	check(elapsed(289000) === "4m 49s", "minutes and seconds");
	check(tokens(950) === "950", "small token count");
	check(tokens(14500) === "14.5k", "thousands");
}
