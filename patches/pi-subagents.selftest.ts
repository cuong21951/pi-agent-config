import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PI_DIR } from "../scripts/pi-installs.mjs";

const { createJiti } = await import(
  pathToFileURL(path.join(PI_DIR, "node_modules/jiti/lib/jiti-static.mjs")).href
);
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": path.join(PI_DIR, "dist/index.js"),
    "@earendil-works/pi-tui": path.join(PI_DIR, "node_modules/@earendil-works/pi-tui/dist/index.js"),
  },
});

const here = path.dirname(fileURLToPath(import.meta.url));
const { FleetList, fleetMainLine, fleetRowLine, fleetWindow, formatFleetElapsed, formatFleetTokens } = await jiti.import(
  path.join(here, "../npm/node_modules/@tintinweb/pi-subagents/src/ui/fleet-list.ts"),
);

const plain = { fg: (_role: string, text: string) => text, bold: (text: string) => text };
const tagged = { fg: (role: string, text: string) => `<${role}>${text}</>`, bold: (text: string) => `<b>${text}</b>` };
const DOWN = "\x1b[B";

{
  const row = { selected: false, viewed: false, name: "general-purpose", named: false, description: "Say ok", status: "3s" };
  const line = fleetRowLine(row, 15, 2, 132, plain);
  assert.equal(line, `  ◯ general-purpose  Say ok${" ".repeat(101)}3s`);
  assert.equal(line.length, 130);
  assert.equal(fleetRowLine(row, 15, 2, 132, tagged), `<muted>  </><muted>◯ </><muted>general-purpose</>  <muted>Say ok</>${" ".repeat(101)}<muted>3s</>`);
  assert.equal(fleetMainLine(false, true, 0, 132, tagged), "<b>  ● main</b>");
  console.log("PASS: a running agent row is Claude 2.1.280's measured \"  ◯ general-purpose  Say ok … 3s\": all dim 999999, elapsed right-aligned two columns in, under a bold \"  ● main\"");
}

{
  const selected = fleetRowLine({ selected: true, viewed: false, name: "Explore", named: false, description: "Find it", status: "1m 5s · ↓ 12.3k tokens" }, 7, 22, 80, tagged);
  assert.ok(selected.startsWith("❯ ◯ Explore  Find it") && !selected.includes("<muted>"));
  const failed = fleetRowLine({ selected: false, viewed: false, bulletRole: "error", name: "Explore", named: true, description: "Find it", status: "4s" }, 7, 2, 80, tagged);
  assert.ok(failed.startsWith("<muted>  </><error>◯ </>Explore  <muted>Find it</>"));
  assert.equal(fleetMainLine(true, false, 2, 40, plain), `❯ ◯ main${" ".repeat(22)}↑ 2 more`);
  console.log("PASS: selection is a ❯ pointer with the row undimmed; a failed agent's ◯ is red; a named agent's name is undimmed; hidden rows above read \"↑ N more\" on the main row (Claude's f4/p4 rows)");
}

{
  assert.deepEqual([0, 999, 59999, 60000, 119600, 3599700, 90061000].map(formatFleetElapsed), ["0s", "0s", "59s", "1m 0s", "2m 0s", "1h 0m 0s", "1d 1h 1m"]);
  assert.deepEqual([999, 1000, 67600, 1234567].map((count) => formatFleetTokens(count)), ["↓ 999 tokens", "↓ 1.0k tokens", "↓ 67.6k tokens", "↓ 1.2m tokens"]);
  assert.equal(formatFleetTokens(1200, "↑"), "↑ 1.2k tokens");
  assert.deepEqual([fleetWindow(0, 3), fleetWindow(7, 9), fleetWindow(2, 9)], [{ start: 0, end: 3 }, { start: 3, end: 8 }, { start: 0, end: 5 }]);
  console.log("PASS: elapsed is Claude's Gt (floored seconds under a minute, then rounded m/h/d), tokens are Ts compact lower-case, five rows shown around the focus");
}

{
  const now = Date.now();
  const record = (id: string, extra: Record<string, unknown>) => ({ id, type: "general-purpose", description: `agent ${id}`, toolUses: 0, startedAt: now - 3000, lifetimeUsage: { input: 0, output: 0, cacheWrite: 0 }, isBackground: true, status: "running", ...extra });
  const records = [
    record("run", {}),
    record("done", { status: "completed", completedAt: now - 1000 }),
    record("failed", { status: "error", completedAt: now - 1000 }),
    record("stale", { status: "error", completedAt: now - 31000 }),
    record("fgdone", { status: "error", completedAt: now - 1000, isBackground: false }),
    record("nested", { parentAgentId: "run" }),
  ];
  const aborted: string[] = [];
  const fleet = new FleetList({ listAgents: () => records, abort: (id: string) => aborted.push(id) } as never, new Map());
  let handler: (data: string) => { consume?: boolean } | undefined = () => undefined;
  fleet.setUICtx({ setWidget() {}, onTerminalInput: (h: typeof handler) => { handler = h; return () => {}; }, getEditorText: () => "", notify() {}, custom: async () => undefined } as never);
  const shown = fleet.lines(100, plain);
  assert.equal(shown.length, 4);
  assert.equal(shown[0], "");
  assert.equal(shown[1], "  ● main");
  assert.ok(shown[2].startsWith("  ◯ general-purpose (+1)  agent run") && shown[2].endsWith(" 3s"));
  assert.ok(shown[3].startsWith("  ◯ general-purpose       agent failed") && shown[3].endsWith(" 2s"));
  assert.equal(fleet.hint(plain), undefined);
  assert.deepEqual(handler(DOWN), { consume: true });
  assert.equal(fleet.hint(plain), "↑/↓ to select");
  assert.equal(fleet.lines(100, plain)[1], "❯ ● main");
  handler(DOWN);
  assert.equal(fleet.hint(plain), "Enter to view · x to stop");
  assert.ok(fleet.lines(100, plain)[2].startsWith("❯ ◯ general-purpose"));
  handler("x");
  assert.deepEqual(aborted, ["run"]);
  handler(DOWN);
  assert.equal(fleet.hint(plain), "Enter to view · x to clear");
  handler("x");
  assert.equal(fleet.lines(100, plain).length, 3);
  assert.equal(fleet.hint(plain), "Enter to view · x to stop");
  handler("\x1b");
  assert.equal(fleet.hint(plain), undefined);
  fleet.dispose();
  console.log("PASS: the list holds running agents and failed background ones for 30s, never completed or foreground-finished ones; a parent counts its live nested agents as (+N) (m6f-measure4 foreground); ↓ focuses main with \"↑/↓ to select\" (Claude 2.1.281 dropped Enter to view on main), then \"Enter to view · x to stop|clear\"; x stops or clears; Esc leaves");
}

{
  const now = Date.now();
  const messages = [{ role: "user", content: "Read TASK.md" }];
  const agent = { id: "a1", type: "general-purpose", description: "Check files", toolUses: 0, startedAt: now - 3000, lifetimeUsage: { input: 0, output: 5, cacheWrite: 0 }, isBackground: true, status: "running", session: { messages, subscribe: () => () => {} } };
  const calls: string[] = [];
  (globalThis as Record<string, unknown>).__claudeChatView = { show: (m: unknown[]) => calls.push(`show:${m.length}`), hide: () => calls.push("hide") };
  const manager = { listAgents: () => [agent], getRecord: (id: string) => (id === agent.id ? agent : undefined), abort: (id: string) => { calls.push(`abort:${id}`); agent.status = "stopped"; return true; }, steer: (id: string, text: string) => { calls.push(`steer:${id}:${text}`); return true; } };
  const fleet = new FleetList(manager as never, new Map());
  let handler: (data: string) => { consume?: boolean } | undefined = () => undefined;
  let text = "";
  fleet.setUICtx({ setWidget() {}, onTerminalInput: (h: typeof handler) => { handler = h; return () => {}; }, getEditorText: () => text, setEditorText: (t: string) => { text = t; }, notify() {}, custom: async () => undefined } as never);
  handler(DOWN); handler(DOWN); handler("\r");
  assert.deepEqual(calls, ["show:1"]);
  assert.equal(fleet.hint(plain), "↑/↓ to select");
  assert.equal(fleet.lines(132, plain)[1], "  ◯ main");
  assert.ok(fleet.lines(132, plain)[2].startsWith("❯ ● general-purpose  Check files"));
  assert.deepEqual({ ...fleet.agentView(), startedAt: 0 }, { id: "a1", label: "Check files", name: "general-purpose", color: "#66cccc", running: true, startedAt: 0, tokens: 5 });
  handler("\x1b[A");
  assert.equal(fleet.hint(plain), "↑/↓ to select · Enter to view");
  assert.equal(fleet.lines(132, plain)[1], "❯ ◯ main");
  handler("\r");
  assert.deepEqual(calls, ["show:1", "hide"]);
  assert.equal(fleet.agentView(), undefined);
  assert.equal(fleet.hint(plain), "↑/↓ to select");
  handler(DOWN); handler("\r"); handler("\x1b");
  assert.equal(fleet.hint(plain), undefined);
  text = "hello agent";
  assert.deepEqual(handler("\r"), { consume: true });
  assert.equal(text, "");
  handler("\x1b");
  assert.deepEqual(calls.slice(2), ["show:1", "steer:a1:hello agent", "abort:a1", "show:1"]);
  assert.equal(fleet.agentView()?.running, false);
  handler("\x1b");
  assert.equal(calls.at(-1), "hide");
  assert.equal(fleet.agentView(), undefined);
  fleet.dispose();
  delete (globalThis as Record<string, unknown>).__claudeChatView;
  console.log("PASS: Enter on an agent swaps the transcript to it in place (Claude 2.1.283, m6f-view): ◯ main / ❯ ● agent with \"↑/↓ to select\", \"↑/↓ to select · Enter to view\" on main, Enter on main swaps back; typing sends to the agent, esc stops it while it runs and swaps back once it has stopped");
}

{
  const contract = await jiti.import(path.join(here, "../npm/node_modules/@tintinweb/pi-subagents/src/claude-contract.ts"));
  const samples = readFileSync(path.join(here, "../scripts/parity/findings/m6g/claude/results.txt"), "utf-8");
  const sample = (title: string) => samples.split(/^########## /m).find((part) => part.startsWith(title))!.split("\n").slice(2).join("\n").split("\n\n<system-reminder>\n<total_tokens>")[0].trim();
  const notified = sample("task-notification: completed");
  const outputFile = notified.match(/<output-file>(.*)<\/output-file>/)![1];
  const toolUseId = notified.match(/<tool-use-id>(.*)<\/tool-use-id>/)![1];
  const session = { messages: [{ role: "assistant", usage: { input: 10, output: 5 } }] };
  const record = { id: "a610380364ffe983c", description: "Sleep briefly", status: "completed", result: "bgreport", toolUses: 1, startedAt: 1000, completedAt: 16411, toolCallId: toolUseId, outputFile, session };
  assert.equal(contract.formatTaskNotification(record), notified);
  const killed = sample("task-notification: killed by TaskStop");
  const killedRecord = { id: "a8e8fcf123ce39f3f", description: "Long sleeper", status: "stopped", killedBy: "parent", toolUses: 0, startedAt: 0, completedAt: 1, toolCallId: killed.match(/<tool-use-id>(.*)<\/tool-use-id>/)![1], outputFile: killed.match(/<output-file>(.*)<\/output-file>/)![1] };
  assert.equal(contract.formatTaskNotification(killedRecord), killed);
  const launched = sample("async launch tool_result");
  assert.equal(contract.formatLaunchResult("a610380364ffe983c", launched.match(/^output_file: (.*)$/m)![1]), launched);
  console.log("PASS: the completion and killed <task-notification> and the async launch result are Claude 2.1.283's text byte for byte (findings/m6g/claude/results.txt)");
}

{
  const contract = await jiti.import(path.join(here, "../npm/node_modules/@tintinweb/pi-subagents/src/claude-contract.ts"));
  assert.equal(contract.concurrentLimitError(20), "Concurrent subagent limit reached. You can run 20 subagents at once. Do not retry. If the user wants more concurrent subagents, ask them to increase CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS.");
  assert.equal(contract.turnLimitNote(3, "general-purpose"), "NOTE: this agent stopped at its 3-turn limit before finishing. The text below is PARTIAL output; treat it as incomplete. Send the agent a message (SendMessage) to let it continue from where it stopped.");
  assert.equal(contract.turnLimitNote(3, "Explore"), "NOTE: this agent stopped at its 3-turn limit before finishing. The text below is PARTIAL output; treat it as incomplete.");
  assert.equal(contract.notificationSummaryVerb({ status: "aborted", turnLimit: 3 }), "stopped at its 3-turn limit (partial result; SendMessage to task-id to continue)");
  assert.equal(contract.notificationSummaryVerb({ status: "error", error: "boom" }), "failed: boom");
  assert.equal(contract.notificationSummaryVerb({ status: "stopped" }), "was stopped by user");
  const placed = contract.placeNotifications([{ role: "toolResult", content: [{ type: "text", text: "launched" }] }, { role: "custom", customType: "subagent-notification", content: [{ type: "text", text: "n1" }] }, { role: "assistant", content: [] }, { role: "custom", customType: "subagent-notification", content: [{ type: "text", text: "n2" }] }, { role: "custom", customType: "subagent-notification", content: [{ type: "text", text: "n3" }] }]);
  assert.deepEqual(placed.map((m: { content: { text: string }[] }) => m.content.map((b) => b.text)), [["launched", "n1"], [], ["n2", "n3"]]);
  console.log("PASS: the concurrency refusal, the turn-limit note and summary verbs are Claude 2.1.283's (bundle lLn/g6e/brt); a notification ready inside a tool round joins the last tool_result, notifications ready together share one user message (m6g-types)");
}
