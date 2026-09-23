import { isAbort } from "../claude-tools/rows.ts";

export type Style = { fg: (role: string, text: string) => string; bold: (text: string) => string };

const ELBOW = "  ⎿  ";
const INDENT = "    ";
const EXPANDED_MAX = 20;

const SHELL_WRAPPER = /^\s*(?:rtk\s+)?(?:(?:powershell|pwsh)(?:\.exe)?(?:\s+-(?!c(?:ommand)?\s)\S+)*\s+-c(?:ommand)?|(?:ba|z)?sh(?:\s+-l)?\s+-l?c)\s+/i;

export function commandBody(raw: string): string {
	const unwrapped = raw.replace(SHELL_WRAPPER, "");
	const inner = unwrapped === raw ? raw : unwrapped.trim().replace(/^(["'])([\s\S]*?)\1?\s*$/, "$2");
	return inner.split("\n").map((line) => line.trim()).find((line) => line !== "") ?? raw.trim();
}

export function runningLine(intent: string, blink: boolean, s: Style): string {
	return (blink ? s.fg("muted", "● ") : "  ") + intent;
}

export function doneLine(intent: string, s: Style): string {
	return s.fg("muted", `Ran ${intent}`);
}

export function commandLine(command: string, s: Style): string {
	return s.fg("muted", `${ELBOW}$ ${commandBody(command)}`);
}

// ponytail: null draws nothing; ctrl+o brings the output back with the first line and "… +N lines".
export function resultLines(output: string, exitCode: number | null, expanded: boolean, truncated: boolean, s: Style): string[] | null {
	if (!expanded || isAbort(output)) return null;
	const lines = output.replace(/\n$/, "").split("\n");
	const failedStatus = exitCode === 0 || exitCode === null ? "" : `✗ exit ${exitCode} `;
	const shown = lines.slice(0, EXPANDED_MAX).map((line) => s.fg("muted", INDENT + line));
	const more = lines.length > EXPANDED_MAX ? [s.fg("muted", `${INDENT}… +${lines.length - EXPANDED_MAX} lines`)] : [];
	return [s.fg("muted", ELBOW) + s.fg(failedStatus ? "error" : "muted", failedStatus + (truncated ? "[truncated] " : "")), ...shown, ...more];
}

if (process.env.INTENT_TOOLS_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain: Style = { fg: (_r, t) => t, bold: (t) => t };
	const tagged: Style = { fg: (r, t) => `<${r}>${t}</${r}>`, bold: (t) => t };
	check(runningLine("Check git status", true, tagged) === "<muted>● </muted>Check git status", "running: grey dot, plain intent");
	check(commandBody('powershell -NoProfile -Command "\n  $q = Get-MsmqQueue -QueueType Private\n  $q | Select Name\n"') === "$q = Get-MsmqQueue -QueueType Private", "a multi-line powershell -Command names its first real line, not the wrapper");
	check(commandBody('pwsh -NoProfile -c "Get-Date"') === "Get-Date", "a one-line pwsh -c loses its wrapper and quotes");
	check(commandBody("bash -lc 'ls -la /tmp'") === "ls -la /tmp", "bash -lc is unwrapped too");
	check(commandBody("git status") === "git status" && commandBody('echo "a"') === 'echo "a"', "a plain command is left alone, quotes and all");
	check(runningLine("Check git status", false, plain) === "  Check git status", "blink off keeps the column");
	check(doneLine("Check git status", tagged) === "<muted>Ran Check git status</muted>", "finished command is one grey line");
	check(commandLine("git status\nmore", tagged) === "<muted>  ⎿  $ git status</muted>", "command shown under the elbow while running");
	check(resultLines("only\n", 0, false, false, plain) === null, "successful collapsed result draws nothing");
	check(resultLines("boom", 1, false, false, plain) === null, "a failed command draws no red row; it folds into the grey group line");
	check(resultLines("Command aborted", 1, true, false, plain) === null, "an aborted command draws no error row (pi core prints Interrupted)");
	check(resultLines("a\nb\nc", 2, true, false, tagged)!.join("|") === "<muted>  ⎿  </muted><error>✗ exit 2 </error>|<muted>    a</muted>|<muted>    b</muted>|<muted>    c</muted>", "ctrl+o shows the exit status and the output");
	check(resultLines("a\nb", 0, true, false, plain)!.join("|") === "  ⎿  |    a|    b", "expanded lists lines");
	check(resultLines("a\nb", 0, true, true, plain)![0] === "  ⎿  [truncated] ", "truncation flag when expanded");
	const many = Array.from({ length: 25 }, (_, i) => `l${i}`).join("\n");
	check(resultLines(many, 0, true, false, plain)!.at(-1) === "    … +5 lines", "expanded caps at 20");
}
