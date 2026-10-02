import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ponytail: regular TUI mode has no alt screen, so on an empty transcript the prompt sits right under
// the header. This widget pads above the editor with the rows the terminal has left, so prompt and
// footer stay on the bottom rows like fullscreen; once the transcript outgrows the screen it pads 0.
// The pad also holds the frame at its high-water line count: when a block collapses (the ? card, a
// streamed tool result) pi-tui would otherwise leave the freed rows blank under the footer.
export function padRows(rows: number, used: number, floor: number = 0): number {
	return Math.max(0, Math.max(rows, floor) - used);
}

export function heldFloor(rows: number, used: number, pad: number): number {
	return Math.min(used + pad, rows);
}

const ANSI = /\x1b\[[0-9;]*m/g;
const THOUGHT_SUMMARY = /^Thought for .+$/;
const RULE = /^─+$/;

export function lineBeforeDialog(above: readonly string[]): string | undefined {
	const ruleIndex = above.findIndex((line) => RULE.test(line.replace(ANSI, "").trim()));
	return ruleIndex > 0 ? above[ruleIndex - 1] : undefined;
}

export function dialogPad(lastLine: string | undefined): number {
	const text = (lastLine ?? "").replace(ANSI, "").trim();
	return text === "" || THOUGHT_SUMMARY.test(text) ? 0 : 1;
}

export function resolvePad(dialogOpen: boolean, lastLine: string | undefined, rows: number, used: number, floor: number = 0): number {
	return dialogOpen ? dialogPad(lastLine) : padRows(rows, used, floor);
}

export function inlineDialog(dialogOpen: boolean, modalOpen: boolean): boolean {
	return dialogOpen && !modalOpen;
}

export const MODAL_EVENT = "claude-modes:modal";

type StackEntry = { basis?: number | "auto"; grow?: number; shrink?: number };

export function fullscreenStack(inline: boolean): [StackEntry, StackEntry] {
	return inline ? [{ basis: "auto", grow: 0 }, { shrink: 0 }] : [{ basis: 0, grow: 1 }, { shrink: 1 }];
}

function dockFullscreen(inline: boolean): void {
	const entries = (globalThis as { __claudeViewport?: { root: { entries: StackEntry[] } } }).__claudeViewport?.root.entries;
	if (!entries) return;
	const [transcript, dock] = fullscreenStack(inline);
	Object.assign(entries[0], transcript);
	Object.assign(entries[1], dock);
}

export default function (pi: ExtensionAPI) {
	let dialogOpen = false;
	let modalOpen = false;
	pi.events.on(MODAL_EVENT, (open) => {
		modalOpen = open === true;
		dockFullscreen(inlineDialog(dialogOpen, modalOpen));
	});
	pi.on("ui_prompt_start", (event) => {
		if (event.kind === "custom") dialogOpen = true;
		dockFullscreen(inlineDialog(dialogOpen, modalOpen));
	});
	pi.on("ui_prompt_end", (event) => {
		if (event.kind === "custom") dialogOpen = false;
		dockFullscreen(inlineDialog(dialogOpen, modalOpen));
	});
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setWidget("claude-bottom-input", (tui) => {
			let measuring = false;
			let floor = 0;
			let lastRows = 0;
			return {
				render(width: number) {
					if (measuring) return [];
					if (inlineDialog(dialogOpen, modalOpen)) {
						lastRows = 0;
						measuring = true;
						try {
							const above = tui.render(width);
							return Array<string>(dialogPad(lineBeforeDialog(above))).fill("");
						} finally {
							measuring = false;
						}
					}
					if (tui.mode !== "regular") return [];
					measuring = true;
					try {
						const rows = tui.terminal.rows;
						if (rows !== lastRows) {
							lastRows = rows;
							floor = 0;
						}
						const used = tui.render(width).length;
						const pad = padRows(rows, used, floor);
						floor = heldFloor(rows, used, pad);
						if (modalOpen) lastRows = 0;
						return Array<string>(pad).fill("");
					} finally {
						measuring = false;
					}
				},
				invalidate() {},
			};
		});
	});
}

if (process.env.CLAUDE_BOTTOM_INPUT_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	check(padRows(30, 12) === 18 && padRows(30, 30) === 0 && padRows(30, 45) === 0, "pads the screen, never past it");
	check(padRows(30, 40, 46) === 6, "a frame that shrank by 6 lines keeps its 46-line height");
	check(padRows(30, 50, 46) === 0, "a frame that grew past the floor pads nothing");
	check(padRows(40, 12, 30) === 28, "a taller terminal wins over a smaller floor");
	check(heldFloor(30, 46, 0) === 30 && padRows(30, 40, heldFloor(30, 46, 0)) === 0, "a transcript taller than the pane holds no floor past the screen, so a shrink leaves no blank rows above the prompt (Claude 2.1.283: 0)");
	check(heldFloor(30, 12, 18) === 30 && padRows(30, 10, heldFloor(30, 12, 18)) === 20, "a frame that fits the pane still pads to the bottom after it shrinks");
	check(dialogPad(undefined) === 0 && dialogPad("") === 0 && dialogPad("   ") === 0 && dialogPad("\x1b[38;2;153;153;153m   \x1b[39m") === 0, "a blank (or colour-only-blank) last transcript row needs no pad");
	check(dialogPad("  Thought for 4s") === 0 && dialogPad("\x1b[38;2;153;153;153mThought for 1m 5s\x1b[39m") === 0, "a collapsed 'Thought for …' summary needs no pad either, like Claude's ask-user-question capture (measured 2026-09-23: straight into the rule)");
	check(dialogPad("     then reply with just \"written\" and no other text.") === 1, "any other non-blank last transcript row gets exactly one pad row, like Claude's tool box before the permission rule");
	check(
		lineBeforeDialog(["  Thought for 3s", "\x1b[38;2;153;204;255m" + "─".repeat(80) + "\x1b[0m", " ☐ Colour", "Enter to select"]) === "  Thought for 3s",
		"the line right before the dialog's own opening rule is what a dialog pads against, not the frame's last row (which is the dialog's own last row, footer and widgetsBelow both being empty under a dialog)",
	);
	check(lineBeforeDialog(["a", "b", "c"]) === undefined, "no rule found (not mid-dialog) yields no line to pad against");
	check(lineBeforeDialog(["─".repeat(80), "next"]) === undefined, "a rule with nothing above it (an empty transcript) yields no line either");
	check(resolvePad(true, undefined, 40, 12, 30) === 0 && resolvePad(true, "text", 40, 12, 30) === 1, "a blocking dialog pads by what's already on the last row, not the whole screen");
	check(resolvePad(false, "text", 40, 12, 30) === padRows(40, 12, 30), "no dialog falls back to the usual bottom-anchored pad");
	check(inlineDialog(true, false), "a permission or question dialog sits under the transcript");
	check(!inlineDialog(true, true), "a plan-mode modal keeps the bottom-anchored pad, like Claude's modal pane");
	check(!inlineDialog(false, false), "no dialog, no dialog pad");
	check(fullscreenStack(true)[0].basis === "auto" && fullscreenStack(true)[0].grow === 0 && fullscreenStack(true)[1].shrink === 0, "fullscreen: under a dialog the transcript takes only its own rows and the dock keeps all of its rows, so the dialog sits right below the transcript (Claude 2.1.283)");
	check(fullscreenStack(false)[0].basis === 0 && fullscreenStack(false)[0].grow === 1 && fullscreenStack(false)[1].shrink === 1, "fullscreen: without a dialog the transcript fills the pane and the prompt stays on the bottom rows");
	console.log("\nAll claude-bottom-input checks passed.");
}
