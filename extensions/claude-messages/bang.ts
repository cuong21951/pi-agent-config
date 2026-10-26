import { visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { Paint } from "./gutter.ts";

export type Bang = { command: string; outputLines: string[]; status: "running" | "complete" | "error" | "cancelled"; expanded: boolean };
export type Running = { elapsedMs: number; hint?: string };
export type BangMessage = { command: string; output?: string; exitCode?: number | null; cancelled?: boolean; truncated?: boolean; fullOutputPath?: string };

const BACKGROUND = "\x1b[48;2;65;60;65m";
const BACKGROUND_END = "\x1b[49m";
const DIM = "\x1b[2m";
const UNDIM = "\x1b[22m";
const HANG = "  ";
const ELBOW = "  ⎿  ";
const INDENT = "     ";
const COMMAND_RESERVE = 3;
const OUTPUT_MARGIN = 5;
const PREVIEW_ROWS = 3;
const TAIL_ROWS = 4;
const ELAPSED_FROM_MS = 3000;
const IDLE: Running = { elapsedMs: 0 };
const BACKGROUNDED = /Command was manually backgrounded by user with ID: b[0-9a-z]{8}\. Output is being written to: [^\n]*\.$/;

export const CAVEAT = "<local-command-caveat>The command below was run directly in pi, not sent to you as a request, and its output goes straight to the user. It's recorded here as context for later messages.</local-command-caveat>";

export function backgroundNotice(output: string): string | undefined {
	return BACKGROUNDED.exec(output.trimEnd())?.[0];
}

function cut(line: string, room: number): string[] {
	const rows = [""];
	for (const char of line) {
		if (visibleWidth(rows[rows.length - 1] + char) > room) rows.push("");
		rows[rows.length - 1] += char;
	}
	return rows;
}

function outputLinesToRows(lines: string[], width: number): string[] {
	return lines.flatMap((line) => cut(line, Math.max(1, width - INDENT.length - OUTPUT_MARGIN)));
}

export function commandRows(command: string, width: number, paint: Paint): string[] {
	const room = Math.max(1, width - COMMAND_RESERVE);
	return command
		.split("\n")
		.flatMap((line) => (line === "" ? [""] : wrapTextWithAnsi(line, room)))
		.map((line, i) => {
			const lead = i === 0 ? `${paint("bashMode", "!")} ` : HANG;
			return BACKGROUND + lead + paint("text", line) + " ".repeat(Math.max(0, width - HANG.length - visibleWidth(line))) + BACKGROUND_END;
		});
}

function printed(lines: string[]): string[] {
	const last = lines.findLastIndex((line) => line.trim() !== "");
	return lines.slice(0, last + 1);
}

function runningRows(lines: string[], width: number, paint: Paint, running: Running): string[] {
	if (running.elapsedMs < ELAPSED_FROM_MS) return [paint("muted", `${ELBOW}Running…`)];
	const elapsed = `(${Math.floor(running.elapsedMs / 1000)}s)`;
	const hint = running.hint ? [paint("muted", INDENT + running.hint)] : [];
	if (lines.length === 0) return [paint("muted", `${ELBOW}Running… ${elapsed}`), ...hint];
	const tail = outputLinesToRows(lines.slice(-TAIL_ROWS), width).slice(-TAIL_ROWS);
	const hidden = Math.max(0, lines.length - tail.length);
	return [...tail.map((line, i) => paint("muted", (i === 0 ? ELBOW : INDENT) + line)), paint("muted", `${INDENT}${hidden > 0 ? `+${hidden} lines ` : ""}${elapsed}`), ...hint];
}

export function outputRows(bang: Bang, width: number, paint: Paint, running: Running = IDLE): string[] {
	const lines = printed(bang.outputLines);
	if (bang.status === "running") return runningRows(lines, width, paint, running);
	const failed = bang.status === "error";
	if (lines.length === 0) return failed ? [paint("muted", `${ELBOW}(No output)`)] : [`${paint("muted", ELBOW)}(Bash completed with no output)`];
	const tone = (line: string) => (failed ? paint("error", line) : line);
	const notice = backgroundNotice(lines.join("\n"));
	const all = outputLinesToRows(notice ? [notice] : lines, width);
	const shown = bang.expanded || all.length <= PREVIEW_ROWS + 1 ? all : all.slice(0, PREVIEW_ROWS);
	const hidden = all.length - shown.length;
	const more = hidden > 0 ? [INDENT + tone(`${DIM}… +${hidden} lines${UNDIM}`)] : [];
	return [...shown.map((line, i) => (i === 0 ? paint("muted", ELBOW) : INDENT) + tone(line)), ...more];
}

export function bangRows(bang: Bang, width: number, paint: Paint, running: Running = IDLE): string[] {
	return bang.status === "cancelled" ? [] : ["", ...commandRows(bang.command, width, paint), ...outputRows(bang, width, paint, running)];
}

export function bangBlocks(message: BangMessage, first: boolean): { type: "text"; text: string }[] {
	const output = message.output ?? "";
	const notes = [message.cancelled ? "(command cancelled)" : message.exitCode ? `Command exited with code ${message.exitCode}` : "", message.truncated && message.fullOutputPath ? `[Output truncated. Full output: ${message.fullOutputPath}]` : ""].filter(Boolean).join("\n");
	const texts = [...(first ? [CAVEAT] : []), `<bash-input>${message.command}</bash-input>`, `<bash-stdout>${backgroundNotice(output) ?? output}</bash-stdout><bash-stderr>${notes}</bash-stderr>`];
	return texts.map((text) => ({ type: "text" as const, text }));
}

if (process.env.CLAUDE_MESSAGES_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain: Paint = (_role, text) => text;
	const tagged: Paint = (role, text) => `<${role}>${text}</${role}>`;
	const bang = (status: Bang["status"], output = "", expanded = false): Bang => ({ command: "echo hi", outputLines: output.split("\n"), status, expanded });
	const lines = (count: number) => Array.from({ length: count }, (_, i) => `row ${i + 1}`).join("\n");
	const notice = "Command was manually backgrounded by user with ID: b2un8gk35. Output is being written to: /tmp/tasks/b2un8gk35.output.";

	check(commandRows("echo hi", 20, tagged)[0] === `${BACKGROUND}<bashMode>!</bashMode> <text>echo hi</text>${" ".repeat(11)}${BACKGROUND_END}`, "the command row is Claude 2.1.289's: 3399ff \"!\", ffffff command, 413c41 across the full width");
	check(commandRows("one two three four", 12, plain).map((row) => row.replace(BACKGROUND, "").replace(BACKGROUND_END, "")).join("|") === "! one two   |  three     |  four      ", "a long command wraps at a word 3 columns short of the width and hangs 2 columns in");
	check(commandRows("a\nb", 10, plain).length === 2, "a pasted multi-line command keeps one row per line");
	check(outputRows(bang("running", "start\n"), 80, tagged).join("|") === "<muted>  ⎿  Running…</muted>", "for its first 3 s a running command is only a grey Running…");
	check(outputRows(bang("running"), 80, plain, { elapsedMs: 6500, hint: "(ctrl+b to run in background)" }).join("|") === "  ⎿  Running… (6s)|     (ctrl+b to run in background)", "from 3 s it counts the seconds over the background hint");
	check(outputRows(bang("running", `${lines(3)}\n`), 80, plain, { elapsedMs: 3200 }).join("|") === "  ⎿  row 1|     row 2|     row 3|     (3s)", "and shows what the command has printed so far over the seconds");
	check(outputRows(bang("running", `${lines(6)}\n`), 80, tagged, { elapsedMs: 6100 }).join("|") === "<muted>  ⎿  row 3</muted>|<muted>     row 4</muted>|<muted>     row 5</muted>|<muted>     row 6</muted>|<muted>     +2 lines (6s)</muted>", "only the last four rows, grey, with a count of the ones above");
	check(outputRows(bang("complete", "hi\n"), 80, tagged).join("|") === "<muted>  ⎿  </muted>hi", "finished output sits under the elbow in the default colour");
	check(outputRows(bang("complete", lines(4)), 80, plain).length === 4, "four rows all show");
	check(outputRows(bang("complete", lines(5)), 80, plain).join("|") === `  ⎿  row 1|     row 2|     row 3|     ${DIM}… +2 lines${UNDIM}`, "five rows are three and a dim count of the rest");
	check(outputRows(bang("complete", lines(30), true), 80, plain).length === 30, "ctrl+o shows every row");
	check(outputRows(bang("complete", `${"y".repeat(140)}\nb\nc\nd`), 132, plain)[1] === `     ${"y".repeat(18)}`, "a long line is cut 10 columns short of the width and its rows count toward the three");
	check(outputRows(bang("complete", "one two three four"), 20, plain).join("|") === "  ⎿  one two th|     ree four", "the cut is by column, not at a word: Claude breaks a path mid-name (measure-bang-ctrlb)");
	check(outputRows(bang("complete", "界".repeat(8)), 20, plain).join("|") === `  ⎿  ${"界".repeat(5)}|     ${"界".repeat(3)}`, "a wide character counts two columns, so no row overruns the terminal");
	check(outputRows(bang("error", "boom"), 80, tagged).join("|") === "<muted>  ⎿  </muted><error>boom</error>", "a failed command's output is ff6666, with no exit-code row");
	check(outputRows(bang("error", lines(5)), 80, tagged)[3] === `     <error>${DIM}… +2 lines${UNDIM}</error>`, "and so is its count row");
	check(outputRows(bang("complete"), 80, tagged).join("|") === "<muted>  ⎿  </muted>(Bash completed with no output)", "no output, exit 0");
	check(outputRows(bang("error"), 80, tagged).join("|") === "<muted>  ⎿  (No output)</muted>", "no output, non-zero exit");
	check(outputRows(bang("complete", `tick 0\ntick 1\n${notice}`), 200, plain).join("|") === `  ⎿  ${notice}`, "a command moved to the background with ctrl+b shows only Claude's notice, not what it had printed");
	check(backgroundNotice("the docs say: Command was manually backgrounded by user\nmore") === undefined, "output that merely mentions the notice is left alone");
	check(bangRows(bang("cancelled", "partial"), 80, plain).length === 0, "a cancelled command leaves the transcript");
	check(bangRows(bang("complete", "hi"), 80, plain)[0] === "", "one blank row above the command");
	check(bangBlocks({ command: "echo hi", output: "hi", exitCode: 0 }, true).map((block) => block.text).join("|") === `${CAVEAT}|<bash-input>echo hi</bash-input>|<bash-stdout>hi</bash-stdout><bash-stderr></bash-stderr>`, "the model reads the command the way Claude 2.1.289 sends it: caveat when it opens the conversation, input, stdout and stderr tags");
	check(bangBlocks({ command: "x", output: "", exitCode: 3 }, false).map((block) => block.text).join("|") === "<bash-input>x</bash-input>|<bash-stdout></bash-stdout><bash-stderr>Command exited with code 3</bash-stderr>", "later commands carry no caveat; pi's exit-code note rides in the stderr tag");
	check(bangBlocks({ command: "x", output: `tick 0\n${notice}` }, false)[1].text === `<bash-stdout>${notice}</bash-stdout><bash-stderr></bash-stderr>`, "a backgrounded command tells the model the notice alone");
}
