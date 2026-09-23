import * as os from "node:os";
import {
	createEditToolDefinition,
	createFindToolDefinition,
	createGrepToolDefinition,
	createLsToolDefinition,
	createReadToolDefinition,
	createWriteToolDefinition,
	type ExtensionAPI,
	getLanguageFromPath,
	highlightCode,
	keyHint,
	ToolExecutionComponent,
} from "@earendil-works/pi-coding-agent";
import { stripTerminalSequences, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { doneLine, paint, resultRows, type Row, runningLine, type Style, WRITE_TOOLS, wrapRow, writeCallLine } from "./format.ts";
import { patchGenericTools } from "./generic.ts";
import { blinkOn, dynamic, failed, finished, summaryFor, track, watch } from "./rows.ts";

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
		// pi's highlighter instead paints an unlexed file in its plain-code-block green, which turned a
		// .txt preview into a wall of green.
		code: (text, path) => {
			const lang = getLanguageFromPath(path);
			return lang ? (highlightCode(text, lang)[0] ?? text) : text;
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

export default function (pi: ExtensionAPI) {
	track(pi);
	patchGenericTools(ToolExecutionComponent.prototype);
	for (const [tool, create] of Object.entries(DEFINITIONS)) {
		const original = create(process.cwd()) as any;
		pi.registerTool({
			...original,
			renderShell: "self",
			// ponytail: the finished grey line lives in the result row; the call row goes to zero lines so the
			// block is one line plus pi's own spacing, the closest pi allows to Claude's collapsed rows.
			renderCall(args: Record<string, unknown>, theme: Theme, context: { toolCallId?: string }) {
				const s = style(theme);
				if (WRITE_TOOLS.has(tool)) return dynamic((width) => [truncateToWidth(writeCallLine(tool, args, s), width)]);
				return dynamic((width) => (finished.has(context.toolCallId ?? "") ? [] : [truncateToWidth(runningLine(tool, args, blinkOn(), s), width)]));
			},
			renderResult(result: any, { expanded, isPartial }: { expanded: boolean; isPartial: boolean }, theme: Theme, context: { args: Record<string, unknown>; isError?: boolean; toolCallId?: string; invalidate?: () => void }) {
				if (context.toolCallId && context.invalidate) watch(context.toolCallId, context.invalidate);
				const text = result.content
					.filter((block: { type: string }) => block.type === "text")
					.map((block: { text?: string }) => block.text ?? "")
					.join("\n");
				// ponytail: pi reports a failed tool through the render context, not on the result.
				const isError = result.isError === true || context.isError === true || failed.has(context.toolCallId ?? "");
				const outcome = { text, isError, details: result.details };
				const view = { expanded, isPartial, hint: keyHint("app.tools.expand", "to expand") };
				const s = style(theme);
				const rows = resultRows(tool, context.args, outcome, view, s);
				const group = WRITE_TOOLS.has(tool) || isPartial || expanded ? null : summaryFor(context.toolCallId ?? "", s.bold);
				if (group === "") return dynamic(() => []);
				const head = WRITE_TOOLS.has(tool) || isPartial ? [] : [group === null ? doneLine(tool, context.args, s) : s.fg("muted", group)];
				// ponytail: painted rows are already cut or wrapped to the width, so only the plain lines are truncated;
				// running them through it again would clip the escape that closes the background.
				return dynamic((width) => [
					...head.map((line) => truncateToWidth(line, width)),
					...(rows ? [truncateToWidth(rows.head, width), ...rows.rows.flatMap((row) => indented(row, width, rows.indent))] : []),
				]);
			},
		});
	}
}
