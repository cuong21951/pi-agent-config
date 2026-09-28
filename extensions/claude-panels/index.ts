import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isEditToolResult, isWriteToolResult } from "@earendil-works/pi-coding-agent";
import { registerContextPanel } from "./context.ts";
import { registerStatusPanel, type McpStatusSnapshotLike } from "./status.ts";
import { createUsageTracker, diffLineCounts, registerUsagePanel, writeLineCounts } from "./usage.ts";

const MCP_STATUS_EVENT = "pi-mcp-adapter/status/v1";

export default function (pi: ExtensionAPI) {
	const tracker = createUsageTracker();
	let sessionStartMs = Date.now();
	let mcpSnapshot: McpStatusSnapshotLike | undefined;

	pi.on("session_start", () => {
		sessionStartMs = Date.now();
		mcpSnapshot = undefined;
		pi.events.on(MCP_STATUS_EVENT, (data) => {
			mcpSnapshot = data as McpStatusSnapshotLike;
		});
	});

	pi.on("agent_start", () => tracker.recordAgentStart(Date.now()));
	pi.on("agent_end", () => tracker.recordAgentEnd(Date.now()));

	pi.on("tool_result", (event) => {
		if (event.isError) return;
		if (isEditToolResult(event) && event.details?.diff) {
			const { added, removed } = diffLineCounts(event.details.diff);
			tracker.recordCodeChange(added, removed);
		} else if (isWriteToolResult(event)) {
			const content = typeof event.input.content === "string" ? event.input.content : "";
			const { added, removed } = writeLineCounts(content);
			tracker.recordCodeChange(added, removed);
		}
	});

	registerContextPanel(pi);
	registerStatusPanel(pi, () => mcpSnapshot);
	registerUsagePanel(pi, tracker, () => sessionStartMs);
}
