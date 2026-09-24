import { stripTerminalSequences, truncateToWidth } from "@earendil-works/pi-tui";
import { type Brush, dynamic, failed, finished, groupRow, join, summaryFor, watch } from "./rows.ts";

export type Paint = (role: string, text: string) => string;
export type Theme = { fg: (role: never, text: string) => string; bold: (text: string) => string };

const ELBOW = "  ⎿  ";

// ponytail: pi draws a tool nobody registered a renderer for as a bare bold name and a raw text dump.
// Claude has no such row — an unrecognised tool only adds "called N tools" to the grey group sentence.
// These two are the whole visible behaviour, kept pure so the selftest can reach them.
export function fallbackCall(id: string, width: number, brush: Brush): string[] {
	return groupRow(id, width, brush).map((line) => truncateToWidth(line, width));
}

export function fallbackResult(toolName: string, group: string | null, error: string, paint: Paint): string[] {
	if (group === "") return [];
	if (group !== null) return [paint("muted", group)];
	if (error !== "") return [paint("muted", ELBOW) + paint("error", error)];
	return [paint("muted", `Ran ${toolName}`)];
}

export function textOf(result: { content?: Array<{ type: string; text?: string }> } | undefined): string {
	return (result?.content ?? [])
		.filter((block) => block.type === "text")
		.map((block) => block.text ?? "")
		.join("\n");
}

// ponytail: additive on purpose — a tool that already renders itself is never touched, so this cannot
// fight claude-tools, intent-tools or the mcp adapter. Re-registering the tool instead would not work:
// pi resolves a tool name first-registration-wins and loads ~/.pi/agent/extensions last, so a package's
// tool can never be taken over from here. Patching the component sidesteps the load order entirely.
// The Symbol.for guard makes a reload a no-op; pi-coding-agent itself is not re-imported by one.
const PATCHED = Symbol.for("claude-tools:generic-tool-fallback");

export function patchGenericTools(prototype: object): void {
	const proto = prototype as Record<string, unknown> & { [PATCHED]?: boolean };
	if (proto[PATCHED]) return;
	const hasOwnRenderer = proto.hasRendererDefinition as (this: unknown) => boolean;
	const shellOf = proto.getRenderShell as (this: unknown) => string;
	const callOf = proto.getCallRenderer as (this: unknown) => unknown;
	const resultOf = proto.getResultRenderer as (this: unknown) => unknown;
	// ponytail: a pi that renamed any of these keeps its own rendering rather than losing the row.
	if ([hasOwnRenderer, shellOf, callOf, resultOf].some((fn) => typeof fn !== "function")) return;

	type Slot = { toolName: string; toolCallId?: string };
	const paintWith = (theme: Theme): Paint => (role, text) => theme.fg(role as never, text);
	const brushWith = (theme: Theme): Brush => ({ fg: paintWith(theme), bold: (text) => theme.bold(text) });
	const rendersItself = (slot: Slot) => hasOwnRenderer.call(slot) && (callOf.call(slot) !== undefined || resultOf.call(slot) !== undefined);

	proto.hasRendererDefinition = function () {
		return true;
	};
	proto.getRenderShell = function (this: Slot) {
		return rendersItself(this) ? shellOf.call(this) : "self";
	};
	proto.getCallRenderer = function (this: Slot) {
		if (rendersItself(this)) return callOf.call(this);
		return (_args: unknown, theme: Theme, context: { toolCallId?: string }) => dynamic((width) => fallbackCall(context.toolCallId ?? "", width, brushWith(theme)));
	};
	proto.getResultRenderer = function (this: Slot) {
		if (rendersItself(this)) return resultOf.call(this);
		const name = this.toolName;
		return (
			result: { content?: Array<{ type: string; text?: string }>; isError?: boolean },
			view: { isPartial: boolean },
			theme: Theme,
			context: { toolCallId?: string; isError?: boolean; invalidate?: () => void },
		) => {
			const id = context.toolCallId ?? "";
			if (id !== "" && context.invalidate) watch(id, context.invalidate);
			const broken = result?.isError === true || context.isError === true || failed.has(id);
			const error = broken ? (textOf(result).split("\n")[0] ?? "") : "";
			return dynamic(() => (view.isPartial || summaryFor(id) !== null ? [] : fallbackResult(name, null, error, paintWith(theme))));
		};
	};
	proto[PATCHED] = true;
}

const ELBOW_HUNG = Symbol.for("claude-tools:elbow-hung");

export function hangElbow(lines: string[]): string[] {
	return lines[0] === "" && stripTerminalSequences(lines[1] ?? "").startsWith("  ⎿") ? lines.slice(1) : lines;
}

export function hangElbowRows(prototype: object): void {
	const proto = prototype as Record<string, unknown> & { [ELBOW_HUNG]?: boolean };
	if (proto[ELBOW_HUNG] || typeof proto.render !== "function") return;
	const render = proto.render as (this: unknown, width: number) => string[];
	proto.render = function (this: unknown, width: number) {
		return hangElbow(render.call(this, width));
	};
	proto[ELBOW_HUNG] = true;
}


if (process.env.CLAUDE_FALLBACK_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain: Paint = (_role, text) => text;
	const tagged: Paint = (role, text) => `<${role}>${text}</${role}>`;
	const brush: Brush = { fg: plain, bold: (text) => text };

	join("gx1", "mcp");
	check(/^(● |  )Calling 1 tool…$/.test(fallbackCall("gx1", 80, brush).join("|")), "a running unknown tool draws its active group, Claude's \"Calling 1 tool…\" behind the blinking dot");
	finished.add("gx1");
	check(fallbackCall("gx1", 80, brush).join("|") === "  Called 1 tool", "once finished and the turn is idle it is the grey past sentence");
	check(fallbackCall("gx-unplaced", 80, brush).length === 0, "a call that never started executing draws nothing");
	check(fallbackResult("mcp", "", "", plain).length === 0, "a hidden group member draws nothing");
	check(fallbackResult("mcp", "Read 1 file, called 1 tool", "", tagged)[0] === "<muted>Read 1 file, called 1 tool</muted>", "the last member draws the sentence");
	check(fallbackResult("mcp", null, "", plain)[0] === "Ran mcp", "outside a group it falls back to naming the tool");
	check(fallbackResult("mcp", null, "boom", tagged)[0] === "<muted>  ⎿  </muted><error>boom</error>", "an error outside a group stays visible under the elbow, with no ✗");
	check(fallbackResult("mcp", "  Called 1 tool", "boom", plain).join("|") === "  Called 1 tool", "a failed call inside a group folds into the sentence like Claude 2.1.280");
	check(fallbackResult("mcp", "", "boom", plain).length === 0, "a failed hidden member draws nothing");
	const fake = () => ({
		hasRendererDefinition(this: { toolDefinition?: unknown }) {
			return this.toolDefinition !== undefined;
		},
		getRenderShell() {
			return "default";
		},
		getCallRenderer(this: { toolDefinition?: { renderCall?: unknown } }) {
			return this.toolDefinition?.renderCall;
		},
		getResultRenderer(this: { toolDefinition?: { renderResult?: unknown } }) {
			return this.toolDefinition?.renderResult;
		},
	}) as Record<string, any>;

	const proto = fake();
	patchGenericTools(proto);
	patchGenericTools(proto);
	const owned = { toolDefinition: { renderCall: "MINE", renderResult: "MINE" }, toolName: "read" };
	const orphan = { toolDefinition: undefined, toolName: "mcp" };
	check(proto.getRenderShell.call(owned) === "default" && proto.getCallRenderer.call(owned) === "MINE", "a tool that renders itself is left completely alone");
	check(proto.getRenderShell.call(orphan) === "self" && typeof proto.getCallRenderer.call(orphan) === "function", "an unrendered tool is taken over with its own shell");
	check(proto.hasRendererDefinition.call(orphan) === true, "the component is told a renderer exists so it uses the render path, not the raw dump");
	const unrendered = { toolDefinition: { name: "get_subagent_result" }, toolName: "get_subagent_result" };
	check(
		proto.getRenderShell.call(unrendered) === "self" && typeof proto.getCallRenderer.call(unrendered) === "function" && typeof proto.getResultRenderer.call(unrendered) === "function",
		"a registered tool with no renderers of its own (pi 0.85.1 counts it as having a definition) is taken over too",
	);
	const theme = { fg: (_role: never, text: string) => text, bold: (text: string) => text };
	check(proto.getCallRenderer.call(orphan)({}, theme, { toolCallId: "gx1" }).render(80).join("|") === "  Called 1 tool", "the taken-over call row draws the tool's group");
	check(proto.getResultRenderer.call(orphan)({ content: [] }, { isPartial: false }, theme, { toolCallId: "gx1" }).render(80).length === 0, "and its result row draws nothing, so the group is not drawn twice");
	const bare = fake();
	delete bare.getCallRenderer;
	patchGenericTools(bare);
	check(bare.getRenderShell.call(orphan) === "default", "a pi that renamed a method keeps its own rendering instead of losing the row");

	const grey = (text: string) => `\x1b[38;2;153;153;153m${text}\x1b[39m`;
	check(hangElbow(["", grey("  ⎿  ") + "Invalid tool parameters"]).length === 1, "a tool whose first row is an elbow hangs from the row above, like Claude's null tool-use row (Thought for 9s / ⎿ Invalid tool parameters, no gap)");
	check(hangElbow(["", "● Update(a.ts)", "  ⎿  Added 1 line"]).length === 3, "a tool that opens with its own ● row keeps the gap above it");
	check(hangElbow([]).length === 0 && hangElbow(["  ⎿  x"]).length === 1, "nothing to hang: unchanged");
	const component = { render: (_width: number) => ["", "  ⎿  x"] };
	hangElbowRows(component);
	hangElbowRows(component);
	check(component.render(80).join("|") === "  ⎿  x", "the component patch applies once");

	console.log("All claude-tools fallback checks passed.");
}
