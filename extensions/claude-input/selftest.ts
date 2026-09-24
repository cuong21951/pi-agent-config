import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PI_DIR } from "../../scripts/pi-installs.mjs";

const { createJiti } = await import(pathToFileURL(path.join(PI_DIR, "node_modules/jiti/lib/jiti-static.mjs")).href);
const jiti = createJiti(import.meta.url, {
	alias: {
		"@earendil-works/pi-coding-agent": path.join(PI_DIR, "dist/index.js"),
		"@earendil-works/pi-tui": path.join(PI_DIR, "node_modules/@earendil-works/pi-tui/dist/index.js"),
	},
});

const here = path.dirname(fileURLToPath(import.meta.url));
const { promptLines, default: install } = await jiti.import(path.join(here, "index.ts"));
const { CustomEditor } = await jiti.import(path.join(PI_DIR, "dist/index.js"));
const { KeybindingsManager } = await jiti.import(path.join(PI_DIR, "dist/core/keybindings.js"));
const { setKeybindings } = await jiti.import(path.join(PI_DIR, "node_modules/@earendil-works/pi-tui/dist/keybindings.js"));

const keybindings = KeybindingsManager.create(path.join(process.env.USERPROFILE ?? "", ".pi/agent"));
setKeybindings(keybindings);
const ANSI = /\x1b\[[0-9;]*m/g;
const plain = (s: string) => s.replace(ANSI, "");
const id = (t: string) => t;

{
	const rows = promptLines(["────────", "hi      ", "────────", "auto1"], id);
	assert.deepEqual(rows, ["auto1", "──────────", "❯ hi      ", "──────────"], "rules stretch to full width, text gets the prompt, autocomplete rows move above the box with no gap");
}

{
	const rows = promptLines(["────────", "hi      ", "────────", "auto1", "auto2"], id);
	assert.deepEqual(rows.slice(0, 2), ["auto1", "auto2"], "every autocomplete row moves above the box, not just the first");
	assert.equal(rows[2], "──────────", "the top rule sits directly under the menu, no blank row between");
}

{
	const rows = promptLines(["─── ↑ 2 more ───", "a", "b", "────────────────"], id);
	assert.equal(rows[0], "─── ↑ 2 more ─────", "scroll indicator survives inside the top rule");
	assert.equal(rows[1], "❯ a", "first row carries the prompt, a no-break space after the glyph like Claude 2.1.280's input row");
	assert.equal(rows[2], "  b", "later rows align under the text");
	assert.equal(rows[3], "──────────────────");
}

{
	const rows = promptLines(["────────", "hi", "────────"], id, "<busy>");
	assert.equal(rows[1], "<busy>hi", "a custom prompt mark (the busy-turn colour) replaces the default one");
}

{
	const { commandMatchLength, colourCommand } = await jiti.import(path.join(here, "index.ts"));
	const names = ["clear", "clone", "model"];
	assert.equal(commandMatchLength("/clear", names), 6, "a bare known command matches its full length");
	assert.equal(commandMatchLength("/clear now please", names), 6, "arguments after the command are not part of the match, like Claude's measured '/clear now please' (only '/clear' turns 99ccff)");
	assert.equal(commandMatchLength("/clear/notarealcommand", names), 6, "a known name still matches even glued to trailing text with no separating space, like Claude's measured capture");
	assert.equal(commandMatchLength("/notarealcommand", names), 0, "an unrecognised /word gets no match at all, like Claude's measured '/notarealcommand' (plain colour throughout)");
	assert.equal(commandMatchLength("hello world", names), 0, "plain text with no leading slash gets no match");
	assert.equal(commandMatchLength("@README.md check this", names), 0, "an @mention gets no match either, like Claude's measured capture (plain colour throughout)");
	assert.equal(commandMatchLength("/clone", names), 6, "the longest matching name wins when more than one name could be a prefix");
	const { noMatchRow, promptLines } = await jiti.import(path.join(here, "index.ts"));
	const grey = (t: string) => `<grey>${t}</grey>`;
	assert.deepEqual(noMatchRow("/notarealcommand", grey), ['<grey>  No commands match "/notarealcommand"</grey>'], "an unmatched command token gets Claude 2.1.280's grey row (suggestionsEmptyMessage)");
	assert.deepEqual(noMatchRow("/", grey), [], "a bare slash has no message: Claude needs more than one character");
	assert.deepEqual(noMatchRow("/clear now", grey), [], "arguments are not a command token");
	assert.deepEqual(noMatchRow("hello", grey), [], "plain text is not a command");
	assert.deepEqual(noMatchRow("/cle", grey, ["clear"]), [], "a token that starts a known command never gets the message, even when the menu is closed");
	assert.deepEqual(promptLines(["────", "/x", "────"], id, "❯ ", undefined, ["msg"]).slice(0, 2), ["msg", "──────"], "the message sits where the menu would, only when the menu is empty");
	assert.deepEqual(promptLines(["────", "/c", "────", "menu"], id, "❯ ", undefined, ["msg"])[0], "menu", "a real menu wins");
	const blue = (t: string) => `<blue>${t}</blue>`;
	assert.equal(colourCommand("/clear now please", { names, paint: blue }), "<blue>/clear</blue> now please", "only the matched command prefix is painted; the rest keeps the line's own text");
	assert.equal(colourCommand("hello world", { names, paint: blue }), "hello world", "no match leaves the line untouched");
	assert.equal(colourCommand("/clear\x1b_pi:c\x07\x1b[7m \x1b[27m", { names, paint: blue }), "<blue>/clear</blue>\x1b_pi:c\x07\x1b[7m \x1b[27m", "the editor's cursor marker and inverse-video cursor after the command survive the colouring");
	assert.equal(colourCommand("/cl\x1b[7me\x1b[27mar x", { names, paint: blue }), "<blue>/cl\x1b[7me\x1b[27mar</blue> x", "a cursor inside the command keeps its inverse video");
}

{
	const tui = { requestRender() {}, terminal: { rows: 40, columns: 80 } };
	const theme = { borderColor: id, selectList: {} };
	let factory: any;
	let handler: any;
	install({ on: (n: string, fn: any) => { if (n === "session_start") handler = fn; }, getCommands: () => [{ name: "clear" }, { name: "model" }] });
	handler({}, { hasUI: true, ui: { getEditorComponent: () => undefined, setEditorComponent: (f: any) => { factory = f; }, theme: { fg: (_role: string, text: string) => text } } });
	const editor = factory(tui, theme, keybindings);
	assert.ok(editor instanceof CustomEditor, "falls back to pi's CustomEditor when nothing else owns the editor");
	editor.setText("hello");
	const lines: string[] = editor.render(40).map(plain);
	assert.equal(lines[0], "─".repeat(40), "top rule spans the full width");
	assert.match(lines[1], /^❯ hello/, "real editor row carries the prompt");
	assert.equal(lines[lines.length - 1], "─".repeat(40), "bottom rule spans the full width");
	for (const line of lines) assert.equal(line.length, 40, `real editor row fits width: ${JSON.stringify(line)}`);
	editor.setText("/clear");
	const commandLine = editor.render(40)[1] as string;
	assert.ok(commandLine.includes("\x1b[38;2;153;204;255m/clear\x1b[39m"), `real editor row paints a known typed command 99ccff, like Claude 2.1.280's measured '/clear' run: ${JSON.stringify(commandLine)}`);
}

console.log("claude-input selftest: all assertions passed");
