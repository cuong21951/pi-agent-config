export interface Style {
	fg: (role: string, text: string) => string;
	bold: (text: string) => string;
}

const INDENT = "    ";

export function callLine(name: unknown, s: Style): string {
	const skill = typeof name === "string" && name.trim() !== "" ? name.trim() : "?";
	return s.fg("customMessageLabel", s.bold("● ")) + s.fg("toolTitle", s.bold("Skill")) + s.fg("toolTitle", `(${skill})`);
}

export interface ResultState {
	text: string;
	isError: boolean;
	expanded: boolean;
	isPartial: boolean;
}

export function resultLine(state: ResultState, s: Style): string {
	const elbow = s.fg("toolTitle", "  └ ");
	if (state.isPartial) return elbow + s.fg("dim", "…");
	if (state.isError) {
		const [first] = state.text.split("\n");
		return elbow + s.fg("error", `✗ ${first}`);
	}
	let line = elbow + s.fg("toolTitle", "Successfully loaded skill");
	if (state.expanded) {
		const lines = state.text.replace(/\n$/, "").split("\n");
		line += "\n" + lines.map((l) => INDENT + s.fg("toolOutput", l)).join("\n");
	}
	return line;
}

export function unknownSkillMessage(name: string, available: string[]): string {
	const list = available.length > 0 ? available.join(", ") : "none available";
	return `Unknown skill: ${name}. Available skills: ${list}`;
}

if (process.env.CLAUDE_SKILLS_SELFTEST) {
	const plain: Style = { fg: (_role, text) => text, bold: (text) => text };
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	check(callLine("ticket-resolve", plain) === "● Skill(ticket-resolve)", "call line");
	check(callLine(undefined, plain) === "● Skill(?)", "missing name");
	check(resultLine({ text: "x", isError: false, expanded: false, isPartial: false }, plain) === "  └ Successfully loaded skill", "collapsed result");
	check(resultLine({ text: "x", isError: false, expanded: false, isPartial: true }, plain) === "  └ …", "partial result");
	check(resultLine({ text: "nope\nrest", isError: true, expanded: false, isPartial: false }, plain) === "  └ ✗ nope", "error first line");
	check(resultLine({ text: "a\nb\n", isError: false, expanded: true, isPartial: false }, plain) === "  └ Successfully loaded skill\n    a\n    b", "expanded shows content");
	check(unknownSkillMessage("x", ["a", "b"]) === "Unknown skill: x. Available skills: a, b", "unknown skill message");
	check(unknownSkillMessage("x", []) === "Unknown skill: x. Available skills: none available", "no skills available");
}
