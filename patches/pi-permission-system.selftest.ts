import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PI_DIR } from "../scripts/pi-installs.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import(pathToFileURL(path.join(PI_DIR, "node_modules/jiti/lib/jiti-static.mjs")).href);
const { renderToolSurface } = await createJiti(import.meta.url).import(path.join(here, "../npm/node_modules/@gotgenes/pi-permission-system/src/exposure/tool-surface-prompt.ts"));
const explore = readFileSync(path.join(here, "../scripts/parity/findings/m6g/claude/subagent-system-M6G-SUB-EX.txt"), "utf8");
const inputs = { allowedTools: ["read"], toolSnippets: { read: "Read file contents" }, guidelinesByTool: new Map() };

const piBase = "You are pi.\n\nAvailable tools:\n- read: Read file contents\n\nIn addition to the tools above, you may have access to other custom tools depending on the project.\n\nGuidelines:\n- Be concise in your responses\n- Show file paths clearly when working with files\n\nPi documentation:\n- docs";
const relocated = renderToolSurface(piBase, inputs);
assert.equal(relocated.match(/^Guidelines:$/gm)?.length, 1, "pi's own Guidelines section is moved, not duplicated");
assert.ok(relocated.indexOf("Pi documentation:") < relocated.indexOf("Guidelines:"), "pi's Guidelines section moves to the end");
assert.equal(renderToolSurface(relocated, inputs), relocated, "relocating twice changes nothing");

const kept = renderToolSurface(explore, inputs);
assert.ok(kept.includes("\nGuidelines:\n- Use Glob for broad file pattern matching\n"), "a custom prompt's own Guidelines section stays");
assert.equal(renderToolSurface(`${explore}\n\n${relocated}`, inputs).match(/^- Be concise in your responses$/gm)?.length, 1, "the relocated block is found past a custom Guidelines section");
console.log("PASS: pi-permission-system relocates only the Guidelines section pi wrote; Claude's Explore guidelines reach the subagent");
