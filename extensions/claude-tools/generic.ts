import { blinkOn, dynamic, failed, finished, summaryFor, watch } from "./rows.ts";

export type Paint = (role: string, text: string) => string;
export type Theme = { fg: (role: never, text: string) => string; bold: (text: string) => string };

const ELBOW = "  ⎿  ";

// ponytail: pi draws a tool nobody registered a renderer for as a bare bold name and a raw text dump.
// Claude has no such row — an unrecognised tool only adds "called N tools" to the grey group sentence.
// These two are the whole visible behaviour, kept pure so the selftest can reach them.
export function fallbackCall(toolName: string, done: boolean, blink: boolean, paint: Paint): string[] {
	return done ? [] : [(blink ? paint("muted", "● ") : "  ") + `Running ${toolName}`];
}

export function fallbackResult(toolName: string, group: string | null, error: string, paint: Paint): string[] {
	if (error !== "") return [paint("muted", ELBOW) + paint("error", error)];
	if (group === "") return [];
	return [paint("muted", group ?? `Ran ${toolName}`)];
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

	proto.hasRendererDefinition = function () {
		return true;
	};
	proto.getRenderShell = function (this: Slot) {
		return hasOwnRenderer.call(this) ? shellOf.call(this) : "self";
	};
	proto.getCallRenderer = function (this: Slot) {
		if (hasOwnRenderer.call(this)) return callOf.call(this);
		const name = this.toolName;
		return (_args: unknown, theme: Theme, context: { toolCallId?: string }) =>
			dynamic(() => fallbackCall(name, finished.has(context.toolCallId ?? ""), blinkOn(), paintWith(theme)));
	};
	proto.getResultRenderer = function (this: Slot) {
		if (hasOwnRenderer.call(this)) return resultOf.call(this);
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
			return dynamic(() => (view.isPartial ? [] : fallbackResult(name, summaryFor(id, theme.bold), error, paintWith(theme))));
		};
	};
	proto[PATCHED] = true;
}


if (process.env.CLAUDE_FALLBACK_SELFTEST) {
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const plain: Paint = (_role, text) => text;
	const tagged: Paint = (role, text) => `<${role}>${text}</${role}>`;

	check(fallbackCall("mcp", false, true, plain) .join("") === "● Running mcp", "a running unknown tool names itself behind the blinking dot");
	check(fallbackCall("mcp", false, false, plain)[0] === "  Running mcp", "blink off keeps the column");
	check(fallbackCall("mcp", true, true, plain).length === 0, "a finished one draws nothing — the group sentence covers it");
	check(fallbackResult("mcp", "", "", plain).length === 0, "a hidden group member draws nothing");
	check(fallbackResult("mcp", "Read 1 file, called 1 tool", "", tagged)[0] === "<muted>Read 1 file, called 1 tool</muted>", "the last member draws the sentence");
	check(fallbackResult("mcp", null, "", plain)[0] === "Ran mcp", "outside a group it falls back to naming the tool");
	check(fallbackResult("mcp", null, "boom", tagged)[0] === "<muted>  ⎿  </muted><error>boom</error>", "an error stays visible under the elbow, with no ✗");
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
	const theme = { fg: (_role: never, text: string) => text, bold: (text: string) => text };
	check(JSON.stringify(proto.getCallRenderer.call(orphan)({}, theme, { toolCallId: "zz" }).render(80)).includes("Running mcp"), "the taken-over call row names the tool");
	const bare = fake();
	delete bare.getCallRenderer;
	patchGenericTools(bare);
	check(bare.getRenderShell.call(orphan) === "default", "a pi that renamed a method keeps its own rendering instead of losing the row");

	console.log("All claude-tools fallback checks passed.");
}
