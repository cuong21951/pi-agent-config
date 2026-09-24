import { readFile } from "node:fs/promises";
import * as os from "node:os";
import { resolve } from "node:path";
import {
	AssistantMessageComponent,
	createEditToolDefinition,
	createFindToolDefinition,
	createGrepToolDefinition,
	createLsToolDefinition,
	createReadToolDefinition,
	createWriteToolDefinition,
	type ExtensionAPI,
	generateDiffString,
	getLanguageFromPath,
	keyHint,
	ToolExecutionComponent,
} from "@earendil-works/pi-coding-agent";
import { stripTerminalSequences, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { doneLine, editCreation, paint, resultRows, type Roots, type Row, type Style, target, WRITE_TOOLS, wrapRow, writeCallLine } from "./format.ts";
import { hangElbowRows, patchGenericTools } from "./generic.ts";
import { highlightClaudeStyle } from "./highlight.ts";
import "./markdown-highlight.ts";
import { clip, describeTool, dynamic, failed, finished, groupRow, hasThought, joinOnExecute, retried, shownContent, thoughtId, track, watch } from "./rows.ts";

// ponytail: only the render slots change; execute, schema and prompt metadata are the built-in definition's.
const DEFINITIONS = {
	read: createReadToolDefinition,
	write: createWriteToolDefinition,
	edit: createEditToolDefinition,
	grep: createGrepToolDefinition,
	find: createFindToolDefinition,
	ls: createLsToolDefinition,
};

type Theme = { fg: (role: never, text: string) => string; bold: (text: string) => string };

function style(theme: Theme): Style {
	return {
		fg: (role, text) => theme.fg(role as never, text),
		bold: (text) => theme.bold(text),
		home: os.homedir(),
		cwd: process.cwd(),
		// ponytail: no language, no colour — Claude bails the same way (`if (!e.lang) return [[plain, line]]`).
		code: (text, path) => {
			const lang = getLanguageFromPath(path);
			return lang ? (highlightClaudeStyle(text, lang) ?? text) : text;
		},
	};
}

function paintRows(row: Row, width: number): string[] {
	return wrapRow(row, width).map((piece) => {
		const text = stripTerminalSequences(truncateToWidth(piece.text, width));
		return paint(piece, text, Math.max(0, width - visibleWidth(text)));
	});
}

function indented(row: Row, width: number, indent: number): string[] {
	const margin = " ".repeat(Math.min(indent, Math.max(0, width - 1)));
	return paintRows(row, width - margin.length).map((line) => margin + line);
}

function describe(tool: string, args: Record<string, unknown>, roots: Roots): { activity?: string; hint?: string } {
	const named = target(tool, args, roots);
	const pattern = clip(String(args.pattern ?? ""));
	switch (tool) {
		case "read":
			return { activity: `Reading ${named}`, hint: named };
		case "grep":
			return { activity: `Searching for ${pattern}`, hint: named };
		case "find":
			return { activity: `Finding ${pattern}`, hint: named };
		case "ls":
			return { activity: `Listing ${named}`, hint: named };
		default:
			return {};
	}
}

type Execute = (id: string, params: any, signal?: AbortSignal, onUpdate?: unknown, ctx?: { cwd?: string }) => Promise<any>;

export const FILE_EXISTS = "Cannot create new file - file already exists.";

function editOrCreate(edit: Execute, write: Execute): Execute {
	return async (id, params, signal, onUpdate, ctx) => {
		const creation = editCreation(params ?? {});
		if (!creation) return edit(id, params, signal, onUpdate, ctx);
		const existing = await readFile(resolve(ctx?.cwd ?? process.cwd(), creation.path), "utf8").catch(() => "");
		if (existing.trim() !== "") throw new Error(FILE_EXISTS);
		const written = await write(id, creation, signal, onUpdate, ctx);
		return { ...written, details: { diff: generateDiffString(existing, creation.content).diff } };
	};
}

type Reply = { contentContainer: { children: unknown[]; clear(): void }; hideThinkingBlock?: boolean; isStreaming?: boolean };
type ReplyMessage = { stopReason?: string; timestamp?: number; content?: Array<{ type: string; thinking?: string }> };

const thoughts = ((globalThis as any)[Symbol.for("claude-tools:thoughts")] ??= { patched: false, theme: undefined }) as { patched: boolean; theme?: Theme };

function patchThoughts(proto: Record<string, unknown>): void {
	if (thoughts.patched || typeof proto.updateContent !== "function") return;
	const original = proto.updateContent as (this: Reply, message: ReplyMessage, ...rest: unknown[]) => unknown;
	proto.updateContent = function (this: Reply, message: ReplyMessage, ...rest: unknown[]) {
		const streaming = rest.length > 0 ? rest[0] === true : this.isStreaming === true;
		const shown = streaming && Array.isArray(message?.content) ? { ...message, content: shownContent(message.content, message.timestamp) } : message;
		const result = original.call(this, shown, ...rest);
		if (message?.stopReason === "error" && retried.has(message.timestamp ?? Number.NaN)) this.contentContainer.clear();
		else if (this.hideThinkingBlock && hasThought(shown?.content)) {
			const id = thoughtId(message);
			this.contentContainer.children.unshift(
				dynamic((width) => {
					const theme = thoughts.theme;
					const lines = theme ? groupRow(id, width, style(theme)) : [];
					return lines.length > 0 ? ["", ...lines.map((line) => truncateToWidth(line, width))] : [];
				}),
			);
		}
		return result;
	};
	thoughts.patched = true;
}

export default function (pi: ExtensionAPI) {
	track(pi);
	patchGenericTools(ToolExecutionComponent.prototype);
	hangElbowRows(ToolExecutionComponent.prototype);
	patchThoughts(AssistantMessageComponent.prototype as unknown as Record<string, unknown>);
	pi.on("session_start", (_event, ctx) => {
		if (ctx.hasUI) thoughts.theme = ctx.ui.theme as unknown as Theme;
	});
	const roots: Roots = { home: os.homedir(), cwd: process.cwd() };
	for (const [tool, create] of Object.entries(DEFINITIONS)) {
		const original = create(process.cwd()) as any;
		const execute = original.execute.bind(original);
		const writer = createWriteToolDefinition(process.cwd()) as any;
		describeTool(tool, (args) => describe(tool, args, roots));
		pi.registerTool({
			...original,
			execute: joinOnExecute(tool, tool === "edit" ? editOrCreate(execute, writer.execute.bind(writer)) : execute),
			renderShell: "self",
			renderCall(args: Record<string, unknown>, theme: Theme, context: { toolCallId?: string; expanded?: boolean; invalidate?: () => void }) {
				const s = style(theme);
				if (WRITE_TOOLS.has(tool)) return dynamic((width) => [truncateToWidth(writeCallLine(tool, args, s, failed.has(context.toolCallId ?? "")), width)]);
				const id = context.toolCallId ?? "";
				if (id !== "" && context.invalidate) watch(id, context.invalidate);
				return dynamic((width) => (context.expanded && finished.has(id) ? [] : groupRow(id, width, s).map((line) => truncateToWidth(line, width))));
			},
			renderResult(result: any, { expanded, isPartial }: { expanded: boolean; isPartial: boolean }, theme: Theme, context: { args: Record<string, unknown>; isError?: boolean; toolCallId?: string }) {
				const text = result.content
					.filter((block: { type: string }) => block.type === "text")
					.map((block: { text?: string }) => block.text ?? "")
					.join("\n");
				// ponytail: pi reports a failed tool through the render context, not on the result.
				const isError = result.isError === true || context.isError === true || failed.has(context.toolCallId ?? "");
				const outcome = { text, isError, details: result.details };
				const s = style(theme);
				const head = !WRITE_TOOLS.has(tool) && expanded && !isPartial ? [doneLine(tool, context.args, s)] : [];
				// ponytail: painted rows are already cut or wrapped to the width, so only the plain lines are truncated;
				// running them through it again would clip the escape that closes the background.
				return dynamic((width) => {
					const view = { expanded, isPartial, hint: keyHint("app.tools.expand", "to expand") };
					const rows = resultRows(tool, context.args, outcome, view, s);
					return [
						...head.map((line) => truncateToWidth(line, width)),
						...(rows ? [truncateToWidth(rows.head, width), ...rows.rows.flatMap((row) => indented(row, width, rows.indent))] : []),
					];
				});
			},
		});
	}
}

if (process.env.CLAUDE_EDIT_CREATE_SELFTEST) {
	const { mkdtempSync, writeFileSync } = await import("node:fs");
	const check = (ok: boolean, msg: string) => {
		if (!ok) throw new Error(`FAIL: ${msg}`);
		console.log(`ok - ${msg}`);
	};
	const cwd = mkdtempSync(resolve(os.tmpdir(), "edit-create-"));
	writeFileSync(resolve(cwd, "full.txt"), "alpha: 1\n");
	writeFileSync(resolve(cwd, "blank.txt"), "\n");
	const calls: string[] = [];
	const edit: Execute = async (_id, params) => (calls.push(`edit:${params.path}`), { content: [{ type: "text", text: "edited" }], details: { diff: "" } });
	const write: Execute = async (_id, params) => (calls.push(`write:${params.path}:${params.content}`), { content: [{ type: "text", text: "wrote" }] });
	const run = editOrCreate(edit, write);
	const created = await run("1", { path: "todo.md", edits: [{ oldText: "", newText: "# Todo\n- a\n" }] }, undefined, undefined, { cwd });
	check(calls.at(-1) === "write:todo.md:# Todo\n- a\n", "an empty old text on a missing file writes the new text, like Claude's Create");
	check(String(created.details.diff).split("\n").filter((line: string) => line.startsWith("+")).length === 2, "and carries an all-added diff so the row reads Added 2 lines");
	await run("2", { path: "blank.txt", edits: [{ oldText: "", newText: "x\n" }] }, undefined, undefined, { cwd });
	check(calls.at(-1) === "write:blank.txt:x\n", "a whitespace-only file is filled too (Claude: ke.trim() === \"\")");
	const refused = await run("3", { path: "full.txt", edits: [{ oldText: "", newText: "x" }] }, undefined, undefined, { cwd }).then(() => "", (error: Error) => error.message);
	check(refused === FILE_EXISTS && !calls.some((c) => c.startsWith("write:full.txt")), "a file with content is refused with Claude's own message and left alone");
	await run("4", { path: "full.txt", edits: [{ oldText: "alpha", newText: "beta" }] }, undefined, undefined, { cwd });
	check(calls.at(-1) === "edit:full.txt", "any other edit goes to pi's edit unchanged");
	console.log("All claude-tools edit-create checks passed.");
}
