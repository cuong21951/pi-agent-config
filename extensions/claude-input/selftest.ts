import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PI_DIR = "C:/Users/cuong/AppData/Local/Volta/tools/image/packages/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-coding-agent";

const { createJiti } = await import(pathToFileURL(path.join(PI_DIR, "node_modules/jiti/lib/jiti-static.mjs")).href);
const jiti = createJiti(import.meta.url, {
	alias: {
		"@earendil-works/pi-coding-agent": path.join(PI_DIR, "dist/index.js"),
		"@earendil-works/pi-tui": path.join(PI_DIR, "node_modules/@earendil-works/pi-tui/dist/index.js"),
	},
});

const here = path.dirname(fileURLToPath(import.meta.url));
const { boxLines, default: install } = await jiti.import(path.join(here, "index.ts"));
const { CustomEditor } = await jiti.import(path.join(PI_DIR, "dist/index.js"));
const { KeybindingsManager } = await jiti.import(path.join(PI_DIR, "dist/core/keybindings.js"));
const { setKeybindings } = await jiti.import(path.join(PI_DIR, "node_modules/@earendil-works/pi-tui/dist/keybindings.js"));

const keybindings = KeybindingsManager.create(path.join(process.env.USERPROFILE ?? "", ".pi/agent"));
setKeybindings(keybindings);
const ANSI = /\x1b\[[0-9;]*m/g;
const plain = (s: string) => s.replace(ANSI, "");
const id = (t: string) => t;

{
	const boxed = boxLines(["────────", "hi      ", "────────", "auto1"], 14, id);
	assert.deepEqual(boxed, ["╭────────────╮", "│ > hi       │", "╰────────────╯", "auto1"], "rules become corners, autocomplete rows untouched");
}

{
	const boxed = boxLines(["─── ↑ 2 more ───", "a", "b", "────────────────"], 22, id);
	assert.equal(boxed[0], "╭───── ↑ 2 more ─────╮", "scroll indicator survives inside the top rule");
	assert.equal(boxed[1], "│ > a                │", "first row carries the prompt");
	assert.equal(boxed[2], "│   b                │", "later rows align under the text");
	assert.equal(boxed[3], "╰────────────────────╯");
	for (const line of boxed) assert.equal(plain(line).length, 22, `every row is exactly width: ${line}`);
}

{
	const tui = { requestRender() {}, terminal: { rows: 40, columns: 80 } };
	const theme = { borderColor: id, selectList: {} };
	let factory: any;
	let handler: any;
	install({ on: (n: string, fn: any) => { if (n === "session_start") handler = fn; } });
	handler({}, { hasUI: true, ui: { getEditorComponent: () => undefined, setEditorComponent: (f: any) => { factory = f; } } });
	const editor = factory(tui, theme, keybindings);
	assert.ok(editor instanceof CustomEditor, "falls back to pi's CustomEditor when nothing else owns the editor");
	editor.setText("hello");
	const lines: string[] = editor.render(40).map(plain);
	assert.equal(lines[0], `╭${"─".repeat(38)}╮`);
	assert.match(lines[1], /^│ > hello.*│$/, "real editor row is boxed with the prompt");
	assert.equal(lines[lines.length - 1], `╰${"─".repeat(38)}╯`);
	for (const line of lines) assert.equal(line.length, 40, `real editor row fits width: ${JSON.stringify(line)}`);
}

console.log("claude-input selftest: all assertions passed");
