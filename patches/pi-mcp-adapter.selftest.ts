import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PI_DIR = "C:/Users/cuong/AppData/Local/Volta/tools/image/packages/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-coding-agent";

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
const mod = await jiti.import(path.join(here, "../npm/node_modules/pi-mcp-adapter/tool-result-renderer.ts"));
const {
  createMcpDirectToolCallRenderer,
  createMcpProxyToolCallRenderer,
  createMcpToolResultRenderer,
  resolveMcpToolRenderOptions,
} = mod;

const plainTheme = { fg: (_r, t) => t, bold: (t) => t };
const taggedTheme = { fg: (r, t) => `<${r}>${t}</${r}>`, bold: (t) => t };

const compactOptions = resolveMcpToolRenderOptions({ toolResultRendering: "compact" });
const boxedOptions = resolveMcpToolRenderOptions({ toolResultRendering: "boxed" });

function makeResult(text, details = { mode: "call", server: "azure-devops-tbr", tool: "pipelines_write" }) {
  return {
    content: text === undefined ? [] : [{ type: "text", text }],
    details,
  };
}

function makeContext(isError = false) {
  return { isError, state: {} };
}

function runCall(renderer, args, context, theme = plainTheme) {
  return renderer(args, theme, context);
}

function runResult(resultRenderer, result, options, context, theme = plainTheme) {
  const component = resultRenderer(result, options, theme, context);
  return component.render(200).map((line) => line.trimEnd()).join("\n");
}

// Claude Code 2.1.261, measured live: running = blinking grey dot + "Calling <server>…", finished = grey
// "Called <server>", no result preview; ctrl+o expands to the full row. Errors keep the row (unmeasured).

// --- Direct tool, 2 args: collapsed is one grey line, expanded is the full row ---
{
  const renderCall = createMcpDirectToolCallRenderer("azure-devops-tbr_pipelines_write", "azure-devops-tbr", "pipelines_write", compactOptions);
  const renderResult = createMcpToolResultRenderer(compactOptions);
  const context = makeContext();
  runCall(renderCall, { action: "update_build", buildId: 512 }, context);
  assert.equal(context.state.compactTitle, "azure-devops-tbr - pipelines_write (MCP)");
  assert.equal(context.state.compactInputPreview, '(action: "update_build", buildId: 512)');
  assert.equal(context.state.compactServer, "azure-devops-tbr");

  const done = runResult(renderResult, makeResult("Build 512 queued"), { isPartial: false, expanded: false }, context);
  assert.equal(done, "Called azure-devops-tbr");
  const painted = runResult(renderResult, makeResult("Build 512 queued"), { isPartial: false, expanded: false }, context, taggedTheme);
  assert.equal(painted, "<muted>Called azure-devops-tbr</muted>");
  const expanded = runResult(renderResult, makeResult("Build 512 queued"), { isPartial: false, expanded: true }, context);
  assert.equal(expanded, '● azure-devops-tbr - pipelines_write (MCP)(action: "update_build", buildId: 512)\n     Build 512 queued');
  console.log("PASS: direct tool ->", JSON.stringify(done), "/", JSON.stringify(expanded));
}

// --- Direct tool, 6 args (shows 4 then …) ---
{
  const renderCall = createMcpDirectToolCallRenderer("srv_tool", "srv", "tool", compactOptions);
  const context = makeContext();
  runCall(renderCall, { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }, context);
  assert.equal(context.state.compactInputPreview, "(a: 1, b: 2, c: 3, d: 4, …)");
  console.log("PASS: 6 args ->", context.state.compactInputPreview);
}

// --- Direct tool, no args ---
{
  const renderCall = createMcpDirectToolCallRenderer("srv_tool", "srv", "tool", compactOptions);
  const renderResult = createMcpToolResultRenderer(compactOptions);
  const context = makeContext();
  runCall(renderCall, {}, context);
  assert.equal(context.state.compactTitle, "srv - tool (MCP)");
  assert.equal(context.state.compactInputPreview, "");
  assert.equal(runResult(renderResult, makeResult("ok"), { isPartial: false, expanded: false }, context), "Called srv");
  assert.equal(runResult(renderResult, makeResult("ok"), { isPartial: false, expanded: true }, context), "● srv - tool (MCP)\n     ok");
  console.log("PASS: no args");
}

// --- Proxy "mcp call" row (tool embeds server_tool, no explicit server) ---
{
  const renderCall = createMcpProxyToolCallRenderer(compactOptions);
  const renderResult = createMcpToolResultRenderer(compactOptions);
  const context = makeContext();
  runCall(renderCall, { tool: "azure-devops-tbr_pipelines_write", args: { action: "update_build", buildId: 512 } }, context);
  assert.equal(context.state.compactTitle, "azure-devops-tbr - pipelines_write (MCP)");
  assert.equal(context.state.compactInputPreview, '(action: "update_build", buildId: 512)');
  assert.equal(runResult(renderResult, makeResult("Build 512 queued"), { isPartial: false, expanded: false }, context), "Called azure-devops-tbr");
  console.log("PASS: proxy mcp call");
}

// --- Proxy "mcp call ... @ server" (explicit server) ---
{
  const renderCall = createMcpProxyToolCallRenderer(compactOptions);
  const context = makeContext();
  runCall(renderCall, { tool: "pipelines_write", server: "azure-devops-tbr", args: { action: "update_build" } }, context);
  assert.equal(context.state.compactTitle, "azure-devops-tbr - pipelines_write (MCP)");
  assert.equal(context.state.compactServer, "azure-devops-tbr");
  console.log("PASS: proxy mcp call @ server");
}

// --- Other proxy action (mcp search) has no server: its text is the grey line ---
{
  const renderCall = createMcpProxyToolCallRenderer(compactOptions);
  const renderResult = createMcpToolResultRenderer(compactOptions);
  const context = makeContext();
  runCall(renderCall, { search: "pipelines" }, context);
  assert.equal(context.state.compactTitle, "mcp search pipelines");
  assert.equal(context.state.compactServer, undefined);
  const row = runResult(renderResult, makeResult("found 3", { mode: "search" }), { isPartial: false, expanded: false }, context);
  assert.equal(row, "mcp search pipelines");
  console.log("PASS: mcp search ->", JSON.stringify(row));
}

// --- Result without call state (replayed session) takes the server from the details ---
{
  const renderResult = createMcpToolResultRenderer(compactOptions);
  const row = runResult(renderResult, makeResult("ok", { mode: "call", server: "dse", tool: "list" }), { isPartial: false, expanded: false }, { isError: false });
  assert.equal(row, "Called dse");
  console.log("PASS: replayed result ->", JSON.stringify(row));
}

// --- Error result: row stays, elbow + red first line, no ✗ ---
{
  const renderCall = createMcpDirectToolCallRenderer("srv_tool", "srv", "tool", compactOptions);
  const renderResult = createMcpToolResultRenderer(compactOptions);
  const context = makeContext(true);
  const callComponent = runCall(renderCall, { q: 1 }, context);
  assert.deepEqual(callComponent.render(200), [], "compact call block never prints, even on error");
  const result = makeResult("Error: boom\nstack trace line 2", { mode: "call", server: "srv", tool: "tool", error: true });
  const row = runResult(renderResult, result, { isPartial: false, expanded: false }, context);
  assert.equal(row, "● srv - tool (MCP)(q: 1)\n  ⎿ \u00a0Error: boom");
  const painted = runResult(renderResult, result, { isPartial: false, expanded: false }, context, taggedTheme);
  assert.ok(painted.endsWith("<error>  ⎿ \u00a0Error: boom</error>"), "error row painted error");
  console.log("PASS: error result ->", JSON.stringify(row));
}

// --- Expanded output ---
{
  const renderCall = createMcpDirectToolCallRenderer("srv_tool", "srv", "tool", compactOptions);
  const renderResult = createMcpToolResultRenderer(compactOptions);
  const context = makeContext();
  runCall(renderCall, {}, context);
  const text = ["line1", "line2", "line3"].join("\n");
  const row = runResult(renderResult, makeResult(text), { isPartial: false, expanded: true }, context);
  assert.equal(row, "● srv - tool (MCP)\n     line1\n     line2\n     line3");
  console.log("PASS: expanded ->", JSON.stringify(row));
}

// --- Partial (still running): blinking grey dot + Calling server… ---
{
  const renderCall = createMcpDirectToolCallRenderer("srv_tool", "srv", "tool", compactOptions);
  const renderResult = createMcpToolResultRenderer(compactOptions);
  const context = makeContext();
  runCall(renderCall, { action: "update_build" }, context);
  const row = runResult(renderResult, makeResult(undefined), { isPartial: true, expanded: false }, context, taggedTheme);
  assert.match(row, /^(<muted>● <\/muted>|  )Calling srv…$/);
  console.log("PASS: partial ->", JSON.stringify(row));
}

// --- Empty result ---
{
  const renderCall = createMcpDirectToolCallRenderer("srv_tool", "srv", "tool", compactOptions);
  const renderResult = createMcpToolResultRenderer(compactOptions);
  const context = makeContext();
  runCall(renderCall, {}, context);
  assert.equal(runResult(renderResult, makeResult(undefined), { isPartial: false, expanded: false }, context), "Called srv");
  assert.equal(runResult(renderResult, makeResult(undefined), { isPartial: false, expanded: true }, context), "● srv - tool (MCP)\n     (empty result)");
  console.log("PASS: empty result");
}

// --- Boxed mode unchanged: uses "MCP server/tool" identity line, no bullet, no elbow ---
{
  const renderCall = createMcpDirectToolCallRenderer("azure-devops-tbr_pipelines_write", "azure-devops-tbr", "pipelines_write", boxedOptions);
  const renderResult = createMcpToolResultRenderer(boxedOptions);
  const context = makeContext();
  const callComponent = runCall(renderCall, { action: "update_build", buildId: 512 }, context);
  const callLines = callComponent.render(200).map((line) => line.trimEnd()).join("\n");
  assert.equal(callLines, 'azure-devops-tbr_pipelines_write\n{\n  "action": "update_build",\n  "buildId": 512\n}');
  const row = runResult(renderResult, makeResult("Build 512 queued"), { isPartial: false, expanded: false }, context);
  assert.equal(row, "MCP azure-devops-tbr/pipelines_write\nBuild 512 queued");
  console.log("PASS: boxed mode unchanged ->", JSON.stringify(row));
}

{
  const renderResult = createMcpToolResultRenderer(compactOptions);
  const noDetails = { content: [], details: undefined };
  const running = runResult(renderResult, noDetails, { isPartial: true, expanded: false }, { isError: false, state: { compactTitle: "mcpScript" } });
  assert.match(running, /Calling mcpScript…$/);
  const done = runResult(renderResult, noDetails, { isPartial: false, expanded: false }, { isError: false, state: { compactTitle: "mcpScript" } });
  assert.equal(done, "mcpScript");
  console.log("PASS: a result with no details (running mcpScript) renders instead of crashing pi ->", JSON.stringify(running));
}

// --- Grouping through claude-tools: two calls to one server collapse into Claude's "Called dse 2 times" ---
{
  const rows = await jiti.import(path.join(here, "../extensions/claude-tools/rows.ts"));
  const calls = {};
  rows.track({ on: (name, handler) => (calls[name] = handler) });
  calls.agent_start({}, {});
  const renderCall = createMcpDirectToolCallRenderer("dse_list", "dse", "list", compactOptions);
  const renderResult = createMcpToolResultRenderer(compactOptions);
  const context = (id) => ({ isError: false, state: {}, toolCallId: id, invalidate() {} });
  const callRow = (id, ctx = context(id)) => renderCall({}, plainTheme, ctx).render(200).map((line) => line.trimEnd()).join("\n");
  const first = context("mcp-1");
  const second = context("mcp-2");
  calls.tool_execution_start({ toolCallId: "mcp-1", toolName: "dse_list", args: {} }, {});
  assert.equal(callRow("mcp-1"), "", "a call that has not started executing draws nothing");
  calls.tool_call({ toolCallId: "mcp-1", toolName: "dse_list", input: {} }, {});
  assert.match(callRow("mcp-1", first), /^(● |  )Calling dse…$/, "a running MCP call is Claude's active group, \"Calling dse…\" behind the blinking dot");
  assert.equal(runResult(renderResult, makeResult(undefined), { isPartial: true, expanded: false }, first), "", "the partial result draws nothing; the call row carries the group");
  calls.tool_execution_end({ toolCallId: "mcp-1" }, {});
  calls.agent_end({}, {});
  assert.equal(callRow("mcp-1", first), "  Called dse");
  assert.equal(runResult(renderResult, makeResult("a", { mode: "call", server: "dse", tool: "list" }), { isPartial: false, expanded: false }, first), "");
  calls.agent_start({}, {});
  calls.tool_execution_start({ toolCallId: "mcp-2", toolName: "dse_get", args: {} }, {});
  calls.tool_call({ toolCallId: "mcp-2", toolName: "dse_get", input: {} }, {});
  calls.tool_execution_end({ toolCallId: "mcp-2" }, {});
  runResult(renderResult, makeResult("b", { mode: "call", server: "dse", tool: "get" }), { isPartial: false, expanded: false }, second);
  calls.agent_end({}, {});
  assert.equal(callRow("mcp-2", second), "  Called dse", "a new prompt starts a new group");
  calls.agent_start({}, {});
  calls.tool_execution_start({ toolCallId: "mcp-3", toolName: "dse_get", args: {} }, {});
  calls.tool_call({ toolCallId: "mcp-3", toolName: "dse_get", input: {} }, {});
  calls.tool_execution_end({ toolCallId: "mcp-3" }, {});
  calls.tool_execution_start({ toolCallId: "mcp-4", toolName: "dse_write", args: {} }, {});
  calls.tool_call({ toolCallId: "mcp-4", toolName: "dse_write", input: {} }, {});
  calls.tool_execution_end({ toolCallId: "mcp-4", isError: true }, {});
  calls.agent_end({}, {});
  const failed = { ...context("mcp-4"), isError: true };
  assert.equal(callRow("mcp-3"), "", "an earlier member of a group draws nothing");
  const merged = callRow("mcp-4", failed);
  assert.equal(merged, "  Called dse 2 times");
  assert.equal(renderCall({}, plainTheme, { ...failed, expanded: true }).render(200).length, 0, "ctrl+o hides the group row");
  assert.match(runResult(renderResult, makeResult("Error: boom", { mode: "call", server: "dse", tool: "write", error: "boom" }), { isPartial: false, expanded: true }, failed), /Error: boom/);
  console.log("PASS: a failed call inside the group folds into it like Claude 2.1.280; ctrl+o still shows the error");
  console.log("PASS: grouped MCP calls ->", JSON.stringify(merged), "(first row hidden, ctrl+o restores it)");
}

{
  const { readFileSync } = await import("node:fs");
  const packageFile = (name: string) => readFileSync(path.join(here, "../npm/node_modules/pi-mcp-adapter", name), "utf8");
  assert.match(packageFile("init.ts"), /connectedCount > 0 && config\.settings\?\.notifyOnStartupConnect === true\)/);
  assert.match(packageFile("index.ts"), /changed > 0 && ctx\?\.hasUI && config\.settings\?\.notifyOnStartupConnect === true\)/);
  console.log("PASS: connecting and refreshing MCP servers is silent by default, like Claude 2.1.280 (only failures notify)");
}

console.log("\nAll selftest assertions passed.");
