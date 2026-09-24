export type Mode = "manual" | "auto" | "acceptEdits" | "plan" | "bypass";

// ponytail: Claude Code's mode row, verbatim: "⏵⏵ accept edits on", "⏸ plan mode on",
// "⏵⏵ bypass permissions on", each followed by a dim "(shift+tab to cycle)". The colours come from the
// 2.1.261 mode table — plan takes planMode, accept edits takes autoAccept, bypass takes error — and are
// written as ANSI here because pi's theme has no role for the first two and its schema forbids new ones.
export const MODE_LINE: Record<Mode, { text: string; ansi: string }> = {
	manual: { text: "⏸ manual mode on", ansi: "\x1b[38;2;153;153;153m" },
	plan: { text: "⏸ plan mode on", ansi: "\x1b[38;2;102;153;153m" },
	acceptEdits: { text: "⏵⏵ accept edits on", ansi: "\x1b[38;2;175;135;255m" },
	auto: { text: "⏵⏵ auto mode on", ansi: "\x1b[38;2;255;204;0m" },
	bypass: { text: "⏵⏵ bypass permissions on", ansi: "\x1b[38;2;255;102;102m" },
};

export const RESET = "\x1b[0m";

export const CYCLE_HINT = " (shift+tab to cycle)";

export const AUTO_UNAVAILABLE_NOTICE = "auto mode unavailable for this model";

const AUTO_UNAVAILABLE_MODELS = new Set(["claude-opus-4-0", "claude-opus-4-1", "claude-sonnet-4-0", "claude-sonnet-4-5", "claude-haiku-4-5"]);

function bareModelId(modelId: string): string {
	const afterSlash = modelId.includes("/") ? modelId.slice(modelId.lastIndexOf("/") + 1) : modelId;
	return afterSlash.replace(/\./g, "-");
}

export function isAutoModeAvailable(modelId: string | undefined): boolean {
	if (!modelId) return true;
	const id = bareModelId(modelId);
	if (id.startsWith("claude-3-")) return false;
	return !AUTO_UNAVAILABLE_MODELS.has(id);
}

export function nextMode(mode: Mode, modelId?: string): Mode {
	switch (mode) {
		case "bypass":
			return isAutoModeAvailable(modelId) ? "auto" : "manual";
		case "auto":
			return "manual";
		case "manual":
			return "acceptEdits";
		case "acceptEdits":
			return "plan";
		case "plan":
			return "bypass";
	}
}

export function reachable(target: Mode, modelId?: string): boolean {
	let mode: Mode = target;
	for (let step = 0; step < 5; step++) {
		mode = nextMode(mode, modelId);
		if (mode === target) return true;
	}
	return false;
}

export function approvalModes(modelId?: string): Mode[] {
	const first: Mode = reachable("bypass", modelId) ? "bypass" : isAutoModeAvailable(modelId) ? "auto" : "acceptEdits";
	return [first, "manual"];
}

const SLUG_ADJECTIVES = ["logical", "dazzling", "crystalline", "fluttering", "shimmering", "playful", "polished", "gentle", "radiant", "quiet", "steady", "vivid"];
const SLUG_VERBS = ["tumbling", "dancing", "drifting", "humming", "wandering", "sparking"];
const SLUG_NOUNS = ["cosmos", "newell", "iverson", "nautilus", "peach", "brooks", "whale", "meadow", "harbor", "lantern", "comet", "otter"];

export type Pick = (count: number) => number;

export function planSlug(prompt: string, pick: Pick): string {
	const words = prompt.split(/\s+/).filter(Boolean).slice(0, 4).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-+|-+$/g, "");
	const word = (list: string[]) => list[pick(list.length)]!;
	const tail = words ? [word(SLUG_ADJECTIVES), word(SLUG_NOUNS)] : [word(SLUG_ADJECTIVES), word(SLUG_VERBS), word(SLUG_NOUNS)];
	return [words, ...tail].filter(Boolean).join("-");
}

const PLAN_SLUG_TRIES = 10;

export function freshPlanSlug(prompt: string, pick: Pick, taken: (slug: string) => boolean): string {
	let slug = planSlug(prompt, pick);
	for (let tries = 1; tries < PLAN_SLUG_TRIES && taken(slug); tries++) slug = planSlug(prompt, pick);
	return slug;
}

const EDITOR_NAMES: Record<string, string> = { code: "VS Code", cursor: "Cursor", vi: "Vim", vim: "Vim", nano: "nano", notepad: "Notepad", emacs: "Emacs", subl: "Sublime Text", atom: "Atom" };

export function editorName(command: string): string {
	const program = (command.trim().split(/\s+/)[0] ?? "").split(/[\\/]/).pop()!.replace(/\.exe$/i, "").toLowerCase();
	return EDITOR_NAMES[program] ?? program.charAt(0).toUpperCase() + program.slice(1);
}

export function editorCommand(env: Record<string, string | undefined>, platform: string): string {
	return env.VISUAL || env.EDITOR || (platform === "win32" ? "notepad" : "nano");
}

export function planReminder(planFile: string, exists: boolean): string {
	const fileInfo = exists
		? `A plan file already exists at ${planFile}. You can read it and make incremental edits using the edit tool.`
		: `No plan file exists yet. You should create your plan at ${planFile} using the write tool.`;
	return `Plan mode is active. The user indicated that they do not want you to execute yet -- you MUST NOT make any edits (with the exception of the plan file mentioned below), run any non-readonly tools (including changing configs or making commits), or otherwise make any changes to the system. This supercedes any other instructions you have received.

## Plan File Info:
${fileInfo}
You should build your plan incrementally by writing to or editing this file. NOTE that this is the only file you are allowed to edit - other than this you are only allowed to take READ-ONLY actions.

## Plan Workflow

### Phase 1: Initial Understanding
Goal: Gain a comprehensive understanding of the user's request by reading through code and asking them questions. Actively search for existing functions, utilities, and patterns that can be reused — avoid proposing new code when suitable implementations already exist. For uncertain scope you may launch up to 3 scout agents in parallel with the Agent tool; use the minimum number necessary (usually just 1, none for a small targeted change).

### Phase 2: Design
Goal: Design an implementation approach. For non-trivial tasks you may launch a planner agent with the Agent tool, giving it the context from Phase 1; skip it for truly trivial tasks (typo fixes, single-line changes, simple renames).

### Phase 3: Review
Goal: Review the plan and ensure alignment with the user's intentions. Read the critical files you identified, and use ask_user_question to clarify any remaining questions with the user.

### Phase 4: Final Plan
Goal: Write your final plan to the plan file (the only file you can edit).
- Begin with a **Context** section: explain why this change is being made — the problem or need it addresses, what prompted it, and the intended outcome
- Include only your recommended approach, not all alternatives
- Ensure that the plan file is concise enough to scan quickly, but detailed enough to execute effectively
- Name the critical files to be modified, and the existing functions and utilities that should be reused, with their file paths
- Include a verification section describing how to test the changes end-to-end

### Phase 5: Call exit_plan_mode
At the very end of your turn, once you have asked the user questions and are happy with your final plan file - you should always call exit_plan_mode to indicate to the user that you are done planning.
This is critical - your turn should only end with either using the ask_user_question tool OR calling exit_plan_mode. Do not stop unless it's for these 2 reasons

**Important:** Use ask_user_question ONLY to clarify requirements or choose between approaches. Use exit_plan_mode to request plan approval. Do NOT ask about plan approval in any other way - no text questions, no ask_user_question. Phrases like "Is this plan okay?", "Should I proceed?", "How does this plan look?", "Any changes before we start?", or similar MUST use exit_plan_mode.

NOTE: At any point in time through this workflow you should feel free to ask the user questions or clarifications using the ask_user_question tool. Don't make large assumptions about user intent. The goal is to present a well researched plan to the user, and tie any loose ends before implementation begins.`;
}

export const EXIT_DESCRIPTION = `Use this tool when you are in plan mode and have finished writing your plan to the plan file and are ready for user approval.

## How This Tool Works
- You should have already written your plan to the plan file specified in the plan mode system message
- This tool does NOT take the plan content as a parameter - it will read the plan from the file you wrote
- This tool simply signals that you're done planning and ready for the user to review and approve
- The user will see the contents of your plan file when they review it

## When to Use This Tool
IMPORTANT: Only use this tool when the task requires planning the implementation steps of a task that requires writing code. For research tasks where you're gathering information, searching files, reading files or in general trying to understand the codebase - do NOT use this tool.

## Before Using This Tool
Ensure your plan is complete and unambiguous:
- If you have unresolved questions about requirements or approach, use ask_user_question first (in earlier phases)
- Once your plan is finalized, use THIS tool to request approval

**Important:** Do NOT use ask_user_question to ask "Is this plan okay?" or "Should I proceed?" - that's exactly what THIS tool does. exit_plan_mode inherently requests user approval of your plan.`;

export const ENTER_DESCRIPTION = `Use this tool proactively when you're about to start a non-trivial implementation task. Getting user sign-off on your approach before writing code prevents wasted effort and ensures alignment. This tool transitions you into plan mode where you can explore the codebase and design an implementation approach for user approval.

## When to Use This Tool

Prefer using enter_plan_mode for implementation tasks unless they're simple. Use it when ANY of these conditions apply:
1. New Feature Implementation: adding meaningful new functionality
2. Multiple Valid Approaches: the task can be solved in several different ways
3. Code Modifications: changes that affect existing behavior or structure
4. Architectural Decisions: the task requires choosing between patterns or technologies
5. Multi-File Changes: the task will likely touch more than 2-3 files
6. Unclear Requirements: you need to explore before understanding the full scope
7. User Preferences Matter: the implementation could reasonably go multiple ways; if you would use ask_user_question to clarify the approach, use enter_plan_mode instead

## When NOT to Use This Tool

Only skip enter_plan_mode for simple tasks:
- Single-line or few-line fixes (typos, obvious bugs, small tweaks)
- Adding a single function with clear requirements
- Tasks where the user has given very specific, detailed instructions
- Pure research/exploration tasks

## What Happens in Plan Mode

In plan mode, you'll:
1. Thoroughly explore the codebase using find, grep, and read
2. Understand existing patterns and architecture
3. Design an implementation approach
4. Present your plan to the user for approval
5. Use ask_user_question if you need to clarify approaches
6. Exit plan mode with exit_plan_mode when ready to implement`;

export const ENTERED_RESULT = `Entered plan mode. You should now focus on exploring the codebase and designing an implementation approach.

In plan mode, you should:
1. Thoroughly explore the codebase to understand existing patterns
2. Identify similar features and architectural approaches
3. Consider multiple approaches and their trade-offs
4. Use ask_user_question if you need to clarify the approach
5. Design a concrete implementation strategy
6. When ready, use exit_plan_mode to present your plan for approval

Remember: DO NOT write or edit any files yet. This is a read-only exploration and planning phase.`;

export function approvedResult(planFile: string, plan: string, feedback: string): string {
	const said = feedback ? `\n\nUser feedback on this plan: ${feedback}` : "";
	return `User has approved your plan. You can now start coding. Start with updating your todo list if applicable

Your plan has been saved to: ${planFile}
You can refer back to it if needed during implementation.

## Approved Plan:
${plan}${said}

## Exited Plan Mode

You have exited plan mode. You can now make edits, run tools, and take actions. The plan file is located at ${planFile} if you need to reference it.`;
}

export const EXITED_RESULT = "User has approved exiting plan mode. You can now proceed.";

const REJECTED = "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file).";

export function rejectedResult(feedback: string): string {
	return feedback ? `${REJECTED} To tell you how to proceed, the user said:\n${feedback}` : `${REJECTED} STOP what you are doing and wait for the user to tell you how to proceed.`;
}

const READ_ONLY_BASH =
	/^\s*(ls|pwd|echo|cat|head|tail|wc|file|stat|which|whoami|date|env|printenv|grep|rg|find|fd|tree|diff|du|df|node --version|npm ls|npm view|py(thon)? --version|git (status|log|diff|show|branch|remote|config --get|rev-parse|ls-files))\b/;

// ponytail: rtk-bash rewrites every command to `rtk <cmd>`, so the allowlist must see through it.
const WRAPPERS = /^\s*(rtk(\s+proxy)?|command|time|nice(\s+-n\s*-?\d+)?)\s+/;

function unwrap(segment: string): string {
	let out = segment;
	for (let i = 0; i < 3 && WRAPPERS.test(out); i++) out = out.replace(WRAPPERS, "");
	return out;
}

const WRITE_REDIRECT = />>?(?!&)/;

export function bashIsReadOnly(command: string): boolean {
	const segments = command.split(/&&|\|\||;|\|/);
	return segments.every((segment) => segment.trim() === "" || (READ_ONLY_BASH.test(unwrap(segment)) && !WRITE_REDIRECT.test(segment)));
}

const WRITE_TOOLS = new Set(["write", "edit"]);

export type Gate = { action: "allow" } | { action: "block"; reason: string } | { action: "ask"; question: string };

export function gate(mode: Mode, toolName: string, command: string, planFile = false): Gate {
	if (mode === "bypass") return { action: "allow" };
	if (mode === "plan") {
		if (WRITE_TOOLS.has(toolName) && !planFile) {
			return { action: "block", reason: `Plan mode: ${toolName} is blocked. Press shift+tab to leave plan mode.` };
		}
		if (toolName === "bash" && !bashIsReadOnly(command)) {
			return { action: "block", reason: "Plan mode: only read-only bash is allowed. Press shift+tab to leave plan mode." };
		}
		return { action: "allow" };
	}
	if (mode === "manual" && WRITE_TOOLS.has(toolName)) {
		return { action: "ask", question: `Apply this ${toolName}?` };
	}
	if (toolName === "bash" && !bashIsReadOnly(command)) {
		return { action: "ask", question: command };
	}
	return { action: "allow" };
}

export type Paint = (role: string, text: string) => string;

const MARGIN = 2;

export function noticeLine(width: number, paint: Paint): string {
	const pad = Math.max(0, width - AUTO_UNAVAILABLE_NOTICE.length - MARGIN);
	return " ".repeat(pad) + paint("warning", AUTO_UNAVAILABLE_NOTICE);
}

if (process.env.CLAUDE_MODES_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};

	check(nextMode("bypass", "claude-opus-5") === "auto", "bypass cycles to auto when the model supports it");
	check(nextMode("auto", "claude-opus-5") === "manual", "auto cycles to manual");
	check(nextMode("manual", "claude-opus-5") === "acceptEdits", "manual cycles to accept edits");
	check(nextMode("acceptEdits", "claude-opus-5") === "plan", "accept edits cycles to plan");
	check(nextMode("plan", "claude-opus-5") === "bypass", "plan wraps to bypass");
	check(nextMode("bypass", "claude-haiku-4.5") === "manual", "bypass skips auto for a model without auto support");
	check(nextMode("plan", "claude-haiku-4.5") === "bypass", "bypass stays reachable regardless of auto support");

	check(isAutoModeAvailable("claude-opus-5"), "auto is available for opus 5");
	check(isAutoModeAvailable("claude-sonnet-5"), "auto is available for sonnet 5");
	check(!isAutoModeAvailable("claude-haiku-4.5"), "auto is unavailable for haiku 4.5 (dotted id)");
	check(!isAutoModeAvailable("claude-haiku-4-5"), "auto is unavailable for haiku 4.5 (dashed id)");
	check(!isAutoModeAvailable("claude-3-opus-20240229"), "auto is unavailable for claude-3-*");
	check(isAutoModeAvailable("github-copilot/claude-opus-5"), "provider prefix is stripped before the check");

	check(reachable("bypass", "claude-sonnet-5") && reachable("plan", "claude-haiku-4.5"), "bypass and plan are always in the cycle");
	check(!reachable("auto", "claude-haiku-4.5") && reachable("auto", "claude-sonnet-5"), "auto is in the cycle only for a model that has it");
	check(JSON.stringify(approvalModes("claude-sonnet-5")) === JSON.stringify(["bypass", "manual"]), "plan approval offers bypass first while bypass is in the cycle, then manual");

	const first = () => 0;
	check(planSlug("Plan how to rename src/util.ts to src/helpers.ts", first) === "plan-how-to-rename-logical-cosmos", "plan slug is the prompt's first four words plus an adjective and a noun");
	check(planSlug("", first) === "logical-tumbling-cosmos", "with no prompt the slug is adjective-verb-noun");
	const rolls = [0, 0, 0, 1, 1, 1];
	const rolling = () => rolls.shift() ?? 2;
	const takenOnce = new Set(["plan-how-to-rename-logical-cosmos"]);
	check(freshPlanSlug("Plan how to rename x", rolling, (slug) => takenOnce.has(slug)) !== "plan-how-to-rename-logical-cosmos", "a slug whose plan file already exists is drawn again (Claude's getPlanSlug checks the plans listing)");
	let draws = 0;
	check(freshPlanSlug("Plan how", () => (draws++, 0), () => true) === "plan-how-logical-cosmos" && draws === 20, "after ten taken draws the last one is used, as Claude gives up after oe = 10");
	check(planSlug("Fix: the  Login!! flow now please", first) === "fix-the-login-flow-logical-cosmos", "punctuation and runs of spaces collapse to single dashes");
	check(planSlug("x".repeat(60), first) === `${"x".repeat(40)}-logical-cosmos`, "the prompt part is cut at 40 characters");

	check(editorName("notepad") === "Notepad" && editorName("C:\\Windows\\notepad.exe") === "Notepad", "notepad is Claude's Notepad");
	check(editorName("code --wait") === "VS Code" && editorName("/usr/bin/vim") === "Vim", "known editors use Claude's display names");
	check(editorName("hx") === "Hx", "an unknown editor is its capitalised program name");
	check(editorCommand({}, "win32") === "notepad" && editorCommand({}, "linux") === "nano", "pi's own external-editor fallback");
	check(editorCommand({ EDITOR: "vim", VISUAL: "code --wait" }, "win32") === "code --wait", "VISUAL wins over EDITOR");

	check(planReminder("C:/p/plans/a.md", false).includes("create your plan at C:/p/plans/a.md using the write tool"), "a missing plan file is to be created with write");
	check(planReminder("C:/p/plans/a.md", true).includes("A plan file already exists at C:/p/plans/a.md"), "an existing plan file is to be edited");
	check(planReminder("x", false).includes("call exit_plan_mode"), "the reminder tells the model to end with exit_plan_mode");
	check(approvedResult("C:/p/a.md", "- one", "").startsWith("User has approved your plan. You can now start coding."), "approval text is Claude's");
	check(approvedResult("C:/p/a.md", "- one", "").includes("## Approved Plan:\n- one"), "approval carries the plan");
	check(approvedResult("C:/p/a.md", "- one", "add tests").includes("User feedback on this plan: add tests"), "approval with feedback carries it");
	check(rejectedResult("").endsWith("STOP what you are doing and wait for the user to tell you how to proceed."), "escape stops the turn");
	check(rejectedResult("Add a test step").endsWith("To tell you how to proceed, the user said:\nAdd a test step"), "keep planning passes the feedback on");

	check(bashIsReadOnly("git status --short"), "read-only bash recognised");
	check(bashIsReadOnly("ls -la | grep ts"), "pipeline of read-only parts");
	check(!bashIsReadOnly("rm -rf build"), "destructive bash not read-only");
	check(!bashIsReadOnly("git status && rm x"), "mixed pipeline not read-only");

	check(bashIsReadOnly("rtk git status"), "rtk wrapper sees through to git status");
	check(bashIsReadOnly("rtk proxy cat file.txt"), "rtk proxy wrapper");
	check(!bashIsReadOnly("rtk rm -rf build"), "rtk wrapper does not launder a destructive command");

	check(!bashIsReadOnly("echo parity > marker.txt"), "a redirect makes an allowlisted command a write");
	check(!bashIsReadOnly("echo hi >> log.txt"), "append redirect is a write too");
	check(bashIsReadOnly("ls 2>&1"), "an fd merge is not a file redirect");
	check(bashIsReadOnly("echo hi"), "echo without a redirect stays read-only");
	check(gate("plan", "bash", "rtk git status").action === "allow", "plan allows rtk-wrapped read-only bash");
	check(gate("acceptEdits", "bash", "rtk git status").action === "allow", "accept edits does not ask for rtk-wrapped read-only bash");
	check(gate("plan", "write", "").action === "block", "plan blocks write");
	check(gate("plan", "edit", "").action === "block", "plan blocks edit");
	check(gate("plan", "bash", "rm -rf x").action === "block", "plan blocks destructive bash");
	check(gate("plan", "bash", "git status").action === "allow", "plan allows read-only bash");
	check(gate("plan", "read", "").action === "allow", "plan allows reads");

	check(gate("manual", "write", "").action === "ask", "manual asks before every write");
	check(gate("manual", "edit", "").action === "ask", "manual asks before every edit");
	check(gate("manual", "bash", "rm -rf x").action === "ask", "manual asks before side-effecting bash");
	check(gate("manual", "bash", "git status").action === "allow", "manual runs read-only bash without asking");

	check(gate("acceptEdits", "edit", "").action === "allow", "accept edits applies edits without asking");
	check(gate("acceptEdits", "write", "").action === "allow", "accept edits applies writes without asking");
	check(gate("acceptEdits", "bash", "rm -rf x").action === "ask", "accept edits asks before side-effecting bash");
	check(gate("acceptEdits", "bash", "git status").action === "allow", "accept edits runs read-only bash without asking");

	check(gate("auto", "edit", "").action === "allow", "auto applies edits without asking, same as accept edits");
	check(gate("auto", "bash", "rm -rf x").action === "ask", "auto asks before side-effecting bash, same as accept edits");

	check(gate("bypass", "write", "").action === "allow", "bypass allows writes");
	check(gate("bypass", "bash", "rm -rf x").action === "allow", "bypass allows anything");

	check(
		MODE_LINE.bypass.text === "⏵⏵ bypass permissions on" &&
			MODE_LINE.plan.text === "⏸ plan mode on" &&
			MODE_LINE.acceptEdits.text === "⏵⏵ accept edits on" &&
			MODE_LINE.auto.text === "⏵⏵ auto mode on" &&
			MODE_LINE.manual.text === "⏸ manual mode on",
		"mode rows are Claude's",
	);
	check(
		MODE_LINE.plan.ansi.endsWith("102;153;153m") &&
			MODE_LINE.acceptEdits.ansi.endsWith("175;135;255m") &&
			MODE_LINE.bypass.ansi.endsWith("255;102;102m") &&
			MODE_LINE.auto.ansi.endsWith("255;204;0m") &&
			MODE_LINE.manual.ansi.endsWith("153;153;153m"),
		"mode row colours are Claude's planMode, autoAccept, error, warning and inactive",
	);
	check(gate("plan", "write", "", true).action === "allow", "plan mode lets the plan file be written");
	check(gate("plan", "edit", "", true).action === "allow", "plan mode lets the plan file be edited");
	check(gate("plan", "write", "", false).action === "block", "plan mode still blocks every other write");

	check(noticeLine(40, (_role, text) => text) === `${" ".repeat(40 - AUTO_UNAVAILABLE_NOTICE.length - 2)}${AUTO_UNAVAILABLE_NOTICE}`, "notice line right-aligned with a 2-column margin");
	check(noticeLine(10, (_role, text) => text) === AUTO_UNAVAILABLE_NOTICE, "notice line never pads negative when the width is too narrow");

	console.log("\nAll claude-modes checks passed.");
}
