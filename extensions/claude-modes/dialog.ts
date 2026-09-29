import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { Mode } from "./modes.ts";

export type Paint = (role: string, text: string) => string;

const ACCENT = "\x1b[38;2;153;204;255m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const FAINT = "\x1b[2m";
const NORMAL = "\x1b[22m";
export const PLAN_COLOUR = "\x1b[38;2;102;153;153m";
const INSET = "  ";
const HANG = "     ";
const ELBOW = "  ⎿  ";

export type ToolKind = "bash" | "edit" | "write";

export interface Token {
	text: string;
	bold?: boolean;
}

export function ruleRow(width: number): string {
	return `${ACCENT}${"─".repeat(Math.max(0, width))}${RESET}`;
}

export function titleRow(title: string): string {
	return ` ${BOLD}${ACCENT}${title}${RESET}`;
}

export const QUESTION_ROW = " Do you want to proceed?";

export function questionRow(kind: ToolKind, target: string): string {
	return kind === "edit" ? ` Do you want to make this edit to ${BOLD}${target}${RESET}?` : QUESTION_ROW;
}

export function footerRow(paint: Paint): string {
	return ` ${paint("muted", "Esc to cancel · Tab to amend")}`;
}

export function bashPreviewRows(command: string, description: string, paint: Paint): string[] {
	const rows = [`   ${command}`];
	if (description !== "") rows.push(`   ${paint("muted", description)}`);
	return rows;
}

const ACCEPT_EDITS_OPTION: Token[] = [
	{ text: "Yes, and switch to " },
	{ text: "accept edits (auto-approve file edits and common file commands)", bold: true },
	{ text: " for this session " },
	{ text: "(shift+tab)", bold: true },
];

export function optionTokens(kind: ToolKind, target: string): Token[][] {
	const second: Token[] =
		kind === "bash" ? [{ text: "Yes, and always allow access to " }, { text: target, bold: true }, { text: " from this project" }] : ACCEPT_EDITS_OPTION;
	return [[{ text: "Yes" }], second, [{ text: "No" }]];
}

function paintToken(token: Token, selected: boolean): string {
	if (!selected && !token.bold) return token.text;
	return `${selected ? ACCENT : ""}${token.bold ? BOLD : ""}${token.text}${RESET}`;
}

function optionPrefix(index: number, selected: boolean, paint: Paint): string {
	const arrow = selected ? `${ACCENT}❯${RESET}` : " ";
	return ` ${arrow} ${paint("muted", `${index + 1}.`)} `;
}

function optionLabel(tokens: Token[], selected: boolean): string {
	return tokens.map((token) => paintToken(token, selected)).join("");
}

export function optionRow(index: number, tokens: Token[], selected: boolean, paint: Paint): string {
	return optionPrefix(index, selected, paint) + optionLabel(tokens, selected);
}

const OPTION_HANG = "      ";

export function optionRows(index: number, tokens: Token[], selected: boolean, paint: Paint, width: number): string[] {
	const [first = "", ...rest] = wrapTextWithAnsi(optionLabel(tokens, selected), Math.max(1, width - OPTION_HANG.length));
	return [optionPrefix(index, selected, paint) + first, ...rest.map((line) => OPTION_HANG + line)];
}

export function titleFor(kind: ToolKind, exists: boolean): string {
	if (kind === "bash") return "Bash command";
	if (kind === "edit") return "Edit file";
	return exists ? "Overwrite file" : "Create file";
}

export function dialogRows(
	kind: ToolKind,
	title: string,
	previewRows: string[],
	target: string,
	selectedIndex: number,
	width: number,
	paint: Paint,
): string[] {
	const tokens = optionTokens(kind, target);
	return [
		ruleRow(width),
		titleRow(title),
		"",
		...previewRows,
		"",
		questionRow(kind, target),
		...tokens.flatMap((token, index) => optionRows(index, token, index === selectedIndex, paint, width)),
		"",
		footerRow(paint),
	];
}

export function modalRule(width: number): string {
	return `${ACCENT}${"▔".repeat(Math.max(0, width))}${RESET}`;
}

function insetRule(width: number, paint: (text: string) => string, char = "─"): string {
	return INSET + paint(char.repeat(Math.max(0, width - 2 * INSET.length)));
}

const planPaint = (text: string) => `${PLAN_COLOUR}${text}${RESET}`;

export const APPROVAL_LABEL: Partial<Record<Mode, Token[]>> = {
	bypass: [{ text: "Yes, and switch to " }, { text: "BYPASS PERMISSIONS (no further prompts)", bold: true }, { text: " for this session" }],
	auto: [{ text: "Yes, and use auto mode" }],
	acceptEdits: [{ text: "Yes, auto-accept edits" }],
	manual: [{ text: "Yes, manually approve edits" }],
};

export const FEEDBACK_PLACEHOLDER = "Tell Claude what to change";
export const FEEDBACK_HINT = "shift+tab to approve with this feedback";
export const PLAN_QUESTION = "Claude has written up a plan and is ready to execute. Would you like to proceed?";

export function feedbackRow(index: number, feedback: string, selected: boolean, paint: Paint): string {
	const arrow = selected ? `${ACCENT}❯${RESET}` : " ";
	const placeholder = selected ? `${FAINT}${FEEDBACK_PLACEHOLDER}${NORMAL}` : paint("muted", FEEDBACK_PLACEHOLDER);
	return ` ${arrow} ${paint("muted", `${index + 1}.`)} ${feedback === "" ? placeholder : feedback}`;
}

export interface PlanDialog {
	planRows: string[];
	modes: Mode[];
	selected: number;
	feedback: string;
	editor: string;
	path: string;
	scrollOffset?: number;
}

export function planScrollArrow(row: string, arrow: string, width: number, paint: Paint): string {
	const budget = Math.max(0, width - visibleWidth(arrow));
	const clipped = truncateToWidth(row, budget);
	return clipped + " ".repeat(Math.max(0, budget - visibleWidth(clipped))) + paint("muted", arrow);
}

export function planMaxScrollOffset(planRowCount: number, bodyRoom: number): number {
	return Math.max(0, planRowCount - bodyRoom);
}

export function planDialogRows(dialog: PlanDialog, width: number, height: number, paint: Paint): string[] {
	const dashed = insetRule(width, (text) => paint("dim", text), "╌");
	const head = [modalRule(width), "", insetRule(width, planPaint), INSET + titleRow("Ready to code?"), "", "   Here is Claude's plan:", dashed];
	const options = dialog.modes.map((mode, index) => INSET + optionRow(index, APPROVAL_LABEL[mode] ?? [{ text: mode }], index === dialog.selected, paint));
	const bottom = [
		insetRule(width, planPaint),
		`   ${paint("muted", PLAN_QUESTION)}`,
		"",
		...options,
		INSET + feedbackRow(options.length, dialog.feedback, dialog.selected === options.length, paint),
		`        ${paint("muted", FEEDBACK_HINT)}`,
		"",
		`   ${paint("muted", `ctrl+g to edit in ${dialog.editor} · ${dialog.path}`)}`,
	];
	const room = Math.max(0, height - head.length - bottom.length - 1);
	const total = dialog.planRows.length;
	const offset = Math.min(Math.max(0, dialog.scrollOffset ?? 0), planMaxScrollOffset(total, room));
	const plan = dialog.planRows.slice(offset, offset + room).map((row) => `   ${row}`);
	const hasAbove = offset > 0;
	const hasBelow = offset + plan.length < total;
	if (plan.length > 0 && hasAbove) plan[0] = planScrollArrow(plan[0]!, "↑", width, paint);
	if (plan.length > 0 && hasBelow) {
		const last = plan.length - 1;
		plan[last] = last === 0 && hasAbove ? planScrollArrow(plan[last]!, "↑↓", width, paint) : planScrollArrow(plan[last]!, "↓", width, paint);
	}
	return [...head, ...plan, dashed, ...Array<string>(room - plan.length).fill(""), ...bottom];
}

export const EXIT_OPTIONS: Token[][] = [[{ text: "Yes, and switch to " }, { text: "default (ask each time)", bold: true }, { text: " for this session" }], [{ text: "No" }]];

export function exitPlanRows(selected: number, width: number, paint: Paint): string[] {
	return [
		modalRule(width),
		"",
		insetRule(width, planPaint),
		INSET + titleRow("Exit plan mode?"),
		"",
		"    Claude wants to exit plan mode",
		"",
		...EXIT_OPTIONS.map((tokens, index) => `   ${optionRow(index, tokens, index === selected, paint)}`),
	];
}

function planDot(text: string): string {
	return `${planPaint("●")} ${text}`;
}

export function approvedRows(planRows: string[], path: string, paint: Paint): string[] {
	return [planDot("User approved Claude's plan"), paint("muted", `${ELBOW}Plan saved to: ${path} · /plan to edit`), ...planRows.map((row) => HANG + row)];
}

export function rejectedRows(planRows: string[], measure: (text: string) => number, paint: Paint): string[] {
	const inner = Math.max(0, ...planRows.map(measure));
	const edge = (left: string, right: string) => HANG + planPaint(`${left}${"─".repeat(inner + 2)}${right}`);
	return [
		paint("muted", ELBOW) + paint("dim", "User rejected Claude's plan:"),
		edge("╭", "╮"),
		...planRows.map((row) => `${HANG}${planPaint("│")} ${row}${" ".repeat(Math.max(0, inner - measure(row)))} ${planPaint("│")}`),
		edge("╰", "╯"),
	];
}

export function enteredRows(paint: Paint): string[] {
	return [planDot("Entered plan mode"), `  ${paint("muted", "Claude is now exploring and designing an implementation approach.")}`];
}

export function exitedRows(): string[] {
	return [planDot("Exited plan mode")];
}

export function markdownUnescape(text: string): string {
	return text.replace(/\\([!-/:-@[-`{-~])/g, "$1");
}

export function commandRows(lines: string[], paint: Paint): string[] {
	return lines.map((line, index) => (index === 0 ? paint("muted", "  ⎿  ") : HANG) + line);
}

if (process.env.CLAUDE_MODES_DIALOG_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const tag: Paint = (role, text) => `<${role}>${text}</${role}>`;
	const plain = (text: string) => text.replace(/\x1b\[[0-9;]*m|<\/?[a-z]+>/g, "");

	check(ruleRow(5) === `${ACCENT}─────${RESET}`, "rule row is accent-coloured dashes at the given width");
	check(ruleRow(0) === `${ACCENT}${RESET}`, "rule row never repeats a negative count");
	check(titleRow("Bash command") === ` ${BOLD}${ACCENT}Bash command${RESET}`, "title row is bold accent, one column in");
	check(QUESTION_ROW === " Do you want to proceed?", "question row matches Claude's wording");
	check(footerRow(tag) === " <muted>Esc to cancel · Tab to amend</muted>", "footer is muted, one column in");

	check(
		JSON.stringify(bashPreviewRows("echo parity > marker.txt", "Write a marker file", tag)) ===
			JSON.stringify(["   echo parity > marker.txt", "   <muted>Write a marker file</muted>"]),
		"bash preview shows the command plain and the description muted, both indent 3",
	);
	check(
		JSON.stringify(bashPreviewRows("ls", "", tag)) === JSON.stringify(["   ls"]),
		"an empty description draws no second row",
	);

	const tokens = optionTokens("bash", "/repo");
	check(
		optionRow(0, tokens[0]!, true, tag) === ` ${ACCENT}❯${RESET} <muted>1.</muted> ${ACCENT}Yes${RESET}`,
		"selected option 1: accent arrow, muted number, accent label",
	);
	check(
		optionRow(2, tokens[2]!, false, tag) === "   <muted>3.</muted> No",
		"unselected option 3: no arrow, muted number, plain label",
	);
	const always = optionRow(1, tokens[1]!, false, tag);
	check(
		always === `   <muted>2.</muted> Yes, and always allow access to ${BOLD}/repo${RESET} from this project`,
		"unselected always-allow option bolds only the target path",
	);
	const alwaysSelected = optionRow(1, tokens[1]!, true, tag);
	check(
		alwaysSelected ===
			` ${ACCENT}❯${RESET} <muted>2.</muted> ${ACCENT}Yes, and always allow access to ${RESET}${ACCENT}${BOLD}/repo${RESET}${ACCENT} from this project${RESET}`,
		"selected always-allow option keeps the bold target and turns the rest accent",
	);

	const narrow = optionRows(1, optionTokens("bash", "C:\\a\\very\\long\\work\\folder")[1]!, false, (_role, text) => text, 40);
	check(
		narrow.every((row) => row.replace(/\x1b\[[0-9;]*m/g, "").length <= 40) && narrow[1]!.startsWith("      ") && narrow.length > 1,
		"an option longer than the dialog wraps under its label instead of overflowing the terminal (pi exited on a 136-column row at 132)",
	);
	check(titleFor("bash", false) === "Bash command", "bash title never varies by file existence");
	check(titleFor("edit", false) === "Edit file", "edit title");
	check(titleFor("write", false) === "Create file", "write title for a new file");
	check(titleFor("write", true) === "Overwrite file", "write title for an existing file");

	const rows = dialogRows("bash", "Bash command", ["   echo parity > marker.txt", "   <muted>Write a marker file</muted>"], "/repo", 0, 80, tag);
	check(rows.length === 12, "dialog assembles rule, title, blank, 2 preview rows, blank, question, 3 options, blank, footer");
	check(rows[0] === ruleRow(80) && rows[1] === titleRow("Bash command") && rows[2] === "", "rule, title, blank open the dialog");
	check(rows[6] === QUESTION_ROW && rows[11] === footerRow(tag), "question sits after the preview, footer closes the dialog");

	check(questionRow("bash", "/repo") === QUESTION_ROW, "bash keeps Claude's generic question (measured via run.py --scenario permission, port 20097)");
	check(
		questionRow("edit", "notes.txt") === ` Do you want to make this edit to ${BOLD}notes.txt${RESET}?`,
		"edit names the file, bold, in its own question (measured via run.py --scenario m2-edit-permission, port 20098: diff.py's colour compare caught the filename bold in Claude and plain in pi)",
	);
	check(questionRow("write", "new.ts") === QUESTION_ROW, "write's question is unmeasured, left on the generic wording rather than guessed");

	const editTokens = optionTokens("edit", "notes.txt");
	check(
		plain(optionRow(1, editTokens[1]!, false, tag)) === "   2. Yes, and switch to accept edits (auto-approve file edits and common file commands) for this session (shift+tab)",
		"edit's second option offers Claude's real acceptEdits mode switch, not a per-file \"always allow\" grant (measured live, m2-edit-permission)",
	);
	check(plain(optionRow(2, editTokens[2]!, false, tag)) === "   3. No", "edit's decline option is a bare \"No\", same as bash's — the long network-dialog wording does not apply here");
	const writeTokens = optionTokens("write", "new.ts");
	check(JSON.stringify(writeTokens[1]) === JSON.stringify(editTokens[1]), "write shares edit's acceptEdits option by the same accept-edits mode both already gate on (modes.ts: WRITE_TOOLS)");

	const planDialog: PlanDialog = { planRows: ["Rename", "", "- one"], modes: ["bypass", "manual"], selected: 0, feedback: "", editor: "Notepad", path: "~\\p.md" };
	const modal = planDialogRows(planDialog, 40, 30, tag);
	check(modal.length === 30, "the approval dialog fills the height it is given");
	check(plain(modal[0]!) === "▔".repeat(40) && modal[0]!.startsWith(ACCENT), "the modal opens with a full-width accent upper rule");
	check(modal[2] === `  ${PLAN_COLOUR}${"─".repeat(36)}${RESET}` && plain(modal[3]!) === "   Ready to code?", "the frame is two columns in, plan-coloured, with Claude's title");
	check(modal[5] === "   Here is Claude's plan:" && modal[6] === `  <dim>${"╌".repeat(36)}</dim>`, "the plan box opens with a dim dashed rule");
	check(modal[7] === "   Rename" && modal[8] === "   " && modal[9] === "   - one" && modal[10] === modal[6], "plan rows sit three columns in and the dashed rule closes them");
	check(modal.slice(11, 21).every((row) => row === ""), "blank rows push the question to the bottom");
	check(modal[21] === modal[2] && modal[22] === `   <muted>${PLAN_QUESTION}</muted>`, "the question sits under its own plan-coloured rule");
	check(plain(modal[24]!) === "   ❯ 1. Yes, and switch to BYPASS PERMISSIONS (no further prompts) for this session", "bypass is offered first");
	check(plain(modal[25]!) === "     2. Yes, manually approve edits", "manual approval second");
	check(plain(modal[26]!) === `     3. ${FEEDBACK_PLACEHOLDER}` && modal[26]!.endsWith(`<muted>${FEEDBACK_PLACEHOLDER}</muted>`), "an unfocused keep-planning row shows its muted placeholder");
	check(modal[27] === `        <muted>${FEEDBACK_HINT}</muted>` && modal[29] === "   <muted>ctrl+g to edit in Notepad · ~\\p.md</muted>", "feedback hint and editor hint close the dialog");
	const focused = planDialogRows({ ...planDialog, selected: 2 }, 40, 30, tag);
	check(focused[26] === `   ${ACCENT}❯${RESET} <muted>3.</muted> ${FAINT}${FEEDBACK_PLACEHOLDER}${NORMAL}`, "a focused empty keep-planning row shows the placeholder faint");
	const typed = planDialogRows({ ...planDialog, selected: 2, feedback: "Add a test step" }, 40, 30, tag);
	check(typed[26] === `   ${ACCENT}❯${RESET} <muted>3.</muted> Add a test step`, "typed feedback is plain text");
	const tallPlan = { ...planDialog, planRows: Array<string>(40).fill("x") };
	const tight = planDialogRows(tallPlan, 40, 20, tag);
	check(
		tight.length === 20 && tight[7] === "   x" && tight[8] === "   x" && tight[9] === planScrollArrow("   x", "↓", 40, tag) && tight[10] === tight[6],
		"a plan taller than the room shows a bare arrow on the last visible row, no extra row reserved for it (Claude's plan pane is a bounded scrollable viewport, measured via run.py --scenario m5c-plan-tall), and the dashed rule still closes it",
	);
	check(plain(tight[9]!).endsWith("↓"), "the down arrow sits at the end of the boundary row, not on a line of its own");
	const scrolled = planDialogRows({ ...tallPlan, scrollOffset: 5 }, 40, 20, tag);
	check(scrolled[7] === planScrollArrow("   x", "↑", 40, tag), "scrolling down moves an up arrow onto the new top row");
	check(scrolled[9] === planScrollArrow("   x", "↓", 40, tag), "the bottom row keeps its down arrow while more content remains below");
	const atEnd = planDialogRows({ ...tallPlan, scrollOffset: 999 }, 40, 20, tag);
	check(!plain(atEnd[9]!).includes("↓") && plain(atEnd[7]!).endsWith("↑"), "the offset clamps to the last page: no down arrow once nothing more is below");
	check(plain(planScrollArrow("x", "↓", 10, tag)) === "x        ↓", "the arrow is right-aligned to the given width");
	check(planMaxScrollOffset(40, 2) === 38, "max offset is the plan length minus the visible body room");
	check(planDialogRows({ ...planDialog, modes: ["acceptEdits", "manual"] }, 40, 30, tag).some((row) => plain(row) === "   ❯ 1. Yes, auto-accept edits"), "accept edits label when bypass is not offered");
	check(plain(APPROVAL_LABEL.auto!.map((t) => t.text).join("")) === "Yes, and use auto mode", "auto label");

	const exit = exitPlanRows(0, 40, tag);
	check(exit.length === 9 && plain(exit[3]!) === "   Exit plan mode?" && exit[5] === "    Claude wants to exit plan mode", "empty-plan dialog title and body");
	check(plain(exit[7]!) === "    ❯ 1. Yes, and switch to default (ask each time) for this session" && plain(exit[8]!) === "      2. No", "empty-plan options four columns in");

	check(plain(approvedRows(["Rename"], "~\\p.md", tag).join("|")) === "● User approved Claude's plan|  ⎿  Plan saved to: ~\\p.md · /plan to edit|     Rename", "approved result row");
	check(approvedRows([], "x", tag)[0]!.startsWith(`${PLAN_COLOUR}●`), "the approved dot is plan-coloured");
	const rejected = rejectedRows(["Rename", "", "- one two"], (text) => plain(text).length, tag);
	check(rejected[0] === "<muted>  ⎿  </muted><dim>User rejected Claude's plan:</dim>", "rejected heading is a grey elbow and dim text");
	check(plain(rejected.slice(1).join("|")) ==="     ╭───────────╮|     │ Rename    │|     │           │|     │ - one two │|     ╰───────────╯", "rejected plan sits in a round box sized to the widest row");
	check(plain(enteredRows(tag).join("|")) === "● Entered plan mode|  Claude is now exploring and designing an implementation approach.", "entered plan mode row");
	check(plain(exitedRows().join("")) === "● Exited plan mode", "exited plan mode row");
	check(commandRows(["Enabled plan mode"], tag)[0] === "<muted>  ⎿  </muted>Enabled plan mode", "command output hangs under a grey elbow");
	check(commandRows(["a", "b"], tag)[1] === "     b", "later command rows hang five columns in");
	check(markdownUnescape("C:\\Users\\cuong\\.pi\\agent\\plans\\a.md") === "C:\\Users\\cuong.pi\\agent\\plans\\a.md", "a backslash before punctuation is eaten, as Claude's markdown shows the plan path");

	console.log("\nAll claude-modes dialog checks passed.");
}
