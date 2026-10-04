import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "../npm/node_modules/@dietrichgebert/ponytail/pi-extension/index.js"), "utf8");
assert.doesNotMatch(source, /notify\?\.\(`Ponytail loaded/);
assert.match(source, /pi\.on\("session_start", async \(_event, ctx\) =>[\s\S]*?syncStatus\(ctx\);\s+\}\);/);
console.log("PASS: no \"Ponytail loaded\" row at session start (Claude 2.1.289 draws no session-start row: its agents-md notice goes to the debug log; 2.1.283 drew one)");
