import { createBashTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { closeSync, openSync, readSync } from "node:fs";
import { describeTool, dynamic, failed, finished, groupRow, joinOnExecute, watch } from "../claude-tools/rows.ts";
import { CLAUDE_BASH_MAX_CHARS, DEFAULT_TIMEOUT_SECONDS, describeBash, displayOutput, rejectedLines, resultLines, verboseCallLine, withDefaultTimeout } from "./render.ts";

const heads = new Map<string, string | undefined>();

function readHead(path: string): string | undefined {
	if (!heads.has(path)) heads.set(path, readFileHead(path));
	return heads.get(path);
}

function readFileHead(path: string): string | undefined {
	try {
		const fd = openSync(path, "r");
		try {
			const buffer = Buffer.alloc(CLAUDE_BASH_MAX_CHARS * 4);
			return buffer.subarray(0, readSync(fd, buffer, 0, buffer.length, 0)).toString("utf8");
		} finally {
			closeSync(fd);
		}
	} catch {
		return undefined;
	}
}

export default function (pi: ExtensionAPI) {
	const originalBash = createBashTool(process.cwd());
	const params = originalBash.parameters as Record<string, any>;
	const run = joinOnExecute("bash", (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any) => originalBash.execute(toolCallId, withDefaultTimeout(params), signal, onUpdate));
	describeTool("bash", describeBash);

	pi.registerTool({
		name: "bash",
		label: "bash",
		description:
			originalBash.description +
			"\nWhen you call bash, also provide a short `description` field stating in plain language what the command does (e.g. \"Check git status\"). The transcript shows this as the label." +
			`\nA command is stopped after ${DEFAULT_TIMEOUT_SECONDS} seconds unless you pass a longer \`timeout\` (seconds) — do that for builds, test suites and other known-slow work.`,
		renderShell: "self",
		parameters: {
			...params,
			properties: {
				...(params.properties ?? {}),
				description: { type: "string", description: "Short human-readable label of what the command does." },
				timeout: { type: "number", description: `Timeout in seconds (default ${DEFAULT_TIMEOUT_SECONDS}).` },
			},
		},

		async execute(toolCallId, params, signal, onUpdate) {
			return run(toolCallId, params, signal, onUpdate);
		},

		renderCall(_args, theme, context) {
			const id = (context as { toolCallId?: string })?.toolCallId ?? "";
			const invalidate = (context as { invalidate?: () => void })?.invalidate;
			if (id && invalidate) watch(id, invalidate);
			const expanded = (context as { expanded?: boolean })?.expanded === true;
			return dynamic((width) => (expanded && finished.has(id) ? [] : groupRow(id, width, theme).map((line) => truncateToWidth(line, width))));
		},

		renderResult(result, { expanded, isPartial }, theme, context) {
			const content = result.content[0];
			const output = content?.type === "text" ? content.text : "";
			const rejected = isPartial ? null : rejectedLines(output, theme);
			if (rejected) return dynamic((width) => rejected.map((line) => truncateToWidth(line, width)));
			if (isPartial || !expanded) return dynamic(() => []);
			const args = (context as { args?: { command?: unknown; description?: unknown } })?.args ?? {};
			const command = String(args.command ?? "");
			const exitMatch = output.match(/exit(?:ed with)? code:? (\d+)/);
			const id = (context as { toolCallId?: string })?.toolCallId ?? "";
			const exitCode = exitMatch ? parseInt(exitMatch[1], 10) : failed.has(id) ? 1 : null;
			const lines = resultLines(displayOutput(output, readHead), exitCode, expanded, theme);
			const failedCall = exitCode !== 0 && exitCode !== null;
			return dynamic((width) => [verboseCallLine(command, failedCall, theme), ...(lines ?? [])].map((line) => truncateToWidth(line, width)));
		},
	});
}
