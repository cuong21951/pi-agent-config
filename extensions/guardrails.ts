/**
 * Guardrails — deterministic enforcement of Cuong's "risky actions" + path-protection
 * rules from AGENTS.md, which currently only advise. pi's tool_call event is the
 * PreToolUse equivalent of ECC's guardrail hooks.
 *
 *   - Confirm before the agent runs a dangerous bash command (destructive git, rm -rf, force-push).
 *   - Hard-block writes/edits to private-key & credential files.
 *   - Confirm before writes/edits to .env* and Azure Pipelines YAML.
 *
 * Non-interactive mode (no UI): dangerous commands are blocked by default (fail-safe).
 *
 * Yolo ("bypass permissions") mode means nothing asks: both confirmations below are
 * skipped while the permission-system config has yoloMode on. Hard blocks on
 * credential files stay — they refuse outright, they never prompt.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	// Bash commands the agent must confirm before running.
	const confirmCommands: RegExp[] = [
		/\bgit\s+reset\s+--hard\b/i,
		/\bgit\s+checkout\s+(\.|--)/i,
		/\bgit\s+restore\s+(\.|--)/i,
		/\bgit\s+clean\s+-/i,
		/\bgit\s+branch\s+-[dD]\b/i,
		/\bgit\s+worktree\s+remove\b/i,
		/\bgit\s+push\b.*--force/i,
		/\bno-verify\b/i,
		/\brm\s+(-rf|--recursive)/i,
		/\b(drop|truncate)\s+table\b/i,
	];

	// Write/edit to these paths is blocked outright (secrets / credentials).
	const blockFiles: RegExp[] = [
		/(^|[\\/])id_(rsa|ed25519)$/i,
		/(^|[\\/])\.git-credentials$/i,
		/(^|[\\/])\.aws[\\/]credentials$/i,
		/\.(pem|key|p12)$/i,
	];

	// Write/edit to these paths requires confirmation.
	const confirmFiles: RegExp[] = [
		/(^|[\\/])\.env($|\.)/i,
		/azure-pipelines[^\\/]*\.ya?ml$/i,
		/\.pipeline[^\\/]*\.ya?ml$/i,
	];

	// ponytail: same flag claude-modes syncs on every shift+tab. Read per call so a
	// mid-session mode switch applies immediately; unreadable config fails safe (ask).
	const PERMISSION_CONFIG =
		process.env.CLAUDE_MODES_PERMISSION_CONFIG ?? join(getAgentDir(), "extensions", "pi-permission-system", "config.json");

	function isYolo(): boolean {
		try {
			return JSON.parse(readFileSync(PERMISSION_CONFIG, "utf8")).yoloMode === true;
		} catch {
			return false;
		}
	}

	pi.on("tool_call", async (event, ctx) => {
		const yolo = isYolo();
		if (event.toolName === "bash") {
			const command = (event.input as { command: string }).command;
			if (!yolo && confirmCommands.some((p) => p.test(command))) {
				if (!ctx.hasUI) return { block: true, reason: "Dangerous command (no UI to confirm)" };
				const ok = await ctx.ui.confirm("Confirm dangerous command", command);
				if (!ok) return { block: true, reason: "Blocked by user" };
			}
			return undefined;
		}

		if (event.toolName === "write" || event.toolName === "edit") {
			const path = (event.input as { path: string }).path;
			if (blockFiles.some((p) => p.test(path))) {
				if (ctx.hasUI) ctx.ui.notify(`Blocked write to protected file: ${path}`, "warning");
				return { block: true, reason: `Path "${path}" is protected` };
			}
			if (!yolo && confirmFiles.some((p) => p.test(path))) {
				if (!ctx.hasUI) return { block: true, reason: "Protected file (no UI to confirm)" };
				const ok = await ctx.ui.confirm("Confirm editing protected file", path);
				if (!ok) return { block: true, reason: "Blocked by user" };
			}
		}

		return undefined;
	});
}
