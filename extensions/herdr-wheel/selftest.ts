import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PI_DIR = "C:/Users/cuong/AppData/Local/Volta/tools/image/packages/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-coding-agent";

const { createJiti } = await import(
	pathToFileURL(path.join(PI_DIR, "node_modules/jiti/lib/jiti-static.mjs")).href
);
const jiti = createJiti(import.meta.url, {
	alias: { "@earendil-works/pi-coding-agent": path.join(PI_DIR, "dist/index.js") },
});

const here = path.dirname(fileURLToPath(import.meta.url));
const { WheelEditor } = (await jiti.import(path.join(here, "index.ts")));
const { KeybindingsManager } = await jiti.import(path.join(PI_DIR, "dist/core/keybindings.js"));
const { setKeybindings } = await jiti.import(
	path.join(PI_DIR, "node_modules/@earendil-works/pi-tui/dist/keybindings.js")
);

setKeybindings(KeybindingsManager.create(path.join(process.env.USERPROFILE ?? "", ".pi/agent")));

const UP = "\x1b[A";
const DOWN = "\x1b[B";
const CTRL_P = "\x10";
const CTRL_N = "\x0e";

function makeEditor() {
	const scrolls: number[] = [];
	const editor = new WheelEditor(
		{ requestRender() {}, scrollBy(n: number) { scrolls.push(n); } },
		{ borderColor: (s: string) => s },
		KeybindingsManager.create(path.join(process.env.USERPROFILE ?? "", ".pi/agent")),
	);
	return { editor, scrolls };
}

{
	const { editor, scrolls } = makeEditor();
	editor.setText("hello");
	editor.addToHistory("old prompt");
	editor.handleInput(UP);
	assert.deepEqual(scrolls, [-1], "single-line draft: Up must scroll, not recall");
	assert.equal(editor.getText(), "hello", "single-line draft: Up must not replace the draft");
}

{
	const { editor, scrolls } = makeEditor();
	editor.setText("hello");
	editor.handleInput(DOWN);
	assert.deepEqual(scrolls, [1], "single-line draft: Down must scroll");
	assert.equal(editor.getText(), "hello");
}

{
	const { editor, scrolls } = makeEditor();
	editor.handleInput(UP);
	assert.deepEqual(scrolls, [-1], "empty prompt: Up scrolls");
	editor.handleInput(DOWN);
	assert.deepEqual(scrolls, [-1, 1], "empty prompt: Down scrolls");
	assert.equal(editor.getText(), "");
}

{
	const { editor, scrolls } = makeEditor();
	editor.setText("line1\nline2");
	editor.handleInput(UP);
	assert.deepEqual(scrolls, [], "multiline draft: Up moves cursor, no scroll");
	assert.deepEqual(editor.getCursor(), { line: 0, col: 5 }, "multiline draft: cursor moved up");
	editor.handleInput(DOWN);
	assert.deepEqual(editor.getCursor(), { line: 1, col: 5 }, "multiline draft: cursor moved down");
	assert.equal(editor.getText(), "line1\nline2");
}

{
	const { editor, scrolls } = makeEditor();
	editor.addToHistory("old prompt");
	editor.handleInput(CTRL_P);
	assert.equal(editor.getText(), "old prompt", "ctrl+p recalls previous prompt");
	assert.deepEqual(scrolls, [], "ctrl+p does not scroll");
	editor.handleInput(CTRL_N);
	assert.equal(editor.getText(), "", "ctrl+n returns to empty draft");
}

{
	const { editor, scrolls } = makeEditor();
	editor.handleInput("x");
	assert.equal(editor.getText(), "x", "plain typing still reaches the editor");
	editor.handleInput("\r");
	assert.deepEqual(scrolls, [], "enter does not scroll");
}

console.log("herdr-wheel selftest: all assertions passed");
