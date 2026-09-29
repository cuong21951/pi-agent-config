import { duration } from "../claude-tools/rows.ts";
import type { Status } from "./shells.ts";

export type Paint = { bold: (text: string) => string; hex: (color: string, text: string) => string; italic: (text: string) => string };
export type ShellView = { status: Status; exitCode?: number | null; command: string; startedAt: number; endedAt?: number; output: string; bytesTotal: number };

export const TEAL = "00cccc";
const GREY = "999999";
const GREEN = "87af87";
const RED = "ff6666";
const LABEL_WIDTH = 10;
const BOX_LINES = 10;
const COMMAND_CHARS = 280;
export const OUTPUT_READ_BYTES = 8192;

function label(text: string, p: Paint): string {
	return p.bold(text.padEnd(LABEL_WIDTH));
}

function clipTo(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function tailLines(content: string): string[] {
	const starts: number[] = [];
	let end = content.length;
	for (let i = 0; i < BOX_LINES && end > 0; i++) {
		const at = content.lastIndexOf("\n", end - 1);
		starts.push(at + 1);
		end = at;
	}
	starts.reverse();
	return starts.map((start, i) => content.slice(start, i < starts.length - 1 ? starts[i + 1] - 1 : content.length)).filter((line) => line !== "");
}

function size(bytes: number): string {
	if (bytes < 1024) return `${bytes} bytes`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function statusText(view: ShellView, p: Paint): string {
	const code = view.status !== "running" && view.exitCode !== undefined && view.exitCode !== null ? ` (exit code: ${view.exitCode})` : "";
	const color = view.status === "running" ? TEAL : view.status === "completed" ? GREEN : RED;
	return p.hex(color, `${view.status}${code}`);
}

function outputRows(view: ShellView, width: number, p: Paint): string[] {
	if (view.output === "") return [`  ${p.hex(GREY, "No output available")}`];
	const lines = tailLines(view.output.replace(/\r\n/g, "\n"));
	const box = Math.max(4, width - 6);
	const room = box - 4;
	const body = Array.from({ length: BOX_LINES }, (_, i) => `  │ ${clipTo(lines[i] ?? "", room).padEnd(room)} │`);
	const more = view.bytesTotal > view.output.length ? ` of ${size(view.bytesTotal)}` : "";
	return [`  ╭${"─".repeat(box - 2)}╮`, ...body, `  ╰${"─".repeat(box - 2)}╯`, `  ${p.italic(p.hex(GREY, `Showing ${lines.length} lines${more}`))}`];
}

export function detailRows(view: ShellView, width: number, now: number, p: Paint): string[] {
	const hint = ["← to go back", "Esc/Enter/Space to close", ...(view.status === "running" ? ["x to stop"] : [])].join(" · ");
	return [
		p.hex(TEAL, "─".repeat(width)),
		`  ${p.bold(p.hex(TEAL, "Shell details"))}`,
		"",
		`  ${label("Status:", p)}${statusText(view, p)}`,
		`  ${label("Runtime:", p)}${duration((view.endedAt ?? now) - view.startedAt)}`,
		`  ${label("Command:", p)}${clipTo(view.command, COMMAND_CHARS)}`,
		"",
		`  ${p.bold("Output:")}`,
		...outputRows(view, width, p),
		"",
		`  ${p.italic(p.hex(GREY, hint))}`,
	];
}

export function pill(count: number, focused: boolean): string | undefined {
	if (count === 0) return undefined;
	const text = count === 1 ? "1 shell" : `${count} shells`;
	return focused ? `\x1b[7m${text}\x1b[27m` : text;
}

if (process.env.INTENT_DETAILS_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain: Paint = { bold: (t) => t, hex: (_c, t) => t, italic: (t) => t };
	const tagged: Paint = { bold: (t) => `<b>${t}</b>`, hex: (c, t) => `<${c}>${t}</${c}>`, italic: (t) => `<i>${t}</i>` };
	const running: ShellView = { status: "running", command: "python -c x", startedAt: 0, output: "", bytesTotal: 0 };
	const rows = detailRows(running, 132, 6000, plain);
	check(rows.join("\n") === ["─".repeat(132), "  Shell details", "", "  Status:   running", "  Runtime:  6s", "  Command:  python -c x", "", "  Output:", "  No output available", "", "  ← to go back · Esc/Enter/Space to close · x to stop"].join("\n"), "a running shell with no output draws Claude's eleven rows (m6a-measure-stop list-enter)");
	const colours = detailRows(running, 10, 6000, tagged);
	check(colours[0] === `<${TEAL}>${"─".repeat(10)}</${TEAL}>` && colours[1] === `  <b><${TEAL}>Shell details</${TEAL}></b>` && colours[3] === `  <b>Status:   </b><${TEAL}>running</${TEAL}>` && colours.at(-1) === "  <i><999999>← to go back · Esc/Enter/Space to close · x to stop</999999></i>", "teal rule and title, bold labels, teal status, grey italic hint");
	const printed = detailRows({ ...running, output: Array.from({ length: 15 }, (_, i) => `line ${i}\n`).join(""), bytesTotal: 105 }, 132, 4000, plain);
	check(printed[8] === `  ╭${"─".repeat(124)}╮` && printed[9] === `  │ line 6${" ".repeat(116)} │` && printed[18] === `  │ ${" ".repeat(122)} │` && printed[19] === `  ╰${"─".repeat(124)}╯` && printed[20] === "  Showing 9 lines", "output: the last ten newline-split slots in a 126-wide round box, the trailing empty one kept blank, Showing 9 lines (m6a-measure-details)");
	check(detailRows({ ...running, status: "completed", exitCode: 0, endedAt: 3000 }, 40, 9000, plain)[3] === "  Status:   completed (exit code: 0)" && !detailRows({ ...running, status: "completed", exitCode: 0 }, 40, 0, plain).at(-1)!.includes("x to stop"), "a finished shell shows its exit code and no stop key");
	check(tailLines("a\nb\n") .join("|") === "a|b" && tailLines("a\nb").join("|") === "a|b", "tail lines drop the empty slot after a final newline");
	check(pill(0, false) === undefined && pill(1, false) === "1 shell" && pill(2, false) === "2 shells" && pill(1, true) === "\x1b[7m1 shell\x1b[27m", "the pill counts shells and turns inverse when ↓ focuses it (raw capture: ESC[7m1 shell ESC[27m)");
	console.log("All intent-tools details checks passed.");
}
