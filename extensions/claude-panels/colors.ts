const RESET = "\x1b[0m";

function rgb(code: string): [number, number, number] {
	const n = parseInt(code, 16);
	return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function hex(code: string, text: string): string {
	const [r, g, b] = rgb(code);
	return `\x1b[38;2;${r};${g};${b}m${text}${RESET}`;
}

export function hexBold(code: string, text: string): string {
	const [r, g, b] = rgb(code);
	return `\x1b[1m\x1b[38;2;${r};${g};${b}m${text}${RESET}`;
}

export function hexBg(fgCode: string, bgCode: string, text: string): string {
	const [fr, fg, fb] = rgb(fgCode);
	const [br, bg, bb] = rgb(bgCode);
	return `\x1b[38;2;${fr};${fg};${fb}m\x1b[48;2;${br};${bg};${bb}m${text}${RESET}`;
}

export function invert(fgCode: string, bgCode: string, text: string): string {
	return `\x1b[1m${hexBg(fgCode, bgCode, text)}`;
}

if (process.env.CLAUDE_PANELS_COLORS_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	check(hex("99ccff", "x") === "\x1b[38;2;153;204;255mx\x1b[0m", "hex converts a 6-digit code to a truecolor fg escape");
	check(hexBold("888888", "x") === "\x1b[1m\x1b[38;2;136;136;136mx\x1b[0m", "hexBold prefixes bold before the fg escape");
	check(hexBg("99ccff", "455c73", "x") === "\x1b[38;2;153;204;255m\x1b[48;2;69;92;115mx\x1b[0m", "hexBg stacks fg then bg, matching Claude's usage-limit bar fill");
	check(invert("000000", "99ccff", "x").startsWith("\x1b[1m\x1b[38;2;0;0;0m\x1b[48;2;153;204;255m"), "invert bolds the active-tab black-on-accent chip");
	console.log("\nAll claude-panels colors checks passed.");
}
