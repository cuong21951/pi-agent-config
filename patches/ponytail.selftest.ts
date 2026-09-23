import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "../npm/node_modules/@dietrichgebert/ponytail/pi-extension/index.js"), "utf8");
assert.match(source, /pi\.on\("session_start", async \(event, ctx\) =>/);
assert.match(source, /if \(!getQuietStartup\(\) && event\?\.reason !== "new"\) \{\s+ctx\?\.ui\?\.notify\?\.\(`Ponytail loaded/);
console.log("PASS: \"Ponytail loaded\" shows at startup and resume, not after /new or /clear (Claude 2.1.280 shows no hook output after /clear)");
