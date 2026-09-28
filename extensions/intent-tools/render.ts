import { clip, isAbort, isRejected } from "../claude-tools/rows.ts";

export type Style = { fg: (role: string, text: string) => string; bold: (text: string) => string };

const RESULT_ELBOW = "  ⎿  ";
const INDENT = "     ";
const EXPANDED_MAX = 20;

export const DEFAULT_TIMEOUT_SECONDS = 120;

export function withDefaultTimeout<T extends { timeout?: number }>(params: T): T {
	return params.timeout === undefined ? { ...params, timeout: DEFAULT_TIMEOUT_SECONDS } : params;
}

const SHELL_WRAPPER = /^\s*(?:rtk\s+)?(?:(?:powershell|pwsh)(?:\.exe)?(?:\s+-(?!c(?:ommand)?\s)\S+)*\s+-c(?:ommand)?|(?:ba|z)?sh(?:\s+-l)?\s+-l?c)\s+/i;

export function commandBody(raw: string): string {
	const unwrapped = raw.replace(SHELL_WRAPPER, "");
	const inner = unwrapped === raw ? raw : unwrapped.trim().replace(/^(["'])([\s\S]*?)\1?\s*$/, "$2");
	return inner.split("\n").map((line) => line.trim()).find((line) => line !== "") ?? raw.trim();
}

export function describeBash(args: Record<string, unknown>): { activity: string; hint: string } {
	const command = String(args.command ?? "");
	return { activity: `Running ${clip(command)}`, hint: `$ ${commandBody(command)}` };
}

export function doneLine(intent: string, s: Style): string {
	return s.fg("muted", `Ran ${intent}`);
}

const EXIT_STATUS = /(?:^\(no output\))?\s*Command exited with code \d+$/;
const FULL_OUTPUT_NOTE = /\s*\[Showing [^\]\n]*Full output: ([^\]\n]+)\]$/;
export const CLAUDE_BASH_MAX_CHARS = 30000;

export function displayOutput(output: string, readHead: (path: string) => string | undefined): string {
	const body = output.replace(EXIT_STATUS, "");
	const note = body.match(FULL_OUTPUT_NOTE);
	if (!note) return body;
	return (readHead(note[1]) ?? body.slice(0, note.index)).slice(0, CLAUDE_BASH_MAX_CHARS);
}

// ponytail: null draws nothing; ctrl+o brings the output back with the first line and "… +N lines".
export function resultLines(output: string, exitCode: number | null, expanded: boolean, s: Style): string[] | null {
	if (!expanded || isAbort(output)) return null;
	const failed = exitCode !== 0 && exitCode !== null;
	const paint = (text: string) => (failed ? s.fg("error", text) : text);
	const body = output.replace(/\s+$/, "");
	const lines = [...(failed ? [`Error: Exit code ${exitCode}`] : []), ...(body === "" ? [] : body.split(/\r?\n/))];
	const shown = lines.slice(0, EXPANDED_MAX).map((line, i) => (i === 0 ? s.fg("muted", RESULT_ELBOW) : INDENT) + paint(line));
	const more = lines.length > EXPANDED_MAX ? [s.fg("muted", `${INDENT}… +${lines.length - EXPANDED_MAX} lines`)] : [];
	return [...shown, ...more];
}

export function rejectedLines(output: string, s: Style): string[] | null {
	return isRejected(output) ? [s.fg("muted", `${RESULT_ELBOW}Interrupted · What should Claude do instead?`)] : null;
}

if (process.env.INTENT_TOOLS_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain: Style = { fg: (_r, t) => t, bold: (t) => t };
	const tagged: Style = { fg: (r, t) => `<${r}>${t}</${r}>`, bold: (t) => t };
	check(commandBody('powershell -NoProfile -Command "\n  $q = Get-MsmqQueue -QueueType Private\n  $q | Select Name\n"') === "$q = Get-MsmqQueue -QueueType Private", "a multi-line powershell -Command names its first real line, not the wrapper");
	check(commandBody('pwsh -NoProfile -c "Get-Date"') === "Get-Date", "a one-line pwsh -c loses its wrapper and quotes");
	check(commandBody("bash -lc 'ls -la /tmp'") === "ls -la /tmp", "bash -lc is unwrapped too");
	check(commandBody("git status") === "git status" && commandBody('echo "a"') === 'echo "a"', "a plain command is left alone, quotes and all");
	check(describeBash({ command: "git status\nmore" }).hint === "$ git status", "the active group's hint is the command under a $, like Claude's bash display hint");
	check(describeBash({ command: "sleep 3 && echo ok" }).activity === "Running sleep 3 && echo ok" && describeBash({ command: "y".repeat(60) }).activity === `Running ${"y".repeat(49)}…`, "a call with no description is summarised as Claude's \"Running <command>\", cut at 50 columns");
	check(withDefaultTimeout({ command: "grep -r x ." }).timeout === 120, "a command without a timeout gets Claude Code's two minutes instead of running forever");
	check(withDefaultTimeout({ command: "dotnet test", timeout: 900 }).timeout === 900, "an explicit timeout is kept");
	check(doneLine("Check git status", tagged) === "<muted>Ran Check git status</muted>", "finished command is one grey line");
	check(resultLines("only\n", 0, false, plain) === null, "successful collapsed result draws nothing");
	check(resultLines("boom", 1, false, plain) === null, "a failed command draws no red row; it folds into the grey group line");
	check(resultLines("Command aborted", 1, true, plain) === null, "an aborted command draws no error row (pi core prints Interrupted)");
	check(resultLines("partial", 3, true, tagged)!.join("|") === `<muted>${RESULT_ELBOW}</muted><error>Error: Exit code 3</error>|     <error>partial</error>`, "ctrl+o on a failed command: Claude's red \"Error: Exit code N\" under the elbow, then the output in red, no ✗");
	check(resultLines("", 7, true, plain)!.join("|") === `${RESULT_ELBOW}Error: Exit code 7`, "a failed command with no output is the one error line");
	check(resultLines("a\r\nb\r\n", 0, true, tagged)!.join("|") === `<muted>${RESULT_ELBOW}</muted>a|     b`, "ctrl+o on a good command: the first line sits on the elbow row, the rest five columns in, default colour");
	check(rejectedLines("The user doesn't want to proceed with this tool use. The tool use was rejected.", tagged)!.join("|") === `<muted>${RESULT_ELBOW}Interrupted · What should Claude do instead?</muted>` && rejectedLines("ok", plain) === null, "a declined bash ask is Claude's grey Interrupted row, collapsed or not");
	const many = Array.from({ length: 25 }, (_, i) => `l${i}`).join("\n");
	check(resultLines(many, 0, true, plain)!.at(-1) === "     … +5 lines", "expanded caps at 20");
	check(displayOutput("partial\n\n\nCommand exited with code 3", () => undefined) === "partial" && displayOutput("(no output)\n\nCommand exited with code 7", () => undefined) === "", "pi's own exit-status line and empty-output placeholder leave the display; Claude's Error line replaces them");
	const tail = "8000\r\n9999\r\n\n[Showing lines 8001-10000 of 10000. Full output: C:\\Temp\\pi-bash-x.log]";
	check(displayOutput(tail, (path) => (path === "C:\\Temp\\pi-bash-x.log" ? "0\r\n1\r\n" : undefined)) === "0\r\n1\r\n", "a cut output shows the head of the full output file, like Claude's display, with no truncation marker");
	check(displayOutput(tail, () => undefined) === "8000\r\n9999","a missing full output file falls back to pi's kept tail without its bracket");
	check(displayOutput("x\n\n[Showing lines 1-1 of 1. Full output: f]", () => "y".repeat(40000)).length === CLAUDE_BASH_MAX_CHARS, "the head stops at Claude's 30000-character bash cut");
	check(displayOutput("a\n\n[Showing lines 2-3 of 3. Full output: f]\n\nCommand exited with code 1", () => "z\n").startsWith("z"), "a failed cut output reads the head too");
}
