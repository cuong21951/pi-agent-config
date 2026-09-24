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
const { claudeDot, formatBytes, default: extension } = mod;

const tagged = { fg: (role, text) => `<${role}>${text}</${role}>`, bold: (text) => `<b>${text}</b>` };
const plain = { fg: (_role, text) => text, bold: (text) => text };
const render = (component, width = 200) => component.render(width).map((line) => line.trimEnd()).join("\n");

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
console.log("ok - pi-web-access fetch rows");
