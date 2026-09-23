import * as os from "node:os";
import {
	AssistantMessageComponent,
	createEditToolDefinition,
	createFindToolDefinition,
	createGrepToolDefinition,
	createLsToolDefinition,
	createReadToolDefinition,
	createWriteToolDefinition,
	type ExtensionAPI,
	getLanguageFromPath,
	keyHint,
	ToolExecutionComponent,
} from "@earendil-works/pi-coding-agent";
import { stripTerminalSequences, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { doneLine, paint, resultRows, type Roots, type Row, type Style, target, WRITE_TOOLS, wrapRow, writeCallLine } from "./format.ts";
import { patchGenericTools } from "./generic.ts";
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
	patchThoughts(AssistantMessageComponent.prototype as unknown as Record<string, unknown>);
	pi.on("session_start", (_event, ctx) => {
		if (ctx.hasUI) thoughts.theme = ctx.ui.theme as unknown as Theme;
	});
	const roots: Roots = { home: os.homedir(), cwd: process.cwd() };
	for (const [tool, create] of Object.entries(DEFINITIONS)) {
		const original = create(process.cwd()) as any;
		describeTool(tool, (args) => describe(tool, args, roots));
		pi.registerTool({
			...original,
			execute: joinOnExecute(tool, original.execute.bind(original)),
			renderShell: "self",
			renderCall(args: Record<string, unknown>, theme: Theme, context: { toolCallId?: string; expanded?: boolean; invalidate?: () => void }) {
				const s = style(theme);
				if (WRITE_TOOLS.has(tool)) return dynamic((width) => [truncateToWidth(writeCallLine(tool, args, s), width)]);
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
