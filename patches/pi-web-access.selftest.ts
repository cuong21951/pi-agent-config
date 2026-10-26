import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PI_DIR } from "../scripts/pi-installs.mjs";

const { createJiti } = await import(pathToFileURL(path.join(PI_DIR, "node_modules/jiti/lib/jiti-static.mjs")).href);
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": path.join(PI_DIR, "dist/index.js"),
    "@earendil-works/pi-tui": path.join(PI_DIR, "node_modules/@earendil-works/pi-tui/dist/index.js"),
    "@earendil-works/pi-ai/compat": path.join(PI_DIR, "node_modules/@earendil-works/pi-ai/dist/compat.js"),
    "@earendil-works/pi-ai": path.join(PI_DIR, "node_modules/@earendil-works/pi-ai/dist/index.js"),
  },
});

const here = path.dirname(fileURLToPath(import.meta.url));
const mod = await jiti.import(path.join(here, "../npm/node_modules/pi-web-access/index.ts"));
const { claudeDot, formatBytes, searchSummary, default: extension } = mod;

const tagged = { fg: (role, text) => `<${role}>${text}</${role}>`, bold: (text) => `<b>${text}</b>` };
const plain = { fg: (_role, text) => text, bold: (text) => text };
const render = (component, width = 200) => component.render(width).map((line) => line.trimEnd()).join("\n");
const stripAnsi = (text) => text.replace(/\u001b\[[0-9;]*m/g, "");

const tools = [];
const fake = new Proxy(
  { registerTool: (definition) => tools.push(definition), on: () => {}, registerCommand: () => {}, registerShortcut: () => {}, registerMessageRenderer: () => {} },
  { get: (target, key) => (key in target ? target[key] : () => undefined) },
);
extension(fake);
const tool = tools.find((t) => t.label === "Fetch Content");
assert.ok(tool, "fetch tool registered");
assert.equal(tool.renderShell, "self");

const rows = (globalThis.__claudeRows ??= { finished: new Set(), failed: new Set() });

{
  const row = render(tool.renderCall({ url: "https://example.com" }, tagged, { toolCallId: "run" }));
  assert.ok(row === "<muted>● </muted><b>Fetch</b>(https://example.com)" || row === "  <b>Fetch</b>(https://example.com)", row);
  console.log("PASS: running call blinks a grey dot ->", JSON.stringify(row));
}
{
  assert.equal(claudeDot("x", tagged, 0), "<muted>● </muted>");
  assert.equal(claudeDot("x", tagged, 500), "  ");
  rows.finished.add("done");
  assert.equal(claudeDot("done", tagged, 500), "<borderAccent>● </borderAccent>");
  console.log("PASS: dot blinks every 500 ms, blue once finished");
}
{
  const row = render(tool.renderCall({ urls: ["https://a", "https://b"] }, plain, { toolCallId: "m" }));
  assert.ok(row.endsWith("Fetch(2 URLs)"), row);
  console.log("PASS: several urls ->", JSON.stringify(row));
}
{
  const row = render(tool.renderResult({ content: [], details: {} }, { expanded: false, isPartial: true }, tagged, {}));
  assert.equal(row, "<muted>  ⎿ \u00a0</muted><muted>Fetching…</muted>");
  console.log("PASS: partial ->", JSON.stringify(row));
}
{
  const result = { content: [{ type: "text", text: "# Example Domain\nbody" }], details: { urlCount: 1, successful: 1, bytes: 559, status: 200, statusText: "OK" } };
  const row = render(tool.renderResult(result, { expanded: false, isPartial: false }, tagged, {}));
  assert.equal(row, "<muted>  ⎿ \u00a0</muted>Received <b>559 bytes</b> (200 OK)");
  const expanded = render(tool.renderResult(result, { expanded: true, isPartial: false }, plain, {}));
  assert.equal(expanded, "  ⎿ \u00a0Received 559 bytes (200 OK)\n     # Example Domain\n     body");
  console.log("PASS: finished ->", JSON.stringify(row));
}
{
  const result = { content: [{ type: "text", text: "x".repeat(1300) }], details: { urlCount: 1, successful: 1, bytes: 1300, status: 200, statusText: "OK" } };
  const row = render(tool.renderResult(result, { expanded: false, isPartial: false }, plain, {}));
  assert.equal(row, "  ⎿ \u00a0Received 1.3KB (200 OK)");
  console.log("PASS: KB size ->", JSON.stringify(row));
}
{
  const result = { content: [{ type: "text", text: "hi" }], details: { urlCount: 1, successful: 1 } };
  const row = render(tool.renderResult(result, { expanded: false, isPartial: false }, plain, {}));
  assert.equal(row, "  ⎿ \u00a0Received 2 bytes");
  console.log("PASS: no status falls back to text length, no bytes suffix ->", JSON.stringify(row));
}
{
  const result = { content: [{ type: "text", text: "Error: boom" }], details: { error: "boom" } };
  const row = render(tool.renderResult(result, { expanded: false, isPartial: false }, tagged, { isError: true }));
  assert.equal(row, "<muted>  ⎿ \u00a0</muted><error>Error: boom</error>");
  console.log("PASS: error ->", JSON.stringify(row));
}
{
  const result = { content: [{ type: "text", text: "a\nb" }], details: { urlCount: 3, successful: 2, bytes: 1200, status: 200, statusText: "OK" } };
  const row = render(tool.renderResult(result, { expanded: false, isPartial: false }, plain, {}));
  assert.equal(row, "  ⎿ \u00a0Received 1.2KB (200 OK) from 2/3 URLs");
  console.log("PASS: several urls result ->", JSON.stringify(row));
}
{
  assert.equal(formatBytes(0), "0 bytes");
  assert.equal(formatBytes(559), "559 bytes");
  assert.equal(formatBytes(1023), "1023 bytes");
  assert.equal(formatBytes(1024), "1KB");
  assert.equal(formatBytes(1331), "1.3KB");
  assert.equal(formatBytes(1024 * 1024), "1MB");
  assert.equal(formatBytes(1024 * 1024 * 1024), "1GB");
  console.log("PASS: formatBytes matches Claude's Dt()");
}
const search = tools.find((t) => t.label === "Web Search");
assert.ok(search, "web search tool registered");
assert.equal(search.name, "web_search");
assert.equal(search.renderShell, "self");

const searchHead = (query) => {
  const row = render(search.renderCall(query, tagged, { toolCallId: "s-run" }));
  assert.ok(row.startsWith("<muted>● </muted><b>Web Search</b>(") || row.startsWith("  <b>Web Search</b>("), row);
  return row.replace(/^<muted>● <\/muted>|^  /, "");
};

{
  assert.equal(searchHead({ query: "example domain iana" }), '<b>Web Search</b>("example domain iana")');
  console.log("PASS: one query ->", searchHead({ query: "example domain iana" }));
}
{
  assert.equal(searchHead({ queries: ["react vs vue", "react ecosystem"] }), '<b>Web Search</b>("react vs vue", "react ecosystem")');
  assert.equal(searchHead({ query: '["a", "b"]' }), '<b>Web Search</b>("a", "b")');
  assert.equal(searchHead({ queries: ["  a  ", "", 3] }), '<b>Web Search</b>("a")');
  console.log("PASS: several queries ->", searchHead({ queries: ["react vs vue", "react ecosystem"] }));
}
{
  assert.equal(searchHead({}), '<b>Web Search</b>("...")');
  const row = render(search.renderCall({ query: "x".repeat(300) }, plain, { toolCallId: "s-long" }), 60);
  assert.ok(stripAnsi(row).length <= 60, row);
  console.log("PASS: no query and a long query stay on one row");
}
{
  rows.finished.add("s-done");
  const row = render(search.renderCall({ query: "q" }, tagged, { toolCallId: "s-done" }));
  assert.equal(row, '<borderAccent>● </borderAccent><b>Web Search</b>("q")');
  console.log("PASS: the dot turns blue once the call finished");
}
{
  const row = render(search.renderResult({ content: [], details: {} }, { expanded: false, isPartial: true }, tagged, {}));
  assert.equal(row, "<muted>  ⎿ \u00a0</muted><muted>Searching…</muted>");
  console.log("PASS: running ->", JSON.stringify(row));
}
{
  const result = { content: [{ type: "text", text: "Answer line one\nAnswer line two" }], details: { queryCount: 1, durationMs: 12_400 } };
  const row = render(search.renderResult(result, { expanded: false, isPartial: false }, tagged, {}));
  assert.equal(row, "<muted>  ⎿ \u00a0</muted>Did 1 search in 12s");
  const expanded = render(search.renderResult(result, { expanded: true, isPartial: false }, plain, {}));
  assert.equal(expanded, "  ⎿ \u00a0Did 1 search in 12s\n     Answer line one\n     Answer line two");
  console.log("PASS: one search ->", JSON.stringify(row));
}
{
  const long = { content: [{ type: "text", text: Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n") }], details: { queryCount: 1, durationMs: 1000 } };
  const lines = render(search.renderResult(long, { expanded: true, isPartial: false }, plain, {})).split("\n");
  assert.equal(lines.length, 21);
  console.log("PASS: ctrl+o shows the first 20 answer lines");
}
{
  const result = { content: [{ type: "text", text: "## Query: \"a\"\n\nx\n\n## Query: \"b\"\n\ny" }], details: { queryCount: 2, durationMs: 3_200, summary: { text: "Curated summary" }, curatedQueries: [{ query: "a" }] } };
  const row = render(search.renderResult(result, { expanded: false, isPartial: false }, plain, {}));
  assert.equal(row, "  ⎿ \u00a0Did 2 searches in 3s");
  console.log("PASS: several queries, no summary or curator block in the transcript ->", JSON.stringify(row));
}
{
  assert.equal(searchSummary(1, undefined), "Did 1 search");
  assert.equal(searchSummary(3, undefined), "Did 3 searches");
  assert.equal(searchSummary(1, 450), "Did 1 search in 450ms");
  assert.equal(searchSummary(1, 999), "Did 1 search in 999ms");
  assert.equal(searchSummary(1, 1000), "Did 1 search in 1s");
  assert.equal(searchSummary(2, 59_600), "Did 2 searches in 60s");
  console.log("PASS: searchSummary wording and units");
}
{
  const result = { content: [{ type: "text", text: "Error: No query provided. Use 'query' or 'queries' parameter." }], details: { error: "No query provided" } };
  const row = render(search.renderResult(result, { expanded: false, isPartial: false }, tagged, {}));
  assert.equal(row, "<muted>  ⎿ \u00a0</muted><error>Error: No query provided. Use 'query' or 'queries' parameter.</error>");
  const thrown = render(search.renderResult({ content: [{ type: "text", text: "Error: boom" }], details: {} }, { expanded: false, isPartial: false }, tagged, { isError: true }));
  assert.equal(thrown, "<muted>  ⎿ \u00a0</muted><error>Error: boom</error>");
  console.log("PASS: error ->", JSON.stringify(row));
}
{
  const result = await search.execute("s-exec", {}, undefined, undefined, undefined);
  assert.equal(result.details.error, "No query provided");
  assert.equal(typeof result.details.durationMs, "number");
  console.log("PASS: execute stamps durationMs on the result details, errors included");
}

const stored = tools.find((t) => t.label === "Get Search Content");
assert.ok(stored, "get_search_content registered");
assert.equal(stored.renderCall, undefined);
assert.equal(stored.renderResult, undefined);
console.log("PASS: get_search_content has no renderer of its own, so claude-tools' fallback draws it");

{
  const rowsModule = await jiti.import(path.join(here, "../extensions/claude-tools/rows.ts"));
  const handlers = {};
  rowsModule.track({ on: (name, handler) => (handlers[name] = handler) });
  handlers.agent_start({}, {});
  const run = (id, args) => {
    handlers.tool_execution_start({ toolCallId: id, toolName: stored.name, args }, {});
    handlers.tool_call({ toolCallId: id, toolName: stored.name, input: args }, {});
  };
  run("g1", { responseId: "r", urlIndex: 0 });
  assert.equal(rowsModule.summaryFor("g1"), "  Read 1 fetched page");
  assert.equal(render({ render: (width) => rowsModule.groupRow("g1", width, plain) }).includes("Reading 1 fetched page…"), true, "running");
  handlers.tool_execution_end({ toolCallId: "g1", toolName: stored.name, isError: false }, {});
  run("g2", { responseId: "r", urlIndex: 2 });
  handlers.tool_execution_end({ toolCallId: "g2", toolName: stored.name, isError: false }, {});
  handlers.agent_end({}, {});
  assert.equal(rowsModule.summaryFor("g1"), "");
  assert.equal(rowsModule.summaryFor("g2"), "  Read 2 fetched pages");
  assert.equal(render({ render: (width) => rowsModule.groupRow("g2", width, plain) }), "  Read 2 fetched pages");
  console.log("PASS: get_search_content joins claude-tools' grey sentence: running 'Reading 1 fetched page…', finished 'Read 2 fetched pages'");
}

console.log("ok - pi-web-access fetch rows");
